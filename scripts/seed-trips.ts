/**
 * Seed trips for Trondheim using existing POIs from the database.
 *
 * Creates 5 curated trips with ordered stops, transition text, and local insights.
 * Each trip references real POIs already in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-trips.ts
 *   npx tsx scripts/seed-trips.ts --dry-run    # Preview without inserting
 *   npx tsx scripts/seed-trips.ts --publish     # Auto-publish trips
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// === Config ===

const DRY_RUN = process.argv.includes("--dry-run");
const AUTO_PUBLISH = process.argv.includes("--publish");

const TRONDHEIM_CENTER = { lat: 63.4305, lng: 10.3951 };

// === Types ===

interface TripDef {
  title: string;
  urlSlug: string;
  description: string;
  category: "food" | "culture" | "nature" | "family" | "active" | "hidden-gems" | "sightseeing";
  difficulty: "easy" | "moderate" | "challenging";
  season: "all-year" | "spring" | "summer" | "autumn" | "winter";
  durationMinutes: number;
  distanceMeters: number;
  featured: boolean;
  tags: string[];
  stops: StopDef[];
}

interface StopDef {
  /** POI name search term (ILIKE match) */
  poiSearch: string;
  /** Fallback: search by multiple terms if first doesn't match */
  poiFallbacks?: string[];
  transitionText?: string;
  localInsight?: string;
  nameOverride?: string;
  descriptionOverride?: string;
}

// === Trip definitions ===

const TRIPS: TripDef[] = [
  {
    title: "Bakklandet & Bryggene",
    urlSlug: "bakklandet-og-bryggene",
    description:
      "Vandre gjennom Trondheims mest sjarmerende nabolag — langs Nidelva, over Gamle Bybro og forbi de ikoniske trehusene.",
    category: "culture",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 45,
    distanceMeters: 2200,
    featured: true,
    tags: ["byvandring", "historie", "arkitektur"],
    stops: [
      {
        poiSearch: "Gamle Bybro plass",
        poiFallbacks: ["Gamle Bybro"],
        nameOverride: "Gamle Bybro",
        transitionText:
          "Start ved den ikoniske Gamle Bybro — den beste utsikten over bryggerekkene og Nidelva. Herfra krysser du over til Bakklandet.",
        localInsight:
          "Broen ble opprinnelig bygget i 1681 og har vært gjenoppbygd flere ganger. Den nåværende versjonen er fra 1861. Porten på bysiden — Lykkens Portal — er byens mest fotograferte motiv.",
      },
      {
        poiSearch: "Baklandet Skydsstation",
        poiFallbacks: ["Skydsstation"],
        transitionText:
          "Gå ned Øvre Bakklandet. Etter noen hundre meter finner du byens kanskje mest kjente kafé i et trehus fra 1700-tallet.",
        localInsight:
          "Skydsstasjonen ble kåret til årets kafé av National Geographic. Bygget er et autentisk skysstasjon fra 1700-tallet — her byttet reisende hest på vei mellom Trondheim og Sverige.",
      },
      {
        poiSearch: "Café le Frère",
        poiFallbacks: ["Le Frere"],
        nameOverride: "Øvre Bakklandet",
        transitionText:
          "Fortsett nedover Øvre Bakklandet. Den brosteinsbelagte gaten er kantet av fargerike trehus, småbutikker og kaféer.",
        localInsight:
          "Bakklandet ble nesten revet på 1960-tallet for å gi plass til en motorvei. Heldigvis ble planene stoppet, og i dag er området Trondheims best bevarte trehusstrøk.",
      },
      {
        poiSearch: "Jordbærpikene Solsiden",
        poiFallbacks: ["Solsiden Senter", "Godt Brød Solsiden"],
        nameOverride: "Solsiden",
        transitionText:
          "Følg Nidelva videre nedover mot fjorden. Du kommer til Solsiden — byens moderne matdestinasjon ved vannkanten.",
        localInsight:
          "Solsiden var et industriområde og skipsverft frem til 1990-tallet. I dag er det Trondheims mest populære restaurantstrøk, med uteservering langs hele kaikanten.",
      },
    ],
  },
  {
    title: "Historisk Trondheim",
    urlSlug: "historisk-trondheim",
    description:
      "1000 år med historie — fra Nidarosdomen gjennom middelalderens maktsentrum til Gamle Bybro.",
    category: "culture",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 90,
    distanceMeters: 3500,
    featured: true,
    tags: ["historie", "kultur", "arkitektur", "kirke"],
    stops: [
      {
        poiSearch: "Nidaros domkirke",
        poiFallbacks: ["Nidarosdomen", "Nidaros Cathedral"],
        nameOverride: "Nidarosdomen",
        transitionText:
          "Start ved Nordens største middelalderkatedral. Nidarosdomen ble påbegynt rundt 1070 over Olav den helliges grav.",
        localInsight:
          "Katedralen er Norges nasjonalhelligdom og kroningskirke. Vestfronten med sine skulpturer regnes som et av Nord-Europas fineste gotiske arbeider. Innvendig finner du det originale oktogonaltåren — pilegrimsmålet.",
      },
      {
        poiSearch: "Vestfløyen - Erkebispegården",
        poiFallbacks: ["Erkebispegården", "Nordfløyen - Erkebispegården"],
        nameOverride: "Erkebispegården",
        transitionText:
          "Rett ved siden av Nidarosdomen ligger Skandinavias eldste verdslige bygning.",
        localInsight:
          "Erkebispegården var erkebiskopens residens fra 1100-tallet. I dag huser den Rustkammeret (hærmuseum) og kroningsregaliene. Borggården brukes til konserter om sommeren.",
      },
      {
        poiSearch: "Stiftsgårdsparken",
        poiFallbacks: ["Stiftsgård"],
        nameOverride: "Stiftsgården",
        transitionText:
          "Gå nordover til Munkegata. Stiftsgården — kongens offisielle residens i Trondheim — troner over byens hovedgate.",
        localInsight:
          "Stiftsgården er Skandinavias største trebygning, bygget 1774-78. Bygningen har 140 rom og brukes under kongelige besøk og kroninger. Omvisninger tilbys om sommeren.",
      },
      {
        poiSearch: "Torvet i Trondheim",
        poiFallbacks: ["Torvet", "Olav Tryggvason"],
        nameOverride: "Torvet & Olavsstatuen",
        transitionText:
          "Gå rett ned Munkegata til byens hjerte — Torvet med Olav Tryggvasons statue.",
        localInsight:
          "Statuen av bygrunnleggeren Olav Tryggvason ble reist i 1921. Søylen fungerer også som solur — skyggen viser klokken på steinene rundt foten. Torvet har vært byens samlingspunkt i over tusen år.",
      },
      {
        poiSearch: "Gamle Bybro plass",
        poiFallbacks: ["Gamle Bybro"],
        nameOverride: "Gamle Bybro",
        transitionText:
          "Gå østover mot Nidelva. Gamle Bybro gir den klassiske utsikten over sjøhusene — Trondheims mest kjente motiv.",
        localInsight:
          "Lykkens Portal på bysiden av broen har inskripsjonen «Brug mig til Fornøyelse». Utsikten mot bryggerekkene speiler seg i Nidelva — spesielt vakker i kveldslys.",
      },
    ],
  },
  {
    title: "Smak av Trondheim",
    urlSlug: "smak-av-trondheim",
    description:
      "En kulinarisk vandring fra håndverksbakeri via lokale favoritter til Michelin-nivå — smak byens beste.",
    category: "food",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 120,
    distanceMeters: 2800,
    featured: true,
    tags: ["mat", "restaurant", "kafé", "bakeri"],
    stops: [
      {
        poiSearch: "Sellanraa",
        poiFallbacks: ["Sellanraa Bok & Bar", "Sellanraa Bok"],
        transitionText:
          "Start dagen med kaffe og bakst hos Sellanraa — en bokhandel, kafé og bar i ett.",
        localInsight:
          "Oppkalt etter Knut Hamsuns roman 'Markens Grøde' (Sellanraa er gården i boken). Kombinasjonen av bøker og mat i et vakkert lokale gjør dette til et av Trondheims mest stemningsfulle steder.",
      },
      {
        poiSearch: "Dromedar",
        poiFallbacks: ["Dromedar Kaffebar", "Dromedar kaffe"],
        transitionText:
          "Et par minutters gange bringer deg til Trondheims kaffepioner.",
        localInsight:
          "Dromedar startet kafferevolusjonen i Trondheim. De brenner sine egne bønner og har vært en lokal institusjon siden 2002. Prøv espressoen — den regnes blant Norges beste.",
      },
      {
        poiSearch: "Bakklandet Skydsstation",
        poiFallbacks: ["Skydsstation"],
        transitionText:
          "Videre til Bakklandet for lunsj i historiske omgivelser.",
        localInsight:
          "Menyen er enkel og hjemmelaget — vafler, smørbrød, pai. Det er stemningen i det 300 år gamle trehuset som gjør opplevelsen. Kom tidlig — det er alltid kø.",
      },
      {
        poiSearch: "Britannia",
        poiFallbacks: ["Britannia Hotel", "Speilsalen"],
        nameOverride: "Britannia Hotel & Speilsalen",
        transitionText:
          "Fra Bakklandets rustikke sjarm til Trondheims mest elegante adresse.",
        localInsight:
          "Britannia Hotel gjenåpnet i 2019 etter en massiv renovering. Speilsalen, hotellets flaggskiprestaurant, har Michelin-stjerne. Vinmonopolet i kjelleren er Norges mest eksklusive.",
      },
      {
        poiSearch: "Credo",
        poiFallbacks: ["Restaurant Credo"],
        transitionText:
          "Avslutningen er verdig: Credo, kåret til verdens mest bærekraftige restaurant.",
        localInsight:
          "Heidi Bjerkan driver Credo fra en gammel jernvarefabrikk. Alt er lokalt, sesongbasert og bærekraftig — de dyrker mye selv på gården Hojem i Orkdal. Reservér i god tid.",
      },
    ],
  },
  {
    title: "Kaffebar-ruten",
    urlSlug: "kaffebar-ruten",
    description:
      "Trondheims beste spesialkaffe — fra mikrobrennerier til atmosfæriske kaféer i trehus.",
    category: "food",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 60,
    distanceMeters: 1800,
    featured: false,
    tags: ["kaffe", "kafé"],
    stops: [
      {
        poiSearch: "Jacobsen & Svart",
        poiFallbacks: ["Jacobsen Svart", "Svart kaffe"],
        transitionText:
          "Start med byens mest dedikerte mikrobrenner — Jacobsen & Svart.",
        localInsight:
          "Jacobsen & Svart brenner sine egne bønner og tar kaffekunsten på alvor. Single origin og lysbrent er deres signatur. Lokalet er minimalistisk og fokusert — her handler alt om kaffen.",
      },
      {
        poiSearch: "Dromedar",
        poiFallbacks: ["Dromedar Kaffebar"],
        transitionText:
          "Videre til Trondheims mest kjente kaffebar.",
        localInsight:
          "Dromedar er Trondheims kaffepioner. De har flere filialer, men originalen i sentrum har mest sjel. Prøv filterbrygg — det er her de virkelig skinner.",
      },
      {
        poiSearch: "Baklandet Skydsstation",
        poiFallbacks: ["Skydsstation"],
        transitionText:
          "Over Gamle Bybro til Bakklandet for kaffe i 1700-tallsomgivelser.",
        localInsight:
          "Kaffeopplevelsen her handler like mye om huset som om kaffen. Knarken i gulvet, de lave bjelkene, utsikten gjennom smårutete vinduer — det er som å sitte i et levende museum.",
      },
      {
        poiSearch: "Café le Frère",
        poiFallbacks: ["Le Frere", "Café le Frère"],
        transitionText:
          "Litt lenger ned på Bakklandet finner du et av de koseligste stedene.",
        localInsight:
          "En liten, intim kafé som føles som en parisisk stue. Hjemmelagde kaker, god kaffe, og eiere som kjenner stamgjestene ved navn.",
      },
    ],
  },
  {
    title: "Barnas Trondheim",
    urlSlug: "barnas-trondheim",
    description:
      "Familievennlige opplevelser — Rockheim, Nidarosdomen, Ilaparken og en båttur til Munkholmen.",
    category: "family",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 120,
    distanceMeters: 3000,
    featured: false,
    tags: ["barn", "familie", "museum", "lekeplass"],
    stops: [
      {
        poiSearch: "Rockheim",
        poiFallbacks: ["Rockheim museum"],
        transitionText:
          "Start på Rockheim — Norges nasjonale museum for pop og rock, og et av Trondheims mest interaktive museer.",
        localInsight:
          "Interaktivt museum der du kan mikse musikk, spille i band og oppleve 60 år med norsk musikhistorie. Bygningen i seg selv er spektakulær — en gammel lagerbygning med et moderne «boks i boks»-tilbygg.",
      },
      {
        poiSearch: "Besøkssenteret ved Nidaros domkirke",
        poiFallbacks: ["Nidaros domkirke"],
        nameOverride: "Nidarosdomen — Besøkssenteret",
        transitionText:
          "Ta en spasertur til Nidarosdomen. Besøkssenteret er perfekt for barn som vil utforske katedralen.",
        localInsight:
          "I besøkssenteret kan barna lære om katedralens 1000 år lange historie gjennom interaktive utstillinger. Selve katedralen er Nordens største middelalderkatedral — prøv å telle alle steinansiktene på vestfronten!",
      },
      {
        poiSearch: "Ilaparken lek",
        poiFallbacks: ["Ilaparken"],
        nameOverride: "Ilaparken",
        transitionText:
          "Tid for frilek! Ilaparken er en av Trondheims fineste lekeplasser.",
        localInsight:
          "En av Trondheims fineste lekeplasser med klatretårn, husker og sandkasse. Ligger langs Ilabekken med en hyggelig turvei. Perfekt for å la barna brenne av energi mellom museene.",
      },
      {
        poiSearch: "Munkholmen Nord",
        poiFallbacks: ["Munkholmen"],
        nameOverride: "Munkholmen",
        transitionText:
          "Avslutt med et eventyr — ta båten fra Ravnkloa til Munkholmen.",
        localInsight:
          "Den lille øya i Trondheimsfjorden har vært kloster, festning og henrettelsessted. I dag er det byens mest populære badeplass om sommeren. Båten tar 10 minutter fra Ravnkloa.",
      },
    ],
  },
];

// === Supabase helpers ===

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  return createClient(url, key);
}

/** Categories to exclude — transport infrastructure, not real POIs */
const EXCLUDED_CATEGORIES = ["bike", "taxi", "bus"];

async function findPoi(
  client: SupabaseClient,
  search: string,
  fallbacks?: string[]
): Promise<{ id: string; name: string } | null> {
  // Try primary search (exclude transport categories)
  const { data } = await client
    .from("pois")
    .select("id, name, category_id")
    .ilike("name", `%${search}%`)
    .not("category_id", "in", `(${EXCLUDED_CATEGORIES.map((c) => `"${c}"`).join(",")})`)
    .limit(1);

  if (data && data.length > 0) {
    return { id: data[0].id, name: data[0].name };
  }

  // Try fallbacks
  if (fallbacks) {
    for (const fb of fallbacks) {
      const { data: fbData } = await client
        .from("pois")
        .select("id, name, category_id")
        .ilike("name", `%${fb}%`)
        .not("category_id", "in", `(${EXCLUDED_CATEGORIES.map((c) => `"${c}"`).join(",")})`)
        .limit(1);

      if (fbData && fbData.length > 0) {
        return { id: fbData[0].id, name: fbData[0].name };
      }
    }
  }

  return null;
}

// === Main ===

async function main() {
  const client = getClient();

  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== SEEDING TRIPS ===");
  console.log(`Trips to create: ${TRIPS.length}`);
  console.log();

  let created = 0;
  let skipped = 0;

  for (const tripDef of TRIPS) {
    console.log(`--- ${tripDef.title} ---`);

    // Check if trip already exists
    const { data: existing } = await client
      .from("trips")
      .select("id")
      .eq("url_slug", tripDef.urlSlug)
      .single();

    if (existing) {
      console.log(`  SKIP: Already exists (${tripDef.urlSlug})`);
      skipped++;
      continue;
    }

    // Resolve POIs for stops
    const resolvedStops: Array<{
      poiId: string;
      poiName: string;
      stop: StopDef;
      sortOrder: number;
    }> = [];

    for (let i = 0; i < tripDef.stops.length; i++) {
      const stop = tripDef.stops[i];
      const poi = await findPoi(client, stop.poiSearch, stop.poiFallbacks);

      if (poi) {
        console.log(`  ✓ Stop ${i + 1}: ${poi.name} (matched "${stop.poiSearch}")`);
        resolvedStops.push({
          poiId: poi.id,
          poiName: poi.name,
          stop,
          sortOrder: i,
        });
      } else {
        console.log(`  ✗ Stop ${i + 1}: NOT FOUND "${stop.poiSearch}" — skipping stop`);
      }
    }

    if (resolvedStops.length < 3) {
      console.log(`  SKIP: Only ${resolvedStops.length} stops found (minimum 3)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  DRY RUN: Would create trip with ${resolvedStops.length} stops`);
      created++;
      continue;
    }

    // Insert trip
    const { data: tripRow, error: tripError } = await client
      .from("trips")
      .insert({
        title: tripDef.title,
        description: tripDef.description,
        url_slug: tripDef.urlSlug,
        category: tripDef.category,
        difficulty: tripDef.difficulty,
        season: tripDef.season,
        duration_minutes: tripDef.durationMinutes,
        distance_meters: tripDef.distanceMeters,
        featured: tripDef.featured,
        tags: tripDef.tags,
        city: "Trondheim",
        region: "Trøndelag",
        country: "NO",
        center_lat: TRONDHEIM_CENTER.lat,
        center_lng: TRONDHEIM_CENTER.lng,
        published: AUTO_PUBLISH,
        created_by: "seed-script",
      })
      .select("id")
      .single();

    if (tripError || !tripRow) {
      console.error(`  ERROR creating trip:`, tripError);
      continue;
    }

    console.log(`  Created trip: ${tripRow.id}`);

    // Insert stops
    const stopsToInsert = resolvedStops.map((rs) => ({
      trip_id: tripRow.id,
      poi_id: rs.poiId,
      sort_order: rs.sortOrder,
      transition_text: rs.stop.transitionText ?? null,
      local_insight: rs.stop.localInsight ?? null,
      name_override: rs.stop.nameOverride ?? null,
      description_override: rs.stop.descriptionOverride ?? null,
    }));

    const { error: stopsError } = await client
      .from("trip_stops")
      .insert(stopsToInsert);

    if (stopsError) {
      console.error(`  ERROR creating stops:`, stopsError);
    } else {
      console.log(`  Created ${stopsToInsert.length} stops`);
    }

    created++;
    console.log();
  }

  console.log("=== DONE ===");
  console.log(`Created: ${created}, Skipped: ${skipped}`);

  if (!AUTO_PUBLISH && !DRY_RUN) {
    console.log("\nTrips are UNPUBLISHED. Use --publish flag or publish via admin UI.");
    console.log("Admin URL: /admin/trips");
  }
}

main().catch(console.error);
