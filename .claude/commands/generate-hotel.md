# Generate Hotel Project

Opprett et komplett Placy-prosjekt for et byhotell med Report + Explorer-produkter og POI-er. Optimalisert for intern QA — resultatet skal være nær ferdig.

## Input

```
/generate-hotel "Hotellnavn" "Adresse"
```

Eksempel: `/generate-hotel "Scandic Nidelven" "Havnegata 1, Trondheim"`

## Forutsetninger

- `npm run dev` kjører på `localhost:3000`
- `ADMIN_ENABLED=true` i `.env.local`

## Byhotell-profil

Alle hoteller bruker denne profilen. Byhotell i norske byer er målgruppen.

### Kategorier

```json
["restaurant", "cafe", "bar", "bakery", "supermarket", "pharmacy",
 "gym", "park", "museum", "library", "shopping_mall", "movie_theater",
 "hair_care", "spa"]
```

### Per-by radius-defaults

| By | Radius |
|----|--------|
| Trondheim | 800m |
| Oslo | 1000m |
| Bergen | 600m |
| Default | 800m |

Bruk bynavn fra geocode-resultatet til å slå opp radius.

### Discovery-parametere

- `minRating`: 3.5
- `maxResultsPerCategory`: 15

### Report themes (byhotell-rekkefølge)

```json
[
  {
    "id": "mat-drikke",
    "name": "Mat & Drikke",
    "icon": "UtensilsCrossed",
    "categories": ["restaurant", "cafe", "bar", "bakery"]
  },
  {
    "id": "kultur-opplevelser",
    "name": "Kultur & Opplevelser",
    "icon": "Landmark",
    "categories": ["museum", "library", "cinema", "park"]
  },
  {
    "id": "hverdagsbehov",
    "name": "Hverdagsbehov",
    "icon": "ShoppingCart",
    "categories": ["supermarket", "pharmacy", "shopping", "haircare"]
  },
  {
    "id": "transport",
    "name": "Transport & Mobilitet",
    "icon": "Bus",
    "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "airport"]
  },
  {
    "id": "trening-velvare",
    "name": "Trening & Velvære",
    "icon": "Dumbbell",
    "categories": ["gym", "spa"]
  }
]
```

## Pipeline (13 steg)

Utfør stegene i rekkefølge. Hvert steg bruker resultatet fra forrige.

### Steg 1: Geocode adresse

Kall geocoding-API-et for å konvertere adresse til koordinater.

```
GET http://localhost:3000/api/geocode?q={adresse URL-encoded}
```

- Svaret er GeoJSON med `center: [lng, lat]` — **reverser til `{ lat, lng }`**
- Velg resultatet med høyest `relevance`-score
- Feil hvis ingen resultater eller `relevance < 0.5`
- Utled bynavn fra geocode-resultatet (place_name eller context)

**Checkpoint:** Vis stedsnavn, bynavn og koordinater. Spør brukeren om bekreftelse.
Hvis avvist: Spør etter korrigert adresse og geocode på nytt. Gjenta til godkjent.

### Steg 2: Opprett/finn kunde

Utled hotellkjedenavn fra hotellnavnet:
- "Radisson Blu Trondheim Airport" → "Radisson Blu"
- "Scandic Nidelven" → "Scandic"
- "Thon Hotel Prinsen" → "Thon Hotel"

**Checkpoint:** Vis utledet kundenavn. Spør brukeren om bekreftelse.
Hvis avvist: Bruk kundenavnet brukeren oppgir i stedet.

Slugify kundenavnet med `lib/utils/slugify.ts`-logikken (æ→ae, ø→o, å→a FØR NFD).

UPSERT til Supabase REST:
```
POST {SUPABASE_URL}/rest/v1/customers
Headers: Prefer: resolution=merge-duplicates
Body: { "id": "{slug}", "name": "{kundenavn}" }
```

### Steg 3: Opprett prosjekt

```
URL slug: slugify(hotellnavn)
Container ID: "{customerId}_{urlSlug}"
Short ID: nanoid(7)  — bruk: import { nanoid } from "nanoid"
```

INSERT til `projects`-tabellen via Supabase REST med alle felter:
- `id` (= container ID)
- `customer_id`
- `url_slug`
- `name` (hotellnavnet)
- `center_lat`, `center_lng`
- `short_id`
- `discovery_circles`: `[{"lat": {lat}, "lng": {lng}, "radiusMeters": {by-spesifikk radius}}]`

Feil med tydelig melding hvis prosjektet allerede eksisterer (UNIQUE constraint).

### Steg 4: Opprett produkter

Generer to product IDs med `crypto.randomUUID()`.

UPSERT begge produkter til `products`-tabellen:
```
Headers: Prefer: resolution=merge-duplicates
onConflict: project_id,product_type

Explorer: { id: "{explorerId}", project_id: "{containerId}", product_type: "explorer" }
Report:   { id: "{reportId}", project_id: "{containerId}", product_type: "report",
            config: { "reportConfig": {themes fra byhotell-profilen ovenfor} } }
```

Sett `config.reportConfig` med themes-arrayet fra byhotell-profilen. Explorer trenger ikke config.

### Steg 5: POI Discovery

Slå opp by-spesifikk radius fra per-by defaults (Steg 1 gir bynavn).

Kall import-API-et med circles-format:
```
POST http://localhost:3000/api/admin/import
{
  "projectId": "{containerId}",
  "circles": [{ "lat": {lat}, "lng": {lng}, "radiusMeters": {by-spesifikk radius} }],
  "categories": ["restaurant","cafe","bar","bakery","supermarket","pharmacy",
                  "gym","park","museum","library","shopping_mall","movie_theater",
                  "hair_care","spa"],
  "minRating": 3.5,
  "maxResultsPerCategory": 15,
  "includeEntur": true,
  "includeBysykkel": true
}
```

Import-API-et håndterer Google Places + Entur + Bysykkel parallelt, dedupliserer, og linker POI-er til `project_pois` automatisk.

**Validering:** Hvis færre enn 10 POI-er returneres, vis advarsel og foreslå å prøve med større radius.

### Steg 6: Link POI-er til produkter

Hent alle POI-er koblet til prosjektet:
```
GET {SUPABASE_URL}/rest/v1/project_pois?project_id=eq.{containerId}&select=poi_id
```

Link ALLE POI-er til begge produkter via `product_pois`:
```
POST {SUPABASE_URL}/rest/v1/product_pois
Headers: Prefer: resolution=merge-duplicates
Body: [{ product_id: "{explorerId}", poi_id: "{poiId}" }, ...] for alle POI-er
```

Gjenta for report-produktet med `{reportId}`.

### Steg 7: POI-scoring og featured-markering

Hent POI-data med rating og beregn gangtid:

```
GET {SUPABASE_URL}/rest/v1/pois?id=in.({kommaseparerte POI-IDer})&select=id,name,category_id,google_rating,google_review_count,lat,lng
```

For hver POI, beregn score med formelen fra `lib/utils/poi-score.ts`:
```
score = (rating × min(reviewCount / 50, 1.0)) + max(0, (15 - walkMin) / 15) × 0.5
```

Gangtid estimeres: `distanceMeters / 80` (80m/min gangfart).

**Featured-utvelgelse:**
- For hvert theme i byhotell-profilen, finn alle POI-er som tilhører theme-ets kategorier
- Velg den høyest-scorede POI-en per theme som featured
- Maks 2 featured fra samme kategori på tvers av alle themes

Marker featured POI-er:
```
PATCH {SUPABASE_URL}/rest/v1/product_pois?product_id=eq.{reportId}&poi_id=eq.{poiId}
Body: { "featured": true }
```

**Oppdater sort_order** basert på score (høyest først innen hvert theme):
```
PATCH {SUPABASE_URL}/rest/v1/product_pois?product_id=eq.{reportId}&poi_id=eq.{poiId}
Body: { "sort_order": {rank} }
```

### Steg 8: Populer product_categories for Explorer

Hent alle unike kategori-IDer fra POI-ene:
```
GET {SUPABASE_URL}/rest/v1/pois?id=in.({poiIds})&select=category_id
```

Insert til `product_categories` for Explorer-produktet:
```
POST {SUPABASE_URL}/rest/v1/product_categories
Headers: Prefer: resolution=merge-duplicates
Body: [{product_id: "{explorerId}", category_id: "{catId}", display_order: {n}}, ...]
```

### Steg 9: Google Photos for alle POI-er

Hent bilder for alle Google-POI-er i prosjektet via bulk fetch-photos API-et.

```
POST http://localhost:3000/api/admin/fetch-photos
{ "projectId": "{containerId}" }
```

API-et håndterer:
- Henter `photo_reference` fra Google Places for hver POI med `google_place_id`
- Bygger `featured_image`-URL automatisk
- Hopper over POI-er som allerede har `featured_image` (bevarer manuelt satt bilde)
- Returnerer `{ updated, skipped, failed, errors }`

**Validering:** Vis resultatet — forvent at de fleste Google-POI-er får bilde. POI-er uten tilgjengelige bilder fra Google er normalt (små/nye steder) og viser kategorifarge som fallback.

### Steg 10: Editorial Hooks med lokalt perspektiv (tospråklig)

For hver POI (unntatt transport: bus, train, bike, tram, parking):

1. Søk etter `"{poi.name} {poi.address}"` med WebSearch
2. Generer **norsk og engelsk** `editorialHook` og `localInsight` med lokalt perspektiv:

**Redaksjonell vinkel:** "Slik bruker lokalbefolkningen nabolaget."
- Tone: Monocle/Kinfolk — kort, opinionated, curated
- Dobbelt publikum: Hotellet (kjøper) og gjesten (leser)
- Regel: Aldri påstå noe som ikke kan verifiseres fra søkeresultat

**FERSKVARE-REGEL (KRITISK):** Aldri inkluder informasjon som kan bli utdatert. Feil info slår direkte tilbake på Placy og kunden.

| ALDRI bruk | Eksempel (feil) | Bruk i stedet |
|------------|------------------|---------------|
| Spesifikke priser | "Pizza til 159 kr" | "Kjent for god pizza til rimelig pris" |
| Åpningstider | "Åpent kl. 18–22" | "Populært for middag" |
| Tidsbegrensede tilbud | "Lunsjtilbud kl. 11–15" | "Godt lunsjsted" |
| Beliggenhet inne i bygg | "Inne i City Syd" | "I Kjøpmannsgata" (bruk faktisk adresse) |
| Spesifikke menyer | "Prøv dagens 3-retter til 495 kr" | "Kjent for sesongmenyen" |
| Spesifikke leveringstjenester | "Bestill via Wolt" | "Tilbyr levering" |

**Holdbar informasjon (bruk dette):**
- Etableringsår og historie ("Familiedrevet siden 1900")
- Kategori/kjøkkentype ("Trøndersk sushikjede", "Håndverksbakeri")
- Atmosfære og karakter ("Ujålete bar med lokal stamgjengfølelse")
- Nabolagskontekst ("Rett ved Torgkvartalet", "I Søndregata")
- Generelle tips uten tall ("Bestill bord i helgene", "Gå tidlig for best utvalg")

**editorialHook:** 1 setning. Lokal kontekst — historisk, kulturell, eller praktisk. Basert på WebSearch. Tidløs.
NO-eksempel: "Har servert kaffe på Bakklandet siden 2004. Fast stopp for lokale på vei til jobb."
EN-eksempel: "Serving coffee on Bakklandet since 2004. A regular stop for locals on their way to work."

**localInsight:** 1 setning. Praktisk tips fra insider-perspektiv. Uten tall/priser/tider.
NO-eksempel: "Bestill bord i helgene — populært blant lokale."
EN-eksempel: "Book a table on weekends — popular with locals."

3. PATCH POI-en med norsk tekst via Supabase REST: `editorial_hook` og `local_insight`
4. Lagre engelsk tekst i `translations`-tabellen:
```
POST {SUPABASE_URL}/rest/v1/translations
Headers: Prefer: resolution=merge-duplicates
Body: [
  { "locale": "en", "entity_type": "poi", "entity_id": "{poiId}", "field": "editorial_hook", "value": "{EN editorialHook}" },
  { "locale": "en", "entity_type": "poi", "entity_id": "{poiId}", "field": "local_insight", "value": "{EN localInsight}" }
]
```
5. Hopp over POI-er som allerede har `editorial_hook`
6. Vis progress: `[15/42] Generating hook for Havfruen...`

### Steg 11: Report-intro og bridgeText per theme (tospråklig)

Generer tekster som gjør rapporten stedsspesifikk — **på norsk og engelsk**.

**Kontekst for generering:**
- Hotellnavn: {hotellnavn}
- Bydel/område: (utled fra geocode place_name)
- By: {bynavn}
- POI-oversikt per theme: navn, rating, gangtid

**1. heroIntro** — 2-3 setninger. Kort, confident, stedsspesifikk. Nevn bydel.

NO-eksempel: "Scandic Nidelven ligger midt i Trondheims historiske sjøfartsmiljø. Nabolaget byr på byens beste restaurantscene, levende kulturliv og korte avstander til alt du trenger."
EN-eksempel: "Scandic Nidelven sits in the heart of Trondheim's historic maritime quarter. The neighborhood offers the city's best restaurant scene, vibrant cultural life, and short distances to everything you need."

**2. bridgeText per theme** — 1-2 setninger. Kontekstuell overgang. Nevn faktiske POI-er.

NO-eksempel (Mat & Drikke): "Fra prisbelønte Credo til den lokale favoritten Bakklandet Skydsstation — matscenen rundt hotellet spenner fra fine dining til upretensiøs hverdagskos."
EN-eksempel (Food & Drinks): "From award-winning Credo to local favorite Bakklandet Skydsstation — the food scene around the hotel ranges from fine dining to unpretentious everyday comfort."

**Prompt-mal:**
```
Du skriver tekster for en nabolagsrapport fra perspektivet til en som kjenner {bydel} godt.
Tone: Kort, confident, som Monocle/Kinfolk. Anbefaling, ikke Wikipedia.
Regel: Nevn kun steder og fakta som finnes i POI-listen nedenfor.

Hotell: {hotellnavn}
Bydel: {bydel}
By: {by}

POI-er i denne kategorien:
{poi-liste med navn, rating, gangtid}

Generer på NORSK:
1. heroIntro (kun for første kall): 2-3 setninger om nabolaget som helhet
2. bridgeText for theme "{theme.name}": 1-2 setninger, nevn 1-2 konkrete steder

Generer deretter samme tekster på ENGELSK:
1. heroIntro_en
2. bridgeText_en
```

**Lagre norsk:**
- heroIntro → PATCH Report-produktet: `config.reportConfig.heroIntro`
- bridgeText → PATCH Report-produktet: `config.reportConfig.themes[i].bridgeText`

```
PATCH {SUPABASE_URL}/rest/v1/products?id=eq.{reportId}
Body: { "config": {oppdatert config med heroIntro og bridgeTexts} }
```

**Lagre engelsk i translations-tabellen:**
```
POST {SUPABASE_URL}/rest/v1/translations
Headers: Prefer: resolution=merge-duplicates
Body: [
  { "locale": "en", "entity_type": "report", "entity_id": "{reportId}", "field": "hero_intro", "value": "{EN heroIntro}" },
  { "locale": "en", "entity_type": "theme", "entity_id": "{themeId}", "field": "bridge_text", "value": "{EN bridgeText}" }
]
```

Gjenta for alle themes.

### Steg 12: Revalidate cache + valider

Revalider Next.js-cachen:
```
POST http://localhost:3000/api/admin/revalidate
{ "paths": ["/admin/projects", "/admin/projects/{shortId}", "/{customerId}/{urlSlug}"] }
```

Valider at URL-ene fungerer:
```
Explorer: http://localhost:3000/{customerId}/{urlSlug}/explore
Report: http://localhost:3000/{customerId}/{urlSlug}/report
Admin: http://localhost:3000/admin/projects/{shortId}
```

### Steg 13: QA-sjekk

Verifiser resultatet og vis rapport.

**Sjekk 1: POI-dekning**
- Hent POI-er per theme fra Report-produktet
- Alle themes skal ha minst 2 POI-er
- Vis: `✅ POI-dekning: 5/5 themes har POI-er (totalt 38)`

**Sjekk 2: Bilde-dekning**
- Alle featured POI-er (fra Steg 7) bør ha `featured_image`
- Vis: `✅ Bilder: 7/7 featured POI-er har bilde` eller `⚠️ Bilder: 5/7 featured mangler bilde`

**Sjekk 3: Tekst-dekning**
- Alle ikke-transport POI-er bør ha `editorial_hook`
- Vis: `✅ Tekst: 35/35 POI-er har editorialHook` eller `⚠️ Tekst: 3 POI-er mangler editorialHook`
  - List manglende POI-er med navn

**Sjekk 4: Report-tekster**
- heroIntro skal være satt
- Alle themes skal ha bridgeText
- Vis: `✅ Report-tekster: heroIntro + 5/5 bridgeTexts`

**Sjekk 5: Oversettelser (EN)**
- Hent antall translations med locale="en" for dette prosjektet
- Sammenlign med forventet antall (POI editorial_hooks + theme bridgeTexts + heroIntro)
- Vis: `✅ Oversettelser: 43/43 EN translations lagret` eller `⚠️ Oversettelser: 38/43 EN — 5 mangler`

**Output-format:**
```
QA-sjekk:
✅ POI-dekning: 5/5 themes har POI-er (totalt 38)
✅ Bilder: 7/7 featured POI-er har bilde
⚠️  Tekst: 3 POI-er mangler editorialHook
   - park-bakklandet
   - supermarket-rema-1000-2
   - gym-sats-midtbyen
✅ Report-tekster: heroIntro + 5/5 bridgeTexts
✅ Oversettelser: 43/43 EN translations lagret

Vil du at jeg fikser advarslene?
```

Hvis brukeren sier ja, fiks:
- Manglende editorialHook → Kjør Steg 10 for de spesifikke POI-ene
- Manglende bilder → Kjør Steg 9 for de spesifikke POI-ene
- Manglende bridgeText → Kjør Steg 11 for manglende themes
- Manglende EN translations → Kjør Steg 10/11 for de spesifikke entitetene

## Output

Vis en oppsummering med:
- Kundenavn og slug
- Prosjektnavn og bynavn
- Antall POI-er totalt og per kategori
- Antall featured POI-er
- Radius brukt
- Explorer-URL, Report-URL, og Admin-URL

## Referanser

- Import API: `app/api/admin/import/route.ts`
- POI scoring: `lib/utils/poi-score.ts`
- Slugify: `lib/utils/slugify.ts`
- Revalidate: `app/api/admin/revalidate/route.ts`
- Report themes: `components/variants/report/report-themes.ts`
- Report data: `components/variants/report/report-data.ts`
- GeoJSON gotcha: Koordinater er `[lng, lat]`, reverser til `{ lat, lng }`
- Translations: `lib/supabase/translations.ts` — translation CRUD
- i18n strings: `lib/i18n/strings.ts` — UI string dictionary
- Category fallback: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`
- Nanoid short URLs: `docs/solutions/ux-improvements/nanoid-short-urls-admin-projects-20260205.md`
