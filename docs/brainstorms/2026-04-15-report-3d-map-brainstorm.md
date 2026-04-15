---
date: 2026-04-15
topic: report-3d-map
status: Utforsket
---

# Brainstorm: Report3DMap — Google Maps 3D for rapportens "Alt rundt"-seksjon

## Hva vi bygger

En ny `Report3DMap`-blokk som erstatter den planlagte `TabbedAerialMap` (akvarell-JPG-er) med ekte Google Photorealistic 3D Tiles. Kartet sitter i rapportens "Alt rundt [område]"-seksjon og viser hele nabolaget i fugleperspektiv. Brukeren kan rotere 360° rundt et fast punkt, men ikke panorere eller zoome. POIer plantes som 3D-markører med lat/lng.

### Hovedmål

- Ekte 3D-visning uten juridisk risiko
- 360° rotasjon erstatter 4 statiske retnings-JPG-er
- Pins holdt seg automatisk riktig plassert når brukeren roterer (ingen per-retning-posisjonering)
- Bevart UX fra dagens TabbedAerialMap (tabs per kategori, venstre drawer, WebGL-fallback)

### Scope

- **Blokk:** Kun `Report3DMap` (erstatter uncommitted TabbedAerialMap)
- **Produkt:** Rapport. Ikke Explorer, ikke Guide
- **Pilotrapport:** Wesselsløkka (lat: 63.420, lng: 10.463)

### Ut av scope

- AnnotatedMap (seksjons-kart per tema) — beholder akvarell foreløpig, for tungt å laste 7 x 3D per rapport
- Gjenbruk i Explorer/Guide — tidligere revertert pga. kostnad på høytrafikk-flater
- Mobile-first 3D — fokuser desktop først, mobil er sekundær

---

## Hvorfor denne tilnærmingen

### Problem med dagens løsning

Den uncommitted `TabbedAerialMap` på `feat/report-blocks` bruker:
1. Google Maps 3D-screenshot → Gemini stil-transferert til akvarell → lagret som JPG i `public/illustrations/`
2. Fire retninger (nord/øst/vest/sør), crossfader mellom dem

**Juridiske problemer:**
- Bryter [Map Tiles API Policies](https://developers.google.com/maps/documentation/tile/policies) — "tracing or copying the copyrightable elements of Google's maps and creating a new work"
- Bryter [ToS Section 10.5d](https://cloud.google.com/maps-platform/terms/maps-service-terms) — maks 30 dagers caching, bildene ligger i repo evig
- Dekker ikke seg under "fair use" siden dette er i kommersielt produkt

**Tekniske problemer:**
- Markørperspektiv må gjenberegnes per retning (TODO fra 2026-04-15-worklog)
- Bare 4 diskrete retninger, ikke kontinuerlig 360°
- Auflösung begrenset (~1344x768 fra Gemini Flash)
- Ikke skalerbart til nye områder uten manuell pipeline

### Valgt løsning

**Google Maps 3D JavaScript API (Map3DElement)** via `@vis.gl/react-google-maps`-wrapperen.

Kamera låses i "museum-modus":
- `center`, `tilt`, `range` låst (fast komposisjon over Wesselsløkka)
- `heading` fri 360° (brukeren kan "snu seg rundt")
- `bounds` satt minimalt over senter for å blokkere pan

### Forkastede alternativer

| Alternativ | Hvorfor forkastet |
|---|---|
| Beholde akvarell-pipelinen | ToS-brudd, ikke skalerbart |
| CesiumJS + Google 3D Tiles | For stor bundle, overkill for vårt bruk |
| Direkte `<gmp-map-3d>` uten React-wrapper | Mer manuell lifecycle, vi har erfaring med @vis.gl/react-google-maps |
| 3D-kart per seksjon | 7 x 3D-kart = for tungt, treg side, høy kostnad |

---

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|---|---|---|
| Hvilken blokk erstattes | Kun TabbedAerialMap | AnnotatedMap beholdes, bruker akvarell kun i Natur-seksjonen (lav prioritet) |
| React-wrapper | `@vis.gl/react-google-maps` | Brukt forrige gang, Google-sponset, TypeScript, redusert ny-risiko |
| Kameraprofil | Stramt (alt låst unntatt heading) | Forutsigbar komposisjon, matcher "fixed point med fri 360° rotasjon" |
| Antall 3D-kart per rapport | Ett (hovedrapport-nivå) | Per-seksjon 3D for tungt; akvarell beholdes for seksjonsnivå |
| Fallback ved WebGL-mangel | Mapbox 2D satellitt med samme pins | Mapbox er allerede i stacken, ingen ekstra kost, semantisk riktig fallback |
| Markør-design | Sirkulære med kategorifarge + Lucide-ikon | Gjenbruker eksisterende `poi-marker-3d.tsx` fra feb 2026 |
| Pin-klikk-interaksjon | Åpner eksisterende `ReportMapDrawer` (venstre-drawer) | Konsistent med dagens TabbedAerialMap, prøv først, iterér senere |

---

## Teknisk kontekst

### Gjenbrukbare filer fra feb 2026-migrasjonen

Fortsatt i repoet (ikke slettet ved revertering):
- ✅ `components/map/poi-marker-3d.tsx` (157 linjer — 3D-pin med HTML-content)
- ✅ `components/map/route-layer-3d.tsx` (ikke brukt her, men kan komme til nytte)
- ✅ `components/map/Map3DActionButtons.tsx` (radial action buttons)
- ✅ `components/map/Map3DFallback.tsx` (WebGL-detection)
- ✅ `types/google-maps-3d.d.ts` (TypeScript-erklæringer)

### Må bygges på nytt

- ❌ `components/map/map-view-3d.tsx` — hovedkomponenten (slettet ved revertering)
- ❌ `@vis.gl/react-google-maps` — avhengighet (fjernet fra package.json)

### Ny Report3DMap-blokk vil bestå av

```
components/variants/report/blocks/
├── Report3DMap.tsx              (NY — blokk-container med tabs + drawer-state)
└── wesselslokka-3d-config.ts    (NY — center/tilt/range-konfig + POI-liste)
```

Eksisterende komponenter som gjenbrukes direkte:
- `ReportMapDrawer.tsx` eller `MarkerDrawer.tsx` (venstre-drawer)
- `poi-marker-3d.tsx` (pins)
- `Map3DFallback.tsx` (WebGL-check)

### API-setup

Google Cloud Console-sjekkliste for brukeren:
1. Gå til https://console.cloud.google.com/google/maps-apis/api-list?project=YOUR_PROJECT
2. Aktiver **Map Tiles API** (egen SKU fra Maps JavaScript API)
3. Sett daglig kvote som sikkerhetsnett: APIs & Services → Map Tiles API → Quotas → 500 events/dag
4. Sett budget alert: Billing → Budgets & alerts → $10/mnd med alerts på 50/80/100%
5. Verifiser domain-restriction på `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: `*.vercel.app`, `placy.no`, `localhost:*`

Lenker som må til brukeren:
- [Google Cloud Console — APIs](https://console.cloud.google.com/google/maps-apis/api-list)
- [Map Tiles API Pricing (mars 2025+)](https://developers.google.com/maps/documentation/tile/usage-and-billing)
- [Photorealistic 3D Tiles Overview](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)

---

## Akseptansekriterier (høynivå — detaljeres i plan)

### Funksjonelt

- Report3DMap erstatter TabbedAerialMap på Wesselsløkka-rapporten
- Brukeren kan rotere 360° rundt fast punkt med mus/touch
- Brukeren kan IKKE panorere, tilt eller zoome
- Klikk på pin åpner venstre drawer (som dagens TabbedAerialMap)
- Tabs per kategori filtrerer pins (Alle/Oppvekst/Mat&Drikke/etc.)
- WebGL ikke-støttet → Mapbox 2D satellitt-fallback med samme pins
- Attribusjon ("Map data ©2025 Google") vises på kartet

### Ikke-funksjonelt

- Første tile-lasting < 3 sekunder på 4G
- 30+ FPS ved rotasjon på mid-range mobil
- Daglig kvote-cap aktiv i Google Cloud Console
- Ingen lh3-URLer i `public/` (akvarell-JPG-er slettes)

### Juridisk

- Ingen offline-caching av tiles
- Attribusjon vises per Map Tiles API Policies
- Ingen bilder eksportert/lagret fra 3D-rendering

---

## Åpne spørsmål (avklares i plan eller work-fasen)

1. **Akvarell-ikoner:** Beholder vi kategori-ikoner med akvarell-stil (fra 2026-04-13) som pin-ikoner, eller bruker vi Lucide-ikoner rett? (Anbefalt: Lucide-ikoner på 3D-pins, akvarell-ikoner beholdes i tittel-header)
2. **Kamerastartpunkt:** Skal kameraet starte fra nord-retning (heading=0), eller fra beste vinkel av området? (Anbefalt: Test nord først — enkel, forventet)
3. **POI-data:** Henter vi POIer fra eksisterende rapport-data (samme kilde som AnnotatedMap bruker) eller bruker dummy-data først? (Anbefalt: Dummy-data i MVP, så koble ekte POI i fase 2)
4. **Mobile interaksjon:** Touch-rotasjon via to-finger-drag eller en-finger-drag? (Anbefalt: Test Googles defaults først, juster kun hvis nødvendig)
5. **Slette akvarell-JPG-er:** Når erstatter vi dem, og skal de slettes ved merge? (Anbefalt: Slett samtidig som Report3DMap går live — "Kodebase-hygiene" i CLAUDE.md)

---

## Neste steg

→ `/plan` med denne brainstormen som input.

## Kilder

### Ekstern
- [Google 3D Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/3d/overview)
- [Map3DElement API Reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [Camera Interaction](https://developers.google.com/maps/documentation/javascript/3d/interaction)
- [Photorealistic 3D Tiles Overview](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)
- [Map Tiles API Policies](https://developers.google.com/maps/documentation/tile/policies)
- [Map Tiles API Pricing](https://developers.google.com/maps/documentation/tile/usage-and-billing)
- [@vis.gl/react-google-maps docs](https://visgl.github.io/react-google-maps/)

### Internt
- Forrige migrasjon (revertert): `docs/brainstorms/2026-02-03-google-maps-3d-migration-brainstorm.md`
- Revertering: `docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md`
- Kamera-constraints-plan: `docs/plans/2026-02-03-feat-3d-map-camera-constraints-plan.md`
- Interaksjonsdesign: `docs/brainstorms/2026-02-03-explorer-3d-interaction-design.md`
- Kostnadskutt: `docs/plans/2026-02-15-fix-google-api-cost-reduction-plan.md`
- Dagens akvarell-pipeline: WORKLOG.md 2026-04-15-entry
