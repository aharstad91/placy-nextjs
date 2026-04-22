#!/usr/bin/env bash
# Steg 4 i runbook 067: pre-count baseline FØR migrasjon kjøres.
# Lagres til ~/placy-backups/pre-count-<timestamp>.csv for diff mot post-count.
# Kjør: bash scripts/rollback/runbook-067-pre-count.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local

OUTFILE=~/placy-backups/pre-count-$(date +%Y-%m-%d-%H%M).csv

echo "Kjører pre-count mot prod → $OUTFILE"
echo ""

PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.eolzjxkonfwbzjqqvbnj \
  -d postgres \
  --csv \
  -c "SELECT p.id, p.project_id, (SELECT COUNT(*) FROM jsonb_array_elements(p.config->'reportConfig'->'themes') t WHERE (t ? 'lowerNarrative' AND COALESCE(NULLIF(t->>'lowerNarrative',''), NULL) IS NOT NULL) OR (t ? 'extendedBridgeText' AND COALESCE(NULLIF(t->>'extendedBridgeText',''), NULL) IS NOT NULL)) AS themes_with_lead_source FROM products p WHERE p.product_type = 'report' AND p.config->'reportConfig'->'themes' IS NOT NULL AND jsonb_typeof(p.config->'reportConfig'->'themes') = 'array' AND jsonb_array_length(p.config->'reportConfig'->'themes') > 0 ORDER BY p.project_id" \
  > "$OUTFILE"

echo "=== Pre-count baseline lagret ==="
echo ""
cat "$OUTFILE"
echo ""
echo "Forventet: ~13 rader (rapport-prosjekter med themes-array)."
echo "Neste steg: bash scripts/rollback/runbook-067-dry-run.sh"
