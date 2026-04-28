#!/usr/bin/env bash
# Steg 9-11 i runbook 067: bygg revalidateTag-liste, kjør for alle 13 prosjekter,
# verifiser HTML-output for hver rapport-URL.
# Kjør: bash scripts/rollback/runbook-067-revalidate.sh
#
# Forutsetter at Vercel-deploy med leadText-kode er ute (sjekk: git log origin/main).

set -euo pipefail
cd "$(dirname "$0")/../.."

source .env.local

SITE_URL="${SITE_URL:-https://www.placy.no}"
REVALIDATE_LIST=~/placy-backups/revalidate-list-$(date +%Y-%m-%d-%H%M).csv

echo "=== Bygger revalidate-liste (SELECT fra prod) ==="
PGPASSWORD="$DATABASE_PASSWORD" \
  /opt/homebrew/Cellar/libpq/17.2/bin/psql \
  -h aws-1-eu-west-1.pooler.supabase.com -p 5432 -U postgres.eolzjxkonfwbzjqqvbnj -d postgres \
  --csv -t \
  -c "SELECT pj.customer_id, pj.url_slug FROM products pr JOIN projects pj ON pr.project_id = pj.id WHERE pr.product_type = 'report' AND pr.config->'reportConfig'->'themes' IS NOT NULL AND jsonb_array_length(pr.config->'reportConfig'->'themes') > 0 ORDER BY pj.customer_id, pj.url_slug" \
  > "$REVALIDATE_LIST"

echo "Liste ($(wc -l < "$REVALIDATE_LIST") rader):"
cat "$REVALIDATE_LIST"
echo ""

if [ -z "${REVALIDATE_SECRET:-}" ]; then
  echo "ADVARSEL: REVALIDATE_SECRET ikke satt i .env.local."
  echo "Legg den til eller hopp over revalidateTag (Vercel revalidate etter 1t uansett)."
  read -p "Fortsett uten revalidate? (y/N): " skip
  if [ "$skip" = "y" ]; then
    echo "Hopper til curl-verifisering."
  else
    exit 1
  fi
else
  echo "=== Kaller /api/revalidate for hver rad ==="
  while IFS=, read -r customer slug; do
    customer=$(echo "$customer" | tr -d '[:space:]')
    slug=$(echo "$slug" | tr -d '[:space:]')
    [ -z "$customer" ] && continue
    tag="product:${customer}_${slug}"
    echo -n "  $tag ... "
    result=$(curl -s "${SITE_URL}/api/revalidate?tag=${tag}&secret=${REVALIDATE_SECRET}" || echo "CURL_FAIL")
    echo "$result"
  done < "$REVALIDATE_LIST"
fi

echo ""
echo "=== Curl-verifisering av HTML for alle 13 rapport-URLer ==="
while IFS=, read -r customer slug; do
  customer=$(echo "$customer" | tr -d '[:space:]')
  slug=$(echo "$slug" | tr -d '[:space:]')
  [ -z "$customer" ] && continue
  url="${SITE_URL}/eiendom/${customer}/${slug}/rapport"
  # Teller h2-tags (temaoverskrifter) og p-tags (tekst-paragraphs) som indikator på rendering
  html=$(curl -s "$url" || echo "")
  h2_count=$(echo "$html" | grep -o '<h2' | wc -l | tr -d ' ')
  size=$(echo -n "$html" | wc -c | tr -d ' ')
  if [ "$h2_count" -ge 7 ] || [ "$size" -gt 50000 ]; then
    echo "  OK ($h2_count h2, ${size} bytes): $url"
  else
    echo "  PROBLEM ($h2_count h2, ${size} bytes): $url"
  fi
done < "$REVALIDATE_LIST"
