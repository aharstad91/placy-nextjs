---
title: "feat: Midtbyen-demo — 147 sentrumsbutikker på nivå-1 nabolagsflaten, forankret på Torvet"
type: feat
status: complete
date: 2026-08-06
origin: docs/strategy/2026-08-06-midtbyen-side-gig-og-citymapper-innsikten.md
---

# feat: Midtbyen-demo

## Overview

En **demo Andreas kan vise fram**: de 147 butikkene på `midtbyen.no/shopping`
plassert på Placys nivå-1 mobil-nabolagsflate, forankret på et fast punkt på
**Torvet**. Ingen database, ingen sync, ingen cron, ingen SEO-sider. Dataene
hentes én gang, berikes én gang, og sjekkes inn som en JSON-fil i repoet.

Dette er en scope-reduksjon av
`docs/plans/2026-08-06-001-feat-midtbyen-butikkart-plan.md` (nå `superseded`).
Den planen beskriver den **salgbare** leveransen — skjema, diff, SEO, cron. Det
som er beholdt herfra er de verifiserte fakta om kilden; resten er lagt til side
til en kunde har sagt ja.

Poenget med demoen er å ha noe konkret i hånda i et møte. De dynamiske delene
(ukentlig oppdatering, endringsfeed, engelsk, QR) **nevnes muntlig**, ikke
demonstreres.

## Problem Frame

`midtbyen.no/shopping` presenterer 147 virksomheter som en **alfabetisk
tekstliste** — navn, adresse, en Google Maps-lenke, en nettside-lenke — med 28
kategorifiltre og et Midtbykort-filter. Det finnes **ikke noe kart**.

Filtrerer man til «Klær», får man ~20 navn man ikke kan plassere i forhold til
hverandre eller til seg selv. Katalogen svarer på *hvem*, aldri på *hvor*.

Demoen skal vise nøyaktig det gapet lukket, på den flaten Placy allerede har:
kart øverst, dragbar sheet under, kategorikort som åpner en liste sortert etter
gangtid fra Torvet.

## Verifiserte fakta (2026-08-06)

Målt, ikke antatt. Implementeringen skal ikke re-utlede dem.

| Fakta | Verdi |
|---|---|
| Antall oppføringer | **147** («Vis mer» er uttømt etter ett klikk) |
| Tilgjengelighet | Alle 147 ligger i **rå-HTML fra et vanlig GET** — ingen headless browser |
| Feltdekning | 147/147 har adresse, kart-lenke og nettside |
| Midtbykort | 140/147 tar kort (`data-card="accepts"`) |
| Kategorier | 28 filtre, term-IDer i `input[name="categories[]"]`, per butikk i `data-terms` |
| Kart-lenkeformater | 113 `goo.gl/maps`, 25 `maps.app.goo.gl`, 9 `g.page/…?share` |
| Koordinatkilde | Redirect fra kart-lenken inneholder `!3d<lat>!4d<lng>` **og** Google feature-ID `!1s0x…:0x…` |

Oppføringens form:

```html
<article class="store accepts" data-terms="[22,23,24,13,21,20]"
         data-card="accepts" data-digicard="accepts-digi">
  <h2>Aagaard siden 1876</h2>
  <div class="address">Dronningens gate 9</div>
  <div class="markers">
    <a class="location" href="https://goo.gl/maps/MYDvf4kZs4474AQcA"></a>
    <a class="webpage" href="https://www.aagaard1876.no/"></a>
  </div>
  <p>Tar Midtbykort</p>
</article>
```

Merk: `data-terms` inneholder også termer som ikke er kategorifiltre (bl.a. `13`,
som står på alle). Kun IDer som finnes blant de 28 filtrene skal tolkes som
kategori.

## Requirements Trace

- **R1** — `/midtbyen` viser 147 butikker på kart med et fast ankerpunkt på
  Torvet, på Placys **nivå-1 mobil-nabolagsflate** (kart + dragbar sheet +
  kategorikort + kategoriside)
- **R2** — **Ingen** omvisning/voice-over-element noe sted på flaten
- **R3** — Lista i sheeten sorteres etter **ekte gangtid fra Torvet**, ikke
  vilkårlig rekkefølge
- **R4** — De 28 kildekategoriene grupperes til et antall en besøkende orker å
  lese, uten at én eneste butikk faller ut
- **R5** — All data er **statisk i repoet**. Ingen database, ingen runtime-fetch
  mot `midtbyen.no` eller Google, ingen cron
- **R6** — Butikkens Midtbykort-status, nettside og åpningstider ligger på
  punktet der de finnes *(delvis levert: Midtbykort-statusen vises i
  kart-popupen, åpningstidene lagres men rendres av ingen montert komponent —
  se korreksjonen av D8)*
- **R7** — Flaten er brukbar på mobil (390×844) uten horisontal scroll og uten
  konsollfeil

## Scope Boundaries

**Ikke i denne planen:**

- **Database.** Ingen migrasjon, ingen `midtbyen`-skjema, ingen Supabase-rader.
  Skjemabeslutningen fra den supersederte planen står, men trengs først når
  leveransen faktisk selges.
- **Sync, cron og endringsfeed.** Demoen er et frosset øyeblikksbilde.
- **SEO-sider per butikk/kategori.** Hele argumentet for egen renderingsstrategi
  (strategidokumentets §2a) gjelder den salgbare leveransen.
- **Engelsk.** `components/variants/report/board/` har null i18n-bruk i dag.
  Ekte arbeid, ikke et flagg — skal ikke loves i møte.
- **QR-forankring per butikk.** Maskineriet finnes på umergede
  `feat/megler-self-serve`. Fase 2 hos kunden.
- **Midtbykort-filter og -pitch som produktflate.** Statusen *vises* (R6), men
  det bygges ingen kommersiell flate rundt den.
- **Promotering til Moat 1.** Ingenting flyter fra denne JSON-fila inn i `v2`.
- **Sircon.** Eksplisitt lagt bort av Andreas.

### Deferred to Separate Tasks

- **Den salgbare leveransen** (skjema/migrasjon 083, diff+publisering, SEO-flate,
  ukentlig cron): beskrevet i
  `docs/plans/2026-08-06-001-feat-midtbyen-butikkart-plan.md`, Unit 1/3/6/7.
  Tas opp igjen når MM har sagt ja.
- **`editorialHook` brukt som bærer for Midtbykort/nettside** (se D7): en
  demo-snarvei. Skal erstattes av et eget felt hvis leveransen selges.

## Key Technical Decisions

**D1 — Demoen går via `project`, IKKE via `boardData`-proppen. Dette snur
gjenbruksfunnet i den supersederte planen.**

Den supersederte planen pekte på event-ruta
(`app/event/[customer]/[project]/board/page.tsx`) som mønster: bygg `BoardData`
med en adapter og send den inn som eksplisitt prop. Verifisert i koden i dag
holder ikke det for dette formålet:

- `ReportReelsPage` setter `const eventMode = inputBoardData !== undefined`
  (`components/variants/report/reels/ReportReelsPage.tsx:180`)
- På mobil gjelder `if (eventMode && eventFilter) return <EventMobileSheet …>`
  (samme fil, ~linje 803). `eventFilter` er en hook-retur og alltid truthy.

→ Sender vi `boardData`, får vi **event-sheeten**, ikke nabolagsflaten. Andreas
ba eksplisitt om nivå-1-flaten (skjermbildet av Wesselsløkka-boardet). Derfor
konstruerer vi et `Project` og lar `ReportReelsPage` kjøre `transformToReportData`
selv — ingen `boardData`-prop.

**D2 — Fast anker på Torvet.** `centerCoordinates` ≈ `{ lat: 63.4305, lng: 10.3951 }`
(verifiseres mot kart i Unit 4). Ankeret er ikke kosmetikk: hele nivå-1-flatens
avstands- og gangtidslogikk måler fra `centerCoordinates`.

**D3 — Gangtid må precomputes, ellers er lista meningsløs.**
`lib/board/neighbourhood-list.ts` sorterer på `poi.raw.travelTime.walk` og faller
tilbake til `Infinity` når feltet mangler. Er feltet tomt på alle 147, blir
rekkefølgen input-rekkefølgen — alfabetisk. Det ville sett ut som en bug i
demoen. Gangtidene beregnes derfor én gang med Mapbox Matrix og lagres i JSON.

**D4 — Omvisning-pilla forsvinner av seg selv.** VO-elementet er gatet på
tilstedeværelse av spillbar lyd (`isPlayableAudio` → `firstAudioBearingIndex`).
Uten audio blir `hasAudioMobile` false, som både fjerner pilla og **aktiverer**
nabolagsflaten (`neighbourhoodSurface = !hasAudioMobile && boardRevealed`). R2 og
R1 leveres altså av samme fravær. Ingen ny flagg-kode.

**D5 — Ingen database i det hele tatt.** Prinsippet Andreas satte («i database
bør vi helt klart skille mellom produktene vi har og enkeltleveranser»)
respekteres strengest ved å ikke skrive noe. `stores.json` i repoet er
opprydningen: slett fila og mappa.

**D6 — Kategoriene uttrykkes som `reportConfig.themes`.** `getReportThemes`
(`components/variants/report/report-themes.ts:44`) lar `project.reportConfig.themes`
definere temasettet fritt og merger over bransjeprofilens base per id. Unngå
tema-id-en `"opplevelser"` — den står i `GLOBAL_DISABLED_REPORT_THEMES` og ville
blitt filtrert bort uten feilmelding.

**D7 — Midtbykort og nettside bæres av `editorialHook` i demoen.**
`adaptPOI` bygger `BoardPOI.body` fra `editorialHook` + `localInsight`;
`description` rendres ikke. For å få «Tar Midtbykort» synlig uten å endre
board-komponentene legges det i `editorialHook`. Bevisst snarvei, oppført under
Deferred.

**D8 — ~~Åpningstider vises faktisk.~~ FEIL, korrigert under implementering.**

Planen påsto at `components/variants/report/MapPopupCard.tsx:69` rendrer
åpningstidene. Komponenten *leser* riktignok feltet — men den **rendres ingen
steder**. Den er død kode, og det ble ikke sjekket før planen ble skrevet.
Konsekvensen: åpningstidene lagres på riktig form, men ingen montert komponent
viser dem i dag. Mobilflatens rader er ikke-interaktive før Fase 2 av
nabolagsflaten, og `BoardPOIMiniPopup` (desktop) viser navn, adresse og body —
ikke åpningstider.

Feltet fylles likevel: formen er riktig, oppslaget er gratis mens vi uansett
slår opp stedet for koordinat og place-ID, og Fase 2s utvidbare rad vil trenge
det. Men det skal **ikke** framstilles som en synlig egenskap ved demoen.

## Open Questions

### Resolved During Planning

- **Event-flate eller rapport-flate?** Rapport (D1) — event-stien gir feil
  mobilflate.
- **Trengs en v2-rad?** Nei. `Project` har ni konstruerbare felter og
  `transformToReportData` tar et rent objekt.
- **Rendres åpningstider noe sted?** Ja, i kart-popupen (D8).
- **HTML-parser?** `cheerio` ligger allerede i `dependencies` — ingen ny avhengighet.
- **Hvor kommer gangtidene fra?** `calculateTravelTimes` i
  `lib/pipeline/travel-times.ts` er eksportert og Supabase-fri; kan kalles rett
  fra et script.

### Deferred to Implementation

- **Nøyaktig gruppering av de 28 kategoriene.** Forslaget i Unit 3 er et
  utgangspunkt; den endelige inndelingen tas når butikkene ligger på skjerm.
  Kravet (R4) er at ingen butikk faller ut, ikke hvilke bøtter som velges.
- **Om `transformToReportData` er fiendtlig mot ukjente tema-IDer.** Den kjører
  bl.a. `getHeroInsightPOIIds(theme.id, …)` og skolekrets-filtrering. Antakelsen
  er at ukjente IDer degraderer pent (faller til `topRanked`). Blir det ikke
  slik, er reserveløsningen å gjenbruke **kanoniske** tema-IDer (`mat-drikke`,
  `hverdagsliv`, `handel` …) og bare overstyre `name` — samme visuelle resultat.
- **Om Places `searchText` treffer riktig butikk på navn + adresse.** Antatt høy
  treffrate i et lite sentrum; oppslag uten entydig treff droppes hellere enn å
  gjettes (Unit 2).

## High-Level Technical Design

> *Dette illustrerer den tiltenkte formen og er retningsgivende for review, ikke
> en implementasjonsspesifikasjon. Den implementerende agenten skal behandle det
> som kontekst, ikke som kode å reprodusere.*

```
BYGGETID (kjøres én gang, manuelt)
  midtbyen.no/shopping ──GET──► cheerio-parse ──► 147 oppføringer
                                                     │
                    maps-lenke ──302──► !3d/!4d ──► lat/lng + feature-ID
                                                     │
                                              stores.raw.json        [Unit 1]
                                                     │
        Places searchText ──► place_id ──► details ──► åpningstider, rating
        Mapbox Matrix (origo = Torvet) ─────────────► walk-minutter
                                                     │
                                                stores.json          [Unit 2]
                                          (sjekkes inn i repoet)

KJØRETID (ren lesing, ingen API-kall)
  stores.json ──► kategori-mapping (28 → ~8)                         [Unit 3]
              ──► buildMidtbyenProject(): Project                    [Unit 4]
                     · centerCoordinates = Torvet
                     · reportConfig.themes = gruppene
                     · pois[].travelTime.walk = precomputet
                     · ingen audio  ──► ingen VO-pill, nabolagsflate på
                     │
                     ▼
  app/midtbyen/page.tsx ──► <ReportReelsPage project={…} />          [Unit 5]
                              (INGEN boardData-prop — se D1)
```

## Implementation Units

- [x] **Unit 1: Hent og parse `midtbyen.no/shopping` → `stores.raw.json`**

**Goal:** 147 oppføringer med koordinater ligger som en fil i repoet, hentet én
gang, uten browser og uten database.

**Requirements:** R1, R5

**Dependencies:** Ingen

**Files:**
- Create: `scripts/midtbyen/fetch-stores.ts`
- Create: `lib/gigs/midtbyen/parse-stores.ts`
- Create: `lib/gigs/midtbyen/parse-stores.test.ts`
- Create: `lib/gigs/midtbyen/__fixtures__/shopping-page.html` (lagret utdrag av kilden)
- Create: `lib/gigs/midtbyen/stores.raw.json` (generert output, sjekkes inn)

**Approach:**
- `GET https://midtbyen.no/shopping/` med vanlig `fetch` og ærlig User-Agent.
- Parse med `cheerio` (allerede i `dependencies`): `article.store` → navn (`h2`),
  adresse (`.address`), kart-lenke (`a.location`), nettside (`a.webpage`),
  `data-terms`, `data-card`, `data-digicard`. Kategorinavn og term-IDer leses fra
  `input[name="categories[]"]`.
- **Koordinater:** følg redirect på kart-lenken (alle tre formater) og trekk ut
  `!3d<lat>!4d<lng>` samt feature-ID `!1s0x…:0x…`. Moderat parallellitet med
  `p-limit` (allerede i `dependencies`), som resten av repoet gjør.
- Parse-logikken bor i `lib/`, ikke i scriptet — det er den som testes.
- Oppføringer uten koordinat skrives ut eksplisitt i konsollen, aldri stille
  droppet.

**Patterns to follow:** `lib/pipeline/import-pois.ts` for script-/lib-delingen og
fail-soft-loggingen. `scripts/load-env.ts` for env-lasting.

**Test scenarios:**
- *Happy path:* fixture med 3 `article.store` → 3 parsede oppføringer med riktig
  navn, adresse, maps-URL, nettside og `acceptsCard`
- *Happy path:* filter-inputene i fixturen → 28 kategorier med `{termId, label}`
- *Edge case:* oppføring uten `a.webpage` → `websiteUrl` undefined, ingen kast
- *Edge case:* `data-terms="[13,22]"` hvor `13` ikke er blant filtrene → kun `22`
  beholdes som kategori
- *Edge case:* oppføring med tomt `data-terms="[]"` → beholdes med tom
  kategoriliste, faller ikke ut av settet
- *Happy path:* redirect-URL-utdrag for alle tre lenkeformater → riktig lat/lng
  og feature-ID
- *Error path:* redirect-URL uten `!3d`/`!4d` → koordinat null, oppføringen
  beholdes med et navngitt varsel

**Verification:**
- `stores.raw.json` inneholder 147 oppføringer
- Minst 140 har koordinat; de uten er listet ved navn i kjøreloggen
- `npm test` grønn for `parse-stores.test.ts`

---

- [x] **Unit 2: Berik med åpningstider og gangtid fra Torvet → `stores.json`**

**Goal:** Hver butikk har det den trenger for å bli en POI som ser levende ut:
gangminutter fra Torvet, og åpningstider der Google kjenner stedet.

**Requirements:** R3, R5, R6

**Dependencies:** Unit 1

**Files:**
- Create: `scripts/midtbyen/enrich-stores.ts`
- Create: `lib/gigs/midtbyen/stores.json` (generert output, sjekkes inn)
- Create: `lib/gigs/midtbyen/types.ts`

**Approach:**
- **Place-ID:** Places API (New) `places:searchText` med `navn + adresse +
  " Trondheim"`. Auth i `X-Goog-Api-Key`-header, aldri i querystring
  (CLAUDE.md). Uten entydig treff → ingen place-ID, ingen gjetting.
- **Detaljer:** for hver funnet place-ID hentes `regularOpeningHours`,
  `rating`, `userRatingCount` via samme klient-form som
  `lib/google-places/fetch-place-details.ts`. Resultatet normaliseres til
  `openingHoursJson.weekday_text` — formen `MapPopupCard` faktisk leser (D8).
- **Gangtid:** `calculateTravelTimes` fra `lib/pipeline/travel-times.ts` med
  origo = Torvet og alle koordinatsatte butikker som destinasjoner. Modulen
  batcher selv til 24 destinasjoner per kall og returnerer **minutter**. Ingen
  Supabase-skriving — kun retur-verdien brukes.
- Berikelsen er **fail-soft per butikk**: manglende place-ID eller
  API-feil gir en butikk uten åpningstider, aldri en avbrutt kjøring.
- Scriptet er idempotent og kan kjøres på nytt uten å ødelegge fila.

**Patterns to follow:** `lib/google-places/fetch-place-details.ts` (Places (New)
+ header-auth + field mask), `lib/pipeline/travel-times.ts` (batching,
minutt-kontrakten), `scripts/refresh-opening-hours.ts` (batch-rytme og
throttling — men **ikke** dens legacy-endepunkt i querystring-form).

**Test scenarios:**
- *Happy path:* normalisering av et `regularOpeningHours`-svar → sju strenger i
  `weekday_text`, i ukedagsrekkefølge
- *Edge case:* butikk uten koordinat → utelates fra Matrix-kallet, beholdes i
  fila uten `walkMinutes`
- *Error path:* `searchText` uten treff → butikken beholdes uten place-ID,
  åpningstider og rating utelates, kjøringen fortsetter
- *Error path:* HTTP 429/5xx fra Places på én butikk → den butikken mangler
  berikelse, de øvrige beriket
- *Edge case:* Matrix returnerer null-durasjon for en destinasjon →
  `walkMinutes` utelates i stedet for å settes til 0

**Verification:**
- `stores.json` har 147 oppføringer
- ≥ 95 % har `walkMinutes`; ingen har `walkMinutes: 0`
- Antall med åpningstider rapporteres eksplisitt i kjøreloggen
- Ingen API-nøkkel forekommer i noen logget URL

---

- [x] **Unit 3: Kategori-gruppering — 28 kildekategorier til besøkendes språk**

**Goal:** Et kategorisett en besøkende orker å lese, uten at én butikk faller ut.

**Requirements:** R4

**Dependencies:** Unit 1 (term-IDene finnes)

**Files:**
- Create: `lib/gigs/midtbyen/categories.ts`
- Create: `lib/gigs/midtbyen/categories.test.ts`

**Approach:**
- En eksplisitt mapping `termId → gruppe`, der hver gruppe har `id`, `label`,
  `icon` (Lucide-navn) og `color` (hex) — de fire feltene `BoardCategory` og
  `ReportThemeConfig` faktisk trenger.
- Utgangspunkt (justeres når dataene er på skjerm, jf. Open Questions):
  Klær & mote · Mat & drikke · Interiør & hjem · Helse & velvære ·
  Sport & fritid · Bøker, gaver & hobby · Tjenester · Annet.
- **«Annet» er obligatorisk, ikke en rest.** En butikk med tomt `data-terms`
  eller en ukjent term skal havne der. Stille bortfall er den ene feilen R4
  forbyr.
- Ren datamodul uten React og uten I/O — derfor lett å teste uttømmende.

**Patterns to follow:** `lib/themes/bransjeprofiler.ts` for form på
tema-definisjoner (id/name/icon/color/categories).

**Test scenarios:**
- *Happy path:* alle 28 term-IDer har en gruppe
- *Happy path:* hver gruppe har ikke-tom `label`, `icon` og gyldig hex-`color`
- *Edge case:* butikk med tomt `data-terms` → «Annet»
- *Edge case:* ukjent term-ID → «Annet», ikke kast og ikke stille bortfall
- *Integration:* summen av butikker over alle grupper (uten dobbelttelling) er
  147 — kjørt mot ekte `stores.json`, ikke mot en fixture
- *Edge case:* butikk i flere kildekategorier som mapper til samme gruppe telles
  én gang i den gruppen

**Verification:**
- Kjørt mot `stores.json`: 147 av 147 plassert, 0 i limbo
- Ingen gruppe er tom (tomme grupper ville blitt filtrert bort av
  `adaptBoardData` og gitt et kategorikort som ikke finnes)

---

- [x] **Unit 4: Adapter — `stores.json` → `Project` forankret på Torvet**

**Goal:** Et `Project`-objekt som rapport-pipelinen kan konsumere uten å vite at
det ikke kom fra Supabase.

**Requirements:** R1, R2, R3, R6

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `lib/gigs/midtbyen/build-project.ts`
- Create: `lib/gigs/midtbyen/build-project.test.ts`

**Approach:**
- Bygg `Project` med de ni påkrevde feltene: `id`, `name`, `customer`,
  `urlSlug`, `productType: "report"`, `centerCoordinates` (Torvet, D2), `story`,
  `pois`, `categories`.
- `reportConfig.themes` = gruppene fra Unit 3, hver med `categories` satt til
  gruppens egne POI-kategori-IDer. `district: "Midtbyen"`, `city: "Trondheim"`.
  **Ikke** bruk tema-id-en `"opplevelser"` (D6).
- Hver butikk → `POI` med `coordinates`, `address`, `category`,
  `travelTime: { walk }`, `openingHoursJson`, `googleRating`,
  `googleReviewCount`, `googlePlaceId` der de finnes.
- `editorialHook` settes til en kort faktalinje (Midtbykort-status + evt.
  nettside) — D7. **Presens, ingen årstall eller historikk** (redaksjonell
  regel fra 2026-06-10).
- **Ingen audio noe sted:** ingen `audio`, `welcomeAudio`, `heroAudio` eller
  `outroAudio`. Det er hele leveransen av R2 (D4) — ikke en glemsel som kan
  «fikses» senere.
- Butikker uten koordinat utelates fra `pois` (kartet kan ikke plassere dem), og
  antallet returneres/logges så det ikke forsvinner i stillhet.

**Patterns to follow:** `lib/event-board/event-board-data.ts` for
adapterformen og for hvordan tomme kategorier håndteres.
`lib/supabase/v2-queries.ts` for felt-for-felt-mappingen inn i `POI`/`Project`.

**Test scenarios:**
- *Happy path:* to butikker i to grupper → `Project` med to temaer og to POIer,
  riktig `category.id` per POI
- *Happy path:* `centerCoordinates` er Torvet, ikke første butikks koordinat
- *Happy path:* `travelTime.walk` fra `stores.json` havner på POIen (det er
  feltet `buildNeighbourhoodList` sorterer på — D3)
- *Edge case:* butikk uten koordinat → ikke i `pois`, telles i returverdien
- *Edge case:* butikk uten åpningstider → `openingHoursJson` undefined, ingen
  tom struktur som ville rendret et blankt åpent/stengt-felt
- *Error path:* `stores.json` med 0 oppføringer → `pois: []` og `categories: []`,
  ingen kast
- *Integration:* `transformToReportData(buildMidtbyenProject())` returnerer
  temaer med POIer i — verifiserer at ukjente tema-IDer overlever
  rapport-pipelinen (den antakelsen står under Deferred to Implementation)

**Verification:**
- `npx tsc --noEmit` grønn — `Project` og `POI` tilfredsstilt uten `as any`
- Ingen `audio`-felt i output (grep i testen, ikke bare øyemål)

---

- [x] **Unit 5: Ruta `/midtbyen`**

**Goal:** Flaten står, ser ut som nivå-1-nabolagsflaten, og har ingen
omvisning-pill.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 4

**Files:**
- Create: `app/midtbyen/page.tsx`
- Create: `app/midtbyen/layout.tsx` *(oppdaget under implementering: Mapbox-CSS
  lastes av en layout per rute-namespace — `app/event/layout.tsx`,
  `app/eiendom/layout.tsx`. Uten den rendres kartet uten kontroller.)*
- Test: `app/midtbyen/page.test.tsx`

**Approach:**
- Server component. Bygger `Project` med `buildMidtbyenProject()` og rendrer
  `<ReportReelsPage project={…} />`.
- **Ingen `boardData`-prop** — det er hele D1. Sendes den, bytter mobilflaten til
  event-sheeten.
- `export const metadata` (CLAUDE.md-krav). `export const dynamic` er unødvendig:
  ingen request-avhengig data, så ruta kan bli statisk.
- Ytre wrapper speiler event-ruta:
  `<div className="min-h-screen bg-background text-foreground">`.
- Ingen Supabase-kall, ingen `useEffect`-fetch, ingen `<img>`.

**Patterns to follow:** `app/event/[customer]/[project]/board/page.tsx` for
ruteformen og wrapperen — men **uten** `boardData`-linja.

**Test scenarios:**

Ruta er en tynn komposisjon, men den bærer D1 — og D1 er nettopp den slags
beslutning som regredierer stille: en senere «gjenbruk event-mønsteret»-endring
ville lagt til `boardData`, byttet mobilflaten til event-sheeten, og ingenting
ville feilet. Testene under er en vakt om akkurat den ene linja, ikke en
gjenfortelling av Unit 4.

- *Happy path:* ruta rendrer `ReportReelsPage` (mocket) med et `project` som har
  `pois.length > 0`
- *Integration (D1-vakt):* proppene `ReportReelsPage` mottar inneholder **ikke**
  `boardData` — assert på fravær, ikke på verdi
- *Happy path:* `metadata` er eksportert og har en ikke-tom `title`

**Verification:**
- Chrome mobil-emulering 390×844 på `/midtbyen`:
  - splash → «Utforsk nabolaget» → kart + dragbar sheet
  - **ingen «Omvisning»-pill noe sted**
  - kategorikort åpner kategoriside, tilbake gjenoppretter kameraet
  - lista re-scopes når kartet dras
  - et POI-trykk gir popup med åpningstider der de finnes
  - ingen horisontal scroll, **0 konsollfeil**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` grønne

## System-Wide Impact

- **Interaksjonsgraf:** Ruta er additiv. `ReportReelsPage`, `board-state`,
  `NeighbourhoodSurface` og `transformToReportData` konsumeres uendret — ingen
  fil under `components/variants/report/` skal endres. Endres en av dem, har
  planen bommet.
- **Uendrede invarianter:** Board-lesestien (`lib/supabase/v2-queries.ts`) er
  ikke berørt — demoen leser aldri Supabase, så CLAUDE.md-regelen om «eneste
  lesesti» brytes ikke (til forskjell fra den supersederte planen, som ville
  innført en ny).
- **Feilforplantning:** All feilhåndtering ligger i byggetids-scriptene. I
  kjøretid finnes ingen feilkilde utover en manglende fil, som er en byggefeil,
  ikke en runtime-feil.
- **Bundle:** `stores.json` importeres i en server component. Fila må ikke
  havne i klient-bundelen via en `"use client"`-kjede — verifiseres med
  `npm run build`.
- **Klientflate:** Ingen nye klientkomponenter, ingen ny Zustand-state.

## Risks & Dependencies

| Risiko | Håndtering |
|---|---|
| `boardData`-proppen sniker seg inn og gir event-sheeten på mobil | D1 er skrevet ned som en beslutning, ikke en detalj; Unit 5s verifisering ser etter fravær av omvisning-pill og nærvær av sheeten |
| Gangtidene mangler → alfabetisk liste som ser ut som en bug | D3 + eksplisitt verifiseringskrav på ≥ 95 % `walkMinutes` i Unit 2 |
| `transformToReportData` liker ikke ukjente tema-IDer | Integrasjonsscenariet i Unit 4 fanger det før ruta bygges; reserveløsningen (kanoniske IDer + overstyrt `name`) er beskrevet under Open Questions |
| `goo.gl`-lenker avvikles av Google | Koordinat og feature-ID lagres permanent i Unit 1; demoen slår aldri opp lenken på nytt |
| Places `searchText` treffer feil butikk | Uten entydig treff droppes berikelsen. En butikk uten åpningstider er greit; feil åpningstider i en demo er ikke |
| Demoen forveksles med et ferskt produkt | Dataene er frosset og skal omtales som det. Ferskhet er en muntlig fase-2-nevning, ikke noe flaten hevder |
| Leveransen blir liggende som gjeld | Opprydningen er `rm -rf lib/gigs/midtbyen app/midtbyen scripts/midtbyen` — ingen migrasjon å reversere |

## Documentation / Operational Notes

- Scriptene i `scripts/midtbyen/` er **manuelle engangskjøringer**. De skal ikke
  inn i `COMMANDS.md` som drift, men nevnes med et par linjer om hva de gjør og
  at outputen er sjekket inn.
- Ingen nye miljøvariabler: `GOOGLE_PLACES_API_KEY` og `NEXT_PUBLIC_MAPBOX_TOKEN`
  finnes allerede lokalt.
- Ingen deploy-avhengighet — ruta er statisk og følger vanlig Vercel-bygg.

## Verifisert 2026-08-06

**Datadekning**

| Mål | Resultat |
|---|---|
| Oppføringer parset | 147 / 147 |
| Koordinat | **147 / 147** (138 fra kart-lenken, 9 fylt av Places-oppslaget) |
| Gangtid fra Torvet | **147 / 147**, spenn 1–15 min |
| Åpningstider hentet | 138 / 147 |
| Kategorisert | 147 / 147 — 3 i «Annet», ingen tom gruppe |

Fordeling: Klær & mote 59 · Helse & velvære 23 · Interiør & hjem 22 ·
Sport & fritid 19 · Bøker, spill & hobby 18 · Annet 3 · Mat & drikke 3.

**Mekanisk:** `npm test` 1 815 tester / 144 filer grønne (71 nye i
`lib/gigs/midtbyen/` + 3 i `app/midtbyen/`), `npx tsc --noEmit` rent,
`npm run lint` 0 errors, `npm run build` grønn — `/midtbyen` prerendres som
**statisk** rute.

**Mobil 390×844, Chrome, fersk last:** splash → «Utforsk nærområdet» → kart med
148 markører (147 butikker + Torvet-ankeret) og dragbar sheet med sju
kategorikort. Kategoriside åpner med prosa og full gangtidssortert liste;
«Tilbake» gjenoppretter kameraet. Lista re-scopes ved kartbevegelse («4 av 18
synlig»). **Ingen omvisning-pill**, ingen horisontal scroll, **0 konsollfeil**.

### Funn som ikke ble endret

Alle tre ligger i delte komponenter og gjelder **hvert** VO-løst board, ikke bare
denne demoen. De er derfor rapportert, ikke lappet — å endre dem her ville
endret Wesselsløkka og alle andre nivå-1-boards i samme slengen.

1. **Splash-copyen lover en omvisning som ikke finnes.** «Vi tar deg med på en
   guidet tur gjennom nærområdet …» er bolig-defaulten i
   `components/variants/report/reels/MobileReportSplash.tsx:40`;
   `deriveSplashIntro` (`reels-data.ts:438`) returnerer `undefined` for alt som
   ikke er event/hotell/næring.
2. **«gangtid hjemmefra»** i `NeighbourhoodSurface.tsx:155` leser rart når
   ankeret er et torg og ikke en bolig.
3. **Megler-plassholderen på desktop.** «Ansvarlig megler — Kontaktinfo legges
   til per prosjekt» rendres fordi `noBrokers={eventMode}`
   (`ReportReelsPage.tsx:747`) undertrykker kortet KUN i event-modus. Mobilflaten
   er ren; det er bare desktop-sidebaren.

I tillegg: **`components/variants/report/MapPopupCard.tsx` er død kode** — den
importeres ingen steder. Den er kilden til D8-feilen over, og bør etter
kodebase-hygiene-regelen slettes i egen commit.

## Sources & References

- **Origin:** `docs/strategy/2026-08-06-midtbyen-side-gig-og-citymapper-innsikten.md`
- **Superseder:** `docs/plans/2026-08-06-001-feat-midtbyen-butikkart-plan.md`
  (verifiserte fakta beholdt derfra; skjema/diff/SEO/cron lagt til side)
- Flate-presedens: `app/event/[customer]/[project]/board/page.tsx`,
  `components/variants/report/board/neighbourhood/`
- Sorteringskontrakt: `lib/board/neighbourhood-list.ts`
- Gangtider: `lib/pipeline/travel-times.ts`
- Places-klient: `lib/google-places/fetch-place-details.ts`
- Popup-rendering av åpningstider: `components/variants/report/MapPopupCard.tsx`
