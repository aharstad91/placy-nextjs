---
title: "feat: Midtbyen butikkart — kart, søkbare sider og ukentlig sync for Midtbyen Management"
type: feat
status: superseded
date: 2026-08-06
origin: docs/strategy/2026-08-06-midtbyen-side-gig-og-citymapper-innsikten.md
---

> **SUPERSEDERT samme dag, før implementering.** Andreas skalerte scopet ned til
> en ren **demo**: ingen database, ingen sync, ingen cron, ingen SEO-sider.
> Åpningstider hentes én gang og lagres statisk. Flaten skal ligne **Placy nivå
> 1 mobil-nabolagsflate uten omvisning/voice-over**, forankret på et **fast
> ankerpunkt på Torvet**. En ny plan lages med `/ce-plan`.
>
> **Behold herfra:** «Verifiserte fakta»-tabellen, oppføringens HTML-form,
> risikoen rundt `goo.gl`-avvikling, og Scope Boundaries.
> **Ignorer herfra:** Unit 1 (skjema/migrasjon 083), Unit 3 (diff/publisering),
> Unit 6 (SEO), Unit 7 (cron/endringsfeed) — de hører til den salgbare
> leveransen, ikke demoen.
>
> **Gjenbruksfunn som ikke står nedenfor:** `app/event/[customer]/[project]/board/page.tsx`
> (143 linjer) bygger `BoardData` via adapter og sender den til `ReportReelsPage`
> som eksplisitt prop → event-modus undertrykker megler-/eiendoms-chrome
> automatisk. `Project` har ni konstruerbare felter, så demoen trenger ingen
> v2-oppføring. Omvisning-pilla er gatet på spillbar lyd og forsvinner av seg
> selv uten flagg.

# feat: Midtbyen butikkart

## Overview

Første leveranse i side-gig-sporet: et kart over de 147 butikkene Midtbyen
Management lister på `midtbyen.no/shopping`, filtrerbart på kategori og
Midtbykort, med søkemotorvennlige sider per butikk og per kategori, holdt ferskt
av en ukentlig sync mot deres egen side.

Leveransen bor i `app/midtbyen/` i dette repoet og har sitt **eget
Postgres-skjema** (`midtbyen`), adskilt fra produktskjemaet `v2`. Det er en
ratifisert beslutning, ikke en implementasjonsdetalj: enkeltleveranser til kunder
skal aldri blande seg med produktdataene, og en avsluttet avtale skal kunne
fjernes med én setning.

Arbeidet er delt i to faser. **Fase 1 (Unit 1–4)** henter dataene og tegner
kartet — nok til å vises fram og svare på om dette i det hele tatt er verdt et
møte. **Fase 2 (Unit 5–7)** gjør det til noe som kan faktureres: gruppering,
SEO-flate, cron og endringsfeed.

## Problem Frame

`midtbyen.no/shopping` presenterer 147 virksomheter som en **alfabetisk
tekstliste** — navn, adresse, en Google Maps-lenke, en nettside-lenke — med 28
kategorifiltre og et Midtbykort-filter. Det finnes **ikke noe kart**.

Filtrerer man til «Klær», får man ~20 navn man ikke kan plassere i forhold til
hverandre eller til seg selv. Samtidig er Midtbykortet MMs eget kommersielle
produkt, og bruken av det avhenger av at folk vet hvor det kan brukes. Katalogen
svarer på *hvem*, aldri på *hvor*.

## Verifiserte fakta (2026-08-06)

Disse er målt, ikke antatt. Implementeringen skal ikke re-utlede dem.

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

## Goals

| # | Mål | Leveres av |
|---|---|---|
| G1 | Se hvor butikkene faktisk ligger, og filtrere på det man er ute etter | R1, R2 |
| G2 | Holde seg fersk uten at MM gjør noe som helst | R3, R4 |
| G3 | Rangere i søk på «klesbutikk Trondheim sentrum» og lignende | R5 |
| G4 | Ikke forurense produktet — leveransen skal kunne slettes rent | R6 |
| G5 | Gi MM en løpende leveranse, ikke bare et engangskart | R7 |

## Requirements

- **R1** — Kart med 147 markører, filtrerbart på kategori og på Midtbykort
  (fysisk/digitalt), med liste som følger utsnittet
- **R2** — Kategoriene grupperes til et håndterbart antall for besøkende; ingen
  butikk skal falle ut av grupperingen
- **R3** — Ukentlig automatisk henting fra `midtbyen.no/shopping`, uten
  integrasjonsarbeid hos MM
- **R4** — Syncen skal aldri kunne tømme eller ødelegge et fungerende datasett;
  feil gir utdatert data, aldri tom side
- **R5** — Server-rendret, indekserbar side per butikk og per kategori, med
  sitemap og unik metadata
- **R6** — All data i eget skjema `midtbyen`, egen lesesti, ingen fremmednøkler
  mot `v2`, fjernbart med `DROP SCHEMA midtbyen CASCADE`
- **R7** — Endringshistorikk (nye/lukkede butikker) som kan leses ut som en
  periodisk oversikt

---

# Fase 1 — data i hus og et kart å vise fram

## Unit 1 — Skjema og migrasjon

**Goal:** `midtbyen`-skjemaet finnes i produksjon, med default-deny og uten
PostgREST-eksponering.

**Files**
- Create: `supabase/migrations/083_midtbyen_gig_schema.sql`

**Approach**

`CREATE SCHEMA midtbyen` med tre tabeller:

- `midtbyen.stores` — gjeldende tilstand. Felter: `id`, `match_key`, `name`,
  `address`, `maps_url`, `website_url`, `lat`, `lng`, `google_feature_id`,
  `accepts_card`, `accepts_card_digital`, `category_term_ids int[]`,
  `first_seen_at`, `last_seen_at`, `missing_runs int default 0`, `removed_at`
- `midtbyen.categories` — `term_id` PK, `label`, `group_key` (null i fase 1),
  `sort_order`
- `midtbyen.snapshots` — `id`, `fetched_at`, `source_url`, `entry_count`,
  `status`, `raw jsonb`

Ingen fremmednøkler mot `v2`. RLS på alle tre med default-deny, ingen
anon-policy, ingen grants til `anon`/`authenticated`. Skjemaet legges **ikke**
til i PostgREST-eksponerte skjemaer — lesing skjer med service-role fra server.

**Nummervalg:** 081 og 082 er brukt på den umergede `feat/megler-self-serve`
(`broker_offices`, `coverage_demand`). 083 unngår kollisjon ved merge.

**Patterns to follow:** `supabase/migrations/077_lukk_anon_select_board_tabeller.sql`
for RLS-formen, `supabase/migrations/070_baseline.sql` for tabellstil.

**Verification**
- Migrasjonen kjørt mot prod via psql (`supabase db push` virker ikke med vår
  nummerering — se CLAUDE.md)
- `\dn` viser `midtbyen`
- Anon-nøkkel mot `midtbyen.stores` gir feil, ikke tomt resultat

---

## Unit 2 — Hente-script

**Goal:** Ett kjør gir en fullstendig, koordinatsatt snapshot-rad uten å røre
`stores`.

**Files**
- Create: `scripts/midtbyen/fetch.ts`
- Create: `scripts/midtbyen/parse.ts`
- Create: `scripts/midtbyen/parse.test.ts`

**Approach**

1. `GET https://midtbyen.no/shopping/` med vanlig `fetch` og en ærlig
   User-Agent. Ingen browser.
2. Parse HTML → 147 oppføringer (navn, adresse, kart-lenke, nettside,
   `data-terms`, `data-card`, `data-digicard`) + de 28 kategoriene fra
   filter-inputene.
3. **Koordinat-oppslag:** følg redirect på kart-lenken (alle tre formater) og
   trekk ut `!3d<lat>!4d<lng>` samt feature-ID `!1s0x…:0x…`. Throttle og
   parallelliser moderat; 147 forespørsler kjøres kun ved første kjøring og
   deretter bare for nye/endrede.
4. Skriv én rad i `midtbyen.snapshots` med `raw` = hele det parsede settet.
   **Ikke skriv til `stores`** — publisering er Unit 3.

**Utsatt til implementering:** valg av HTML-parser (repoet har ingen i dag).
Kravet er at parsingen er testbar mot en lagret HTML-fixture.

**Kritisk designvalg:** koordinat og feature-ID lagres permanent ved første
oppslag. Google har varslet avvikling av korte `goo.gl`-lenker; når de dør, skal
vi allerede eie posisjonene og ikke være avhengige av lenken.

**Test scenarios**
- Fixture med 3 oppføringer → 3 parsede rader med riktige felter
- Oppføring uten nettside → `website_url` null, ikke krasj
- `data-terms` med termer utenfor de 28 → kun gyldige beholdes
- Alle tre lenkeformater gir lat/lng
- Redirect som ikke inneholder `!3d`/`!4d` → koordinat null, oppføringen beholdes

**Verification**
- Kjørt mot prod: 147 rader i snapshot, ≥ 95 % med koordinat
- Rader uten koordinat listes eksplisitt i konsollen, ikke stille droppet

---

## Unit 3 — Diff og publisering

**Goal:** Snapshot blir til gjeldende tilstand, og en ødelagt kilde kan aldri
ødelegge et fungerende datasett.

**Files**
- Create: `scripts/midtbyen/publish.ts`
- Create: `scripts/midtbyen/diff.ts`
- Create: `scripts/midtbyen/diff.test.ts`

**Approach**

Match nyeste snapshot mot `stores` i denne rekkefølgen: `maps_url` → normalisert
adresse → normalisert navn. Trelagsmatchingen finnes fordi MM redigerer navn og
adresser for hånd, og en ren navnematch ville produsert falske «ny + fjernet»-par.

Tre sikkerhetsvakter:

1. **Volumvakt** — er `entry_count` under 80 % av forrige vellykkede snapshot,
   avbryt med status `aborted` og skriv ingenting til `stores`
2. **Fjerningsvakt** — en butikk som mangler øker `missing_runs`. Først ved to
   påfølgende kjøringer settes `removed_at`
3. **Feil = utdatert, aldri tomt** — enhver feil lar forrige tilstand stå

**Test scenarios**
- Identisk snapshot to ganger → null endringer
- Navneendring på samme `maps_url` → oppdatering, ikke ny + fjernet
- Snapshot med 50 % av radene → `aborted`, `stores` uendret
- Butikk mangler én kjøring → `missing_runs = 1`, fortsatt synlig
- Butikk mangler to kjøringer → `removed_at` satt
- Butikk kommer tilbake etter én manglende kjøring → `missing_runs` nullstilles

**Verification**
- To kjøringer på rad: andre gir 0 endringer
- Manipulert snapshot med 70 rader avbryter

---

## Unit 4 — Lesesti og kartflate

**Goal:** `/midtbyen` viser 147 butikker på kart med fungerende filtre.

**Files**
- Create: `lib/gigs/midtbyen/queries.ts`
- Create: `lib/gigs/midtbyen/types.ts`
- Create: `app/midtbyen/page.tsx`
- Create: `components/gigs/midtbyen/StoreMap.tsx`
- Create: `components/gigs/midtbyen/StoreList.tsx`
- Create: `components/gigs/midtbyen/StoreFilters.tsx`

**Approach**

Lesing skjer i server component via service-role-klienten, aldri fra klient.
Flaten gjenbruker mønsteret fra event-boardet (filter-drevet liste + kart, Variant
A) — men som egne komponenter under `components/gigs/`, ikke ved å utvide
board-komponentene. Kartmotor er Mapbox 2D; 3D har ingen funksjon her.

Fase 1 bruker de 28 kategoriene rått, slik MMs egen side gjør. Gruppering er
Unit 5 og tas når dataene kan ses på skjerm.

**Patterns to follow:** `components/variants/report/board/` for kart/liste-koblingen,
`lib/supabase/v2-queries.ts` for lesesti-formen (ikke for innholdet).

**Test scenarios**
- Kategorifilter → kun butikker med den term-IDen
- Midtbykort-filter → 140 av 147
- To filtre samtidig → snitt, ikke union
- Butikk uten koordinat → i lista, ikke på kartet
- Tomt filterresultat → tydelig tom-tilstand, ikke blank side

**Verification**
- 147 markører ved default
- Mobil 390×844: kart + liste brukbart uten horisontal scroll
- `npm run lint`, `npx tsc --noEmit`, `npm test` grønne

---

# Fase 2 — salgbar leveranse

## Unit 5 — Kategori-gruppering

**Goal:** 28 kategorier blir til et antall en besøkende orker å lese.

**Files**
- Create: `supabase/migrations/084_midtbyen_category_groups.sql`
- Modify: `components/gigs/midtbyen/StoreFilters.tsx`

**Approach**

`group_key` fylles på alle 28 rader i `midtbyen.categories`. Grupperingen er et
produktvalg som tas med dataene på skjerm, ikke på forhånd i denne planen. Ukjent
term som dukker opp senere får `group_key = null` og vises i en «Annet»-gruppe —
aldri stille bortfall.

**Test scenarios**
- Alle 28 har `group_key`
- Butikk i flere kategorier vises i alle sine grupper, telles én gang
- Ny ukjent term → «Annet», ikke usynlig

**Verification:** ingen butikk forsvinner fra totalen ved gruppering.

---

## Unit 6 — SEO-flate

**Goal:** Hver butikk og hver kategori har en egen, indekserbar side.

**Files**
- Create: `app/midtbyen/butikk/[slug]/page.tsx`
- Create: `app/midtbyen/kategori/[slug]/page.tsx`
- Create: `app/midtbyen/sitemap.ts`
- Modify: `lib/gigs/midtbyen/queries.ts`

**Approach**

Statisk generering med `generateStaticParams`. Hver side eksporterer `metadata`
(CLAUDE.md-krav). Butikksiden inneholder navn, adresse, kategorier, kart,
Midtbykort-status, lenke til nettsted og **nærliggende butikker** — nok innhold
til at siden er reell. 147 tynne sider ville lest som doorway-sider og ville
skadet mer enn de hjelper; innholdstykkelsen er derfor et krav, ikke pynt.

Bilder via `next/image` (aldri `<img>`).

**Test scenarios**
- Sitemap inneholder 147 butikker + alle kategorier
- To butikker med samme navn får ulike slugs
- Ukjent slug → 404, ikke krasj
- `metadata` er unik per side

**Verification:** `npm run build` genererer alle sidene; ingen ESLint-feil.

---

## Unit 7 — Ukentlig cron og endringsfeed

**Goal:** Kartet holder seg ferskt av seg selv, og endringene blir en leveranse.

**Files**
- Create: `app/api/cron/midtbyen/route.ts`
- Create: `app/midtbyen/endringer/page.tsx`
- Modify: `vercel.json` (eller `vercel.ts`)

**Approach**

Cron-ruta kjører Unit 2 + Unit 3 i rekkefølge og er beskyttet av `CRON_SECRET`
i `Authorization`-header — uten den kan hvem som helst utløse skraping.
Ukentlig schedule.

Endringsfeeden leser `first_seen_at` og `removed_at` og viser nye og lukkede
butikker per periode. Dette er biproduktet som gjør vedlikeholdet til en
løpende leveranse i stedet for en kostnad.

**Test scenarios**
- Kall uten `CRON_SECRET` → 401
- Kall med feil secret → 401
- Vellykket kjøring → ny snapshot-rad, `stores` oppdatert
- Kjøring som avbrytes av volumvakten → 200 med status `aborted`, `stores` urørt

**Verification:** manuell trigger mot preview fungerer; uautorisert kall avvises.

---

## Scope Boundaries

**Ikke i denne planen:**

- **Engelsk.** Board-flaten har null i18n-bruk i dag, og Midtbyen fungerer
  norsk-først. Behovet kommer fra Open House-sporet, ikke herfra.
- **QR-forankring per butikk.** Maskineriet finnes på den umergede
  `feat/megler-self-serve`. Dette er fase 2 hos kunden, og asken skal komme fra
  dem etter en levering.
- **Åpningstider og bilder fra Google Places.** Feature-ID lagres i Unit 2
  nettopp for at dette skal være mulig senere, men det er et påbygg med egen
  kostnad — ikke en forutsetning for kartet.
- **Promotering til Moat 1.** Ingenting flyter fra `midtbyen` til `v2`
  automatisk. Skal noe kompoundere inn i produktet, er det en bevisst handling
  med egen oppgave. Skjemagrensen finnes for å gjøre det valget synlig.
- **Sircon som plattform-spor.** Eksplisitt lagt bort.

### Deferred to Separate Tasks

- **CLAUDE.md-regelen om lesesti.** Regelen sier `lib/supabase/v2-queries.ts` er
  eneste Supabase-lesesti. Unit 4 innfører en til. Regelen skal omformuleres til
  «én lesesti per skjema» i egen commit — ikke brytes stilltiende.
- **Domenevalg.** `placy.no/midtbyen` i fase 1. Om leveransen skal ligge på
  `kart.midtbyen.no` er en kundesamtale, ikke en teknisk beslutning, og krever
  ikke repo-splitt.

## Risks

| Risiko | Håndtering |
|---|---|
| MM redesigner sida og parsingen ryker | Volumvakten avbryter; forrige tilstand står. Feil = utdatert, aldri tomt |
| `goo.gl`-lenker avvikles av Google | Koordinat og feature-ID lagres permanent ved første oppslag; senere kjøringer trenger dem ikke |
| MM endrer navn/adresse for hånd | Trelagsmatch (maps-URL → adresse → navn) hindrer falske ny/fjernet-par |
| 147 tynne SEO-sider straffes | Innholdstykkelse er et eksplisitt krav i Unit 6 |
| Leveransen blir uvedlikeholdt gjeld | `DROP SCHEMA midtbyen CASCADE` er hele opprydningen |

## Dependencies

Unit 1 → Unit 2 → Unit 3 → Unit 4. Fase 2 forutsetter hele fase 1. Unit 5, 6 og
7 er innbyrdes uavhengige.
