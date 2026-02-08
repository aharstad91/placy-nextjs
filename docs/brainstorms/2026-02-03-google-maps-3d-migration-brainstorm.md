# Google Maps 3D Migration Brainstorm

**Dato:** 2026-02-03
**Status:** Utforsket

## Hva vi bygger

Migrere Placy fra Mapbox GL JS til Google Maps 3D JavaScript API for å få fotorealistisk 3D-visning med satellite-bilder, bygninger og terreng i skew/tilt-modus.

### Hovedmål
- Wow-effekt ved første inntrykk (fly-over av nabolag)
- Bedre romlig forståelse av avstander og terreng
- Eiendomsvisualisering med bygninger og utsikt

### Scope
- **Produkt:** Start med Explorer, deretter full migrering
- **Strategi:** Bytt helt til Google - én kartleverandør
- **Funksjonell paritet:** Bevare all eksisterende funksjonalitet

## Hvorfor denne tilnærmingen

### Valgt løsning: Google Maps 3D JavaScript API

Bruker Googles nye `<gmp-map-3d />` web component direkte i Next.js.

**Begrunnelse:**
1. **Fungerer på web** - Ingen app-nedlasting nødvendig
2. **Enklest implementering** - Google håndterer 3D-rendering
3. **Ferdig fotorealistisk** - 2500+ byer med 3D-mesh
4. **Gratis i preview** - Ingen kostnad under utvikling
5. **Places-data inkludert** - Sømløs integrasjon med Google Places API

**Forkastede alternativer:**
- CesiumJS + Google Tiles: Mer komplekst, unødvendig kontroll
- deck.gl + Google Tiles: Bratt læringskurve, overkill for behovet

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Kartleverandør | Google Maps | 3D-støtte på web |
| Rendering | Google-håndtert | Enklere enn CesiumJS/deck.gl |
| Migrering | Full | Unngå to kart-systemer |
| Første produkt | Explorer | Best egnet for 3D-utforskning |

## Teknisk kontekst

### Dagens løsning (Mapbox)
```
components/map/map-view.tsx     - Hovedkart med react-map-gl
components/map/poi-marker.tsx   - Custom POI-markører
components/map/route-layer.tsx  - Rute-visualisering
```

### Funksjonalitet som må migreres
1. **Custom POI-markører** med kategori-ikoner og farger
2. **Rute-visualisering** mellom POI-er
3. **FlyTo-animasjoner** ved POI-klikk
4. **Navigasjonskontroller** (zoom, pan)
5. **Skjuling av standard labels** for ryddig visning

### Google 3D API capabilities
- `<gmp-map-3d />` web component
- Kamerakontroll med tilt/heading/range
- Custom markers og polylines
- Event listeners for interaksjon
- Polygon/polyline med 3D-ekstrusjon

## Åpne spørsmål

1. **Norsk 3D-dekning?** - Må verifisere at norske byer har fotorealistisk 3D
2. **React-wrapper?** - Finnes det en React-wrapper, eller må vi lage egen?
3. **Ruting-API** - Bytte til Google Routes API eller beholde Mapbox Directions?
4. **Kostnad GA** - Hva koster det når preview-fasen er over?
5. **Offline/ytelse** - Hvordan håndtere 3D på trege forbindelser?

## Neste steg

1. Verifiser norsk 3D-dekning (Oslo, Trondheim, Bergen)
2. Sett opp Google Cloud-prosjekt med Maps JavaScript API
3. Bygg proof-of-concept med `<gmp-map-3d />` i Explorer
4. Migrer POI-markører til Google-format
5. Implementer kamera-animasjoner
6. Migrer rute-visualisering

## Kilder

- [Google 3D Maps Product Page](https://mapsplatform.google.com/maps-products/3d-maps/)
- [3D Maps JavaScript API Blog Post](https://mapsplatform.google.com/resources/blog/access-3d-maps-in-maps-javascript-api-starting-today/)
- [Photorealistic 3D Tiles Overview](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)
