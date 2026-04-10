---
title: "feat: Transport & Mobilitet — split narrativ i upper/lowerNarrative"
type: feat
date: 2026-04-10
brainstorm: docs/brainstorms/2026-04-10-transport-narrative-split-brainstorm.md
---

# feat: Transport & Mobilitet — split narrativ i upper/lowerNarrative

## Overview

Transport & Mobilitet-seksjonen har fått mye nytt visuelt innhold (live kollektivkort, 4 mobilitetskort, kart). Vi deler den eksisterende enkelt-narrativen i to posisjonelle felt:

- **`upperNarrative`** — rett under bridge text, over kortene. Fokus: buss, bysykkel, sparkesykkel ("her og nå").
- **`lowerNarrative`** — under kortene og "Sjekk din reisetid"-knappen. Fokus: bil, bildeling, elbillading, tog, flybuss ("derfra kan du…").

Bridge text beholdes, men strammes til å være en generisk kategori-intro uten sub-kategori-spesifisitet.

**Ny render-rekkefølge:**
```
[Tittel]
[bridge text — italic, generisk kategori-intro]
[upperNarrative — buss/bysykkel/sparkesykkel, inline POI-lenker]
[ReportHeroInsight — live kort]
[AddressInput]
[lowerNarrative — bil/bildeling/elbil/tog/flybuss, inline POI-lenker]
[Kart preview + modal]
```

## Problem Statement

- Teksten er for kort i forhold til mengden innhold kategorien nå viser
- Bridge text er i dag for spesifikk (rutenummer, stoppenavn) — bør være en overordnet intro
- Én lang narrativ-blokk under kortene kobler seg ikke godt til det visuelt rike innholdet over
- Mønsteret bør kunne gjenbrukes av andre kategorier (Mat & Drikke, Natur, etc.)

## Proposed Solution

To nye opt-in felt på `ReportTheme`. Transport-temaet bruker begge. Andre temaer kan adoptere over tid. Feltene er posisjonelt navngitt (`upper`/`lower`) slik at de ikke henger igjen i transport-domenet.

Tekstgenerering er Curator-basert (ingen runtime LLM-kall), lagret som JSON i `products.config` via SQL-migrasjon.

## Technical Considerations

- **Ingen DB-tabellmigrasjon** — all theme-tekst bor i `products.config JSONB`. Nye felt legges til via `jsonb_set` i en ny SQL-migrasjon.
- **Bakoverkompatibilitet**: `lowerNarrative` mangler → fall back til `extendedBridgeText`. `upperNarrative` mangler → vises ikke (ingen tom blokk).
- **Inline POI-linking**: `linkPOIsInText(text, pois)` i `lib/utils/story-text-linker.ts` fungerer uendret for begge felt.
- **Transport-gate**: `isTransport`-flagget (ReportThemeSection.tsx:59) brukes til å eventuelt gate upper-blokken, men fordi `upperNarrative` er opt-in, trengs ingen ekstra gate — manglende felt = ingen render.

## Acceptance Criteria

- [ ] `upperNarrative` rendres mellom italic bridge text og `<ReportHeroInsight>` (live kortene)
- [ ] `lowerNarrative` rendres etter "Sjekk din reisetid"-knappen, før kart-preview
- [ ] Inline POI-lenker fungerer i begge felt (klikk → `<ReportMapDrawer>`)
- [ ] Tema uten `upperNarrative` → ingen tom blokk rendres
- [ ] Tema uten `lowerNarrative` → faller tilbake til `extendedBridgeText`
- [ ] Wesselsløkka transport-tema viser oppdatert bridge text (generisk intro) + begge narrativ-felt
- [ ] Alle andre temaer (Mat & Drikke, Natur, etc.) er upåvirket
- [ ] `npx tsc --noEmit` — 0 feil
- [ ] `npm run lint` — 0 nye feil

## Implementation Phases

### Phase 1 — TypeScript type system (3 filer)

**`lib/types.ts`** — legg til i `ReportThemeConfig` (rundt linje 147):
```ts
upperNarrative?: string;
lowerNarrative?: string;
```

**`components/variants/report/report-data.ts`**
- Legg til i `ReportTheme`-interface (rundt linje 58–77):
```ts
upperNarrative?: string;
lowerNarrative?: string;
```
- I `transformToReportData` (rundt linje 432) — tilordne fra JSON blob:
```ts
upperNarrative: (themeConfig as Record<string, unknown>).upperNarrative as string | undefined,
lowerNarrative: (themeConfig as Record<string, unknown>).lowerNarrative as string | undefined,
```

**`components/variants/report/report-themes.ts`** — legg til i `ReportThemeDefinition`-interface:
```ts
upperNarrative?: string;
lowerNarrative?: string;
```

### Phase 2 — Rendering (1 fil)

**`components/variants/report/ReportThemeSection.tsx`**

1. **Segment-parsing**: legg til `upperSegments` ved siden av `segments`:
```ts
const upperSegments = useMemo(() => {
  if (!theme.upperNarrative) return [];
  return linkPOIsInText(theme.upperNarrative, theme.allPOIs);
}, [theme.upperNarrative, theme.allPOIs]);
```

2. **Ny upper-blokk** — sett inn etter bridge text (linje ~219), før `<ReportHeroInsight>`:
```tsx
{upperSegments.length > 0 && (
  <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] mb-6">
    {upperSegments.map((seg, i) =>
      seg.type === "poi" && seg.poi ? (
        <POIInlineLink key={i} poi={seg.poi} content={seg.content} />
      ) : (
        <span key={i}>{seg.content}</span>
      ),
    )}
  </div>
)}
```

3. **Lower-blokk** — erstatt eksisterende `extendedBridgeText`-blokk (linje ~237–258) med:
```tsx
{/* Lower narrative — broader context (bil, tog, elbil, flybuss) */}
{segments.length > 0 && (
  <div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
    {segments.map((seg, i) => ...)}
  </div>
)}
{segments.length === 0 && theme.intro && (
  <p className="text-base md:text-lg text-[#4a4a4a] leading-[1.8]">
    {theme.intro}
  </p>
)}
```

> Merk: `segments` bygges allerede fra `theme.lowerNarrative ?? theme.extendedBridgeText ?? ""` — bare endre kilden i den eksisterende `useMemo`.

### Phase 3 — Migrasjon + innhold (Wesselsløkka)

**Ny migrasjon: `supabase/migrations/051_transport_narrative_split.sql`**

Oppdaterer transport-tema i Wesselslokka-prosjektet med tre endringer:
1. **`bridgeText`** → oppdateres til generisk kategori-intro (uten linje-/stoppenavn)
2. **`upperNarrative`** → ny tekst om buss/bysykkel/sparkesykkel
3. **`lowerNarrative`** → ny tekst om bil/bildeling/elbillading/tog/flybuss

Skjema for SQL (følger mønster fra migrasjon 049):
```sql
UPDATE products
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(config,
      '{reportConfig,themes,N,bridgeText}', '"[ny generisk bridge text]"'),
    '{reportConfig,themes,N,upperNarrative}', '"[buss/bysykkel/sparkesykkel tekst]"'),
  '{reportConfig,themes,N,lowerNarrative}', '"[bil/bildeling/tog/flybuss tekst]"')
WHERE id = 'broset-utvikling-as_wesselslokka';
```

Finner riktig `N` (tema-index) i eksisterende config via:
```bash
source .env.local && curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=config&id=eq.broset-utvikling-as_wesselslokka" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -m json.tool | grep -n "transport\|bridgeText"
```

**Tekst-produksjon:**

Curator-skill brukes til å skrive alle tre tekstene mot Wesselsløkka-dataene. Kalibrering mot Brøset 046-standarden. Aktuelle POI-er:
- Upper: Brøset Hageby stopp (linje 12/113), Valentinlyst bysykkel, Kong Øysteins veg bysykkel, sparkesykler (Ryde/VOI/Dott)
- Lower: Hyre/Getaround (bildeling), 4 ladestasjoner, Leangen stasjon (regiontog), E6/Nyhavnavveien (bil)

### Phase 4 — Curator skill-oppdatering

**`.claude/skills/curator/references/bridge-text-calibration.md`** (eller `SKILL.md`)

Legg til dokumentasjon for de to nye teksttypene:

| Teksttype | Plassering | Fokus | Lengde |
|-----------|-----------|-------|--------|
| `upperNarrative` | Mellom bridge og live-kort | Buss + bysykkel + sparkesykkel — gangavstand, frekvens, nærhet | 2–4 setninger |
| `lowerNarrative` | Under live-kort og knapp | Bil, bildeling, elbillading, tog, flybuss — regional mobilitet | 3–5 setninger |

Kalibreringsprinsipp for `upperNarrative`: "Brukeren ser live-antall i kortene under. Teksten gir kontekst til tallene — ikke gjenta dem. Skriv om tilgang, frekvens og karakteren av nærhet."

## Dependencies & Risks

| Risiko | Sannsynlighet | Mitigering |
|--------|--------------|-----------|
| Feil tema-index (N) i JSON-migrasjon | Medium | Verifiser med curl-spørring mot config før migrasjon |
| `upperNarrative` vises på feil tema (ikke transport) | Lav | Felt er opt-in — ingen render uten data |
| Inline POI-linking på `upperNarrative` matcher feil POI | Lav | `linkPOIsInText` bruker exact match på navn — verifiser mot POI-listen i prosjektet |
| CSS-spacing mellom upper-blokk og live-kort | Lav | `mb-6` på upper-blokk, eksisterende spacing på live-kort beholdes |

## File Summary

| Fil | Endring |
|-----|---------|
| `lib/types.ts:147` | + `upperNarrative?: string`, `lowerNarrative?: string` på `ReportThemeConfig` |
| `components/variants/report/report-data.ts:58–77` | + begge felt på `ReportTheme`-interface |
| `components/variants/report/report-data.ts:~432` | + tilordning i `transformToReportData` |
| `components/variants/report/report-themes.ts:9` | + begge felt på `ReportThemeDefinition` |
| `components/variants/report/ReportThemeSection.tsx:~91` | + `upperSegments` useMemo |
| `components/variants/report/ReportThemeSection.tsx:~219` | + upper-blokk render |
| `components/variants/report/ReportThemeSection.tsx:~237` | Endre source for `segments` → `lowerNarrative ?? extendedBridgeText` |
| `supabase/migrations/051_transport_narrative_split.sql` | Ny migrasjon: bridge + upper + lower for Wesselsløkka |
| `.claude/skills/curator/references/bridge-text-calibration.md` | + dokumentasjon for de to nye teksttypene |

## References

- Brainstorm: `docs/brainstorms/2026-04-10-transport-narrative-split-brainstorm.md`
- Curator-kalibrering: `.claude/skills/curator/references/bridge-text-calibration.md`
- Eksempel-migrasjon (mønster): `supabase/migrations/049_broset_bridge_text_hero_insight.sql`
- Inline POI-linker: `lib/utils/story-text-linker.ts:22`
- isTransport-deteksjon: `components/variants/report/ReportThemeSection.tsx:59`
- ReportTheme-interface: `components/variants/report/report-data.ts:58`
- transformToReportData: `components/variants/report/report-data.ts:421`
