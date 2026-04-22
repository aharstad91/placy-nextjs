#!/usr/bin/env bash
# Steg 6 i runbook 067: ekte migrasjon med COMMIT.
# Kjør: bash scripts/rollback/runbook-067-commit.sh
#
# Dette er IRREVERSIBELT bortsett fra pg_dump-restore.

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local

echo "KJØRER 067 MOT PROD MED COMMIT."
echo "Sist dump-fil:"
ls -lh ~/placy-backups/products-*.sql | tail -1
echo ""
read -p "Fortsett? (y/N): " confirm
if [ "$confirm" != "y" ]; then
  echo "Avbrutt."
  exit 1
fi

PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.eolzjxkonfwbzjqqvbnj \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations/067_rename_narrative_to_lead.sql

echo ""
echo "Migrasjon fullført. Neste steg: bash scripts/rollback/runbook-067-verify.sh"
