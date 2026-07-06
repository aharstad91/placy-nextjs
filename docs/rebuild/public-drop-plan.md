# Drop-plan: `public`-legacy decommission (r01.3)

> **Status: UTFØRT 2026-07-06.** Droppen er kjørt og verifisert — se §7
> (kjøringslogg). `public`-skjemaet har 0 base-tabeller; v2 er eneste
> datakilde. Dokumentet beholdes som runbook-historikk for r01.3.
>
> Skrevet 2026-07-06, etter cutover-fase A (v2-lesesti, v2-først m/
> public-fallback) og fase B (pilot-provisjon ende-til-ende-verifisert:
> `intern/cutover-pilot`, 206 POI-er, reisetider 206/206, board rendret live
> fra v2 — se `assets/cutover-pilot-v2-board.jpeg`).

---

## 1. Gating (r01.3 AC1)

> **STATUS 2026-07-06:** Gate 1 (demo-paritet) **PASSERT** — Andreas godkjente
> alle tre referanse-boardene («Godkjent, alle tre»; tellingsavvik fra ferskt
> discovery-sett akseptert). Keep-liste besluttet: **KLP-demoene**
> (ferjemannsveien-10 + teknostallen) — flyttet til v2 og live-verifisert
> samme dag (agent-orkestrert). Øvrige boards dekkes av git-backupen
> (`backup-public-*-2026-07-06.json`) og re-provisjoneres on-demand.
> Gjenstår: gate 2 (Andreas' go for selve droppen) + gate 3 (xhigh).
> **§4-kode-trimmen LANDET 2026-07-06** — public-lesestien for boardet er
> død i kode; gjenstående public-avhengigheter er inventert i §4b.

Droppen kjøres FØRST når ALLE tre er sanne:

1. **Demo-paritet validert** (PRD 1 Åpent spørsmål #8): de tre referanse-boardene
   — **Wesselslokka** (`broset-utvikling-as/wesselslokka`), **StasjonsKvartalet**
   (`bane-nor-eiendom/stasjonskvartalet`), **Ranheim/Grilstad**
   (`grilstad-marina/byggetrinn-4`) — er **re-provisjonert inn i v2 via PRD
   3-pipelinen** (IKKE migrert), kuratert innhold re-seedet (§3), og rendrer med
   paritet mot dagens demo. Paritets-dommen er visuell og Andreas'.
2. **Andreas' go** — eksplisitt, i sesjonen droppen kjøres.
3. **`/effort xhigh`** satt for kjøringen (PRD 1 §Deferred).

Inntil da: `public` står urørt som fallback, og v2-først-lesestien
(`lib/supabase/v2-queries.ts` → `lib/data-server.ts#getProductAsync`) sørger for
at v2-provisjonerte prosjekter vinner per slug.

## 2. Omfang — hva droppes

Prod har 24 base-tabeller i `public` (enumerert 2026-07-06 via
`information_schema.tables`). ALLE skal bort: de 11 døde Trip/Guide/scroll-
tabellene OG de 13 gamle keeper-tabellene (v2 er deres erstatning).

**FK-status (r01.3 AC3, avklart 2026-07-06):** 35 FK-constraints, **alle
interne i `public`** (ingen krysser til v2 — v2 har per design ingen FK-er).
Dermed: plain `DROP TABLE IF EXISTS` i barn-før-forelder-rekkefølge, **ingen
CASCADE nødvendig** (selv-FK-ene `areas.parent_id`, `pois.parent_poi_id`,
`projects_legacy.fk_projects_parent` blokkerer ikke drop av egen tabell).

Vi dropper tabellene enkeltvis og beholder selve `public`-skjemaet —
`DROP SCHEMA public CASCADE` frarådes (Supabase/PostgREST forventer at skjemaet
eksisterer; extensions/grants ligger der).

### Migrasjonsfil: `NNN_drop_public_legacy.sql` (skrives ved utførelse)

```sql
-- Rekkefølge: barn før forelder (FK-kartet 2026-07-06; re-verifiser med
-- information_schema.table_constraints rett før kjøring).
DROP TABLE IF EXISTS public.section_pois;
DROP TABLE IF EXISTS public.theme_section_pois;
DROP TABLE IF EXISTS public.story_sections;
DROP TABLE IF EXISTS public.theme_story_sections;
DROP TABLE IF EXISTS public.theme_stories;
DROP TABLE IF EXISTS public.trip_stops;
DROP TABLE IF EXISTS public.project_trips;
DROP TABLE IF EXISTS public.trips;
DROP TABLE IF EXISTS public.project_pois_legacy;
DROP TABLE IF EXISTS public.projects_legacy;
DROP TABLE IF EXISTS public.collections;
DROP TABLE IF EXISTS public.product_pois;
DROP TABLE IF EXISTS public.product_categories;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.project_pois;
DROP TABLE IF EXISTS public.generation_requests;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.place_knowledge;
DROP TABLE IF EXISTS public.pois;
DROP TABLE IF EXISTS public.category_slugs;
DROP TABLE IF EXISTS public.categories;
DROP TABLE IF EXISTS public.areas;
DROP TABLE IF EXISTS public.translations;
DROP TABLE IF EXISTS public.customers;
```

(11 legacy: trips, trip_stops, project_trips, story_sections, section_pois,
theme_stories, theme_story_sections, theme_section_pois, projects_legacy,
project_pois_legacy, collections. 13 keepers: resten.)

## 3. Pre-drop: re-seed av kuratert innhold (MÅ skje før §2)

Inventar tatt 2026-07-06 — `public` er IKKE bare test-rot; **Lokalkunnskap-
moaten (Moat 1) lever der**:

| Innhold | Rader | Re-seed-strategi |
|---|---|---|
| `public.place_knowledge` | **231** | Kopier til `v2.place_knowledge` (kolonne-paritet i baseline; INSERT…SELECT via psql) |
| `public.areas` (hierarki + boundary) | 44 (7 med `report_editorial`) | Kopier til `v2.areas` — editorial-arv (provision-steg 8) og nabolags-editorial hviler på disse |
| `public.products.config` (kuratert `reportConfig` for nivå-2-boards) | 40 | IKKE bulk-kopi. Re-provisjonér prosjektene i v2; for de kuraterte re-seedes `reportConfig`-subnøkkelen eksplisitt per board (temaer/grounding/reels-refs), à la referanse-boardene |
| `public.translations` | 2720 | Kopier til `v2.translations` (EN-oversettelser for POI/temaer) |
| `public.pois` (redaksjonelle felt: editorial_hook/local_insight) | delmengde | Dekkes normalt av re-provisjonering + editorial-arv; diff-sjekk kuraterte POI-er per referanse-board før drop |

Re-seed-migrasjoner skrives som egne filer (`NNN_reseed_moat_til_v2.sql`) og
kjøres + verifiseres (rad-antall + stikkprøver) FØR drop-steget.

> **STATUS 2026-07-06 — re-seed DELVIS UTFØRT (i forbindelse med referanse-
> board-provisjonering):** `areas` 44/44 ✓ (7 m/ editorial), `place_knowledge`
> 231/231 kopiert ✓ men kun **113 av 227** poi-nøklede rader remappet til
> v2-POI-er (resten dangler til POI-ene deres provisjoneres inn — **remappen
> MÅ re-kjøres etter hver provisjonering og fullføres/aksepteres før drop**,
> for etter droppen finnes ikke mapping-kilden `public.pois` lenger).
> `categories`: 133 definisjoner kopiert (inkl. skole/barnehage som pipelinen
> skrev POI-er med uten definisjon — pipeline-buggen er fikset i
> `import-public-pois.ts`). Kuratert `reportConfig` + POI-editorial (184 POI-er)
> re-seedet for de tre referanse-boardene.
>
> **`translations` KOPIERT 2026-07-06** via migrasjon
> `072_reseed_translations_til_v2.sql` (re-kjørbar, ON CONFLICT DO NOTHING):
> 404 rader — 366 poi (place_id/nsr/osm-remap), 30 rene tema-id-er, 8
> produkt-komposit-remappet. 0 report-rader (alle 7 tilhører ikke-migrerte
> prosjekter). Slug-æra-poi-id-er (2045 rader) og ikke-migrerte boards dekkes
> av git-backupen. **072 må re-kjøres etter hver provisjonering av board med
> EN-innhold, og senest FØR drop** (som place_knowledge-remappen).
> Verifisert live: EN-editorial i stasjonskvartalet-boardets payload.

## 4. Samtidig kode-trim (r01.6 AC2, eier-besluttet 2026-06-29 → hit)

> **STATUS: UTFØRT 2026-07-06** (Andreas' «ja, kjør videre»; alle gates
> grønne, live-verifisert). Utført omfang — planens seks punkter pluss det
> utførelses-grepen avdekket:
>
> 1. ✅ `getProductAsync` = v2-only; `getProjectAsync` = JSON-only;
>    container/trips/products-funksjonene i data-server slettet (0 konsumenter).
> 2. ✅ `queries.ts` SLETTET; transformerne flyttet til `v2-queries.ts`;
>    `getCollectionBySlug` → `lib/supabase/collections.ts` (lever til drop).
> 3. ✅ Trip/Guide/scroll-typene + gamification + branded-types + container-
>    typene (ProjectContainer/ProductInstance/ProductSummary) trimmet;
>    `Story` mistet `sections`/`themeStories`. TrailCollection BEHOLDT (levende
>    trails-feature på boardet). `lib/store.ts` (gammel global Zustand) slettet
>    — boardet bruker sine egne stores.
> 4. ✅ `database.types.ts` slettet + døde Db-aliaser i `types.ts`.
> 5. ✅ Slettet: `app/for/**`, `app/trips/**`, `app/api/poi-trips`,
>    variants/{explorer,portrait,trip}, gammel scroll-rapport
>    (`rapport/page.tsx` + ReportPage-treet), `components/story/**`,
>    story-generator-scriptene (migrate-to-supabase, migrate-trips, seed-trips)
>    + story-skrivefunksjonene i mutations.ts + ~100 transitivt foreldreløse
>    komponenter (import-graf-sweep til konvergens). Eiendom-landingen skrevet
>    om til v2-generation-pending-sjekk + redirect til `rapport-board`;
>    event-landingen redirecter til `board`. Proxy: /for-frysing fjernet,
>    `/rapport` → `/rapport-board` 301. Grounding-RENDERERNE (GroundingChips/
>    SourcesAggregated) fulgte scroll-rapporten i døden — grounding-datapipen
>    (build-time) består; board-side rendering er fremtidig arbeid.
> 6. ✅ eslint-warn-unntaket fjernet (`no-img-element` = error overalt).
>
> `mapboxAdapter`-sentinelen i map-adapter.test.ts fyrte som designet →
> hele MapAdapter-laget (map-adapter + use-interaction-controller) kuttet.
> inherit-area-editorial (pipeline-steg 8) retargetet til
> `getProductFromSupabaseV2` — leste tidligere public-boardet (skjult bug).

Opprinnelig plan (seks punkter) beholdt i git-historikken.

## 4b. Gjenstående public-lesere — STATUS 2026-07-06 (samme dag): ALLE HÅNDTERT

- ✅ `app/admin/page.tsx` — dashboard-tellere → v2; «Offentlige sider»-widget
  + `/admin/public`-siden SLETTET (fulgte SEO-flaten)
- ✅ `app/api/admin/trust-validate/*` → v2 + `updatePOITrustScore` hardt
  v2-bundet (skrev public mens boardet leste v2 — skjult-bug-klasse)
- ✅ `app/kart/[slug]` → `v2.generation_requests`
- ✅ `lib/google-places/trust-enrichment.ts` — skjema-agnostisk (kalleren
  binder klienten); begge kallere er v2
- ✅ Collections → v2 (migrasjon 073: tabell + RLS + 6 rader; les/skriv portet)
- ✅ `category_slugs` 58/58 → v2 (også 073)
- ✅ **(public)-SEO-flaten SLETTET** (Andreas 2026-07-06: «gammelt rot» —
  ingen SEO-mål, alt skal embeddes): `app/(public)/**`, `lib/public-queries`,
  `public-client`, `curated-lists`, components/{guide,public,seo}. Ny minimal
  forside (`app/page.tsx`, ingen DB). Proxy-passthroughs for /en +
  /trondheim fjernet; sitemap var alt tom.
- ✅ **Scripts-inventar:** 13 public-æra import-scripts (import:taxi/hyre/
  kommune/atb/bysykkel/kml/riksantikvaren + 6 event-importere) SLETTET
  (slug-id-skjema inkompatibelt med v2-uuid; pool-dataen bæres av 074;
  fremtidige refreshere bygges som PRD 3-pipeline-kilder). Wesselslokka-
  one-offs + reclassify-passene slettet. Den LEVENDE kurerings-/TTS-
  verktøykjeden (curate-narrative, audio-manus-write, audio-tour-build,
  gemini-grounding, apply-curation-staging, set/validate-report-tier,
  seed-trails, refresh-/resolve-verktøyene, patch-product-config) PORTET
  til v2 via Accept-/Content-Profile-headere — de skrev public mens
  boardet leste v2 (samme skjulte-bug-klasse, toolchain-nivå).

**Klart for drop-sesjonen (xhigh):** kjør `074_poi_pool_migrering_til_v2.sql`
(pool + place_knowledge-remap + slug-æra-translations i én transaksjon) →
verifiser → kjør `075_drop_public_legacy.sql` (pre-flight + DROP + §5).

## 5. Post-drop-verifikasjon (r01.3 AC4)

1. REST mot droppet tabell returnerer feil/404:
   `curl "$SUPABASE_URL/rest/v1/trips?limit=1" -H "apikey: $ANON"` →
   PostgREST-feil (ikke 200 med `[]`).
2. Alle re-provisjonerte boards rendrer via v2 (smoke 200 + ett board i
   nystartet Chrome).
3. Fulle gates: tsc 0, lint 0 errors, alle tester, build.
4. `information_schema.tables WHERE table_schema='public' AND
   table_type='BASE TABLE'` → 0 rader.

## 6. Rekkefølge oppsummert (kjøre-sesjonens huskeliste)

1. Re-provisjonér de tre referanse-boardene inn i v2 (+ øvrige boards som skal
   overleve cutover) — `--update` ved re-kjøring.
2. Re-seed moat-innhold (§3) + kuratert `reportConfig` per nivå-2-board.
3. Demo-paritet: Andreas godkjenner visuelt (gate §1.1).
4. ~~Kode-trim-PR (§4)~~ **UTFØRT 2026-07-06** — gates grønne, boards rendrer
   fra v2, gamle boards mørke.
5. §4b-sjekklista: porter/slett gjenstående public-lesere (admin, (public)-SEO,
   kart, collections, trust-validate).
6. ~~Andreas' go + `/effort xhigh` → kjør droppen~~ **UTFØRT 2026-07-06** (§7).
7. ~~Post-drop-verifikasjon (§5) + runbook-notat + `bd close r01.3`~~ **UTFØRT**.

## 7. Kjøringslogg — drop-sesjonen 2026-07-06

Andreas' «fortsett nå» etter go. Sekvens og resultater:

**Pre-flight (read-only):** 8/9 sjekker som forventet. Avvik: 347 id-overlapp
public.pois ↔ v2.pois (074-headeren antok 0). Undersøkt før kjøring: **alle
347 er samme fysiske sted** (347/347 samme koordinat, 343/347 identisk navn,
0 motstridende) — id-gjenbruk fra tidligere provisjonering, trygt fordi
`ON CONFLICT (id) DO NOTHING` + map-oppslaget peker riktig.

**074 (pool-migrering):** Første kjøring feilet på typemismatch — `v2.pois.id`
er **TEXT, ikke uuid** (074 var skrevet på uuid-antakelse; transaksjonen
rullet trygt tilbake). Fiks: `COALESCE(ex.id, c.canon_pub_id)` — public-id
gjenbrukes alltid. Re-kjørt OK: `_canon` 5237 (5327 − 90 dupes ✓), INSERT
4889 kanoniske rader (348 hoppet = fantes alt i v2 ✓), parent-remap 4,
place_knowledge-remap 0 (id-gjenbruken løste alle 114 danglere ved insert —
sluttsjekk 0 ✓), 2190 slug-æra-translations (366+2190=2556 ✓).
v2.pois totalt: 5386.

**074b (editorial-backfill, skrevet i sesjonen):** 73 public-rader m/
editorial hadde v2-motpart UTEN editorial (fantes alt i v2 → hoppet over av
074s insert). Additiv backfill (kun NULL-felter, tagget
`editorial_backfill='074b'`): 50 v2-rader fylt. Resterende 23 verifisert som
falske positiver (kanonisk søskenrad bærer editorial for samme sted via
place_key). **0 editorial tapt** — 2618 m/ editorial i v2 (2640 − 22
dedup-kollaps).

**075 (DROP):** Alle 4 pre-flight-betingelser oppfylt (4889 > 4000 ✓,
0 danglere ✓, 35 FK-er ✓, backupene finnes ✓). 24 tabeller droppet i én
transaksjon, COMMIT OK.

**§5-verifikasjon (alle passert):**
1. `information_schema`: 0 base-tabeller i public; skjemaet selv består ✓
2. REST mot droppet tabell: 404 PGRST205 («Could not find the table
   'public.trips'»); v2-lesestien 200 ✓
3. Alle 6 boards 200 på prod med `x-vercel-cache: MISS` (ferske rendringer
   post-drop, ikke cache); byggetrinn-4 rendret komplett i nystartet Chrome
   (temanav, 20 POI-er, 3D-kart, 0 konsollfeil); Rockheim-EN-oversettelsen
   verifisert i v2 via REST ✓
4. Gates: tsc 0, lint 0 errors (55 warnings), alle tester, build ✓

**Reversibilitet som gjenstår i DB:** 074-radene kan angres via
`poi_metadata->>'pool_migration'='074'`-taggen, 074b via
`editorial_backfill='074b'`. Selve droppen er endelig; kaldlager =
`backup-public-*-2026-07-06.json` + git-historikk.
