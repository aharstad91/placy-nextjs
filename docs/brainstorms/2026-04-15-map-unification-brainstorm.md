# Brainstorm: Forening av Mapbox og Google 3D til UnifiedMapModal

**Dato:** 2026-04-15
**Status:** Besluttet
**Deltakere:** Andreas, Claude
**Live-referanse:** `http://localhost:3000/eiendom/broset-utvikling-as/wesselslokka/rapport`
**Prior art:** `docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md` (retning: Mapbox=default, Google 3D=spesialfunksjon)

---

## Hva vi bygger

Én enhetlig kart-modal (`UnifiedMapModal`) som erstatter dagens to parallelle løsninger på rapport-siden:

| Dagens komponent | Rolle | Default-motor |
|---|---|---|
| `ReportThemeSection` | Per-tema-kart (Hverdagsliv, Mat & Drikke, Transport...) | Mapbox 2D |
| `Report3DMap` | «Alt rundt {område}» samlekart | Google 3D |

Begge bruker allerede samme `Sheet`, samme `ReportMapDrawer` (sidebar), samme dormant-preview-pattern. Unifisering er 90% kosmetisk på overflaten og 10% state/toggle-logikk.

**Resultat:** Én felles modal med 2D/3D-toggle. Mapbox default. Google 3D som paid add-on per prosjekt.

---

## Hvorfor denne tilnærmingen

### Forretningsmessig
- **Mapbox = standardleveranse** for alle rapporter
- **Google 3D = paid add-on** per prosjekt (`has_3d_addon` flag)
- Merger fjerner kognitiv dissonans: brukeren ser ikke «to forskjellige kart-opplevelser», bare «samme kart med/uten 3D»
- Salgsargumentet: «kjøp add-on → lås opp 3D-toggle på ALLE kart i rapporten»

### Teknisk
- Mapbox og Google 3D er allerede ulike visninger av samme POI-data
- Eksisterende kode har allerede konvergerte primitiver (Sheet, ReportMapDrawer, dormant-preview)
- Camera-mapping 2D↔3D er eneste reelt nye logikk
- Følger prior art fra 2026-02-04 der vi allerede besluttet toggle-modell

### Prototype-fokus
- Approach A (Wrapper) gjenbruker 90% av eksisterende motor-kode
- Ingen tung abstraksjon eller MapEngine-interface
- Risiko for over-engineering unngås

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|---|---|---|
| **Toggle-scope** | I ALLE kart-modaler | Full unifisering — samme UX overalt |
| **«Alt rundt»-samlekart** | Beholdes med kategori-tabs | Beholder oversikts-rollen; default 2D som alt annet |
| **Gating-modell** | `projects.has_3d_addon: boolean` | Synlig i admin, raskest til prod, enkel å teste |
| **Uten add-on** | Skjul toggle helt | Minimalt støy for non-3D-kunder (prototype-fase) |
| **Toggle-oppførsel** | Behold kamera + POI-valg | Smørkrem — kontinuitet = wow-faktor |
| **Arkitektur** | Approach A: Wrapper-basert `UnifiedMapModal` | Minst refactor, maksimal gjenbruk |

---

## Scope — Hva endres, hva er uendret

### Nye komponenter
- `components/map/UnifiedMapModal.tsx` — state-eier (mode, activePOI, camera, zoom)
- `components/map/ModeToggle.tsx` — 2D/3D pill-knapp i header (rendres kun hvis `has_3d_addon`)
- `lib/utils/camera-map.ts` — mapping mellom Mapbox `{lng,lat,zoom}` og Google 3D `{center, range, tilt}`

### Modifiseres
- `ReportThemeSection.tsx` — bruker `UnifiedMapModal` istedenfor direkte `Sheet` + `ReportThemeMap`
- `Report3DMap.tsx` (eller erstattes av `ReportOverviewMap.tsx`) — bruker `UnifiedMapModal` med `preset="overview"` + tema-tabs
- Supabase migrasjon: `ALTER TABLE projects ADD COLUMN has_3d_addon BOOLEAN DEFAULT FALSE`
- Admin-UI for prosjekter: checkbox for `has_3d_addon`

### Uendret
- `components/variants/report/ReportThemeMap.tsx` — Mapbox-motor, brukes as-is
- `components/map/map-view-3d.tsx` — Google 3D-motor, brukes as-is
- `components/variants/report/ReportMapDrawer.tsx` — sidebar, brukes as-is
- `components/ui/sheet.tsx` — underliggende modal-primitiv
- POI-datamodell, Supabase-queries, API-ruter

---

## UX-oppførsel

### Åpning
- **Per-tema (f.eks. Hverdagsliv):** Dormant preview → klikk → modal åpner i 2D, med temaets POIs + sub-kategori-pills (som i dag)
- **«Alt rundt»:** Dormant preview → klikk → modal åpner i 2D, med alle POIs + tema-tabs på bunnen (Alt/Opplevelse/Mat/Natur/Transport/Trening)

### Toggle (kun hvis `has_3d_addon === true`)
- Pill-knapp i header: `[ 2D | 3D ]`
- Klikk → switch motor, behold senter/zoom (mappet), behold valgt POI
- Smooth crossfade-animasjon (~300ms)

### POI-klikk
- Sidebar/drawer åpnes med POI-info (samme `ReportMapDrawer` som i dag)
- Desktop: left sidebar; mobil: bottom drawer
- Fungerer identisk i 2D og 3D

### Kategori/tema-filter
- Per-tema-modal: sub-kategori-pills (som i dag, beholdes)
- «Alt rundt»-modal: tema-tabs (som i dag, beholdes)
- Filter-UI påvirker ikke mode — filtrering er ortogonal til 2D/3D

---

## Åpne spørsmål (til plan-fase)

- [ ] **Camera-mapping:** Nøyaktig formel for Mapbox `zoom` ↔ Google 3D `range` + `tilt`?
- [ ] **Initial mode ved åpning:** Alltid 2D, eller huske siste valg i localStorage?
- [ ] **Marker-stil konvergens:** Skal 3D-markørene få samme tier-aware styling som Mapbox DOM-markers? Eller beholde dagens `Marker3DPin`?
- [ ] **Live-data overlay:** Transport-tema har `poiLiveInfo`, `mapChips`, `vehiclePositions`, `trails` — fungerer alt dette i 3D-modus, eller kun i 2D?
- [ ] **Animasjonsretning:** Crossfade, slide, eller kamera-fly ved mode-bytte?
- [ ] **Preview (dormant):** Skal dormant preview-thumbnail respektere `has_3d_addon`? Eller alltid vise Mapbox-preview?
- [ ] **Admin-UI:** Hvor i admin plasseres `has_3d_addon`-checkbox? Under prosjekt-detaljer?
- [ ] **Eksisterende demo Wesselsløkka:** Settes `has_3d_addon=true` for å fortsatt vise 3D? (Må avklares før migrasjon.)

---

## Ikke-mål (utenfor scope)

- Global MapEngine-abstraksjon for fremtidige kart-motorer (Apple Maps, osv.) — YAGNI
- Endringer på Explorer, Guide, Story eller admin POI-kart
- Endringer på POI-datamodell eller API-ruter
- Upgrade-CTA / upsell-UI når add-on ikke er aktivert (kommer ev. senere)
- Lazy-loading / prefetch-strategi for 3D-motor — håndteres i plan

---

## Filer vi kommer til å røre

**Nye:**
- `components/map/UnifiedMapModal.tsx`
- `components/map/ModeToggle.tsx`
- `lib/utils/camera-map.ts`
- `supabase/migrations/NNN_add_has_3d_addon.sql`

**Endres:**
- `components/variants/report/ReportThemeSection.tsx`
- `components/variants/report/blocks/Report3DMap.tsx` (evt. renames til `ReportOverviewMap.tsx`)
- `components/variants/report/ReportPage.tsx` (hent `has_3d_addon` og send ned som prop)
- `app/eiendom/[customer]/[project]/rapport/page.tsx` (fetch `has_3d_addon`)
- Admin-flaten for prosjekter (legg til checkbox)
- `lib/types.ts` (hvis Project-typen eksponeres mot klient)

---

## Kilder

- Eksisterende implementasjoner:
  - `components/variants/report/ReportThemeSection.tsx` (Mapbox-wrapper + Sheet)
  - `components/variants/report/blocks/Report3DMap.tsx` (Google 3D-wrapper + Sheet)
  - `components/variants/report/ReportMapDrawer.tsx` (delt sidebar)
  - `components/map/map-view-3d.tsx` (3D-motor)
  - `components/variants/report/ReportThemeMap.tsx` (2D-motor)
- Prior art:
  - `docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md` (kartmotor-valg, toggle-retning)
  - `docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md` (3D popover-gotcha)
  - `docs/plans/2026-02-03-feat-3d-map-camera-constraints-plan.md` (3D-kamera-constraints)
