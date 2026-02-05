# Brainstorm: Prosjekthierarki-restrukturering

**Dato:** 2026-02-05
**Status:** Ferdig brainstormet

## Hva vi bygger

En ny hierarkisk datamodell som skiller mellom **Prosjekter** (fysiske steder/konsepter) og **Produkter** (Explorer, Guide, Report). Dette erstatter dagens flate prosjektliste der samme sted vises som separate prosjekter for hvert produkttype.

### Ny struktur

```
Kunde (customers)
  └── Prosjekt (projects)           ← NY entitet
        ├── name
        ├── center_coordinates
        ├── POI-pool (project_pois)
        ├── Kategori-pool (project_categories)
        └── Produkter (products)    ← Det som i dag heter "projects"
              ├── Explorer
              ├── Report
              └── Guide
```

### Eksempel: Quality Hotel Augustin

**Før:**
- Project: "Quality Hotel Augustin" (Explorer)
- Project: "Quality Hotel Augustin" (Report)
- Project: "Quality Hotel Augustin" (Guide) - kommer

**Etter:**
- Kunde: Strawberry
  - Prosjekt: Quality Hotel Augustin
    - POI-pool: 25 steder
    - Kategori-pool: 8 kategorier
    - Produkter:
      - Explorer (bruker 25/25 POI-er, 8/8 kategorier)
      - Report (bruker 15/25 POI-er, 5/8 kategorier)
      - Guide (bruker 10/25 POI-er, 3/8 kategorier)

## Hvorfor denne tilnærmingen

1. **Datadeling:** POI-er og kategorier defineres én gang på prosjektnivå, gjenbrukes på tvers av produkter
2. **Valgfri filtrering:** Hvert produkt velger hvilke POI-er og kategorier det faktisk bruker fra prosjektets pool
3. **Ryddig admin:** Prosjektlisten viser unike steder, ikke duplikater per produkttype
4. **Logisk URL-struktur:** `/{kunde}/{prosjekt}/explorer` matcher datamodellen
5. **Fremtidssikker:** Enkelt å legge til nye produkttyper uten å duplisere data

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Hierarkinivå | Ny `projects`-tabell | Renere modell enn parent_project_id hack |
| POI-deling | Valgfri fra felles pool | Fleksibilitet - Explorer kan ha flere POI-er enn Report |
| Kategorier | Global admin + prosjektfiltrering | Globale kategorier, men hvert produkt velger hvilke som vises |
| Opprettelsesflyt | Prosjekt først | Opprett prosjekt med navn/koordinater, deretter legg til produkter |
| URL-struktur | `/{kunde}/{prosjekt}/{produkt}` | Logisk hierarki som speiler datamodellen |
| Prosjekt-landing | Enkel landingsside | `/{kunde}/{prosjekt}/` viser intro + lenker til produktene |

## Datamodell (konseptuell)

### Nye tabeller

```sql
-- Prosjekt-container (NY)
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  name TEXT NOT NULL,
  url_slug TEXT NOT NULL,
  center_lat NUMERIC NOT NULL,
  center_lng NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, url_slug)
);

-- Produkter (erstatter dagens projects)
CREATE TABLE products (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('explorer', 'report', 'guide')),
  story_title TEXT,
  story_intro_text TEXT,
  story_hero_images TEXT[],
  -- Produktspesifikke config-felter
  report_config JSONB,
  guide_config JSONB,
  explorer_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, product_type)
);

-- POI-er på prosjektnivå
CREATE TABLE project_pois (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  poi_id UUID REFERENCES pois(id),
  category_id UUID REFERENCES categories(id),
  -- ... andre felter
);

-- Hvilke POI-er hvert produkt bruker
CREATE TABLE product_pois (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  project_poi_id UUID REFERENCES project_pois(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, project_poi_id)
);

-- Hvilke kategorier hvert produkt viser
CREATE TABLE product_categories (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  display_order INTEGER,
  PRIMARY KEY (product_id, category_id)
);
```

### Kategorier forblir globale

- `/admin/categories` beholdes som global kategori-admin
- Kategorier kan tilordnes til prosjekter
- Hvert produkt velger hvilke av prosjektets kategorier som skal vises

## Admin UI-endringer

### Prosjektlisten (`/admin/projects`)

**Før:** Flat liste med duplikater per produkttype
**Etter:** Liste over unike prosjekter med produkt-badges

| Navn | Kunde | Produkter | Koordinater |
|------|-------|-----------|-------------|
| Quality Hotel Augustin | Strawberry | 🗺️ 📄 🚶 | 63.43, 10.39 |
| 10,000 skritt Trondheim | VisitNorway | 🚶 | 63.43, 10.39 |

### Prosjektdetalj (`/admin/projects/[id]`)

**Tabs:**
1. **Detaljer** - Navn, kunde, koordinater, beskrivelse
2. **POI-er** - Prosjektets POI-pool (alle tilgjengelige)
3. **Kategorier** - Hvilke kategorier er tilgjengelige for dette prosjektet
4. **Produkter** - Liste over produkter med lenker til produktdetalj

### Produktdetalj (`/admin/projects/[id]/products/[productType]`)

**Tabs:**
1. **Detaljer** - Story-tittel, intro, hero-bilder
2. **POI-er** - Velg hvilke av prosjektets POI-er som brukes (checkboxes)
3. **Kategorier** - Velg hvilke kategorier som vises (checkboxes)
4. **Konfigurasjon** - Produktspesifikk config (reportConfig, guideConfig, etc.)

## URL-routing

| URL | Innhold |
|-----|---------|
| `/{kunde}/{prosjekt}/` | Prosjekt-landing med produktoversikt |
| `/{kunde}/{prosjekt}/explorer` | Explorer-produkt |
| `/{kunde}/{prosjekt}/report` | Report-produkt |
| `/{kunde}/{prosjekt}/guide` | Guide-produkt |

### Redirect for gamle URL-er

`/{kunde}/{prosjekt-type-slug}` → `/{kunde}/{prosjekt}/{produkttype}`

## Avklarte spørsmål

| Spørsmål | Beslutning |
|----------|------------|
| **Migrasjon** | Automatisk basert på navn - script stripper suffiks (-explore, -report, -guide) og grupperer |
| **JSON-filer** | Fjern helt - migrer alt til Supabase, én datakilde |
| **Story-felter** | På produktnivå, kun for Report foreløpig (Guide kan arve senere) |
| **Default redirect** | Nei - alltid vis landing-page med "opprett produkt"-knapper for manglende produkttyper |

## Implementasjonsomfang

### Inkludert
- Ny database-struktur (projects + products tabeller)
- Migrasjon av eksisterende data (automatisk navnematching)
- Admin UI-endringer (prosjektliste, prosjektdetalj, produktdetalj)
- URL-routing endringer (`/{kunde}/{prosjekt}/{produkt}`)
- Prosjekt-landing med produktoversikt og "opprett produkt"-knapper
- Global kategori-admin beholdes

### Eksplisitt ekskludert
- JSON-fil støtte (fjernes helt)
- Story-felter på prosjektnivå (kun på produkt, kun Report foreløpig)

## Neste steg

Kjør `/workflows:plan` for å lage implementasjonsplan.
