# Story Editor - Safe Save Implementation

## Data Integrity Requirements

### 1. Soft-Delete Pattern for POI Deselection

**Schema Changes:**
```typescript
export const theme_section_pois = pgTable('theme_section_pois', {
  id: serial('id').primaryKey(),
  theme_story_section_id: integer('theme_story_section_id')
    .notNull()
    .references(() => theme_story_sections.id, { onDelete: 'cascade' }),
  poi_id: integer('poi_id')
    .notNull()
    .references(() => pois.id, { onDelete: 'restrict' }),
  sort_order: integer('sort_order').notNull(),

  // Soft-delete fields:
  is_active: boolean('is_active').notNull().default(true),
  deleted_at: timestamp('deleted_at'),
  deleted_by: integer('deleted_by').references(() => users.id),

  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});
```

**Migration:**
```sql
ALTER TABLE theme_section_pois
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN deleted_at TIMESTAMP,
  ADD COLUMN deleted_by INTEGER REFERENCES users(id);

-- Create partial index for active records only
CREATE UNIQUE INDEX theme_section_pois_active_unique
  ON theme_section_pois (theme_story_section_id, poi_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX theme_section_pois_sort_order_unique
  ON theme_section_pois (theme_story_section_id, sort_order)
  WHERE is_active = true;
```

### 2. Optimistic Locking for Concurrent Edits

**Schema Changes:**
```typescript
export const theme_stories = pgTable('theme_stories', {
  id: serial('id').primaryKey(),
  bridge_text: text('bridge_text'),
  version: integer('version').notNull().default(0),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const theme_story_sections = pgTable('theme_story_sections', {
  id: serial('id').primaryKey(),
  description: text('description'),
  version: integer('version').notNull().default(0),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});
```

**Migration:**
```sql
ALTER TABLE theme_stories
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE theme_story_sections
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
```

### 3. Transactional Save Operation

**Server Action:**
```typescript
// app/actions/story-editor.ts
'use server';

import { db } from '@/lib/db';
import {
  theme_stories,
  theme_story_sections,
  theme_section_pois
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export interface SaveStoryEditsPayload {
  storyId: number;
  expectedVersion: number; // For optimistic locking
  loadedAt: Date; // For timestamp check

  bridgeText?: string;

  sections: Array<{
    id: number;
    description: string;
    expectedVersion: number;
  }>;

  poiChanges: Array<
    | { action: 'deselect'; joinId: number }
    | { action: 'reorder'; sectionId: number; orderedJoinIds: number[] }
  >;
}

export async function saveStoryEdits(payload: SaveStoryEditsPayload) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Input validation
  validatePayload(payload);

  try {
    await db.transaction(async (tx) => {
      // 1. Check version for theme_stories
      const currentStory = await tx
        .select({ version: theme_stories.version })
        .from(theme_stories)
        .where(eq(theme_stories.id, payload.storyId))
        .limit(1);

      if (!currentStory[0]) {
        throw new Error('Story not found');
      }

      if (currentStory[0].version !== payload.expectedVersion) {
        throw new Error('CONFLICT: Story was modified by another user. Please reload and try again.');
      }

      // 2. Update theme_stories if bridge_text changed
      if (payload.bridgeText !== undefined) {
        await tx
          .update(theme_stories)
          .set({
            bridge_text: payload.bridgeText,
            version: sql`${theme_stories.version} + 1`,
            updated_at: new Date(),
          })
          .where(eq(theme_stories.id, payload.storyId));
      }

      // 3. Update theme_story_sections
      for (const section of payload.sections) {
        const currentSection = await tx
          .select({ version: theme_story_sections.version })
          .from(theme_story_sections)
          .where(eq(theme_story_sections.id, section.id))
          .limit(1);

        if (!currentSection[0]) {
          throw new Error(`Section ${section.id} not found`);
        }

        if (currentSection[0].version !== section.expectedVersion) {
          throw new Error(`CONFLICT: Section ${section.id} was modified by another user`);
        }

        await tx
          .update(theme_story_sections)
          .set({
            description: section.description,
            version: sql`${theme_story_sections.version} + 1`,
            updated_at: new Date(),
          })
          .where(eq(theme_story_sections.id, section.id));
      }

      // 4. Process POI changes
      for (const change of payload.poiChanges) {
        if (change.action === 'deselect') {
          // Soft-delete
          await tx
            .update(theme_section_pois)
            .set({
              is_active: false,
              deleted_at: new Date(),
              deleted_by: session.user.id,
            })
            .where(eq(theme_section_pois.id, change.joinId));
        } else if (change.action === 'reorder') {
          // Renumber entire sequence to avoid duplicates
          for (let i = 0; i < change.orderedJoinIds.length; i++) {
            await tx
              .update(theme_section_pois)
              .set({
                sort_order: i + 1,
                updated_at: new Date(),
              })
              .where(and(
                eq(theme_section_pois.id, change.orderedJoinIds[i]),
                eq(theme_section_pois.is_active, true)
              ));
          }
        }
      }

      // All operations succeeded - transaction commits
    });

    // 5. Revalidate after successful transaction
    revalidatePath(`/stories/${payload.storyId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
      // User-facing conflict error
      return {
        success: false,
        error: error.message,
        requiresReload: true
      };
    }
    // Log unexpected errors
    console.error('Story save failed:', error);
    throw new Error('Failed to save story edits');
  }
}

function validatePayload(payload: SaveStoryEditsPayload) {
  if (!payload.storyId || payload.storyId < 1) {
    throw new Error('Invalid story ID');
  }

  if (payload.bridgeText && payload.bridgeText.length > 5000) {
    throw new Error('Bridge text exceeds maximum length (5000 characters)');
  }

  for (const section of payload.sections) {
    if (section.description.length > 10000) {
      throw new Error(`Section ${section.id} description exceeds maximum length`);
    }
  }

  for (const change of payload.poiChanges) {
    if (change.action === 'reorder') {
      if (change.orderedJoinIds.length === 0) {
        throw new Error('Reorder operation requires at least one POI');
      }
      // Check for duplicates
      const unique = new Set(change.orderedJoinIds);
      if (unique.size !== change.orderedJoinIds.length) {
        throw new Error('Duplicate POI IDs in reorder operation');
      }
    }
  }
}
```

### 4. Client-Side Integration

**Load story with version tracking:**
```typescript
// app/story-editor/[id]/page.tsx
export default async function StoryEditorPage({ params }: { params: { id: string } }) {
  const storyId = parseInt(params.id);

  const story = await db
    .select({
      id: theme_stories.id,
      bridge_text: theme_stories.bridge_text,
      version: theme_stories.version,
      updated_at: theme_stories.updated_at,
    })
    .from(theme_stories)
    .where(eq(theme_stories.id, storyId))
    .limit(1);

  const sections = await db
    .select({
      id: theme_story_sections.id,
      description: theme_story_sections.description,
      version: theme_story_sections.version,
    })
    .from(theme_story_sections)
    .where(eq(theme_story_sections.theme_story_id, storyId));

  return (
    <StoryEditor
      story={story[0]}
      sections={sections}
      loadedAt={new Date()}
    />
  );
}
```

**Handle save conflicts:**
```typescript
// components/StoryEditor.tsx
'use client';

async function handleSave() {
  const result = await saveStoryEdits({
    storyId: story.id,
    expectedVersion: story.version,
    loadedAt: loadedAt,
    bridgeText: editedBridgeText,
    sections: sections.map(s => ({
      id: s.id,
      description: s.description,
      expectedVersion: s.version,
    })),
    poiChanges: pendingChanges,
  });

  if (!result.success && result.requiresReload) {
    // Show conflict dialog
    const shouldReload = confirm(
      'This story was modified by another user. ' +
      'Your changes will be lost. Reload to see latest version?'
    );

    if (shouldReload) {
      window.location.reload();
    }
  } else if (result.success) {
    toast.success('Story saved successfully');
    // Update local versions
    setStory(prev => ({ ...prev, version: prev.version + 1 }));
  }
}
```

### 5. Database Constraints

**Ensure referential integrity:**
```sql
-- Cascade deletes for child records
ALTER TABLE theme_story_sections
  DROP CONSTRAINT IF EXISTS theme_story_sections_theme_story_id_fkey,
  ADD CONSTRAINT theme_story_sections_theme_story_id_fkey
    FOREIGN KEY (theme_story_id)
    REFERENCES theme_stories(id)
    ON DELETE CASCADE;

ALTER TABLE theme_section_pois
  DROP CONSTRAINT IF EXISTS theme_section_pois_theme_story_section_id_fkey,
  ADD CONSTRAINT theme_section_pois_theme_story_section_id_fkey
    FOREIGN KEY (theme_story_section_id)
    REFERENCES theme_story_sections(id)
    ON DELETE CASCADE;

-- Prevent deletion of POIs that are in use
ALTER TABLE theme_section_pois
  DROP CONSTRAINT IF EXISTS theme_section_pois_poi_id_fkey,
  ADD CONSTRAINT theme_section_pois_poi_id_fkey
    FOREIGN KEY (poi_id)
    REFERENCES pois(id)
    ON DELETE RESTRICT;

-- NOT NULL constraints on critical fields
ALTER TABLE theme_section_pois
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL;
```

## Testing Checklist

- [ ] Test concurrent edits (two users, same story)
- [ ] Test partial save failure (simulate DB error mid-transaction)
- [ ] Test soft-delete + restore flow
- [ ] Test reorder with 1, 2, 10+ POIs
- [ ] Test orphan prevention (try to delete referenced POI)
- [ ] Test version conflict detection
- [ ] Test input validation (oversized text, invalid IDs)
- [ ] Load test: 100 POIs, 20 sections

## Migration Path for Existing Data

```sql
-- Add new columns with defaults
ALTER TABLE theme_section_pois
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN deleted_at TIMESTAMP,
  ADD COLUMN deleted_by INTEGER REFERENCES users(id);

ALTER TABLE theme_stories
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE theme_story_sections
  ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

-- Create indexes
CREATE UNIQUE INDEX theme_section_pois_active_unique
  ON theme_section_pois (theme_story_section_id, poi_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX theme_section_pois_sort_order_unique
  ON theme_section_pois (theme_story_section_id, sort_order)
  WHERE is_active = true;

-- Renumber sort_order to eliminate gaps (if any)
WITH ranked AS (
  SELECT
    id,
    theme_story_section_id,
    ROW_NUMBER() OVER (
      PARTITION BY theme_story_section_id
      ORDER BY sort_order
    ) as new_order
  FROM theme_section_pois
  WHERE is_active = true
)
UPDATE theme_section_pois
SET sort_order = ranked.new_order
FROM ranked
WHERE theme_section_pois.id = ranked.id;
```
