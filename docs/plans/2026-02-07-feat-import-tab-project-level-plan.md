---
title: "feat: Move POI import to project-level tab"
type: feat
date: 2026-02-07
brainstorm: docs/brainstorms/2026-02-07-import-tab-project-level-brainstorm.md
audit: GREEN
---

# feat: Move POI import to project-level tab

Flytt POI-import fra selvstendig admin-side (`/admin/import`) inn som fjerde tab på prosjektdetaljsiden. Import blir kontekstuell — alltid knyttet til et prosjekt.

## Proposed Solution

Ny "Import" tab i prosjektdetalj med rekkefølge: **Detaljer → Produkter → POI-er → Import**.

Ny `ImportTab`-komponent i **egen fil** (`import-tab.tsx`) som gjenbruker import-logikken fra `import-client.tsx`, tilpasset tab-kontekst:
- Ingen prosjektvelger (prosjekt er implisitt)
- Layout matcher PoisTab-mønsteret (sidebar + kart i `h-[calc(100vh-220px)]`)
- Discovery circles leses fra server-rendret prosjektdata (ingen state-lifting)
- `router.refresh()` etter import for å oppdatere alle tabs

## Technical Considerations

### State-synkronisering mellom tabs
- **Discovery circles:** Pass `project.discovery_circles` fra server-rendret props direkte til ImportTab. Ingen state-lifting. Legg til `onCirclesSaved` callback i `DiscoveryCirclesEditor` som trigger `router.refresh()` i parent — dette oppdaterer alle tabs med ferske data.
- **POI-data etter import:** Kall `router.refresh()` etter vellykket import. Trigger server re-render som oppdaterer alle tabs.

### Komponentstruktur
- **Egen fil:** `import-tab.tsx` — prosjektdetaljfilen er allerede 1930 linjer
- Ekstraher gjenbrukbar logikk: kategori-valg, API-kall, import step-maskin
- Layout: Sidebar med importskjema (venstre) + kart med discovery circles (høyre)
- Bruk GeoJSON `<Source>` + `<Layer>` for preview-markører (IKKE `<Marker>`-komponenter — GPU-rendret, smooth ved 100+ POIs)

### Reset-logikk
`handleReset` i tab-kontekst skal kun nullstille import-spesifikk state (kategorier, transport, step, stats) — ikke prosjektdata (senter, circles, projectId).

## Acceptance Criteria

- [x] Ny "Import" tab på prosjektdetaljsiden som 4. tab (etter POI-er)
- [x] ImportTab i egen fil `import-tab.tsx`
- [x] Import-skjema med kategori-valg, Entur/Bysykkel-toggles, preview og import-flow
- [x] Kart viser discovery circles visuelt (GeoJSON Source+Layer)
- [x] Preview-markører rendret som GeoJSON Layer (ikke DOM Markers)
- [x] ProjectId sendes automatisk til import-API (ingen velger)
- [x] Etter import: "Se importerte POI-er"-knapp som bytter til POI-er tab + refresher data
- [x] Discovery circles synkronisert: `DiscoveryCirclesEditor` trigger `router.refresh()` ved save
- [x] Sidebar: Fjern "Import"-lenke fra `admin-sidebar.tsx`
- [x] Fjern `/admin/import`-rute (erstatt med redirect til `/admin/projects`)
- [x] Tab-rekkefølge: Detaljer → Produkter → POI-er → Import

## MVP

### Filendringer

```
app/admin/projects/[id]/import-tab.tsx             # NY FIL — ImportTab komponent
app/admin/projects/[id]/project-detail-client.tsx   # Legg til Import i TABS, importer ImportTab, pass props
app/admin/projects/[id]/discovery-circles-editor.tsx # Legg til onCirclesSaved callback → router.refresh()
components/admin/admin-sidebar.tsx                   # Fjern Import-lenke
app/admin/import/page.tsx                            # Erstatt med redirect("/admin/projects")
app/admin/import/import-client.tsx                   # Slett etter at import-tab.tsx er ferdig
```

### Steg-for-steg

#### 1. Opprett `import-tab.tsx` med ImportTab-komponent

Sidebar + kart layout (matcher PoisTab):
```typescript
// app/admin/projects/[id]/import-tab.tsx
"use client";

interface ImportTabProps {
  project: ProjectWithRelations;
  onSwitchTab: (tab: string) => void;
}

export function ImportTab({ project, onSwitchTab }: ImportTabProps) {
  // State: step, categories, includeEntur, includeBysykkel, stats
  // Layout: h-[calc(100vh-220px)] min-h-[500px] flex rounded-xl
  //   Sidebar (w-72): kategori-checkboxes, transport-toggles, preview/import-knapper
  //   Kart (flex-1): discovery circles (GeoJSON Source+Layer), preview POIs (GeoJSON Layer)
  // Success: "Se POI-er" + "Ny import" knapper
}
```

Import-logikk fra `import-client.tsx`:
- `PLACE_CATEGORIES` (linjer 79-100) — Google Places kategorier
- `buildImportBody()` (linjer 215-231) — hardcode projectId fra props
- `handlePreview()` / `handleImport()` (linjer 233-285)
- Kategori-checkboxes, transport-toggles, preview-stats, success-skjerm
- Preview-markører: GeoJSON `<Source>` + `<Layer type="circle">` (IKKE `<Marker>`)

#### 2. Oppdater TABS-konstant i `project-detail-client.tsx`

```typescript
const TABS = [
  { id: "details", label: "Detaljer" },
  { id: "products", label: "Produkter" },
  { id: "pois", label: "POI-er" },
  { id: "import", label: "Import" },
] as const;
```

Legg til rendering:
```typescript
{activeTab === "import" && (
  <ImportTab project={project} onSwitchTab={setActiveTab} />
)}
```

#### 3. Oppdater `discovery-circles-editor.tsx`

Legg til `onSaved` callback prop:
```typescript
interface DiscoveryCirclesEditorProps {
  // ... eksisterende props
  onSaved?: () => void; // NY — kalles etter vellykket save
}
```

I save-handler, kall `onSaved?.()` etter success. Parent bruker dette til `router.refresh()`.

#### 4. Post-import: bytt tab + refresh

```typescript
// I ImportTab success-state
<button onClick={() => {
  router.refresh();
  onSwitchTab("pois");
}}>
  Se importerte POI-er
</button>
```

#### 5. Fjern sidebar-lenke

Fjern `{ href: "/admin/import", label: "Import", icon: Upload }` fra `admin-sidebar.tsx`.

#### 6. Redirect gammel URL

```typescript
// app/admin/import/page.tsx
import { redirect } from "next/navigation";
export default function ImportPage() {
  redirect("/admin/projects");
}
```

## Pattern Compliance (fra tech audit)

- **Layout:** PoisTab-mønster — `h-[calc(100vh-220px)]`, `w-72` sidebar, `flex-1` map
- **Map style:** `streets-v12`, NavigationControl `top-right`, center på `project.center_lng/lat`
- **Knapper:** Blue gradient (preview), emerald gradient (import), gray (reset)
- **Banners:** `rounded-xl`, `bg-red-50`/`bg-green-50`
- **Markører:** GeoJSON Source+Layer for preview POIs (GPU-rendret, smooth ved 100+)
- **IKKE bruk:** `AdminSecondaryNav`, `<Marker>` for bulk POIs, state-lifting for circles

## References

- Brainstorm: `docs/brainstorms/2026-02-07-import-tab-project-level-brainstorm.md`
- Existing import: `app/admin/import/import-client.tsx`
- Project detail: `app/admin/projects/[id]/project-detail-client.tsx`
- PoisTab layout pattern: `docs/solutions/feature-implementations/admin-project-poi-map-sidebar-20260206.md`
- Server actions pattern: `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
- Cache invalidation: `docs/solutions/architecture-patterns/nextjs-revalidate-endpoint-supabase-rest-20260206.md`
- Sidebar: `components/admin/admin-sidebar.tsx:27`
- Import API: `app/api/admin/import/route.ts`
