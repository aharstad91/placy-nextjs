/**
 * Merge Data Module
 * Merger ny generert data med eksisterende JSON, bevarer manuelt redigert innhold
 */

import { Project, POI, Story, ThemeStory, Category } from "../types";

// === Types ===

export interface MergeResult {
  project: Project;
  stats: {
    totalPOIs: number;
    newPOIs: number;
    updatedPOIs: number;
    preservedPOIs: number;
    removedPOIs: number;
  };
}

// === Fields that should be preserved from existing data ===

const PRESERVED_POI_FIELDS: (keyof POI)[] = [
  "editorialHook",
  "localInsight",
  "storyPriority",
  "editorialSources",
  "featuredImage",
  "description",
];

const PRESERVED_STORY_FIELDS: (keyof Story)[] = [
  "title",
  "introText",
  "heroImages",
];

const PRESERVED_THEME_FIELDS: (keyof ThemeStory)[] = [
  "title",
  "bridgeText",
  "illustration",
];

// === Main Merge Function ===

export function mergeProjectData(
  existingProject: Project | null,
  newProject: Project
): MergeResult {
  console.log("\n🔄 Merging data...");

  if (!existingProject) {
    console.log("   → No existing data, using generated data as-is");
    return {
      project: newProject,
      stats: {
        totalPOIs: newProject.pois.length,
        newPOIs: newProject.pois.length,
        updatedPOIs: 0,
        preservedPOIs: 0,
        removedPOIs: 0,
      },
    };
  }

  // Merge POIs
  const { mergedPOIs, stats: poiStats } = mergePOIs(
    existingProject.pois,
    newProject.pois
  );

  // Merge categories (union of both)
  const mergedCategories = mergeCategories(
    existingProject.categories,
    newProject.categories
  );

  // Merge story
  const mergedStory = mergeStory(existingProject.story, newProject.story);

  const mergedProject: Project = {
    ...newProject,
    pois: mergedPOIs,
    categories: mergedCategories,
    story: mergedStory,
  };

  console.log(`   → POIs: ${poiStats.newPOIs} nye, ${poiStats.updatedPOIs} oppdatert, ${poiStats.preservedPOIs} bevart`);
  console.log(`   → Totalt: ${mergedPOIs.length} POI-er`);

  return {
    project: mergedProject,
    stats: {
      totalPOIs: mergedPOIs.length,
      ...poiStats,
    },
  };
}

// === POI Merging ===

function mergePOIs(
  existing: POI[],
  newPOIs: POI[]
): {
  mergedPOIs: POI[];
  stats: { newPOIs: number; updatedPOIs: number; preservedPOIs: number; removedPOIs: number };
} {
  const existingMap = new Map(existing.map((p) => [p.id, p]));
  const newMap = new Map(newPOIs.map((p) => [p.id, p]));
  const merged: POI[] = [];

  let newCount = 0;
  let updatedCount = 0;
  let preservedCount = 0;

  // Process new POIs, merging with existing where available
  for (const newPOI of newPOIs) {
    const existingPOI = existingMap.get(newPOI.id);

    if (existingPOI) {
      // Merge: use new data but preserve manual edits
      const mergedPOI = mergeSinglePOI(existingPOI, newPOI);
      merged.push(mergedPOI);

      // Check if anything was preserved
      const hasPreservedData = PRESERVED_POI_FIELDS.some(
        (field) => existingPOI[field] !== undefined && existingPOI[field] !== null
      );
      if (hasPreservedData) {
        preservedCount++;
      }
      updatedCount++;
    } else {
      // New POI
      merged.push(newPOI);
      newCount++;
    }
  }

  // Keep POIs that exist in old data but not in new (manual additions)
  for (const existingPOI of existing) {
    if (!newMap.has(existingPOI.id)) {
      // Check if it looks manually added (has editorial content)
      const isManuallyAdded =
        existingPOI.editorialHook ||
        existingPOI.localInsight ||
        existingPOI.description;

      if (isManuallyAdded) {
        merged.push(existingPOI);
        preservedCount++;
      }
      // Otherwise, it's removed (no longer in discovery radius or filters)
    }
  }

  // Calculate removed count
  const removedCount = existing.filter(
    (p) =>
      !newMap.has(p.id) &&
      !p.editorialHook &&
      !p.localInsight &&
      !p.description
  ).length;

  return {
    mergedPOIs: merged,
    stats: {
      newPOIs: newCount,
      updatedPOIs: updatedCount,
      preservedPOIs: preservedCount,
      removedPOIs: removedCount,
    },
  };
}

function mergeSinglePOI(existing: POI, newPOI: POI): POI {
  const merged: POI = { ...newPOI };

  // Preserve manual edits
  for (const field of PRESERVED_POI_FIELDS) {
    if (existing[field] !== undefined && existing[field] !== null) {
      // @ts-expect-error - dynamic field assignment
      merged[field] = existing[field];
    }
  }

  return merged;
}

// === Category Merging ===

function mergeCategories(
  existing: Category[],
  newCategories: Category[]
): Category[] {
  const categoryMap = new Map<string, Category>();

  // Add existing first
  for (const cat of existing) {
    categoryMap.set(cat.id, cat);
  }

  // Add/update with new
  for (const cat of newCategories) {
    // Only add if not already present (preserve existing customizations)
    if (!categoryMap.has(cat.id)) {
      categoryMap.set(cat.id, cat);
    }
  }

  return Array.from(categoryMap.values());
}

// === Story Merging ===

function mergeStory(existing: Story, newStory: Story): Story {
  const merged: Story = { ...newStory };

  // Preserve story-level fields
  for (const field of PRESERVED_STORY_FIELDS) {
    if (existing[field] !== undefined && existing[field] !== null) {
      // @ts-expect-error - dynamic field assignment
      merged[field] = existing[field];
    }
  }

  // Merge theme stories
  merged.themeStories = mergeThemeStories(
    existing.themeStories,
    newStory.themeStories
  );

  // Merge sections - preserve order and content from existing, add new
  merged.sections = mergeSections(existing.sections, newStory.sections);

  return merged;
}

function mergeThemeStories(
  existing: ThemeStory[],
  newThemes: ThemeStory[]
): ThemeStory[] {
  const existingMap = new Map(existing.map((t) => [t.id, t]));
  const merged: ThemeStory[] = [];

  for (const newTheme of newThemes) {
    const existingTheme = existingMap.get(newTheme.id);

    if (existingTheme) {
      const mergedTheme: ThemeStory = { ...newTheme };

      // Preserve manual edits
      for (const field of PRESERVED_THEME_FIELDS) {
        if (
          existingTheme[field] !== undefined &&
          existingTheme[field] !== null
        ) {
          // @ts-expect-error - dynamic field assignment
          mergedTheme[field] = existingTheme[field];
        }
      }

      // Merge sections within theme
      mergedTheme.sections = mergeThemeSections(
        existingTheme.sections,
        newTheme.sections
      );

      merged.push(mergedTheme);
    } else {
      merged.push(newTheme);
    }
  }

  // Keep existing themes that are not in new (manually added)
  for (const existingTheme of existing) {
    if (!newThemes.some((t) => t.id === existingTheme.id)) {
      merged.push(existingTheme);
    }
  }

  return merged;
}

function mergeThemeSections(
  existing: ThemeStory["sections"],
  newSections: ThemeStory["sections"]
): ThemeStory["sections"] {
  const existingMap = new Map(existing.map((s) => [s.id, s]));
  const merged: ThemeStory["sections"] = [];

  for (const newSection of newSections) {
    const existingSection = existingMap.get(newSection.id);

    if (existingSection) {
      merged.push({
        ...newSection,
        // Preserve description and images if manually edited
        description: existingSection.description || newSection.description,
        images: existingSection.images?.length
          ? existingSection.images
          : newSection.images,
        // Merge POI lists - keep new order but preserve manually added POIs
        pois: mergePOILists(existingSection.pois, newSection.pois),
      });
    } else {
      merged.push(newSection);
    }
  }

  // Keep manually added sections
  for (const existingSection of existing) {
    if (!newSections.some((s) => s.id === existingSection.id)) {
      merged.push(existingSection);
    }
  }

  return merged;
}

function mergeSections(
  existing: Story["sections"],
  newSections: Story["sections"]
): Story["sections"] {
  const existingMap = new Map(existing.map((s) => [s.id, s]));
  const merged: Story["sections"] = [];

  for (const newSection of newSections) {
    const existingSection = existingMap.get(newSection.id);

    if (existingSection) {
      merged.push({
        ...newSection,
        // Preserve manual edits
        title: existingSection.title || newSection.title,
        bridgeText: existingSection.bridgeText || newSection.bridgeText,
        categoryLabel: existingSection.categoryLabel || newSection.categoryLabel,
        images: existingSection.images?.length
          ? existingSection.images
          : newSection.images,
        pois: newSection.pois
          ? mergePOILists(existingSection.pois || [], newSection.pois)
          : existingSection.pois,
      });
    } else {
      merged.push(newSection);
    }
  }

  // Keep manually added sections
  for (const existingSection of existing) {
    if (!newSections.some((s) => s.id === existingSection.id)) {
      merged.push(existingSection);
    }
  }

  return merged;
}

function mergePOILists(existing: string[], newPOIs: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  // Add new POIs first (they represent current discovery)
  for (const poi of newPOIs) {
    if (!seen.has(poi)) {
      merged.push(poi);
      seen.add(poi);
    }
  }

  // Add existing POIs that are not in new list (manually added)
  for (const poi of existing) {
    if (!seen.has(poi)) {
      merged.push(poi);
      seen.add(poi);
    }
  }

  return merged;
}

// === Utility: Deep Compare ===

export function hasDataChanged(
  existing: Project | null,
  newProject: Project
): boolean {
  if (!existing) return true;

  // Simple check: compare POI counts and IDs
  if (existing.pois.length !== newProject.pois.length) return true;

  const existingIds = new Set(existing.pois.map((p) => p.id));
  const newIds = new Set(newProject.pois.map((p) => p.id));

  for (const id of Array.from(newIds)) {
    if (!existingIds.has(id)) return true;
  }

  return false;
}
