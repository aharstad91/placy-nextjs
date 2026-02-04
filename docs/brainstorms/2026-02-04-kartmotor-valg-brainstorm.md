# Brainstorm: Valg av kartmotor - Mapbox vs Google Maps

**Dato:** 2026-02-04
**Status:** Besluttet
**Deltakere:** Andreas, Claude

---

## Hva vi bygger

**Hovedbeslutning:** Bytte tilbake til Mapbox GL JS som primær kartmotor for 2D-visning, samtidig som Google Maps 3D JS beholdes for fremtidige spesialfunksjoner.

**Bakgrunn:** Google Maps 3D JS ble implementert for å gi en profesjonell 3D-opplevelse. Selv om det ser bra ut, har det vist seg å ha betydelige begrensninger:
- Custom markers med HTML/CSS er vanskelig å implementere
- AI-modeller er dårlig trent på rammeverket, noe som bremser utviklingen
- Høyere kostnader ved skala sammenlignet med Mapbox

---

## Hvorfor denne tilnærmingen

### Kostnadsvurdering (ved 50K visninger/mnd)

| Tjeneste | Mapbox | Google |
|----------|--------|--------|
| Kartvisninger | Gratis (50K inkludert) | ~$154 (28K gratis) |
| Directions API | ~$2.50 | ~$25 |
| **Totalt** | **~$3** | **~$180** |

### Tekniske fordeler med Mapbox
1. **Custom markers**: Full HTML/CSS-støtte via `mapboxgl.Marker({ element })` - fungerer ut av boksen
2. **AI-vennlig**: Bedre dokumentasjon i AI-modeller → raskere iterasjon
3. **Eksisterende kode**: Mapbox-implementasjon finnes allerede i `components/map/map-view.tsx`
4. **Kartdesign**: Mapbox Studio gir god kontroll over kartstil ved behov

### Hvorfor beholde Google 3D
- Investering allerede gjort i `components/map/map-view-3d.tsx`
- Fremtidige muligheter: flyover-preview, bygningsvisning, 2D/3D-toggle
- Kan aktiveres selektivt for spesifikke features (Guide, POI-kort)

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Primær kartmotor | Mapbox GL JS | Kostnad, fleksibilitet, AI-støtte |
| Sekundær kartmotor | Google Maps 3D JS | Beholdes for fremtidige 3D-features |
| Routing API | Mapbox Directions | Allerede integrert, lavere kost |
| Places API | Google Places | Ingen endring, brukes for POI-data |

---

## Implementasjonsnotater

### Eksisterende Mapbox-kode
- `components/map/map-view.tsx` - 2D Mapbox-visning (legacy, må reaktiveres)
- `/api/directions` - Mapbox Directions API proxy
- `/api/travel-times` - Mapbox Matrix API proxy

### Google 3D-kode som beholdes
- `components/map/map-view-3d.tsx` - 3D-wrapper
- `components/map/poi-marker-3d.tsx` - 3D markers
- `components/map/route-layer-3d.tsx` - 3D ruter
- `lib/hooks/useMap3DCamera.ts` - Kamerakontroll

### Migrasjonsplan
1. Gjeninnfør Mapbox som hovedkart i Explorer og Guide
2. Flytt 3D-komponenter til egen mappe (`components/map/3d/`)
3. Opprett feature flag for 3D-modus (for fremtidig toggle)

---

## Åpne spørsmål

- [ ] Finnes full Mapbox-implementasjon i git-historikk som kan gjenbrukes?
- [ ] Skal 3D-koden refaktoreres nå, eller vente til vi trenger den?
- [ ] Hvordan håndtere overgang for eksisterende brukere?

---

## Kilder

- [Mapbox vs Google Maps Pricing](https://radar.com/blog/mapbox-vs-google-maps-api)
- [Google Maps Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/html-markers)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
