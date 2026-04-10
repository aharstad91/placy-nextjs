---
title: Skolekort i Hero Insight — bildekort erstatter tekstliste
date: 2026-04-09
status: decided
---

# Skolekort i Hero Insight — bildekort erstatter tekstliste

## Hva vi bygger

Erstatte den tekstbaserte skolekretslisten i ReportHeroInsight (Barn & Aktivitet) med et 3-kolonners grid av bildekort. Hvert kort viser skolefoto, skoletype, navn og gangtid. Klikk åpner popover med detaljer.

## Hvorfor

Skolekretslisten er funksjonell men visuelt flat. Wesselsløkka/Brøset-rapporten har nøyaktig 3 skoler (barneskole, ungdomsskole, VGS) som gir et naturlig 3-kolonners grid. Bilder gjør seksjonen mer engasjerende og gir et inntrykk av kvalitet som matcher resten av rapporten (inline POI-linker, kart, editorial tekster).

Inspirasjon: Wesselsløkka sin egen nettside (wesselslokka.no) investerer tungt i manuelt designet nabolagsprofil. Placy bør matche den visuelle kvaliteten automatisk.

## Design

### Kortlayout (per kort)

```
┌─────────────────┐
│                  │
│   [Skolefoto]    │  ← aspect-ratio 16:9, object-cover, rounded-t
│                  │
├─────────────────┤
│ Barneskole (1-7) │  ← label i text-xs uppercase tracking-wide
│ Eberg skole      │  ← font-semibold
│ 🚶 8 min         │  ← gangtid med MapPin-ikon
└─────────────────┘
```

### Grid

- **Desktop (md+):** `grid grid-cols-3 gap-4`
- **Mobil:** `grid grid-cols-1 gap-3` (stacked — 3 kort er OK vertikalt)

### Klikk-oppførsel

Gjenbruk `Popover` fra POIInlineLink-mønsteret:
- Skoletype (Barneskole 1-7 / Ungdomsskole 8-10 / VGS)
- Gangtid med MapPin-ikon
- `editorialHook` og `localInsight`
- Ingen Google-rating (skoler har sjelden data)

### Bildekilde

**Pipeline-steg i generate-bolig (nytt steg 5.5e):**
1. For hver skole i skolekretsen: WebSearch `"{skolenavn} trondheim.kommune.no"`
2. Scrape hero-bilde fra kommune-siden
3. Lagre URL i POI `featured_image`

**Fallback (ingen bilde funnet):**
- Kategori-farge bakgrunn (#f59e0b/amber med opacity) + GraduationCap-ikon sentrert

### Barnehage/lekeplass-telling

Beholdes under grid-et, identisk med nåværende design:
```
8 barnehager · 5 lekeplasser i nabolaget
```

## Scope

- **Kun Barn & Aktivitet** — andre temaer kan få lignende kort senere
- **Kun skoler i hero insight** — barnehager/idrett vises fortsatt via kart og tekst
- **Ikke endre ReportThemeSection** — kun ReportHeroInsight

## Nøkkelbeslutninger

1. **Erstatte, ikke supplere** — bildekortene erstatter skolekretslisten, ikke legges til ved siden av
2. **Popover ved klikk** — gjenbruk eksisterende Popover-mønster, tilpasset for skoler (ingen rating)
3. **Bilder fra kommune-sider** — scrapes i generate-bolig pipeline, ikke runtime
4. **Fallback: farge + ikon** — når bilde ikke finnes
5. **Mobil: stacked** — 1 kolonne, ikke horisontal scroll (3 kort er håndterbart vertikalt)

## Åpne spørsmål

1. Skal kortet vise avstand i meter i tillegg til gangtid?
2. Bør det være en subtle "Klikk for detaljer"-indikator på kortet?
3. Skal private skoler (montessori/internasjonal) få kort, eller kun de 3 i kretsen?

## Tekniske referanser

- `components/variants/report/ReportHeroInsight.tsx:171-209` — nåværende skolekrets-rendering
- `components/variants/report/ReportThemeSection.tsx:260-334` — POIInlineLink popover (gjenbruk)
- `lib/types.ts:34` — `featuredImage?: string` på POI
- `components/poi/poi-card.tsx` — eksisterende kortstil (annen kontekst, men designreferanse)
