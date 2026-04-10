---
title: "feat: Skolekort i Hero Insight — bildekort erstatter tekstliste"
type: feat
date: 2026-04-09
brainstorm: docs/brainstorms/2026-04-09-skolekort-hero-insight-brainstorm.md
---

# feat: Skolekort i Hero Insight — bildekort erstatter tekstliste

## Overview

Erstatte den tekstbaserte skolekretslisten i `BarnOppvekstInsight` med et 3-kolonners grid av bildekort. Hvert kort viser skolefoto, skoletype, navn og gangtid. Klikk åpner popover med skoletype, gangtid og editorial hook.

## Motivasjon

Skolekretslisten (SchoolRow) er funksjonell men visuelt flat sammenlignet med resten av rapporten (inline POI-linker med bilder, kart, editorial tekster). Wesselsløkka-rapporten har nøyaktig 3 skoler som gir et naturlig grid. Bilder gjør seksjonen mer engasjerende og matcher kvaliteten på konkurrerende nabolagsprofiler (jf. wesselslokka.no).

## Akseptansekriterier

- [x] Skolekretslisten erstattes av bildekort-grid i `BarnOppvekstInsight`
- [x] Desktop: 3 kolonner side om side (`grid-cols-3`)
- [x] Mobil: 1 kolonne stacked (`grid-cols-1`)
- [x] Hvert kort viser: bilde (eller fallback), skoletype-label, skolenavn, gangtid
- [x] Klikk på kort åpner popover med skoletype, gangtid, editorial hook
- [x] Fallback for manglende bilde: kategori-farge + GraduationCap-ikon
- [x] Barnehage/lekeplass-tellingen beholdes under grid-et
- [x] Ingen endringer i andre temaers hero insight
- [x] TypeScript kompilerer uten feil

## Teknisk tilnærming

### Steg 1: SchoolCard-komponent i ReportHeroInsight.tsx

Erstatt `SchoolRow` med en ny `SchoolCard`-komponent:

```
components/variants/report/ReportHeroInsight.tsx
```

**SchoolCard layout:**
```
┌─────────────────┐
│   [Bilde/icon]   │  aspect-[16/10], rounded-t-lg, object-cover
├─────────────────┤
│ BARNESKOLE (1-7) │  text-[11px] uppercase tracking-[0.12em] text-[#a0937d]
│ Eberg skole      │  text-sm font-semibold text-[#1a1a1a] truncate
│ 🚶 8 min         │  text-xs text-[#8a8a8a] flex items-center gap-1
└─────────────────┘
```

**Bilde-håndtering:**
- Sjekk `poi.featuredImage` — vis med `<img>` + `object-cover`
- Google My Maps URL → proxy via `/api/image-proxy`
- Fallback: `bg-[{theme.color}]/10` + `GraduationCap`-ikon sentrert
- `onError` → sett `imageError=true` → vis fallback

**Popover ved klikk:**
Gjenbruk `Popover`/`PopoverTrigger`/`PopoverContent` fra `@/components/ui/popover`. Tilpasset innhold:
- Header: kategori-ikon + skolenavn + skoletype
- Meta: gangtid med MapPin-ikon (ingen rating — skoler har sjelden Google-data)
- Editorial: `poi.editorialHook` + `poi.localInsight`

### Steg 2: Erstatt SchoolRow-grid i BarnOppvekstInsight

Bytt ut `<div className="space-y-2.5">` med:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
  {data.barneskole && (
    <SchoolCard level="Barneskole (1–7)" poi={data.barneskole} center={center} />
  )}
  {data.ungdomsskole && (
    <SchoolCard level="Ungdomsskole (8–10)" poi={data.ungdomsskole} center={center} />
  )}
  {data.vgs && (
    <SchoolCard level="Videregående" poi={data.vgs} center={center} />
  )}
</div>
```

Barnehage/lekeplass-footer forblir identisk.

### Steg 3: Verifiser visuelt

- Ta screenshot av Barn & Aktivitet-seksjonen på Wesselsløkka-rapporten
- Sjekk at kort rendrer korrekt med og uten bilder
- Sjekk mobil-layout (stacked)

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/report/ReportHeroInsight.tsx` | Ny `SchoolCard`, erstatt `SchoolRow`-bruk i `BarnOppvekstInsight` |

Ingen nye filer. Ingen nye dependencies.

## Referanser

- Brainstorm: `docs/brainstorms/2026-04-09-skolekort-hero-insight-brainstorm.md`
- `ReportHeroInsight.tsx:171-210` — nåværende BarnOppvekstInsight
- `ReportHeroInsight.tsx:212-227` — nåværende SchoolRow (erstattes)
- `ReportThemeSection.tsx:260-334` — POIInlineLink popover (mønster å gjenbruke)
- `components/poi/poi-card.tsx:50-137` — eksisterende kortstil (designreferanse)
