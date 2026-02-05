-- Migration: Project Hierarchy Data Migration
-- Description: Migrate data from legacy tables to new hierarchy
-- Phase 2 of migration: Data migration only

BEGIN;

-- ============================================
-- Step 1: Create project containers from legacy projects
-- Groups projects by base slug (strips -explore, -guide suffix)
-- ============================================

-- Insert unique project containers
-- For projects with suffixes, use the base slug
-- For projects without suffixes (report type), use as-is
INSERT INTO projects (id, customer_id, name, url_slug, center_lat, center_lng, description, created_at, updated_at)
SELECT DISTINCT ON (customer_id, base_slug)
  -- Generate new ID: customer_id + '_' + base_slug
  customer_id || '_' || base_slug as id,
  customer_id,
  -- Use name without suffix
  CASE
    WHEN name LIKE '% Explorer' THEN RTRIM(name, ' Explorer')
    WHEN name LIKE '% Guide' THEN RTRIM(name, ' Guide')
    ELSE name
  END as name,
  base_slug as url_slug,
  center_lat,
  center_lng,
  NULL as description,
  MIN(created_at) OVER (PARTITION BY customer_id, base_slug) as created_at,
  MAX(updated_at) OVER (PARTITION BY customer_id, base_slug) as updated_at
FROM (
  SELECT
    *,
    CASE
      WHEN url_slug LIKE '%-explore' THEN RTRIM(url_slug, '-explore')
      WHEN url_slug LIKE '%-guide' THEN RTRIM(url_slug, '-guide')
      ELSE url_slug
    END as base_slug
  FROM projects_legacy
) sub
ORDER BY customer_id, base_slug, created_at;

-- ============================================
-- Step 2: Create products from legacy projects
-- ============================================

INSERT INTO products (id, project_id, product_type, config, story_title, story_intro_text, story_hero_images, created_at, updated_at)
SELECT
  pl.id as id,  -- Keep original ID for traceability
  -- Map to new project container
  pl.customer_id || '_' || CASE
    WHEN pl.url_slug LIKE '%-explore' THEN RTRIM(pl.url_slug, '-explore')
    WHEN pl.url_slug LIKE '%-guide' THEN RTRIM(pl.url_slug, '-guide')
    ELSE pl.url_slug
  END as project_id,
  -- Map product type
  CASE
    WHEN pl.product_type = 'portrait' THEN 'report'  -- Rename portrait to report
    ELSE pl.product_type
  END as product_type,
  '{}'::JSONB as config,
  pl.story_title,
  pl.story_intro_text,
  pl.story_hero_images,
  pl.created_at,
  pl.updated_at
FROM projects_legacy pl;

-- ============================================
-- Step 3: Create project POI pool (merge all POIs from related products)
-- ============================================

INSERT INTO project_pois (project_id, poi_id, sort_order)
SELECT DISTINCT
  p.project_id,
  ppl.poi_id,
  0 as sort_order
FROM project_pois_legacy ppl
JOIN products p ON p.id = ppl.project_id
ON CONFLICT (project_id, poi_id) DO NOTHING;

-- ============================================
-- Step 4: Create product POI selections (each product uses its original POIs)
-- ============================================

INSERT INTO product_pois (product_id, poi_id, category_override_id, sort_order)
SELECT
  ppl.project_id as product_id,  -- Legacy project_id = new product_id
  ppl.poi_id,
  NULL as category_override_id,
  ROW_NUMBER() OVER (PARTITION BY ppl.project_id ORDER BY ppl.poi_id) as sort_order
FROM project_pois_legacy ppl;

-- ============================================
-- Step 5: Create product category selections
-- Get all unique categories used by each product's POIs
-- ============================================

INSERT INTO product_categories (product_id, category_id, display_order)
SELECT DISTINCT
  pp.product_id,
  poi.category_id,
  0 as display_order
FROM product_pois pp
JOIN pois poi ON poi.id = pp.poi_id
WHERE poi.category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- ============================================
-- Step 6: Verification queries
-- ============================================

-- Verify project count
DO $$
DECLARE
  legacy_unique_count INTEGER;
  new_count INTEGER;
BEGIN
  -- Count unique base slugs in legacy
  SELECT COUNT(DISTINCT customer_id || '_' || CASE
    WHEN url_slug LIKE '%-explore' THEN RTRIM(url_slug, '-explore')
    WHEN url_slug LIKE '%-guide' THEN RTRIM(url_slug, '-guide')
    ELSE url_slug
  END)
  INTO legacy_unique_count
  FROM projects_legacy;

  SELECT COUNT(*) INTO new_count FROM projects;

  IF legacy_unique_count != new_count THEN
    RAISE WARNING 'Project count mismatch: expected %, got %', legacy_unique_count, new_count;
  ELSE
    RAISE NOTICE 'Project count verified: %', new_count;
  END IF;
END $$;

-- Verify product count matches legacy projects
DO $$
DECLARE
  legacy_count INTEGER;
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM projects_legacy;
  SELECT COUNT(*) INTO new_count FROM products;

  IF legacy_count != new_count THEN
    RAISE WARNING 'Product count mismatch: expected %, got %', legacy_count, new_count;
  ELSE
    RAISE NOTICE 'Product count verified: %', new_count;
  END IF;
END $$;

-- Verify POI pool contains all POIs
DO $$
DECLARE
  legacy_poi_count INTEGER;
  new_poi_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT poi_id) INTO legacy_poi_count FROM project_pois_legacy;
  SELECT COUNT(DISTINCT poi_id) INTO new_poi_count FROM project_pois;

  IF legacy_poi_count != new_poi_count THEN
    RAISE WARNING 'POI count mismatch: expected %, got %', legacy_poi_count, new_poi_count;
  ELSE
    RAISE NOTICE 'POI count verified: %', new_poi_count;
  END IF;
END $$;

COMMIT;
