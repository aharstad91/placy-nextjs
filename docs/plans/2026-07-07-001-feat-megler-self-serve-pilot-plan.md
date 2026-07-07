---
title: "feat: Megler self-serve kjede-pilot (adresse → nivå-1-board → delings-side → embed)"
type: feat
status: active
date: 2026-07-07
origin: docs/brainstorms/2026-07-07-megler-self-serve-pilot-requirements.md
---

# feat: Megler self-serve kjede-pilot

## Overview

Pilot-meglere i én kjede skal selv kunne generere et Placy nivå-1-board fra en adresse via en kontor-scopet side (`placy.no/megler/<kontor-slug>`), og få boardet ut i to kanaler: iframe på kontorets objektside og lenke i FINN-annonsen. Kjernen (PRD 3 Unit 8: `POST /api/generation-requests` + fire-and-poll + Brevo-e-post) eksisterer — dette bygger journeyen rundt: kontor-register/inngang, server-side geofence med etterspørselslogg, delings-side per board, fullt-board-embed-modus med instrumentering, og ekstern verifisering.

## Problem Frame

Kjede-sporet («de 10–30M krever kjede / partner / self-serve») trenger et demonstrerbart selvbetjeningsverktøy. Se origin-dokumentet for full produktramme og de 20 requirements (R1–R20). Rolle: kjede-pilot-verktøy — lukket tilgang via delte lenker, gratis i pilot, kun nivå 1.

## Requirements Trace

Origin-dokumentets R1–R20 er kravsettet. Plan-enhetene mapper slik:

| Unit | Requirements |
|------|--------------|
| 1 — Kontor-register + inngangsside | R1, R2, R3, R4 (form-fangst), R15 |
| 2 — API: scoping, geofence, dup, etterspørselslogg | R3, R5, R6, R7, R16 (dup-scoping), R17 (R4-feltene konsumeres her) |
| 3 — Delings-side + e-postoppdatering | R8, R9, R10, R11, R16 (dup-svar → delings-side), R18, R19 |
| 4 — Embed-modus: fullt board | R12, R13, R14, R20 |
| 5 — Kanal-attribusjon i engagement-konvolutten | R19, R20 |
| 6 — Ekstern embed-verifisering + akseptanse | R13, R14, R20 + suksesskriteriene |

## Scope Boundaries

Fra origin-dokumentet (ratifisert, gjentas ikke i detalj her): ingen megler-auth, ingen betaling, ingen kjede-branding av boardet, ingen board-administrasjon for megler, kun nivå 1.

### Deferred to Separate Tasks

- Kontor-galleri («alle boards fra vårt kontor») — vurderes etter pilot-gjenbrukssignal.
- Selvbetjent kontor-onboarding — kontorer opprettes manuelt (SQL/psql) i piloten.
- Varslings-automatikk for R17 (dekket-strøk-varsel) — manuell utsending fra Andreas i piloten; kun datafangsten bygges.

## Context & Research

### Relevant Code and Patterns

- `app/api/generation-requests/route.ts` — self-serve-kjernen: Zod-skjema, 5/min rate limit, 7-dagers dup-sjekk på `address_normalized`, `runAfterResponse`-async-grense, Brevo `sendConfirmationEmail` (hei@placy.no). Utvides, ikke dupliseres.
- `components/generer/GenererForm.tsx` + `components/inputs/AddressAutocomplete` — eksisterende form/autocomplete; kontor-siden gjenbruker disse med scoping-props.
- `lib/pipeline/find-area-for-point.ts` — ferdig geofence-primitiv: område-treff krever BÅDE `boundary` OG `report_editorial` (server-side). **Dette ER definisjonen av «kuratert strøk»** — ingen buffersone. 7 kuraterte strøk lever i prod (Ranheim, Tyholt, Eberg, Malvik, Lade, Charlottenlund, Sentrum). OBS: primitiven er fail-soft for Supabase-QUERY-feil, men KASTER ved manglende klient-config — kall wrappes i try/catch.
- `app/eiendom/[customer]/[project]/rapport-board/board-embed-gate.tsx` + `ReportReelsPage`s `embed`-prop — dagens `?embed=1`-teaser-semantikk som Unit 4 ERSTATTER (inkl. `?from=embed`-ankomstgaten).
- `components/map/map-view-3d.tsx` — GestureHandling `AUTO`→`GREEDY`-aktiveringsmønsteret (linje ~359) gjenbrukes for scroll-yielding i iframe.
- `lib/instrumentation/event-types.ts` — `EngagementContextEnvelope` rir i `payload.context` (jsonb, additiv utvidelse) — `src`-feltet er en ren tilføyelse, INGEN ny event-type (to-stegs-grensen trigges ikke).
- `next.config.mjs` — ingen frame-headers utenom `/admin` (DENY); åpen framing er ratifisert (se Key Technical Decisions).
- `qrcode.react@4.2.0` — allerede dependency; QR er client-side render.
- Migrasjons-konvensjon: `supabase/migrations/NNN_*.sql`, kjøres via psql direkte (CLAUDE.md); neste nummer er 081.

### Institutional Learnings

- RLS default-deny (memory/CLAUDE.md): ALDRI anon-leselige policies på nye tabeller; kontor-register og etterspørselslogg er service-role-only.
- Rate-limit-læringen fra audit 2026-07-06: åpne provisjonerings-endepunkter uten limit = API-spend-eksponering — nye skriveveier arver `createRateLimiter`-mønsteret.
- Mobile-native UX (memory): embed-verifisering må skje på faktisk mobil-viewport, ikke bare devtools.

## Key Technical Decisions

- **Geofence = `findAreaForPoint`, uendret definisjon**: polygon-treff mot områder med boundary + report_editorial. Samme primitiv som editorial-arven — én sannhetskilde for «kuratert». Server-side i API-et (Moat-1-polygonene sendes aldri til klienten).
- **Åpen framing beholdes** (ratifisert av Andreas 2026-07-07): ingen frame-ancestors-endring; per-kontor-allowlist kan innføres senere når kontor-domener registreres i kjede-avtale.
- **Etterspørselslogg i egen tabell** (`coverage_demand`), IKKE som status-rad i `generation_requests` — unngår kollisjon med 7-dagers-dup-sjekken (en avvist adresse som blir dekket samme uke skal ikke blokkeres), og holder PII-grensen enkel (valgfri e-post ved avvisning, service-role-only).
- **Kontor-register i egen tabell** (`broker_offices`): slug (ikke-gjettbar: navn + tilfeldig suffiks), display-navn, `customer_id`-kobling, `active`-flagg (rotasjon = deaktiver rad + ny rad). Ukjent/inaktiv slug → 404 — `getOrCreateCustomer`-upsert gjelder ikke denne inngangen (R15).
- **Delings-siden nøkles på prosjekt-slug** (`/megler/deling/<customer>/<slug>`), ikke request-id — én stabil URL per board uansett antall requests (R11); dup-treff (R16) peker hit. **Oppslagsstrategi (viktig — sluggene divergerer):** request-radens `address_slug` er `slugify(gatedelen)` mens prosjektets `url_slug` lages av hele adressen i `createReportProject` — de er systematisk ULIKE. Delings-sidens `[project]`-param resolves derfor FØRST mot `v2.projects.url_slug` (per customer), med fallback mot `generation_requests.address_slug` for pending/eldre lenker; pending-fallbacket redirecter kanonisk (301) til prosjekt-slug-URLen når `result_url` er satt. Dup-svar bygger URL fra `result_url`-sluggen når status=completed, fra `address_slug` når pending.
- **Embed-semantikken erstattes, ikke parallellføres**: `?embed=1` går fra teaser til fullt board i samme gate-komponent; teaser-rendringen slettes (kodebase-hygiene: bygg nytt = slett gammelt).
- **Kanal-markør som query-param** (`?src=finn|embed|qr`) fanget inn i `EngagementContextEnvelope` som valgfritt `src`-felt — additiv payload-utvidelse, ingen migrasjon.

## Open Questions

### Resolved During Planning

- Kuratert dekning-definisjon: polygon-treff via `findAreaForPoint`, ingen buffer (én sannhetskilde).
- Delings-side-nøkkel: prosjekt-slug, ikke request-id.
- QR: client-side `qrcode.react` på delings-siden.
- Åpen framing vs allowlist: åpen framing (user decision).
- Avvisningslogg-lagring: egen `coverage_demand`-tabell (unngår dup-kollisjon).
- Faktisk pilot-dekning: 7 kuraterte strøk i prod — geofencen avviser ikke flertallet av Trondheim-adresser.

### Resolved During Implementation (Unit 4)

- **Gesture-spike (2026-07-08):** Andreas valgte 3D-embed nå + mobil-verifisering i Unit 6. Scroll-yield implementert som et CONTAINED, embed-gated `EmbedChrome`-overlegg i ReportReelsPage (fullskjerm-knapp + aktiveringsgate m/ `touch-action: pan-y`) — INGEN endring i den delte 3D-map-stacken (BoardMap→BoardMap3D→MapView3D urørt, lav blast-radius). Desktop-Chrome verifisert (embed=fullt board + EmbedChrome, 0 konsollfeil). Definitiv mobil-scroll-yield + 2D-fallback-beslutning er Unit 6 (ekte telefon). Teaser + `?from=embed`-gaten + `EmbedArrivalLoader` slettet; splash-`embed`-stien fjernet fra Desktop/MobileReportSplash.
- **Pre-eksisterende instrumenterings-bug oppdaget + fikset (R20-blokker):** 2026-07-06-audit-herdingen låste `projectId`-valideringen i `lib/instrumentation/event-schema.ts` til `PROJECT_ID_SHAPE` (customer_slug), men emitteren sender boardets UUID `project.id` → ALLE rapport-board-events droppet stille siden 07-06 (bekreftet: 0 board_viewed 07-07 før fiks). Relaksert til `opaqueId` (bundet + kontrolltegn-avvist, injection-trygt via parameterisert insert; samme behandling som poi_id). Verifisert: board_viewed lander nå i v2.events (mode=report). `src` kommer i Unit 5.

### Deferred to Implementation
- Geofence-stoppens eksakte interaksjonsform (inline under adressefeltet vs egen tilstand) — designes i Unit 1 mot «rent verktøy»-tonen; inline-validering er arbeidshypotesen.
- Anbefalt minimum iframe-høyde i snippeten — fastsettes empirisk under Unit 6-verifiseringen på mobil.
- FINN-plassering av lenken (fagsystem-felt vs annonsetekst) — verifiseres med pilot-megler (origin R10).
- Eksakt Brevo-malendring (delings-side-lenke + tekst) — trivielt, tas i Unit 3.

## Implementation Units

- [x] **Unit 1: Kontor-register + `/megler/<kontor-slug>`-inngangsside**

**Goal:** Kontor-scopet inngang som validerer slug mot register og rendrer det rene verktøyet (adressefelt + e-post, kontornavn som avsender — ingen kontor-fritekstfelt).

**Requirements:** R1, R2, R3, R15

**Dependencies:** Ingen (første unit).

**Files:**
- Create: `supabase/migrations/081_broker_offices.sql`
- Create: `app/megler/[slug]/page.tsx` (server component: slug-oppslag via service-role, 404 ved ukjent/inaktiv)
- Create: `components/megler/OfficeGenererForm.tsx` (scoped variant — gjenbruker `AddressAutocomplete` og poll-mønsteret fra `GenererForm`)
- Create: `app/megler/[slug]/not-found.tsx` (brandet «kontor ikke funnet»)
- Test: `app/megler/[slug]/page.test.tsx`, `components/megler/OfficeGenererForm.test.tsx`

**Approach:**
- `broker_offices`: `slug text pk`, `name text`, `customer_id text` (FK-aktig kobling til kunde), `active boolean default true`, `created_at`. RLS: default-deny, service-role-only. Slug genereres manuelt ved opprettelse (kebab-navn + 6 tilfeldige tegn).
- GET-siden får egen per-IP rate limiter (gjenbruk `createRateLimiter`) — POST-limiteren dekker ikke slug-oppslaget, og uten limit kan 6-tegns-suffikset brute-forces friksjonsfritt; gjentatte 404-bursts logges som brute-force-signal.
- **Sekvenserings-gate mot Unit 2:** API-et lærer `officeSlug` først i Unit 2, og dagens Zod-skjema stripper ukjente felt stille — en form som poster før Unit 2 er live gir boards under `intern` UTEN kontor-tilknytning og UTEN geofence. Unit 1 + Unit 2 verifiseres derfor SAMLET mot prod før noen kontor-lenke deles; alternativt deaktiveres submit i Unit 1 til Unit 2 er deployet.
- Siden er server component som eksporterer `metadata` med `robots: { index: false, follow: false }` — lenken ER tilgangsmodellen, og en indeksert slug-side ødelegger rotasjonssemantikken; slug-oppslag skjer server-side — ugyldig slug når aldri klient-JS.
- Formen sender kontor-slug (ikke kontornavn) til `POST /api/generation-requests` (payload: `officeSlug`, adresse, lat/lng, e-post, samtykke — kontrakten eies av Unit 2); e-post + samtykke som i dag (R4).

**Patterns to follow:** `GenererForm.tsx` (poll-kontrakt), `app/eiendom/(tools)/generer/page.tsx` (page-struktur), RLS-mønsteret fra migrasjon 076/077.

**Test scenarios:**
- Happy path: gyldig aktiv slug → siden rendrer med kontornavnet synlig og adressefeltet fokusert.
- Error path: ukjent slug → 404-siden («kontor ikke funnet»), ingen kunde-rad opprettet.
- Error path: `active=false`-slug → samme 404 (rotasjonssemantikk).
- Edge case: slug med gyldig format men reservert navn (`admin`, `api`) → 404, ikke kollisjon med andre ruter.

**Verification:** Manuelt opprettet test-kontor i dev-DB gir fungerende side på `/megler/<slug>`; ukjent slug gir brandet 404. `npm run lint && npm test && npx tsc --noEmit` grønt.

- [x] **Unit 2: API-utvidelse — kontor-scoping, server-side geofence, per-kontor-dup, etterspørselslogg**

**Goal:** `POST /api/generation-requests` håndhever geofencen for ALLE innganger (også åpne `/eiendom/generer`), scoper duplikater per kontor, knytter boards til kontorets kunde via registeret, og logger avvisninger som etterspørselssignal med valgfri e-postfangst.

**Requirements:** R3, R4, R5, R6, R7, R16, R17

**Dependencies:** Unit 1 (`broker_offices`-tabellen).

**Files:**
- Create: `supabase/migrations/082_coverage_demand.sql`
- Modify: `app/api/generation-requests/route.ts`
- Modify: `components/generer/GenererForm.tsx` (rendering for det nye `outside_coverage`-statuset — den åpne siden må vise avvisningen forståelig, gjenbruk geofence-stopp-designet fra Unit 1)
- Test: `app/api/generation-requests/route.test.ts` (utvid eksisterende)

**Approach:**
- Request-skjemaet får valgfri `officeSlug`; med slug → oppslag i `broker_offices` (ukjent og inaktiv gir SAMME 404-respons — ingen rotasjons-orakel, speiler Unit 1s page-nivå; ALDRI `getOrCreateCustomer`); uten slug → dagens `brokerage`/`intern`-flyt beholdes for den åpne siden.
- Geofence FØR provisjonering: `findAreaForPoint({lat, lng})` — `area: null` → 200-svar med `status: "outside_coverage"` + dekningsmelding (hvilke strøk dekkes) + insert i `coverage_demand` (adresse, koordinat, kontor-slug?, valgfri e-post, tidspunkt). Deler eksisterende `postLimiter` (samme endepunkt → samme rate limit — audit-læringen).
- Dup-sjekk utvides fra `address_normalized` til `(address_normalized, customer_id)`. Dup-svaret beholder board-URL i DENNE uniten (delings-side-ruta finnes først i Unit 3 — Unit 3 bytter dup-svaret til delings-side-URL i samme sveip som `result_url`-semantikkskiftet).
- `coverage_demand`: RLS default-deny, service-role-only; e-post er PII og eksponeres aldri i GET-svar (samme grense som `generation_requests`). Upsert på `(address_normalized, office_slug)` med `hits`-teller + `last_seen_at` i stedet for ren insert — retry-/demo-støy skal ikke skjevvri kurateringsprioriteringen.
- **E-post lagres i `coverage_demand` KUN ved eksplisitt andre opt-in:** POST-samtykket (R4) gjelder «klart»-varsling for et board, ikke fremtidig dekningsvarsel. Avvisnings-UI-et tilbyr en egen «varsle meg når [sted] dekkes»-handling (eget kall/felt) — e-posten fra POST-payloaden auto-lagres ALDRI i `coverage_demand` uten dette.

**Execution note:** Test-først på geofence-grensen — skriv de avviste/innenfor-scenariene mot `findAreaForPoint`-mock før route-endringen.

**Patterns to follow:** Eksisterende Zod-skjema + rate-limit + `runAfterResponse` i samme fil; fail-soft-kontrakten i `find-area-for-point.ts`.

**Test scenarios:**
- Happy path: adresse innenfor kuratert strøk + gyldig officeSlug → pending-request under kontorets kunde, pipeline trigges.
- Happy path: avvist adresse → `outside_coverage`-svar med dekningsliste, rad i `coverage_demand`, INGEN pipeline-kjøring, INGEN generation_requests-rad.
- Happy path: avvisning + eksplisitt «varsle meg»-opt-in → e-post lagret i `coverage_demand`; avvisning UTEN opt-in → rad uten e-post (POST-payloadens e-post auto-lagres aldri).
- Edge case: samme adresse fra to ulike kontor innen 7 dager → to separate requests (per-kontor-dup).
- Edge case: samme adresse samme kontor innen 7 dager → dup-svar (board-URL i denne uniten; Unit 3 bytter til delings-side).
- Happy path: åpen side + adresse utenfor dekning → GenererForm rendrer dekningsmeldingen (ikke udefinert UI-tilstand).
- Edge case: samme avviste adresse sendt tre ganger → ÉN rad i `coverage_demand` med `hits=3`, ikke tre rader.
- Error path: ukjent officeSlug → 4xx, ingen kunde-rad opprettet (verifiser at `getOrCreateCustomer` ikke kalles).
- Error path: `findAreaForPoint` kaster/feiler (fail-soft null) → avvisning behandles som utenfor dekning, ikke 500. **OBS:** fail-soft betyr at Supabase-feil gir «utenfor dekning»-svar til bruker — akseptert i pilot (bedre enn å provisjonere uten garanti), men logg warning.
- Integration: åpen `/eiendom/generer`-innsending utenfor dekning → samme avvisning (geofencen kan ikke omgås via URL-bytte).

**Verification:** curl-kjøringer mot dev: innenfor-adresse gir pending, Melhus-adresse gir `outside_coverage` + `coverage_demand`-rad synlig via service-role-query. Migrasjon 081+082 kjørt og verifisert mot prod-DB (CLAUDE.md-regelen: migrasjon er del av jobben).

- [x] **Unit 3: Delings-side per board + e-postoppdatering**

**Goal:** Én stabil leveranse-flate per board: forhåndsvisning, kopier board-lenke (`?src=finn`), kopier iframe-snippet (`?embed=1&src=embed`), QR (`?src=qr`), FINN-veiledning, tilbake-lenke til kontor-siden. «Klart»-e-posten peker hit.

**Requirements:** R8, R9, R10, R11, R18, R19

**Dependencies:** Unit 2 (API-feltene finnes), Unit 1 (tilbake-lenke). Unit 3 eier HELE URL-semantikkskiftet: `result_url` → delings-side OG dup-svar → delings-side byttes her, i samme sveip.

**Files:**
- Create: `app/megler/deling/[customer]/[project]/page.tsx` (server component + `metadata` med `robots: { index: false, follow: false }` — samme URL-hemmeligholds-logikk som kontor-siden)
- Create: `components/megler/SharePanel.tsx` (client: kopier-knapper med «Kopiert!»-state, QR via `qrcode.react`)
- Modify: `app/api/generation-requests/route.ts` (`result_url` → delings-side-URL; dup-svar → delings-side-URL; `sendConfirmationEmail`-lenke og tekst)
- Modify: `components/generer/GenererForm.tsx` (resultUrl-visningen følger delings-side-semantikken)
- Modify: `app/admin/requests/requests-admin-client.tsx` (result_url-lenken peker nå på delings-siden)
- Test: `components/megler/SharePanel.test.tsx`, delings-side-page-test

**Approach:**
- Alle kjøper-vendte artefakter koder BOARD-URLen (R18): lenke = `/eiendom/<customer>/<slug>/rapport-board?src=finn`, iframe-src = `...?embed=1&src=embed`, QR-payload = `...?src=qr`. Delings-side-URLen deles kun i e-posten.
- Iframe-snippeten er komplett og selvforklarende (width 100%, anbefalt min-høyde fra Unit 6, `title`-attributt, `loading="lazy"`).
- FINN-veiledningen er kort og ærlig prose (R10) — plassering verifiseres med pilot-megler (deferred).
- Forhåndsvisning: selve boardet i en liten iframe med `?embed=1` (dogfooder embed-modusen) — eller statisk skjermbilde hvis embed-modus (Unit 4) ikke er landet ennå; velg ved implementering basert på unit-rekkefølgen.
- Redirect-garantien (R11): delings- og board-URL-mønstrene noteres i `docs/rebuild/CARRY-OVER-MANIFEST.md` som pilot-constraint (301 ved omlegging).

**Patterns to follow:** `boardUrl()`-helperen i route-fila; eksisterende Brevo-malstruktur i `sendConfirmationEmail`.

**Test scenarios:**
- Happy path: delings-side for eksisterende board rendrer preview + tre artefakter; kopier-knapp skriver riktig URL med riktig `src`-markør til clipboard og viser «Kopiert!».
- Happy path: QR-koden dekoder til board-URL med `?src=qr`.
- Edge case: delings-side for ukjent prosjekt-slug → 404.
- Edge case: board under generering (pending) → delings-siden viser vente-tilstand i stedet for død preview.
- Integration: fullført generering → e-post inneholder delings-side-lenken (ikke rå board-URL); GET-status-svar returnerer delings-side-URL.

**Verification:** Full flyt i dev: generer board → e-post-payload (logget/mocket) peker på delings-siden → alle tre kopier-artefakter fungerer og bærer korrekt `src`.

- [x] **Unit 4: Embed-modus — fullt board med fullskjerm-knapp**

**Goal:** `?embed=1` rendrer det fulle boardet i iframe (erstatter teaseren): scroll-yield via gesture-aktivering, tydelig «Åpne i fullskjerm»-knapp (ny fane til standalone board), teaser-koden slettes.

**Requirements:** R12, R13, R14, R20

**Dependencies:** Ingen hard (parallelliserbar med Unit 1–3), men Unit 3s preview dogfooder resultatet.

**Files:**
- Modify: `app/eiendom/[customer]/[project]/rapport-board/board-embed-gate.tsx` (teaser → fullt board; slett teaser-render og `?from=embed`-ankomstgate hvis den mister konsument)
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (embed-prop: UI-justeringer + fullskjerm-knapp; FJERN `if (embed) return`-skippen på `board_viewed`)
- Modify: `components/map/map-view-3d.tsx` eller embed-wrapper (gesture AUTO→GREEDY i embed-kontekst)
- Test: oppdater `board-embed-gate`- og `ReportReelsPage`-tester

**Approach:**
- **Spike FØRST** (execution note under): verifiser i en rå test-iframe at gmp-map-3d kan holde `AUTO`-gestures til aktivering og yielde scroll — utfallet avgjør om embed-modus bruker 3D eller faller til 2D-overlay-kartet. Ikke bygg embed-UI før spiken har svar.
- Fullskjerm-knappen åpner standalone board-URL i ny fane (`target=_blank` + `rel`), og bærer `src`-markøren videre.
- Embed-UI-justeringer: skjul elementer som ikke gir mening i ramme (kjent drill-in-gap på VO-boards fra origin) — minimal justering, samme opplevelse.

**Execution note:** Gesture-spike i faktisk ekstern iframe før UI-arbeid; 2D-fallback-beslutningen tas eksplisitt (og noteres i planen) hvis 3D ikke kan temmes.

**Patterns to follow:** AUTO→GREEDY-mønsteret i `map-view-3d.tsx:359`; persistent-3D-arkitekturen (gmp-map-3d unmountes aldri — memory-læringen).

**Test scenarios:**
- Happy path: `?embed=1` rendrer fullt board (ikke teaser); fullskjerm-knapp synlig og peker på standalone-URL i ny fane.
- Happy path: `board_viewed` fyres i embed-modus med kontekst-konvolutt (R20) — assert på at embed-skippen er fjernet.
- Edge case: board i iframe uten aktivering → side-scroll på vertsiden passerer iframen (gesture-yield).
- Edge case: `?from=embed`-ankomst — bekreft at gaten enten er fjernet med alle konsumenter eller fortsatt fungerer for gamle delte lenker.
- Error path: embed-modus på VO-board med kjent drill-in-gap → drill-in utilgjengelig-tilstanden degraderer pent (ingen crash).

**Verification:** Board i iframe på en lokal ekstern testside (annet origin) fungerer på desktop-Chrome og faktisk mobil; scroll kapres ikke; fullskjerm-knapp åpner riktig; teaser-koden er borte fra bundelen.

- [ ] **Unit 5: Kanal-attribusjon i engagement-konvolutten**

**Goal:** `src`-markøren (`finn|embed|qr`) fanges fra query-param inn i `EngagementContextEnvelope` på alle events, slik at FINN- vs embed- vs QR-trafikk kan skilles i Moat-2-data fra dag én.

**Requirements:** R19, R20

**Dependencies:** Unit 3 (URL-ene bærer markøren), Unit 4 (embed-events flyter).

**Files:**
- Modify: `lib/instrumentation/event-types.ts` (valgfritt `src`-felt på `EngagementContextEnvelope` + parse-guard for kjente verdier)
- Modify: konvolutt-byggestedet i board-rendringen (der `mode`/`has_3d_addon` settes)
- Test: `lib/instrumentation/event-types.test.ts` + konvolutt-byggetest

**Approach:**
- Additiv jsonb-utvidelse — INGEN migrasjon, INGEN ny event-type (to-stegs-grensen trigges ikke).
- Ukjente/manglende `src`-verdier → feltet utelates (ikke `"unknown"`-støy); kun `finn|embed|qr` slippes gjennom parse-guarden.
- `src` leses ved board-mount og holdes stabil for økten (samme ramme som resten av konvolutten).

**Patterns to follow:** Konvolutt-kommentarene i `event-types.ts` (additiv utvidelse er eksplisitt forutsett: «Utvidelse (f.eks. travel_mode, viewport) er additivt»).

**Test scenarios:**
- Happy path: board åpnet med `?src=qr` → `board_viewed`-payload har `context.src === "qr"`.
- Edge case: `?src=tulleball` → feltet utelates fra konvolutten.
- Edge case: ingen `src`-param (direkte-trafikk) → feltet utelates; eventen er ellers uendret.
- Integration: embed-board (`?embed=1&src=embed`) → event ankommer med både embed-kontekst og `src`.

**Verification:** Events i dev-DB viser korrekt `src` per inngangskanal; eksisterende events uten `src` er upåvirket.

- [ ] **Unit 6: Ekstern embed-verifisering + akseptansegjennomgang**

**Goal:** Bevis at helheten holder kvalitetsstandarden utenfor vårt eget miljø: ekte ekstern testside med iframen, mobil + desktop, events verifisert ankommet, og full gjennomgang av suksesskriteriene som er byggbare uten kjeden.

**Requirements:** R13, R14, R20 + origin-dokumentets suksesskriterier

**Dependencies:** Unit 1–5.

**Files:**
- Create: `scripts/embed-testside/index.html` (statisk ekstern testside med iframe-snippeten fra delings-siden, servert fra annet origin/port)
- Modify: `docs/plans/2026-07-07-001-feat-megler-self-serve-pilot-plan.md` (checkbokser + funn)

**Approach:**
- Testsiden bruker den EKSAKTE snippeten kopiert fra en ekte delings-side (ikke håndskrevet iframe) — verifiserer leveranse-artefaktet, ikke bare embed-modusen.
- Kjøres i nystartet Chrome (memory-læringen for 3D-verifisering) + faktisk mobil.
- Empirisk fastsettelse av anbefalt min-høyde for snippeten (deferred fra Unit 3) → oppdater snippet-genereringen.
- Sjekkliste mot suksesskriteriene: selvbetjent flyt ende-til-ende uten Andreas-inngrep (test-persona), `board_viewed` + `src` ankommer fra test-iframen, avvist adresse lander i `coverage_demand`.

**Test scenarios:** Test expectation: none — dette er verifiseringsunit; scenariene ER sjekklisten i Approach (manuell + observasjon av events i DB).

**Verification:** Alle byggbare suksesskriterier fra origin-dokumentet er avkrysset med bevis (skjermbilder/DB-spørringer); gjenstående kriterier (ekte objektside, FINN-annonse, board nr. 2 uoppfordret) er eksplisitt merket «krever kjeden — pilot-utfall».

## System-Wide Impact

- **Interaction graph:** `POST /api/generation-requests` betjener nå tre innganger (åpen side, kontor-side, dup-svar) — geofencen og dup-endringen påvirker den eksisterende åpne siden bevisst (R5). `result_url`-semantikken endres fra board-URL til delings-side-URL; sjekk konsumenter av GET-svaret (GenererForm + admin/requests).
- **Error propagation:** `findAreaForPoint` er fail-soft for Supabase-QUERY-feil (gir «utenfor dekning», ikke 500), men kaster ved manglende klient-config — route-kallet wrappes i try/catch (Unit 2s error-path-scenario dekker det); feil logges som warning så falske avvisninger kan oppdages.
- **State lifecycle risks:** `coverage_demand` er ny permanent PII-bærende tabell (valgfri e-post) — service-role-only fra migrasjonsdag én; ingen retensjonspolicy i pilot (akseptert, noter i migrasjonskommentar).
- **API surface parity:** Admin-provision-ruta (`app/api/admin/provision/route.ts`) geofences IKKE — operatøren skal kunne provisjonere hvor som helst (nivå 2-arbeid). Dette er en bevisst asymmetri, dokumentert her.
- **Integration coverage:** Dup-svar → delings-side-URL krysser Unit 2/3-grensen; embed-events krysser Unit 4/5 — begge har eksplisitte integrasjonsscenarier.
- **Unchanged invariants:** Pipeline-kjernen (`provisionReportBoard`) endres ikke; eksisterende kunde-iframes (StasjonsKvartalet) påvirkes ikke av FRAMING-beslutningen — men de FÅR ny embed-rendring (teaser → fullt board) den dagen Unit 4 deployes, siden `?embed=1`-semantikken flippes globalt. Unit 4/6-verifiseringen inkluderer derfor: identifiser eksisterende embed-konsumenter (grep + DB/kunde-oversikt) og sjekk deres live-sider etter deploy. `?from=embed`-lenker i omløp håndteres i Unit 4s edge-case.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| gmp-map-3d kan ikke yielde scroll i iframe | Spike før UI-bygging (Unit 4); eksplisitt 2D-fallback-beslutning |
| Fullt board i iframe er tungt på svake mobiler (WebGL/100dvh) | Unit 6-verifisering på faktisk mobil; `loading="lazy"` i snippet; 2D-fallback reduserer også dette |
| `result_url`-semantikkskiftet knekker eksisterende konsumenter | Unit 3 oppdaterer GenererForm + admin/requests i samme sveip; route-testene dekker begge |
| Serverless-avbrudd midt i in-process-pipeline under pilot-trykk | Kjent klasse (origin residual); e-post-løftet gjør det synlig — retry-ruta (`/api/admin/retry-request`) finnes for operatør |
| Sommer-rebuilden legger om URL-strukturen | Pilot-URLer som eksplisitt rebuild-constraint (R11) — notert i CARRY-OVER-MANIFEST i Unit 3 |

## Documentation / Operational Notes

- Kontor-opprettelse i pilot: manuell SQL (insert i `broker_offices`) — dokumenteres som kommentar i migrasjon 081 med eksempel.
- R17-varsling («strøket ditt er nå dekket») er manuell: Andreas spør `coverage_demand` etter `/curate-area`-kjøringer.
- Migrasjoner 081 og 082 kjøres ved START av henholdsvis Unit 1 og Unit 2 (før implementasjonsarbeid), via psql-mønsteret i CLAUDE.md, og verifiseres mot prod-DB før implementasjonen går videre.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-07-07-megler-self-serve-pilot-requirements.md](../brainstorms/2026-07-07-megler-self-serve-pilot-requirements.md)
- Related code: `app/api/generation-requests/route.ts`, `lib/pipeline/find-area-for-point.ts`, `components/generer/GenererForm.tsx`, `lib/instrumentation/event-types.ts`
- Strategi: `docs/strategy/2026-06-25-markus-bruktmegler-vs-utbygger.md` (self-serve-tesen), `docs/strategy/2026-06-27-premium-single-bruktmarked-spor.md` (grunnpakke/Solkart-benchmark)
