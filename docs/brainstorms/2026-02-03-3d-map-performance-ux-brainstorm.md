# Google Maps 3D - Ytelse og UX

**Dato:** 2026-02-03
**Status:** Klar for plan

## Hva vi bygger

Optimaliseringer for Google Maps 3D-kartet som sikrer smooth 60fps-opplevelse på alle enheter, samtidig som API-kostnader holdes under kontroll.

## Hvorfor denne tilnærmingen

Google Maps 3D API eksponerer **ikke** direkte kontroll over:
- LOD (Level of Detail)
- Tile quality/resolution
- Frame rate
- Render distance

Men vi **kan** påvirke ytelse indirekte gjennom:
- `range` — høyere = færre detaljer lastes
- `tilt` — lavere = mindre 3D-data synlig
- `bounds` — begrenser datainnlasting til relevant område
- `minTilt/maxTilt/minRange/maxRange` — setter grenser

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Navigeringsmodus | Fri med grenser | Bevarer utforskningsfølelse, men kontrollerer ytelse |
| Tilt-grenser | 0° – 70° | Unngår "liggende" vinkel (90°) som laster mye data |
| Range-grenser | 150m – 3000m | Balanserer detalj og oversikt |
| Bounds | Prosjektområde + buffer | Begrenser API-kostnad og irrelevant data |
| UI-presets | Valgfritt tillegg | Kan legge til snarvei-knapper senere |

## Implementeringsdetaljer

### Map3DElement constraints

```typescript
// Foreslåtte verdier
const mapConstraints = {
  minTilt: 0,
  maxTilt: 70,
  minRange: 150,    // meters - forhindrer for nært zoom
  maxRange: 3000,   // meters - forhindrer for langt ut
  bounds: {
    // Beregnes fra prosjektdata + padding
  }
};
```

### Valgfrie UI-presets (fremtidig)

| Preset | Tilt | Range | Use case |
|--------|------|-------|----------|
| Fugleperspektiv | 0-20° | 2000-3000m | Se hele området |
| Nabolag | 45° | 800-1200m | Standard utforsking |
| Gateplan | 60-70° | 200-400m | Detaljert POI-visning |

## Åpne spørsmål

1. Hvilken buffer rundt prosjektområdet er passende for bounds?
2. Skal constraints variere basert på enhet (mobil vs desktop)?
3. Trenger vi visuell indikator når bruker treffer en grense?

## Kilder

- [Google Maps 3D Support](https://developers.google.com/maps/documentation/javascript/3d/support)
- [Map3DElement Reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [Camera Control](https://developers.google.com/maps/documentation/javascript/3d/interaction)
