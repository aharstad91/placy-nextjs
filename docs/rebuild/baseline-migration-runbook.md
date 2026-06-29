# v2 baseline-migrasjon — runbook (PRD 1 Unit 7 / r01.7)

> **✅ UTFØRT 2026-06-29.** v2 opprettet i prod (14 tabeller, kolonner verifisert), eksponert
> i API (`public, graphql_public, v2`), RLS 14/14 + 11 policies verifisert via REST begge
> retninger. AC1/2/3/5/6 grønne. AC4 (demo-paritet re-provisjon) venter på PRD 3.

> **Operasjon:** Kjør `supabase/migrations/070_baseline.sql` mot Supabase-PROD via psql.
> Oppretter `v2`-schemaet (14 tabeller + RLS + GRANT) **additivt** ved siden av `public`.
> **Risiko:** Lav. Additiv + reversibel (`public` urørt; `DROP SCHEMA v2 CASCADE` angrer).
> `/effort high` per PRD (xhigh er for det senere `public`-drop-steget, r01.3).
> **NB:** Første prod-skriv av rebuilden.

## Forutsetninger

- `.env.local` med `DATABASE_PASSWORD` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- Rollene `anon`/`authenticated`/`service_role` finnes i Supabase fra før (GRANT-mål).
- `psql` via libpq: `/opt/homebrew/Cellar/libpq/*/bin/psql`.

## Steg 1 — Pre-flight (read-only)

```bash
source .env.local
PSQL=$(ls /opt/homebrew/Cellar/libpq/*/bin/psql | head -1)
REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#')
URL="postgresql://postgres.${REF}:${DATABASE_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
# Bekreft at v2 IKKE allerede finnes (CREATE TABLE er ikke idempotent):
"$PSQL" "$URL" -tAc "SELECT count(*) FROM information_schema.schemata WHERE schema_name='v2';"
# Forvent: 0 → trygt å kjøre. >0 → STOPP, undersøk.
```

## Steg 2 — Kjør baseline (additiv, reversibel)

```bash
source .env.local && /opt/homebrew/Cellar/libpq/*/bin/psql "$POOLER_URL" \
  -v ON_ERROR_STOP=1 -f supabase/migrations/070_baseline.sql
```

Forvent: `CREATE SCHEMA`, 14× `CREATE TABLE`, 2× `CREATE INDEX`, 3× `GRANT`, 14× `ALTER TABLE`, 11× `CREATE POLICY`, 0 feil.

## Steg 3 — Verifiser via psql (schema-korrekthet, uavhengig av API-eksponering)

```bash
# Kolonne-tellinger per v2-tabell (14 tabeller, forvent areas 17 / pois 53 / events 8 ...)
psql "$POOLER_URL" -c "SELECT table_name, count(*) FROM information_schema.columns WHERE table_schema='v2' GROUP BY 1 ORDER BY 1;"
# RLS aktivert 14/14
psql "$POOLER_URL" -tAc "SELECT count(*) FILTER (WHERE relrowsecurity)||'/'||count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='v2' AND c.relkind='r';"
# Test-INSERT i v2.events (service-role/owner)
psql "$POOLER_URL" -c "INSERT INTO v2.events (event_type, project_id) VALUES ('board_viewed','runbook_test') RETURNING id, created_at;"
# Rydd test-raden
psql "$POOLER_URL" -c "DELETE FROM v2.events WHERE project_id='runbook_test';"
```

## Steg 4 — Eksponer v2 i Supabase API (DELIKAT — kan brekke public API hvis feil)

`v2` må legges til i PostgREST sin `db_schemas` for at `supabase-js .schema('v2')` / REST skal nå tabellene.

**Alternativ A (anbefalt — dashboard):** Settings → API → Exposed schemas → legg til `v2` (behold `public`, `storage`, `graphql_public`). Trygt, atomisk.

**Alternativ B (SQL — BRUKT 2026-06-29, fungerte):** Supabase leser eksponerte schemas fra
`authenticator`-rollens `pgrst.db_schemas`. Nåværende liste ble lest via REST-feilen (PGRST106:
«Only the following schemas are exposed: **public, graphql_public**») — IKKE `storage`. Sett
derfor med v2 appendet til den FAKTISKE listen, og verifiser at public fortsatt svarer (rollback
hvis ikke):
```sql
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, v2';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
-- Rollback ved behov: ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public';
```
Reload tok effekt på <5s. Verifiser BÅDE public (eksisterende app) OG v2 svarer 200 etterpå.

## Steg 5 — REST-verifikasjon (etter eksponering)

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/pois?select=trust_flags,entur_stopplace_id,editorial_hook&limit=1" \
  -H "Accept-Profile: v2" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# Forvent 200 med feltene.
```

## Steg 6 — Demo-paritet (AC4) — VENTER PÅ PRD 3

Referanse-boardene (Wesseløkka / Stasjonskvartalet / Ranheim) **re-provisjoneres** inn i `v2` via PRD 3-pipelinen (ikke migreres fra `public`). Dette er ende-til-ende-testen og gater det senere `public`-drop-steget (r01.3). Kan ikke kjøres før PRD 3 er bygd.

## Rollback

```sql
DROP SCHEMA v2 CASCADE;  -- public er urørt og er fallbacken
```
