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

### Test på ekte iPhone (mobil-utvikling)
```bash
npm run dev:mobile
```
Binder dev-serveren til `0.0.0.0` og skriver ut LAN-URL-en (f.eks.
`http://192.168.68.60:3000`) som iPhone/iPad på samme nett kan åpne.
`allowedDevOrigins` i `next.config.mjs` regnes ut fra maskinens private
IPv4-adresser ved oppstart, så DHCP-bytte krever ingen redigering.

Full inspector på telefonen (erstatter incognito-/cache-dansen):
1. iPhone: **Innstillinger → Apper → Safari → Avansert → Web Inspector = på**
2. Mac Safari: **Innstillinger → Avansert → Vis funksjoner for nettutviklere**
3. Koble iPhone til Mac med kabel og godta «Stol på denne maskinen»
4. Åpne LAN-URL-en i **Safari på iPhone** (ikke Chrome — Chrome iOS kan ikke
   inspiseres, men bruker samme WebKit-motor, så Safari er identisk rendering)
5. Mac Safari: **Utvikle → \<iPhone\> → \<siden\>** — DOM, konsoll, nettverk,
   breakpoints og live CSS-editering mot ekte enhet
6. I inspektoren: **Nettverk → Deaktiver hurtigbuffer** — da slipper du
   incognito-vinduer

Fast Refresh virker over LAN: lagre i editoren → telefonen oppdaterer seg.
Trenger du å teste utenfor nettet (eller vise noen), kjør `ngrok http 3000`
— `*.ngrok-free.app` og `*.ngrok.app` står allerede i `allowedDevOrigins`.

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
### Utforsk-modalens innhold (per-POI grounding)

```bash
npx tsx scripts/ground-poi-content.ts <project_id>                     # dry-run FØRST
npx tsx scripts/ground-poi-content.ts <project_id> --apply             # skriv
npx tsx scripts/ground-poi-content.ts <project_id> --limit 5           # billig kalibrering
npx tsx scripts/ground-poi-content.ts <project_id> --min-sources 3     # juster porten
```

Dry-run skriver dekningsgrad, histogram og terskel-sensitivitet, pluss rådata til
`backups/` — så terskler kan re-evalueres offline uten å bruke Gemini-kvote på
nytt. Kjør ALLTID dry-run først: lav dekning er et pilot-funn som skal
omdirigere innsatsen, ikke oppdages i en kundedemo.

POI-er som ikke gir innhold får `grounding.lastAttempt` med utfallet lagret
(`no-data` / `refusal` / `error`). Uten det ville hver kjøring brent kvote på de
samme tomme stedene, og «aldri forsøkt» og «forsøkt, ingenting der» ville vært
samme tilstand i basen. `error` er transient og re-forsøkes straks; de to andre
holdes tilbake i 30 dager.

### Kuratér POI-tekst (Lokalkunnskap / Moat 1)

Steget etter grounding: det Google ikke fant, skriver vi selv.

```bash
npx tsx scripts/curate-pois.ts --list <project_id>                # lag arbeidsliste
npx tsx scripts/curate-pois.ts --file <staging.json>              # dry-run
npx tsx scripts/curate-pois.ts --file <staging.json> --yes        # skriv
```

`--list` skriver `data/pois/<project_id>.staging.json` med hvert POI som mangler
brukbar tekst, hvorfor, og faktaene vi alt eier som råstoff. Rekkefølgen er
kurateringsrekkefølgen: `strøk-porten` først (der finnes et forkastet narrativ å
skrive fra), så `no-data` (ekte Lokalkunnskap-arbeid), til sist `ingen-forsøk`
(kjør grounding-scriptet på dem først) og `error` (teknisk, ikke kurator-arbeid).
Kollektiv-holdeplasser markeres med `~` og legges sist — sanntid fra Entur er
svaret der — men droppes aldri stille fra lista.

Fyll `narrative` per POI og la resten stå tomme. `--list` kan kjøres på nytt uten
å miste tekst som alt er skrevet.

**Curated slår generated i modalen og vises uten Google-attribusjon** — teksten er
vår, ikke lånt. Den har verken kildekrav, 2-års lagringsgrense eller utløpsdato,
og `grounding.generated` bevares under den slik at en provider-swap fortsatt er
mulig. Et POI med kuratert tekst hoppes over av grounding-scriptet (`--force`
overstyrer).

```bash
npx tsx scripts/refresh-opening-hours.ts --project <project_id>          # dry-run
npx tsx scripts/refresh-opening-hours.ts --project <project_id> --apply  # skriv
```
Oppdaterer `opening_hours_json` fra Google Places API for POI-er med utdaterte data.

### Anbefalt vedlikeholdsplan
| Script | Frekvens | Estimert API-kost |
|--------|----------|-------------------|
| `refresh-photo-urls.ts` | Annenhver uke | ~500 Photo calls (~$1.50) |
| `refresh-opening-hours.ts` | Månedlig | ~500 Details calls (~$8.50) |
| `ground-poi-content.ts` | Ved nytt board / når innhold drifter | 1 Gemini grounding-kall per POI (78 POI-er ≈ innenfor gratiskvoten 1 500/dag) |
| `curate-pois.ts --list` | Etter hver grounding-kjøring | 0 (kun DB-lesing) |

**OBS før demo/visning:** kjør `refresh-photo-urls.ts`. lh3-CDN-URL-ene utløper
etter ~14 dager, og Utforsk-modalens bildekarusell skjuler seg selv ved
last-feil — den ser da bare tom ut, uten feilmelding.

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
