# Brainstorm: Per-prosjekt default bearing for 3D-kart

**Dato:** 2026-04-16  
**Status:** Klar for planlegging

---

## Hva vi bygger

Et felt i per-prosjekt konfigurasjonen som setter default bearing (heading/rotasjon) for alle 3D-kart i rapporten. Alle kart-instanser deler samme verdi. For Stasjonskvartalet settes dette til 180°. Verdien brukes både ved initial innlasting og ved camera-reset.

---

## Problemet

`defaultHeading` er hardkodet til `0` (nord) i `map-view-3d.tsx:275`. For noen prosjekter er ikke nord den beste vinkelen — Stasjonskvartalet ser bedre ut fra sør (180°). Det er ingen måte å konfigurere dette per prosjekt i dag.

### Hardkodede steder (begge må fikses):
1. `map-view-3d.tsx:275` — `defaultHeading={0}` ved initialisering
2. `ReportOverviewMap.tsx:~100` — `heading: 0` i reset-camera handler

---

## Valgt tilnærming: Legg til `heading` i `CameraLock`

### Hvorfor CameraLock (ikke ReportConfig direkte)?
- `CameraLock` eier allerede alle kamera-parametere: range, tilt, minTilt, maxTilt, minAltitude, maxAltitude, panHalfSideKm
- Bearing er et kamera-parameter — det hører hjemme der
- `ReportConfig` peker allerede til `CameraLock` via `MapView3D`-props
- Unngår å splitte kamera-config på to abstraksjonsnivåer

### Alternativ vurdert: `initialHeading` i `ReportConfig`
- Mer eksplisitt "dette er en per-prosjekt override"
- Men splitter kamera-config — da må man lete to steder for å forstå kameraoppførselen

---

## Beslutninger

1. **`heading?: number`** legges til i `CameraLock`-interfacet — default `0` hvis ikke satt
2. **`report-data.ts`** setter `heading: 180` i `cameraLock` for Stasjonskvartalet via `PROJECT_CAMERA_OVERRIDES` (samme pattern som `PROJECT_THEME_ILLUSTRATIONS`)
3. Begge hardkodede steder erstattes med verdien fra `cameraLock.heading ?? 0`
4. **Ingen ny abstraksjon** — bare utvide eksisterende interface og bruke verdien der den allerede propageres

---

## Scope (ikke i scope)

- **I scope:** bearing per prosjekt, delt av alle 3D-instanser i rapporten
- **Ikke i scope:** per-tema bearing, per-modal bearing, bruker-konfigurerbar bearing via UI
- **Ikke i scope:** pitch/tilt override (kan vurderes separat)

---

## Berørte filer

| Fil | Endring |
|-----|---------|
| `lib/types.ts` | Legg til `heading?: number` i `CameraLock` |
| `components/map/map-view-3d.tsx` | Bruk `cameraLock.heading ?? 0` (linje 275) |
| `components/variants/report/blocks/ReportOverviewMap.tsx` | Bruk `cameraLock.heading ?? 0` i reset-handler (~linje 100) |
| `components/variants/report/report-data.ts` | Legg til `PROJECT_CAMERA_OVERRIDES` med `heading: 180` for Stasjonskvartalet |

---

## Akseptansekriterier

- [ ] Stasjonskvartalet-rapporten åpner 3D-kart med 180° bearing
- [ ] Camera-reset knappen returnerer til 180° (ikke 0°)
- [ ] Alle tema-modal-kart bruker samme bearing (ikke bare ett av dem)
- [ ] Prosjekter uten override bruker 0° (nord) som før
- [ ] TypeScript-kompilering uten feil
