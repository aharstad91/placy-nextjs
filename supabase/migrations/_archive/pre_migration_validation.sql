-- Pre-Migration Validation Script
-- Run BEFORE migration 006 to check for potential issues
-- This script does NOT modify data, only reports issues

-- ============================================
-- Check 1: Orphaned customer references
-- ============================================
SELECT 'Orphaned customer references:' as check_name;
SELECT id, customer_id, name
FROM projects
WHERE customer_id NOT IN (SELECT id FROM customers);

-- ============================================
-- Check 2: Invalid coordinates
-- ============================================
SELECT 'Invalid coordinates:' as check_name;
SELECT id, name, center_lat, center_lng
FROM projects
WHERE center_lat NOT BETWEEN -90 AND 90
   OR center_lng NOT BETWEEN -180 AND 180;

-- ============================================
-- Check 3: Invalid url_slug format
-- ============================================
SELECT 'Invalid url_slug format:' as check_name;
SELECT id, url_slug
FROM projects
WHERE url_slug !~ '^[a-z0-9-]+$';

-- ============================================
-- Check 4: Duplicate slugs per customer (after normalization)
-- ============================================
SELECT 'Potential duplicate containers after migration:' as check_name;
SELECT
  customer_id,
  CASE
    WHEN url_slug LIKE '%-explore' THEN RTRIM(url_slug, '-explore')
    WHEN url_slug LIKE '%-guide' THEN RTRIM(url_slug, '-guide')
    ELSE url_slug
  END as base_slug,
  array_agg(id) as project_ids,
  array_agg(product_type) as product_types,
  COUNT(*) as count
FROM projects
GROUP BY customer_id, base_slug
HAVING COUNT(*) > 1
ORDER BY customer_id, base_slug;

-- ============================================
-- Check 5: POIs without categories
-- ============================================
SELECT 'POIs without categories:' as check_name;
SELECT COUNT(*) as count
FROM pois
WHERE category_id IS NULL;

-- ============================================
-- Check 6: Project POIs referencing non-existent POIs
-- ============================================
SELECT 'Orphaned project_pois:' as check_name;
SELECT pp.project_id, pp.poi_id
FROM project_pois pp
LEFT JOIN pois p ON p.id = pp.poi_id
WHERE p.id IS NULL;

-- ============================================
-- Check 7: Show current data summary
-- ============================================
SELECT 'Current data summary:' as check_name;
SELECT
  'customers' as table_name,
  COUNT(*) as row_count
FROM customers
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'project_pois', COUNT(*) FROM project_pois
UNION ALL
SELECT 'pois', COUNT(*) FROM pois
UNION ALL
SELECT 'categories', COUNT(*) FROM categories;

-- ============================================
-- Check 8: Preview migration groupings
-- ============================================
SELECT 'Migration preview - new project containers:' as check_name;
SELECT
  customer_id,
  CASE
    WHEN url_slug LIKE '%-explore' THEN RTRIM(url_slug, '-explore')
    WHEN url_slug LIKE '%-guide' THEN RTRIM(url_slug, '-guide')
    ELSE url_slug
  END as new_slug,
  string_agg(id, ', ') as legacy_project_ids,
  string_agg(product_type, ', ') as product_types
FROM projects
GROUP BY customer_id, new_slug
ORDER BY customer_id, new_slug;
