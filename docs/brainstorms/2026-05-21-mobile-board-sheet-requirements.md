---
topic: mobile-board-sheet
created: 2026-05-21
status: requirements
extends:
  - docs/brainstorms/2026-05-21-sidebar-spotify-anatomi-requirements.md
related:
  - docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md
---

# Mobile board sheet — adopter desktop-sidebar + riv legacy

## Problem & motivasjon

Sidebar-Spotify-anatomien (2026-05-21) landet desktop-versjonen og slo fast som mål: *"Levere én komponent-arkitektur som fungerer både på desktop og mobil."* Open question i samme doc deferred mobil-implementasjonen:

> "Mobile bottom-sheet vs full-screen: ... Defer til mobile-implementasjon — første runde holder bottom-sheet for backward-compat."

Denne brainstormen lukker det deferred-spørsmålet og spesifiserer hvordan mobil-sheeten skal restruktureres for å gjenbruke `BoardScrollPanel`-innholdet fra desktop.

I dag har mobil en betydelig mengde divergent kode:
- `BoardMobileSheet.tsx` (448 LOC) — vaul-Drawer med 4 snap-stages og egne content-tabs (Info/Punkter)
- `BoardCategoryTabBar.tsx` (213 LOC) — pinnet bunn-nav med Hjem/Bo/Lev-tabs
- `BoardPunkterAccordion.tsx` (93 LOC), `BoardTabs.tsx` (47 LOC), `BoardLiveTransport.tsx` (127 LOC)

Til sammen ~928 LOC mobile-only kode som dupliserer eller konkurrerer med desktop-arkitekturen. Skjermbildet av desktop-sidebaren rendret ved mobil-bredde viser at scroll-panelet fungerer essensielt as-is — det er strukturen vi vil ha.

## Goals

1. Mobil gjenbruker desktop `BoardScrollPanel` som primært content-tre — én sannhetskilde for sidebar-innhold.
2. Behold "kart-i-bakgrunn med sheet over"-mønsteret (Placy-konvensjon: kartet er sentralt).
3. Slett legacy-komponenter som ikke lenger har en rolle (~928 LOC ut).
4. Audio-player er pinnet og alltid synlig når et spor er aktivt — primær spor-kontroll på mobil.
5. POI-interaksjon (chips, grounding-lenker) defereres til separat oppgave for ikke å blokkere spike.
6. Sheet-mekanikken er forenklet (2 snap-stages i stedet for 4) for å redusere kompleksitet og test-overflate.

## Anatomi (vedtatt)

Mobil-shell (< lg):

```
PEEK (default)              FULL
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│      KART           │     │  (kart bak,         │
│   ● ● ●  POI-er     │     │   kun visible       │
│       ●             │     │   ved drag-down)    │
│                     │     │                     │
├─────────────────────┤     │                     │
│  ─ drag-handle      │     │  ─ drag-handle      │
│  Hero-illustrasjon  │     │  Hero-illustrasjon  │
│  StasjonsKvartalet  │     │  StasjonsKvartalet  │
│  145 ⊙ 6 kategorier │     │  145 ⊙ 6 kategorier │
│  [del] [▶]          │     │  [del] [▶]          │
│  1 Nabolaget        │     │  1 Nabolaget        │
│  (resten gjemt)     │     │  2 Hverdagsliv      │
├─────────────────────┤     │  3 Barn & Oppvekst  │
│ ⏯ SPOR 2/7  Hverdag│     │  ...                │
│  (sticky pinned)    │     │  [kategori-kort med │
└─────────────────────┘     │   cover, karaoke]   │
                            ├─────────────────────┤
                            │ ⏯ SPOR 2/7  Hverdag│
                            │  (sticky pinned)    │
                            └─────────────────────┘
```

## Beslutninger

### Sheet-arkitektur
- **Snap-stages: bi-snap (peek + full).** Ingen mellom-stage. Reduserer mental modell og test-cases.
- **Default-stage: peek.** Brukeren lander med kart synlig + content tease (hero + 1-2 kategori-rader). Signaliserer at kartet er sentralt; content er en handling brukeren selv initierer (drar opp).
- **Sheet-implementasjon: behold `vaul`-Drawer.** Bibilotek er allerede i prosjektet og håndterer drag/snap solid. Drag-mønster (hele sheeten draggable vs handle-only) avgjøres ved implementasjon.
- **Ingen auto-snap ved play.** Audio kan starte i peek; brukeren styrer selv om de vil dra opp for å lese karaoke-tekst. Ingen "magic" som overstyrer brukerens posisjon.

### Sheet-innhold = `BoardScrollPanel`
- Samme komponent-tre som desktop: hero-illustrasjon + tittel + chips + action-row (del + ▶ play) + numerert kategori-index + kategori-kort med cover + karaoke-tekst.
- Inni vaul-sheet-en monteres `<BoardScrollPanel />` direkte. Ingen mobil-spesifikk tab-switching (Info/Punkter) — desktop-rendring er sannhet.
- Cover-illustrasjon, `SectionPlayButton`, `CategoryIndex`, `KaraokePitchText` virker as-is (de tar ikke avhengighet av desktop-bredde).

### Bunn-tab-bar
- **Slettes helt.** `BoardCategoryTabBar.tsx` rives. Den numererte indeksen i scroll-panelet er primær kategori-navigasjon. Ingen redundant nav-flate.

### Audio-player
- **Pinnet sibling utenfor sheet** (z-50 fixed bottom, mountes i `BoardScaffold`).
- Synlig kun når et spor er aktivt (matcher Spotify-anatomi-beslutningen "skjult i idle/ended").
- Gjenbruker eksisterende `BottomPlayer`-komponent — ingen mobil-spesifikk variant nødvendig.

### POI-interaksjon (placeholder for spike)
- **POI-chips i kategori-kort:** Rendres visuelt, men `onChipClick`-handler er no-op på mobil (eller chips skjules — avgjøres ved implementasjon basert på hvor klikkbart det ser ut).
- **POI-lenker i grounding-tekst (`[name](poi:id)`):** Rendres som vanlig tekst på mobil — uten link-styling. Ingen `OPEN_POI`-dispatch.
- **Begrunnelse:** POI-tap på mobil krever en koordinasjons-flyt (snap-til-peek + kart-fly-to + mini-popup-koordinering) som ville utvide spiken betydelig. Defereres til separat oppgave.

### Kart-interaksjon
- `BoardPOIMiniPopup` rendres som i dag når kartet er synlig (peek-stage) og et POI er "aktivt" via audio-tour eller annen kilde — krever ingen mobil-spesifikk endring.
- `BoardMap` med 2D/3D-toggling og path-line forblir uendret.

### Legacy som slettes
| Fil | LOC | Begrunnelse |
|-----|-----|-------------|
| `BoardMobileSheet.tsx` | 448 | Erstattes av minimal vaul-sheet med `<BoardScrollPanel />` inni |
| `BoardCategoryTabBar.tsx` | 213 | Bunn-tab-bar fjernes; indeks-liste tar over |
| `BoardPunkterAccordion.tsx` | 93 | Var POI-liste i Punkter-tab; ingen tab-switching lenger |
| `BoardTabs.tsx` | 47 | Var Info/Punkter-tab-toggle; ikke lenger relevant |
| `BoardLiveTransport.tsx` | 127 | Live-transport-widget i gammel sheet — sjekk om brukt andre steder før slett |
| **Total** | **~928** | |

Slett-rekkefølge: verifiser at ingen imports peker til disse filene utenfor mobile-mappen før sletting.

## Scope boundaries

### In scope
- Ny `BoardMobileSheet`-komponent (minimal): vaul-Drawer med bi-snap (peek + full) som mounter `<BoardScrollPanel />` som innhold.
- Slett av legacy-filene listet over.
- Fjerning av `BoardCategoryTabBar`-mounting i `BoardScaffold`.
- `BottomPlayer` mountet som sibling i `BoardScaffold` (fixed bottom z-50, synlig kun ved aktivt spor).
- Eventuelle små tilpasninger i `BoardScrollPanel`-styling for mobil-bredde (men ikke conditional rendering — bare CSS hvis nødvendig).

### Out of scope
- **POI-tap-koordinasjon på mobil** (chip-tap → snap + fly-to + popup). Defereres.
- **Auto-snap ved play eller andre state-events.** Brukeren styrer sheet-posisjon manuelt.
- **Full-screen takeover av rapport-content** (skjulning av kart helt). Bi-snap-mønsteret er valgt; peek beholdes som default-stage.
- **Drag-mønster-detaljer** (handle-only vs hele-sheet). Implementasjons-detalj, ikke produkt-beslutning.
- **POI-detail-view inni sheet** (push-navigasjon). Hvis behovet kommer tilbake, blir det en separat oppgave.
- **Endringer i `BoardScrollPanel`-content** (cover-illustrasjon, karaoke, kategori-rekkefølge). Mobil reuser desktop som-er.

### Deferred to separate tasks
- **POI-tap-flyt på mobil** — chip-tap, grounding-link-tap, eventuell sheet-til-peek-auto-snap + kart-fly-to + mini-popup. Skal behandles som dedikert mobile-POI-UX-oppgave.
- **Auto-snap-policy** når brukeren starter et spor — kan revurderes etter at vi har brukt prototypen og samlet feedback.
- **`BoardLiveTransport`** hvis vi vil ha live-transport-widget tilbake på mobil — i ny form. Slettes for nå; kommer eventuelt tilbake som content-modul i scroll-panelet.

## Success criteria

1. På `<lg`-breakpoint vises den nye mobile sheeten med `BoardScrollPanel`-innhold; alle legacy-filer fra listen er slettet.
2. Default-stage ved side-load er peek; brukeren kan dra til full og tilbake. Snap-bevegelsen føles solid (vaul-default-physics).
3. Audio-player er synlig som sticky-bottom over sheet når et spor er aktivt, og fjernes når intet spor spiller.
4. Tap på POI-chip eller POI-lenke gjør ingenting (no-op) — ingen JS-feil eller ødelagt state.
5. Hero-play, kategori-play, karaoke-tekst og cover-illustrasjoner virker identisk med desktop.
6. `BoardCategoryTabBar` og `BoardPunkterAccordion` finnes ikke lenger i bundlen (verifisert via `git log` og bundle-analyse om mulig).
7. Manuell test på iPhone-bredde (375px) viser ingen layout-brudd eller scroll-låser.

## Open questions (ikke-blokkerende)

- **Drag-handle vs hele-sheet-draggable:** Dagens `BoardMobileSheet` har hele sheet draggable. Ny minimal versjon kan velge handle-only for å unngå konflikt med vertikal scroll inni `BoardScrollPanel`. Implementasjons-detalj — testes interaktivt.
- **POI-chips: render eller skjul?** Hvis chips ser klikkbare ut men ikke er det, kan det villede. Mulig vi heller skjuler hele `CategoryFeaturedChips` på mobil. Avgjøres når vi ser det rendret på enhet.
- **Map-padding når sheet er i full:** Dagens kode har eksplisitt valgt å IKKE pad-syncing per snap (det skapte hopp ved kategori-bytte). Hvis brukeren drar sheet til full og kartet er helt skjult, er det greit — markører er der når peek igjen.
- **iOS Safari + vaul edge-cases:** Dagens kode har spesielle workarounds (`html.style.overflow = "hidden"`) for å unngå ekstra scrollbar. Bevare disse, eller test om de fortsatt trengs med ny sheet-arkitektur.

## Avhengigheter / antakelser

- `vaul` er allerede installert og brukt; vi bytter ikke sheet-bibilotek.
- `BoardScrollPanel` er ikke desktop-only på komponent-nivå — den har ingen breakpoint-conditional logikk og kan rendres ved mobil-bredde. (Verifisert ved at skjermbildene viser den som-er ved 390px.)
- `BottomPlayer` rendres allerede betinget på spor-aktivitet via audio-tour-store; ingen ny conditional trengs.
- `BoardScaffold` styrer mounting via `useIsDesktop()` — beholdes som breakpoint-styrer.
- `BoardLiveTransport` antas å være mobile-only; verifiseres via grep før sletting.
- POI-mini-popup på kartet (når kart er synlig på peek) håndteres allerede av eksisterende `BoardPOIMiniPopup`/`BoardPOI3DMiniPopup` — krever ingen mobil-spesifikk endring.
