#!/usr/bin/env bash
# Steg 5 i runbook 067: dry-run. Kjører hele migrasjonen i en rollback-transaksjon.
# Ingen commits — bare syntax- og runtime-validering.
# Kjør: bash scripts/rollback/runbook-067-dry-run.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local

MIGRATION_FILE=supabase/migrations/067_rename_narrative_to_lead.sql

echo "Dry-run: kjører 067 i BEGIN/ROLLBACK-transaksjon mot prod."
echo "Ingen endringer committes. Validerer syntax + runtime."
echo ""

# Inline SQL — wraps migrasjonen i en eksplisitt ROLLBACK i stedet for COMMIT
psql_sql=$(cat <<EOF
BEGIN;

-- Paste migrasjon (uten egen BEGIN/COMMIT):
$(sed -n '/^BEGIN;/,/^COMMIT;/p' "$MIGRATION_FILE" | sed '1d;$d')

-- Forventede endringer før rollback:
SELECT 'dry-run result — antall rader oppdatert i denne transaksjonen' AS note;

ROLLBACK;

-- Verifiser at ingenting ble committed (skal fortsatt vise gamle feltnavn):
SELECT
  COUNT(*) FILTER (WHERE t ? 'leadText') AS should_be_zero_after_rollback,
  COUNT(*) FILTER (WHERE t ? 'extendedBridgeText' OR t ? 'lowerNarrative') AS should_be_65
FROM products p, jsonb_array_elements(p.config->'reportConfig'->'themes') t
WHERE p.product_type = 'report';
EOF
)

PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.eolzjxkonfwbzjqqvbnj \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "$psql_sql"

echo ""
echo "Hvis ingen exception og should_be_zero_after_rollback=0, should_be_65=65:"
echo "  → migrasjon er trygg å kjøre med ekte COMMIT."
echo "Neste steg: bash scripts/rollback/runbook-067-commit.sh"
