# Validate POI Trust

Kjør komplett POI trust validation pipeline (Layer 1+2+3) for et prosjekt.

## Input

```
/validate-poi-trust {projectId}
```

Eksempel: `/validate-poi-trust proj_abc123`

## Forutsetninger

- `npm run dev` kjører på `localhost:3000`
- `ADMIN_ENABLED=true` i `.env.local`
- Valgfritt: `ADMIN_API_TOKEN` i `.env.local` (for bearer auth)

## Pipeline

### Steg 1: Kjør Layer 1+2 via Admin API

Kall trust-validate endepunktet for å enriche POIs med Google Places-data og kjøre heuristikk-scoring:

```bash
# Finn auth header
AUTH_HEADER=""
if grep -q "ADMIN_API_TOKEN" .env.local 2>/dev/null; then
  TOKEN=$(grep ADMIN_API_TOKEN .env.local | cut -d= -f2)
  AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
fi

curl -X POST http://localhost:3000/api/admin/trust-validate \
  -H "Content-Type: application/json" \
  $AUTH_HEADER \
  -d '{"projectId": "$arguments", "concurrency": 10}'
```

Vent på respons. Parse JSON og vis stats:
```
Layer 1+2 ferdig:
  Total: {stats.total}
  Enriched: {stats.enriched}
  Validated: {stats.validated}
  Trusted (>=0.5): {stats.trusted}
  Flagged (<0.5): {stats.flagged}
  Trenger Layer 3: {stats.needsClaudeReview}
  Hoppet over: {stats.skipped}
```

Hvis `hasMore` er true, kjør igjen til alle er prosessert.

### Steg 2: Hent POIs som trenger Layer 3

Les POIs fra Supabase som trenger Claude-review:

```sql
SELECT p.id, p.name, p.address, p.google_website, p.trust_score, p.trust_flags
FROM pois p
JOIN project_pois pp ON pp.poi_id = p.id
WHERE pp.project_id = '$arguments'
  AND p.trust_score BETWEEN 0.3 AND 0.7
  AND NOT ('manual_override' = ANY(p.trust_flags))
ORDER BY p.trust_score ASC;
```

Bruk Supabase-klienten via Bash:
```bash
source .env.local
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/..." \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Alternativt: bruk `createServerClient()` via et lite script, eller les direkte med supabase CLI.

Hvis ingen POIs trenger Layer 3, vis "Alle POIs er ferdig-validerte!" og avslutt.

### Steg 3: Layer 3 — Websøk per POI

For hver POI som trenger review:

1. **Parse by fra adresse:**
   - Eksempel: `"Olav Tryggvasons gate 25, 7011 Trondheim, Norway"` → `"Trondheim"`
   - Metode: Split på `", "` → nest siste segment → strip postnummer med regex `/^\d{4}\s*/`
   - Fallback: bruk prosjektnavnet

2. **Websøk:** Bruk `WebSearch` tool med query: `"{poi.name} {city}"`

3. **Vurder resultater:**

   | Funn | Score | Flag |
   |------|-------|------|
   | TripAdvisor-listing | 0.85 | `found_on_tripadvisor` |
   | Yelp-listing | 0.85 | `found_on_yelp` |
   | Flere uavhengige kilder | 0.9 | `found_on_multiple_sources` |
   | Bare Google, men virker legitimt | Behold Layer 1+2 score | `claude_review_passed` |
   | Ikke funnet noen steder | 0.2 | `not_found_online` |
   | Websøk feilet teknisk | Behold Layer 1+2 score | `claude_review_failed` |

4. **Oppdater via API:**

   ```bash
   curl -X POST http://localhost:3000/api/admin/trust-validate/update \
     -H "Content-Type: application/json" \
     $AUTH_HEADER \
     -d '{
       "poiId": "{poi.id}",
       "trustScore": 0.85,
       "trustFlags": ["found_on_tripadvisor"]
     }'
   ```

   Merk: Endepunktet MERGER nye flags med eksisterende — Layer 1+2 flags beholdes.

5. **Vis progress:** `[3/12] 'Cafe Example' — funnet på TripAdvisor (0.85)`

### Steg 4: Oppsummering

Vis:
```
POI Trust Validation ferdig for prosjekt {projectId}:

  Layer 1+2: {N} POIs validert
  Layer 3: {M} POIs Claude-reviewed
  Trusted (>=0.5): {T}
  Flagged (<0.5): {F}
  Manual override: {O} (hoppet over)
```

## Feilhåndtering

- Websøk returnerer ingenting → `not_found_online`, score 0.2
- Websøk feiler teknisk → behold Layer 1+2 score, flag `claude_review_failed`
- Ingen adresse på POI → bruk prosjektnavn som city-fallback
- API-kall feiler → logg feilen, gå videre til neste POI
- hasMore=true → kjør Layer 1+2 igjen i en loop til hasMore=false

## Tips

- Kjør etter `/provision-rapport` for å validere nylig importerte POIs
- POIs med `manual_override` i trust_flags vil ALDRI bli re-scoret
- Explorer filtrerer automatisk bort POIs med trust_score < 0.5
