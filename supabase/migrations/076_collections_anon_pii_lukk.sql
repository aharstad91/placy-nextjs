-- =============================================================================
-- Migrasjon 076 — Lukk PII-lekkasje i v2.collections
-- =============================================================================
-- Hva: Fjerner anon-brukerens SELECT-tilgang til v2.collections.
--
-- Hvorfor: v2.collections hadde en RLS-policy med USING (true) som gav alle
-- med den offentlige anon-nøkkelen tilgang til å lese HELE tabellen via
-- PostgREST (/rest/v1/collections?select=slug,email). Det betyr at alle
-- registrerte e-poster (PII) var fritt tilgjengelig for enhver som kjenner
-- Supabase-prosjektets URL og anon-nøkkel. Lekkasjen ble verifisert live
-- 2026-07-06 ved at 5+ rader med e-post ble hentet uten autentisering.
-- Dette er en GDPR-relevant PII-høstingssårbarhet i norsk marked.
--
-- Løsningen (sammensatt endring):
-- 1. Kode (lib/supabase/collections.ts): getCollectionBySlug() er flyttet
--    fra anon-klienten til service-role-klienten (createServerClient()),
--    med «server-only»-vakt som gir build-time-feil ved klientimport.
--    Alle kallere er server-side (app/event/.../board/page.tsx), så
--    ingenting brekker av denne tilgangstrekket.
-- 2. Denne migrasjonen: Trekker tilbake anon SELECT og sletter policyen.
--    service_role (som BYPASSER RLS) berøres ikke — skrivestien
--    (app/api/collections, mutations.ts) og lesestien (collections.ts)
--    fortsetter å fungere.
--
-- KJØRES IKKE AUTOMATISK — xhigh-review kreves før produksjonskjøring.
-- =============================================================================

-- Trekk tilbake anon-brukerens SELECT-rettighet på tabellen direkte.
-- (Kombinert med DROP POLICY under er dette dobbel sikring.)
REVOKE SELECT ON v2.collections FROM anon;

-- Slett den åpne anon-select-policyen (USING (true)).
-- Navn verifisert mot migrasjon 073 (collections_anon_select).
DROP POLICY IF EXISTS collections_anon_select ON v2.collections;

-- RLS forblir aktivert (ingen DISABLE ROW LEVEL SECURITY her).
-- service_role bypasser RLS uansett og påvirkes ikke av dette.
