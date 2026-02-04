# Brainstorm: Prosjekt-detaljside med egne kategorier

**Dato:** 2026-02-04
**Status:** Klar for planlegging

## Hva vi bygger

En dedikert prosjektside (`/admin/projects/[id]`) som erstatter dagens modal-baserte redigering. Siden skal håndtere:

1. **Prosjektdetaljer** - Navn, kunde, koordinater, produkttype (eksisterende felt)
2. **Prosjekt-kategorier** - Helt separate fra globale kategorier
3. **POI-utvalg** - Administrere hvilke POI-er som tilhører prosjektet

## Hvorfor denne tilnærmingen

### Problemet
Explorer brukes til mange forskjellige bruksområder. Open House Oslo/Trondheim la til "engangs-kategorier" (bydeler) som nå blandes med generiske kategorier (restaurant, badeplass) i den globale kategori-listen. Med 34+ kategorier blir det uoversiktlig.

### Løsningen
Prosjekt-spesifikke kategorier som er 100% isolert fra globale kategorier. Hvert prosjekt kan:
- Ha sine egne kategorier med eget navn, ikon og farge
- Velge POI-er som bruker enten globale ELLER prosjekt-kategorier
- Administreres på én dedikert side

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Datamodell | Ny `project_categories` tabell | Ren separasjon, ingen migrasjonsrisiko |
| UI | Dedikert side med tabs | Mer plass til kompleks funksjonalitet |
| POI-kategorier | Kan bruke begge typer | Fleksibilitet for ulike bruksområder |
| Prosjekt-kategorier | Helt separate | Unngår forurensning av global kategori-liste |

## Datamodell

### Ny tabell: `project_categories`

```sql
CREATE TABLE project_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'map-pin',
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_categories_project ON project_categories(project_id);
```

### Utvidet `project_pois` junction

```sql
ALTER TABLE project_pois
ADD COLUMN project_category_id UUID REFERENCES project_categories(id) ON DELETE SET NULL;
```

Dette lar en POI i et prosjekt bruke enten:
- `poi.category_id` (global kategori)
- `project_pois.project_category_id` (prosjekt-kategori, overstyrerer global)

## UI-struktur

```
/admin/projects/[id]
├── Tab: Detaljer
│   └── Navn, kunde, koordinater, produkttype (eksisterende felt)
├── Tab: Kategorier
│   └── CRUD for prosjekt-spesifikke kategorier
└── Tab: POI-er
    └── Velg POI-er, tildel prosjekt-kategori
```

## Åpne spørsmål

1. **Migrering av Open House-kategorier?** - Skal vi flytte eksisterende "bydel"-kategorier til prosjekt-kategorier, eller la dem ligge?
2. **Kategori-visning i Explorer?** - Hvordan skal UI skille mellom globale og prosjekt-kategorier?
3. **Import-flyt** - Når POI-er importeres, skal de automatisk få prosjekt-kategori?

## Neste steg

Kjør `/workflows:plan` for å lage implementasjonsplan.
