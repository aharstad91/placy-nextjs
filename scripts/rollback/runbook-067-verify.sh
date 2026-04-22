#!/usr/bin/env bash
# Steg 7 i runbook 067: verifiser migrasjon — residual 0 + post-count == pre-count.
# Kjør: bash scripts/rollback/runbook-067-verify.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local

POST_COUNT=~/placy-backups/post-count-$(date +%Y-%m-%d-%H%M).csv
PRE_COUNT=$(ls -t ~/placy-backups/pre-count-*.csv | head -1)

echo "=== Residual-sjekk (må være 0 rader) ==="
PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com -p 5432 -U postgres.eolzjxkonfwbzjqqvbnj -d postgres \
  -c "SELECT id, project_id FROM products WHERE config->'reportConfig'->'themes' @? '\$[*].lowerNarrative' OR config->'reportConfig'->'themes' @? '\$[*].extendedBridgeText'"

echo ""
echo "=== Post-count (antall temaer med leadText per rad) → $POST_COUNT ==="
PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com -p 5432 -U postgres.eolzjxkonfwbzjqqvbnj -d postgres \
  --csv \
  -c "SELECT p.id, p.project_id, (SELECT COUNT(*) FROM jsonb_array_elements(p.config->'reportConfig'->'themes') t WHERE COALESCE(NULLIF(t->>'leadText',''), NULL) IS NOT NULL) AS themes_with_lead FROM products p WHERE p.product_type = 'report' AND p.config->'reportConfig'->'themes' IS NOT NULL AND jsonb_typeof(p.config->'reportConfig'->'themes') = 'array' AND jsonb_array_length(p.config->'reportConfig'->'themes') > 0 ORDER BY p.project_id" \
  > "$POST_COUNT"

cat "$POST_COUNT"

echo ""
echo "=== Diff pre-count vs post-count ==="
echo "Pre-count: $PRE_COUNT"
echo "Post-count: $POST_COUNT"
echo ""
diff "$PRE_COUNT" "$POST_COUNT" || true
echo ""
echo "Forventet diff: kun kolonne-header-navn ('themes_with_lead_source' → 'themes_with_lead')."
echo "Antall-tall per rad skal være identiske."
