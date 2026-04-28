---
module: Report
date: 2026-04-28
problem_type: ui_bug
component: report_grounding_render
symptoms:
  - "Les mer om {tema}-knappen åpner tom seksjon for 6/7 temaer"
  - "Curated narrative er populert i DB (gv=2, 1200-1500 tegn) men vises ikke"
  - "Console viser silent grounding-skip uten at brukeren merker det"
  - "Schema-validering på poiLinksUsed feiler stille"
root_cause: incorrect_validation
resolution_type: code_fix
severity: high
tags: [zod, schema-validation, poi-id, grounding, curated-narrative, regex]
---

# POI-IDer er heterogene strenger — ikke UUIDs

## Problem
Rapport-siden hadde to lag med UUID-only-validering på POI-IDer:

1. `lib/types.ts` — `ReportThemeGroundingV2Schema.poiLinksUsed: z.array(z.string().uuid())`
2. `components/variants/report/ReportCuratedGrounded.tsx` — `POI_HREF_RE: /^poi:[0-9a-f]{8}-[0-9a-f]{4}-...uuid.../i`

Schema-laget feilet stille via `parseGroundingOrLog` for 6/7 temaer hvor `poiLinksUsed` inneholdt `google-ChIJ…`, `bus-dronningens-gate`, `park-adressaparken`, `entur-NSR-StopPlace-271` osv. Konsekvens: `theme.grounding === undefined` → "Les mer"-disclosure-blokken rendret ingenting → brukeren så bare den korte bridgeText/leadText (~450 tegn) selv om curated narrative (1200-1500 tegn) lå klar i DB.

Bug-en var helt usynlig fra console-logging (kun en `console.error` server-side), og feilen så ut som et generering-problem (kort tekst).

## Environment
- Module: Report (rapport-produkt)
- Framework: Next.js 14, React 18, Zod
- Affected files:
  - `lib/types.ts` (Zod schema for grounding v2)
  - `components/variants/report/ReportCuratedGrounded.tsx` (markdown render)
  - `lib/gemini/types.test.ts` (test som låste den feile invariansen)
- Date: 2026-04-28

## Root cause

POI-tabellen i Placy bruker heterogene string-IDer:

| Format | Eksempel | Kilde |
|--------|----------|-------|
| Google Places | `google-ChIJm6lLfZ8xbUYRFYo0NaeG5sk` | `/api/places`-import |
| Slug | `park-adressaparken`, `cafe-lokka` | redaksjonelle POIs |
| Bysykkel | `bysykkel-45` | GBFS-import |
| Bus stop | `bus-dronningens-gate`, `bratt-ra-bussholdeplass` | Entur-import |
| Entur NSR | `entur-NSR-StopPlace-271` | Entur-import |
| UUID | `894e5837-4f7f-40e7-bd44-34815c58410f` | admin-opprettede |

Validering med `z.string().uuid()` matcher kun det siste formatet. 6/7 grounding-objekter feilet schema-validering selv om de var korrekt populert.

Sikkerhets-misforståelsen: regexen ble lagt på som "cross-tenant-beskyttelse", men den faktiske beskyttelsen ligger i whitelist-oppslag mot prosjektets POI-set ved render (`poisById.get(uuid)` returnerer kun POIs i loaded scope). ID-formatet i seg selv beskytter ikke mot noe — bare mot åpenbare XSS-injection-forsøk (`javascript:`, `<script>`).

## Solution

### 1. Slappere Zod-validering (kun ikke-tom streng)
```typescript
// lib/types.ts
poiLinksUsed: z.array(z.string().min(1)).default([]),
```

### 2. Slappere href-regex (alfanumerisk + dash + underscore)
```typescript
// components/variants/report/ReportCuratedGrounded.tsx
const POI_HREF_RE = /^poi:[a-z0-9_-]+$/i;
```

Begge fikser eksponerer fortsatt:
- `urlTransform` blokkerer ikke-`poi:`-protokoller
- `rehype-sanitize` med whitelist på protokoller
- `poisById.get(uuid)` cross-tenant-beskyttelse — POIs utenfor prosjekt-scope rendres som plain text

### 3. Test-oppdatering
Test "rejects v2 with invalid POI UUID" var feilaktig — den låste en feil invarians. Erstattet med to tester:
- "accepts non-UUID POI ids" — bekrefter at slug/google-prefix/UUID alle aksepteres
- "rejects empty strings" — bekrefter at min(1) håndhever ikke-tom

## Detection
**Dette tok lang tid å oppdage** fordi:
- `parseGroundingOrLog` har silent skip — kun server-side `console.error` som ikke logges noe sted brukeren ser
- "Les mer"-knappen rendret fortsatt (gated på `bridgeText/leadText`-eksistens, ikke grounding)
- Disclosure-blokken åpnet seg, bare uten innhold — så det så ut som "ingen tekst skrevet" snarere enn "data finnes men rendres ikke"

**Sjekk i fremtiden:** Når en silent skip-pattern brukes ved render-boundary, log nok kontekst til at det kan diagnostiseres uten DB-dump. Vurder å rendre fallback-tekst eller en debug-toast i dev mode hvis schema-parsing feiler.

## Lessons learned

1. **POI-IDer er strenger, ikke UUIDs.** Ikke valider format — valider eksistens i den loaded POI-set-en. Regex bør bare hindre åpenbar injection (alfanumerisk + dash + underscore er nok).

2. **Cross-tenant-beskyttelse ligger i whitelist-oppslag, ikke ID-format.** ID-format i seg selv beskytter ikke mot noe relevant trussel-modell. `poisById.get(id)` på loaded set er den faktiske grensen.

3. **Silent schema-skip er en latent feil.** `safeParse` med fallback `undefined` er ergonomisk, men gjør bug-en usynlig. Vurder å produsere et synlig dev-mode-signal (toast, debug-banner) når validering feiler ved render-boundary.

4. **Tester kan låse feil invariens.** "rejects invalid POI UUID" så ut som en sunn negativ-test, men den dokumenterte og håndhevet en feil antakelse om datamodellen. Periodisk: gå gjennom negativ-tester og spør "hva forsvarer denne, og er den antakelsen fortsatt sann?"

## Related
- `lib/curation/poi-linker.ts` filtrerer fortsatt på `POI_UUID_RE` ved curation-tid (linje 64) — det betyr at non-UUID POIs ikke får inline-lenker når Claude curater. Dette er separat fra render-bugen, men er relevant for å forklare hvorfor `poiLinksUsed` har færre entries enn antall poi-lenker i `curatedNarrative` for noen temaer. Vurder å slappe den også i en senere ryddejobb.
- `scripts/curate-narrative.ts` — entry-point for curation. Bruker `poi-linker.ts` indirekte via `linkResult.poiLinksUsed`.
