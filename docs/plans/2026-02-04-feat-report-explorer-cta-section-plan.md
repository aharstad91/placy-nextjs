---
title: "feat: Add Explorer CTA section to Report page"
type: feat
date: 2026-02-04
---

# feat: Add Explorer CTA section to Report page

## Overview

Legg til en ny seksjon på Report-siden som reklamerer for Explorer-produktet. Seksjonen viser et statisk kart med kategori-ikoner (ikke individuelle POI-er), USP-tekst som fremhever fordelene med Explorer, og en tydelig CTA-knapp.

**Mål:** Konvertere Report-lesere til Explorer-brukere, og vise at Placy har flere produkter.

## Problem Statement / Motivation

Report-siden viser granulerte kart per kategori, noe som gir god kontekst for hver seksjon. Men brukeren får aldri se "det store bildet" — alle steder samlet på ett kart. Explorer tilbyr nettopp dette, pluss interaktivitet og muligheten til å lage egne lister.

Ved å legge til en CTA nederst på Report-siden:
- Viser vi brukeren verdien av Explorer visuelt (statisk kart-preview)
- Gjør overgangen fra passivt konsum (Report) til aktiv utforskning (Explorer) naturlig
- Bygger merkevare for Placy-økosystemet

## Proposed Solution

Ny komponent `ReportExplorerCTA.tsx` som rendres mellom "Oppsummert"-seksjonen og footer, **kun når `explorerBaseUrl` er tilgjengelig**.

### Visuelt innhold

1. **Statisk Mapbox-kart** med kategori-ikoner (én markør per unik kategori sentrert på gjennomsnittlig posisjon for den kategorien)
2. **Overskrift:** "Utforsk på egenhånd"
3. **USP-tekst:** "Se alle {totalPOIs} steder på ett kart. Filtrer etter det som passer deg, og lag din egen liste å ta med ut."
4. **CTA-knapp:** "Åpne i Explorer"

### Interaksjon

- **Hele kartbildet er klikkbart** → lenker til Explorer
- **CTA-knappen** → lenker til Explorer (samme URL)
- **Link target:** Same tab (default)
- **Explorer URL:** Basis-URL uten query params (f.eks. `/strawberry/quality-hotel-augustin-explore`)

### Designdetaljer

- Bakgrunn: `#f3f0eb` (samme som footer, visuelt distinkt fra Report-body)
- Container: `max-w-3xl` (konsistent med Report)
- Kart: `rounded-xl shadow-sm`, aspect ratio 2:1
- Topp-divider: `h-px bg-[#e8e4df]`

## Technical Considerations

### Mapbox Static API og POI-grense

Mapbox Static API har URL-lengdegrense (~8192 tegn). Med mange POI-er vil individuelle markører overskride grensen.

**Løsning:** Vis kategori-ikoner istedenfor individuelle POI-er.
- Grupper POI-er per kategori
- Beregn sentroid (gjennomsnittlig lat/lng) for hver kategori
- Vis én markør per kategori med kategoriens farge
- Resultat: ~5-10 markører uansett antall POI-er

### Eksisterende mønstre å følge

| Fil | Mønster |
|-----|---------|
| `ReportDensityMap.tsx:16-52` | Mapbox Static API URL-bygging, feilhåndtering |
| `ReportClosing.tsx:20-48` | Seksjonsstyling, plassering før footer |
| `ReportHighlightCard.tsx:15-26` | `buildExplorerUrl` helper |

### Dataflyt

```
ReportPage.tsx
  ├── explorerBaseUrl (allerede tilgjengelig)
  ├── project.pois (trenger tilgang for kategori-aggregering)
  └── reportData.centerCoordinates (allerede tilgjengelig)
```

**Endring:** `ReportPage.tsx` må sende `project.pois` til den nye komponenten.

## Acceptance Criteria

- [x] Ny komponent `ReportExplorerCTA.tsx` i `components/variants/report/`
- [x] Seksjonen vises kun når `explorerBaseUrl` er definert
- [x] Seksjonen vises kun når `project.pois.length > 0`
- [x] Statisk kart viser én markør per unik kategori (sentroid-posisjon)
- [x] Hele kartbildet er klikkbart og lenker til Explorer
- [x] CTA-knapp lenker til Explorer
- [x] Styling matcher Report-designsystemet
- [x] Mapbox token håndteres korrekt (null-sjekk)
- [x] `onError` handler skjuler bildet ved feil (følg `ReportDensityMap`-mønster)

## Success Metrics

- Brukere som klikker CTA-en lander i Explorer
- Visuell kvalitet: kartet viser distinkte kategori-markører
- Ingen ytelsesforringelse (lazy loading)

## Dependencies & Risks

**Dependencies:**
- `explorerBaseUrl` må være tilgjengelig (avhenger av at Explorer-prosjekt finnes)
- `NEXT_PUBLIC_MAPBOX_TOKEN` må være satt

**Risks:**
- Mapbox Static API nedetid → Bilde vises ikke, `onError` skjuler det
- Feil i kategori-aggregeringslogikk → Markører havner feil sted

## Implementation Notes

### 1. Opprett `ReportExplorerCTA.tsx`

```tsx
// components/variants/report/ReportExplorerCTA.tsx

interface ReportExplorerCTAProps {
  pois: POI[];
  center: Coordinates;
  explorerBaseUrl: string;
  totalPOIs: number;
}
```

### 2. Kategori-sentroid-beregning

```tsx
function getCategoryCentroids(pois: POI[]): Map<string, { color: string; lat: number; lng: number }> {
  const categoryGroups = new Map<string, { color: string; lats: number[]; lngs: number[] }>();

  for (const poi of pois) {
    const key = poi.category.id;
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, { color: poi.category.color, lats: [], lngs: [] });
    }
    const group = categoryGroups.get(key)!;
    group.lats.push(poi.coordinates.lat);
    group.lngs.push(poi.coordinates.lng);
  }

  const centroids = new Map<string, { color: string; lat: number; lng: number }>();
  for (const [key, { color, lats, lngs }] of categoryGroups) {
    centroids.set(key, {
      color,
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    });
  }

  return centroids;
}
```

### 3. Mapbox Static URL

```tsx
const centroids = getCategoryCentroids(pois);
const markers = Array.from(centroids.values())
  .map(({ color, lat, lng }) => `pin-l+${color.replace("#", "")}(${lng},${lat})`)
  .join(",");

const url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x400@2x?padding=50&access_token=${token}`;
```

### 4. Oppdater `ReportPage.tsx`

```tsx
// Etter theme sections, før ReportClosing
{explorerBaseUrl && project.pois.length > 0 && (
  <ReportExplorerCTA
    pois={project.pois}
    center={reportData.centerCoordinates}
    explorerBaseUrl={explorerBaseUrl}
    totalPOIs={reportData.heroMetrics.totalPOIs}
  />
)}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `components/variants/report/ReportExplorerCTA.tsx` | **Create** — ny CTA-komponent |
| `components/variants/report/ReportPage.tsx` | **Modify** — legg til `project` prop threading, render CTA |

## References

- Brainstorm: `docs/brainstorms/2026-02-04-report-explorer-cta-brainstorm.md`
- Existing pattern: `components/variants/report/ReportDensityMap.tsx:16-52`
- Styling reference: `components/variants/report/ReportClosing.tsx`
- Explorer URL builder: `components/variants/report/ReportHighlightCard.tsx:15-26`
