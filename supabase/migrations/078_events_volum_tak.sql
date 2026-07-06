-- ============================================================================
-- Migrasjon 078 — Volum-tak på v2.events (Moat-2 ingest-backstop)
-- ============================================================================
-- Hva: DB-nivå volum-tak (rader + bytes, globalt + per prosjekt-bucket) på
-- v2.events, håndhevet av en BEFORE INSERT-trigger mot en teller-tabell.
--
-- Hvorfor: `logEvent`-throttlen (event-throttle.ts) er in-memory PER
-- SERVERLESS-INSTANS og nullstilles ved deploy — på Vercel med N instanser er
-- effektiv grense N × 2000/min, og DB-en hadde ingen egen grense. En angriper
-- som replayer server-actionen kan dermed fylle v2.events ubegrenset
-- (DoS-by-cost + lagringssprenging). Zod-skjemaet kapper input til 8 KiB, men
-- en GYLDIG payload kan faktisk nå ~8 KiB (64 kategorier × 128 tegn i
-- categories_presented) — derfor telles BYTES i tillegg til rader.
--
-- SEMANTIKK (moat-bevarende): taket FRYSER nye writes (RAISE EXCEPTION) og
-- trimmer ALDRI gamle rader. Rå events ER Moat 2 («Innsikt») — oldest-first-
-- trimming under flood ville latt en angriper FORTRENGE historikken. Ved
-- tak-brudd tapes nye events i angrepsvinduet; historikken består. Tidsbasert
-- retention er bevisst IKKE innført (deferret per moat-2-build-input:
-- «aggreger opp, aldri disaggregér ned» — aggregate-then-prune tas som egen
-- beslutning når volumet krever det).
--
-- Feilbanen er allerede håndtert: RAISE → PostgREST-error → supabase-js
-- `{ error }` → logEvent fail-softer (console.error, render uberørt,
-- testdekket i log-event.test.ts). Vercel-loggene er varslingsflaten —
-- meldingene er grep-bare på prefikset [events-volum-tak].
--
-- Per-prosjekt-bucket alene er IKKE nok: events.project_id har ingen FK, så
-- en angriper kan rotere syntetiske prosjekt-id-er. Global-taket er den
-- reelle backstoppen; per-prosjekt-taket isolerer flood mot ETT kjent board
-- fra resten av porteføljen.
--
-- Ytelse: to teller-upserts per insert serialiserer event-skriving på
-- '__total__'-raden. Ved legitim trafikk (håndfull events per board-mount) er
-- det trivielt; under flood struper det skrivetakten — det er en feature.
-- Ved reell skala (langt forbi prototype) byttes dette mot shardede tellere.
--
-- KJØRES IKKE AUTOMATISK — xhigh-review kreves før produksjonskjøring.
-- Kjøres via psql (se CLAUDE.md). Hele filen er ÉN transaksjon.
-- ============================================================================

BEGIN;

-- Blokker samtidige event-inserts til seedingen under er ferdig (millisekunder
-- på dagens volum) — ellers kan en insert mellom trigger-opprettelse og seed
-- telles dobbelt eller mistes. SHARE ROW EXCLUSIVE tillater lesing.
LOCK TABLE v2.events IN SHARE ROW EXCLUSIVE MODE;

-- ----------------------------------------------------------------------------
-- 1) Teller-tabell — vedlikeholdes UTELUKKENDE av triggerne under.
--    scope: '__total__' (globalt) eller 'p:<project_id>' / 'p:__none__'
--    (events uten project_id — degradert sti — får egen bucket).
-- ----------------------------------------------------------------------------
CREATE TABLE v2.events_volume (
  scope   text   PRIMARY KEY,
  rows_n  bigint NOT NULL DEFAULT 0,
  bytes_n bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE v2.events_volume IS
  'Volum-tellere for v2.events (migrasjon 078). Vedlikeholdes av triggere — '
  'aldri skriv manuelt. scope = ''__total__'' | ''p:<project_id>'' | ''p:__none__''.';

-- Tilgangskontrakt (samme mønster som v2.events, jf. 070/077): ingen grants
-- eller policies til anon/authenticated → 401 via PostgREST. service_role
-- trenger eksplisitt grant fordi 070s «ON ALL TABLES» bare traff da-eksisterende
-- tabeller — og triggerne kjører som SECURITY INVOKER (dvs. som service_role
-- når logEvent skriver).
ALTER TABLE v2.events_volume ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON v2.events_volume FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.events_volume TO service_role;

-- ----------------------------------------------------------------------------
-- 2) Byte-mål for en event-rad. Brukes symmetrisk i guard (NEW), release (OLD)
--    og seed. pg_column_size på en lagret/TOASTet verdi kan returnere
--    komprimert størrelse mens insert-siden måler ukomprimert — driften går
--    da i KONSERVATIV retning (telleren blir stående for høyt → taket slår
--    inn tidligere, aldri senere). Godt nok for en sikkerhetsventil.
--    NB (preflight 078): kolonnelista er EKSPLISITT — en fremtidig
--    ALTER TABLE ADD COLUMN på v2.events MÅ bumpe denne funksjonen og
--    re-seede tellerne i samme migrasjon, ellers undertelles bytes stille.
-- ----------------------------------------------------------------------------
CREATE FUNCTION v2.events_row_bytes(e v2.events)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 64::bigint  -- tuple-overhead (header/alignment), konservativt anslag
    + coalesce(pg_column_size(e.id), 0)
    + coalesce(pg_column_size(e.event_type), 0)
    + coalesce(pg_column_size(e.project_id), 0)
    + coalesce(pg_column_size(e.product_id), 0)
    + coalesce(pg_column_size(e.poi_id), 0)
    + coalesce(pg_column_size(e.payload), 0)
    + coalesce(pg_column_size(e.session_id), 0)
    + coalesce(pg_column_size(e.created_at), 0);
$$;

-- ----------------------------------------------------------------------------
-- 3) Guard — BEFORE INSERT. Inkrementerer tellerne og RAISEr over tak
--    (inkrementene rulles da tilbake med samme transaksjon).
--    Tak-konstantene bumpes via ny migrasjon (CREATE OR REPLACE) — samme
--    to-stegs grense som CHECK-settet på event_type.
--
--    Tak-dimensjonering (prototype-romslig, angreps-stramt):
--    • globalt 1M rader / 512 MiB — år med legitim bruk unna (i dag: 142
--      rader / 144 kB), men bounder DB-bloat under flood til ~0,5 GB.
--    • per bucket 200k rader / 128 MiB — et travelt board i årevis; en flood
--      mot ETT kjent project_id stopper her uten å røre resten.
-- ----------------------------------------------------------------------------
CREATE FUNCTION v2.events_volume_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  total_rows_cap    CONSTANT bigint := 1000000;
  total_bytes_cap   CONSTANT bigint := 536870912;  -- 512 MiB
  project_rows_cap  CONSTANT bigint := 200000;
  project_bytes_cap CONSTANT bigint := 134217728;  -- 128 MiB
  ev_bytes   bigint := v2.events_row_bytes(NEW);
  proj_scope text   := 'p:' || coalesce(NEW.project_id, '__none__');
  new_rows   bigint;
  new_bytes  bigint;
BEGIN
  -- Global teller først, deretter prosjekt-bucket — SAMME rekkefølge som i
  -- events_volume_release() (fast låserekkefølge → ingen deadlock mellom
  -- insert- og delete-stier).
  INSERT INTO v2.events_volume AS c (scope, rows_n, bytes_n)
  VALUES ('__total__', 1, ev_bytes)
  ON CONFLICT (scope) DO UPDATE
    SET rows_n = c.rows_n + 1, bytes_n = c.bytes_n + excluded.bytes_n
  RETURNING c.rows_n, c.bytes_n INTO new_rows, new_bytes;

  IF new_rows > total_rows_cap OR new_bytes > total_bytes_cap THEN
    RAISE EXCEPTION '[events-volum-tak] globalt tak nådd (rader=%, bytes=%) — insert avvist, historikken bevares. Bump: migrasjon over v2.events_volume_guard().',
      new_rows, new_bytes;
  END IF;

  INSERT INTO v2.events_volume AS c (scope, rows_n, bytes_n)
  VALUES (proj_scope, 1, ev_bytes)
  ON CONFLICT (scope) DO UPDATE
    SET rows_n = c.rows_n + 1, bytes_n = c.bytes_n + excluded.bytes_n
  RETURNING c.rows_n, c.bytes_n INTO new_rows, new_bytes;

  IF new_rows > project_rows_cap OR new_bytes > project_bytes_cap THEN
    RAISE EXCEPTION '[events-volum-tak] tak nådd for % (rader=%, bytes=%) — insert avvist, historikken bevares.',
      proj_scope, new_rows, new_bytes;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) Release — AFTER DELETE. Dekrementerer (kontrollert wipe à la
--    DECISIONS-QUEUE #1 skal frigjøre plass under taket). greatest(0, …)
--    vokter mot negativ drift.
-- ----------------------------------------------------------------------------
CREATE FUNCTION v2.events_volume_release()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ev_bytes   bigint := v2.events_row_bytes(OLD);
  proj_scope text   := 'p:' || coalesce(OLD.project_id, '__none__');
BEGIN
  UPDATE v2.events_volume
    SET rows_n = greatest(0, rows_n - 1), bytes_n = greatest(0, bytes_n - ev_bytes)
    WHERE scope = '__total__';
  UPDATE v2.events_volume
    SET rows_n = greatest(0, rows_n - 1), bytes_n = greatest(0, bytes_n - ev_bytes)
    WHERE scope = proj_scope;
  RETURN OLD;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) Reset — AFTER TRUNCATE (statement-nivå). Tømmer tellerne; buckets
--    gjenskapes lazily av guarden ved neste insert.
-- ----------------------------------------------------------------------------
CREATE FUNCTION v2.events_volume_reset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM v2.events_volume;
  RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) Append-only-guard — BEFORE UPDATE. v2.events er en append-only strøm
--    (ingen kodesti oppdaterer events), og en UPDATE av project_id/payload
--    ville satt tellerne i drift. Må du likevel (bevisst, engangs):
--    DROP TRIGGER events_append_only_upd ON v2.events; …; gjenskap trigger.
--    NB (preflight 078): også INSERT ... ON CONFLICT mot v2.events er forbudt —
--    BEFORE-triggerens teller-inkrement består selv når raden skippes av
--    konfliktsjekken (verifisert PG15) → drift oppover (konservativ, men drift).
--    logEvent bruker ren .insert(); hold det slik.
-- ----------------------------------------------------------------------------
CREATE FUNCTION v2.events_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[events-volum-tak] v2.events er append-only — UPDATE avvist (ville satt volum-tellerne i drift). Se migrasjon 078 §6.';
END;
$$;

-- ----------------------------------------------------------------------------
-- 7) Triggere
-- ----------------------------------------------------------------------------
CREATE TRIGGER events_volume_guard_ins
  BEFORE INSERT ON v2.events
  FOR EACH ROW EXECUTE FUNCTION v2.events_volume_guard();

CREATE TRIGGER events_volume_release_del
  AFTER DELETE ON v2.events
  FOR EACH ROW EXECUTE FUNCTION v2.events_volume_release();

CREATE TRIGGER events_volume_reset_trunc
  AFTER TRUNCATE ON v2.events
  FOR EACH STATEMENT EXECUTE FUNCTION v2.events_volume_reset();

CREATE TRIGGER events_append_only_upd
  BEFORE UPDATE ON v2.events
  FOR EACH ROW EXECUTE FUNCTION v2.events_append_only();

-- ----------------------------------------------------------------------------
-- 8) Seed — eksakt telling av eksisterende rader (lås holdes, se toppen).
--    ON CONFLICT gjør seeden re-kjørbar (overskrider med fasit, aldri dobbelt).
-- ----------------------------------------------------------------------------
INSERT INTO v2.events_volume (scope, rows_n, bytes_n)
SELECT 'p:' || coalesce(e.project_id, '__none__'), count(*), sum(v2.events_row_bytes(e))
FROM v2.events e
GROUP BY 1
ON CONFLICT (scope) DO UPDATE
  SET rows_n = excluded.rows_n, bytes_n = excluded.bytes_n;

INSERT INTO v2.events_volume (scope, rows_n, bytes_n)
SELECT '__total__', count(*), coalesce(sum(v2.events_row_bytes(e)), 0)
FROM v2.events e
ON CONFLICT (scope) DO UPDATE
  SET rows_n = excluded.rows_n, bytes_n = excluded.bytes_n;

COMMIT;

-- ============================================================================
-- VERIFISERING (kjøres etter migrasjonen, se også §preflight i sesjonens logg):
--
-- a) Seed matcher fasit:
--    SELECT * FROM v2.events_volume ORDER BY scope;
--    SELECT count(*) FROM v2.events;  -- skal matche __total__.rows_n
--
-- b) Tak-probe uten å etterlate data (SAVEPOINT-mønster):
--    BEGIN;
--    INSERT INTO v2.events_volume (scope, rows_n, bytes_n)
--      VALUES ('p:cap-probe', 200000, 0);
--    SAVEPOINT s;
--    INSERT INTO v2.events (event_type, project_id)
--      VALUES ('board_viewed', 'cap-probe');   -- skal FEILE: [events-volum-tak]
--    ROLLBACK;
--
-- c) Normal insert upåvirket + teller inkrementeres (rull tilbake etterpå):
--    BEGIN;
--    INSERT INTO v2.events (event_type, project_id) VALUES ('board_viewed', 'cap-probe-ok');
--    SELECT * FROM v2.events_volume WHERE scope IN ('__total__','p:cap-probe-ok');
--    ROLLBACK;
--
-- d) Append-only + PostgREST-lås:
--    UPDATE v2.events SET poi_id = 'x' WHERE false;  -- OK (0 rader, trigger fyrer ikke)
--    curl …/rest/v1/events_volume med anon-nøkkel + Accept-Profile: v2 → 401
--
-- e) Ende-til-ende på PRODUKSJONS-rollen (service_role via PostgREST) —
--    psql-probene over kjører som postgres (eier, BYPASSRLS) og beviser IKKE
--    GRANT-en på linje ~71. Obligatorisk siste steg:
--    set -a; source .env.local; set +a; npx tsx scripts/verify-log-event.ts
--    (+ sjekk at __total__.rows_n er netto uendret før/etter scriptet)
--
-- ROLLBACK (angrer hele migrasjonen, triggere → funksjoner → tabell):
--    DROP TRIGGER events_volume_guard_ins  ON v2.events;
--    DROP TRIGGER events_volume_release_del ON v2.events;
--    DROP TRIGGER events_volume_reset_trunc ON v2.events;
--    DROP TRIGGER events_append_only_upd   ON v2.events;
--    DROP FUNCTION v2.events_volume_guard(), v2.events_volume_release(),
--                  v2.events_volume_reset(), v2.events_append_only(),
--                  v2.events_row_bytes(v2.events);
--    DROP TABLE v2.events_volume;
-- ============================================================================
