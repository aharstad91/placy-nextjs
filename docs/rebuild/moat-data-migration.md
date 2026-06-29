# Moat-data-migrering — kilde-audit (lokalkunnskap / editorial)

> **Status:** Autoritativ kilde-audit for PRD 8 (`prd-lokalkunnskap-moat`), Unit 7 (data-bevaring + dead-code-sletting).
> **Hvorfor:** `CARRY-OVER-MANIFEST.md` linje 644 instruerer «ekstraher Sem & Johnsen-innholdet inn i nytt `place_knowledge`/`areas.report_editorial` — ikke mist det». Den instruksjonen var **upresis om mål-tabeller**. Denne auditen klassifiserer hver navngitt migrasjon fil-for-fil og fastslår hvor editorial-innholdet FAKTISK lever, slik at ingenting mistes i 69→1-baseline-kollapsen (PRD 1).
> **Metode:** `grep` av `UPDATE`/`INSERT INTO`-mål-tabell i hver fil i den manifest-navngitte mengden (`020–031`, `049`, `053–064`) + `039` (place_knowledge-seed). Full dekning, ikke sampling — 26 filer klassifisert.

---

## Hovedfunn

**INGEN av de manifest-navngitte migrasjonene (020–031/049/053–064) skriver `areas.report_editorial` eller `place_knowledge`.** Editorial-innholdet lever i to tabeller, begge **keeper-core** i PRD 1s baseline og dermed **bevart PASSIVT** (raddata overlever in-place — ingen aktiv flytting kreves):

| Mål-tabell | Innhold | Migrasjoner | Bevaring |
|------------|---------|-------------|----------|
| `pois.editorial_hook` / `local_insight` | Redaksjonell POI-tekst (café/bakeri/restaurant/museum + parent-POI-strukturer) | 020–027, 029, 057–059 (12) | PRD 1 baseline (in-place) |
| `products.config` (bridgetext / hero / AI-lenker / kategori-beskrivelser) | Per-prosjekt redaksjonell board-tekst | 028, 030, 031, 049, 053–055, 062–064 (10) | PRD 1 baseline (in-place) |
| `place_knowledge` (rader) | Trondheim-lokalkunnskap-seed | **039** (utenfor manifestets navngitte range) | PRD 1 baseline (in-place) |

Øvrige filer i mengden er **ikke editorial-data**:

| Fil | Karakter |
|-----|----------|
| `056_parent_poi_id.sql` | Skjema (legger til `pois.parent_poi_id`-kolonne) — populeres av 057/058 |
| `060_coachella_2026_demo.sql` | Demo-data (`INSERT` + `UPDATE pois`) — ikke produksjons-editorial |
| `061_projects_homepage_url.sql` | Skjema (legger til `projects.homepage_url`-kolonne) |

**Ingen literal «Sem Johnsen»-merkenavn-streng finnes i migrasjonene** — manifestet beskriver editorial-KVALITETEN/voicen (redaksjonell standard fra Sem & Johnsen-leveransene), ikke et merkenavn som skal letes etter.

---

## Full fil-for-fil-klassifisering

| Migrasjon | Mål-tabell | Klasse |
|-----------|-----------|--------|
| `020_cafe_data_cleanup.sql` | `UPDATE pois` | editorial (pois) |
| `021_cafe_editorial_content.sql` | `UPDATE pois` | editorial (pois) |
| `022_bakery_data_cleanup.sql` | `UPDATE pois` | editorial (pois) |
| `023_bakery_editorial_content.sql` | `UPDATE pois` | editorial (pois) |
| `024_cafe_editorial_improvements.sql` | `UPDATE pois` | editorial (pois) |
| `025_restaurant_editorial_content.sql` | `UPDATE pois` | editorial (pois) |
| `026_museum_editorial_content.sql` | `UPDATE pois` | editorial (pois) |
| `027_cafe_editorial_v2.sql` | `UPDATE pois` | editorial (pois) |
| `028_scandic_nidelven_bridgetext_curator.sql` | `UPDATE products` | editorial (products.config) |
| `029_restaurant_editorial_v2.sql` | `UPDATE pois` | editorial (pois) |
| `030_scandic_nidelven_bridgetext_v2.sql` | `UPDATE products` | editorial (products.config) |
| `031_scandic_nidelven_category_descriptions.sql` | `UPDATE products` | editorial (products.config) |
| `039_seed_knowledge_trondheim.sql` | `INSERT INTO place_knowledge` | lokalkunnskap-seed |
| `049_broset_bridge_text_hero_insight.sql` | `UPDATE products` | editorial (products.config) |
| `053_ai_links_barn_mat_natur.sql` | `UPDATE products` | editorial (products.config) |
| `054_fix_ai_links_natur_opplevelser.sql` | `UPDATE products` | editorial (products.config) |
| `055_shorten_ai_link_labels.sql` | `UPDATE products` | editorial (products.config) |
| `056_parent_poi_id.sql` | (skjema) | kolonne-tillegg |
| `057_wesselslokka_parent_pois.sql` | `UPDATE pois` | editorial (pois) + parent-lenker |
| `058_fix_valentinlyst_children.sql` | `UPDATE pois` | editorial (pois) + parent-lenker |
| `059_valentinlyst_website.sql` | `UPDATE pois` | editorial (pois) |
| `060_coachella_2026_demo.sql` | `INSERT` + `UPDATE pois` | demo-data |
| `061_projects_homepage_url.sql` | (skjema) | kolonne-tillegg |
| `062_wesselslokka_bridge_text_apple_emphasis.sql` | `UPDATE products` | editorial (products.config) |
| `063_wesselslokka_bridge_text_expanded.sql` | `UPDATE products` | editorial (products.config) |
| `064_wesselslokka_hero_intro_apple_emphasis.sql` | `UPDATE products` | editorial (products.config) |

---

## Konsekvens for PRD 8 Unit 7

1. **Ingen aktiv editorial-«migrering» kreves.** `pois`-editorial + `products.config`-bridgetext + `place_knowledge`-rader (seed 039) bevares passivt av PRD 1s baseline-datavern (pre/post rad-antall-verifikasjon i 69→1-kollapsen).
2. **Det eneste AKTIVE arbeidet** i Unit 7 er net-ny `areas.report_editorial`-staging for Trondheim-strøkene (nytt kurator-innhold per skolekrets-polygon) — ikke flytting av eksisterende data.
3. **Dead-code-sletting** (uendret): `app/admin/knowledge/{page,knowledge-admin-client}.tsx`, `app/api/admin/knowledge/route.ts`, `scripts/backfill-knowledge.ts`, `getAllKnowledgeAdmin` i `lib/supabase/queries.ts`.

> Manifestets «ekstraher inn i `place_knowledge`/`areas.report_editorial`» (linje 644) erstattes av denne auditen: behold der dataen ligger (`pois`/`products`/`place_knowledge`), bygg net-nytt for strøk-editorial.
