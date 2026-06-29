# Moat 2 (Innsikt) — strategi → build-input for rebuilden

> **Dato:** 2026-06-28
> **Type:** Strategi→build-bro. Kobler forretnings-/produktdesignet av Moat 2 til de eksisterende rebuild-PRD-ene. **Ikke en ny PRD** — input til `prd/13-instrumentering.md` + `prd/01-datamodell-supabase.md` (events-skjema), berører PRD 5 + 9 (emit-sites/UX).
> **Kilder:** `docs/strategy/2026-06-27-data-moatene-lokalkunnskap-innsikt.md` (Innsikt-seksjon + tracking-katalog A–F + per-board-arkitektur + skjerpingen 2026-06-28), memory `project_placy_grunnpakke_chain_model`.
> **Mål:** At event-skjemaet og signal-settet er rikt nok til å bære Moat 2 slik den nå er designet — **før** PRD 1/13 bygges. Dette er den ene tidskritiske moat-avklaringen.

---

## ⚠️ TL;DR — det viktigste i hele rebuild-runden for moat-IP

PRD 13 har **arkitekturen riktig** (ÉN sentral events-strøm sliced per board, ikke siloer; anonym/aggregert; server-only; instrumentert fra Lag 1). Men **event-skjemaet er for tynt for Moat 2 slik vi designet den 2026-06-27/28:**

1. **Ingen kontekst-konvolutt** → events er confounded fra dag 1 (Ranheim skole langs Ladestien-problemet). **Billig å fikse (payload er jsonb, ingen migrasjon), men umulig å reparere i ettertid.**
2. **De to ⭐⭐-signalene mangler** — `route_requested` («fra boligen til X») og `search_intent` («hva leter du etter»-nudge) er ikke i event-settet. Hele Moat-2-tesen hviler på dem.
3. **Ingen viewport-capture** → ingen heat maps.
4. **Ingen strøk-aggregering** — `getEngagementStats` tar kun `projectId`. Strøk-aggregatet *er* moaten (per-board er anekdote).

**«Data du ikke logger finnes ikke.»** Fase 1 av PRD 13 (logger-kjerne, Lag 1, TIDLIG+serielt) er der event-formen låses. Skipper vi kontekst-konvolutten der, ships den konsentrerte Ranheim-tidlig-volumen — nettopp valideringsdataen vi mest vil ha ren — permanent kontekstløs. **Dette må reconciles før PRD 1 events-tabell + PRD 13 Fase 1 bygges.**

---

## 1. Hva PRD 13 allerede treffer (arkitekturen er riktig)

| Strategi-prinsipp | Dekket i PRD 13 |
|---|---|
| **ÉN sentral event-strøm sliced per board, IKKE siloer** | §3 + §5.1: én `events`-tabell, «per-board analytics» = filtrert spørring på `project_id`. Eksakt vårt anti-silo-krav. |
| **Anonym + aggregert = feature** | §1 prinsipp 1 + Beslutning 8: kun aggregater, aldri rå per-sesjon-sekvenser; `session_id` ikke-personidentifiserende, ingen consent-flow nødvendig |
| **Server-only skriv** (CLAUDE.md) | §1 prinsipp 2 + Beslutning 2: `logEvent` server-action via service-role; RLS INSERT-only |
| **Instrumenter fra board v1** | Fase 1 i Lag 1, TIDLIG+serielt, FØR avhengige board-PRD-er; fail-soft fire-and-forget |
| **Rå-capture nå, aggreger/rapportér senere** | §3 + Fase 3: rå events i sanntid, `getEngagementStats` aggregerer; retensjon deferret |

> **Konklusjon:** Rør IKKE arkitekturen — den er på linje med designet. Gapet er i *hva* hvert event bærer og *hvilke* events finnes, ikke i hvordan de strømmer.

---

## 2. Gap: event-skjemaet er for tynt for Moat 2

### Gap 1 — Kontekst-konvolutt mangler (det kritiske, billige, irreversible)

**Strategien (2026-06-28):** Et rått klikk lyver. Ranheim skole ligger langs Ladestien → et skole-klikk i *natur-kontekst* betyr «utforsker turstien», ikke «vurderer skolen». Et tvetydig signal er verre enn ingen (ser ut som innsikt). Fiks: **hvert event bærer tilstanden brukeren var i.** Det er også det som gjør engasjement om til *segmentering* (klynge kjøpere per strøk → persona-attribuert, forsvarbar anekdote).

**PRD-status:** PRD 13 §5.1 — events bærer `event_type`, `project_id`, `product_id`, `poi_id`, `payload`, `session_id`. `payload` fylles kun med `{ category_id }` / `{ voiceover_segment }`. **Ingen** `mode`/aktive kategorier, `travel_mode`, `time_budget`, `map_center`/`map_zoom`, `home_anchored`. Naken klikk = nøyaktig det confounded signalet vi advarte mot.

**Anbefaling (lav kost, høy verdi):** Utvid payload-kontrakten i PRD 13 (§5.3 + Unit 1 payload-typer) til at HVERT event bærer en `context`-konvolutt:

```ts
// rir i payload.context — payload er allerede jsonb, INGEN migrasjon
context: {
  mode: "free" | "category";
  active_categories: string[];      // hvilke filtre var aktive
  travel_mode: "walk" | "bike" | "car" | null;
  time_budget: 5 | 10 | 15 | null;
  map_center: [number, number] | null;  // lng,lat
  map_zoom: number | null;
  home_anchored: boolean;           // var handlingen relativ til boligen?
}
```

**Hvorfor det haster:** payload er jsonb → dette krever INGEN skjema-migrasjon, bare en kontrakt-/type-utvidelse + at emit-sitene (Unit 5) fyller den. Men det MÅ inn i Fase 1-formen, fordi events logget uten kontekst aldri kan få den tilbake. Den konsentrerte Ranheim-tidlig-volumen er valideringsdataen — den må være ren fra event nr. 1.

> **Prinsipp som følger med:** fang maksimalt granulert (billig), rapportér kun over volum-/konfidens-terskel. Du kan alltid aggregere opp — aldri disaggregere ned.

### Gap 2 — De to ⭐⭐-signalene + de rikere event-typene mangler

**Strategien (tracking-katalog):** De rikeste signalene er **`route_requested` «fra boligen til X»** (avslører hvilke destinasjoner som betyr noe: jobb/skole/treningssenter — ⭐⭐) og **`search_intent` «hva leter du etter»-nudge** (fanger demand boardet ikke viser, gap-deteksjon — ⭐⭐). Sekundære (⭐): `category_opened`-rekkefølge, `travel_mode_changed`, retur-besøk.

**PRD-status:** PRD 13s startsett er fire typer: `board_viewed`, `category_opened`, `voiceover_played`, `poi_clicked`. **Begge ⭐⭐-signalene mangler.** Også fraværende: `travel_mode_changed`, `time_budget_changed`, `map_viewport` (heat maps), retur-besøk.

**Anbefaling:** Utvid event-type-settet. PRD 13 Beslutning 5/6 + Deferred forutser allerede at settet utvides via «ny migrasjon (utvid CHECK) + `EVENT_TYPES`-bump» — så mekanismen er på plass. **Men de to ⭐⭐-typene bør inn i *startsettet*, ikke deferres**, fordi hele Moat-2-verdien hviler på dem:

| Ny event_type | Signal | Kilde-feature finnes? |
|---|---|---|
| `route_requested` | «fra boligen til X» (⭐⭐ — rikeste) | **Ja** — directions-API lever (PRD 11). Bare emit ved rute-forespørsel. |
| `search_intent` | «hva leter du etter»-nudge (⭐⭐) | **Nei — net-ny UX-feature** (se Gap 4) |
| `travel_mode_changed` | pendler-bekymring (⭐) | Toggle finnes; emit ved endring |
| `map_viewport` | pan/zoom/dwell → heat maps | Se Gap 3 |

Dette krever migrasjon (utvid `events.event_type`-CHECK i PRD 1 Unit 2) + `EVENT_TYPES`-bump (PRD 13 Unit 1). To-stegs-grensen er allerede dokumentert i PRD 13.

### Gap 3 — Ingen viewport-capture → ingen heat maps

**Strategien:** Megler får en *privat, intern* analyse-visning med kart-heat maps: hvor folk ser/panorerer/zoomer. Vekt **zoom-inn + dwell > rå panorering** (panorering er planløs; zoom-inn er forpliktelse). Delta-mot-strøk > absolutte klikk.

**PRD-status:** PRD 13 fanger kun diskrete POI-klikk. Ingen viewport-events → heat maps kan ikke rekonstrueres retroaktivt.

**Anbefaling:** Legg til `map_viewport`-event (center/zoom + dwell-varighet), throttlet (ikke ett event per pixel). `map_center`/`map_zoom` ligger uansett i kontekst-konvolutten (Gap 1) — et dedikert dwell-event gjør heat map-aggregering mulig. Vekting (zoom-inn+dwell over panorering) er en *rapporterings*-beslutning i lese-laget, ikke i capture — fang granulert.

### Gap 4 — «Hva leter du etter»-nudgen er en net-ny UX-feature uten hjem

**Strategien:** Den interaktive nudgen «hva leter du etter / hva mangler du?» er ett av de to ⭐⭐-signalene — fanger uttalt demand boardet ikke viser (gap-deteksjon).

**PRD-status:** Finnes ikke i noen PRD. Det er en ny board-UX-komponent (eier: **PRD 9 board-skall**) som emitter `search_intent` (Gap 2).

**Anbefaling:** Spec som liten board-feature i PRD 9 + emit-site i PRD 13 Unit 4/5. Lav byggekost, høy signalverdi. Route requests (det andre ⭐⭐) trenger derimot *ingen* ny feature — directions finnes (PRD 11), bare emit `route_requested`.

### Gap 5 — Ingen strøk-aggregering (per-board er anekdote; aggregatet er moaten)

**Strategien:** Per-board engasjement er anekdote (få sessions = støy). Dataen blir *validert* først på **strøk-aggregat**. To visninger på samme strøm: *per-board-dashboard* (megleren ser sin egen listing → grunnpakke-klebrighet/ARR) vs. *aggregert strøk-heat map* (markedsintel på tvers → sellbart produkt). Strøk er aggregerings-aksen. Og: **konsentrert volum validerer raskere** — 100 boards i 5 strøk = 5 validerte profiler; «vinn én kjede» + «volum validerer» = samme trekk (EM1-Trondheim).

**PRD-status:** `getEngagementStats(projectId, opts?)` tar KUN `projectId` → kun per-board. Events-tabellen har `project_id`/`product_id`/`poi_id` men **ingen `area_id`/strøk**. Ingen strøk-rollup.

**Anbefaling:**
- Bær `strøk`/`area_id` i kontekst-konvolutten (eller som top-level kolonne hvis vi vil indeksere det — på prototype-volum holder payload).
- Legg til en `getStrokEngagement(areaId, opts?)`-grense ved siden av per-board. To views, samme strøm — eksakt vår design.
- Dette er der den konsentrerte-volum-tesen materialiseres: strøk-aggregering må eksistere i lese-laget for at Ranheim-dybden skal kunne valideres.

### Gap 6 — UX er datainnsamlings-apparatet (signal finnes bare hvis UX fremkaller det)

**Strategien (2026-06-28):** To konkrete grep: (a) **travel-mode (gå/sykkel/bil) må gjøres synlig og fristende å bruke** — gjemt toggle = ingen pendler-intensjon å lese; (b) **kategori-rekkefølge er både nudge og signal** — rekkefølgen vi presenterer styrer hva folk åpner først (nudge), og rekkefølgen de selv åpner i er topp-prioritets-signalet. **Confounder:** åpnet de skole først fordi de bryr seg, eller fordi den lå øverst? → **logg alltid den *presenterte* rekkefølgen i kontekst-konvolutten.**

**PRD-status:** UX-aksen (travel-mode-synlighet, kategori-rekkefølge) er PRD 5 (board-data) + PRD 9 (board-skall). Ingen kobling i dag til at disse er *signal-genererende* flater.

**Anbefaling:** Noter i PRD 5/9 at travel-mode-toggle og kategori-rekkefølge er instrument-bærende: travel-mode synlig nok til å bli brukt; **presentert kategori-rekkefølge logges i `context`** så åpne-rekkefølge-signalet (⭐) kan tolkes. Hvis kategori-rekkefølgen senere blir adaptiv (per strøk-segment), er logging av presentert rekkefølge ikke valgfritt — ellers er signalet confounded.

---

## 3. Anbefalinger — prioritert, mappet til PRD

| # | Gap | Handling | Eier-PRD | Migrasjon? | Prioritet |
|---|-----|----------|----------|-----------|-----------|
| 1 | Kontekst-konvolutt | Utvid payload-kontrakt: `context`-objekt på hvert event | PRD 13 §5.3 + Unit 1/5; fylles av PRD 5/9 | **Nei** (jsonb) | **🔴 FØR Fase 1 bygges — irreversibel** |
| 2 | ⭐⭐-signaler + rikere typer | `route_requested` + `search_intent` inn i startsettet; `travel_mode_changed`, `map_viewport` | PRD 1 (CHECK) + PRD 13 (EVENT_TYPES) | **Ja** (utvid CHECK) | 🔴 Startsett, ikke deferret |
| 3 | Viewport heat maps | `map_viewport`-event (center/zoom/dwell, throttlet) | PRD 13 Unit 1/5 | Nei (ny type via #2) | 🟠 Tidlig |
| 4 | «Hva leter du etter»-nudge | Ny board-feature + emit `search_intent` | PRD 9 (feature) + PRD 13 (emit) | Nei | 🟠 Tidlig |
| 5 | Strøk-aggregering | Bær strøk i kontekst; `getStrokEngagement`-grense | PRD 13 §5.5 Unit 6 | Nei (payload) | 🟠 For validerings-tesen |
| 6 | UX-som-instrument | Travel-mode synlig; logg presentert kategori-rekkefølge | PRD 5 + PRD 9 | Nei | 🟡 Med board-UX |

🔴 = må avklares før PRD 1/13 bygges (event-formen låses i Fase 1). 🟠 = tidlig, men kan følge. 🟡 = med board-UX-arbeidet.

---

## 4. Den ene setningen rebuild-sesjonen må handle på

**PRD 1s `events`-skjema og PRD 13s Fase-1-event-form må reconciles med kontekst-konvolutten (Gap 1) + de to ⭐⭐-signalene (Gap 2) FØR logger-kjernen bygges** — fordi Fase 1 kjøres TIDLIG+serielt i Lag 1, og events logget uten kontekst i den konsentrerte Ranheim-tidlig-volumen kan aldri repareres. Resten (heat maps, strøk-aggregering, nudge, UX) kan følge, men gap 1+2 er den tidskritiske moat-avklaringen i hele runden.

Se søsterrapporten `moat-1-lokalkunnskap-build-input.md` — der er PRD-en moden og gapene additive/post-MVP.
