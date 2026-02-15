/**
 * Seed trips for Trondheim using existing POIs from the database.
 *
 * Creates curated trips with ordered stops, transition text, and local insights.
 * Each trip references real POIs already in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-trips.ts
 *   npx tsx scripts/seed-trips.ts --dry-run    # Preview without inserting
 *   npx tsx scripts/seed-trips.ts --publish     # Auto-publish trips
 *   npx tsx scripts/seed-trips.ts --force       # Update existing trips (delete old stops, re-insert)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// === Config ===

const DRY_RUN = process.argv.includes("--dry-run");
const AUTO_PUBLISH = process.argv.includes("--publish");
const FORCE_UPDATE = process.argv.includes("--force");

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
  // ═══ DEMO TRIP 1: Bakklandet & Bryggene (featured) ═══
  {
    title: "Bakklandet & Bryggene",
    urlSlug: "bakklandet-og-bryggene",
    description:
      "Vandre gjennom Trondheims mest sjarmerende nabolag — over Gamle Bybro, langs fargerike trehus og ned til bryggene ved Nidelva.",
    category: "culture",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 45,
    distanceMeters: 2000,
    featured: true,
    tags: ["byvandring", "historie", "arkitektur", "bakklandet"],
    stops: [
      {
        poiSearch: "Gamle Bybro",
        poiFallbacks: ["Gamle Bybro plass"],
        nameOverride: "Gamle Bybro",
        transitionText:
          "Start midt på broen og ta inn utsikten. De fargerike sjøhusene speiler seg i Nidelva — dette er byens mest ikoniske motiv. Porten du nettopp gikk gjennom heter Lykkens Portal, oppkalt etter en vals fra 1940. På den andre siden venter Bakklandet.",
        localInsight:
          "Johan Caspar von Cicignon tegnet den første broen i 1681, etter bybrannen som la Trondheim i aske. Dagens versjon er fra 1861 — den fjerde i rekken. Kristian Oskar Hoddø skrev valsen «Nidelven stille og vakker du er» en aprilnatt her i 1940.",
      },
      {
        poiSearch: "Baklandet Skydsstation",
        poiFallbacks: ["Skydsstation"],
        transitionText:
          "Gå ned Øvre Bakklandet. Brosteinen sliper seg under skoene, og trehusene presser seg tett inntil gaten. Etter et par hundre meter dukker et gult hus fra 1700-tallet opp — Bakklandets mest fotograferte fasade.",
        localInsight:
          "Bygget var en ekte skysstasjon der reisende byttet hest på vei mellom Trondheim og Sverige. National Geographic kåret den til én av verdens beste kaféer. Menyen holder seg enkel — vafler, smørbrød, hjemmelaget pai.",
      },
      {
        poiSearch: "Café le Frère",
        poiFallbacks: ["Le Frere"],
        nameOverride: "Øvre Bakklandet",
        transitionText:
          "Fortsett nedover gaten. Legg merke til hvordan trehusene skifter farge fra bygning til bygning — okergult, rødt, grønt, hvitt. På 1960-tallet ville politikerne rive alt dette for en motorvei. Heldigvis tapte de.",
        localInsight:
          "Bakklandet er Trondheims best bevarte trehusstrøk. Det som reddet området var en protestbevegelse ledet av beboerne selv. I dag er bydelen full av småbutikker, atelierer og kaféer — en levende bydel, ikke et museum.",
      },
      {
        poiSearch: "Brygga kaffebar",
        poiFallbacks: ["Nidelva elvesti", "Habitat Bakklandet"],
        nameOverride: "Bryggene langs Nidelva",
        transitionText:
          "Følg Nidelva nedover. Her står de gamle sjøhusene — bryggene som ga gaten sitt navn. Tømmeret er mørkt av alder, og noen bygninger lener seg lett mot elva som om de fortsatt venter på last.",
        localInsight:
          "Bryggerekkene langs Nidelva er Trondheims svar på Bryggen i Bergen. De ble brukt som lagerhus for fisk, korn og trelast fra middelalderen. I dag huser de leiligheter, restauranter og kontorer.",
      },
      {
        poiSearch: "Jordbærpikene Solsiden",
        poiFallbacks: ["Solsiden Senter", "Godt Brød Solsiden"],
        nameOverride: "Solsiden",
        transitionText:
          "Ruten ender ved Solsiden — fra Bakklandets 1700-tallsidyll til 2000-tallets restaurantstrøk. Kaikanten byr på uteservering med utsikt tilbake mot bryggene du nettopp passerte.",
        localInsight:
          "Solsiden var skipsverft og industriområde frem til 1990-tallet. Transformasjonen til restaurantdestinasjon kom på 2000-tallet. I dag er dette Trondheims mest populære kveldsdestinasjon, med over 20 serveringssteder langs kaien.",
      },
    ],
  },
  // ═══ DEMO TRIP 2: Smak av Trondheim (featured) ═══
  {
    title: "Smak av Trondheim",
    urlSlug: "smak-av-trondheim",
    description:
      "Fra fiskemarked via håndverksbakeri og historisk kafé til Michelin-nivå — smak byens kulinariske bredde på én vandring.",
    category: "food",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 60,
    distanceMeters: 2500,
    featured: true,
    tags: ["mat", "restaurant", "kafé", "sjømat", "michelin"],
    stops: [
      {
        poiSearch: "Ravnkloa",
        poiFallbacks: ["Ravnkloa Fisk"],
        transitionText:
          "Start ved fjorden. Ravnkloa har solgt fisk her i over hundre år — lukten av sjø og ferske reker møter deg allerede på brygga. Ta deg tid til å se utvalget før du spiser videre.",
        localInsight:
          "Lonely Planet kåret Ravnkloa til ett av Norges tre beste sjømatmarkeder. Herfra går også båten til Munkholmen. Markedet er mest levende på formiddagen — da kommer fiskerne inn med dagens fangst.",
        descriptionOverride:
          "Trondheims eldste sjømatmarked, ved enden av Munkegata. Ferske reker, røkelaks og lokale spesialiteter rett fra fjorden.",
      },
      {
        poiSearch: "Sellanraa",
        poiFallbacks: ["Sellanraa Bok & Bar", "SELLANRAA"],
        transitionText:
          "Gå oppover Munkegata mot sentrum. Noen kvartaler inn finner du en kafé der bøkene er like viktige som baksten. Sellanraa kombinerer bokhandel, kafé og bar i lokaler som lukter av nybakt og papir.",
        localInsight:
          "Oppkalt etter gården i Knut Hamsuns «Markens Grøde» fra 1917. Lokalet er innredet med naturmaterialer og dempet belysning — designet for å bli sittende. Kjøkkenets surdeigsbakst har blitt en institusjon.",
        descriptionOverride:
          "Bokhandel, kafé og bar i ett. Surdeigsbakst, god kaffe og et lokale du ikke vil forlate.",
      },
      {
        poiSearch: "Baklandet Skydsstation",
        poiFallbacks: ["Skydsstation"],
        transitionText:
          "Kryss Gamle Bybro til Bakklandet. Den gule fasaden fra 1700-tallet er lett å kjenne igjen — køen utenfor er et godt tegn. Inne venter knarrende gulv og en meny som ikke trenger å bevise noe.",
        localInsight:
          "Et autentisk skysstasjonshus der reisende byttet hest mellom Trondheim og Sverige. National Geographic kåret den til én av verdens beste kaféer. Vafler, smørbrød og hjemmelaget pai — ingenting fancy, alt ekte.",
        descriptionOverride:
          "1700-talls skysstasjon blitt kafé. Hjemmelaget mat i et av Norges mest sjarmerende lokaler.",
      },
      {
        poiSearch: "Britannia",
        poiFallbacks: ["Britannia Hotel", "Speilsalen"],
        nameOverride: "Britannia Hotel",
        transitionText:
          "Tilbake over broen og inn i sentrum. Fra Bakklandets rustikke sjarm til Trondheims mest elegante adresse — Britannia Hotel. Her møtes tradisjon og ambisjon under krystallysekronene.",
        localInsight:
          "Britannia åpnet i 1870 og gjenåpnet i 2019 etter en storstilt renovering. Speilsalen har Michelin-stjerne. Palmehaven serverer ettermiddagste med finger sandwiches i jugendinteriør fra 1918.",
        descriptionOverride:
          "Grand hotel fra 1870 med Michelin-restaurant, champagnebar og Trondheims fineste palmehave.",
      },
      {
        poiSearch: "Credo",
        poiFallbacks: ["Restaurant Credo", "Credo Restaurant"],
        transitionText:
          "Avslutningen er like ambisiøs som starten var jordnær. Credo ligger i en gammel jernvarefabrikk — men kjøkkenet henter alt fra gården. Heidi Bjerkan har gjort bærekraft til signatur, ikke slagord.",
        localInsight:
          "Heidi Bjerkan dyrker mye av råvarene selv på gården Hojem i Orkdal. Alt er lokalt og sesongbasert. Restauranten har fått internasjonal anerkjennelse for bærekraft — men det er smakene som gjør inntrykk.",
        descriptionOverride:
          "Heidi Bjerkans bærekraftige flaggskip. Alt fra gården, alt fra sesongen, alt fra regionen.",
      },
    ],
  },
  // ═══ DEMO TRIP 3: Midtbyen på 30 minutter (featured, NEW) ═══
  {
    title: "Midtbyen på 30 minutter",
    urlSlug: "midtbyen-paa-30-minutter",
    description:
      "Trondheims høydepunkter på en halvtime — fra Torvet via Skandinavias største trebygning til Gamle Bybro. Perfekt når tiden er knapp.",
    category: "sightseeing",
    difficulty: "easy",
    season: "all-year",
    durationMinutes: 30,
    distanceMeters: 1200,
    featured: true,
    tags: ["sightseeing", "rask tur", "highlights", "midtbyen"],
    stops: [
      {
        poiSearch: "Torvet i Trondheim",
        poiFallbacks: ["Torvet", "Sot & Sabrura på Torvet"],
        nameOverride: "Torvet",
        transitionText:
          "Start i byens hjerte. Olav Tryggvasons statue rager 17 meter over Torvet — men kjenner du den skjulte funksjonen? Søylen er en solur. Se ned på steinene rundt foten. Herfra går vi nordover til noe enda mer overraskende.",
        localInsight:
          "Bygrunnleggeren Olav Tryggvason fikk sin statue i 1921. Søylen fungerer som solur — skyggen peker på riktig klokkeslett på steinene rundt foten. Torvet har vært byens samlingspunkt i over tusen år.",
      },
      {
        poiSearch: "Stiftsgården",
        poiFallbacks: ["Stiftsgårdsparken", "Stiftsgård"],
        transitionText:
          "Gå nordover langs Munkegata. Etter to kvartaler reiser Skandinavias største trebygning seg foran deg — 140 rom bygd i tre, for en enke som ville ha det beste. Fasaden strekker seg over en hel kvartalside.",
        localInsight:
          "Cecilie Christine Schøller lot bygningen reise seg mellom 1774 og 1778. 4000 kvadratmeter senbarokk, opprinnelig som privat bolig. Kongefamilien har brukt Stiftsgården som offisiell residens i Trondheim siden 1800.",
      },
      {
        poiSearch: "Ravnkloa",
        poiFallbacks: ["Ravnkloa Fisk"],
        transitionText:
          "Fortsett nedover Munkegata mot fjorden. Gaten ender der byen møter vannet — ved Ravnkloa, fiskemarkedet som har ligget her i over hundre år. Stopp opp og trekk inn lukten av sjø.",
        localInsight:
          "Ravnkloa er ett av Norges tre beste sjømatmarkeder ifølge Lonely Planet. Herfra tar du båten til Munkholmen — øya som har vært kloster, festning og henrettelsessted.",
      },
      {
        poiSearch: "Gamle Bybro",
        poiFallbacks: ["Gamle Bybro plass"],
        transitionText:
          "Sving østover langs havna. Etter noen minutter åpner utsikten seg — Gamle Bybro med de fargerike bryggene bak. Gå ut på broen for avslutningen. Dette er det mest fotograferte motivet i Trondheim.",
        localInsight:
          "Den første broen ble tegnet av Cicignon i 1681 etter den store bybrannen. Porten på bysiden — Lykkens Portal — fikk sitt navn etter Hoddøs vals fra 1940. Utsikten mot bryggerekkene er spesielt vakker i kveldslys.",
      },
    ],
  },
  // ═══ Non-demo trips (featured: false) ═══
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
    featured: false,
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
        poiSearch: "Stiftsgården",
        poiFallbacks: ["Stiftsgårdsparken", "Stiftsgård"],
        nameOverride: "Stiftsgården",
        transitionText:
          "Gå nordover til Munkegata. Stiftsgården — kongens offisielle residens i Trondheim — troner over byens hovedgate.",
        localInsight:
          "Stiftsgården er Skandinavias største trebygning, bygget 1774-78. Bygningen har 140 rom og brukes under kongelige besøk og kroninger.",
      },
      {
        poiSearch: "Torvet i Trondheim",
        poiFallbacks: ["Torvet", "Sot & Sabrura på Torvet"],
        nameOverride: "Torvet & Olavsstatuen",
        transitionText:
          "Gå rett ned Munkegata til byens hjerte — Torvet med Olav Tryggvasons statue.",
        localInsight:
          "Statuen av bygrunnleggeren Olav Tryggvason ble reist i 1921. Søylen fungerer også som solur — skyggen viser klokken på steinene rundt foten. Torvet har vært byens samlingspunkt i over tusen år.",
      },
      {
        poiSearch: "Gamle Bybro",
        poiFallbacks: ["Gamle Bybro plass"],
        nameOverride: "Gamle Bybro",
        transitionText:
          "Gå østover mot Nidelva. Gamle Bybro gir den klassiske utsikten over sjøhusene — Trondheims mest kjente motiv.",
        localInsight:
          "Lykkens Portal på bysiden av broen har inskripsjonen «Brug mig til Fornøyelse». Utsikten mot bryggerekkene speiler seg i Nidelva — spesielt vakker i kveldslys.",
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
  if (FORCE_UPDATE) console.log("FORCE mode: existing trips will be updated");
  console.log(`Trips to process: ${TRIPS.length}`);
  console.log();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const tripDef of TRIPS) {
    console.log(`--- ${tripDef.title} ---`);

    // Check if trip already exists
    const { data: existing } = await client
      .from("trips")
      .select("id")
      .eq("url_slug", tripDef.urlSlug)
      .single();

    if (existing && !FORCE_UPDATE) {
      console.log(`  SKIP: Already exists (use --force to update)`);
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

    const tripFields = {
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
    };

    if (DRY_RUN) {
      const action = existing ? "UPDATE" : "CREATE";
      console.log(`  DRY RUN: Would ${action} trip with ${resolvedStops.length} stops`);
      if (existing) updated++;
      else created++;
      continue;
    }

    let tripId: string;

    if (existing) {
      // --force update: delete old stops, update trip metadata, re-insert stops
      console.log(`  UPDATE: Deleting old stops and re-inserting...`);

      const { error: deleteError } = await client
        .from("trip_stops")
        .delete()
        .eq("trip_id", existing.id);

      if (deleteError) {
        console.error(`  ERROR deleting old stops:`, deleteError);
        continue;
      }

      const { error: updateError } = await client
        .from("trips")
        .update(tripFields)
        .eq("id", existing.id);

      if (updateError) {
        console.error(`  ERROR updating trip:`, updateError);
        continue;
      }

      tripId = existing.id;
      console.log(`  Updated trip: ${tripId}`);
      updated++;
    } else {
      // Insert new trip
      const { data: tripRow, error: tripError } = await client
        .from("trips")
        .insert({ ...tripFields, created_by: "seed-script" })
        .select("id")
        .single();

      if (tripError || !tripRow) {
        console.error(`  ERROR creating trip:`, tripError);
        continue;
      }

      tripId = tripRow.id;
      console.log(`  Created trip: ${tripId}`);
      created++;
    }

    // Insert stops
    const stopsToInsert = resolvedStops.map((rs) => ({
      trip_id: tripId,
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
      console.log(`  Inserted ${stopsToInsert.length} stops`);
    }

    console.log();
  }

  console.log("=== DONE ===");
  console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);

  if (!AUTO_PUBLISH && !DRY_RUN) {
    console.log("\nTrips are UNPUBLISHED. Use --publish flag or publish via admin UI.");
    console.log("Admin URL: /admin/trips");
  }
}

main().catch(console.error);
