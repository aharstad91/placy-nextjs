# Drop-plan: `public`-legacy decommission (r01.3)

> **Status: PLAN — IKKE UTFØRT.** Dette dokumentet er r01.3-leveransen («Define,
> do NOT execute»). Selve droppen er irreversibel, gates på kriteriene i §1, og
> kjøres i egen sesjon med Andreas' eksplisitte go + `/effort xhigh`.
>
> Skrevet 2026-07-06, etter cutover-fase A (v2-lesesti, v2-først m/
> public-fallback) og fase B (pilot-provisjon ende-til-ende-verifisert:
> `intern/cutover-pilot`, 206 POI-er, reisetider 206/206, board rendret live
> fra v2 — se `assets/cutover-pilot-v2-board.jpeg`).

---

## 1. Gating (r01.3 AC1)

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

## 4. Samtidig kode-trim (r01.6 AC2, eier-besluttet 2026-06-29 → hit)

Ved droppen dør public-lesestien — samme PR trimmer:

1. `lib/supabase/v2-queries.ts`: fallback-kommentaren + `getProductAsync`-
   fallbacken til `getProductFromSupabase` fjernes (v2 blir eneste sti).
2. `lib/supabase/queries.ts`: alle public-funksjonene (containere, trips,
   theme_stories, story_sections m.m.) — transformatorene som v2-stien deler
   (`transformPOI`/`transformCategory`/`filterTrustedPOIs`) flyttes til
   `v2-queries.ts`.
3. `lib/types.ts`: døde Trip/Guide/scroll-symboler (StorySection, ThemeStory,
   ThemeStorySection, Trip/TripStop/ProjectTrip, TripConfig/TripStopConfig,
   TripCategory/TripDifficulty/TripSeason, TripStopId, createTripStopId,
   activeThemeStory/themeStories/trails; vurder TrailCollection).
4. `lib/supabase/database.types.ts`: **slettes** (0 importer, verifisert
   2026-07-06).
5. Konsument-flater som kun leser public (frosne trips-/story-ruter under
   `/for/...`, `app/trips/`, explorer/portrait/trip-varianter med
   img-warn-unntak i `eslint.config.mjs`) — enumereres med grep ved utførelse
   og slettes sammen med sine ruter + proxy-passthroughs.
6. `eslint.config.mjs`: warn-unntaket for legacy-mappene fjernes
   (`no-img-element` blir error overalt).

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
4. Kode-trim-PR (§4) — gates grønne MENS public fortsatt finnes (fallbacken
   fjernes her; boards må ALT rendre fra v2).
5. Andreas' go + `/effort xhigh` → kjør `NNN_drop_public_legacy.sql` via psql.
6. Post-drop-verifikasjon (§5) + runbook-notat + `bd close r01.3`.
