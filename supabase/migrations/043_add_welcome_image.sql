-- Add welcome screen fields for hero image and title
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS welcome_image TEXT,
  ADD COLUMN IF NOT EXISTS welcome_title TEXT;

-- Set Overvik welcome data
UPDATE projects
  SET welcome_image = '/images/projects/overvik-hero.webp',
      welcome_title = 'Velkommen over til Overvik',
      welcome_tagline = 'En helt ny bydel på Ranheim — midt mellom fjorden og marka.'
  WHERE url_slug = 'overvik';
