# PRD 7 — Grounding + kuratering

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Tier:** Lag 2 (editorial-fact-feed + kuratering; hviler på PRD 1 + PRD 2. Grounding/curation er DELTE build-time-felt — `themes[].grounding` leses likt av alle nivåer; ingen tier-forking. Brukes tyngst på nivå 2 (kuratert editorial), men selve laget gater ALDRI på `reportTier`.)
> **PRD-nr:** 7 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-grounding-curation`
> **Kontekst:** Editorial-fact-feed-laget. Eier build-time **Gemini-grounding** (google_search-grounding → narrative + sources + sanert searchEntryPoint, lagret per tema i `products.config.reportConfig.themes[].grounding`), **kuratering/skriving med Fable** v1→v2 (grounding-narrative → curatedNarrative med POI-inline-lenker, via build-time skill-dans — IKKE runtime-LLM; Fable er en Claude-modell kjørt build-time), den **konsoliderte POI-linkeren**, **curation-sanitering + anti-hallusinerings-validator**, og **cache-revalidering** (revalidateTag, groundingVersion-bump). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (grounding/curation-blokk linje 160–191 + 459 + 478–485 + 736/750/756–757), `docs/rebuild/prod-schema-snapshot.txt` (`products.config` jsonb NOT NULL) og `docs/rebuild/prd/00-INDEX.md` (PRD 07-raden deps 01/02; note #2 cache-revalidering-splitt: secret-hook `/api/revalidate`→PRD 7, `/api/admin/revalidate`→PRD 12; note #3 story-text-linker eies av PRD 7; note #10 editorial Gemini henter / Fable skriver).

---

## 1. Produktvisjon / Formål

Et POI-board uten editorial er bare prikker på et kart. Trust-laget (PRD 4) gir oss *gode* POIer; grounding-laget gir oss *fortellingen om stedet* — fakta-orientert, web-grounded prosa per tema, attribuert til kilder slik Google ToS krever. Denne PRD-en eier **editorial-fact-feed-laget**: hvordan rå nettsøk blir til verifiserbar, kildebelagt, POI-lenket board-tekst — alt **build-time**, aldri runtime-LLM.

Laget har tre ledd, hvert med eget sikkerhetsanliggende:

1. **Gemini-grounding (v1).** `scripts/gemini-grounding.ts` kaller Gemini med `google_search`-grounding per tema, henter `narrative` + `rawSources` (uløste vertexaisearch-redirect-URLer) + `searchEntryPointHtml` (Google chip-carousel) + `searchQueries`. Build-time only; API-nøkkel i `x-goog-api-key`-header (`grounding.ts:166–169`), aldri i URL. Resultatet lagres som `groundingVersion: 1` per tema.
2. **Kuratering/skriving med Fable (v2).** `scripts/curate-narrative.ts` hever v1→v2: rå Gemini-narrative → en unified `curatedNarrative` med POI-inline-lenker. **Rollefordeling (walkthrough-beslutning 2026-06-27): Gemini er DATA-INNHENTEREN** (grounded web-fakta + kilder), **Fable er SKRIVEREN** som gjør grounded data om til ferdig prosa. Fable er en Claude-modell, så den kjører i samme build-time skill-dans og kalles IKKE som runtime-API — flyten splittes i `prepare` (skriver staging-kontekst med sanitert input) → skill/Claude-Code-mellomsteg → `apply` (validerer + linker + PATCH-er `groundingVersion: 2`). CLAUDE.md-regelen «ingen runtime-LLM» overholdes via denne build-time skill-dansen.
3. **Sikkerhets-/integritetslaget.** Tre verifiserte forsvar bæres uendret: ToS-sanering av searchEntryPoint (DOMPurify verbatim chip-carousel), SSRF-guard ved redirect-URL-resolve (DNS pre-resolve + ipaddr.js unicast), og anti-hallusinerings-validator + prompt-injection-sanering mellom LLM-ledd.

To prinsipper skiller dette laget:

- **v1 og v2 coexister per tema.** v1→v2-migrasjonen ER allerede gjort i kode (`lib/types.ts:205` `groundingVersion: 1 | 2`, `:240` `z.literal(1)`, `:258` `z.literal(2)`). PRD 7 beskriver **v2-virkeligheten**, ikke v1-only. CLAUDE.md-formuleringen «Zod z.literal(1)» er **STALE** (se Åpent spørsmål #2).
- **Cache bustes via revalidateTag, aldri auto-TTL.** Begge build-time-scripts kaller `/api/revalidate?tag=product:...` etter vellykket PATCH (`gemini-grounding.ts:473`, `curate-narrative.ts:499`). **Tag-format-matchen mot page-side er VERIFISERT (Kontroll-runde 2026-06-27, K1):** `projectId` = container-ID = `{customer}_{slug}` (`lib/pipeline/create-report-project.ts:53`), og alle 4 board-sider tagger `product:${customer}_${slug}` via `unstable_cache` — strengene er identiske, revalidering treffer. Den tidligere load-bearing korrekthetsrisikoen er falt; eneste gjenstående er en ikke-blokkerende shape-guard på CLI-arg (§5.5 + Unit 8 AC2).

**Hvem konsumerer dette:** PRD 5 (board-data) leser `grounding`/`curatedNarrative`/`editorial` for visning; PRD 9 (board-skall) rendrer grounding-prosa, sources og sanert searchEntryPoint; PRD 8 (moat) vil KUNNE konsumere den konsoliderte story-text-linkeren (fremtidig/valgfri, ikke aktiv kontrakt i dag — eier den ikke). Denne PRD-en EIER verdiene + linkeren (markdown-adapteren er live via `curate-narrative.ts:384`); den eier IKKE board-rendringen eller moat-systemet.

---

## 2. Mål (Goals)

Hvert mål kobler til minst én konkret requirement/unit i §7.

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Port Gemini build-time grounding-kjernen verbatim (prompt → google_search → Zod-validert narrative + rawSources + searchEntryPoint), med nøkkel i header og ToS-kast ved tom searchEntryPoint. | `callGemini` + `splitLongParagraphs` + `lib/gemini/types.ts` Zod-shapes portet (Unit 1). |
| **G2** | Bevar ToS-saneringen (DOMPurify verbatim chip-carousel) og SSRF-guarden (DNS pre-resolve + ipaddr.js unicast) uendret. | `sanitizeSearchEntryPointHtml` + `resolveUrl`/`resolveUrlsParallel` portet uendret med eksisterende tester (Unit 2). |
| **G3** | Lever grounding-orkestratoren som populerer `themes[].grounding` (v1) med optimistic lock, whitelist-guard, totalfeil-abort og revalidateTag. | `scripts/gemini-grounding.ts` portet (Unit 3). |
| **G4** | Forankre grounding-LAGRINGSTYPENE (diskriminert union v1|2, `.passthrough()`, løs `poiLinksUsed`) som PRD 7-eid kontrakt i `@/lib/types`. | `ReportThemeGrounding` + V1/V2-schemas + view-union portet (Unit 4). |
| **G5** | Konsolider de to POI-linkerne til ÉN delt kjerne-matcher med to adaptere (segment-array + markdown-streng), uten å bryte noen call-site. | Felles matcher + `linkPOIsInText`-adapter + `linkPoisInMarkdown`-adapter (Unit 5). |
| **G6** | Lever curation-integritetslaget (prompt-injection-sanering + anti-hallusinerings-validator) verbatim, inkl. lastIndex-gotcha. | `sanitizeGeminiInput` + `validateCuratedNarrative` portet (Unit 6). |
| **G7** | Lever v1→v2-kuratering-orkestratoren (prepare→skill→apply build-time-dans, idempotens, PATCH `groundingVersion: 2`, revalidateTag). | `scripts/curate-narrative.ts` portet (Unit 7). |
| **G8** | Lever cache-revalideringskontrakten (build-time `/api/revalidate` tag-match + revalidate-once) og avklar `revalidate-once`-tom-mappe. | `app/api/revalidate/route.ts` portet + `revalidate-once`-avklaring (Unit 8). |

---

## 3. Arkitektur-/migrasjons-kontekst + nedstrøms-kontrakt-kart

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på **editorial-fact-feed-laget over baseline + taksonomi**: grounding/curation er build-time-felt som skrives inn i `products.config.reportConfig.themes[].grounding` og leses identisk av alle nivåer. Det finnes ingen tier-forking her — `grounding`/`curatedNarrative` er DELTE felt. Nivå 2 bruker dem tyngst (kuratert editorial er nivå-2-kravet), men **selve laget gater ALDRI på `reportTier`** (verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`, jf. CARRY-OVER patch #2 linje 757). Tier-krav på editorial fanges av VALIDATOR (PRD 2), ikke av et render-bryter eller en grounding-bryter.

**Migrasjons-kontekst:** Alle felt denne PRD-en skriver til lever i `products.config` (jsonb, NOT NULL — PRD 1 baseline-kontrakt). Denne PRD-en innfører INGEN ny migrasjon; den fyller `themes[].grounding`-strukturen i JSONB-bæreren PRD 1 leverer. **`groundingVersion`-Zod-typene lever i `@/lib/types`** (`lib/types.ts:196–217` interface, `:234–264` schemas), som denne PRD-en eier — PRD 1 leverer kun jsonb-bæreren, ikke grounding-feltschemaet.

> **LLM-kontekst (CLAUDE.md-regel):** Gemini kalles KUN fra `scripts/gemini-grounding.ts` (npx tsx, build-time). Fable-kuratering er IKKE et runtime-API-kall (Fable er en Claude-modell kjørt build-time via skill-dans) — `@anthropic-ai/sdk` finnes i `package.json` (^0.78.0) men brukes IKKE for grounding-curation; flyten er prepare→fil(`.curation-staging`)→skill/Claude-Code-mellomsteg→apply (`curate-narrative.ts:5–13`). Akseptansekriterium gjennomgående: ingen Gemini/Claude-kall fra `app/`-runtime eller klientkomponenter.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer | Kontraktsfelt PRD 7 MÅ levere |
|---------------|--------------------|-------------------------------|
| PRD 5 — board-data-state | `themes[].grounding` (narrative/curatedNarrative/sources/searchEntryPointHtml) for board-data-projeksjon | `ReportThemeGrounding`-felt persistert; `ReportThemeGroundingViewSchema` for trygg JSONB-parse |
| PRD 8 — lokalkunnskap-moat | Den **konsoliderte POI-linkeren** (`linkPoisInMarkdown`-adapter) — PRD 8 vil KUNNE konsumere den (fremtidig/valgfri, ikke aktiv kontrakt i dag) | Felles matcher + markdown-adapter; eierskap PRD 7 (manifest 756, INDEX note #3 — story-text-linker eies av PRD 7); PRD 8 KONSUMERER ikke i dag |
| PRD 9 — board-skall-UI | Sanert `searchEntryPointHtml` (verbatim render via `dangerouslySetInnerHTML`), sources, `curatedNarrative` + `poiLinksUsed` for inline POI-mentions | Sanert HTML trygt for `dangerouslySetInnerHTML`; segment-array-adapteren (`linkPOIsInText`) for React-render |

### Avgrensning mot tilstøtende PRD-er

- **Google Places-trust/foto-berikelse** er IKKE her — eies av **PRD 4**. Denne PRD-en berører kun Gemini-editorial-grounding, ikke Google Places-signaler.
- **Tema-taksonomien** (`report-defaults.ts`, `theme-definitions.ts`, `readMoreQuery`-feltet, `THEME_IDS`) eies av **PRD 2**. Grounding lagres PER TEMA, så tema-strukturen fra PRD 2 definerer hvilke temaer som får grounding; `readMoreQuery` (`lib/types.ts:372`) driver Gemini-søket (`gemini-grounding.ts:181–184`). Denne PRD-en konsumerer taksonomien, definerer den ikke.
- **Provisjons-orkestreringen** (autonom PRD 3-pipeline) er et DISTINKT spor — grounding er et build-time **skill-spor** (`npx tsx scripts`), ikke del av den autonome PRD 3-pipelinen. Det konsumerer kun `pois` (id/name/category) fra et provisjonert report-product (`products.product_type='report'`) som POI-whitelist-kilde for linking.
- **Board-rendring av grounding-badges/sources** og **moat-DB-systemet** (`place_knowledge`-arv) er nedstrøms — se §6 Deferred.

---

## 4. Eksisterende kodebase

### Bæres over (keeper-core / port-with-rewrite)

| Fil (@/-sti) | Verdict | Rolle (verifisert) |
|--------------|---------|--------------------|
| `@/lib/gemini/sanitize.ts` | keeper-core (port verbatim) | `sanitizeSearchEntryPointHtml` (linje 32) — DOMPurify-wrapper, `SEARCH_ENTRY_POINT_CONFIG` (14–30) krever `ADD_TAGS:['style']`+`FORCE_BODY` (ellers kollapser chip-carousel, manifest 168), `ALLOWED_URI_REGEXP=/^https?:\/\//i` (24) blokkerer `javascript:`/`data:`. |
| `@/lib/gemini/url-resolver.ts` | keeper-core (**MÅ bæres uendret**) | SSRF-guard: `isUnsafeIp` via `ipaddr.parse().range()!=='unicast'` (33–40), `assertPublicHost` DNS `lookup all:true` + per-addr range-sjekk (50–76), `resolveUrl` (78) manuell redirect max 3 hops, final-https-sjekk ETTER redirect-loop (125–127), `resolveUrlsParallel` p-limit=5 (139). CLAUDE.md-mandert. |
| `@/lib/gemini/grounding.ts` | port-with-rewrite | Gemini-kjerne: `GEMINI_MODEL='gemini-2.5-flash'` hardkodet (15), `callGemini` (140), nøkkel i `x-goog-api-key`-header IKKE URL (166–169), `tools:[{google_search:{}}]` (159), `splitLongParagraphs` (68), `sanitizeSearchEntryPointHtml`-kall + kast hvis tom (211–216). Build-time only. |
| `@/lib/gemini/types.ts` | port-with-rewrite | API-RESPONS-shape Zod-schemas (IKKE lagringstyper): `SearchEntryPointSchema.renderedContent` min(1) (20–22), `GroundingMetadataSchema` (24–28), `GeminiResponseSchema.candidates` min(1) (37–39). |
| `@/lib/gemini/index.ts` | port-with-rewrite | Barrel: `callGemini`/`GEMINI_MODEL` + option/result-typer (`CallGeminiOptions`/`CallGeminiResult`/`RawGeminiSource`) fra grounding, `sanitizeSearchEntryPointHtml`, `resolveUrl`/`resolveUrlsParallel`/`ResolvedUrl`. **Re-eksporterer IKKE** API-respons-Zod-schemaene (`GroundingMetadataSchema`/`SearchEntryPointSchema`/`GeminiResponseSchema`) — de lever kun i `grounding.ts`/`types.ts`. |
| `@/lib/utils/story-text-linker.ts` | port-with-rewrite (**konsolider — Unit 5**) | `linkPOIsInText(text,pois): TextSegment[]` (49) — returnerer segment-array for React inline-render. To-pass: markdown-split (behold external) → POI-match (lengste-navn-først `:60–68`, første-forekomst-per-POI `:90`). 3 aktive call-sites (verifisert): `ReportThemeSection.tsx:118/123/128`, `ParaformThemeSection.tsx:18/21`, `StoryThemeChapter.tsx:32`. Eies HER; PRD 8 vil KUNNE konsumere den (fremtidig/valgfri, ikke aktiv kontrakt i dag). |
| `@/lib/curation/poi-linker.ts` | keeper-core (**konsolider — Unit 5**) | `linkPoisInMarkdown(markdown,poiSet,opts): LinkPoisResult` (194) — returnerer markdown-streng + `poiLinksUsed`. To-pass: validér Claude-genererte `[text](poi:uuid)`-lenker mot UUID-whitelist (`validateExistingPoiLinks` 89–112, cross-tenant-sikkerhet) → legg til lenker for bare POI-navn. Strict `POI_UUID_RE` (40–41/206). Mønster: `docs/solutions/best-practices/two-pass-text-linker-markdown-poi-20260410.md`. |
| `@/lib/curation/sanitize-input.ts` | keeper-core (port verbatim) | `sanitizeGeminiInput` (38) — prompt-injection-forsvar mellom LLM-ledd: strip markdown-lenker (behold tekst), `DANGEROUS_CHARS_RE` MED `/g` (20–21), trunkér til `maxLength` default 3000 (23–26). |
| `@/lib/curation/validator.ts` | keeper-core (port verbatim) | `validateCuratedNarrative` (161) — anti-hallusinering: proper nouns må matche `geminiNarrative ∪ poi_set.name`, `extractProperNouns` (81), `LEADING_CAP_STOPWORDS` norsk (19–54), `DANGEROUS_CHARS_RE` UTEN `/g` (15–16, lastIndex-gotcha), `maxLength=1200`/`minLength=100`/`fuzzyDistance=1` (166). |
| `@/lib/types.ts` → grounding-lagringstyper | port-with-rewrite | `ReportThemeGrounding` interface (196–217, `groundingVersion:1|2`, v2-only `curatedNarrative`/`curatedAt`/`poiLinksUsed`), `ReportThemeGroundingV1Schema` `z.literal(1)` `.passthrough()` (234–242), `ReportThemeGroundingV2Schema` `z.literal(2)` `curatedNarrative` min(100) (244–259, declarer IKKE `meta` og er ikke `.passthrough()` → strippes ved view-parse), `poiLinksUsed` `z.array(z.string().min(1))` element ikke strict UUID (257), `ReportThemeGroundingViewSchema` discriminatedUnion (261–264). `ReportThemeConfig.grounding?` (373). |
| `@/scripts/gemini-grounding.ts` | port-with-rewrite | Orkestrator (v1): `ALLOWED_REPORTCONFIG_KEYS` whitelist (43–71, hard-feiler på ukjent nøkkel `290–298`), `TOTAL_FAILURE_THRESHOLD=5` (95), `callGemini` med `readMoreQuery` (181–184), grounding-objekt `groundingVersion:1` (227–237), PATCH med `updated_at=eq` optimistic lock (399–412), `revalidate('product:'+projectId)` (473). **Manifest:480 mandaterer «erstatt whitelist med typet config-modell» — verbatim-port av whitelist er bevisst Fase-2-valg, typet-config-erstatning deferred (Beslutning 12 + Deferred-peker).** |
| `@/scripts/curate-narrative.ts` | port-with-rewrite | Orkestrator (v1→v2): prepare/apply build-time-dans (5–13), importerer `linkPoisInMarkdown`/`sanitizeGeminiInput`/`validateCuratedNarrative` (34–38), idempotens skip `curatedAt>=fetchedAt` (230–233), `validateCuratedNarrative` (359), `linkPoisInMarkdown` (384), PATCH `groundingVersion:2` (453–456), `revalidate product:${projectId}` (499–509). |
| `@/app/api/revalidate/route.ts` | keeper-core (port verbatim) | Build-time revalidation: GET `?tag=product:{id}&secret` (14), `timingSafeEqual` konstant-tids secret-sjekk (43–48), `revalidateTag(tag)` (39), `REVALIDATE_SECRET` env (19). **PRD 7 eier KUN denne secret-gated ruten** — `app/api/admin/revalidate/route.ts` flyttet til PRD 12 (ratifisert kontroll 2026-06-27, K3/Q5). |

### Slettes / forlates (reference-only / dead)

| Objekt | Verdict | Begrunnelse |
|--------|---------|-------------|
| `@/app/api/revalidate-once/` | **dead (tom mappe)** | Ingen `route.ts` — kun directory-entry (ls bekreftet 2026-06-26). CLAUDE.md/INDEX note #2 (cache-revalidering)/manifest:750 refererer «revalidate-once» som foldet inn i PRD 7, men det finnes INGEN implementasjon. Slettes (Unit 8 AC3) med mindre Andreas avklarer hva den var ment å gjøre (Åpent spørsmål #1). |
| `@/lib/supabase/public-client.ts` → `SUPABASE_CACHE_TAG` | reference-only (ute av PRD 7-scope) | `SUPABASE_CACHE_TAG='supabase-public'` (4) — eies primært av PRD 5/PRD 1. Ble tidligere konsumert av admin-revalidering, men den ruten er flyttet til PRD 12 (K3/Q5); PRD 7 berører ikke lenger dette symbolet. |
| `@anthropic-ai/sdk` (^0.78.0) for grounding-curation | dead-for-this-PRD | Finnes i `package.json` men brukes IKKE for curation — Claude kalles via build-time skill-dans, ikke SDK-runtime-kall. Ingen unit innfører SDK-bruk her. |

---

## 5. Datakontrakt / Skjema

### 5.1 Hvor grounding lagres (forankret i prod-skjema + kode)

Grounding lagres PER TEMA i `products.config.reportConfig.themes[].grounding`. `products.config` er `jsonb`, `NOT NULL` (PRD 1 baseline-kontrakt; `ReportThemeConfig.grounding?` `lib/types.ts:373–374`). Denne PRD-en eier feltschemaet INNI JSONB-bæreren; PRD 1 leverer kun bæreren.

### 5.2 Grounding-lagringstypen (diskriminert union — v2-virkelighet)

`ReportThemeGrounding` (`lib/types.ts:196–217`) er lagringsformen (distinkt fra `gemini/types.ts` API-respons-shape). Diskriminert union på `groundingVersion`:

| Versjon | Schema | Felt-delta | Skrives av |
|---------|--------|-----------|------------|
| **v1** | `ReportThemeGroundingV1Schema` `z.literal(1)` `.passthrough()` (`:234–242`) | `narrative` (Zod `.min(1)`; merk: interface-docstring `:197` sier «min 200 tegn» — kilde-uenighet, se under), `sources`, `searchEntryPointHtml` (min 1), `fetchedAt`, `meta{model,searchQueries}` (via `.passthrough()`) | `gemini-grounding.ts:227–237` |
| **v2** | `ReportThemeGroundingV2Schema` `z.literal(2)` (`:244–259`) | v1-felt MINUS `meta` (V2Schema declarer ikke `meta` og er ikke `.passthrough()` — `meta` strippes ved render-parse, se under) + `curatedNarrative` (min **100**), `curatedAt`, `poiLinksUsed` (`z.array(z.string().min(1))`, IKKE strict UUID) | `curate-narrative.ts:453–456` |

`ReportThemeGroundingViewSchema` (`:261–264`) er `z.discriminatedUnion("groundingVersion", [V1, V2])` — brukt ved render-tids JSONB-parse (silent skip + server-log ved mismatch). **v1 og v2 coexister per tema** i samme `themes[]`-array (tillater partial rollout under curation).

**`meta`-asymmetri mellom v1 og v2 (bevisst — IKKE en del av v2 render-view):** `ReportThemeGrounding`-interface (`:206–210`) krever `meta:{model,searchQueries}`, og orkestratoren skriver det alltid (`gemini-grounding.ts:233–236`). V1Schema slipper det gjennom via `.passthrough()` (`:242`), men V2Schema (`:244–259`) har verken `.passthrough()` eller `meta`-felt — så `ReportThemeGroundingViewSchema.parse()` på et v2-objekt **stripper `meta` stille** (Zod fjerner ukjente nøkler på non-passthrough-objekter). `meta` er debug-only (auto-genererte Gemini-søk, jf. docstring `:208`) og er **bevisst ikke en del av v2 render-view**. Kontrakt: PRD 5/9 skal IKKE lese `meta` av en render-validert v2-grounding — den er kun tilgjengelig pre-parse / i v1. (Alternativ ved behov: legg `meta` på V2Schema eller gjør den `.passthrough()` — se Unit 4 AC4.)

**Bevisste invarianter (IKKE «fiks» til konsistens):**
- **v1-schema er `.passthrough()`** (`:242`) — lar v2-felter (`curatedNarrative`) eksistere på en rad fortsatt flagget v1 under curation-mellomtilstand (manifest 459).
- **`poiLinksUsed` er `z.array(z.string().min(1))`, med element-type `z.string().min(1)` IKKE strict UUID** (`:257`, `.default([])`). Feltet er et array; elementene er ikke-tomme strenger. POI-IDer i Placy er heterogene (UUID, `google-ChIJ…`, slug-stil `bus-dronningens-gate`). Stram UUID-sjekk på elementene droppet 6/7 grounding-objekter ved render. Sikkerheten ligger i whitelist-oppslag mot loaded POI-set, ikke ID-form (manifest 459). **MEN:** `poi-linker.ts:40–41/206` bruker strict `POI_UUID_RE` ved build-time for å BYGGE lenker — kun ekte UUIDs blir linkbare ved build, mens render-validering (`lib/types.ts`) er løs. To distinkte sikkerhetslag — bevar begge.
- **`DANGEROUS_CHARS_RE` UTEN `/g` i `validator.ts:15–16`** men MED `/g` i `sanitize-input.ts:20–21` — bevisst: global regex har persistent `lastIndex` som gir sporadiske falske negativer ved `.test()` i validatoren.
- **`narrative`-lengdekrav: kilde-uenighet i koden.** Interface-docstring (`lib/types.ts:197`) sier «min 200 tegn», men `ReportThemeGroundingV1Schema.narrative` er `z.string().min(1)` (`:236`). **Zod-schemaet er autoritativt for porten** (det er det som faktisk håndheves ved render-parse); docstringen er feilaktig og rettes (eller fjernes) ved port. Ikke arv «min 200» som et håndhevet krav.

### 5.3 De to POI-linkerne (konsolideringskontrakt)

To linkere med ULIKE returtyper og ULIKE konsumenter (manifest 736, INDEX note #3 mandater konsolidering til ÉN; story-text-linker eies av PRD 7, PRD 8 KONSUMERER ikke i dag — fremtidig/valgfri):

| Linker | Signatur | Returtype | Konsument | Pass-mønster |
|--------|----------|-----------|-----------|--------------|
| `story-text-linker.ts:49` | `linkPOIsInText(text, pois: POI[])` | `TextSegment[]` (`{type,content,poi?,url?}` `:10–15`) | React inline-render (`ReportThemeSection`/`ParaformThemeSection`/`StoryThemeChapter`) | markdown-split → POI-match (navn-basert) |
| `poi-linker.ts:194` | `linkPoisInMarkdown(markdown, poiSet, opts)` | `LinkPoisResult` `{linked,poiLinksUsed}` (`:33–38`) | build-time `curate-narrative.ts:384` (apply) | validér `[text](poi:uuid)`-whitelist → legg til navn-lenker |

**Konsolideringskontrakt (Unit 5):** Felles kjerne-matcher (lengste-navn-først, første-forekomst-per-POI, case-insensitive) + to TYNNE adaptere som bevarer BEGGE returtypene og BEGGE call-site-mønstrene. IKKE en full merge til én returtype — det ville brutt enten React-render eller build-time-lagring. Per «del nedover stacken» tilsier delt kjerne-matcher + tynne adaptere.

**ADVARSEL — de to linkerne er IKKE behaviorally identiske i dag; konsolideringen ENDRER atferd for minst én konsument.** Konkrete deltaer (verifisert):

| Aspekt | `story-text-linker.ts` | `poi-linker.ts` |
|--------|------------------------|-----------------|
| Match-regex | Kombinert alternasjon `(navn1\|navn2\|…)/gi` (`:74`) | Per-navn ordgrense `\b…\b/i` (`:165`) + defensiv bracket-overlap-sjekk (`:169–174`) |
| `AS`/`SA`-stripping | JA (`:65–66`) | NEI |
| Kategori-prioritet ved navne-kollisjon | NEI | JA (`buildPoiLookup`, `:66–72`) |
| Første-forekomst spores via | `poi.id` (`:90`) | (per-navn iterasjon, ordgrense) |

Konsolideringen MÅ eksplisitt velge atferd per aspekt for hver adapter og bevise null regresjon med golden-output-tester per call-site (Unit 5 AC1). Det er IKKE en triviell ekstraksjon av allerede-delt kode.

### 5.4 Sikkerhets-/integritetskontrakten (arkitekturregler håndhevet)

| Kontrakt | Kilde | Akseptansekriterium |
|----------|-------|---------------------|
| API-nøkkel i header, ALDRI URL | `grounding.ts:166–169` x-goog-api-key | `GEMINI_API_KEY` aldri i URL-querystring (lekker i logs) |
| searchEntryPoint VERBATIM m/ DOMPurify FØR lagring (Google ToS) | `sanitize.ts:32`, kalt `grounding.ts:211–216` | Ingen usanert searchEntryPoint lagres; `dangerouslySetInnerHTML` kun på sanert HTML |
| SSRF-guard ved URL-resolve (DNS pre-resolve + ipaddr unicast) | `url-resolver.ts:50–76` | Alle redirect-resolves går gjennom `assertPublicHost`; privat/reserved IP blokkeres; final URL https |
| Cache bustes via revalidateTag, IKKE auto-TTL | `gemini-grounding.ts:473`, `revalidate/route.ts:39` | Ingen tidsbasert TTL for grounding-cache |
| Error-håndtering på alle Supabase-skriv | `gemini-grounding.ts:399–412` optimistic lock | 0-rader-PATCH → abort med rollback-instruks |
| `@/`-prefix i app/lib; relative i scripts | `route.ts:3` `@/lib/...`; `gemini-grounding.ts:32` `../lib/...` | Bevar mønsteret PER FIL-TYPE (script-kontekst er ikke @/-aliased) |

### 5.5 Operasjonelle invarianter (orkestratorene)

- **Whitelist-guard HARD-FEILER** på ukjent `reportConfig`-nøkkel (`gemini-grounding.ts:290–298`). `ALLOWED_REPORTCONFIG_KEYS` (43–71) MÅ utvides FØR nye `reportConfig`-felter legges til, ellers abort. **Manifest:480 ber om at denne håndholdte `Set`-en erstattes med en typet config-modell (utledet allowed-keys fra `ReportConfig`-typen, PRD 1/2-eid).** Verbatim-port i Fase 2 er bevisst (bevarer gullstandard-orkestreringen uendret); typet-config-erstatning er deferred til egen oppfølging (Beslutning 12 + Deferred-peker) slik at en fremtidig agent ikke etterlater den brittle whitelisten uflagget.
- **Optimistic lock** via `updated_at=eq.{read}` PATCH (`gemini-grounding.ts:401`, `curate-narrative.ts:467`) + backup før write + post-write deep-equal av preserved keys. Concurrent write → 0 rader påvirket → abort + rollback-instruks. Bæres uendret.
- **`TOTAL_FAILURE_THRESHOLD=5` av 7 temaer** (`gemini-grounding.ts:95`). Kun reell `error` teller; `skipped` (manglende `readMoreQuery` / eksisterende grounding uten `--force`) teller IKKE (linje 350–351).
- **Idempotens** i curation: skip hvis `curatedAt>=fetchedAt` med mindre `--force` (`curate-narrative.ts:230–233`).
- **Revalidate-tag-match (VERIFISERT — Kontroll-runde 2026-06-27, K1; tidligere antatt load-bearing risiko er FALSIFISERT):** Begge scripts emitterer `revalidate(`product:${projectId}`)` (`gemini-grounding.ts:473`, `curate-narrative.ts:499`) der `projectId` er CLI-positional-arg (`gemini-grounding.ts:100`) — samme verdi som brukes i `products?project_id=eq.${pid}`-spørringen (`gemini-grounding.ts:137`). Page-side cache-tag er `product:${customer}_${projectSlug}` (`unstable_cache`-`tags` i alle 4 board-sider: `rapport/page.tsx:22`, `rapport-board/page.tsx:13`, `rapport-reels/page.tsx:13`, `rapport-paraform/page.tsx:13`). **Kontrakten HOLDER:** `projectId` ER container-IDen `{customer}_{slug}` (`lib/pipeline/create-report-project.ts:53` — `/** Container-ID: {customer}_{slug} */`), og provisjons-scriptet buster literalt `product:${customer}_${slug}` (`provision-rapport.ts:155`). Script-emittert `product:${projectId}` == page-tagget `product:${customer}_${slug}` → revalidering treffer, ingen stale-editorial-risiko. **Gjenstående (ikke-blokkerende) herding:** `projectId` er en fri CLI-positional-arg uten formvalidering — legg til en shape-guard som validerer `{customer}_{slug}`-form, så en feilskrevet ID ikke buster en ikke-eksisterende tag stille (Unit 8 AC2). `gemini-grounding.ts:472`-kommentaren peker fortsatt på `getReportProductCached` som **ikke finnes** (faktisk funksjon = `getCachedReportProduct`, `rapport/page.tsx:17`) — rettes ved port.

---

## 6. Scope Boundaries

**Denne PRD-en dekker:** Gemini build-time grounding (kjerne + orkestrator, v1), kuratering/skriving med Fable v1→v2 (build-time skill-dans), den konsoliderte POI-linkeren (felles kjerne + to adaptere), curation-sanering + anti-hallusinerings-validator, grounding-lagringstypene (diskriminert union), ToS-sanering + SSRF-guard, og cache-revalidering (build-time tag-match + revalidate-once). **PRD 7 eier KUN den secret-gated `/api/revalidate`-ruten** — `app/api/admin/revalidate` (ADMIN_ENABLED-gated path-purge) er flyttet til PRD 12.

**Denne PRD-en dekker IKKE:**

- **Tema-taksonomien** (`report-defaults.ts`, `theme-definitions.ts`, `THEME_IDS`, `readMoreQuery`-feltdefinisjonen) — eies av **PRD 2**. Grounding konsumerer den.
- **Board-rendring av grounding** (grounding-badges, sources-visning, searchEntryPoint-render, inline POI-mentions i UI) — eies av **PRD 9**. PRD 7 leverer sanert HTML + segment-array + curatedNarrative; visningen er nedstrøms.
- **Board-data-projeksjonen** av grounding/editorial til `BoardData` — eies av **PRD 5**.
- **Lokalkunnskap-moat-SYSTEMET** (`place_knowledge`-arv, area-editorial-arv, `inherit-area-editorial`, curate-area) — eies av **PRD 8**. PRD 8 vil KUNNE konsumere den konsoliderte linkeren (fremtidig/valgfri, ikke aktiv kontrakt i dag); PRD 7 eier linkeren.
- **Google Places-trust/foto** — eies av **PRD 4**.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Lokalkunnskap-DB-SYSTEM + `place_knowledge`-arv (vil KUNNE konsumere story-text-linker fra denne PRD-en — fremtidig/valgfri, ikke aktiv kontrakt i dag) | **PRD 8 (prd-lokalkunnskap-moat)** |
| Board-rendring av grounding-badges/sources/searchEntryPoint + inline POI-mentions i UI | **PRD 9 (prd-board-skall-ui)** |
| Board-data-projeksjon av grounding/editorial til `BoardData` | **PRD 5 (prd-board-data-state)** |
| Nivå-2 kuratering-ARBEIDSFLYT (redaksjonell QA, godkjenning, manus-curatering utover grounding) | **PRD 15 (prd-nivå-2-kuratering, prov)** |
| `admin/revalidate`-ruten (path-basert, ADMIN_ENABLED-gated) flyttet til PRD 12 (ratifisert kontroll 2026-06-27, K3/Q5) | **PRD 12 (prd-self-serve-admin)** — eier den manuelle path-purge-flaten; PRD 7 beholder KUN secret-gated `/api/revalidate` |
| CLAUDE.md-arkitekturregel-oppdatering (`z.literal(1)` → `discriminated union 1|2`) | Egen dokumentasjons-PR (ikke-blokkerende; Åpent spørsmål #2) |
| Erstatt `ALLOWED_REPORTCONFIG_KEYS`-håndholdt `Set` med typet config-modell (utled allowed-keys fra `ReportConfig`-typen) — manifest:480-direktivet | Egen oppfølging når PRD 1/2 tier-config-kontrakten er stabil (Beslutning 12). Inntil da: whitelisten utvides manuelt FØR nye `reportConfig`-felter legges til, ellers hard-fail |

**Eksplisitt ikke-scope (patch #2):** grounding-/render-gating på `reportTier`. Laget gater IKKE på nivå (verifisert: ingen ref i `BoardMap3D`/`ReportReelsPage`). Tier-krav på editorial fanges av PRD 2-validatoren. **Ingen unit bygger tier-gating.**

---

## 7. Implementation Units (8 av 8 dekket)

### Unit 1 — Gemini grounding-kjerne (callGemini + API-shape Zod)
- **Mål (→ G1):** Port Gemini build-time grounding-kjernen verbatim med nøkkel-i-header og ToS-kast.
- **Filer:** `@/lib/gemini/grounding.ts`, `@/lib/gemini/types.ts`, `@/lib/gemini/index.ts`.
- **Akseptansekriterier:**
  1. `callGemini` (`grounding.ts:140`) kaller `generateContent` med `tools:[{google_search:{}}]` (159), nøkkel i `x-goog-api-key`-header (166–169) — verifisert: ingen nøkkel i URL-querystring.
  2. `GEMINI_MODEL='gemini-2.5-flash'` hardkodet (15); `splitLongParagraphs` (68) bevart (splitter lange avsnitt).
  3. Kaster ved tomt svar / manglende `groundingMetadata` / tom `searchEntryPoint` (ToS-kontrakt, 211–216).
  4. `lib/gemini/types.ts` Zod-shapes portet: `SearchEntryPointSchema.renderedContent` min(1), `GeminiResponseSchema.candidates` min(1).
  5. Build-time only — verifisert ingen import av `grounding.ts` fra `app/`-runtime eller klientkomponent.
- **Avhengigheter:** PRD 1 (re-derived typer), PRD 2 (taksonomi/readMoreQuery konsumeres av orkestrator i Unit 3).

### Unit 2 — ToS-sanering + SSRF-guard (port uendret)
- **Mål (→ G2):** Bevar DOMPurify-saneringen og SSRF-guarden uendret med eksisterende tester.
- **Filer:** `@/lib/gemini/sanitize.ts`, `@/lib/gemini/url-resolver.ts`.
- **Akseptansekriterier:**
  1. `sanitizeSearchEntryPointHtml` bevarer `ADD_TAGS:['style']`+`FORCE_BODY` (`sanitize.ts:14–30`) — verifisert at chip-carousel ikke kollapser (manifest 168). `ALLOWED_URI_REGEXP=/^https?:\/\//i` blokkerer `javascript:`/`data:`.
  2. `assertPublicHost` (`url-resolver.ts:50–76`) bruker DNS `lookup all:true` + per-addr `ipaddr.parse().range()!=='unicast'`-sjekk; privat/reserved IP blokkeres.
  3. Final-https-sjekk skjer ETTER redirect-loop (125–127, bevisst — hops kan være http underveis).
  4. `resolveUrlsParallel` p-limit=5 (139); per-hop DNS+range-sjekk; hard timeout 2s/hop.
  5. **Eksisterende SSRF/sanitize-tester porteres og passerer uendret** — denne modulen MÅ bæres uendret (CLAUDE.md-mandert, manifest 173).
- **Avhengigheter:** ingen (rene, I/O-isolerte utils).

### Unit 3 — Grounding-orkestrator (gemini-grounding.ts, v1)
- **Mål (→ G3):** Lever scriptet som populerer `themes[].grounding` (v1) med optimistic lock, whitelist-guard, totalfeil-abort og revalidateTag.
- **Filer:** `@/scripts/gemini-grounding.ts`.
- **Akseptansekriterier:**
  1. Henter report-product (`product_type='report'`) med `updated_at` for optimistic lock; whitelist-guard på `ALLOWED_REPORTCONFIG_KEYS` (43–71) HARD-FEILER på ukjent nøkkel (`290–298`). Whitelisten portes verbatim i Fase 2 (manifest:480-direktivet om typet config-modell er bevisst deferred — Beslutning 12 + Deferred-peker; ikke erstatt den i denne PRD-en).
  2. Parallell `callGemini` per tema (`Promise.allSettled`) med `readMoreQuery` (181–184); parallell SSRF-safe URL-resolve via Unit 2.
  3. `TOTAL_FAILURE_THRESHOLD=5` av 7 (95) — kun `error` teller, `skipped` ikke (350–351); ≥5 errors → abort.
  4. Deep-merge PATCH med `groundingVersion:1` (227–237), `updated_at=eq` optimistic lock (399–412); 0-rader-PATCH → abort + rollback-instruks; post-write deep-equal av preserved keys.
  5. `revalidate('product:'+projectId)` (473) etter vellykket PATCH; relative `../lib/...`-imports (script-kontekst, ikke @/-aliased).
  6. Bruker rå REST med service-role-nøkkel i header (build-time CLI, ingen cookie) — IKKE `@supabase/supabase-js` direkte fra klient.
- **Avhengigheter:** Unit 1, Unit 2, Unit 4 (lagringstype), PRD 2 (taksonomi).

### Unit 4 — Grounding-lagringstyper (diskriminert union v1|2)
- **Mål (→ G4):** Forankre grounding-lagringstypene som PRD 7-eid kontrakt i `@/lib/types`.
- **Filer:** `@/lib/types.ts` (grounding-seksjon 196–264, 373–374).
- **Akseptansekriterier:**
  1. `ReportThemeGrounding` interface med `groundingVersion: 1 | 2`; v2-only-felt (`curatedNarrative`/`curatedAt`/`poiLinksUsed`) optional på interface.
  2. `ReportThemeGroundingV1Schema` `z.literal(1)` + `.passthrough()` (bevart bevisst — manifest 459); `ReportThemeGroundingV2Schema` `z.literal(2)` med `curatedNarrative` min(100).
  3. `poiLinksUsed` er `z.array(z.string().min(1))` — IKKE strict UUID (sikkerhet via whitelist-oppslag, ikke ID-form; manifest 459).
  4. `ReportThemeGroundingViewSchema` = `z.discriminatedUnion("groundingVersion", [V1, V2])`; render-parse gjør silent skip + server-log ved mismatch. **`meta`-asymmetri dokumentert:** V2Schema (`:244–259`) declarer ikke `meta` og er ikke `.passthrough()`, så render-parse stripper `meta` av v2-objekter; `meta` er debug-only og bevisst utenfor v2 render-view (PRD 5/9 skal ikke lese `meta` post-parse på v2). Hvis en nedstrøms-konsument trenger `meta` på v2, legges `meta` (eller `.passthrough()`) til V2Schema — ellers bevares stripping bevisst (§5.2).
  5. **Beskriver v2-virkelighet** (ikke v1-only): TS-union er `1|2`. CLAUDE.md-stale-formulering flagges i Åpent spørsmål #2, ikke arvet inn i typen.
- **Avhengigheter:** PRD 1 (re-derived `@/lib/types`-baseline der grounding-typene lever).

### Unit 5 — Konsolidert POI-linker (felles kjerne + to adaptere)
- **Mål (→ G5):** Konsolider de to linkerne til ÉN delt kjerne-matcher med to tynne adaptere, uten å bryte noen call-site.
- **Filer:** `@/lib/curation/poi-matcher.ts` (ny — felles kjerne), `@/lib/utils/story-text-linker.ts` (adapter → `TextSegment[]`), `@/lib/curation/poi-linker.ts` (adapter → markdown-streng).
- **Akseptansekriterier:**
  1. Felles kjerne-matcher implementerer lengste-navn-først (`story-text-linker.ts:60–68`), første-forekomst-per-POI (`:90`) og case-insensitive matching som ÉN delt funksjon. **De divergerende aspektene (ordgrense `\b…\b` vs alternasjon `(…|…)`; `AS`/`SA`-stripping JA/NEI; kategori-prioritet JA/NEI — se §5.3-tabell) MÅ eksplisitt vedtas per adapter:** kjernen velger ett standard-sett, og hver adapter overstyrer eksplisitt der den nåværende konsumenten krever annen atferd. Golden-output-tester per call-site (alle 3 story-text-linker-sites + `curate-narrative.ts:384`) beviser null regresjon. Det er IKKE en antagelse om at de to er identiske i dag.
  2. `linkPOIsInText(text, pois): TextSegment[]` (segment-adapter) bevarer ALLE 3 call-sites uendret: `ReportThemeSection.tsx:118/123/128`, `ParaformThemeSection.tsx:18/21`, `StoryThemeChapter.tsx:32`.
  3. `linkPoisInMarkdown(markdown, poiSet, opts): LinkPoisResult` (markdown-adapter) bevarer pass-1 UUID-whitelist-validering (`validateExistingPoiLinks` cross-tenant-sikkerhet, strict `POI_UUID_RE`) + `poiLinksUsed`-retur for `curate-narrative.ts:384`.
  4. **Begge returtyper og begge sikkerhetslag bevart** (segment-array for render, markdown+poiLinksUsed for lagring; løs render-validering vs strict build-time UUID — §5.2). Ikke full merge.
  5. æøå-håndtering verifisert (manifest 182); `npx tsc --noEmit` + `npm test` grønne for begge adaptere.
- **Avhengigheter:** Unit 4 (typer). Markdown-adapteren er live via `curate-narrative.ts:384` (PRD 7 eier filene); PRD 8 vil KUNNE konsumere den (fremtidig/valgfri, ikke aktiv kontrakt i dag).

### Unit 6 — Curation-integritetslag (sanitize-input + validator)
- **Mål (→ G6):** Lever prompt-injection-sanering + anti-hallusinerings-validator verbatim, inkl. lastIndex-gotcha.
- **Filer:** `@/lib/curation/sanitize-input.ts`, `@/lib/curation/validator.ts`.
- **Akseptansekriterier:**
  1. `sanitizeGeminiInput` (38) stripper markdown-lenker (behold linktekst), kontroll/zero-width/RTL/BOM via `DANGEROUS_CHARS_RE` MED `/g` (20–21), trunkerer til `maxLength` default 3000 (23–26); returnerer teller + `truncated`-flagg.
  2. `validateCuratedNarrative` (161): proper nouns i curated output må matche `geminiNarrative ∪ poi_set.name` (case-insensitive/substring/fuzzy edit-distance-1); `extractProperNouns` (81) minus `LEADING_CAP_STOPWORDS` (19–54).
  3. Character-class-filter (zero-width/RTL) → REJECT; hard length-cap 1200 → REJECT (ikke truncate); min 100; ≤3 ukjente=warning, >3=error.
  4. **`DANGEROUS_CHARS_RE` UTEN `/g` i validator** (15–16) bevart — IKKE «fikset» til konsistens (lastIndex-gotcha gir falske negativer ved `.test()`).
- **Avhengigheter:** Unit 4 (typer).

### Unit 7 — Kuratering-orkestrator (curate-narrative.ts, v1→v2)
- **Mål (→ G7):** Lever v1→v2-orkestratoren (prepare→skill→apply build-time-dans, idempotens, PATCH `groundingVersion:2`).
- **Filer:** `@/scripts/curate-narrative.ts`.
- **Akseptansekriterier:**
  1. `prepare`-fase skriver `.curation-staging/<pid>/<theme>.context.json` med `sanitizeGeminiInput`-renset narrative (Unit 6); skill/Claude-Code-mellomsteg skriver `.curated.md`; `apply`-fase kjører `validateCuratedNarrative` (359) + `linkPoisInMarkdown` (384).
  2. **IKKE runtime-LLM-kall** — Claude via build-time skill-dans (5–13); `@anthropic-ai/sdk` brukes IKKE. Verifisert: ingen Anthropic-runtime-kall fra `app/`.
  3. Idempotens: skip hvis `curatedAt>=fetchedAt` med mindre `--force` (230–233).
  4. PATCH skriver `curatedNarrative`/`curatedAt`/`poiLinksUsed`/`groundingVersion:2` (453–456) med `updated_at=eq` optimistic lock (467); `revalidate product:${projectId}` (499–509).
  5. v1 og v2 coexister per tema gjennom curation-mellomtilstand (`.passthrough()`-toleranse, Unit 4).
- **Avhengigheter:** Unit 4, Unit 5 (markdown-adapter), Unit 6 (sanitize+validator).

### Unit 8 — Cache-revalidering + revalidate-once-avklaring
- **Mål (→ G8):** Lever revalideringskontrakten (build-time tag-match via secret-gated `/api/revalidate`) og rydd `revalidate-once`-tom-mappe.
- **Filer:** `@/app/api/revalidate/route.ts`, `@/app/api/revalidate-once/` (slett/avklar). (`@/app/api/admin/revalidate/route.ts` eies av PRD 12 — ute av PRD 7-scope, K3/Q5.)
- **Akseptansekriterier:**
  1. `revalidate/route.ts`: GET `?tag=product:{id}&secret`; `timingSafeEqual` konstant-tids secret-sjekk (43–48); `revalidateTag(tag)` (39); `REVALIDATE_SECRET` env (19). `@/`-prefix-imports.
  2. **Tag-format-matchen er VERIFISERT (Kontroll-runde 2026-06-27, K1 — blokkereren falt):** `projectId` = container-ID = `{customer}_{slug}` (`lib/pipeline/create-report-project.ts:53`), alle 4 board-sider tagger `product:${customer}_${slug}` via `unstable_cache`, og scriptene buster `product:${projectId}` (`gemini-grounding.ts:473`, `curate-narrative.ts:499`, `audio-tour-build.ts:496`, `audio-manus-write.ts:504`) + `provision-rapport.ts:155` buster literalt `product:${customer}_${slug}` — samme streng. Gjenstående arbeid er IKKE-blokkerende herding: legg til en **shape-guard** som validerer at CLI-`projectId`-arg (`gemini-grounding.ts:100`) har `{customer}_{slug}`-form, så en feilskrevet ID ikke buster en ikke-eksisterende tag stille. `getReportProductCached`-kommentaren (`gemini-grounding.ts:472`) refererer et symbol som ikke finnes — rettes til `getCachedReportProduct` (`rapport/page.tsx:17`) ved port.
  3. **`app/api/revalidate-once/` (tom mappe, ingen route.ts) slettes** (kodebase-hygiene) — med mindre Åpent spørsmål #1 lander på «implementer». Ingen kode refererer den funksjonelt.
  4. Ingen auto-TTL for grounding-cache (CLAUDE.md-regel) — kun tag-revalidering via secret-gated `/api/revalidate`. (`admin/revalidate`-path-purge er PRD 12-scope, K3/Q5.)
- **Avhengigheter:** Unit 3 + Unit 7 (kallere av secret-gated `/api/revalidate`-ruten).

> **Fullstendighet:** 8 av 8 units dekket. Hver av evidens-pakke-filene er eksplisitt klassifisert (keeper/port/dead) og tildelt en unit. Ingen sampling — begge linkere, begge orkestratorer, den secret-gated revalidate-ruten (admin/revalidate er PRD 12-scope) og alle tre sikkerhetslag har navngitt unit + akseptansekriterium.

---

## 8. Goals → Requirements-kobling

| Goal | Leveres av (requirement / unit) |
|------|---------------------------------|
| **G1.** Gemini grounding-kjerne (header-nøkkel, ToS-kast) | Unit 1 |
| **G2.** ToS-sanering + SSRF-guard uendret | Unit 2 |
| **G3.** Grounding-orkestrator v1 (lock, whitelist, abort, revalidate) | Unit 3 |
| **G4.** Grounding-lagringstyper (diskriminert union v1\|2) | Unit 4 |
| **G5.** Konsolidert POI-linker (felles kjerne + 2 adaptere) | Unit 5 |
| **G6.** Curation-integritetslag (sanitize + validator) | Unit 6 |
| **G7.** Kuratering-orkestrator v1→v2 (build-time skill-dans) | Unit 7 |
| **G8.** Cache-revalidering + revalidate-once-avklaring | Unit 8 |

---

## 9. Utviklingsløp (faser)

### Fase 1 — Rene kjerne-utils (offline, I/O-isolert)
- **Mål:** Gemini-kjerne, sikkerhetslag, typer, linker-konsolidering og integritetslag står — alt offline-testbart uten prod-skriving.
- **Leveranse:** Unit 1, 2, 4, 5, 6 ferdig; `npx tsc --noEmit`, `npm run lint`, `npm test` grønne (inkl. porterte SSRF/sanitize/validator/linker-tester).
- **Autonomi-nivå:** Høy — rene funksjoner med eksisterende test-dekning; linker-konsolidering (Unit 5) krever kaller-verifikasjon mot 3 call-sites men er deterministisk.

### Fase 2 — Build-time orkestratorer
- **Mål:** Grounding-orkestrator (v1) og kuratering-orkestrator (v1→v2) populerer `themes[].grounding` mot et test-/staging-prosjekt.
- **Leveranse:** Unit 3, 7 ferdig; verifisert mot et provisjonert test-report-product at v1 skrives, så heves til v2, med optimistic lock + post-write deep-equal grønt.
- **Autonomi-nivå:** Middels — orkestratorene rører prod-`products.config` (optimistic lock + backup obligatorisk); curation-dansen har et skill/Claude-Code-mellomsteg som ikke er fullt autonomt.

### Fase 3 — Cache-revalidering + hygiene
- **Mål:** Secret-gated `/api/revalidate`-ruten portet, tag-format-kontrakten (VERIFISERT — Kontroll-runde 2026-06-27, K1) dokumentert i runbook + shape-guard lagt til, `revalidate-once`-tom-mappe ryddet. (Admin path-purge er PRD 12-scope.)
- **Leveranse:** Unit 8 ferdig; tag-match er **empirisk bekreftet** (`projectId` = `{customer}_{slug}` = page-tag); CLI-arg shape-guard lagt til; `revalidate-once` slettet eller avklart.
- **Autonomi-nivå:** Høy — tag-format-blokkereren er falt (kontrakten holder). Gjenstår kun ikke-blokkerende shape-guard (Unit 8 AC2) og avklaring av `revalidate-once` (#1) før sletting.

---

## 10. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | Grounding-laget gater ALDRI på `reportTier` — DELTE build-time-felt | Patch #2 (manifest 757); ingen `reportTier`-ref i render-laget; tier-krav fanges av PRD 2-validator |
| 2 | Beskriv v2-VIRKELIGHET: `groundingVersion` diskriminert union `1\|2` | Kode har `z.literal(1)` OG `z.literal(2)` (`lib/types.ts:240,258`); v1→v2-migrasjonen ER gjort. CLAUDE.md «z.literal(1)» er stale (Åpent spørsmål #2) |
| 3 | v1-schema bevares `.passthrough()`; `poiLinksUsed` løs `z.array(z.string().min(1))` (element-type ikke strict UUID) | Bevisste invarianter (manifest 459) — v2-felter under curation-mellomtilstand + heterogene POI-IDer; sikkerhet via whitelist, ikke ID-form |
| 4 | To distinkte POI-link-sikkerhetslag bevart (strict build-time UUID + løs render-validering) | `poi-linker.ts:40–41` bygger kun ekte-UUID-lenker; `lib/types.ts` render-validerer løst — ulike formål, begge nødvendige |
| 5 | Konsolider linkere til felles kjerne + TO tynne adaptere, ikke full merge | ULIKE returtyper (`TextSegment[]` vs markdown) + ULIKE konsumenter; full merge ville brutt enten React-render eller build-time-lagring (manifest 736, INDEX note #3 — story-text-linker eies av PRD 7, PRD 8 KONSUMERER ikke i dag) |
| 6 | Kuratering via build-time skill-dans (prepare→fil→skill→apply), IKKE SDK-runtime | CLAUDE.md «ingen runtime-LLM»; `@anthropic-ai/sdk` finnes men brukes ikke for curation (`curate-narrative.ts:5–13`) |
| 13 | **Rollefordeling (walkthrough 2026-06-27): Gemini = data-innhenter, Fable = skriver.** Pipeline = Gemini henter grounded web-fakta + kilder → Fable skriver ferdig prosa → lagres i `products.config` (build-time, én gang) → boardet LESER ferdig tekst ved render | Andreas observerte at Fable lager svært god nivå-1-tekst; Gemini bidrar med det Fable ikke har — web-ferske fakta MED kildehenvisning (ToS-kvittering). Fable er en Claude-modell → passer rett inn i eksisterende build-time skill-dans (modellvalg, ikke omarkitektur). Tekst bygges per **område/strøk** (slik Malvik + Ranheim ble) og amortiseres over alle listings i strøket → Gemini-kost er én gang per strøk, ikke per bolig per render |
| 7 | `DANGEROUS_CHARS_RE` UTEN `/g` i validator bevart (lastIndex-gotcha) | Global regex har persistent `lastIndex` → falske negativer ved `.test()`; bevisst inkonsistens mot sanitize-input |
| 8 | Cache bustes via revalidateTag/groundingVersion-bump, ALDRI auto-TTL | CLAUDE.md-regel; build-time scripts kaller `/api/revalidate` etter PATCH |
| 9 | `revalidate-once`-tom-mappe slettes (kodebase-hygiene) | Ingen `route.ts`; ingen funksjonell referanse (Åpent spørsmål #1 kan overstyre) |
| 10 | url-resolver.ts + sanitize.ts bæres UENDRET | CLAUDE.md-mandert SSRF/ToS-forsvar (manifest 168/173); per-hop DNS+range + final-https-etter-loop er bevisst |
| 11 | Optimistic lock + backup + post-write deep-equal bæres på begge orkestratorer | Concurrent write → 0 rader → abort + rollback; verner prod-`products.config`-IP |
| 12 | `ALLOWED_REPORTCONFIG_KEYS`-whitelist portes VERBATIM i Fase 2; manifest:480-direktivet «erstatt med typet config-modell» deferred til egen oppfølging | Verbatim-port bevarer gullstandard-orkestreringen uendret (lavere risiko i rebuild-fasen); typet-config-modell (utled allowed-keys fra `ReportConfig`-typen, PRD 1/2-eid) krever stabil tier-config-kontrakt og er en ren forbedring, ikke en blokker. Eksplisitt deferred (ikke uflagget) så manifest-direktivet ikke tapes |

### Kontroll-runde 2026-06-27

| # | Funn | Dom |
|---|------|-----|
| K1 | **Revalidate-tag-match (Åpent spørsmål #3 / Unit 8 AC2) — LØST: cache-kontrakten HOLDER.** Lese-siden tagger `product:${customer}_${slug}` via `unstable_cache` i alle 4 board-sider (`rapport/page.tsx:22`, `rapport-board/page.tsx:13`, `rapport-reels/page.tsx:13`, `rapport-paraform/page.tsx:13`). Skrive-siden: `provision-rapport.ts:155` buster literalt `product:${customer}_${slug}`; grounding/audio/curate-scriptene (`gemini-grounding.ts:473`, `audio-tour-build.ts:496`, `curate-narrative.ts:499`, `audio-manus-write.ts:504`) buster `product:${projectId}` der `projectId` = container-ID = `{customer}_{slug}` (`lib/pipeline/create-report-project.ts:53`). Strengene er identiske → revalidering treffer. | LØST — blokkereren faller. ÉN herding gjenstår: scriptene tar `projectId` som fri CLI-positional-arg (`gemini-grounding.ts:100`), ingen formvalidering → legg til shape-guard (valider `{customer}_{slug}`-form) så feil ID ikke buster en ikke-eksisterende tag stille (Unit 8 AC2). |
| K2 | **story-text-linker AVKREFTET som board-dep.** `linkPOIsInText` (`lib/utils/story-text-linker.ts:49`) har 0 call-sites i `components/variants/report/board/`-treet — kun legacy variant-komponenter (`ReportThemeSection`/`ParaformThemeSection`/`StoryThemeChapter`). `poi-linker` (`lib/curation/poi-linker.ts`) er distinkt build-time curation-modul (eneste caller `curate-narrative.ts:36`) — ikke bland. | Scope segment-adapteren til legacy-variantene; IKKE dra inn i board-rebuild. De to linkerne forblir distinkte (Beslutning 5 + Åpent spørsmål #4 lukket). |
| K3 | **admin/revalidate-eierskap (Åpent spørsmål #5) — SPLITT.** `/api/revalidate` (secret-gated build-time grounding-hook, konsumert av grounding/audio/curate-scriptene) og `/api/admin/revalidate` (`ADMIN_ENABLED` manuell purge) er to distinkte ruter. | `/api/revalidate` → PRD 7 (cache-mekanismen). `/api/admin/revalidate` → PRD 12 (admin-flate). §10-punktet markert splittet. |

---

## 11. Åpne spørsmål

1. **`revalidate-once`-tom-mappe:** `app/api/revalidate-once/` har ingen `route.ts` (ls bekreftet 2026-06-26), men CLAUDE.md/INDEX note #2 (cache-revalidering)/manifest:750 refererer den som foldet inn i PRD 7. **Default: slett (Unit 8 AC3) — kodebase-hygiene.** Avklar kun om den var ment å gjøre noe spesifikt (uverifisert hva). Ikke-blokkerende for Fase 1/2.
2. **CLAUDE.md stale arkitekturregel:** CLAUDE.md sier grounding-cache bustes via «groundingVersion-bump (Zod z.literal(1))» — STALE. Koden har `z.literal(1)` OG `z.literal(2)` (`lib/types.ts:240,258`). **Bør CLAUDE.md oppdateres til «discriminated union 1\|2»?** Deferred til egen doc-PR; ikke-blokkerende.
3. **Revalidate-tag-format — LØST (Kontroll-runde 2026-06-27, K1): cache-kontrakten HOLDER, blokkereren faller.** Empirisk bekreftet at `projectId` = container-ID = `{customer}_{slug}` (`lib/pipeline/create-report-project.ts:53`), og alle 4 board-sider tagger `product:${customer}_${slug}` via `unstable_cache` (`rapport/page.tsx:22`, `rapport-board/page.tsx:13`, `rapport-reels/page.tsx:13`, `rapport-paraform/page.tsx:13`). Skrive-siden: `provision-rapport.ts:155` buster literalt `product:${customer}_${slug}`; grounding/audio/curate-scriptene buster `product:${projectId}` (`gemini-grounding.ts:473`, `audio-tour-build.ts:496`, `curate-narrative.ts:499`, `audio-manus-write.ts:504`) — samme streng. Revalidering treffer; ingen stale-editorial-risiko. **Gjenstående herding (ikke blokkerende):** `projectId` er fri CLI-positional-arg (`gemini-grounding.ts:100`) uten formvalidering → legg til shape-guard som validerer `{customer}_{slug}`-form, så en feilskrevet ID ikke buster en ikke-eksisterende tag stille (Unit 8 AC2). `gemini-grounding.ts:472`-kommentaren peker fortsatt på `getReportProductCached` som **ikke finnes** — rettes til `getCachedReportProduct` (`rapport/page.tsx:17`) ved port.
4. **Konsolideringsmodell story-text-linker + poi-linker — LØST (Kontroll-runde 2026-06-27, K2).** Bekreftet i Beslutning 5 = felles kjerne-matcher + to tynne adaptere (ikke full merge). Det gjenstående spørsmålet (er de 3 story-text-linker-call-sitene aktive i board-stien?) er nå avklart: `linkPOIsInText` har **0 call-sites i `components/variants/report/board/`-treet** — kun legacy variant-komponenter (`ReportThemeSection`/`ParaformThemeSection`/`StoryThemeChapter`). Segment-adapteren scopes derfor til legacy-variantene og dras IKKE inn i board-rebuild; `poi-linker` (markdown-adapter) forblir distinkt og leveres for PRD 8 + `curate-narrative.ts:36`. Kjernen leveres uansett.
5. **`admin/revalidate`-eierskap — LØST (Kontroll-runde 2026-06-27, K3): SPLITT.** De to rutene har distinkte formål og deles per eierskap: **`/api/revalidate`** (secret-gated build-time grounding-hook, `timingSafeEqual`, konsumert av grounding/audio/curate-scriptene) → **PRD 7** (cache-mekanismen, Unit 8). **`/api/admin/revalidate`** (`ADMIN_ENABLED`-gated manuell path-purge, `SUPABASE_CACHE_TAG`) → **PRD 12** (self-serve-admin-flate). Manifest:750-foldingen av ALLE tre ruter inn i PRD 7 overstyres her: cache-MEKANISMEN forblir PRD 7, men den manuelle admin-purge-flaten flyttes til PRD 12.

---

## 12. Avhengigheter (PRD-graf)

```
        prd-datamodell-supabase (PRD 1)        prd-tier-capability-manifest (PRD 2)
        (products.config jsonb-bærer,           (tema-taksonomi: themes[],
         @/lib/types grounding-typer)            readMoreQuery driver Gemini-søk)
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
              ┌──────── prd-grounding-curation (PRD 7 — DENNE) ────────┐
              │                         │                              │
              ▼                         ▼                              ▼
   prd-board-data-state (5)     prd-board-skall-ui (9)        prd-lokalkunnskap-moat (8)
   (leser grounding/             (rendrer grounding/           (vil KUNNE konsumere
    editorial → BoardData)        sources/searchEntryPoint;     story-text-linker —
                                  inline POI-mentions)          fremtidig/valgfri; eier ikke)
```

**Blokkeres av:** PRD 1 (jsonb-bærer + grounding-typer i `@/lib/types`), PRD 2 (tema-taksonomi + `readMoreQuery`).
**Blokkerer / konsumeres av:** PRD 5 (board-data leser grounding), PRD 8 (vil KUNNE konsumere linkeren — fremtidig/valgfri, ikke aktiv kontrakt i dag), PRD 9 (rendrer grounding/sources/searchEntryPoint).
**Distinkt fra:** PRD 3 (autonom provisjons-pipeline) — grounding er et build-time skill-spor, ikke del av PRD 3-loopen; konsumerer kun provisjonerte `pois` som POI-whitelist-kilde.

---

**Fullstendighet:** 8 av 8 implementation units spesifisert med Avhengigheter + Akseptansekriterier; 8 av 8 mål (G1–G8) enumerert i §2 og koblet til ≥1 unit i §8; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i `lib/types.ts` (196–264, 371–374), `lib/gemini/{grounding,types,sanitize,url-resolver,index}.ts`, `lib/curation/{poi-linker,sanitize-input,validator}.ts`, `lib/utils/story-text-linker.ts`, `scripts/{gemini-grounding,curate-narrative}.ts`, `app/api/{revalidate,revalidate-once}/` (admin/revalidate er PRD 12-scope), samt CARRY-OVER-MANIFEST (160–191, 459, 478–485, 736/750/756–757), 00-INDEX (PRD 07-raden deps 01/02; note #2 cache-revalidering-splitt; note #3 story-text-linker; note #10 Gemini henter / Fable skriver) og prod-schema (`products.config` jsonb NOT NULL). Ingen P0/P1/P2-tiers; deferred work plassert under §6 med PRD-pekere; ingen tier-gating spesifisert (patch #2). Stale CLAUDE.md `z.literal(1)`-formulering eksplisitt flagget (Åpent spørsmål #2), ikke arvet inn i kontrakten.

---

### Walkthrough-revisjon 2026-06-27

Produkt-/arkitekturbeslutninger fra walkthrough-gjennomgangen (Andreas):

- **Modell-rollefordeling: Gemini = data-innhenter, Fable = skriver** (Beslutning 13). Gemini henter grounded web-fakta + kilder; Fable skriver ferdig prosa. Fable er en Claude-modell → ingen omarkitektur, bare modellvalg i den eksisterende build-time skill-dansen (§1 ledd 2). Erstatter den generiske «Claude-kuratering»-formuleringen med eksplisitt Fable-som-skriver.
- **Pre-bygd én gang, per område, lest ved render.** Editorial-tekstene bygges build-time ÉN gang og lagres i `products.config` (slik Malvik kommune + Ranheim ble bygd på forhånd). Boardet kjører ingen live-AI ved visning — det LESER ferdig tekst fra Supabase. Bygging skjer per **strøk/område**, ikke per listing → Gemini-kost amortiseres over alle boliger i strøket (dissolverer «kostnad × antall listings»-bekymringen).
- **To-nivå-konsekvens:** nivå-1-editorial (autonomt) = den pre-bygde Gemini→Fable-teksten for strøket; nivå 2 (kuratert, admin-only) = din gjennomgang/berikelse oppå. Grounding gater fortsatt ALDRI på `reportTier` — delte build-time-felt (Beslutning 1).
