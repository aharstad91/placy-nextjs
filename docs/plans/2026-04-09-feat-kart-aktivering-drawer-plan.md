---
title: "feat: Kart-aktivering med CTA + POI drawer"
type: feat
date: 2026-04-09
---

# Kart-aktivering med CTA + POI drawer

## Oversikt

To-stegs kartopplevelse per kategoriseksjon:
- **State 1 (dormant):** Kartet er like bredt som tekst-containeren (`max-w-4xl`), med et overlay og CTA-knapp. Ikke interaktivt.
- **State 2 (aktivert):** Kart utvides til full containerbredde, hoyde oker 20%, animert overgang. Fullt interaktivt.

I tillegg: marker-klikk i aktivert kart apner en sidebar-drawer fra venstre (desktop) / bunn-drawer (mobil) med POI-detaljer — erstatter dagens flytende MapPopupCard.

## Teknisk tilnaerming

### Kart-container: to states i `ReportThemeSection.tsx`

```tsx
const [mapActivated, setMapActivated] = useState(false);

{/* Map container — animated width/height transition */}
<div className={`mt-8 rounded-2xl overflow-hidden border border-[#eae6e1] relative transition-all duration-500 ease-out ${
  mapActivated
    ? "h-[480px] md:h-[600px]"           // State 2: +20% hoyde
    : "max-w-4xl h-[400px] md:h-[500px]"  // State 1: same width as text
}`}>
  <ReportThemeMap ... activated={mapActivated} />

  {/* Overlay + CTA — kun i State 1 */}
  {!mapActivated && (
    <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent flex items-end justify-center pb-8 z-10">
      <button
        onClick={() => setMapActivated(true)}
        className="px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] hover:shadow-xl transition-shadow"
      >
        Utforsk kartet
      </button>
    </div>
  )}
</div>
```

State 1:
- `max-w-4xl` matcher tekstens bredde
- Kart rendres men blokkeres av overlay
- `cooperativeGestures` + overlay forhindrer interaksjon
- Gradient overlay nedenfra gir visuell cue

State 2:
- `max-w-4xl` fjernes — kartet fyller `px-16`-containeren
- Hoyde oker 20% (400→480 / 500→600)
- `transition-all duration-500 ease-out` for animasjon
- Overlay forsvinner
- Kart er fullt interaktivt

### ReportThemeMap: ny `activated` prop

```tsx
interface ReportThemeMapProps {
  // ...eksisterende props
  activated?: boolean;  // NY — styrer cooperativeGestures + interaktivitet
}
```

Nar `activated=false`:
- `cooperativeGestures={true}` (allerede satt)
- Marker-klikk ignoreres (pointer-events: none pa markorer)

Nar `activated=true`:
- `cooperativeGestures={false}` — scroll zoom aktivert
- Markorer interaktive

### POI Drawer: erstatter MapPopupCard

**Desktop:** Venstre-sidebar drawer inne i kart-containeren
**Mobil:** Bunn-drawer (sheet pattern)

Ny komponent `ReportMapDrawer.tsx`:

```tsx
interface ReportMapDrawerProps {
  poi: POI | null;
  onClose: () => void;
  areaSlug?: string | null;
}
```

**Desktop layout (venstre drawer):**
```
+----+---------------------------+
| D  |                           |
| R  |       MAP                 |
| A  |                           |
| W  |                           |
| E  |                           |
| R  |                           |
+----+---------------------------+
```
- Absolutt posisjonert inne i kart-containeren (`absolute left-0 top-0 h-full`)
- Bredde: `w-[320px]`
- Glir inn fra venstre med `translate-x` animasjon
- Innhold: gjenbruk av MapPopupCard-innhold (bilde, navn, kategori, rating, editorial, apningstider, knapper)

**Mobil layout (bunn-drawer):**
- `absolute bottom-0 left-0 right-0`
- Maks 50% av karthoyde
- Glir opp fra bunn
- Scrollbart innhold

**Implementering:**
- Fjern MapPopupCard fra ReportThemeMap sin Marker-rendering
- I stedet, la ReportThemeMap kalle `onPOISelect(poi)` nar marker klikkes
- ReportThemeSection rendrer `ReportMapDrawer` inne i kart-containeren

## Implementeringssteg

- [ ] **Steg 1:** Legg til `mapActivated` state + overlay/CTA i ReportThemeSection
- [ ] **Steg 2:** Animert bredde/hoyde-overgang pa kart-container (transition-all)
- [ ] **Steg 3:** Oppdater ReportThemeMap med `activated` prop — styr cooperativeGestures + marker interaktivitet
- [ ] **Steg 4:** Opprett `ReportMapDrawer.tsx` — venstre drawer (desktop), bunn drawer (mobil), gjenbruk MapPopupCard-innhold
- [ ] **Steg 5:** Koble drawer til marker-klikk — fjern MapPopupCard fra ReportThemeMap, rend drawer i section
- [ ] **Steg 6:** Visuell verifisering — screenshot av begge states + drawer

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/report/ReportThemeSection.tsx` | `mapActivated` state, overlay/CTA, animert container, drawer |
| `components/variants/report/ReportThemeMap.tsx` | `activated` prop, fjern MapPopupCard, eksporter `onPOISelect` |
| `components/variants/report/ReportMapDrawer.tsx` | **NY** — venstre/bunn drawer med POI-detaljer |

## Akseptansekriterier

- [ ] State 1: kart er `max-w-4xl`, overlay med "Utforsk kartet"-knapp
- [ ] State 2: kart utvides til full bredde + 20% hoyde, animert overgang
- [ ] Marker-klikk i State 2 apner venstre drawer (desktop) / bunn drawer (mobil)
- [ ] Drawer viser POI-detaljer (bilde, navn, rating, editorial, apningstider, knapper)
- [ ] Klikk pa X eller utenfor drawer lukker den
- [ ] cooperativeGestures aktiv i State 1, deaktivert i State 2

## Referanser

- `ReportThemeMap.tsx` — eksisterende kartkomponent
- `MapPopupCard.tsx:82-233` — POI-innhold som gjenbrukes i drawer
- `ReportThemeSection.tsx:140-152` — navarende kart-container
