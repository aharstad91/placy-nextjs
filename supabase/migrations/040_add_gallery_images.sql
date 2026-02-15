-- Add gallery_images column to store multiple photo URLs per POI
-- Used for the 3-image grid layout on POI detail pages
ALTER TABLE pois ADD COLUMN IF NOT EXISTS gallery_images text[];
