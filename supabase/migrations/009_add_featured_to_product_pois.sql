-- Add featured flag to product_pois for highlighting top POIs in Report
ALTER TABLE product_pois ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
