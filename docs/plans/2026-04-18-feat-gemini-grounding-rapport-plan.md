---
title: feat: Gemini grounding i generate-rapport + Google AI sheet-drawer
type: feat
date: 2026-04-18
---

# feat: Gemini grounding i generate-rapport + Google AI sheet-drawer

## Enhancement Summary

**Plan iterert 2x:**
1. **Deepen (2026-04-18)** — 7 review-agenter: simplicity, security, typescript, architecture, patterns, framework-docs, best-practices
2. **Tech audit (2026-04-18)** — 3 agenter: performance, data-integrity, spec-flow

**Tech Audit Verdict: YELLOW** — planen er arkitektonisk solid, men krever følgende mitigations før /work:

### Deepen-funn (integrert)
1. `searchEntryPoint.renderedContent` må rendres verbatim — Google ToS-krav
2. SSRF-prevention i URL-resolver (DNS pre-resolve + private-IP-blocklist)
3. API-nøkkel i `x-goog-api-key`-header, ikke URL-querystring
4. `react-markdown` med strikt whitelist, ingen `rehype-raw`
5. Scripts i TypeScript (`.ts` via tsx) — eksisterende mønster
6. Backup-then-patch (følger `seed-wesselslokka-summary.ts`)
7. UI null-kontrakt: skjul knapp ved undefined grounding
8. PR-split i 3: foundation → migration → UI

### Tech-audit-funn (integrert)
9. **Deep-merge PATCH**: aldri flat replace av `config`. Whitelist-guard på `reportConfig`-nøkler, merge per-tema matched på `id`
10. **Parallell Gemini** (`Promise.allSettled`): 7 sekvensielle kall = 56-105s; parallellt = 8-15s
11. **Totalfeil-abort**: hvis ≥5/7 feiler → abort PATCH, behold forrige state, exit-kode 2
12. **Omit grounding på failure** (ikke sett til `null`) — matcher TS `?:` optional
13. **`searchEntryPoint` manglende** → omit grounding for kategorien (ToS krever verbatim)
14. **Locale EN**: `ReportLocaleToggle` eksisterer — grounding er kun norsk → TODO, ikke blocker
15. **Dynamic import** av `GoogleAIGroundingSheet` — fjerner ~70kb fra main bundle
16. **`groundingVersion: z.literal(1)`** + server-log ved mismatch
17. **Z-index**: Sheet konflikterer med `UnifiedMapModal` (også Sheet-basert) — koordinert state
18. **`force-dynamic`** på rapport-rute erstattes med `revalidateTag`-basert ISR
19. **DOMPurify** server-side på `searchEntryPointHtml` før lagring (Google garanterer ikke)
20. **Source pills**: `rel="noopener noreferrer nofollow"` + `referrerPolicy="no-referrer"`

## Overview

Erstatte manuelle WebFetch/WebSearch-trinn i `/generate-rapport`-skillens Steg 2.5 og 3.5 med ett Gemini API-kall per kategori (`gemini-2.5-flash` med `google_search`-tool). Resultatet — narrative + kilder + `searchEntryPoint` — lagres i `products.config.reportConfig.themes[].grounding` og brukes til to formål:

1. **Kort form** — Claude kurerer 5-6 setninger til rapport-tekst (eksisterende W/X/Y/Z/Æ-regler)
2. **Lang form** — Gemini-narrativ i ny sheet-drawer med Google ToS-compliant attribution

Erstatter dagens `readMoreQuery`-eksterne-lenke — bruker forblir i Placy.

## Problem Statement

POC-validering (2026-04-18, Stasjonskvartalet + Wesselsløkka) viser at Gemini med Google Search-grounding finner 6-17 autoritative kilder per kategori, mens dagens manuelle WebFetch-pipeline treffer 1-3. Gemini oppdager også hyperlokal kunnskap (Estenstadmarka km-fakta, Brøset-barnehage-historikk, busslinje-nummer) som Claude's WebSearch ikke finner.

Tre problemer løses samtidig:
1. **Retrieval-kvalitet** — matcher AI Mode
2. **Bruker forblir i Placy** — erstatter ekstern `google.com/search`-lenke
3. **Skalerbarhet** — ingen manuell URL-kuratering per bydel

## Proposed Solution

### Arkitektur

```
Build-time (skill-kontekst):
  node scripts/gemini-grounding.ts <project_id> [--apply]
    1. Les current config + updated_at (for optimistic lock)
    2. Backup full row → backups/products-{id}-{ts}.json
    3. For hver av 7 kategorier parallellt (Promise.allSettled):
         → Gemini API med google_search-tool (x-goog-api-key header)
         → parse groundingMetadata
         → DOMPurify søk-entry-HTML
         → URL-resolve sources parallellt med concurrency=5, SSRF-guard
    4. Totalfeil-sjekk: hvis ≥5/7 feilet → abort, exit 2
    5. Deep-merge én atomisk PATCH:
         - Whitelist-guard på reportConfig-nøkler
         - Match themes på id, preservér alle eksisterende felt
         - Sett kun grounding-nøkkel per tema (omit ved failure)
    6. Optimistic concurrency via updated_at=eq.{read_value}
    7. Post-write deep-equal mot backup (preserved keys)
    8. revalidateTag("product:{id}") via /api/revalidate

Render-time (server component):
  /eiendom/[customer]/[slug]/rapport
    → getProductFromSupabase (med unstable_cache + tag "product:{id}")
    → propager config til ReportTheme
    → per-tema Zod-parse grounding (silent skip, server-log ved invalid)
    → client-drawer lazy-loaded via dynamic import
    → ReportThemeSection.tsx: skjul knapp hvis grounding undefined
```

### Datamodell (JSONB — ingen SQL-migrasjon)

**Script-persisted shape** (lagret i Supabase):

```typescript
interface ReportThemeGrounding {
  narrative: string;                  // markdown, min 200 tegn
  sources: Array<{
    title: string;
    url: string;                      // resolved final URL (eller redirect hvis resolve feilet)
    redirectUrl: string;              // original Gemini redirect (for re-resolve)
    domain: string;
  }>;
  searchEntryPointHtml: string;       // DOMPurify'd, påkrevd (ToS)
  fetchedAt: string;                  // ISO-8601
  groundingVersion: 1;                // literal — bump for å tvinge regen
  meta: {
    model: "gemini-2.5-flash";
    searchQueries: string[];          // debug-only
  };
}

interface ReportThemeConfig {
  // eksisterende felt
  readMoreQuery?: string;             // input-query til grounding-scriptet
  grounding?: ReportThemeGrounding;   // OMIT (ikke null) ved feil
}
```

**Render-path type** (exposed til UI via Zod-parse):

```typescript
const ReportThemeGroundingViewSchema = z.object({
  narrative: z.string().min(1),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    domain: z.string(),
  })).default([]),
  searchEntryPointHtml: z.string().min(1),
  fetchedAt: z.string(),
  groundingVersion: z.literal(1),
});

type ReportThemeGroundingView = z.infer<typeof ReportThemeGroundingViewSchema>;
```

**Fail-semantikk:**
- Script-feil per kategori → utelat `grounding`-nøkkel (omit), ikke `null`
- Render-feil (Zod-parse fail) → server-log `console.error({ projectId, themeId, issue })`, skjul knapp for det temaet, kategori-seksjon vises som før

### UI-kontrakt

| grounding state | UI |
|---|---|
| undefined (omit) | Skjul "Utdyp med Google AI"-knappen; kategori-seksjon rendres ellers normalt |
| present, Zod OK | Vis knapp — åpner sheet-drawer |
| present, Zod fail | Server-log, skjul knapp |

Ingen fallback til ekstern `google.com/search`.

## Technical Approach

### Module-struktur

```
lib/gemini/
  types.ts          # Request/response shapes + Zod schemas (incl. groundingVersion literal)
  grounding.ts      # Core: callGemini(query, signal?) → Result
  url-resolver.ts   # Safe redirect resolver (GET+follow, SSRF guard, 2s timeout)
  sanitize.ts       # DOMPurify wrapper for searchEntryPointHtml
  index.ts          # Public API

scripts/
  gemini-grounding.ts   # CLI wrapper (tsx-shebang, --apply/--dry-run/--force)

components/variants/report/
  GoogleAIGroundingSheet.tsx  # Client, dynamic-imported
```

### Parallell Gemini-kall

```typescript
// I script (gemini-grounding.ts):
const themes = await fetchThemesWithQueries(projectId);

const results = await Promise.allSettled(
  themes.map(t => callGemini(t.readMoreQuery, { timeout: 30000 }))
);

const failed = results.filter(r => r.status === "rejected").length;
if (failed >= 5) {
  console.error(`${failed}/${themes.length} kategorier feilet — aborter`);
  process.exit(2);
}

// Per tema: success → grounding-object, failure → omit
const groundingByThemeId = new Map();
for (let i = 0; i < themes.length; i++) {
  const r = results[i];
  if (r.status === "fulfilled" && r.value.searchEntryPointHtml) {
    groundingByThemeId.set(themes[i].id, r.value);
  }
  // else: omit — ikke lagre null
}
```

### SSRF-sikker URL-resolver (parallell med concurrency=5)

```typescript
// Bruker GET (ikke HEAD) med follow-redirects, 2s timeout per URL
// Blokkerer:
// - 127.0.0.0/8, 10.0.0.0/8, 172.16/12, 192.168/16, 169.254/16 (RFC1918 + link-local)
// - ::1, fc00::/7, fe80::/10 (IPv6)
// - Ikke-https final destination
// - DNS-lookup før request; sjekk resolved IP, ikke hostname
// - Max 3 redirect-hops

// Per kategori: Promise.all over sources med p-limit(5) for concurrency
```

### Deep-merge PATCH (fra seed-wesselslokka-pattern)

```typescript
const ALLOWED_REPORTCONFIG_KEYS = new Set([
  "label", "heroIntro", "heroImage", "themes",
  "summary", "brokers", "cta", "mapStyle", "trails",
]);
const ALLOWED_THEME_KEYS = new Set([
  "id", "name", "icon", "categories", "color",
  "intro", "bridgeText", "upperNarrative", "lowerNarrative",
  "categoryDescriptions", "readMoreQuery", "grounding",
]);

// 1. Whitelist-guard på incoming config
const existingRc = existingConfig.reportConfig ?? {};
for (const key of Object.keys(existingRc)) {
  if (!ALLOWED_REPORTCONFIG_KEYS.has(key)) {
    throw new Error(`Ukjent reportConfig-nøkkel: ${key} — oppdater whitelist først`);
  }
}

// 2. Match themes på id, preservér alle felt, sett kun grounding
const nextThemes = existingRc.themes.map(theme => {
  const grounding = groundingByThemeId.get(theme.id);
  if (!grounding) return theme; // omit på failure
  return { ...theme, grounding };
});

// 3. Shallow-merge reportConfig (beholder summary/brokers/cta/etc)
const nextConfig = {
  ...existingConfig,
  reportConfig: { ...existingRc, themes: nextThemes },
};

// 4. PATCH med optimistic lock
const res = await fetch(
  `${URL}/rest/v1/products?id=eq.${id}&updated_at=eq.${encodeURIComponent(readUpdatedAt)}`,
  { method: "PATCH", headers: { Prefer: "return=representation", ... },
    body: JSON.stringify({ config: nextConfig }) }
);
if (res.status === 204 || (await res.json()).length === 0) {
  throw new Error("Concurrency lock failed — config endret siden script startet. Kjør scriptet på nytt.");
}

// 5. Post-write deep-equal mot backup for preservEd keys
assertPreserved(backup, result, ["summary", "brokers", "cta", "trails", "heroIntro"]);
```

### Gemini-prompt (perishable data-exclusion)

Prepend til hver query:

```
Svar om {kategori} i {bydel} Trondheim.
KRITISK: Ikke inkluder priser, åpningstider, eller spesifikke events.
Fokuser på varige fakta gyldig 2+ år.
Norsk prosa. Ikke generer URLer utenfor kildesiteringer.
Minst 5 setninger.
```

### Markdown-rendering (XSS-safe + bundle-split)

```tsx
// ReportThemeSection.tsx:
import dynamic from "next/dynamic";

const GoogleAIGroundingSheet = dynamic(
  () => import("./GoogleAIGroundingSheet"),
  { ssr: false, loading: () => null }
);

// I GoogleAIGroundingSheet.tsx:
<ReactMarkdown
  allowedElements={['p','ul','ol','li','strong','em','a','code','h3','h4']}
  unwrapDisallowed
  urlTransform={(url) => /^(https?:|mailto:|#)/i.test(url) ? url : ''}
>
  {grounding.narrative}
</ReactMarkdown>
```

### Google ToS compliance

**Må-krav:**
1. `searchEntryPointHtml` (DOMPurify-sanert, men renderes via `dangerouslySetInnerHTML`) — sanksjonert av ToS
2. Maks 5 Search Suggestions
3. Vises kun til prompt-bruker (ingen syndikering)
4. Ingen click-tracking / link-rewriting
5. Cache opp til 2 år OK (6 mnd passer)

**Attribution i drawer:**
- Header: "Google AI" + Google-G-logo
- Footer: DOMPurify-sanert `searchEntryPointHtml` via `dangerouslySetInnerHTML`
- Disclaimer: "Generert med Google AI basert på offentlige kilder. Oppdatert {fetchedAt}."

### Source pills

```tsx
<a
  href={source.url}
  target="_blank"
  rel="noopener noreferrer nofollow"
  referrerPolicy="no-referrer"
>
  {source.domain}
</a>
```

### Z-index-koordinering med UnifiedMapModal

Begge bruker `components/ui/sheet.tsx`. Verifiser:
- Når `UnifiedMapModal` åpnes, lukk `GoogleAIGroundingSheet` (eller motsatt)
- Evt bruk felles Zustand-state: `useModalState((s) => ({ openSheet, closeAll }))`
- Test-case i Phase 3 acceptance

### Revalidation-strategi

**Ny:** Fjern `export const dynamic = "force-dynamic"` fra `app/eiendom/[customer]/[project]/rapport/page.tsx:11`. Bruk `export const revalidate = 3600` + eksplisitt `revalidateTag("product:{id}")` kalt fra `gemini-grounding.ts` etter PATCH.

```typescript
// I getProductFromSupabase (lib/supabase/queries.ts):
export const getProductFromSupabase = unstable_cache(
  async (id) => { /* ... */ },
  ["product"],
  { tags: (id) => [`product:${id}`], revalidate: 3600 }
);

// I script etter PATCH:
await fetch(`${SITE_URL}/api/revalidate?tag=product:${id}&secret=${REVALIDATE_SECRET}`);
```

### Skill-endringer

**`.claude/skills/generate-rapport/SKILL.md`:**
- Steg 2.5: `!node scripts/gemini-grounding.ts <project> --apply` (erstatter manuell WebFetch-løype)
- Steg 3.5: fjern
- Steg 6: les `grounding.narrative` som kontekst-input til Claude
- Steg 9: scriptet har allerede PATCHet + revalidated

**`.claude/skills/generate-rapport/references/sj-prinsipper.md`:**
- Reorganiser tematisk (rydder A-Æ-rot siden vi uansett reviderer V): `## Substans`, `## Tone`, `## Query-disciplin`, `## Perishable data`

**CLAUDE.md:**
- Ny underseksjon `### LLM-integrasjon` under `## Arkitekturregler`
- Regel: build-time Gemini OK (skill), aldri runtime
- Regel: Cache styres via `groundingVersion` + `revalidateTag`, ikke auto-TTL

## Implementation Phases

### Phase 1: Foundation (PR #1)

**Leveranser:**
- `lib/gemini/types.ts` — Zod schemas inkl. `groundingVersion: z.literal(1)`
- `lib/gemini/url-resolver.ts` — SSRF-safe resolver (DNS pre-resolve, private-IP-blocklist, GET+follow)
- `lib/gemini/sanitize.ts` — DOMPurify wrapper
- `lib/gemini/grounding.ts` — core `callGemini(query, options)` med `x-goog-api-key`-header
- `scripts/gemini-grounding.ts` — CLI wrapper (tsx-shebang, `--apply`/`--dry-run`/`--force`)
  - Parallell Gemini-kall (`Promise.allSettled`)
  - Parallell URL-resolve (concurrency=5)
  - Totalfeil-abort (≥5/7)
  - Backup full row → `backups/`
  - Whitelist-guard + deep-merge
  - Optimistic concurrency lock
  - Post-write deep-equal
  - `revalidateTag` via `/api/revalidate`
- Utvid `lib/types.ts` — `ReportThemeGrounding` + `ReportThemeGroundingViewSchema`
- Utvid `ReportThemeConfig.grounding?`
- Oppdater `report-themes.ts:16` + `report-data.ts:58-86 + :523` — propagering med Zod-parse
- Installer `react-markdown`, `rehype-sanitize`, `isomorphic-dompurify`, `p-limit`, `ipaddr.js`

**Suksess-kriterier:**
- `node scripts/gemini-grounding.ts <project> --dry-run` skriver fact-sheet til stdout, ingen Supabase-write
- `--apply` kjører parallellt, <20s wall-time
- SSRF-tester: avviser `127.0.0.1`, `169.254.169.254`, `192.168.1.1`, `::1`
- Totalfeil-test: 5/7 feil → exit 2, ingen PATCH
- Optimistic-lock-test: modified `updated_at` → explicit retry-melding
- `npx tsc --noEmit` + `npm run lint` passerer

**Effort:** 4-5 timer

### Phase 2: Skill + data migrering (PR #2)

**Leveranser:**
- `SKILL.md` Steg 2.5 + 3.5 + 6 oppdatert
- `references/sj-prinsipper.md` reorganisert tematisk
- `references/qa-checklist.md` — grounding-spesifikke sjekker (perishable data, min 5 kilder, Google-branding)
- `references/anti-patterns.md` — Hverdagsliv-scope-feil
- Kjør `scripts/gemini-grounding.ts banenor-eiendom_stasjonskvartalet --apply`
- Kjør for Wesselsløkka
- Verifiser grounding-data i Supabase (alle 7 kategorier, searchEntryPointHtml ikke tom, deep-equal preservert)
- `revalidateTag` kjørt per prosjekt

**Suksess-kriterier:**
- Begge prosjekter har 7/7 grounding populert
- `summary`/`brokers`/`cta`/`trails`/`heroIntro` ikke endret (deep-equal test)
- Skill kjøres end-to-end på 3. prosjekt (Tyholt/Lade) uten manuell WebFetch

**Effort:** 2-3 timer

### Phase 3: UI + ToS compliance (PR #3)

**Leveranser:**
- `components/variants/report/GoogleAIGroundingSheet.tsx`:
  - `Sheet` fra `@/components/ui/sheet`, `side="right"` desktop (~480px), `side="bottom"` mobil
  - Header: Google-G-logo + "Google AI"
  - Body: `ReactMarkdown` med whitelist-config
  - Kilder: numbered footnote-pills med `rel="noopener noreferrer nofollow"` + `referrerPolicy="no-referrer"`
  - Footer: `searchEntryPointHtml` (DOMPurify-sanert) via `dangerouslySetInnerHTML` + disclaimer + timestamp
  - Skjul "Kilder"-overskrift hvis `sources.length === 0`
- `ReportThemeSection.tsx:335-347`:
  - `dynamic`-import GoogleAIGroundingSheet
  - Erstatt ekstern-lenke med button
  - UI null-kontrakt: `{theme.grounding && <Button ...>}`
  - Behold Sparkles + indigo
- Z-index-koordinering med `UnifiedMapModal` (felles Zustand eller onOpen-lukk-annen)
- Fjern `force-dynamic` fra rapport-ruten, legg `revalidate = 3600`
- `unstable_cache` rundt `getProductFromSupabase` med tag `product:{id}`

**Suksess-kriterier:**
- Sheet åpnes ved click, lukkes ved X/ESC/backdrop
- XSS-test: `<script>alert('x')</script>` i narrative rendres som text
- `searchEntryPointHtml` synlig i footer
- Disclaimer + timestamp synlig
- Mobil: `side="bottom"` med max-height 85vh; desktop: `side="right"` ~480px
- Lighthouse: a11y ≥ 95, ingen fokus/aria-feil
- Bundle: dynamic chunk laster kun ved sheet-åpning (verifiser i Network)
- Z-index: åpne kart mens sheet er åpen → én vinner, ingen overlap-rot

**Effort:** 4-5 timer

### Phase 4: Validation + dokumentasjon

**Leveranser:**
- Test på 3. nabolag (Tyholt/Lade) — empirisk validering
- CLAUDE.md `### LLM-integrasjon`-seksjon
- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — mønster + refaktor-triggere
- `PROJECT-LOG.md` + `WORKLOG.md`-entry
- TODO-note i komponent: EN-locale støtte (grounding regeneres 2× ved locale-expansion)

**Effort:** 1-2 timer

## Acceptance Criteria

### Functional

- [ ] `scripts/gemini-grounding.ts <project_id> --dry-run` kjører uten å skrive til Supabase
- [ ] `--apply` kjører parallell Gemini (`Promise.allSettled`), <20s wall-time
- [ ] Backup skrives til `backups/products-{id}-{ts}.json` før PATCH (full row)
- [ ] Optimistic concurrency: modified `updated_at` → explicit melding, ingen PATCH
- [ ] Totalfeil-abort: ≥5/7 fail → exit 2, ingen write
- [ ] Graceful per-kategori failure: omit `grounding`-nøkkel (ikke `null`)
- [ ] Deep-merge: ingen sibling-keys klobberes (summary/brokers/cta/trails preservert)
- [ ] Whitelist-guard på `reportConfig`-nøkler med fail-fast ved ukjent
- [ ] Themes matches på `id`, ikke index
- [ ] Post-write deep-equal validerer preserved keys
- [ ] `revalidateTag("product:{id}")` kalt etter PATCH
- [ ] `GEMINI_API_KEY` mangler → fail fast med klar melding
- [ ] API-nøkkel i `x-goog-api-key`-header, aldri URL
- [ ] URL-resolver avviser private IPer + ::1 + fe80::/10 (SSRF-test)
- [ ] Skill Steg 2.5 kaller scriptet; Steg 3.5 fjernet
- [ ] Claude's kort-form-tekst bruker `grounding.narrative` som kontekst
- [ ] `GoogleAIGroundingSheet` åpnes ved click
- [ ] Sheet viser narrative (markdown whitelist), source pills, `searchEntryPointHtml`
- [ ] UI null-kontrakt: knapp skjult hvis `grounding` undefined
- [ ] Sheet dynamic-imported (0kb på initial render)
- [ ] Stasjonskvartalet + Wesselsløkka + Tyholt har grounding

### Non-Functional

- [ ] Ingen runtime Gemini-kall (build-time only)
- [ ] Markdown-render: `<script>` i narrative rendres som text
- [ ] SSRF-test: `http://169.254.169.254/latest/meta-data/` avvises
- [ ] Google ToS compliance: `searchEntryPointHtml` synlig i drawer
- [ ] DOMPurify sanerer `searchEntryPointHtml` før lagring
- [ ] Disclaimer: "Generert med Google AI... Oppdatert {dato}" synlig
- [ ] Build-tid per rapport: <25s (parallell)
- [ ] Bundle: `GoogleAIGroundingSheet` + `react-markdown` ikke i main chunk
- [ ] Rapport-rute bruker `revalidate = 3600` + `revalidateTag`, ikke `force-dynamic`
- [ ] `getProductFromSupabase` wrapped i `unstable_cache` med tag
- [ ] Responsivt: mobil `side="bottom"`, desktop `side="right"` ~480px
- [ ] Z-index: sheet + UnifiedMapModal koordinert (én åpen om gangen)
- [ ] Source pills: `rel="noopener noreferrer nofollow"` + `referrerPolicy="no-referrer"`
- [ ] `npm run lint` + `npx tsc --noEmit` + `npm run build` passerer

### Quality Gates

- [ ] Manuell kvalitet-score ≥ 7/10 på alle 21 kategorier (3 nabolag × 7)
- [ ] Perishable data (priser/tider/events) ikke i narrative
- [ ] PR #1 merged + validert før PR #2 starter
- [ ] PR #2 merged + validert før PR #3 starter

## Risks

**1. Perishable data i narrative** (medium sannsynlighet, medium impact)
- **Mitigation:** Eksplisitt exclusion i prompt. QA-regex-detektor for NOK/kr/åpent/stengt/kl. Manuell review i Phase 4.

**2. Hallusinasjoner tross grounding** (lav-medium sannsynlighet, høy impact)
- **Mitigation:** Kort form filtreres av Claude (W/X/Y/Z/Æ). Lang form branded "Google AI" — Placy eier ikke påstanden. Source-pills verifiserer. Disclaimer + timestamp.

**3. Locale EN mismatch** (medium sannsynlighet, lav impact)
- `ReportLocaleToggle` finnes, `grounding.narrative` er kun norsk
- **Mitigation:** TODO-note i komponent. Phase 4 Future Work: `grounding.{no, en}` struktur, 14 Gemini-kall. Ikke blocker for MVP.

## Dependencies

- POC validert (DONE — 2026-04-18)
- Brainstorm godkjent (DONE — `docs/brainstorms/2026-04-18-gemini-grounding-rapport-brainstorm.md`)
- `GEMINI_API_KEY` i `.env.local` (DONE)
- `components/ui/sheet.tsx` eksisterer (DONE)
- `scripts/seed-wesselslokka-summary.ts` er golden pattern (DONE)
- Ingen SQL-migrasjon (JSONB)
- Nye npm-deps: `react-markdown`, `rehype-sanitize`, `isomorphic-dompurify`, `p-limit`, `ipaddr.js`

**Rekkefølge:** Phase 1 → Phase 2 → Phase 3 → Phase 4 (sekvensielt, separate PR-er)

## References

### Internal

- **Brainstorm:** `docs/brainstorms/2026-04-18-gemini-grounding-rapport-brainstorm.md`
- **POC:** `scripts/poc-gemini-grounding.mjs` → formaliseres til `scripts/gemini-grounding.ts`
- **POC-output:** `/tmp/gemini-poc-*.md`
- **Skill:** `.claude/skills/generate-rapport/SKILL.md` (Steg 2.5:170-216, Steg 3.5:226-252)
- **UI:** `components/variants/report/ReportThemeSection.tsx:335-347`
- **Locale-toggle:** `components/variants/report/ReportLocaleToggle.tsx`
- **Types:** `lib/types.ts:172-185`
- **Sheet-primitiv:** `components/ui/sheet.tsx`
- **Map modal (z-index-konflikt):** `components/map/UnifiedMapModal.tsx`
- **PATCH-mønster (golden):** `scripts/seed-wesselslokka-summary.ts`
- **Query-pattern:** `lib/supabase/queries.ts:973-976`
- **Rapport-rute (revalidation):** `app/eiendom/[customer]/[project]/rapport/page.tsx:11`

### Institutional Learnings

- `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md`
- `docs/solutions/api-integration/google-places-junk-results-filtering-20260208.md`
- `docs/solutions/feature-implementations/auto-generer-pipeline-20260407.md`

### External

- [Gemini API — Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)
- [OWASP — SSRF Prevention Node.js](https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs)
- [HackerOne — Secure Markdown Rendering React](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)
- [Next.js — revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
