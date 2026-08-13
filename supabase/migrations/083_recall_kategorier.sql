-- 083: Nye kategorier fra Straumen-fasitøvelsen (recall-fiks, 2026-08-12)
-- Klasse B-funn: kategorier som manglet i skjemaet — kirke, veterinær, drivstoff,
-- trafikkskole, fritidsklubb, butikk (spesialbutikk-halen: bokhandel/blomster/elektro).
-- Nummerert 083 (ikke 081/082) for å unngå kollisjon med feat/megler-self-serve
-- som har 081_broker_offices + 082_coverage_demand umerget.
-- Idempotent: ON CONFLICT DO NOTHING — import-pipelinen upserter samme verdier.

INSERT INTO v2.categories (id, name, icon, color) VALUES
  ('kirke',        'Kirke',        'Church',   '#8b5cf6'),
  ('veterinar',    'Veterinær',    'PawPrint', '#f59e0b'),
  ('fuel',         'Drivstoff',    'Fuel',     '#64748b'),
  ('trafikkskole', 'Trafikkskole', 'Car',      '#3b82f6'),
  ('fritidsklubb', 'Fritidsklubb', 'Users',    '#f472b6'),
  ('butikk',       'Butikk',       'Store',    '#a855f7')
ON CONFLICT (id) DO NOTHING;
