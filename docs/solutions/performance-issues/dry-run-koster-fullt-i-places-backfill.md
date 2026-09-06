---
title: Tørrkjøring er ikke gratis — to-fase-backfill og stille 1 000-raders kapping
date: 2026-09-06
category: performance-issues
module: Google Places Integration
problem_type: performance_issue
component: tooling
symptoms:
  - "Dry run uten --apply brukte 600 Google Places Enterprise-kall (~10 USD) og skrev ingenting til databasen"
  - "Dagskvoten i lib/api-budget.ts ble tømt av en kjøring som var ment å være gratis"
  - "--project trakk hele boardet på over 1 500 POI-er når bare 36 innenfor 15 min gange var nødvendige"
  - "--limit N kutter i navnerekkefølge, ikke etter nærhet, så den fjerner nettopp stedene svaret handler om"
  - "548 av 1 548 rader i product_pois var usynlige for alle prosjekt-scopede backfills, uten feilmelding"
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - "scripts/refresh-opening-hours.ts"
  - "scripts/places-backfill-lib.ts"
  - "lib/api-budget.ts"
  - "lib/google-places/fetch-place-details.ts"
  - "database"
tags: [google-places, api-cost, dry-run, postgrest, pagination, backfill, scripts, budget-guard]
---

# Tørrkjøring er ikke gratis — to-fase-backfill og stille 1 000-raders kapping

## Problem

En **tørrkjøring** (uten `--apply`) av `scripts/refresh-opening-hours.ts` mot ett
board brukte opp hele døgnkvoten på Google Places' dyreste SKU — 600 kall,
~10 USD — og skrev ingenting. Scriptet er to-fase: fase 1 henter alt fra Google,
fase 2 skriver til Supabase, og `--apply` styrer **bare fase 2**. En tørrkjøring
koster altså nøyaktig det samme som en ekte kjøring, og kaster resultatet.

Kommandoen var:

```bash
npx tsx scripts/refresh-opening-hours.ts --project broset-utvikling-as_wesselslokka
```

## Symptomer

**1. Taket smalt midt i kjøringen.** Feilmeldingen kommer fra
`ApiBudgetExceededError` (`lib/api-budget.ts:75`):

```
API-taket for «places-details-enterprise» er nådd: 600/600 kall brukt i dag, forsøkte 1 til.
```

600 er default-taket for den SKU-en (`DEFAULT_DAILY_CAPS`,
`lib/api-budget.ts:52`). Prisen brukt i rapporteringen er 17 USD per 1 000 kall
(`USD_PER_1000`, `lib/api-budget.ts:64`), altså ~10 USD for 600 kall.

**2. Loggen sa «DRY RUN», og det leste som «gratis».** Linja
`scripts/refresh-opening-hours.ts:89` skriver `Modus:  DRY RUN` — helt sant, men
den beskriver skrivingen, ikke hentingen.

**3. Kjøringen rapporterte arbeid den ikke gjorde.** `Klare til skriving: 503` på
en kjøring som ikke skrev en eneste rad.

**4. Den stilleste av dem: ingen feil i det hele tatt.** `fetchScopedPois`
(`scripts/places-backfill-lib.ts:253`) hentet `product_pois` i én forespørsel.
PostgREST kapper svaret på 1 000 rader **uten å si fra** — ingen HTTP-feil, ingen
advarsel, bare et kortere svar. Boardets koblingstabell har 1 548 rader, så 548
av dem var usynlige for **hver eneste prosjekt-scopet backfill** — deriblant KIWI
Valentinlyst, en dagligvarebutikk hvis åpningstider er nøyaktig det FAQ-svarene
bruker.

Merk at PostgREST oppgir fasiten i sitt eget svar, hvis man ber om den:
`Content-Range: 0-999/1548` betyr «her er rad 0 til 999, av 1 548». Uten
`Prefer: count=exact` står bare radene, og da er det ingenting å legge merke til.

## Hva som ikke virket

**«Dry run betyr gratis.»** Det er den vanlige betydningen av ordet, og det er
grunnen til at feilen var lett å gjøre. Men tørrkjøringen finnes her for å vise
*hva som ville blitt skrevet*, og for å vise det må dataen først hentes. Vernet
`--apply` gir er mot **skriving til databasen**, ikke mot **penger til Google**.
De to er ikke samme risiko, og ett flagg dekket bare den ene.

**«Bruk `--limit N` som kostnadsbrems.»** Flagget finnes allerede (`parseMode`,
`scripts/places-backfill-lib.ts:138`) og kutter riktignok antall kall. Men det
kutter på **feil akse**: POI-listen sorteres på navn i `fetchScopedPois`, så
`--limit 50` plukker de femti alfabetisk første stedene. Det kan skjære bort
nettopp de stedene svaret handler om. `--limit` er en røyktest, ikke en
avgrensning.

**«Ingen feilmelding, altså gikk det bra.»** Den stille kappingen ga ingen
signaler i det hele tatt. Det eneste sporet var et tall som så mistenkelig rundt
ut: nøyaktig 1 000 rader. Feilmodusen er kjent i kodebasen — `fetchAllRows`
(`lib/supabase/fetch-all-rows.ts:78`) finnes nettopp for den i lesestien — men
den var ikke skrevet ned noe sted i `docs/solutions/` før dette dokumentet, og
backfill-scriptene hadde aldri fått mønsteret.

## Løsning

### 1. `--near N` — avgrens på nærhet, ikke på alfabet

Kun POI-ene innenfor N minutters gange hentes. Det er de eneste
åpningstid-svarene bruker.

**Nytt felt i `BackfillMode`** (`scripts/places-backfill-lib.ts:81`), parset i
`parseMode` (`:138`) med samme heltalls-vakt som `--limit`.

**Ny eksportert funksjon** (`scripts/places-backfill-lib.ts:170`):

```ts
export async function poisWithinWalk(
  ctx: SupabaseCtx,
  projectId: string,
  minutes: number,
): Promise<Set<string>> {
  const res = await sbFetch(ctx)(
    `${ctx.url}/rest/v1/project_pois?project_id=eq.${encodeURIComponent(projectId)}&select=poi_id,travel_times`,
    { headers: readHeaders(ctx.key) },
  );
  // ...
  for (const r of rader) {
    const w = r.travel_times?.walk;
    if (typeof w === "number" && Number.isFinite(w) && w <= minutes) ut.add(r.poi_id);
  }
  return ut;
}
```

Reisetidene er allerede precomputet i `v2.project_pois.travel_times` (migrasjon
071), i **minutter** — filteret koster altså ingen Google-kall å bruke.

**En POI uten målt gangtid holdes bevisst UTENFOR.** Filteret finnes for å kutte
kostnad, og et sted vi ikke vet avstanden til kan vi heller ikke påstå er nært.
Motsatt valg ville gjort filteret verdiløst i akkurat det tilfellet det trengs.

Filteret påføres etter scope-hentingen, i `scripts/refresh-opening-hours.ts`, med
en hard vakt: `--near` krever `--project`, fordi reisetidene er per prosjekt.

### 2. Kostnadsadvarsel før fase 1

`scripts/refresh-opening-hours.ts:92-97` — advarselen skrives ut **før** noe
hentes, hver gang `--apply` mangler:

```ts
if (!mode.apply) {
  console.log("OBS:    tørrkjøring henter fra Google og koster som --apply — den skriver bare ikke.");
}
```

Samme advarsel står i scriptets header-kommentar, slik at den treffer også den
som leser filen i stedet for å kjøre den.

### 3. Sidevis henting av `product_pois`

**Før** — én forespørsel, stille kappet på 1 000:

```ts
const rowsRes = await doFetch(
  `${ctx.url}/rest/v1/product_pois?product_id=in.(${inList})&select=poi_id,pois(${selectColumns})`,
  { headers },
);
const rows = await rowsRes.json();
```

**Etter** (`scripts/places-backfill-lib.ts:284`) — sider på 1 000, sortert på
`poi_id` så pagineringen er deterministisk:

```ts
const rows: { poi_id: string; pois: T | null }[] = [];
const pageSize = 1000;
for (let offset = 0; ; offset += pageSize) {
  const rowsRes = await doFetch(
    `${ctx.url}/rest/v1/product_pois?product_id=in.(${inList})` +
      `&select=poi_id,pois(${selectColumns})&order=poi_id&offset=${offset}&limit=${pageSize}`,
    { headers },
  );
  if (!rowsRes.ok) throw new Error(`Kunne ikke hente product_pois: ${rowsRes.status} ${await rowsRes.text()}`);
  const page = (await rowsRes.json()) as { poi_id: string; pois: T | null }[];
  rows.push(...page);
  if (page.length < pageSize) break;
}
```

### Verifisering

Alle tre virker, målt på faktiske kjøringer:

| Kjøring | POI-er sett | Innen 15 min | API-kall | Rader skrevet |
|---|---|---|---|---|
| Etter `--near`, før paginering | 1 000 | 76 | 46 | 36 |
| Etter paginering | 1 548 | 96 | 27 | 15 (nye) |

Døgnloggen `.api-usage/2026-09-06.jsonl` viser kontrasten rått: 600 bortkastede
Enterprise-kall mot 73 nyttige.

## Hvorfor dette virker

Tre uavhengige årsaker, tre uavhengige fikser. Premisset under dem alle først:

**Kostnaden ligger i feltmasken, ikke i endepunktet.** `fetchPlaceDetails` velger
SKU ut fra maskens innhold: er ett eneste felt i `ENTERPRISE_FIELDS`
(`lib/google-places/fetch-place-details.ts:77`), faktureres **hele** kallet på
Enterprise-nivå. `OPENING_HOURS_FIELDS` er
`["regularOpeningHours", "nationalPhoneNumber"]`
(`lib/google-places/fetch-place-details.ts:68`) — begge står i Enterprise-settet.
Åpningstider kan altså ikke bli billige per kall. Den eneste spaken er **antall
kall**, og da må avgrensningen treffe riktig delmengde.

**`--apply` og penger er to ulike akser.** To-fase-designet er der med vilje: alt
hentes før noe skrives, slik at en 403 eller 429 aborterer med null writes. Det
er et bra design for **dataintegritet**. Men det gjør samtidig at kostnaden er
betalt lenge før `--apply` i det hele tatt leses
(`scripts/refresh-opening-hours.ts:151`). Fiksen kunne ikke være å gjøre
tørrkjøringen billig — den måtte være å **si tydelig at den ikke er det**, og gi
en akse som faktisk kutter kall.

**Nærhet er det virkelige domenekriteriet.** FAQ-svarene om åpningstider handler
om steder du kan gå til. Boardet inneholder alt innenfor en langt større radius.
`--near` avgrenser på det kriteriet som faktisk definerer nytten, og bruker data
som allerede ligger der. Det er derfor 46 kall gjorde jobben 600 kall ikke rakk.

**Kappingen er et servertak, ikke en klientinnstilling.** PostgREST svarer
`200 OK` med 1 000 rader og lar det være med det. Paginering er den eneste veien
rundt; `.limit()` er allerede under taket og endrer ingenting. Sortering på
`poi_id` er nødvendig, ikke pynt: uten stabil rekkefølge kan `offset`-sidene
overlappe eller hoppe over rader.

## Forebygging

**Før du kjører en Places- eller Gemini-backfill, sjekk fire ting:**

1. **Hvilken SKU treffer feltmasken?** Slå opp masken mot `ENTERPRISE_FIELDS` i
   `lib/google-places/fetch-place-details.ts:77`. Ett Enterprise-felt gjør hele
   kallet dyrt.
2. **Hva står igjen på døgntaket?** `npx tsx scripts/api-usage.ts` leser
   `.api-usage/<dato>.jsonl` via `forbruksrapport` (`lib/api-budget.ts:209`) og
   gir brukt/tak/USD per SKU.
3. **Hvor mange POI-er er i scope, og hvor mange trenger du egentlig?** Er svaret
   «alle på boardet», er spørsmålet nesten alltid feil stilt.
4. **Er tørrkjøringen gratis i dette scriptet?** Default-antakelsen bør være
   **nei**. Et to-fase-script henter alltid, uansett flagg. Les hvor `--apply`
   først leses — alt før den linja er allerede betalt.

Trenger du bevisst å heve taket for én kjøring, gjør det eksplisitt. Variabelen
heter `PLACY_CAP_<SKU_MED_UNDERSTREK>` (`envVarForSku`, `lib/api-budget.ts:90`),
altså `PLACY_CAP_PLACES_DETAILS_ENTERPRISE=1200`. En ugyldig verdi tolkes som
default, ikke som «ubegrenset» (`capForSku`, `lib/api-budget.ts:95`) — en
skrivefeil skal ikke kunne slå av taket.

**To flagg, ikke ett — presedensen finnes allerede i repoet.** (session history)
`scripts/anchor-backfill.ts` skiller de to risikoene med hver sin bryter:
`--skip-discovery` slår av den dyre hentingen, `--commit` gater skrivingen
(`scripts/anchor-backfill.ts:8-9`, parset `:78-79`). Det er nøyaktig skillet
`refresh-opening-hours.ts` manglet. Skriver du et nytt backfill-script, kopier
den formen framfor ett enkelt `--apply`.

**Formen et scope-flagg må ha.** Et flagg som skal kutte kostnad, må kutte på det
kriteriet som **definerer hvilke rader svaret trenger** — ikke på rekkefølgen
listen tilfeldigvis har. Test-spørsmålet er: *kan dette flagget skjære bort et
sted svaret faktisk handler om?* Er svaret ja, er det en røyktest (`--limit`),
ikke en avgrensning (`--near`). Er kriteriet allerede precomputet i databasen —
reisetid, kategori, tier — er filteret dessuten gratis å bruke.

**Slik ser du en stille PostgREST-kapping.** Se etter et mistenkelig rundt tall.
Nøyaktig 1 000 rader er nesten aldri en ekte grense i virkeligheten:

```bash
# Fasit fra databasen, uten radtak:
curl -s -I "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/product_pois?product_id=eq.<id>&select=poi_id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept-Profile: v2" -H "Prefer: count=exact" -H "Range: 0-0" | grep -i content-range
```

`Content-Range: 0-0/1548` gir det ekte antallet. Stemmer ikke det med hva
scriptet rapporterer, er svaret kappet.

Regelen: **alt som vokser med board, pool eller tid skal hentes sidevis.** I
lesestien finnes `fetchAllRows` (`lib/supabase/fetch-all-rows.ts:78`) for nøyaktig
dette; i scriptene er løkka over. Sorter alltid på noe unikt, ellers er
pagineringen ustabil. Testmocker må håndheve taket — gjør de ikke det, består
testen like godt uten fiksen.

Beslektet, samme familie av feller: `chunkIds` (`lib/supabase/chunk-ids.ts:22`)
for `.in()`-lister som sprenger URL-lengden når de vokser.

## Related Issues

- [`google-api-runtime-cost-leakage-20260215.md`](../performance-issues/google-api-runtime-cost-leakage-20260215.md)
  — forrige gang Google Places-kostnad løp løpsk. Samme SKU-familie og samme
  datafelt (åpningstider), men annen mekanisme: runtime-kall per viewport, ikke
  et script som henter i tørrkjøring.
- [`places-api-new-photo-migration-20260216.md`](../best-practices/places-api-new-photo-migration-20260216.md)
  — kilden til regelen «feltmasken bestemmer prisnivået». Der er den formulert
  for foto; her gjelder den hele Details-endepunktet.
- [`google-places-photo-cost-reduction-20260216.md`](../best-practices/google-places-photo-cost-reduction-20260216.md)
  — samme kostnadsklasse fra februar 2026, og mønsteret «hent én gang, lagre,
  ikke hent på nytt».
- [`idempotent-backfill-patterns-supabase-20260215.md`](../feature-implementations/idempotent-backfill-patterns-supabase-20260215.md)
  — eksisterende kanon for backfill-hygiene. Behandler backfill som en ren
  skriveoperasjon; dette dokumentet legger til at LESE-fasen koster penger.
- [`anker-familien-idrettsanlegg-20260828.md`](../architecture-patterns/anker-familien-idrettsanlegg-20260828.md)
  — samme datasti, og samme feilklasse: usynlig datatap på boardet uten
  feilmelding.

Repoet bruker Trello (board «Utvikling»), ikke GitHub Issues — søk i
`gh issue list` ga null treff.
