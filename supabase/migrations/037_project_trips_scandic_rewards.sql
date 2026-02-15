-- Link featured trips to Scandic Nidelven project with reward overrides.
-- Looks up IDs at runtime to avoid hardcoded UUIDs.

DO $$
DECLARE
  v_project_id TEXT;
  v_hotel_poi_id TEXT;
  v_trip_id TEXT;
  v_trip_slugs TEXT[] := ARRAY[
    'bakklandet-og-bryggene',
    'smak-av-trondheim',
    'midtbyen-paa-30-minutter'
  ];
  v_rewards TEXT[][] := ARRAY[
    -- [url_slug, reward_title, reward_description, welcome_text]
    ARRAY[
      'bakklandet-og-bryggene',
      'Gratis kaffe i lobbyen',
      'Vis denne skjermen i resepsjonen hos Scandic Nidelven — en kaffekopp på oss som takk for turen.',
      'Velkommen til Bakklandet & Bryggene! Denne turen tar deg gjennom Trondheims mest ikoniske nabolag langs Nidelva. Fullfør alle stopp og få en belønning fra Scandic Nidelven.'
    ],
    ARRAY[
      'smak-av-trondheim',
      '15% rabatt på middag',
      'Vis denne skjermen i baren hos Scandic Nidelven — 15% på din neste middag i restauranten.',
      'Velkommen til Smak av Trondheim! En kulinarisk vandring fra sjømat ved fjorden til gård-til-bord i sentrum. Fullfør alle stopp og få en belønning fra Scandic Nidelven.'
    ],
    ARRAY[
      'midtbyen-paa-30-minutter',
      'Gratis mineralvann',
      'Vis denne skjermen i resepsjonen — et kaldt mineralvann fra baren, fordi du fortjener det etter turen.',
      'Velkommen til Midtbyen på 30 minutter! Perfekt for en rask oversikt over Trondheims sentrum. Fullfør alle stopp og få en liten belønning fra Scandic Nidelven.'
    ]
  ];
  v_reward RECORD;
  v_sort INT := 0;
BEGIN
  -- Find Scandic Nidelven project
  SELECT id INTO v_project_id
  FROM projects
  WHERE customer_id = 'scandic' AND url_slug = 'scandic-nidelven'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE NOTICE 'Scandic Nidelven project not found — skipping project_trips seeding';
    RETURN;
  END IF;

  -- Find hotel POI (optional start point)
  SELECT id INTO v_hotel_poi_id
  FROM pois
  WHERE name ILIKE '%Scandic Nidelven%'
  LIMIT 1;

  -- Insert project_trips for each featured trip
  FOR i IN 1..array_length(v_rewards, 1) LOOP
    SELECT id INTO v_trip_id
    FROM trips
    WHERE url_slug = v_rewards[i][1]
    LIMIT 1;

    IF v_trip_id IS NULL THEN
      RAISE NOTICE 'Trip % not found — skipping', v_rewards[i][1];
      CONTINUE;
    END IF;

    -- Skip if already linked
    IF EXISTS (
      SELECT 1 FROM project_trips
      WHERE project_id = v_project_id AND trip_id = v_trip_id
    ) THEN
      RAISE NOTICE 'Trip % already linked — skipping', v_rewards[i][1];
      CONTINUE;
    END IF;

    INSERT INTO project_trips (
      project_id,
      trip_id,
      sort_order,
      enabled,
      start_poi_id,
      start_name,
      start_description,
      start_transition_text,
      reward_title,
      reward_description,
      reward_code,
      reward_validity_days,
      welcome_text
    ) VALUES (
      v_project_id,
      v_trip_id,
      v_sort,
      true,
      v_hotel_poi_id,
      'Scandic Nidelven',
      'Turen starter fra hotellet — rett ved Nidelva og gåavstand til alt.',
      'Gå ut hovedinngangen og følg Nidelva mot sentrum.',
      v_rewards[i][2],
      v_rewards[i][3],
      'SCANDIC-TRIP-' || UPPER(REPLACE(v_rewards[i][1], '-', '')),
      7,
      v_rewards[i][4]
    );

    v_sort := v_sort + 1;
    RAISE NOTICE 'Linked trip % with reward: %', v_rewards[i][1], v_rewards[i][2];
  END LOOP;
END $$;
