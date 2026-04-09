---
title: "feat: Per-kategori kart i Report — erstatt sticky sidebar-kart"
type: feat
date: 2026-04-09
---

# Per-kategori kart i Report

## Oversikt

Erstatt det ene sticky kartet (40% sidebar) med individuelle kart per kategoriseksjon. Hvert kart vises under teksten i sin seksjon og viser kun POI-ene for den kategorien. All eksisterende klikklogikk (inline-POI → marker highlight, marker → popup) bevares.

## Hvorfor

Det sticky kartet til hoyre dominerer layouten og gir for mye visuell stoy — bruker ser mange kategoriers markorer samtidig uten klar kobling til teksten de leser. Per-kategori-kart gir:
- Tydelig visuell kobling mellom tekst og kart
- Frihet til a jobbe med formater per seksjon
- Enklere UX — kun relevante POI-er pa kartet

## Teknisk tilnaerming

### Ny komponent: `ReportThemeMap`

Lett kartkomponent per tema, basert pa `ReportStickyMap` sin markorstyling men uten marker pooling og tema-switching.

**Props:**
```typescript
interface ReportThemeMapProps {
  pois: POI[];
  center: Coordinates;          // Prosjektets koordinater (for hotel-marker + bounds)
  activePOI: ActivePOIState | null;
  onMarkerClick: (poiId: string) => void;
  onMapClick?: () => void;
  mapStyle?: string;
  areaSlug?: string | null;
}
```

**Innhold:**
- Illustrated map style (`MAP_STYLE_STANDARD` + `applyIllustratedTheme`)
- Hotel/prosjekt-marker (alltid synlig)
- Tier-aware POI-markorer (fra ReportStickyMap linje 368-452)
- MarkerTooltip pa hover
- MapPopupCard pa klikk
- `fitBounds` pa mount (alle POI-er + hotelkoordinater)
- FlyTo nar `activePOI` endres (fra inline-POI klikk)
- Lazy-load med IntersectionObserver (som ReportInteractiveMapSection)

**Ikke inkludert (forenklet vs ReportStickyMap):**
- Marker pooling / opacity toggle (kun en kategori per kart)
- Theme context label (unodvendig — kartet er i seksjonen)
- expandedThemes / sub-section logikk
- WebGL context loss overlay (edge case, kan legges til senere)

### Layout-endringer i `ReportPage.tsx`

**For (60/40 split):**
```
+-- 60% scrollbar tekst --+-- 40% sticky kart --+
| Seksjon 1: Tekst        | Kart (alle POI-er)  |
| Seksjon 2: Tekst        |                      |
| Seksjon 3: Tekst        |                      |
+--------------------------+---------------------+
```

**Etter (full bredde, kart per seksjon):**
```
+---------- full bredde (max-w-5xl) ----------+
| Seksjon 1: Tekst                            |
|   [---- Kart: kun seksjon 1 POI-er ----]    |
| --- separator ---                            |
| Seksjon 2: Tekst                            |
|   [---- Kart: kun seksjon 2 POI-er ----]    |
+----------------------------------------------+
```

**Konkrete endringer:**
1. Fjern `hidden lg:flex` desktop 60/40 wrapper (linje 173-242)
2. Fjern `ReportStickyMap` import og rendering
3. Fjern `MapMetadata`-komponent (var kun for sticky kartets kontekst)
4. Behold `ThemeSeparator`
5. En layout for bade desktop og mobil — full bredde med max-width
6. `activePOI` state flyttes IKKE — holdes i ReportPage, sendes ned til hver seksjon

### Endringer i `ReportThemeSection.tsx`

Legg til kart under innholdet:

```tsx
{/* Kart for denne kategorien */}
<div className="mt-8 h-[400px] md:h-[500px] rounded-2xl overflow-hidden border border-[#eae6e1]">
  <ReportThemeMap
    pois={theme.allPOIs}
    center={center}
    activePOI={activePOI}
    onMarkerClick={onMarkerClick}
    onMapClick={onMapClick}
    mapStyle={mapStyle}
    areaSlug={areaSlug}
  />
</div>
```

**Nye props pa ReportThemeSection:**
- `activePOI: ActivePOIState | null` — for a highlighte riktig marker
- `onMarkerClick: (poiId: string) => void` — marker-klikk callback
- `onMapClick?: () => void` — deselect callback
- `mapStyle?: string` — kartets stil
- `areaSlug?: string | null` — for POI-lenker i popup

## Implementeringssteg

- [x] **Steg 1:** Opprett `ReportThemeMap.tsx` — ny komponent med illustrert kartstil, tier-markorer, hotel-marker, popup, lazy-load
- [x] **Steg 2:** Oppdater `ReportThemeSection.tsx` — legg til kart under innhold, nye props
- [x] **Steg 3:** Refaktorer `ReportPage.tsx` — fjern 60/40 split, fjern sticky kart, fjern MapMetadata, en layout for desktop+mobil
- [x] **Steg 4:** Verifiser visuelt — ta screenshot, sjekk at kart vises per seksjon med riktige POI-er
- [x] **Steg 5:** Test interaksjon — inline-POI klikk highlighter marker, marker klikk viser popup, map klikk deselekterer

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/report/ReportThemeMap.tsx` | **NY** — per-kategori kartkomponent |
| `components/variants/report/ReportThemeSection.tsx` | Legg til kart + nye props |
| `components/variants/report/ReportPage.tsx` | Fjern 60/40, fjern sticky kart, fjern MapMetadata, forenkle layout |

## Filer som KAN slettes etterpaa (dead code cleanup)

Disse brukes ikke lenger etter refaktoreringen, men slett kun etter verifisering:
- `ReportStickyMap.tsx` — erstattet av ReportThemeMap
- `MapMetadata` i ReportPage — fjernes
- `ReportInteractiveMap.tsx` — allerede ubrukt etter Story/Report merge
- `ReportInteractiveMapSection.tsx` — allerede ubrukt

## Akseptansekriterier

- [ ] Hvert tema-seksjon har sitt eget kart under teksten
- [ ] Kartet viser kun POI-er fra den aktuelle kategorien
- [ ] Hotel/prosjekt-marker vises pa hvert kart
- [ ] Inline-POI klikk → marker highlightes + kart flyr til POI
- [ ] Marker klikk → popup med POI-detaljer
- [ ] Kart lazy-loades (IntersectionObserver) — ikke alle 7 kart ved sideinnlasting
- [ ] Illustrated map style (ikke streets-v12)
- [ ] Desktop og mobil har samme layout (full bredde)
- [ ] Ingen regresjoner i eksisterende funksjonalitet (tekst, popover, insights)

## Referanser

- `ReportStickyMap.tsx:368-452` — tier-aware marker rendering (kopier stil)
- `ReportStickyMap.tsx:142-184` — fitBounds logikk (forenkle for enkelt tema)
- `ReportStickyMap.tsx:240-255` — flyTo pa activePOI (gjenbruk)
- `ReportInteractiveMapSection.tsx:42-67` — IntersectionObserver lazy-load pattern
- `ReportInteractiveMap.tsx:45-79` — enkel handleMapLoad + fitBounds
