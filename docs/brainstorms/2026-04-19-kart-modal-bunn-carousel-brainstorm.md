---
date: 2026-04-19
topic: kart-modal-bunn-carousel
status: brainstorm
related:
  - docs/solutions/feature-implementations/report-map-popup-card-20260213.md
  - docs/solutions/ui-patterns/transit-dashboard-card-accordion-tabs-20260416.md
  - docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md
  - docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md
  - docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md
---

# Kart-modal bunn-carousel — brainstorm

## Hva vi bygger

En **bunn-carousel med POI-kort** inne i `UnifiedMapModal` på desktop. Formål:
gi leseren orientering ved åpning ("hva ser jeg?") gjennom topp N POIs i
kategorien, og etablere toveis-kobling mellom kart og kort — klikk på marker
aktiverer tilhørende kort, klikk på kort aktiverer marker.

På desktop erstatter carousel dagens sidebar-pattern. Mobil beholder
eksisterende sidebar-atferd uendret.

## Hvorfor denne tilnærmingen

**Orientering, ikke utforskning.** Leseren åpner modalen for å forstå
nabolaget — ikke for å bla gjennom 47 restauranter. Topp N (5–10 mest
relevante) gjør det visuelt rolig og gir en "get started"-følelse.

**Toveis-kobling er etablert pattern.** `lib/store.ts:13-60` har `activePOI`
+ `useActivePOI()` allerede. `SlotContext` i `UnifiedMapModal.tsx:30-60`
eksponerer `activePOI`/`setActivePOI` til render-slots. Source-discriminator
(`{ poiId, source: "card" | "marker" }`) er dokumentert i
`report-map-popup-card-20260213.md` og forhindrer doble flyTo-animasjoner.

**Carousel erstatter sidebar på desktop.** Sidebar var god for utforskning,
men for en 20vh-footer blir to informasjonsoverflater dobbelt opp.
Renere å ha ett sted der aktivt POI vises.

**Visuell utheving uten ny informasjon (V1).** Kortet vokser oppover
(~20px) + får ring/shadow. Ikke tabs, ikke inline-ekspansjon med mer
innhold. Leveres raskt, verifiserer at kobling-mekanikken fungerer.
Innholdsrik aktiv-state kommer etter testing.

## Nøkkel-beslutninger

| Beslutning | Valg |
|---|---|
| Scope | Desktop-only. Mobil uendret. |
| Høyde | Maks 20vh for carousel; kart får resterende ~80vh |
| Antall kort | Topp N (5–10) ved åpning — orienteringsfokus |
| Aktivt kort | Vokser oppover (topp-anker), ring + shadow. Samme innhold som inaktive. |
| Sidebar | Erstattes av carousel på desktop. Mobile beholder sidebar. |
| Kobling-pattern | Source-discriminator (`"card"` / `"marker"`) via `setActivePOI` |
| State | Gjenbruk `useActivePOI()` fra `lib/store.ts` |
| Knapper på aktivt kort | "Vis rute" / "Les mer" / "Google Maps" |
| Animation | 300ms ease-out for morph. Eksplisitt CSS @keyframes (ikke Tailwind `supports-backdrop-filter`) |

## Gjenbrukbare byggeklosser (fra research)

- `lib/store.ts:13-60` — `activePOI` + `useActivePOI()` (selektor, shallow)
- `components/map/UnifiedMapModal.tsx:30-60` — `SlotContext` med `activePOI` + `setActivePOI`
- `components/variants/report/MapPopupCard.tsx` — kan inspireres av for kort-struktur
- `components/variants/report/blocks/FeatureCarousel.tsx:49-80` — scroll+snap-state-tracking
- Source-discriminator-pattern fra `report-map-popup-card-20260213.md`

## Åpne spørsmål (til /plan eller senere)

- **Filter/sortering som fremtidig tillegg.** Bruker likte tanken ved
  spørsmål 1 (sorter etter avstand/rating/åpen nå), men uklart hvordan det
  skal se ut. Parkert som idé. Vurderes når V1 er testet.
- **Hva er "topp N"-algoritmen?** Rating × avstand? Tier-badge-prioritet?
  Redaksjonelt håndplukket? Eksisterende `matdrikke-carousel.ts`-logikk
  sorterer på `featuredImage` først — gjenbruke?
- **Morph-detaljer.** Hvor mange px vokser aktivt kort oppover? Skal hele
  høyden øke, eller bare cap ekspandere? Finpusses når vi har prototype.
- **Antall kort synlig samtidig ved 1440px-bredde.** 3? 4? 5? Scroll-
  indikator nødvendig?
- **Hvor vises "Vis rute" når ikke-aktivt kort?** Kun synlig ved aktiv
  state, eller alltid-synlig-men-dimmet?
- **Mobil-fallback.** Når viewport er smal, hva skjer? Kollapser carousel
  til list, eller holder vi sidebar-pattern for mobil?
- **Popup over marker?** Skal `MapPopupCard` også poppe over markeren som
  bonus-visualisering når aktivt, eller er carousel-kortet nok?

## Suksesskriterium

1. Bruker åpner modalen → ser umiddelbart topp 5–10 POIs i bunn-carousel
2. Klikk på marker → tilhørende kort scroller inn og vokser oppover (~20px)
3. Klikk på kort → kart flyTo marker, marker blir aktiv
4. Ingen duplikat-animasjoner (source-discriminator virker)
5. Desktop føles ryddigere enn dagens sidebar-pattern
6. Mobil er uendret

## Neste steg

Kjør `/workflows:plan` når det er dags for implementering. Planen bør dekke:
- Ny komponent `MapModalPOICarousel.tsx` (under `components/map/`)
- Integrasjon i `UnifiedMapModal.tsx` via eksisterende slot-mønster
- CSS @keyframes i `app/globals.css` (unike navn, ikke generisk `slide-up`)
- Source-discriminator-wiring i `setActivePOI`-kallene
- Tester for toveis-kobling uten doble animasjoner
