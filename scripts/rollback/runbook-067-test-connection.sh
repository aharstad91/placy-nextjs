#!/usr/bin/env bash
# Test DB-tilkobling via pooler port 5432 (session-mode)
# Kjør: bash scripts/rollback/runbook-067-test-connection.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local

PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.eolzjxkonfwbzjqqvbnj \
  -d postgres \
  -c "SELECT 1 AS connection_ok"
