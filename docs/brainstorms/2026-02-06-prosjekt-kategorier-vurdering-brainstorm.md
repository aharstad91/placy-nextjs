# Brainstorm: Prosjekt-kategorier — trengs det?

**Dato:** 2026-02-06
**Status:** Besluttet — skjul UI, behold kode

## Hva dette handler om

Admin-panelet har en "Prosjekt-kategori"-funksjon som lar deg overstyre den globale kategorien til en POI per prosjekt. I praksis brukes dette **aldri** — alle POI-er viser "Bruk global: [kategori]".

## Hva som finnes

1. **Kategorier-fanen** — Admin kan opprette prosjekt-spesifikke kategorier med ikon/farge
2. **Prosjekt-kategori-kolonnen** i POI-er-fanen — Dropdown for å overstyre global kategori per POI
3. **Database**: `project_categories`-tabell og `project_category_id` på `project_pois`

## Beslutning

**Skjul UI-en, behold kode og database.**

- Fjern "Prosjekt-kategori"-kolonnen fra POI-tabellen i admin
- Skjul "Kategorier"-fanen
- Legg til kommentarer i koden om at dette muligens fjernes over tid
- Database-tabellen og kolonnen beholdes (ufarlig, ingen migrasjon nødvendig)

## Begrunnelse

- YAGNI — ingen har brukt dette i praksis
- Enklere admin-grensesnitt for brukeren
- Kan gjeninnføres ved behov
- Uklar brukscase — bedre å fjerne støy enn å forvirre

## Neste steg

Implementer skjuling via `/workflows:work` eller direkte redigering.
