-- Add per-project white-label theme configuration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT NULL;

-- Enforce valid structure: only allow safe, typed values (prevents CSS injection)
ALTER TABLE projects ADD CONSTRAINT projects_theme_valid CHECK (
  theme IS NULL OR (
    jsonb_typeof(theme) = 'object'
    AND (theme->>'primaryColor'    IS NULL OR theme->>'primaryColor'    ~ '^#[0-9a-fA-F]{3,8}$')
    AND (theme->>'backgroundColor' IS NULL OR theme->>'backgroundColor' ~ '^#[0-9a-fA-F]{3,8}$')
    AND (theme->>'fontFamily'      IS NULL OR theme->>'fontFamily' IN ('inter', 'dm-sans', 'system'))
    AND (theme->>'logoUrl'         IS NULL OR theme->>'logoUrl' ~ '^https?://')
  )
);
