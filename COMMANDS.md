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

## Dekningsregnskap (postnummer → område → kunnskap)

### Importer postnummerområder fra Kartverket
```bash
npx tsx scripts/import-postal-areas.ts                 # dry-run FØRST
npx tsx scripts/import-postal-areas.ts --apply          # skriv
npx tsx scripts/import-postal-areas.ts --kommune 5001   # én kommune
```

Henter polygonene for hvert geografiske postnummer fra Kartverkets WFS
(`wfs.geonorge.no`, gratis, ingen API-nøkkel) og skriver dem til
`v2.postal_areas`. Dekker 114 postnumre: 105 i markedet (Trondheim 77,
Stjørdal 16, Melhus 8, Malvik 4) pluss Oppdal 7 og Inderøy 2 — de to siste
fordi vi allerede har kuraterte områder der som må kunne telles.

Antallet per kommune sammenlignes mot Brings postnummerregister og avvik
rapporteres. Kjøringen aborterer hvis en kommune gir 0 features: vi vet at alle
seks har postnumre, så 0 betyr endret API-kontrakt, ikke tomt datasett.

Idempotent — andre kjøring skal rapportere `0 nye, 0 endret`. Er det ikke
tilfelle, sammenligner endringssjekken to ulike formater av samme verdi
(det skjedde med `source_updated_at`, se migrasjon 087).

**Koordinatrekkefølge:** Kartverkets GML er EPSG:4258 med lat før lon, GeoJSON
vil ha `[lng, lat]`. Parseren snur parene og forkaster koordinater utenfor
Norges bbox — en ombyttet form kaster ellers ingen feil, den bare slutter å
treffe noe.

### Avled `areas.boundary` fra postnumre
```bash
npx tsx scripts/import-postal-areas.ts --derive-boundaries          # dry-run
npx tsx scripts/import-postal-areas.ts --derive-boundaries --apply  # skriv
```

Gir områder uten polygon en form: MultiPolygon av flatene til områdets
`postal_codes`. Ingen ekte union — flatene legges ved siden av hverandre, og
`pointInGeometry` itererer over alle, så treff-oppførselen er identisk uten at
vi trenger et polygon-clipping-bibliotek.

**Rører aldri et område som allerede har `boundary`.** Flere av de kuraterte har
en presis grense som er finere enn postnummerformen, og en avledning som
«forbedret» dem ville degradert kuratert arbeid. Kolonnen `boundary_source`
(migrasjon 088, utvidet i 089) skiller `curated`, `krets` og `derived`.

**Foretrekk skolekretsene der de finnes** — se neste seksjon. Postnummerformen
er en nødløsning for strøk uten krets, ikke førstevalget.

Skriver kun `boundary` og `boundary_source` — `areas` mangler `updated_at`, så
det finnes ingen optimistisk lås, og et smalt PATCH-felt er eneste beskyttelse
mot å klobbe `report_editorial` med en utdatert lesning.

**Kollisjoner:** flere strøk deler postnummer (Møllenberg, Rosenborg og
Solsiden er alle 7014). Avledet får de identisk form, og `findAreaForPoint`
bruker første treff — vilkårlig. Kjøringen rapporterer hver kollisjon. Det er
ufarlig så lenge områdene mangler `report_editorial`, men de trenger en tegnet
grense **før** de kureres.

### Sett ekte polygon fra Trondheims skolekretser
```bash
python3 scripts/extract-skolekrets-boundary.py --dump-all   # bare ved nye kretsdata
npx tsx scripts/apply-krets-boundaries.ts                   # dry-run
npx tsx scripts/apply-krets-boundaries.ts --apply           # skriv
```

Bytter avledet form mot Trondheim kommunes skolekretspolygoner (NLOD,
`data/geo/trondheim/barneskolekrets.json`, 43 kretser). Formen som ble avledet
av `postal_codes` arvet en gjetning: postnumrene i migrasjon 050 ble håndskrevet
sammen med senterkoordinater som beviselig bommer — Vikåsen sto med
63.4300/10.4800, utenfor hele VIKÅSEN-kretsen, og med postnummer 7040, som ikke
overlapper området i det hele tatt. Riktig svar er 7054.

`boundary_source` er derfor tredelt (migrasjon 089): `curated` > `krets` >
`derived`. Kuraterte polygoner røres aldri — Ranheims er krets **pluss**
adressekorreksjoner, og å skrive kretsen tilbake ville slettet dem.

Mappingen (`AREA_KRETS_MAP`) er bare direkte navnetreff. De 20 øvrige strøkene
(Bakklandet, Møllenberg, Moholt, Tiller, …) har ingen krets med samme navn, og
hvilken de hører til er kurators beslutning — de blir stående som `derived`.
Et område som vil ha en krets et kuratert område allerede eier blir hoppet over:
`sentrum` er kuratert som SINGSAKER + BISPEHAUGEN, så `singsaker` er blokkert.

**Overlapp-revisjon.** Kjøringen tester alle par av områder, ikke bare dem den
skriver, og skiller autoritative konflikter fra støy. To står igjen:
`charlottenlund ↔ ranheim` (Grilstadvegen 1A treffer begge — geofencen tar
første rad) og `vikasen ↔ ranheim`. Testpunktene trekkes 0,5 % innover i egen
form først; uten det melder hvert eneste naboområde falskt overlapp på delt
grense.

`--dump-all` skriver `data/geo/trondheim/kretser-wgs84.json`, som er committet
nettopp for at skrivestien ikke skal avhenge av pyproj. Kjør den bare hvis
kommunen leverer nye kretsdata.

### Utled `postal_codes` fra områdets form
```bash
npx tsx scripts/import-postal-areas.ts --suggest-postal-codes            # read-only
npx tsx scripts/import-postal-areas.ts --suggest-postal-codes --fra-form
npx tsx scripts/import-postal-areas.ts --suggest-postal-codes --fra-form --apply
```

Motsatt retning av avledningen over: leser områdets polygon og finner hvilke
postnumre som overlapper. Uten flagg er den read-only og ser bare på områder som
mangler `postal_codes` — den løser at et kuratert område med tom liste ellers er
usynlig i regnskapet (Straumen og Oppdal var i den situasjonen).

`--fra-form` snur rollene: postnummer blir **output**, ikke input. Den tar med
områder som allerede har en liste, krever at formen er autoritativ (`curated`
eller `krets`) og viser resultatet som en diff. En `derived`-form utelates fordi
den selv er avledet av postnumrene — å lese dem tilbake ut av den ville bare
bekreftet gjetningen.

Overlappet testes i to retninger fordi begge har en blindsone: postnummeret inn
i området (fanger delvis overlapp), og området inn i postnummeret (fanger et
lite strøk som ligger helt inne i ett stort postnummer). Begge bruker inntrukne
testpunkter, ikke ringpunktene rå — postnummer- og kretsgrenser er tegnet for
hver sin hensikt og krysser hverandre overalt.

**Terskel 15 %** på én av de to andelene. Uten den ble Ila foreslått med 13
postnumre, flere med ett eneste punkt innenfor. Treff under terskelen kastes
ikke, de rapporteres som svake. Metoden er fortsatt tilnærmet — et smalt
overlappsbånd kan overses.

### Dekningsrapport
```bash
npx tsx scripts/coverage-report.ts                # sammendrag
npx tsx scripts/coverage-report.ts --full         # hvert postnummer
npx tsx scripts/coverage-report.ts --kommune 5001
```

Read-only. Klassifiserer hvert postnummer i fire trinn:

| Status | Betyr |
|--------|-------|
| `ukjent` | Ingen `areas`-rad lister postnummeret |
| `geometri` | Område med polygon, men ikke alle seks temaer har tekst |
| `kuratert` | Alle seks bolig-temaer har redaksjonell tekst |
| `dekket` | `kuratert` **og** alle høydepunkt-POIer har brukbar tekst |

«Brukbar tekst» = `grounding.curated` (Placy-eid) eller `grounding.generated`
(leverandør-tekst som passerte kvalitetsporten før skriving).

Terskelen for høydepunkter er **1 per tema, ikke 4**. Transport har ett
høydepunkt i Straumen fordi Entur svarer på holdeplasser i sanntid — en terskel
på 4 ville gjort dekning uoppnåelig av en grunn som ikke er et hull. Kravet
ligger i stedet på at *alle* høydepunktene kurator har valgt, har tekst.

Rapporterer begge retninger av hull: postnumre uten område, **og** områder uten
postnummer. Det siste er hvordan Straumen og Oppdal ble oppdaget. Kjøringen
avbryter hvis statusene ikke summerer til antall postnumre — et tall der noe har
falt mellom kategoriene er ubrukelig som dekningsgrad.

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
