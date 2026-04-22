#!/usr/bin/env bash
# Steg 3 i runbook 067: pg_dump av products-tabellen til ~/placy-backups/
# Kjør: bash scripts/rollback/runbook-067-pg-dump.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local
mkdir -p ~/placy-backups

DUMPFILE=~/placy-backups/products-$(date +%Y-%m-%d-%H%M).sql

echo "Dumping products-tabellen til $DUMPFILE ..."

PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/pg_dump \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.eolzjxkonfwbzjqqvbnj \
  -d postgres \
  -t products \
  --no-owner \
  --no-acl \
  --format=plain \
  > "$DUMPFILE"

echo ""
echo "=== Verifisering ==="
ls -lh "$DUMPFILE"
echo ""
echo "Header:"
grep -E "^-- PostgreSQL database dump" "$DUMPFILE" | head -1
echo ""
echo "Antall INSERT/COPY-linjer (indikerer rows):"
grep -cE "^(INSERT|COPY)" "$DUMPFILE" || echo "0"
echo ""
echo "Dumpfil OK hvis: size > 0, header funnet, og minst 1 INSERT/COPY."
