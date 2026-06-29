# PRD 13 — Engasjements-instrumentering (data-moat)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Fase 1 har ingen blokkerende åpne spørsmål; se §10.)
> **Tier:** Delt (instrumentering er ALLTID delt — aldri forket per tier; jf. «del nedover stacken»)
> **PRD-nr:** 13 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-instrumentering`
> **Kontekst:** Bygger data-moat #2 (engasjements-statistikk — term-sheet-relevant IP) inn fra rebuildens første lag. **100% greenfield** (VERIFISERT: ingen analytics-dep i `package.json`; ingen `events`-tabell blant de 24 prod-tabellene — `prod-schema-snapshot.txt`; ingen event-logging-kode i `@/lib/supabase/*`). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (kritiker-patch linje 764: «instrumenterings-PRD = 100% greenfield … Prototyp event-skjema + én server-action-logg TIDLIG og serielt») og `docs/rebuild/prd/01-datamodell-supabase.md` (PRD 1 — `events`-tabell-skjemaet, «NY tabell — events», linje 142–155). Konsumerer PRD 1 (`v2.events`-tabell); konsumeres senere av PRD 5 (poi-/kategori-kontekst) og PRD 9 (emit-sites i board-skall).

---

## 1. Produktvisjon / Formål

Det gamle Placy-systemet hadde **null engasjements-instrumentering** — ingen `events`-tabell, ingen analytics-avhengighet (VERIFISERT mot `prod-schema-snapshot.txt` og `package.json`, jf. CARRY-OVER-MANIFEST linje 764 + PRD 1 linje 17). Et board kunne vises tusen ganger uten at Placy visste det. Det betyr at Placy ikke kan svare på det ene spørsmålet en megler/utbygger og en investor begge bryr seg om: **«bruker noen dette, og hva ser de på?»**

Denne PRD-en eier **logikken** som retter det: en server-action-event-logger, et lite sett emit-sites på board-flaten, og et aggregerings-/lese-lag som gjør rådata til engasjements-statistikk. Selve `v2.events`-tabellen eies av PRD 1 (baseline-skjema, «NY tabell — events», linje 142–155) — denne PRD-en oppfinner ikke kolonner, den fyller og leser tabellen.

To prinsipper er ufravikelige:

1. **Aggregert + anonym.** `session_id` er en ikke-personidentifiserende økt-nøkkel (PRD 1 `events.session_id`-kolonne, linje 154). INGEN individuell tracking uten samtykke (PRD 1 «NY tabell — events», linje 144: «Aggregert engasjement, ingen individuell tracking uten samtykke»). Lese-laget eksponerer kun aggregater (tellinger per board/kategori/tid), aldri rå per-sesjon-sekvenser som kan re-identifisere en bruker.
2. **Server-only skriv.** Events skrives via en server-action mot service-role-klienten — aldri direkte fra klient mot Supabase (CLAUDE.md arkitekturregel: «ALDRI query Supabase direkte fra klientkomponenter»). RLS gjør `events` INSERT-only for service-role (PRD 1 Unit 5 AC3); anon-skriv er blokkert på DB-nivå.

**Strategisk:** Dette er data-moat #2. Moat #1 er lokalkunnskap-IP (`place_knowledge`, PRD 8). Moat #2 er engasjements-statistikk: jo flere board som kjøres, jo mer vet Placy om hva som engasjerer en boligkjøper — kunnskap kunden ikke får andre steder, og som blir et IP-aktivum i term-sheet-sammenheng.

**Fasing (kritiker-patch linje 764 — «TIDLIG og serielt, ikke parallelt med avhengige PRD-er»):** Fase 1 kjøres TIDLIG og serielt i Lag 1, rett etter PRD 1: prototyp event-skjema-bruk + ÉN server-action-logg verifisert mot `events`-tabellen — INGEN board-avhengighet. Fase 2 venter til Lag 3 når board-skallet finnes (deps PRD 5 board-data + PRD 9 board-skall): da wires emit-sites inn og aggregerings-lese-laget bygges. Denne serielle plasseringen er bevisst — server-action-loggen vokser inn i board-PRD-ene (5, 9) (PRD 1 «NY tabell — events», linje 144: «slik at PRD 13 og board-PRD-ene (5, 9) kan logge mot det»), så den må eksistere og være verifisert FØR de avhengige PRD-ene wirer den.

---

## 2. Mål (Goals)

Hvert mål kobler til minst én konkret requirement (og dermed til en eller flere units i §7). Pekerne `(→ Gx)` i unitene refererer tilbake hit.

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Etabler ÉN server-side event-logger som skriver mot PRD 1s `events`-tabell uten ny migrasjon — verifisert TIDLIG og serielt i Lag 1. | `logEvent`-server-action + typet event-kontrakt (Unit 2) + prod-verifikasjon mot `events` (Unit 3). |
| **G2** | Gjør event-taksonomien (de fire startsett-typene) til én typet, validert kontrakt som matcher DB-CHECK-constrainten — ingen drift mellom TS og DB. | Event-type-union + payload-typer + parse-vakt mot `events.event_type`-CHECK (Unit 1). |
| **G3** | Generer en anonym, ikke-personidentifiserende `session_id` server-side uten cookie-samtykke-krav. | Server-side `session_id`-kilde (Unit 1) + injeksjon i loggeren (Unit 2). |
| **G4** | Wire de fire emit-sitene inn på board-flaten (board_viewed / category_opened / voiceover_played / poi_clicked) uten å bryte board-MVP-stien. | Emit-site-spec + fire fire-and-forget-kall fra board-skall (Unit 5), deps PRD 5/9. |
| **G5** | Lever et aggregerings-/lese-lag som gjør rå events til anonym engasjements-statistikk (tellinger per board/kategori/tid), aldri rå per-sesjon-sekvenser. | Aggregerings-spørringer i server-side query-wrapper (Unit 6). |
| **G6** | Hold instrumenteringen tier-agnostisk: ingen `reportTier`-gren i logger eller emit-sites; alle nivåer instrumenteres likt. | Tier-agnostisk logger-kontrakt (Unit 2) + tier-fri emit-site-spec (Unit 4). |
| **G7** | Bevis at logger + aggregering passerer alle mekaniske porter og at anonymitets-kontrakten holder. | Tester for logger/parse/aggregering + grønne lint/test/tsc (Unit 7). |

---

## 3. Arkitektur-/migrasjons-kontekst

I rebuild-mantraet **«del nedover stacken, diverger oppover i UX»** sitter instrumenteringen *langt nede i stacken*: event-logging er ALLTID delt — aldri forket per tier. Tier (nivå 1/2) er en deklarasjon + lett readiness-sjekk (PRD 2), ikke en bryter i loggeren. Et nivå-1-board og et nivå-2-board logger `board_viewed` på nøyaktig samme måte; det som divergerer er hvor mye UX-overflate det er å klikke på, ikke hvordan klikk logges.

**Render-laget gater ALDRI på `reportTier`** (verifisert: ingen `reportTier`-ref i `@/components/variants/report/board/BoardMap3D` eller `@/components/variants/report/reels/ReportReelsPage` — jf. PRD 1 Arkitektur-kontekst «render-laget gater ALDRI på `reportTier`», PRD 2 patch #2). Følgelig finnes det ingen tier-gren å speile i emit-sites heller. Nivå-2-kravet (kuratert editorial) fanges av den lette readiness-sjekken (PRD 2); VO/3D/camera er ortogonale render-flagg, ikke nivå-krav — ingen av dem er en gren i instrumenteringen.

**Migrasjons-kontekst:** Denne PRD-en kjører INGEN egen migrasjon. `events`-tabellen er allerede skapt i baseline-migrasjonen `070_baseline.sql` av PRD 1 (Unit 2 der; opprettes ferskt som `CREATE TABLE v2.events` i `v2`-schemaet — det er den ENESTE faktisk nye tabellen, PRD 1 «NY tabell — events» (linje 142–155) + Decision 6). Tabellen er altså **`v2.events`**, ikke `public.events`; PRD 13 arver PRD 1s `v2`-API-eksponering (Settings → API → Exposed schemas + `GRANT USAGE`/tabellrettigheter, PRD 1 Migrasjonsmekanikk linje 34) og targeter `v2` via `.schema('v2')`/`db:{schema:'v2'}` i alle skriv/les. Denne PRD-en skriver kun applikasjons-/server-kode som logger og leser mot den eksisterende `v2`-tabellen. Eventuell `events`-retensjon/partisjonering er bevisst utsatt (PRD 1 Deferred + Åpent spørsmål #1: «utsatt til volum tilsier det (prototype-stadium, ikke over-engineer)»).

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra PRD 13 |
|---------------|-------------------------------|
| `prd-board-data-state` (5) | Emit-site-kontrakten for `poi_clicked` + `category_opened` — leverer poi-/kategori-id-konteksten loggeren trenger (board-reducer-action-grensen, se §4). |
| `prd-board-skall-ui` (9) | Emit-site-spec (Unit 4) — wirer de fire `logEvent`-kallene inn i board-skall-handlerne (`handlePOIClick`, kategori-åpning, VO-start, board-mount). PRD 9 eier komponentene; denne PRD-en eier loggeren + spec-en. |
| Senere dashboard-PRD (deferred) | Aggregerings-/lese-laget (Unit 6) — `getEngagementStats`-grensen er kontrakten et fremtidig dashboard leser. |

### Oppstrøms-kontrakt (hva PRD 13 konsumerer)

| Oppstrøms-PRD | Hva PRD 13 konsumerer |
|---------------|------------------------|
| `prd-datamodell-supabase` (1) | `v2.events`-tabellen (8 kol, PRD 1 «NY tabell — events», linje 146–155) + `events`-indekser (`(project_id, created_at)`, `(event_type, created_at)`, PRD 1 Unit 2 AC2) + `events.event_type`-CHECK-constraint (PRD 1 Unit 2 AC3) + RLS INSERT-only-for-service-role (PRD 1 Unit 5 AC3) + `createServerClient()` med fail-fast-nøkkel-kontrakt (PRD 1 Unit 5 AC5). |

---

## 4. Eksisterende kodebase

> **100% greenfield for selve logikken.** Det finnes ingen event-logging, analytics-wrapper eller `events`-konsument i dagens kodebase (VERIFISERT: `grep` mot `@/lib/supabase/*` gir null event/track/analytic-treff; `package.json` har ingen analytics-dep). Denne seksjonen lister derfor (a) infrastrukturen PRD 13 bygger PÅ (eid av andre PRD-er), og (b) emit-site-ankerne på board-flaten der Fase 2 wirer kall inn.

### Bygges PÅ (eid av andre PRD-er — PRD 13 konsumerer, eier ikke)

| Objekt | @/-sti eller tabell | Eier | Rolle for PRD 13 |
|---|---|---|---|
| `events`-tabell (8 kol + indekser + CHECK) | `events` | PRD 1 | Skrive-/lese-mål. PRD 13 oppfinner ingen kolonner. |
| Service-role-klient | `@/lib/supabase/client` (`createServerClient`) | PRD 1 | Server-action-loggeren skriver gjennom denne (med fail-fast-nøkkel-kontrakt fra PRD 1 Unit 5). |
| Mutation-/query-wrappere | `@/lib/supabase/mutations`, `@/lib/supabase/queries` | PRD 1 (port) | Logger legges som ny funksjon her (skriv-side); aggregering som ny funksjon i queries (lese-side). |

### Emit-site-ankere på board-flaten (Fase 2 wirer kall inn — eid av PRD 9)

> Disse er IKKE keeper-kode PRD 13 porter; de er **eksisterende handler-punkter** der Fase 2 legger inn ett `logEvent`-kall hver. PRD 9 eier komponentene; PRD 13 leverer loggeren + spec-en for hvor kallene går.

| Emit-site (event_type) | Anker (verifisert i dagens kode) | Hva som logges |
|---|---|---|
| `poi_clicked` | `handlePOIClick`-`useCallback` i `@/components/variants/report/board/BoardMap3D` (verifisert: `handlePOIClick` på `:466`, `dispatch({ type: "OPEN_POI", id, categoryId })` på `:471`) | `poi_id` + `payload.category_id` |
| `category_opened` | UI-handleren som dispatcher `SELECT_CATEGORY` (action-type `board-state.tsx:43`, reducer-case rundt `:72`, kilder `SelectCategorySource` `board-state.tsx:40` = `scroll`/`rail`/`index`/`audio`). `board-state.tsx` EKSPONERER dispatch-grensen (`BoardContext`-interface `:124`, `createContext` `:152`) men EIER IKKE kalle-stedet — det kanoniske emit-punktet er én konkret handler, avklares med PRD 5/9 så to sites ikke teller samme kategori-åpning. | `payload.category_id` |
| `voiceover_played` | VO-PLAY-trigger (når bruker faktisk STARTER avspilling) i VO-orchestration (PRD 9 — uverifisert i rebuild-skall). **Merk:** `hasVoiceOver` (`BoardMap3D.tsx:261`, en `useMemo`-boolean) avgjør KUN OM VO-innhold FINNES — det er ikke en avspillings-HENDELSE og er feil anker for et play-event (ville fyrt «VO finnes» ved hver render). | `payload.voiceover_segment` |
| `board_viewed` | board-mount (RSC-/skall-grensen i board-siden, PRD 9) | (kun board-kontekst) |

> **VERIFISERINGSMERKE:** Den eksakte funksjonen som trigger `voiceover_played` (play-event) og board-mount-punktet for `board_viewed` lever i VO-orchestration / board-skall som PRD 9 eier og som ikke er ferdig-portet i rebuilden ennå — **(uverifisert i rebuild-skall — avklar emit-punkt sammen med PRD 9 i Fase 2)**. `handlePOIClick` (poi_clicked, `BoardMap3D.tsx:466` med `dispatch({ type: "OPEN_POI" … })` på `:471`) og `SELECT_CATEGORY`-dispatch (category_opened, action-type `board-state.tsx:43`) er derimot verifisert i dagens kode.

### Slettes / forlates

Ingen. Greenfield — det finnes ingen død instrumenterings-kode å fjerne.

---

## 5. Datakontrakt / Skjema

### 5.1 `v2.events`-tabellen (eid av PRD 1 — gjengitt som konsument-kontrakt)

Tabellen lever i `v2`-schemaet (`v2.events`, ikke `public.events`) — PRD 1 oppretter den ferskt i `v2` (PRD 1 «NY tabell — events», linje 142–155 + Decision 6). PRD 13 fyller og leser disse kolonnene via `.schema('v2')`/`db:{schema:'v2'}`; den **oppfinner ingen** (alle ordrett fra PRD 1 «NY tabell — events», linje 146–155):

| Kolonne | Type | Null | Hvordan PRD 13 bruker den |
|---|---|---|---|
| `id` | uuid (default `gen_random_uuid()`) | NO | DB-generert; loggeren setter den ikke. |
| `event_type` | text | NO | Settes til én av de fire startsett-typene (matcher DB-CHECK). |
| `project_id` | text | YES | Board-/prosjekt-kontekst (FK-løs, lik snapshot-konvensjon). |
| `product_id` | text | YES | Hvilket produkt/board. |
| `poi_id` | text | YES | Kun for `poi_clicked`. |
| `payload` | jsonb | YES | Hendelsesspesifikt: `{ category_id }`, `{ voiceover_segment }` osv. |
| `session_id` | text | YES | Anonym, ikke-personidentifiserende økt-nøkkel (G3). |
| `created_at` | timestamptz (default `now()`) | NO | DB-generert tidsstempel; loggeren setter den ikke. |

### 5.2 Event-type-taksonomi (felt PRD 13 eier — TS-siden av CHECK-constrainten)

PRD 1 Unit 2 AC3 (linje 184) setter en CHECK-constraint på `events.event_type` for startsettet `board_viewed`, `category_opened`, `voiceover_played`, `poi_clicked`. PRD 13 eier den TS-typede speilingen av dette settet — kontrakten som hindrer at koden insert-er en `event_type` DB-CHECK-en avviser:

```ts
// @/lib/instrumentation/event-types.ts (nytt — eid av PRD 13)
export const EVENT_TYPES = [
  "board_viewed",
  "category_opened",
  "voiceover_played",
  "poi_clicked",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
```

> **Drift-kontrakt:** `EVENT_TYPES` MÅ holde seg synkron med `events.event_type`-CHECK-en (PRD 1 Unit 2 AC3). Utvidelse av settet krever BÅDE en ny migrasjon (utvid CHECK, PRD 1 Unit 2 AC3 linje 184: «utvidbart via senere migrasjon») OG en bump her. Header-kommentaren i `event-types.ts` dokumenterer denne to-stegs-grensen.

### 5.3 Logger-kontrakten (server-action-grensen)

```ts
// @/lib/instrumentation/log-event.ts (nytt — "use server")
export interface LogEventInput {
  eventType: EventType;
  projectId?: string;
  productId?: string;
  poiId?: string;          // kun for poi_clicked
  payload?: Record<string, unknown>; // { category_id } | { voiceover_segment } | ...
}
// session_id injiseres server-side (§5.4), settes IKKE av kalleren.
export async function logEvent(input: LogEventInput): Promise<void>;
```

Kontrakt-egenskaper (verifiseres i Unit 2/7):
- **Server-only** (`"use server"`): skriver gjennom `createServerClient()`-service-role-klienten; aldri klient→Supabase direkte (CLAUDE.md-regel).
- **Fire-and-forget / fail-soft:** et feilet event-INSERT skal ALDRI velte board-rendringen. Loggeren fanger feil, logger dem (ikke stille swallow — CLAUDE.md: «ALLTID håndter error-tilstand»; ingen `return []`-stille-svelging som dagens `queries.ts:193`-mønster), og returnerer. Instrumentering er observabilitet, ikke en kritisk skrivesti. **Reconciliation med PRD 1 Decision 10 (`01-datamodell-supabase.md:304` — Beslutninger-tabellen):** PRD 1 velger fail-FAST på `createServerClient()` (kaster når `SUPABASE_SERVICE_ROLE_KEY` mangler) — det er korrekt for provisjon/admin-skrivestier, men instrumenteringen er IKKE en kritisk skrivesti. `logEvent` omslutter derfor HELE kroppen (inkl. selve `createServerClient()`-oppslaget) i try/catch, så fail-soft-kontrakten her holder uavhengig av om klient-oppslaget returnerer `null` (dagens kode) eller kaster (etter PRD 1-fixen). De to feil-filosofiene er dermed ikke i konflikt: provisjon fail-faster ved manglende nøkkel; instrumentering fail-softer rundt det samme kastet.
- **Tier-agnostisk:** ingen `reportTier`-parameter, ingen tier-gren (G6).

### 5.4 `session_id`-kilde (LANDET her — var åpen i PRD 1)

PRD 1 flagget `events.session_id`-kilden som åpen og deferret den hit (PRD 1 Åpent spørsmål #5, linje 359). **Beslutning (landet, se §9 Beslutning 4):** `session_id` genereres **server-side** og er en **ikke-personidentifiserende, kortlevd økt-nøkkel** — ingen cookie-samtykke kreves fordi nøkkelen ikke kan re-identifisere en person og ikke persisteres som identifikator på tvers av økter. Konkret: en opaque random-verdi per board-render-økt, ikke knyttet til IP, e-post eller bruker-id. Dette holder kontrakten «anonym, ingen individuell tracking uten samtykke» (PRD 1 «NY tabell — events», linje 144) sann uten consent-flow.

> Individuell, samtykke-basert tracking (persistent bruker-id på tvers av økter) er bevisst DEFERRED (se §6) til en consent-strategi finnes — den endrer personvern-kontrakten og skal ikke bakes inn nå.

### 5.5 Aggregerings-/lese-kontrakten (lese-laget)

```ts
// @/lib/supabase/queries.ts (ny funksjon — lese-side)
export interface EngagementStats {
  boardViews: number;
  categoryOpensByCategory: Record<string, number>;
  voiceoverPlays: number;
  poiClicksByPoi: Record<string, number>;
  // tellinger per tidsvindu (dag), aldri rå per-sesjon-sekvenser
}
export async function getEngagementStats(
  projectId: string,
  opts?: { since?: Date; until?: Date },
): Promise<EngagementStats>;
```

Kontrakt-egenskaper:
- **Kun aggregater.** Returnerer tellinger (per kategori/poi/tidsvindu), ALDRI rå `session_id`-sekvenser eller per-bruker-spor (G5 + personvern-kontrakt PRD 1 «NY tabell — events», linje 144).
- **Spørrings-effektiv på filteret:** filteret (`project_id` + `event_type` + `created_at`-vindu) bruker PRD 1s top-level-indekser `(project_id, created_at)` og `(event_type, created_at)` (PRD 1 Unit 2 AC2). MERK: per-kategori-`GROUP BY` på `payload->>'category_id'` er ikke indeks-dekket (jsonb-uttrykk) — akseptabelt på prototype-volum; uttrykks-indeks er deferred (jf. Unit 6 AC2 + samme volum-deferral som PRD 1 Deferred / Åpent spørsmål #1 om `events`-retensjon).
- **Server-side, eksplisitt error-handling:** kjører gjennom `createServerClient()`; feilet henting gir tydelig feil + logging, ikke stille tom statistikk.

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. Event-type-taksonomien (TS-speiling av `events.event_type`-CHECK) + payload-typer + parse-vakt (Unit 1).
2. Server-side `session_id`-kilde (Unit 1).
3. ÉN server-action event-logger (`logEvent`) som skriver mot `events` via service-role-klient (Unit 2).
4. Tidlig/serielt prod-verifisert logg mot `events`-tabellen — Lag 1, ingen board-avhengighet (Unit 3).
5. Emit-site-spec (hvor de fire kallene går på board-flaten) (Unit 4).
6. Faktisk innwiring av de fire emit-sitene i board-skallet — Lag 3, deps PRD 5/9 (Unit 5).
7. Aggregerings-/lese-lag (`getEngagementStats`) som gjør rå events til anonym engasjements-statistikk (Unit 6).
8. Tester + mekaniske porter for logger/parse/aggregering (Unit 7).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Dashboards / visualisering av engasjements-statistikk (UI som leser `getEngagementStats`) | **Egen senere dashboard-PRD** (ikke nummerert i 00-INDEX ennå; aggregerings-lese-laget her er kontrakten den bygger på) |
| Individuell, samtykke-basert tracking (persistent bruker-id på tvers av økter, consent-flow) | **Avklares når consent-strategi finnes** (egen oppgave; endrer personvern-kontrakten i PRD 1 «NY tabell — events», linje 144 — skal ikke bakes inn nå) |
| `events`-retensjon / partisjonering | **PRD 1** (Deferred-tabell + Åpent spørsmål #1 — utsatt til volum tilsier det; prototype-stadium) |
| Utvidelse av event-type-settet (nye `event_type`-verdier) | Krever ny migrasjon (utvid `events.event_type`-CHECK, PRD 1 Unit 2 AC3 linje 184) + bump av `EVENT_TYPES` — egen oppgave per ny type |
| Faktisk `voiceover_played`-play-trigger + `board_viewed`-mount-punkt i board-skallet | **PRD 9** (eier VO-orchestration + board-skall-komponentene; PRD 13 leverer loggeren + spec, PRD 9 wirer i Fase 2) |

**Eksplisitt ikke-scope:** render-gating på `reportTier` (eksisterer ikke, skal ikke bygges — PRD 1 Arkitektur-kontekst «render-laget gater ALDRI på `reportTier`», PRD 2 patch #2). Instrumenteringen er tier-agnostisk; tier-krav fanges av validatoren (PRD 2), ikke av loggeren.

---

## 7. Implementation Units (7 av maks 8)

### Unit 1 — Event-type-taksonomi + payload-typer + server-side session_id
- **Mål (→ G2, G3, G6):** Etabler den typede event-kontrakten (TS-speiling av DB-CHECK) + payload-typer + en server-side, anonym `session_id`-kilde. Ingen board-avhengighet — kjøres i Lag 1.
- **Filer:** `@/lib/instrumentation/event-types.ts` (nytt), `@/lib/instrumentation/session-id.ts` (nytt).
- **Avhengigheter:** PRD 1 (kjenner `events.event_type`-CHECK-settet + kolonne-shape).
- **Akseptansekriterier:**
  1. `EVENT_TYPES` er en `as const`-tuple med nøyaktig de fire startsett-typene (`board_viewed`, `category_opened`, `voiceover_played`, `poi_clicked`) — identisk med PRD 1 Unit 2 AC3-CHECK-settet (PRD 1 Unit 2 AC3, linje 184). `EventType` er avledet (`(typeof EVENT_TYPES)[number]`), ikke en duplikat-union.
  2. En parse-vakt (f.eks. `isEventType(x): x is EventType`) avviser verdier utenfor settet — så koden aldri sender en `event_type` DB-CHECK-en ville rejecte.
  3. Payload-typer for `category_opened` (`{ category_id: string }`) og `voiceover_played` (`{ voiceover_segment: string }`) er typet; `board_viewed` har tom/ingen payload.
  4. `session-id.ts` genererer en opaque, ikke-personidentifiserende verdi server-side (ikke knyttet til IP/e-post/bruker-id, ikke persistert som tverr-økt-identifikator) — jf. §5.4. Ingen sensitiv data i Zustand (CLAUDE.md) — session_id lever kun server-side / i events-raden.
  5. Header-kommentar dokumenterer to-stegs-utvidelses-grensen (migrasjon-CHECK + `EVENT_TYPES`-bump).

### Unit 2 — `logEvent`-server-action (skrive-loggeren)
- **Mål (→ G1, G3, G6):** ÉN server-side logger som skriver et event mot `events`-tabellen via service-role-klient, fail-soft og tier-agnostisk.
- **Filer:** `@/lib/instrumentation/log-event.ts` (nytt, `"use server"`).
- **Avhengigheter:** Unit 1; PRD 1 (`events`-tabell + `createServerClient()` med fail-fast-nøkkel).
- **Akseptansekriterier:**
  1. `logEvent(input: LogEventInput)` (§5.3) skriver gjennom `@/lib/supabase/client`-`createServerClient()` (service-role) **targetet mot `v2`-schemaet** — INSERT-en går mot `v2.events` via `.schema('v2').from('events')` (eller `db: { schema: 'v2' }` i klient-konfigen), aldri mot `public.events` (jf. PRD 1 Migrasjonsmekanikk — `v2`-wrapperne targeter `v2` via `.schema('v2')`/`db:{schema:'v2'}`, PRD 1 Unit 6 AC3). ALDRI `@supabase/supabase-js` direkte, ALDRI `public-client`, ALDRI klient→Supabase (CLAUDE.md-regler).
  2. `session_id` injiseres internt fra Unit 1s kilde — kalleren setter den IKKE.
  3. **Fail-soft + eksplisitt error-handling (omslutter HELE kroppen, inkl. `createServerClient()`-oppslaget):** `logEvent` wrapper hele kroppen i try/catch slik at fail-soft-garantien holder BÅDE når `createServerClient()` returnerer `null` (dagens kode, `client.ts:30`-anon-fallback) OG når den KASTER (etter PRD 1 Decision 10-fixen, `01-datamodell-supabase.md:304` + PRD 1 Unit 5 AC5 — fjern anon-fallback → fail-fast på manglende `SUPABASE_SERVICE_ROLE_KEY`). Begge utfall (null ELLER throw) håndteres: et manglende-service-role-nøkkel-kast i instrumenterings-stien logges, men velter ALDRI board. Et feilet INSERT fanges på samme måte, logges (ikke stille swallow — CLAUDE.md «ALLTID håndter error-tilstand»), og loggeren returnerer uten å kaste. Et logge-feil velter ALDRI board-rendringen.
  4. `event_type` valideres mot `isEventType` (Unit 1) før INSERT.
  5. Ingen `reportTier`-parameter eller tier-gren (tier-agnostisk, G6).
  6. `npx tsc --noEmit` 0 feil for de nye filene.

### Unit 3 — Tidlig prod-verifisering av loggeren (Lag 1, serielt)
- **Mål (→ G1):** Bevis at loggeren faktisk skriver mot prod-`events`-tabellen FØR noen board-PRD wirer den. Dette er kritiker-patch-kravet «én server-action-logg verifisert TIDLIG og serielt» (CARRY-OVER linje 764).
- **Filer:** `@/scripts/verify-log-event.ts` (nytt, engangs-/CI-verifikasjons-script), `@/docs/rebuild/instrumentering-verify-runbook.md` (nytt).
- **Avhengigheter:** Unit 2; PRD 1 Fase 3 (`events`-tabell live i prod, RLS aktiv).
- **Akseptansekriterier:**
  1. Scriptet kaller `logEvent` med en test-event (f.eks. `board_viewed` med en `project_id` for et test-board) via service-role.
  2. Verifiser via service-role REST at raden finnes i `v2.events` med riktig `event_type`, `created_at` satt av DB, og `session_id` populert. Rå REST mot `v2`-schemaet krever schema-header (`Accept-Profile: v2` ved les, `Content-Profile: v2` ved skriv — jf. PRD 1 Migrasjonsmekanikk / PRD 1 Fase 3-verifikasjon):
     `curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/events?event_type=eq.board_viewed&select=id,event_type,session_id,created_at&limit=1" -H "Accept-Profile: v2" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"` returnerer 200 med raden. (En direkte anon-INSERT-røyktest i AC3 bruker tilsvarende `-H "Content-Profile: v2"` for å treffe `v2.events`.)
  3. **RLS-røyktest:** anon-rollen kan IKKE INSERT-e til `events` (INSERT-only-for-service-role, PRD 1 Unit 5 AC3) — bekreft 401/403/policy-feil ved anon-INSERT-forsøk.
  4. Runbook dokumenterer at dette kjøres serielt i Lag 1, og at test-rader ryddes (eller markeres) etterpå så de ikke forurenser ekte aggregering.

### Unit 4 — Emit-site-spec (hvor de fire kallene går)
- **Mål (→ G4, G6):** DEKLARER de fire emit-sitene som spec — separert fra IMPLEMENTASJON (Unit 5 / PRD 9) — så PRD 9 og PRD 13 ikke kolliderer på board-komponent-filer (Agent-Teams-regel: «hver teammate eier sine egne filer»).
- **Filer:** `@/docs/rebuild/instrumentering-emit-sites.md` (nytt).
- **Avhengigheter:** Unit 1 (kjenner event-typene); koordineres med PRD 5/9 (eier ankerne).
- **Akseptansekriterier:**
  1. Spec-en lister de fire emit-sitene med verifisert anker (jf. §4-tabellen): `poi_clicked` → `handlePOIClick` (`BoardMap3D.tsx:466`, dispatch `:471`), `category_opened` → `SELECT_CATEGORY`-dispatch fra UI-handler (action-type `board-state.tsx:43`; `board-state.tsx` eier dispatch-grensen `:124`/`:152` men ikke kalle-stedet), `voiceover_played` → VO-play-trigger (PRD 9, uverifisert-i-rebuild-skall — markeres «avklar med PRD 9»; IKKE `hasVoiceOver:261` som kun er en innhold-finnes-boolean), `board_viewed` → board-mount (PRD 9).
  2. Spec-en slår fast at hvert kall er **fire-and-forget** (ikke `await`-blokkerende på render-stien) og **tier-agnostisk** (samme på alle nivåer — ingen `reportTier`-gren). Spec-en presiserer KALLE-MØNSTERET eksplisitt: et u-await-et `"use server"`-kall fra en klient-handler er en kjent Next.js-fallgruve (floating promise — kan gi unhandled rejection, og React garanterer ikke fullføring ved rask unmount/navigasjon). Mønsteret er derfor `void logEvent(...).catch(() => {})` (eller tilsvarende `.catch`-bundet) på kallesiden, slik at en rejection ALDRI blir unhandled — selv om `logEvent` skulle kaste før sin egen try/catch tar over. `logEvent` må i tillegg være robust mot å bli kalt-og-forlatt (ingen ressurs som krever cleanup). Det finnes ingen presedens i dagens kodebase (`grep` etter `void logEvent`/`fireAndForget` gir null treff) — spec-en er kontrakten implementatoren følger.
  3. Spec-en mapper hver emit-site til hvilke `events`-felt/payload den fyller (poi_clicked → `poi_id` + `payload.category_id`; category_opened → `payload.category_id`; voiceover_played → `payload.voiceover_segment`; board_viewed → kun board-kontekst).
  4. Spec-en peker eksplisitt til PRD 9 som eier av komponentene der `logEvent`-kallene faktisk plasseres (Unit 5).

### Unit 5 — Innwiring av emit-sites i board-skallet (Lag 3)
- **Mål (→ G4):** Plasser de fire `logEvent`-kallene på ankerne i board-skallet uten å bryte board-MVP-stien.
- **Filer:** emit-site-handlerne i board-skallet (eid av PRD 9 — f.eks. `@/components/variants/report/board/BoardMap3D` `handlePOIClick`, board-reducer-grensen i `board-state`, VO-orchestration, board-mount). PRD 13 leverer kallene; koordineres med PRD 9.
- **Avhengigheter:** Unit 2 (loggeren), Unit 4 (spec); PRD 5 (poi-/kategori-kontekst-data), PRD 9 (board-skall-komponentene + VO-orchestration).
- **Akseptansekriterier:**
  1. `poi_clicked` logges fra `handlePOIClick` med `poi_id` + `payload.category_id` (verifisert anker: `handlePOIClick`-`useCallback` i `BoardMap3D.tsx:466`, `dispatch({ type: "OPEN_POI" … })` på `BoardMap3D.tsx:471`; kallet er fire-and-forget, blokkerer ikke `dispatch`). Kalle-mønster: `void logEvent(...).catch(() => {})` (Unit 4 AC2) — floating-promise-rejection blir aldri unhandled.
  2. `category_opened` logges der `SELECT_CATEGORY` dispatches fra UI-handleren (action-type `board-state.tsx:43`; det kanoniske emit-punktet — én konkret handler blant `SelectCategorySource`-kildene — avklares med PRD 5/9 så to sites ikke teller samme åpning). Kalle-mønster: `void logEvent(...).catch(() => {})`.
  3. `voiceover_played` logges ved VO-play-trigger (PRD 9 VO-orchestration — emit-punkt avklart sammen med PRD 9 per Unit 4-merket).
  4. `board_viewed` logges én gang ved board-mount (RSC-/skall-grensen, PRD 9).
  5. **Ingen regresjon på board-MVP:** alle kall er fire-and-forget/fail-soft (Unit 2 AC3) — et logge-feil velter ALDRI board-rendringen. Board-MVP-stien (`BoardMap3D`, `ReportReelsPage`, board-data) fungerer uendret med og uten at events-skriv lykkes.
  6. Ingen `reportTier`-gren i noen av de fire kallene (tier-agnostisk).

### Unit 6 — Aggregerings-/lese-lag (engasjements-statistikk)
- **Mål (→ G5):** Gjør rå events til anonym engasjements-statistikk — tellinger per board/kategori/poi/tidsvindu, aldri rå per-sesjon-sekvenser.
- **Filer:** `@/lib/supabase/queries.ts` (ny funksjon `getEngagementStats`).
- **Avhengigheter:** PRD 1 (`events` + indekser); **PRD 1 Unit 6 (`v2`-wrappere skrevet mot `v2`; gammel `public`-rettet `queries.ts`-trim med 54 legacy-refs er cutover, ikke baseline — `01-datamodell-supabase.md:222-231`) bør være LANDET / koordinert før `getEngagementStats` legges til `queries.ts`, ellers koordiner serielt så de to ikke kolliderer på `@/lib/supabase/queries.ts`. `getEngagementStats` targeter selv `v2` via `.schema('v2')` (PRD 1 Unit 6 AC3).** Kan bygges parallelt med Unit 4/5 (leser tabellen, ikke emit-sitene).
- **Akseptansekriterier:**
  1. `getEngagementStats(projectId, opts?)` (§5.5) returnerer kun **aggregater** (tellinger per kategori/poi/tidsvindu) — ALDRI rå `session_id`-sekvenser eller per-bruker-spor (personvern-kontrakt PRD 1 «NY tabell — events», linje 144).
  2. **Leser fra `v2.events`:** `getEngagementStats` targeter `v2`-schemaet (`.schema('v2').from('events')` / `db: { schema: 'v2' }`), aldri `public.events` (jf. PRD 1 Migrasjonsmekanikk — `v2`-wrapperne targeter `v2`, PRD 1 Unit 6 AC3). **Filteret** (`project_id` + `event_type` + `created_at`-vindu) utnytter PRD 1s top-level-indekser (`(project_id, created_at)`, `(event_type, created_at)`, PRD 1 Unit 2 AC2) — verifiser at filteret bruker disse. **Per-kategori-aggregeringen** grupperer derimot på `payload->>'category_id'` (et jsonb-uttrykk) som IKKE er dekket av noen av de to top-level-indeksene — akseptabelt på prototype-volum. En partiell/uttrykks-indeks på `(event_type, (payload->>'category_id'))` er en deferred optimalisering når volum tilsier det (samme volum-deferral som PRD 1 Deferred / Åpent spørsmål #1 om `events`-retensjon). `poiClicksByPoi` grupperer på `poi_id` (top-level-kolonne) og er uberørt av dette. `category_id` forblir på `payload.category_id` (top-nivå i `payload`-konvolutten) selv når den åpne kontekst-konvolutten (`payload.context.*`, jf. §«Moat-perspektiv») legges til senere — aggregeringsstien (`payload->>'category_id'`) er dermed stabil og brytes ikke av at konvolutten utvides.
  3. **Eksplisitt error-handling:** kjører gjennom `createServerClient()`; feilet henting gir tydelig feil + logging, IKKE stille tomt resultat (ingen `return []`-svelging à la `queries.ts:193`).
  4. Funksjonen er server-side (kalles fra server component/action — aldri `useEffect`-fetch, CLAUDE.md).

### Unit 7 — Tester + mekaniske porter
- **Mål (→ G7):** Bevis at logger + parse + aggregering passerer alle porter og at anonymitets-kontrakten holder.
- **Filer:** `@/lib/instrumentation/log-event.test.ts` (nytt), `@/lib/instrumentation/event-types.test.ts` (nytt).
- **Avhengigheter:** Unit 1, 2, 6.
- **Akseptansekriterier:**
  1. `isEventType` aksepterer de fire startsett-typene og avviser en ukjent verdi (`"foo"`, `"3"`).
  2. `logEvent` med en ugyldig `event_type` skriver IKKE (parse-vakt fanger den) og kaster ikke (fail-soft).
  3. Test bekrefter at `logEvent` injiserer `session_id` server-side (kalleren satte den ikke) og at den er ikke-tom + ikke-personidentifiserende-formet (opaque).
  4. Test bekrefter at `getEngagementStats` returnerer aggregat-shapen (`EngagementStats`) og ikke eksponerer rå `session_id`-er.
  5. `npm run lint` (0 errors), `npm test`, `npx tsc --noEmit` grønne for instrumenterings-modulen.

> **Fullstendighet:** 7 av 7 units dekket. Alle fire emit-sites (board_viewed/category_opened/voiceover_played/poi_clicked) er eksplisitt spec-et (Unit 4) og wiret (Unit 5); skrive-lag (Unit 2), tidlig prod-verifisering (Unit 3), lese-/aggregerings-lag (Unit 6) og porter (Unit 7) dekket. Ingen sampling.

---

## 8. Goals → Requirements-kobling

| Goal | Leveres av (unit / requirement) |
|---|---|
| **G1.** ÉN server-side logger mot `events`, verifisert TIDLIG/serielt | Unit 2 (`logEvent`) + Unit 3 (prod-verifisering Lag 1) |
| **G2.** Typet event-taksonomi synkron med DB-CHECK | Unit 1 (`EVENT_TYPES` + parse-vakt) |
| **G3.** Anonym, server-side `session_id` uten consent-krav | Unit 1 (`session-id.ts`) + Unit 2 (injeksjon) |
| **G4.** Fire emit-sites wiret på board-flaten | Unit 4 (spec) + Unit 5 (innwiring, deps PRD 5/9) |
| **G5.** Aggregerings-lese-lag (kun aggregater) | Unit 6 (`getEngagementStats`) |
| **G6.** Tier-agnostisk instrumentering (ingen `reportTier`-gren) | Unit 2 (logger-kontrakt) + Unit 4 (tier-fri emit-spec) |
| **G7.** Mekaniske porter + anonymitets-kontrakt bevist | Unit 7 (tester + lint/test/tsc) |

---

## 9. Utviklingsløp (faser)

### Fase 1 — Logger-kjerne (Lag 1, TIDLIG + serielt)
- **Mål:** Event-taksonomi + server-side `session_id` + ÉN `logEvent`-server-action + tidlig prod-verifisering mot `events`-tabellen. **Ingen board-avhengighet** — kjøres serielt rett etter PRD 1, FØR de avhengige board-PRD-ene (kritiker-patch linje 764).
- **Leveranse:** Unit 1, 2, 3 (+ test-delen i Unit 7 for logger/parse).
- **Autonomi-nivå:** Høy. Greenfield, ren server-kode forankret i PRD 1s `events`-skjema; eneste prod-touch er en verifiserings-INSERT (Unit 3) som ryddes.

### Fase 2 — Emit-sites + innwiring (Lag 3, deps PRD 5/9)
- **Mål:** Emit-site-spec landet og de fire kallene wiret inn i board-skallet uten regresjon på board-MVP.
- **Leveranse:** Unit 4, 5.
- **Autonomi-nivå:** Medium. Krever koordinering med PRD 9 (eier board-komponentene + VO-orchestration) og PRD 5 (poi-/kategori-kontekst). VO-play- og board-mount-emit-punktene avklares sammen med PRD 9 (uverifisert i rebuild-skall i dag).

### Fase 3 — Aggregerings-lese-lag
- **Mål:** `getEngagementStats` leverer anonym engasjements-statistikk; mekaniske porter grønne.
- **Leveranse:** Unit 6 + resterende Unit 7.
- **Autonomi-nivå:** Høy. Leser `events` via PRD 1s indekser; kan bygges parallelt med Fase 2 (avhenger av tabellen, ikke av emit-sitene). Dashboard-konsument er deferred.

---

## 10. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | Instrumentering er DELT, tier-agnostisk — ingen `reportTier`-gren i logger eller emit-sites | «Del nedover stacken»; render-laget gater ikke på tier (PRD 1 Arkitektur-kontekst «render-laget gater ALDRI på `reportTier`», PRD 2 patch #2). Tier-krav fanges av validator (PRD 2). |
| 2 | ÉN server-action-logger; skrive kun via service-role-klient | CLAUDE.md: aldri klient→Supabase direkte; RLS gjør `events` INSERT-only-for-service-role (PRD 1 Unit 5 AC3). |
| 3 | Logger er fail-soft (fire-and-forget) men logger feil (ikke stille swallow) | Instrumentering er observabilitet, ikke kritisk skrivesti — et logge-feil skal aldri velte board. Men CLAUDE.md krever error-håndtering (ingen `queries.ts:193`-stille-svelging). |
| 4 | `session_id` genereres server-side, anonym/ikke-personidentifiserende, ingen consent-flow | Lukker PRD 1 Åpent spørsmål #5 (linje 359). Holder personvern-kontrakten (PRD 1 «NY tabell — events», linje 144) sann uten samtykke; individuell tracking er deferred. |
| 5 | `EVENT_TYPES` er TS-speiling av DB-CHECK; utvidelse = migrasjon + bump (to steg) | Hindrer drift mellom TS og `events.event_type`-CHECK (PRD 1 Unit 2 AC3, linje 184); ingen runtime-LLM/ad-hoc-typer. |
| 6 | Fire startsett-event-typer (board_viewed/category_opened/voiceover_played/poi_clicked) | Eksakt settet PRD 1 prototyper i CHECK-en (PRD 1 `events.event_type`-kolonne linje 149 + Unit 2 AC3 linje 184); utvidbart senere via migrasjon. |
| 7 | Tidlig prod-verifisering (Unit 3) FØR board-PRD-er wirer loggeren | Kritiker-patch linje 764: «én server-action-logg verifisert TIDLIG og serielt»; loggeren vokser inn i PRD 5/9 (PRD 1 «NY tabell — events», linje 144: «board-PRD-ene (5, 9) kan logge mot det») og må være bevist først. |
| 8 | Aggregerings-lese-lag returnerer KUN aggregater, aldri rå per-sesjon-sekvenser | Personvern-kontrakt (PRD 1 «NY tabell — events», linje 144); rå sekvenser kan re-identifisere. Dashboards er deferred konsument. |
| 9 | Emit-site-SPEC (Unit 4) skilt fra IMPLEMENTASJON (Unit 5 / PRD 9) | Unngår fil-kollisjon på board-komponenter (Agent-Teams-regel); PRD 9 eier komponentene, PRD 13 eier loggeren + spec. |
| 10 | Ingen egen migrasjon i denne PRD-en | `v2.events`-tabellen skapes i PRD 1s `070_baseline.sql` (PRD 1 Unit 2 + Decision 6, «`events`-tabell i baseline fra linje 1 (`v2.events`)»); PRD 13 skriver kun app-/server-kode mot `v2`. |

---

## 11. Åpne spørsmål

1. **(ikke-blokkerende for Fase 1)** `voiceover_played`-play-trigger + `board_viewed`-mount-punkt i rebuild-skallet er ikke ferdig-portet (VO-orchestration + board-side eies av PRD 9). Emit-punktene avklares sammen med PRD 9 i Fase 2 (jf. §4-VERIFISERINGSMERKE). Påvirker ikke Fase 1 (logger + verifisering har ingen board-avhengighet).
2. **(ikke-blokkerende, avklares i Fase 2 med PRD 9)** Floating server-action-semantikk: et u-await-et `logEvent`-kall fra en klient-handler (`handlePOIClick`) er en kjent Next.js-fallgruve. Kalle-mønsteret `void logEvent(...).catch(() => {})` (Unit 4 AC2 / Unit 5 AC1) dekker unhandled-rejection-risikoen. ÅPENT: bør `board_viewed` (mount-event) heller emittes fra RSC-/server-grensen (der server-action-semantikken er pålitelig) fremfor en klient-handler? Avklares når PRD 9 lander board-mount-punktet (jf. §4-VERIFISERINGSMERKE).
3. **(ikke-blokkerende)** Test-rad-rydding etter Unit 3-verifisering: bør verifiserings-events markeres (f.eks. `payload.test=true`) og ekskluderes i `getEngagementStats`, eller slettes? Default: marker + ekskluder i aggregering. Bekreft i Unit 3-runbook.
4. **(deferred — endrer personvern-kontrakt)** Individuell, samtykke-basert tracking (persistent bruker-id på tvers av økter) avventer en consent-strategi (§6 Deferred). Flagges, løses ikke her.
5. **(deferred til volum)** `events`-retensjon/partisjonering — PRD 1 Deferred-tabell + Åpent spørsmål #1. Ikke over-engineer på prototype-stadium.

---

## 12. Avhengigheter (PRD-graf)

```
        prd-datamodell-supabase (PRD 1)
                  │  (events-tabell + indekser + event_type-CHECK +
                  │   RLS INSERT-only-service-role + createServerClient fail-fast)
                  ▼
        ┌── prd-instrumentering (PRD 13 — DENNE) ──┐
        │   Fase 1 (Lag 1, TIDLIG+serielt):         │
        │   Unit 1 (typer+session) → Unit 2 (logger)│
        │                 → Unit 3 (prod-verifisert) │
        │                                            │
        │   Fase 3 (parallelt-mulig): Unit 6 (aggreg)│
        └────────────────────┬───────────────────────┘
                             │ Fase 2 (Lag 3):
                             │ Unit 4 (emit-spec) → Unit 5 (innwiring)
              ┌──────────────┴───────────────┐
              ▼                               ▼
     prd-board-data-state (5)        prd-board-skall-ui (9)
     (poi-/kategori-kontekst         (eier emit-site-ankerne:
      for poi_clicked/category)       handlePOIClick, VO-orchestration,
                                       board-mount; wirer logEvent inn)
                             │
                             ▼
              (senere dashboard-PRD — deferred konsument
               av getEngagementStats-aggregerings-laget)
```

**Blokkeres av:** PRD 1 (`events`-tabell + RLS + service-role-klient). Fase 2 koordineres med PRD 5 + PRD 9.
**Blokkerer:** ingen hard-blokk; PRD 5/9 KONSUMERER emit-site-kontrakten men kan bygge sine board-deler uten at events-skriv er wiret (fire-and-forget, ikke kritisk sti).
**Konsumerer fra (eier ikke):** `events`-skjema + indekser + CHECK + RLS + `createServerClient` fra PRD 1.

---

**Fullstendighet:** 7 av 7 implementation units spesifisert med Avhengigheter + Akseptansekriterier; 7 av 7 mål (G1–G7) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i `prod-schema-snapshot.txt` (ingen events-tabell blant 24 — greenfield), `package.json` (ingen analytics-dep), `CARRY-OVER-MANIFEST.md` (linje 764 greenfield+tidlig/serielt), `docs/rebuild/prd/01-datamodell-supabase.md` (events-skjema «NY tabell — events» linje 142–155, RLS Unit 5 AC3, klient-nøkkel-kontrakt Unit 5 AC5, indekser Unit 2 AC2 / CHECK Unit 2 AC3 linje 184, Decision 10 fail-fast linje 304, session_id-deferral Åpent spørsmål #5 linje 359, personvern linje 144), og faktisk kode (`BoardMap3D.tsx:466` handlePOIClick + `:471` OPEN_POI-dispatch, `board-state.tsx:43` SELECT_CATEGORY-action + `:124`/`:152` BoardContext-dispatch-grense, `client.ts:30` nøkkel-fallback, `queries.ts:193` stille-svelge-mønster som IKKE arves). Uverifiserte emit-punkter (VO-play, board-mount i rebuild-skall) eksplisitt markert «(uverifisert — avklar med PRD 9)». Ingen P0/P1/P2-tiers; deferred work under §6 med pekere; ingen render-gating spesifisert.

---

### Moat-perspektiv (forretningsutvikling 2026-06-28) — fremtidig retning, IKKE build-nå

> **Ramme (eier 2026-06-28):** Dette er ferske innsikter fra forretningsutvikler-møter, tatt inn som **retning** — ikke som build-ordre. Lite skal bygges konkret nå; perspektivene skal være *med* så rebuilden har dem i syne mens Moat 2 (Innsikt) jobbes videre. Full design: **`docs/rebuild/moat-2-innsikt-build-input.md`**.

Arkitekturen i denne PRD-en er bekreftet på linje med moat-designen (én sentral event-strøm sliced per board, anonym/aggregert, server-only, instrumentert fra Lag 1). Det rapporten legger til som *fremtidig retning* (når Moat 2 jobbes videre):

- **Rikere signaler:** de to høyest-verdt («⭐⭐») er `route_requested` («fra boligen til X» → hvilke destinasjoner betyr noe) og `search_intent` («hva leter du etter»-nudge → demand boardet ikke viser). Sekundært: `travel_mode_changed`, `map_viewport` (heat maps), retur-besøk. Utvidelse skjer via CHECK + `EVENT_TYPES`-bump (mekanismen finnes alt) — ikke nå.
- **Strøk-aggregering:** per-board er anekdote; strøk-aggregatet *er* moaten. `getStrokEngagement` ved siden av per-board, når det jobbes videre.
- **UX-som-instrument:** travel-mode-synlighet + presentert kategori-rekkefølge er signal-genererende flater (PRD 5/9) — relevant retning når board-UX videreutvikles.

> **⚠ Det ENE tids-følsomme (ikke build-nå, men en form-beslutning ved bygging):** **kontekst-konvolutten.** Et rått klikk er confounded (Ranheim-skole-langs-Ladestien). Rapporten anbefaler at hvert event bærer brukerens tilstand (`mode`, aktive kategorier, `travel_mode`, `time_budget`, `map_center/zoom`, `home_anchored`) i `payload.context`. `payload` er allerede jsonb → å holde formen ÅPEN koster ingenting, men **data logget uten kontekst kan aldri få den tilbake.** Konsekvens: NÅR Fase-1-loggeren faktisk bygges, er dette beslutningen å ta da — ikke lås event-formen til en naken `{category_id}` som permanent kontekstløser den konsentrerte Ranheim-tidlig-volumen (selve valideringsdataen). Ingen handling kreves før Fase 1 bygges; flagget her så det ikke tapes.
