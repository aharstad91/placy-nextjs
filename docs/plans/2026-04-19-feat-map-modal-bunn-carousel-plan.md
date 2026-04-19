---
title: Bunn-carousel i UnifiedMapModal med toveis kart↔kort-kobling
type: feat
date: 2026-04-19
brainstorm: docs/brainstorms/2026-04-19-kart-modal-bunn-carousel-brainstorm.md
status: deepened
---

# feat: Bunn-carousel i UnifiedMapModal med toveis kart↔kort-kobling

## Enhancement Summary

**Deepened:** 2026-04-19
**Tech audit:** YELLOW → oppdateringer applisert → GREEN
**Sections enhanced:** Technical Approach, State Management, Implementation Phases, Acceptance Criteria, Risks
**Review-agenter brukt:** kieran-typescript-reviewer, julik-frontend-races-reviewer, code-simplicity-reviewer, performance-oracle, best-practices-researcher, architecture-strategist, security-sentinel, pattern-recognition-specialist

### Nøkkelforbedringer fra review

1. **Handler-drevne side-effekter** — flyTo/scroll kjøres IKKE via useEffect som leser state. React-batching + hurtig klikking gir "aktiv POI uten flyTo"-race. Handlers kaller direkte via refs.
2. **flyToken + scrollToken-pattern** — rAF-scoped tokens kansellerer superseded operasjoner. Én liten `useInteractionController`-hook, ingen nye deps.
3. **Forenklet source-discriminator** — `"card" | "marker"` er nok. URL-param-case håndteres som "card med instant animasjon" ved mount.
4. **Instant scroll ved marker-klikk** — industry-standard (Airbnb, Google Maps). Smooth gir dobbel-animasjon-kvalme når kort må beveges ofte.
5. **Kuttet lib/poi-ranking.ts-extraction** — importer direkte fra `matdrikke-carousel.ts`, refactor ved tredje forbruker.
6. **3D droppet fra V1** — deaktiver carousel-interaksjon i 3D-modus, ikke "best-effort flyTo".
7. **Performance-mitigering** — useMemo på topN, priority-bilder (3 første), ingen permanent `will-change`, ingen box-shadow-animasjon.
8. **Hook istedenfor klasse** (pattern-audit): `useInteractionController()` matcher kodebasens `camera-map.ts`-stil (rene funksjoner + closures). Ingen andre klasse-patterns i app-kode.
9. **Én komponent med `isActive`-prop** (pattern-audit): matcher `ReportPOICard`/`ReportHighlightCard`-mønsteret, ikke to separate komponenter.
10. **Filplassering justert** (pattern-audit): POI-kort = `components/variants/report/` (editorial content), carousel = `blocks/`, controller-hook = `lib/map/` (ren infra).
11. **Single MapRef-eier** (arch-audit): gjenbruker eksisterende `registerMapboxMap`-kanal i SlotContext, ingen parallell `onMapReady`-consumer.
12. **Security** (security-audit): `?poi=`-param whitelist-valideres mot POI-listen, eksterne lenker får `rel="noopener noreferrer" target="_blank"`, `next.config.js` `remotePatterns` verifiseres.

---

## Overview

Legge til en bunn-plassert POI-carousel (maks 20vh) i `UnifiedMapModal` på desktop, med toveis-kobling: klikk på kart-markør aktiverer tilhørende kort (scroll-to + subtil morph), klikk på kort aktiverer markør (flyTo + highlight). Mobil beholder eksisterende sidebar-pattern (`ReportMapDrawer`) uendret.

## Problem Statement

Når bruker åpner kart-modalen i dag er det ingen orienteringshjelp — de ser en sky av markører uten kontekst. Sidebar åpner først *etter* marker-klikk. Vi trenger en standard-visning av topp-POIs synlig fra start, som også fungerer som navigasjons-verktøy. Industri-standard (Google Maps, Airbnb, Yelp).

## Proposed Solution

Bunn-carousel rendres i `UnifiedMapModal`s eksisterende (men ubrukte) `bottomSlot`-prop, kun på desktop (`md+`). Carousel-en:
- Viser topp N (5–10) POIs fra kategorien ved åpning (gjenbruker `matdrikke-carousel.ts`-sort)
- Binder toveis til modalens lokale `activePOI`-state via source-discriminator (`"card" | "marker"`)
- Aktivt kort får **subtil morph** (scale 1.05 + translateY(-8px)) + 2px border + shadow-lift
- Knapperekke (Vis rute / Les mer / Google Maps) kun på aktivt kort
- Erstatter `ReportMapDrawer` på desktop (drawer blir `md:hidden`)

## Technical Approach

### Architecture

```
UnifiedMapModal
├── Header (sticky top)
├── Map body (80vh)
│   ├── mapboxSlot → ReportThemeMap (eksponerer flyTo via ref + context)
│   └── google3dSlot → Google3dMapStage (carousel deaktiveres i 3D)
│   └── ReportMapDrawer (md:hidden — kun mobil)
└── bottomSlot → <MapModalPOICarousel>   ← NY (md:block, hidden på mobil)
```

**Nye komponenter (filplassering per pattern-audit):**
- `components/variants/report/blocks/ReportMapBottomCarousel.tsx` — container + scroll-styring + tastatur (POI-kort er rapport-variant, ikke kart-motor)
- `components/variants/report/ReportMapBottomCard.tsx` — én komponent med `isActive: boolean`-prop (matcher `ReportPOICard`/`ReportHighlightCard`)
- `lib/map/use-interaction-controller.ts` — hook som returnerer `{ flyTo, scrollCardIntoView, cancelAll }`. Ingen JSX, ingen React-imports utover `useRef`. Matcher `camera-map.ts`-stil.

### State — håndtert som intent, ikke via useEffect

**Kritisk pattern (Julik):** side-effekter kjøres **direkte i klikk-handlers**, ikke via useEffect som leser state. Årsak: React batcher state-updates, og ved rask klikking kan useEffect lese state med feil `source` etter at ny klikk har mutert den → "aktiv POI uten flyTo".

```tsx
// Modalens lokale state — kun for rendering
const [activePOI, setActivePOI] = useState<
  { id: string; source: "card" | "marker" } | null
>(null);

// Handler — kjører side-effekter UMIDDELBART
function handleCardClick(id: string) {
  setActivePOI({ id, source: "card" });
  interactionController.flyTo(id);  // handler-drevet, ikke effect
  // ingen scroll — kortet er allerede synlig
}

function handleMarkerClick(id: string) {
  setActivePOI({ id, source: "marker" });
  interactionController.scrollCardIntoView(id, { behavior: "instant" });
  // ingen flyTo — kartet er allerede sentrert rundt markøren
}
```

**URL-param-case:** Behandles i `useEffect` ved mount kun (ikke ved state-change). `setActivePOI({id, source: "card"})` + `flyTo({animate: false})` + `scrollCardIntoView({behavior: "instant"})`. En-gangs-initialisering.

### useInteractionController (flyToken + scrollToken)

Matcher `camera-map.ts`-stil: rene funksjoner + closures over refs. Ingen klasse-presedens i app-kode.

```ts
// lib/map/use-interaction-controller.ts
export function useInteractionController(
  getMap: () => mapboxgl.Map | null,
  getCardElement: (id: string) => HTMLElement | null,
  getPOI: (id: string) => { lat: number; lng: number } | null,
) {
  const flyToken = useRef(0);
  const scrollToken = useRef(0);

  const flyTo = useCallback((poiId: string, opts?: { animate?: boolean }) => {
    const myToken = ++flyToken.current;
    getMap()?.stop();
    requestAnimationFrame(() => {
      if (myToken !== flyToken.current) return;
      const map = getMap();
      const poi = getPOI(poiId);
      if (!map || !poi) return; // guard mot mode-switch/unmount
      map.flyTo({
        center: [poi.lng, poi.lat],
        duration: opts?.animate === false ? 0 : 400,
        essential: true,
      });
    });
  }, [getMap, getPOI]);

  const scrollCardIntoView = useCallback(
    (poiId: string, opts: { behavior: "smooth" | "instant" }) => {
      const myToken = ++scrollToken.current;
      requestAnimationFrame(() => {
        if (myToken !== scrollToken.current) return;
        const el = getCardElement(poiId);
        if (!el) return;
        el.scrollIntoView({ behavior: opts.behavior, block: "nearest", inline: "center" });
      });
    },
    [getCardElement],
  );

  const cancelAll = useCallback(() => {
    flyToken.current++;
    scrollToken.current++;
    getMap()?.stop();
  }, [getMap]);

  return { flyTo, scrollCardIntoView, cancelAll };
}
```

**MapRef-eierskap:** `UnifiedMapModal` eier `mapboxRef` via eksisterende `registerMapboxMap`-kanal i `SlotContext` (ingen parallell `onMapReady`-consumer). Hook-en får `getMap = () => mapboxRef.current`.

**Cancel triggeres ved:** modal-close, mode-switch 2D→3D, component unmount (useEffect cleanup).

### Filer som endres

| Fil | Endring |
|---|---|
| `components/map/UnifiedMapModal.tsx` | Utvid lokal activePOI til `{id, source} \| null`. Legg inline-kommentar om bevisst divorse fra Zustand. Legg `md:hidden` på ReportMapDrawer. Render `<ReportMapBottomCarousel>` via `bottomSlot` (desktop-only). Kall `useInteractionController` med `mapboxRef` (eksisterende `registerMapboxMap`-kanal). Kall `cancelAll()` på close/mode-switch. Legg blokkommentar over handlers som forklarer handler-drevet effect-pattern. |
| `components/variants/report/blocks/ReportMapBottomCarousel.tsx` | **NY** — horizontal scroll + pil-navigasjon + scroll-snap + roving tabindex. Tar aktiv-state via SlotContext. |
| `components/variants/report/ReportMapBottomCard.tsx` | **NY** — én komponent med `isActive: boolean`-prop (matcher `ReportPOICard`). Knapperekke rendres conditionally ved `isActive`. |
| `lib/map/use-interaction-controller.ts` | **NY** — hook med flyToken/scrollToken/cancelAll. Ren funksjon-stil (matcher `camera-map.ts`). |
| `components/variants/report/ReportThemeMap.tsx` | Wire `onMarkerClick` til å kalle `setActivePOI({id, source: "marker"})` + `controller.scrollCardIntoView(id, { behavior: "instant" })` direkte i handler. Gjenbruk eksisterende `registerMapboxMap`-call til SlotContext — ingen ny ref-eksponering. |
| `components/variants/report/ReportThemeSection.tsx` | Sende POI-liste + `center` til `bottomSlot`-render-prop. `useMemo(getMatDrikkeCarousel(pois, center), [pois, center.lat, center.lng])`. |
| `app/globals.css` | `@keyframes map-modal-card-activate` adjacent til eksisterende `map-modal-*`-keyframes (rundt linje 117). Scale + translateY, GPU-transform only. Ingen box-shadow-animasjon. |
| `next.config.js` | Verifiser at `images.remotePatterns` dekker alle bildekilder (Google Places `lh3.googleusercontent.com`, Supabase Storage). |

### Styling — subtil morph (ikke drastisk)

NN/g 2024 dokumenterer at store morph-animasjoner får brukere til å miste spatial anchor. Derfor:
- Aktiv: `transform: scale(1.05) translateY(-8px)`
- Border: `0 → 2px #[brand-color]`
- Shadow-lift: to-lags-teknikk (pre-rendert shadow + `opacity`-transition) — IKKE `box-shadow`-animasjon (paint per frame)
- Varighet: 150ms (industry: Airbnb 150ms card highlight, Google 120ms)
- Transform-origin: bottom (vokser oppover, brukerens spec)
- `will-change: transform` kun ved hover/focus, fjernes etter animasjon

### Performance-mitigering

| Tiltak | Hvor |
|---|---|
| `useMemo(getMatDrikkeCarousel(...))` | ReportThemeSection — cachet på `[pois, center.lat, center.lng]` |
| `priority` på 3 første bilder | `MapModalPOICard`: `priority={index < 3}` |
| `loading="lazy"` på resten | `MapModalPOICard`: automatisk via next/image når ikke priority |
| `sizes="(max-width: 1024px) 40vw, 240px"` | `MapModalPOICard` — hindrer overforbruk av srcset |
| Eksplisitt `width`/`height` på bilder | Forhindrer CLS |
| Pre-load bilde ved hover | Carousel `onPointerEnter(poiId)` → `new Image().src = url` (forhindrer FOUC ved morph-Safari) |
| Ingen permanent `will-change` | Kun CSS `:hover`/`:focus-visible` |
| `IntersectionObserver` → skip scroll hvis >50% synlig | InteractionController.scrollCardIntoView |

### Implementation phases

#### Phase 1: Grunnstruktur
- Utvid activePOI-state i UnifiedMapModal til `{id, source} | null` (inline type, ikke i `lib/types.ts`)
- Inline-kommentar på state: "Modalen eier selection lokalt, synker IKKE til useStore.activePOI by design — se plan 2026-04-19"
- Blokkommentar over handlers: "Side-effects kjører direkte i handlers, ikke via state-drevne effects, for å unngå React-batching-race ved rask klikking"
- Opprett `useInteractionController`-hook med flyToken/scrollToken (`lib/map/use-interaction-controller.ts`)
- Instansier hook i UnifiedMapModal med `getMap = () => mapboxRef.current`
- Legg `md:hidden` på ReportMapDrawer i modalen
- Wire `onMarkerClick` → `setActivePOI({id, source: "marker"})` + `controller.scrollCardIntoView(id, {behavior: "instant"})` direkte i handler
- Valider `?poi=`-param mot POI-listen i mount-effect (whitelist, ikke sanitize) før setActivePOI

#### Phase 2: Kort + carousel
- `ReportMapBottomCard` — én komponent med `isActive: boolean`-prop, knapperekke conditional på aktiv
- "Les mer"-lenke relativ intern route; "Google Maps"-knapp skjules hvis `place_id` mangler; eksterne lenker med `rel="noopener noreferrer" target="_blank"`
- CSS `@keyframes map-modal-card-activate` i `app/globals.css` adjacent til eksisterende `map-modal-slide-up/down` (rundt linje 117)
- Pre-rendert shadow-lag + opacity-transition (ikke box-shadow-animasjon)
- `ReportMapBottomCarousel` — scroll-snap + pil-nav + ref-map for scrollIntoView
- Plugge inn i `UnifiedMapModal.bottomSlot` fra `ReportThemeSection`
- `useMemo(getMatDrikkeCarousel(pois, center))` på topN-sort
- Verifiser `next.config.js` `images.remotePatterns` dekker bildekilder

#### Phase 3: Handler-drevne side-effekter
- `handleCardClick` → `setActivePOI({id, source: "card"})` + `controller.flyTo(id)`
- `handleMarkerClick` → `setActivePOI({id, source: "marker"})` + `controller.scrollCardIntoView(id, {behavior: "instant"})`
- URL-param-handling i mount-effect (en-gangs): flyTo animate:false, scroll instant
- Cancel-all på modal-close + mode-switch
- Pre-load bilde ved pointer-enter

#### Phase 4: Edge cases + tilgjengelighet
- Keyboard: Tab per kort (roving tabindex — kun aktivt har `tabindex=0`, resten `-1`, piltast flytter fokus)
- Enter/Space = card-klikk (flyTo + aktiver)
- Piltast L/R = scroll carousel + flytt fokus, men IKKE aktiver (industry: Airbnb)
- `aria-selected="true"` på aktivt kort, `aria-current="true"` på aktiv marker
- `aria-live="polite"`-region annonserer "[n] av [N], [navn]" ved marker-klikk, debounced 150ms for å unngå dobbel-annonsering
- ESC: deaktiver aktiv POI (setActivePOI(null) + controller.cancelAll()). Dobbel-ESC lukker modal (Radix default).
- Klikk på kart-bakgrunn (ikke marker) → deaktiver
- 3D-modus: carousel deaktiveres (overlay "Tilgjengelig i 2D-modus" eller bare render ikke)

#### Phase 5: Tester + verifisering
- Vitest: `InteractionController` flyToken/scrollToken-cancellering (mock map + DOM)
- Vitest: `useMemo(getMatDrikkeCarousel)` stabile refs
- Vitest: `handleCardClick`/`handleMarkerClick` — side-effekter trigget direkte (ikke via effect)
- Manuell: rask klikking marker→marker→marker, ingen janky pan
- Manuell: mode-switch mid-flyTo, ingen crash
- Manuell: desktop + mobil + resize-transisjon
- Lighthouse-audit: carousel påvirker ikke kart-LCP negativt
- Safari-test: bilde-FOUC ved morph-aktivering

## Acceptance Criteria

### Funksjonelle
- [ ] Carousel synlig nederst i modal på desktop (md+), skjult på mobil (<md)
- [ ] Carousel høyde ≤ 20vh, kart fyller resten
- [ ] Viser topp 5–10 POIs fra kategori ved åpning (`getMatDrikkeCarousel` cap 10)
- [ ] Klikk på kart-markør: tilhørende kort scroller inn **instant**, aktiveres (morph), ingen flyTo
- [ ] Klikk på kort: kart flyTo (400ms ease-out), marker blir visuelt aktiv, ingen scroll-endring
- [ ] Aktivt kort viser "Vis rute" / "Les mer" / "Google Maps"
- [ ] Inaktive kort: kicker + navn + bilde + walkMin + rating
- [ ] Morph: `scale(1.05) translateY(-8px)` + 2px border + shadow, 150ms
- [ ] Mobil: ReportMapDrawer-sidebar fungerer uendret, carousel ikke synlig
- [ ] 3D-modus: carousel deaktivert (marker-klikk synker ikke til kort i 3D)

### Race-kondisjoner (kritisk)
- [ ] Rask klikking marker→marker→marker: kun siste flyTo/scroll kjører (flyToken/scrollToken)
- [ ] Klikk kort under pågående flyTo fra forrige klikk: avbryt forrige, start ny (`getMap().stop()` + token-check)
- [ ] Modal-close under pågående flyTo: `controller.cancelAll()` kalles, ingen hengende callbacks
- [ ] Mode-switch 2D→3D under pågående flyTo: `getMap()` returnerer null etter unmount, guard hopper over call
- [ ] Side-effekter i handlers (ikke useEffect) — state for rendering kun

### Edge cases
- [ ] Tom kategori (0 POIs): carousel-container skjules helt
- [ ] <3 POIs: left-aligned, ingen center-strekking
- [ ] 50+ POIs: kun topp 10 (hard cap)
- [ ] URL-param `?poi=xyz` utenfor topp-N: inkluder som 11. kort, auto-aktivert ved mount (instant)
- [ ] Marker-klikk på POI utenfor topp-N: samme — legg til som 11. kort
- [ ] POI uten Google Maps place_id: "Google Maps"-knapp skjules
- [ ] POI uten featuredImage: placeholder
- [ ] Responsive resize md↔mobile med aktiv POI: activePOI beholdes, CSS håndterer synlighet

### Tilgjengelighet
- [ ] Roving tabindex: kun aktivt kort har `tabindex=0`, resten `-1`
- [ ] Piltast L/R: flytter fokus + scroll, ikke aktiverer
- [ ] Enter/Space på fokusert kort: aktiverer (card-klikk)
- [ ] ESC deaktiverer; dobbel-ESC lukker modal
- [ ] Klikk på kart-bakgrunn deaktiverer
- [ ] `aria-selected="true"` på aktivt kort
- [ ] `aria-current="true"` på aktiv marker
- [ ] `aria-live="polite"` annonserer "[n] av [N], [navn]" ved marker-klikk, debounced 150ms
- [ ] Focus-ring ikke klippet (container `overflow-y: visible` + padding-top for plass)
- [ ] Marker har `role="button"` + keyboard-aktivering

### Performance
- [ ] `getMatDrikkeCarousel` memoisert (`useMemo`)
- [ ] 3 første bilder `priority`, resten lazy
- [ ] `sizes` + eksplisitt `width`/`height` på bilder
- [ ] Pre-load bilde ved `onPointerEnter` (Safari morph-FOUC-mitigering)
- [ ] Ingen permanent `will-change` — kun hover/focus
- [ ] Ingen box-shadow-animasjon — opacity-lagde shadows
- [ ] Morph-animasjon 60fps målt på M1 + mid-tier Android
- [ ] flyTo ≤ 500ms (400ms target)

### Kode-kvalitet
- [ ] `next/image` (ikke `<img>`) per CLAUDE.md
- [ ] `useInteractionController`-hook (ikke klasse), matcher `camera-map.ts`-stil
- [ ] Én `ReportMapBottomCard`-komponent med `isActive`-prop (matcher `ReportPOICard`)
- [ ] `ActivePOISource`-type inline i UnifiedMapModal (ikke i `lib/types.ts` før gjenbruk)
- [ ] `readonly POI[]` på carousel-props
- [ ] `SlotContext` brukt for activePOI, ikke props-drilling
- [ ] Inline-kommentar på modal-state om divorce fra Zustand
- [ ] Blokkommentar over handlers om handler-drevet effect-pattern
- [ ] Enkelt MapRef-eierskap: gjenbruk `registerMapboxMap`-kanal, ingen parallell `onMapReady`
- [ ] ESLint: 0 errors
- [ ] `npx tsc --noEmit`: 0 errors
- [ ] Vitest: alle tester grønne
- [ ] `npm run build`: uten feil

### Security
- [ ] `?poi=xyz` whitelist-valideres mot POI-liste før `setActivePOI` (ikke sanitize, hard match)
- [ ] Ingen `dangerouslySetInnerHTML` i nye komponenter
- [ ] Eksterne lenker: `rel="noopener noreferrer" target="_blank"`
- [ ] "Les mer" peker til intern route (relativ URL)
- [ ] `next.config.js` `images.remotePatterns` dekker `lh3.googleusercontent.com` + Supabase Storage
- [ ] aria-live annonserer `{text}` (React-escaped), ikke `dangerouslySetInnerHTML`

## Success Metrics

- **Funksjonell:** <2 klikk fra åpen modal til aktiv POI
- **Performance:** Morph 60fps, flyTo ≤ 500ms, LCP-nøytralt for modal-opening
- **Ingen regresjoner** i mobile sidebar
- **A11y:** Full keyboard-navigering uten mus

## Dependencies & Risks

| Risiko | Sannsynlighet | Mitigering |
|---|---|---|
| React batching → useEffect-race | HØY | Handler-drevne side-effekter, ikke effects som leser state |
| flyTo-storm ved rask klikking | HØY | flyToken + rAF + `map.stop()` |
| Safari scrollIntoView ikke cancellerbar | MEDIUM | Egen scroll-driver via InteractionController med token |
| Bilde-FOUC i morph (Safari srcset-bytte) | MEDIUM | Pre-load ved pointer-enter + fast image-størrelse |
| Mode-switch null-map crash | LAV | `getMap()` guarded i InteractionController |
| Overflow-y-visible bryter scroll-snap | LAV | Test tidlig i Phase 2; fallback: pad-top |
| Focus-ring klippet av overflow | LAV | `outline-offset`, padding-top |
| 3D har ingen flyTo-analog | AKSEPTERT | 3D deaktiverer carousel-interaksjon i V1 |
| Morph "mister spatial anchor" (NN/g) | LAV | Subtil morph (scale 1.05, ikke 1.2) |

## References

### Interne
- `lib/store.ts:13-60` — activePOI (brukes IKKE direkte; modal har lokal state per designvalg)
- `components/map/UnifiedMapModal.tsx:51-60` — SlotContext (gjenbruker for activePOI)
- `components/map/UnifiedMapModal.tsx:74` — bottomSlot-prop (ubrukt, plugger inn her)
- `components/map/UnifiedMapModal.tsx:120` — lokal activePOI (utvides til `{id, source}`)
- `components/map/UnifiedMapModal.tsx:255` — close-reset (legges til `controller.cancelAll()`)
- `components/map/UnifiedMapModal.tsx:365-371` — ReportMapDrawer (blir md:hidden)
- `components/variants/report/ReportThemeMap.tsx:105-112` — handleMarkerClick
- `components/variants/report/blocks/FeatureCarousel.tsx:59-84,143-227` — scroll + kort-referanse
- `components/variants/report/blocks/matdrikke-carousel.ts:30-50` — importeres direkte (ingen extraction)
- `components/variants/report/ReportThemeSection.tsx:410-460` — modal-invokering

### Docs / institusjonelle læringer
- `docs/brainstorms/2026-04-19-kart-modal-bunn-carousel-brainstorm.md` — WHAT
- `docs/solutions/feature-implementations/report-map-popup-card-20260213.md` — source-discriminator-pattern
- `docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md` — aktivt kort ikke flytte ved pan/zoom
- `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md` — eksplisitte @keyframes med unike navn
- `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md` — 4-state machine for WebGL-toggle

### Eksterne (fra best-practices-research)
- Nielsen Norman Group "Maps in Web UIs" (2024) — morph taper spatial anchor, hold subtil
- Airbnb Engineering "Rebuilding Search Map" (Medium, 2024) — flyTo 400ms, debounce 150ms
- Smashing Magazine "Map UX Patterns 2025" — source-discriminator-pattern
- WAI-ARIA Authoring Practices 1.3 — composite widgets + roving tabindex

### CLAUDE.md-konvensjoner
- `next/image` obligatorisk
- Ingen `useEffect` for data-fetching (UI-sync OK, men her unngår vi state-drevne effects for side-effekter)
- `@/`-imports
