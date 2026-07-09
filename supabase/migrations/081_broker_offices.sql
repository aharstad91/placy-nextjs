-- =============================================================================
-- Migrasjon 081 — broker_offices: kontor-register for megler self-serve-piloten
-- =============================================================================
-- HVA: Ny tabell v2.broker_offices — registeret over pilotkontorer som har en
-- egen kontor-scopet self-serve-side på /megler/<slug>. Én rad per aktiv
-- kontor-lenke. Slug er ikke-gjettbar (kebab-navn + tilfeldig suffiks, f.eks.
-- `dnb-midtbyen-x7k2f9`) og ER tilgangsmodellen; rotasjon av en lekket lenke =
-- sett active=false på raden + sett inn ny rad med nytt suffiks, samme kunde.
--
-- HVORFOR: Megler-inngangen (R1/R3/R15) knytter boards til riktig kunde UTEN at
-- megleren skriver kontornavn manuelt. En ukjent/inaktiv slug hard-feiler (404)
-- og provisjonerer ALDRI — getOrCreateCustomer-upsert-mønsteret fra den åpne
-- /eiendom/generer-siden gjelder IKKE denne inngangen.
--
-- RLS: default-deny, service-role-only (samme grense som customers /
-- generation_requests / events — se 070_baseline linje 414). Ingen anon/
-- authenticated-policy → kun service_role (RLS-bypass) leser/skriver. Slug-
-- oppslaget skjer server-side i app/megler/[slug]/page.tsx via createServerClient.
--
-- customer_id → v2.customers(id) FK (NO ACTION, speiler projects.customer_id i
-- migrasjon 079): et kontor må peke på en eksisterende kunde. Manuell pilot-
-- onboarding er derfor to steg (customer først, så office) — se eksempel nederst.
--
-- KJØRES via psql direkte (CLAUDE.md — `supabase db push` funker ikke med
-- NNN-nummereringen). Additiv + reversibel (DROP TABLE v2.broker_offices).
-- =============================================================================

BEGIN;

CREATE TABLE v2.broker_offices (
  slug        text        NOT NULL,
  name        text        NOT NULL,
  customer_id text        NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slug),
  CONSTRAINT broker_offices_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES v2.customers(id)
);

-- service_role trenger EKSPLISITT table-grant: 070s `GRANT ... ON ALL TABLES`
-- dekket kun tabellene som fantes da migrasjonen kjørte — nye tabeller arver den
-- ikke. Uten dette får service_role «permission denied for table broker_offices».
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.broker_offices TO service_role;

-- default-deny: RLS på, INGEN anon/authenticated-policy → kun service_role leser.
ALTER TABLE v2.broker_offices ENABLE ROW LEVEL SECURITY;

COMMIT;

-- PostgREST cacher skjema-relasjoner — reload så .schema("v2").from("broker_offices")
-- (og FK-en til customers) blir synlig uten å vente på neste auto-reload.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- PILOT-ONBOARDING (manuell, to steg) — eksempel:
-- =============================================================================
-- BEGIN;
-- INSERT INTO v2.customers (id, name)
--   VALUES ('dnb-midtbyen', 'DNB Eiendom Midtbyen')
--   ON CONFLICT (id) DO NOTHING;
-- INSERT INTO v2.broker_offices (slug, name, customer_id)
--   VALUES ('dnb-midtbyen-x7k2f9', 'DNB Eiendom Midtbyen', 'dnb-midtbyen');
-- COMMIT;
--
-- Rotasjon av lekket lenke (behold kunde + eksisterende boards):
--   UPDATE v2.broker_offices SET active = false WHERE slug = 'dnb-midtbyen-x7k2f9';
--   INSERT INTO v2.broker_offices (slug, name, customer_id)
--     VALUES ('dnb-midtbyen-q3m8p1', 'DNB Eiendom Midtbyen', 'dnb-midtbyen');
--
-- ROLLBACK (kjør KUN hvis 081 må angres):
--   DROP TABLE v2.broker_offices;
-- =============================================================================
