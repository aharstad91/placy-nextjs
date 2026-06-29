# Placy v2 baseline — ERD

Kanonisk entitetsrelasjons-diagram for `v2`-skjemaet (PRD 1, `supabase/migrations/070_baseline.sql`).
Dekker de **13 keeper-tabellene** + **`events`** (greenfield, opprettes av Unit 2 / bead `r01.2`).

> **FK-løst skjema.** Snapshot-konvensjonen bruker FK-løse `text`-koblinger (f.eks. `pois.area_id`
> uten erklært `FOREIGN KEY`). `v2` speiler dette — **relasjonene under er LOGISKE, ikke databasе-
> håndhevede** (PRD 1 Åpent spm #2 + Beslutning). De viser hvilke kolonner som kobler tabellene,
> ikke erklærte constraints. `PK`-markørene og `UNIQUE`-nøklene er derimot reelle (se DDL-en).
>
> Typetokens er forenklet for mermaid (`float8` = double precision, `timestamptz` = timestamp with
> time zone; array-kolonner er `text[]`, markert i kommentar). Autoritativ kilde for kolonne-typer
> og NOT NULL er `070_baseline.sql`.

```mermaid
erDiagram
    customers ||--o{ projects : "customer_id"
    customers |o--o{ generation_requests : "customer_id"
    projects ||--o{ products : "project_id"
    projects ||--o{ project_pois : "project_id"
    projects |o--o{ generation_requests : "project_id"
    projects |o--o{ events : "project_id"
    products ||--o{ product_pois : "product_id"
    products ||--o{ product_categories : "product_id"
    products |o--o{ events : "product_id"
    pois ||--o{ project_pois : "poi_id"
    pois ||--o{ product_pois : "poi_id"
    pois |o--o{ place_knowledge : "poi_id"
    pois |o--o{ events : "poi_id"
    pois |o--o{ pois : "parent_poi_id"
    categories ||--o{ category_slugs : "category_id"
    categories ||--o{ product_categories : "category_id"
    categories |o--o{ pois : "category_id"
    areas |o--o{ pois : "area_id"
    areas |o--o{ place_knowledge : "area_id"
    areas |o--o{ areas : "parent_id"

    customers {
        text id PK
        text name
        timestamptz created_at
    }

    categories {
        text id PK
        text name
        text icon
        text color
        timestamptz created_at
    }

    category_slugs {
        text category_id PK
        text locale PK
        text slug UK
        text seo_title
        text seo_description
        text intro_text
    }

    areas {
        text id PK
        text name_no
        text name_en
        text slug_no
        text slug_en
        text description_no
        text description_en
        numeric center_lat
        numeric center_lng
        int zoom_level
        bool active
        timestamptz created_at
        text parent_id
        text level
        jsonb boundary
        text postal_codes "text[]"
        jsonb report_editorial
    }

    projects {
        text id PK
        text customer_id
        text name
        text url_slug
        numeric center_lat
        numeric center_lng
        text description
        int version
        timestamptz created_at
        timestamptz updated_at
        text short_id
        text venue_type
        jsonb discovery_circles
        text welcome_tagline
        text default_product
        text welcome_image
        text welcome_title
        text tags "text[]"
        jsonb theme
        text homepage_url
        bool has_3d_addon "NN"
        text venue_context
    }

    products {
        text id PK
        text project_id
        text product_type
        jsonb config "NN — tier-manifest"
        text story_title
        text story_intro_text
        text story_hero_images "text[]"
        int version
        timestamptz created_at
        timestamptz updated_at
    }

    pois {
        text id PK
        text name
        numeric lat
        numeric lng
        text address
        text category_id
        text google_place_id
        numeric google_rating
        int google_review_count
        text google_maps_url
        text photo_reference
        text editorial_hook
        text local_insight
        text story_priority
        text editorial_sources "text[]"
        text featured_image
        text description
        text entur_stopplace_id
        text bysykkel_station_id
        text hyre_station_id
        timestamptz created_at
        timestamptz updated_at
        numeric trust_score
        text trust_flags "text[] NN"
        timestamptz trust_score_updated_at
        text google_website
        text google_business_status
        int google_price_level
        smallint poi_tier
        text tier_reason
        bool is_chain
        bool is_local_gem
        jsonb poi_metadata
        timestamptz tier_evaluated_at
        text area_id
        jsonb opening_hours_json
        text google_phone
        timestamptz opening_hours_updated_at
        text facebook_url
        text gallery_images "text[]"
        timestamptz photo_resolved_at
        text source
        text nsr_id
        text barnehagefakta_id
        text osm_id
        text event_dates "text[] reference-only"
        text event_time_start
        text event_time_end
        text event_description
        text event_url
        text event_tags "text[] reference-only"
        text parent_poi_id
        text anchor_summary
    }

    place_knowledge {
        text id PK
        text poi_id
        text area_id
        text topic
        text fact_text
        text fact_text_en
        jsonb structured_data
        text confidence
        text source_url
        text source_name
        int sort_order
        bool display_ready
        timestamptz created_at
        timestamptz updated_at
        timestamptz verified_at
    }

    generation_requests {
        uuid id PK
        text address
        text address_normalized
        text email
        text housing_type
        text status
        float8 geocoded_lat
        float8 geocoded_lng
        text geocoded_city
        text address_slug
        text project_id
        text result_url
        text error_message
        bool consent_given
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at
        text customer_id
    }

    translations {
        uuid id PK
        text locale UK
        text entity_type UK
        text entity_id UK
        text field UK
        text value
        timestamptz created_at
        timestamptz updated_at
    }

    project_pois {
        text project_id PK
        text poi_id PK
        int sort_order
    }

    product_pois {
        text product_id PK
        text poi_id PK
        text category_override_id
        int sort_order
        bool featured
    }

    product_categories {
        text product_id PK
        text category_id PK
        int display_order
    }

    events {
        uuid id PK
        text event_type
        text project_id
        text product_id
        text poi_id
        jsonb payload
        text session_id
        timestamptz created_at
    }
```

> `translations` er en **polymorf i18n-tabell** (keyed på `(locale, entity_type, entity_id, field)`,
> UNIQUE) — den kobler logisk til alle oversatte entiteter via `entity_type`/`entity_id`, ikke via
> én enkelt FK, og vises derfor uten relasjonslinjer.
>
> `events` (r01.2) er greenfield instrumentering: `id` default `gen_random_uuid()`, `created_at`
> default `now()`, `event_type` får CHECK-constraint i Unit 2. `payload` (jsonb) holdes som en ÅPEN
> konvolutt for Moat-2-kontekst (PRD 13).
