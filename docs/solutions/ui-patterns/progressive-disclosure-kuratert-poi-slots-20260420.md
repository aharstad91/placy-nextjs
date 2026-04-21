---
title: "Progressiv disclosure i Report-tekstseksjon — narrativ, grounding, kart, kilder"
category: ui-patterns
tags: [progressive-disclosure, report, report-theme-section, tease-fade, ux, gemini-grounding]
module: Report
symptoms: "Brukere får full informasjonsmengde per tema uten å be om det; kart er presset helt nederst etter 'juridisk' Google-stoff; POI-slider i tekstseksjon forstyrrer layout når kortene ekspanderer."
root_cause: "Tidlig versjon hadde POI-slider og dormant kart-preview som separate disclosure-steg, men rekkefølgen (slider → grounding → kart nederst) ga kartet lavest prioritet og slideren duplikerte innholdet allerede gitt av inline-POI-chips i narrativen."
---

## Problem

`ReportThemeSection` rendret tidligere alt-på-en-gang per tema (narrativ, POI-slider, grounding, kart, kilder). Første forbedring introduserte progressiv disclosure i tre nivåer, men feilet på tre punkter:

1. **Gradient-fade** lå på narrativen selv (via `line-clamp-[6]`) og viste kun at "teksten er kuttet", ikke at "her ligger mer innhold bak fade".
2. **POI-slider** i tekstseksjon hadde expand-adferd (aktivt kort vokser) som fungerte i kart-carousel-konteksten, men brøt layout utenfor kart. Samtidig hadde inline-POI-chips i narrativen allerede samme kontekst-funksjon.
3. **Kart-rekkefølgen** — kart-preview kom nederst, etter grounding-tekst og alle kilder/legal. Kartet er en hoved-CTA per kategori, ikke et tillegg.

## Løsning

### Ny seksjon-rekkefølge (2026-04-21)

```
Tema-header + ReportHeroInsight (structured cards)
Placy narrativ — alltid full (ingen clamp)

[Tease-peek av grounding-narrativen bak gradient-fade når !expanded]
[Les mer om {theme.name} ↓] / [Vis mindre ↑]

Når expanded:
  Address input (transport)
  Full Gemini grounding-narrativ (ReportCuratedGrounded / ReportGroundingInline)
  Kart-preview (klikk → UnifiedMapModal)
  Kilder + "Google foreslår også" + attribution (ReportGroundingSources)
```

### Tease-fade som disclosure-signal

Narrativen rendres alltid i full høyde. Grounding-narrativen rendres alltid (same DOM), men wrappet i en `max-h-[120px] overflow-hidden pointer-events-none` når `!expanded`. En gradient-fade på bunnen av wrapperen signalerer "her ligger mer innhold":

```tsx
<div className="relative mt-8">
  <div className={expanded ? "" : "max-h-[120px] overflow-hidden pointer-events-none select-none"}>
    {/* grounding-narrative */}
  </div>
  {!expanded && (
    <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#f5f1ec]" />
  )}
</div>
```

Viktige detaljer:
- `pointer-events-none` på peek-wrapperen hindrer at POI-chips inne i teksten blir klikkbare når de kun er delvis synlige
- `aria-hidden` når collapsed — skjermlesere skal ikke plukke opp delvis tekst
- Samme komponent rendres i begge tilstander; kun wrapping-layer endrer seg → ingen state-flytting

### Grounding splittet i narrativ og kilder

`ReportCuratedGrounded` (v2) og `ReportGroundingInline` (v1) rendrer **kun narrativen** (inkl. inline POI-chips via `POIPopover`). Kildene, "Google foreslår også" (searchEntryPointHtml) og attribution er flyttet til `ReportGroundingSources` — en v1/v2-agnostisk komponent rendret separat **under** kart-preview.

Fordelen: kart kan ligge fysisk mellom grounding-narrativ og kilder uten at komponent-grensene må håndtere slots eller render-props.

### WugZYeNg — grounding UX-cleanup

Utført samme runde (Trello-kort `WugZYeNg`):
- Fjernet "VI STILTE SPØRSMÅLET"-blokk (ikke verdi-skapende, støy)
- `HoverCard` på kilde-chips (favicon + domain) viser full tittel + URL på hover
- `target="_blank"` + `rel="noopener noreferrer nofollow"` + `referrerpolicy="no-referrer"` legges til på `<a>`-tags inne i `dangerouslySetInnerHTML` via `useEffect` + ref-query. Google ToS tillater target-endring; kun HTML-innhold må være verbatim.

### POI-popover konsolidert

`POIInlineLink` (ReportThemeSection) og `PoiChipRenderer` (ReportCuratedGrounded) var duplisert. Konsolidert til `components/variants/report/POIPopover.tsx` med `{ poi, label? }`-props.

## Fjernet (fra tidligere iterasjon)

- `ReportThemePOICarousel` og tilhørende test
- `ReportTheme.curatedSliderPOIs`
- `getCuratedPOIs`, `AnchorSlot`, `THEME_ANCHOR_SLOTS` (i `top-ranked-pois.ts`) + tester
- `mapPreviewVisible`-state i `ReportThemeSection`
- Dormant kart-preview som tredje-klikk-nivå — kart-preview er nå synlig direkte ved `expanded=true`
- `forceExpanded`-props på grounding-komponenter (foreldren styrer disclosure via DOM-wrapping)

## Relaterte doc

- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — Google ToS verbatim-krav
- `docs/plans/2026-04-21-refactor-rapport-tema-seksjon-layout-og-opprydding-plan.md` — originalt planet for denne refactoren
