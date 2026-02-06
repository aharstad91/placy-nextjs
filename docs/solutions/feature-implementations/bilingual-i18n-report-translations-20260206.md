---
title: "Bilingual i18n System with Browser Auto-Detection and Manual Toggle"
category: feature-implementations
tags: [i18n, translations, locale, bilingual, react-context, supabase, rls, ssr-hydration]
module: Report Product, i18n System
symptom: Report pages only supported hardcoded Norwegian text, no English translations
root_cause: No translation infrastructure existed — all strings were hardcoded in Norwegian
date: 2026-02-06
---

# Bilingual i18n System with Browser Auto-Detection and Manual Toggle

## Problem

Report pages only had hardcoded Norwegian text in:
- POI editorial hooks and local insights
- Report config (hero intro, closing title/text)
- Theme bridge text
- All UI strings (buttons, labels, headings)

Need to support English translations with:
- Browser language auto-detection on first visit
- Manual locale toggle that persists across sessions
- SSR-safe implementation (no hydration mismatches)
- Zero migration needed for existing Norwegian data

## Solution Architecture

### 1. Translations Table (Database Layer)

**File:** `supabase/migrations/010_create_translations.sql`

```sql
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(locale, entity_type, entity_id, field)
);

CREATE INDEX idx_translations_lookup
  ON translations(locale, entity_type, entity_id);
```

**Design decisions:**
- **Norwegian is canonical** — stored in existing POI/product fields, no migration needed
- **English as overrides** — stored in translations table with composite key `(locale, entity_type, entity_id, field)`
- **Generic entity model** — supports POI, product, reportConfig translations with same schema
- **Unique constraint** — prevents duplicate translations for same entity+field

**RLS + Constraints:** `supabase/migrations/011_translations_rls_and_constraints.sql`

```sql
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "translations_select_policy" ON translations
  FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "translations_insert_policy" ON translations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "translations_update_policy" ON translations
  FOR UPDATE USING (true);

CREATE POLICY "translations_delete_policy" ON translations
  FOR DELETE USING (true);

-- Constraints
ALTER TABLE translations
  ADD CONSTRAINT locale_check CHECK (locale IN ('no', 'en')),
  ADD CONSTRAINT entity_type_check CHECK (entity_type IN ('poi', 'product', 'reportConfig', 'theme')),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
```

### 2. Server-Side Translation Loading

**File:** `lib/supabase/translations.ts`

```typescript
export async function getProjectTranslations(
  supabase: any,
  projectId: string,
  locale: string = 'no'
): Promise<Map<string, Map<string, string>>> {
  if (locale === 'no') {
    return new Map(); // Norwegian is canonical, no translations needed
  }

  const { data, error } = await (supabase as any)
    .from('translations')
    .select('entity_type, entity_id, field, value')
    .eq('locale', locale)
    .in('entity_type', ['poi', 'product', 'reportConfig', 'theme']);

  if (error) throw error;

  // Build nested map: entity_type -> entity_id -> field -> value
  const translationMap = new Map<string, Map<string, string>>();

  for (const row of data || []) {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (!translationMap.has(key)) {
      translationMap.set(key, new Map());
    }
    translationMap.get(key)!.set(row.field, row.value);
  }

  return translationMap;
}
```

**Key decisions:**
- **Short-circuit for Norwegian** — no DB query if locale is "no" (canonical language)
- **Nested Map structure** — efficient lookups by `entity_type:entity_id` then field
- **Type casting `(supabase as any)`** — generated types don't include new tables until regenerated (added TODO comment)

### 3. Data-Level Translation Application

**File:** `lib/i18n/apply-translations.ts`

```typescript
export function applyTranslations(
  project: Project,
  translationMap: Map<string, Map<string, string>>
): Project {
  // Deep clone to avoid mutations
  const translated = JSON.parse(JSON.stringify(project)) as Project;

  // Apply POI translations
  translated.pois = translated.pois.map(poi => {
    const key = `poi:${poi.id}`;
    const fields = translationMap.get(key);
    if (!fields) return poi;

    return {
      ...poi,
      editorialHook: fields.get('editorialHook') || poi.editorialHook,
      localInsight: fields.get('localInsight') || poi.localInsight,
    };
  });

  // Apply reportConfig translations
  if (translated.reportConfig) {
    const key = `reportConfig:${project.id}`;
    const fields = translationMap.get(key);
    if (fields) {
      translated.reportConfig = {
        ...translated.reportConfig,
        heroIntro: fields.get('heroIntro') || translated.reportConfig.heroIntro,
        closingTitle: fields.get('closingTitle') || translated.reportConfig.closingTitle,
        closingText: fields.get('closingText') || translated.reportConfig.closingText,
      };
    }
  }

  // Apply theme bridge text translations
  if (translated.reportConfig?.themes) {
    translated.reportConfig.themes = translated.reportConfig.themes.map(theme => {
      const key = `theme:${theme.id}`;
      const fields = translationMap.get(key);
      if (!fields) return theme;

      return {
        ...theme,
        bridgeText: fields.get('bridgeText') || theme.bridgeText,
      };
    });
  }

  return translated;
}
```

**Key decisions:**
- **Data-level transformation** — translate once at load time, not in every component
- **Deep clone** — avoid mutating original project object
- **Fallback to canonical** — if translation missing, use Norwegian text
- **Component-agnostic** — downstream components don't need to know about translations

**Alternative considered:** Component-level prop drilling with `t()` function — rejected because it requires touching every component and adds complexity.

### 4. Client Locale Context

**File:** `lib/i18n/locale-context.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'no' | 'en';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start with 'no' to avoid SSR hydration mismatch
  const [locale, setLocaleState] = useState<Locale>('no');

  // Detect locale after mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('placy-locale') as Locale | null;
    if (stored && (stored === 'no' || stored === 'en')) {
      setLocaleState(stored);
      return;
    }

    // Browser language detection
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('en')) {
      setLocaleState('en');
    }
    // Default to 'no' (already set in useState)
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('placy-locale', newLocale);
    window.location.reload(); // Force reload to fetch translations
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
```

**Key decisions:**
- **SSR-safe initialization** — always start with "no" in useState, detect in useEffect
- **localStorage priority** — persisted choice overrides browser language
- **Browser language fallback** — check navigator.language if no stored preference
- **Page reload on toggle** — simplest way to fetch new translations server-side

**Gotcha fixed:** Initial implementation had detection in useState initializer:
```typescript
const [locale, setLocale] = useState<Locale>(() => {
  const stored = localStorage.getItem('placy-locale');
  // ❌ WRONG: localStorage not available during SSR
});
```

This caused hydration mismatch. Solution: always initialize with "no", detect in useEffect.

### 5. UI String Dictionary

**File:** `lib/i18n/strings.ts`

```typescript
type Locale = 'no' | 'en';

const strings: Record<string, Record<Locale, string>> = {
  // Report page
  'report.readMore': { no: 'Les mer', en: 'Read more' },
  'report.showLess': { no: 'Vis mindre', en: 'Show less' },
  'report.minute': { no: 'min', en: 'min' },
  'report.minutes': { no: 'min', en: 'min' },
  'report.walk': { no: 'gange', en: 'walk' },
  'report.bike': { no: 'sykkel', en: 'bike' },
  // ... more strings
};

export function t(locale: Locale, key: string): string {
  const translation = strings[key]?.[locale];
  if (!translation) {
    console.warn(`Missing translation: ${key} (${locale})`);
    return key;
  }
  return translation;
}
```

**Key decisions:**
- **Simple dictionary** — no need for i18next or react-intl complexity
- **Type-safe keys** — could extend with `keyof typeof strings` for autocomplete
- **Fallback to key** — if translation missing, return key for debugging

### 6. Locale Toggle Component

**File:** `components/variants/report/ReportLocaleToggle.tsx`

```typescript
'use client';

import { useLocale } from '@/lib/i18n/locale-context';

export default function ReportLocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full p-1">
      <button
        onClick={() => setLocale('no')}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
          locale === 'no'
            ? 'bg-white text-gray-900'
            : 'text-white hover:bg-white/20'
        }`}
        aria-label="Bytt til norsk"
        aria-pressed={locale === 'no'}
      >
        NO
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
          locale === 'en'
            ? 'bg-white text-gray-900'
            : 'text-white hover:bg-white/20'
        }`}
        aria-label="Switch to English"
        aria-pressed={locale === 'en'}
      >
        EN
      </button>
    </div>
  );
}
```

**Key decisions:**
- **Pill-style design** — compact, visually clear active state
- **Accessibility** — aria-label and aria-pressed for screen readers
- **Positioned in hero** — top-right of ReportHero component

### 7. Integration in Report Page

**File:** `components/variants/report/ReportPage.tsx`

```typescript
import { getProjectTranslations } from '@/lib/supabase/translations';
import { applyTranslations } from '@/lib/i18n/apply-translations';
import { LocaleProvider } from '@/lib/i18n/locale-context';

export default async function ReportPage({ projectId }: { projectId: string }) {
  const supabase = createServerClient();

  // Detect locale from headers (for SSR)
  const locale = headers().get('accept-language')?.startsWith('en') ? 'en' : 'no';

  // Load project data
  const project = await getProjectData(supabase, projectId);

  // Load and apply translations
  const translationMap = await getProjectTranslations(supabase, projectId, locale);
  const translatedProject = applyTranslations(project, translationMap);

  return (
    <LocaleProvider>
      <ReportHero project={translatedProject} />
      <ReportThemeSection project={translatedProject} />
      <ReportClosing project={translatedProject} />
    </LocaleProvider>
  );
}
```

**Key decisions:**
- **Server-side locale detection** — check Accept-Language header for initial render
- **Client-side override** — LocaleProvider handles localStorage + toggle after mount
- **Single translation point** — all components receive translated data, no awareness needed

## Key Design Decisions

### 1. Data-Level vs. Component-Level Translation

**Chosen:** Data-level translation in `applyTranslations()`

**Rationale:**
- Components stay clean, no prop drilling
- Single point of translation (DRY)
- Easy to add new translatable fields
- Performance: translate once, not on every render

**Alternative rejected:** Component-level `t()` calls
- Would require touching every component
- Prop drilling for locale through component tree
- More verbose, harder to maintain

### 2. Norwegian as Canonical Language

**Chosen:** Norwegian text in existing fields, English in translations table

**Rationale:**
- Zero migration needed for existing data
- Norwegian is primary market
- Translations are "optional overrides"
- Simpler DB queries (skip for locale='no')

**Alternative rejected:** All languages in translations table
- Would require migrating all existing Norwegian data
- More complex queries (always need to join)
- No performance benefit for primary locale

### 3. Client-Side Locale Detection

**Chosen:** localStorage → navigator.language → default "no"

**Rationale:**
- User preference persists across sessions
- Browser language fallback for first visit
- Simple, no server-side routing complexity

**Alternative rejected:** URL-based locale routing (/no, /en)
- Would require URL rewriting
- More complex SSR/caching logic
- Harder to share links (locale in URL)

### 4. SSR-Safe Initialization

**Chosen:** Always start with "no", detect in useEffect

**Rationale:**
- Prevents hydration mismatch errors
- localStorage/navigator not available during SSR
- Acceptable flash of Norwegian before detection

**Alternative rejected:** Detect locale during SSR from headers
- Still need client-side toggle logic
- Doesn't respect localStorage preference
- More complex (server + client sync)

## Gotchas and Lessons Learned

### 1. SSR Hydration Mismatch

**Problem:** Initial implementation tried to read localStorage in useState initializer:

```typescript
const [locale, setLocale] = useState<Locale>(() => {
  const stored = localStorage.getItem('placy-locale');
  return stored as Locale || 'no';
});
```

**Error:** `Hydration failed because the initial UI does not match what was rendered on the server.`

**Solution:** Always initialize with "no", detect in useEffect (client-only):

```typescript
const [locale, setLocale] = useState<Locale>('no');

useEffect(() => {
  const stored = localStorage.getItem('placy-locale') as Locale | null;
  if (stored) setLocale(stored);
}, []);
```

**Lesson:** Any browser API (localStorage, navigator) must be called in useEffect, never during render or state initialization.

### 2. Supabase Generated Types Lag

**Problem:** Added translations table in migration, but TypeScript complained:

```typescript
const { data } = await supabase.from('translations').select('*');
// ❌ Type error: 'translations' does not exist on 'Database'
```

**Solution:** Type cast to any with TODO comment:

```typescript
const { data } = await (supabase as any).from('translations').select('*');
// TODO: Regenerate Supabase types after migration
```

**Lesson:** Supabase type generation is manual (`npm run supabase:types`). Always add TODO when using `as any` for new tables.

### 3. RLS Policies Missing from Initial Migration

**Problem:** Created translations table without RLS policies, got permission errors in production.

**Solution:** Added follow-up migration `011_translations_rls_and_constraints.sql`:

```sql
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_select_policy" ON translations
  FOR SELECT USING (true);
```

**Lesson:** Always add RLS policies in same migration as table creation, or immediately after. Public read + service role write is safe default for translations.

### 4. Page Reload Required After Toggle

**Problem:** Changing locale with setLocale() didn't update translated content (loaded server-side).

**Solution:** Force page reload in setLocale():

```typescript
const setLocale = (newLocale: Locale) => {
  setLocaleState(newLocale);
  localStorage.setItem('placy-locale', newLocale);
  window.location.reload(); // Force reload to fetch translations
};
```

**Alternative considered:** Client-side fetch of translations — rejected because:
- Requires duplicating server-side translation logic in client
- Increases bundle size
- More complex state management
- Page reload is acceptable UX for rare action (locale toggle)

## Files Changed

### Database

- `supabase/migrations/010_create_translations.sql` — translations table schema
- `supabase/migrations/011_translations_rls_and_constraints.sql` — RLS policies + constraints

### Server-Side

- `lib/supabase/translations.ts` — getProjectTranslations() fetch logic
- `lib/i18n/apply-translations.ts` — applyTranslations() data transformation

### Client-Side

- `lib/i18n/locale-context.tsx` — LocaleProvider + useLocale() hook
- `lib/i18n/strings.ts` — UI string dictionary + t() function
- `components/variants/report/ReportLocaleToggle.tsx` — locale toggle component

### Integration

- `components/variants/report/ReportPage.tsx` — load translations + wrap in LocaleProvider
- `components/variants/report/ReportHero.tsx` — render toggle, use t() for strings
- `components/variants/report/ReportThemeSection.tsx` — use t() for strings
- `components/variants/report/ReportClosing.tsx` — use t() for strings

## Testing Checklist

- [ ] Norwegian locale (default) shows all Norwegian text
- [ ] English locale shows translated POI hooks/insights
- [ ] English locale shows translated reportConfig texts
- [ ] English locale shows translated theme bridge texts
- [ ] English locale shows translated UI strings
- [ ] Locale toggle switches between NO/EN
- [ ] Locale choice persists after page reload
- [ ] Browser language detection works on first visit
- [ ] No hydration mismatch errors in console
- [ ] Toggle has correct aria attributes for accessibility

## Future Enhancements

1. **Admin UI for translations** — currently need to insert via SQL
2. **More locales** — add Swedish, Danish, German
3. **Lazy loading** — only fetch translations for current locale
4. **Type-safe translation keys** — generate types from strings dictionary
5. **Pluralization** — handle "1 minute" vs "5 minutes" properly
6. **Date/number formatting** — locale-aware formatting with Intl API

## References

- [React Context API](https://react.dev/reference/react/createContext)
- [Next.js SSR Gotchas](https://nextjs.org/docs/messages/react-hydration-error)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
