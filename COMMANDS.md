# Placy Kommandoer

> Oversikt over alle kommandoer og scripts som kan kjøres i Placy-miljøet.

---

## Utviklingsmiljø

### Start dev server
```bash
npm run dev
```
Starter Next.js development server på `http://localhost:3000`.
Appen redirecter automatisk til `/klp-eiendom/ferjemannsveien-10/`.

### Bygg for produksjon
```bash
npm run build
```

### Kjør linting
```bash
npm run lint
```

---

## Story Generator

### Generer ny story fra input-fil
```bash
npm run generate:story <input-fil> [options]
```

**Argumenter:**
- `<input-fil>` - Path til `.input.json` fil (påkrevd)

**Options:**
- `--skip-travel-times` - Hopp over reisetidsberegning (anbefalt, beregnes av frontend)
- `--update` - Oppdater eksisterende data (merger med ny data)
- `--help` - Vis hjelp

**Eksempel:**
```bash
# Generer ny story
npm run generate:story data/projects/klp-eiendom/nytt-prosjekt.input.json -- --skip-travel-times

# Oppdater eksisterende story med nye POI-er
npm run generate:story data/projects/klp-eiendom/eksisterende.input.json -- --skip-travel-times --update
```

**Input-fil format:**
Se `data/templates/input.template.json` for mal.

**Output:**
Genererer `<prosjektnavn>.json` i samme mappe som input-filen.

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
Generer editorial hooks for POI-ene i data/projects/klp-eiendom/test-generator.json
```

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

## Filstruktur for nye prosjekter

```
data/projects/<kunde>/<prosjekt>.input.json   ← Input (du lager)
data/projects/<kunde>/<prosjekt>.json          ← Output (generert)
```

### Opprett nytt prosjekt

1. **Kopier input-template:**
   ```bash
   cp data/templates/input.template.json data/projects/ny-kunde/nytt-prosjekt.input.json
   ```

2. **Rediger input-filen** med prosjektinfo (navn, koordinater, radius)

3. **Kjør generator:**
   ```bash
   npm run generate:story data/projects/ny-kunde/nytt-prosjekt.input.json -- --skip-travel-times
   ```

4. **Start dev server og test:**
   ```bash
   npm run dev
   # Åpne: http://localhost:3000/ny-kunde/nytt-prosjekt/
   ```

5. **Generer editorial hooks (valgfritt):**
   ```
   I Claude Code: "Generer editorial hooks for POI-ene i data/projects/ny-kunde/nytt-prosjekt.json"
   ```

---

## API-nøkler (påkrevd i .env.local)

| Variabel | Beskrivelse | Brukes av |
|----------|-------------|-----------|
| `GOOGLE_PLACES_API_KEY` | Google Places API | Story generator |
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

*Sist oppdatert: 2026-01-24*
