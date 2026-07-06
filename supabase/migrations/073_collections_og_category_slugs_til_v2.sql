-- 073: Collections («Min samling») + category_slugs → v2 (drop-plan §4b).
--
-- • v2.collections: kolonne-paritet med public.collections (id text uuid-default,
--   slug unik, poi_ids text[]). FK-løs per v2-design. RLS: anon SELECT
--   (samlingen er et delbart objekt — slugen er capabilityen), skriving kun
--   service_role (API-ruten) — samme mønster som baseline 070.
-- • De 6 eksisterende radene kopieres for slug-kontinuitet; gamle poi_ids
--   peker på public-POI-er og dør med sine boards (konsistent med cutover).
-- • category_slugs: 58 rader kopieres (kolonne-paritet verifisert).
--
-- RE-KJØRBAR: IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS v2.collections (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  slug text NOT NULL UNIQUE,
  project_id text,
  email text,
  poi_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON v2.collections TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.collections TO service_role;

ALTER TABLE v2.collections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'v2' AND tablename = 'collections' AND policyname = 'collections_anon_select'
  ) THEN
    CREATE POLICY collections_anon_select ON v2.collections
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

INSERT INTO v2.collections (id, slug, project_id, email, poi_ids, created_at)
SELECT id, slug, project_id, email, poi_ids, created_at
FROM public.collections
ON CONFLICT (slug) DO NOTHING;

INSERT INTO v2.category_slugs (category_id, locale, slug, seo_title, seo_description, intro_text)
SELECT category_id, locale, slug, seo_title, seo_description, intro_text
FROM public.category_slugs
ON CONFLICT DO NOTHING;

-- Verifikasjon
SELECT 'v2.collections' AS tabell, count(*) FROM v2.collections
UNION ALL
SELECT 'v2.category_slugs', count(*) FROM v2.category_slugs;
