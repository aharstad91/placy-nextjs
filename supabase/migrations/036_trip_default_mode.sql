-- Sprint 3: Add default_mode to trips (guided vs free exploration)
ALTER TABLE trips
ADD COLUMN default_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (default_mode IN ('guided', 'free'));
