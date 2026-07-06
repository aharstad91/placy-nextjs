# Placy Kommandoer

> Oversikt over alle kommandoer og scripts som kan kjøres i Placy-miljøet.

---

## Utviklingsmiljø

### Start dev server
```bash
npm run dev
```
Starter Next.js development server på `http://localhost:3000`.
Boards lever på `/eiendom/<kunde>/<prosjekt>/rapport-board`; nye prosjekter
provisjoneres via PRD 3-pipelinen (`npm run create-report` / generer-flyten).

### Bygg for produksjon
```bash
npm run build
```

### Kjør linting
```bash
npm run lint
```

### Valider nivå-deklarasjoner (rapport-board)
```bash
npm run validate:tier   # alle report-boards i Supabase (v2)
```
Sjekker at deklarert `reportConfig.reportTier` (1 = default, 2 = kuratert)
er fullt dekket av faktisk innhold (editorial m.m.). Exit 1 ved
under-leveranse — kjør før kunde-sending. Ved avvik: fullfør manglene
eller re-deklarer ned.

---

## Google Places Photo Scripts

### Resolve proxy URLs til CDN
```bash
npx tsx scripts/resolve-photo-urls.ts
```
Konverterer `/api/places/photo?photoReference=...` i `featured_image` til direkte `lh3.googleusercontent.com` CDN-URLer. Setter `photo_resolved_at` timestamp. Idempotent — trygt å kjøre flere ganger.

### Refresh gamle CDN-URLer
```bash
npx tsx scripts/refresh-photo-urls.ts [--days 14]
```
Re-resolver CDN-URLer eldre enn N dager (default 14). Nuller ut utgåtte `photo_reference`. Kjør annenhver uke for å holde bilde-URLer ferske.

### Refresh åpningstider
```bash
npx tsx scripts/refresh-opening-hours.ts [--days 30]
```
Oppdaterer `opening_hours_json` fra Google Places API for POI-er med utdaterte data.

### Anbefalt vedlikeholdsplan
| Script | Frekvens | Estimert API-kost |
|--------|----------|-------------------|
| `refresh-photo-urls.ts` | Annenhver uke | ~500 Photo calls (~$1.50) |
| `refresh-opening-hours.ts` | Månedlig | ~500 Details calls (~$8.50) |

---

## Nabolags-kuratering (curate-area)

### Last opp staging til `areas` (polygon + report_editorial)
```bash
npx tsx scripts/curate-area.ts --dry-run                                  # valider + plan, ingen writes
npx tsx scripts/curate-area.ts                                            # interaktiv bekreftelse før write
npx tsx scripts/curate-area.ts --file data/areas/ranheim.staging.json --yes
```
Leser staging-fil (default `data/areas/ranheim.staging.json`), validerer via
`lib/pipeline/area-staging.ts` (tema-IDer mot `REPORT_THEME_DEFAULTS`, GeoJSON
Polygon/MultiPolygon med lukkede ringer, POI-IDer som ikke-tomme strenger — aldri
UUID) og PATCHer eksisterende `areas`-rad. Merge-semantikk: staging overskriver
`boundary` og temaene den har; eksisterende `report_editorial`-temaer som ikke er
i staging beholdes. NB: `areas` mangler `updated_at` → ingen optimistisk lås
(én-operatør-PoC, dokumentert i script-headeren).

### List POI-kandidater per tema (kurateringsmeny)
```bash
npx tsx scripts/curate-area.ts --list-pois <projectId>                          # alle 6 bolig-temaer
npx tsx scripts/curate-area.ts --list-pois <p1>,<p2>,<p3> --theme mat-drikke    # union av 3 prosjekter, ett tema
```
Read-only. Henter POIer fra ett eller flere provisjonerte prosjekter
(`project_pois` → `pois`, UNION med dedup på poi-id), filtrert per temaets
kategorier og sortert på avstand fra områdets senter (`--area`, default
`ranheim`). Output per kandidat: avstand i meter, trust-score, navn, poi-id —
kopier IDer inn i `highlightCandidates` i kurator-prioritert rekkefølge
(4-6 per tema).

---

## Claude Code Kommandoer

Disse kommandoene kjøres i Claude Code (denne samtalen):

### Generer editorial hooks
```
"Generer editorial hooks for de 10 viktigste POI-ene i <json-fil>"
```
Søker på nettet etter informasjon om hvert sted og genererer:
- `editorialHook` - Én setning om det unike
- `localInsight` - Insider-tips

**Eksempel:**
```
Generer editorial hooks for POI-ene i prosjektet klp-eiendom/teknostallen
```
(POI-ene leses fra og skrives til v2-skjemaet i Supabase.)

### Legg til nye POI-er manuelt
```
"Legg til <stedsnavn> som POI i <json-fil>"
```
Søker opp stedet og legger det til med riktig kategori og koordinater.

### Oppdater bridge-tekster
```
"Skriv nye bridge-tekster for theme stories i <json-fil>"
```
Genererer engasjerende intro-tekster for hver theme story.

---

## API-nøkler (påkrevd i .env.local)

| Variabel | Beskrivelse | Brukes av |
|----------|-------------|-----------|
| `GOOGLE_PLACES_API_KEY` | Google Places API | Provisjonerings-pipelinen |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS | Kart, reisetider |

---

## Tilgjengelige Google Places-kategorier

Kan brukes i `discover.googleCategories` i input-filen:

**Mat & Drikke:**
- `restaurant`, `cafe`, `bar`, `bakery`

**Helse & Trening:**
- `gym`, `spa`, `doctor`, `dentist`, `pharmacy`, `hospital`

**Dagligliv:**
- `supermarket`, `bank`, `post_office`, `hair_care`

**Shopping:**
- `shopping_mall`

**Kultur:**
- `museum`, `library`, `movie_theater`, `park`

**Overnatting:**
- `hotel`

---

## Feilsøking

### "GOOGLE_PLACES_API_KEY mangler"
Legg til i `.env.local`:
```
GOOGLE_PLACES_API_KEY=din-nøkkel-her
```

### "Mapbox API feil 403"
Matrix API krever betalt Mapbox-tilgang. Bruk `--skip-travel-times` flagget.
Reisetider beregnes av frontend ved runtime.

### "Ingen POI-er funnet"
- Sjekk at koordinatene er riktige
- Prøv større radius (f.eks. 1500m)
- Sjekk at Google Places API-nøkkelen har riktige tillatelser

---

*Sist oppdatert: 2026-06-10*
