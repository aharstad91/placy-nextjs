/**
 * POI Discovery Module
 * Henter POI-er fra Google Places, Entur, og Trondheim Bysykkel
 */

import { Category, Coordinates } from "../types";
import { calculateDistance } from "../utils/geo";
import { slugify } from "../utils/slugify";
import {
  evaluateGooglePlaceQuality,
  isWithinMaxDistance,
  calculateQualityStats,
  logQualityFilterStats,
  type QualityRejection,
} from "./poi-quality";
import { belastApiKall } from "@/lib/api-budget";

// === Types ===

export interface DiscoveryConfig {
  center: Coordinates;
  radius: number; // meters
  googleCategories?: string[];
  minRating?: number;
  includeTransport?: boolean;
}

export interface DiscoveredPOI {
  id: string;
  name: string;
  coordinates: Coordinates;
  address?: string;
  category: Category;
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  source: "google" | "entur" | "bysykkel" | "nsr" | "barnehagefakta" | "osm" | "manual";
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  nsrId?: string;
  barnehagefaktaId?: string;
  osmId?: string;
  // Editorial fields (added later via Claude or manual editing)
  editorialHook?: string;
  localInsight?: string;
}

// === Category Mappings ===

const GOOGLE_CATEGORY_MAP: Record<string, Category> = {
  restaurant: { id: "restaurant", name: "Restaurant", icon: "UtensilsCrossed", color: "#ef4444" },
  cafe: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#f97316" },
  bar: { id: "bar", name: "Bar", icon: "Wine", color: "#a855f7" },
  bakery: { id: "bakery", name: "Bakeri", icon: "Croissant", color: "#f59e0b" },
  gym: { id: "gym", name: "Treningssenter", icon: "Dumbbell", color: "#ec4899" },
  supermarket: { id: "supermarket", name: "Dagligvare", icon: "ShoppingCart", color: "#22c55e" },
  // Recall-fiks 2026-08-24 (Ranheim KIWI-funnet): `supermarket` alene fant
  // INGEN Rema og INGEN Kiwi. Målt mot searchNearby i produksjons-bboxen
  // (2 500 m fra Strindfjordvegen 10): `supermarket` ga 5 treff (Europris,
  // 2 × Extra, 2 × Coop), `grocery_store` ga 15 — de samme pluss 2 × KIWI,
  // 4 × REMA og Bunnpris. Extra og Coop bærer BEGGE typene; Rema og Kiwi
  // bærer bare `grocery_store`. Norges to største kjeder var usynlige for
  // pipelinen på alle boards.
  grocery_store: { id: "supermarket", name: "Dagligvare", icon: "ShoppingCart", color: "#22c55e" },
  pharmacy: { id: "pharmacy", name: "Apotek", icon: "Pill", color: "#06b6d4" },
  bank: { id: "bank", name: "Bank", icon: "Building", color: "#6366f1" },
  post_office: { id: "post", name: "Post", icon: "Mail", color: "#f43f5e" },
  shopping_mall: { id: "shopping", name: "Kjøpesenter", icon: "ShoppingBag", color: "#8b5cf6" },
  museum: { id: "museum", name: "Museum", icon: "Landmark", color: "#0ea5e9" },
  library: { id: "library", name: "Bibliotek", icon: "BookOpen", color: "#14b8a6" },
  park: { id: "park", name: "Park", icon: "TreePine", color: "#10b981" },
  movie_theater: { id: "cinema", name: "Kino", icon: "Film", color: "#f472b6" },
  hospital: { id: "hospital", name: "Sykehus", icon: "Hospital", color: "#ef4444" },
  doctor: { id: "doctor", name: "Legesenter", icon: "Stethoscope", color: "#3b82f6" },
  dentist: { id: "dentist", name: "Tannlege", icon: "Smile", color: "#22d3ee" },
  hair_care: { id: "haircare", name: "Frisør", icon: "Scissors", color: "#d946ef" },
  liquor_store: { id: "liquor_store", name: "Vinmonopol", icon: "Wine", color: "#7c3aed" },
  spa: { id: "spa", name: "Spa", icon: "Sparkles", color: "#c084fc" },
  hotel: { id: "hotel", name: "Hotell", icon: "Building2", color: "#0891b2" },
  // Recall-fiks 2026-08-12 (Straumen-fasitøvelsen): typene under manglet helt,
  // så tannlege/hotell/kirke/camping m.fl. ble aldri SØKT etter. Kategori-radene
  // upsertes automatisk i import-pois (steg 6) — hold verdiene i synk med 083.
  church: { id: "kirke", name: "Kirke", icon: "Church", color: "#8b5cf6" },
  veterinary_care: { id: "veterinar", name: "Veterinær", icon: "PawPrint", color: "#f59e0b" },
  gas_station: { id: "fuel", name: "Drivstoff", icon: "Fuel", color: "#64748b" },
  electric_vehicle_charging_station: { id: "charging_station", name: "Ladestasjon", icon: "Zap", color: "#eab308" },
  campground: { id: "campground", name: "Camping", icon: "Tent", color: "#84cc16" },
  marina: { id: "marina", name: "Småbåthavn", icon: "Anchor", color: "#0ea5e9" },
  community_center: { id: "fritidsklubb", name: "Fritidsklubb", icon: "Users", color: "#f472b6" },
  // Recall-fiks 2026-08-24 (butikk-familien): `butikk` hadde bare fire kilder
  // (bok/blomst/elektro/interiør), så klær, sko, sport, smykker, leker,
  // kosmetikk, dyrebutikk, sykkel og jernvare fantes ikke for pipelinen. Målt
  // i produksjons-bboxen (2 500 m fra Strindfjordvegen 10): typene under ga
  // 55 treff Google-sveipet ikke hadde fra før — hele Lade/Sirkus-handelen.
  clothing_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  shoe_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  jewelry_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  sporting_goods_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  toy_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  cosmetics_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  pet_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  bicycle_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  hardware_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  gift_shop: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  furniture_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  // `convenience` sto i tema-defaultene (Hverdagsliv) uten at NOEN kilde
  // produserte den — samme tomme kategori som marina og hundepark hadde.
  convenience_store: { id: "convenience", name: "Nærbutikk", icon: "Store", color: "#22c55e" },
  // `badeplass` kom bare fra OSM. Google kaller dem `beach`, og de to fjærene
  // rett ved prosjektet (Grillstadfjæra, Ranheimsfjæra) ligger der.
  beach: { id: "badeplass", name: "Badeplass", icon: "Waves", color: "#0ea5e9" },
  // Skjønnhetssalonger lå alt i `hair_care`s gyldige typer uten å være en
  // SØKETYPE — filteret slapp dem gjennom, men ingen spurte etter dem.
  beauty_salon: { id: "haircare", name: "Frisør", icon: "Scissors", color: "#d946ef" },
  book_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  florist: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  electronics_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  home_goods_store: { id: "butikk", name: "Butikk", icon: "Store", color: "#a855f7" },
  // Recall-fiks 2026-08-24 (Ranheim pumptrack-funnet): HELE idretts- og
  // friluftsfamilien manglet — `gym` var den eneste sport-typen i kartet, så
  // «Ranheim Pumptrack» (cycling_park), «Ranheimshallen» (sports_complex),
  // «Ranheim Kunstgress» (athletic_field), «Jakobsli skøytebane»
  // (ice_skating_rink) og «Ranheim Friidrettshall» (stadium) ble aldri SØKT
  // etter. Alle typene er verifisert mot searchNearby i produksjons-bboxen
  // (2 500 m fra Grilstad Marina) før de ble lagt inn — ingen av dem er gjettet.
  //
  // Hele familien mappes til `idrett`, samme kategori som OSM-porten gir
  // sports_centre/pitch/track. Én kategori for anlegg, ikke seks som må
  // vedlikeholdes i tema-defaultene hver for seg.
  cycling_park: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  skateboard_park: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  sports_complex: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  athletic_field: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  stadium: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  ice_skating_rink: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  golf_course: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  // Paraply-typen alle anleggene over også bærer. Tas med fordi den fanger de
  // som IKKE har en spesifikk type: «Grip Klatring Leangen» og «Leangen
  // Bydelshall» har bare sports_activity_location.
  sports_activity_location: { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  swimming_pool: { id: "swimming", name: "Svømmehall", icon: "Waves", color: "#ec4899" },
  // Google-lekeplasser er navngitte oppføringer med egen type — ikke det samme
  // problemet som `leisure=playground` i OSM, der 12 av 18 var utagget og de
  // navngitte var barnehager og et betalt lekeland. Målt i samme bbox: 6 treff,
  // alle navngitte og alle faktiske lekeplasser.
  playground: { id: "lekeplass", name: "Lekeplass", icon: "Baby", color: "#fbbf24" },
  hiking_area: { id: "outdoor", name: "Utendørs aktivitet", icon: "TreePine", color: "#10b981" },
  // `hundepark` sto i tema-defaultene siden 2026-08-12 uten at NOEN kilde
  // produserte den — samme tomme kategori som marina hadde. Nå har den en.
  dog_park: { id: "hundepark", name: "Hundepark", icon: "PawPrint", color: "#84cc16" },
};

const TRANSPORT_CATEGORIES: Record<string, Category> = {
  bus: { id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" },
  bike: { id: "bike", name: "Bysykkel", icon: "Bike", color: "#22c55e" },
  parking: { id: "parking", name: "Parkering", icon: "ParkingCircle", color: "#6366f1" },
  train: { id: "train", name: "Tog", icon: "TrainFront", color: "#0ea5e9" },
  tram: { id: "tram", name: "Trikk", icon: "Tram", color: "#f97316" },
};

// === Google Places Discovery ===

// Map of related types that count as a valid match for a search category.
// Google returns a `types` array per result — we require at least one match
// to avoid junk results (e.g. stadiums returned for "hotel" searches).
/**
 * Typene et idrettsanlegg kan bære hos Google. Delt sett fordi Google gir samme
 * sted flere av dem, og fordi type-filteret ellers ville kastet treff søket selv
 * fant: `athletic_field`-søket returnerer «Trondheim Ice Rink», som er tagget
 * athletic_field + sports_activity_location og ingenting annet.
 *
 * `sports_club` er MED her, men er ikke en søketype: klubb-oppføringer som
 * «Strindheim IL» er organisasjoner, ikke anlegg, og skal ikke bli egne pins.
 * Bærer et anlegg taggen i tillegg til en anleggstype, er den derimot gyldig.
 */
const SPORT_TYPES = new Set([
  "cycling_park",
  "skateboard_park",
  "sports_complex",
  "athletic_field",
  "stadium",
  "arena",
  "ice_skating_rink",
  "sports_activity_location",
  "sports_club",
  "golf_course",
  "indoor_golf_course",
  "fitness_center",
  "gym",
]);

const VALID_TYPES_FOR_CATEGORY: Record<string, Set<string>> = {
  restaurant: new Set(["restaurant", "food"]),
  cafe: new Set(["cafe", "coffee_shop"]),
  bar: new Set(["bar", "night_club"]),
  bakery: new Set(["bakery"]),
  gym: new Set(["gym", "health"]),
  // `grocery_or_supermarket` var en legacy-type ingen treff i Places API (New)
  // bærer — den slapp aldri noen gjennom. KIWI/REMA er `grocery_store` uten
  // `supermarket`, så begge må stå her for at type-filteret ikke skal kaste
  // det søket nettopp fant.
  supermarket: new Set(["supermarket", "grocery_store"]),
  grocery_store: new Set(["supermarket", "grocery_store"]),
  pharmacy: new Set(["pharmacy", "drugstore"]),
  bank: new Set(["bank"]),
  post_office: new Set(["post_office"]),
  shopping_mall: new Set(["shopping_mall"]),
  museum: new Set(["museum"]),
  library: new Set(["library"]),
  park: new Set(["park"]),
  movie_theater: new Set(["movie_theater"]),
  hospital: new Set(["hospital"]),
  doctor: new Set(["doctor"]),
  dentist: new Set(["dentist"]),
  hair_care: new Set(["hair_care", "beauty_salon"]),
  liquor_store: new Set(["liquor_store"]),
  spa: new Set(["spa"]),
  hotel: new Set(["lodging", "hotel"]),
  church: new Set(["church", "place_of_worship"]),
  veterinary_care: new Set(["veterinary_care"]),
  gas_station: new Set(["gas_station"]),
  electric_vehicle_charging_station: new Set(["electric_vehicle_charging_station"]),
  campground: new Set(["campground", "rv_park"]),
  marina: new Set(["marina"]),
  community_center: new Set(["community_center"]),
  clothing_store: new Set(["clothing_store", "store"]),
  shoe_store: new Set(["shoe_store", "store"]),
  jewelry_store: new Set(["jewelry_store", "store"]),
  sporting_goods_store: new Set(["sporting_goods_store", "store"]),
  toy_store: new Set(["toy_store", "store"]),
  cosmetics_store: new Set(["cosmetics_store", "store"]),
  pet_store: new Set(["pet_store", "store"]),
  bicycle_store: new Set(["bicycle_store", "store"]),
  hardware_store: new Set(["hardware_store", "store"]),
  gift_shop: new Set(["gift_shop", "store"]),
  furniture_store: new Set(["furniture_store", "store"]),
  convenience_store: new Set(["convenience_store", "store"]),
  beach: new Set(["beach", "natural_feature"]),
  beauty_salon: new Set(["beauty_salon", "hair_care", "hair_salon"]),
  book_store: new Set(["book_store"]),
  florist: new Set(["florist"]),
  electronics_store: new Set(["electronics_store"]),
  home_goods_store: new Set(["home_goods_store", "store"]),
  // Idretts-/friluftsfamilien (2026-08-24): Google returnerer flere av typene
  // samtidig på samme sted — «Leangen Idrettsanlegg» har sports_complex,
  // ice_skating_rink OG athletic_field. Ett delt sett per søketype ville
  // avvist halvparten av treffene, så hver søketype godtar hele familien.
  cycling_park: SPORT_TYPES,
  skateboard_park: SPORT_TYPES,
  sports_complex: SPORT_TYPES,
  athletic_field: SPORT_TYPES,
  stadium: SPORT_TYPES,
  ice_skating_rink: SPORT_TYPES,
  golf_course: SPORT_TYPES,
  sports_activity_location: SPORT_TYPES,
  swimming_pool: new Set(["swimming_pool", "sports_activity_location"]),
  playground: new Set(["playground"]),
  hiking_area: new Set(["hiking_area", "sports_activity_location"]),
  dog_park: new Set(["dog_park", "park"]),
};

/**
 * Typer som DISKVALIFISERER et treff for søkekategorien, selv om en gyldig type
 * også står i lista. Motstykket til VALID_TYPES_FOR_CATEGORY, og nødvendig
 * fordi Google gir treningssentre og yogastudioer HELE idrettsfamilien:
 * «Oasen Yoga» er tagget yoga_studio + fitness_center + sports_school +
 * sports_complex + gym. Et yogastudio vist som idrettsanlegg havner i temaet
 * «Barn & Oppvekst» — nøyaktig den feilkategoriseringen OSM-porten finnes for
 * å hindre, bare fra den andre kilden.
 *
 * Stedene som utelukkes her går ikke tapt: de bærer `gym`, og `gym`-søket
 * ligger foran i kategorilista, så de kommer inn som treningssenter i stedet.
 * «Grip Klatring Leangen» og «Ranheim Idrettspark» har BARE
 * sports_activity_location og passerer — de er ekte anlegg.
 *
 * `parking`/`parking_lot` står her fordi «Rotvollfjæra parkering» kom ut som
 * idrettsanlegg: Google gir noen parkeringsplasser ved anlegg en sport-type.
 */
const EXCLUDED_TYPES_FOR_SPORT = new Set([
  "gym",
  "fitness_center",
  "yoga_studio",
  "sports_school",
  "sports_coaching",
  "parking",
  "parking_lot",
]);

const EXCLUDED_TYPES_FOR_CATEGORY: Record<string, Set<string>> = {
  cycling_park: EXCLUDED_TYPES_FOR_SPORT,
  skateboard_park: EXCLUDED_TYPES_FOR_SPORT,
  sports_complex: EXCLUDED_TYPES_FOR_SPORT,
  athletic_field: EXCLUDED_TYPES_FOR_SPORT,
  stadium: EXCLUDED_TYPES_FOR_SPORT,
  ice_skating_rink: EXCLUDED_TYPES_FOR_SPORT,
  sports_activity_location: EXCLUDED_TYPES_FOR_SPORT,
};

// Places API (New) searchNearby-resultat (audit-fiks 2026-07-05: portet fra
// legacy nearbysearch som KUN støtter nøkkel i querystring — CLAUDE.md-brudd).
interface GooglePlaceResult {
  id: string;
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  shortFormattedAddress?: string;
  types?: string[];
}

// Feltmaske = eksakt det discovery-filteret/POI-byggingen konsumerer.
const NEARBY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.shortFormattedAddress",
].join(",");

const NEARBY_TIMEOUT_MS = 10_000;

/**
 * Google returnerer MAKS 20 treff per `places:searchNearby`-kall, og endepunktet
 * har ingen paginering. Verifisert direkte mot API-et 2026-08-24:
 *
 *   • `maxResultCount: 40` → HTTP 400, «must be between 1 and 20 inclusively»
 *   • svaret bærer ingen `nextPageToken` (til forskjell fra `searchText`, som
 *     har både `pageSize` og `pageToken`)
 *
 * Ett kall per kategori er derfor et TAK, ikke en preferanse. Målt i Midtbyen:
 * boardene hadde ~200 POI-er hver mens basen kjente ~1 400 innenfor radiusen.
 * Restauranter, kafeer og parker traff taket i hvert enkelt kall.
 */
const NEARBY_PAGE_MAX = 20;

/**
 * Hvor mange ganger en METTET sirkel får deles i fire. Metning = kallet kom
 * tilbake med fulle 20 treff, altså «det finnes mer her enn vi fikk se».
 *
 * Dybde 2 gir opptil 1 + 4 + 16 = 21 kall for en kategori som er mettet hele
 * veien ned, og 1 kall for en kategori som ikke er mettet i det hele tatt
 * (veterinær, trafikkskole, campingplass). Kostnaden legger seg altså der det
 * faktisk finnes data — ikke flatt utover alle 56 kategorier.
 */
const MAX_SUBDIVISION_DEPTH = 2;

const METERS_PER_DEG_LAT = 110_540;

export interface SearchCircle {
  lat: number;
  lng: number;
  radius: number;
  /** 0 = den opprinnelige sirkelen. */
  depth: number;
}

/**
 * Deler en sirkel i fire overlappende delsirkler som til sammen DEKKER den.
 *
 * Sentrene legges i diagonalene (45°, 135°, 225°, 315°) i avstand R/2, og hver
 * delsirkel får radius 0,76·R. Det dekker: det verste punktet er kanten av
 * moder­sirkelen midt mellom to nabosentre, som ligger 0,737·R fra nærmeste
 * delsenter — innenfor 0,76·R med margin. Overlappet er ufarlig; treffene
 * dedupliseres på Google place-id.
 *
 * Delsirklene stikker utenfor modersirkelen (rekkevidde 1,26·R). Det er også
 * ufarlig: aksept-løkka måler avstand mot den OPPRINNELIGE senteret og kaster
 * alt utenfor `config.radius`. Oppdelingen øker altså recall innenfor sirkelen
 * uten å flytte grensen.
 *
 * Ren funksjon → enhetstestbar.
 */
export function subdivideCircle(circle: SearchCircle): SearchCircle[] {
  const offset = circle.radius / 2;
  const subRadius = circle.radius * 0.76;
  const mLng = 111_320 * Math.cos((circle.lat * Math.PI) / 180);

  return [45, 135, 225, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      lat: circle.lat + (offset * Math.sin(rad)) / METERS_PER_DEG_LAT,
      lng: circle.lng + (offset * Math.cos(rad)) / mLng,
      radius: subRadius,
      depth: circle.depth + 1,
    };
  });
}

/** Ett searchNearby-kall. Returnerer rådataen og om kallet traff taket. */
async function searchNearbyOnce(
  category: string,
  circle: SearchCircle,
  apiKey: string
): Promise<{ places: GooglePlaceResult[]; saturated: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEARBY_TIMEOUT_MS);
  let response: Response;
  try {
    // Places API (New) searchNearby: POST med nøkkel i X-Goog-Api-Key-header
    // (ALDRI querystring — leker i logs; speiler fetch-place-details.ts).
    belastApiKall("places-nearby");
    response = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": NEARBY_FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: [category],
          maxResultCount: NEARBY_PAGE_MAX,
          locationRestriction: {
            circle: {
              center: { latitude: circle.lat, longitude: circle.lng },
              radius: circle.radius,
            },
          },
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error(`    ✗ Feil ved søk etter ${category}: ${response.status}`);
    return { places: [], saturated: false };
  }

  // New API returnerer tomt objekt (ingen `places`-nøkkel) ved null treff.
  const data = await response.json();
  const places: GooglePlaceResult[] = data.places || [];
  return { places, saturated: places.length >= NEARBY_PAGE_MAX };
}

/**
 * Henter alle rå Google-treff for én kategori innenfor en sirkel, ved å dele
 * sirkelen i fire hver gang et kall kommer tilbake mettet (fulle 20 treff).
 *
 * Returnerer også regnskapet: antall kall, og hvor mange sirkler som fortsatt
 * var mettet da dybdegrensa ble nådd. Det siste er en KJENT UFULLSTENDIGHET og
 * skal logges — et tak som ikke er synlig i loggen er samme feil som taket vi
 * fjernet.
 */
async function collectNearbyForCategory(
  category: string,
  root: SearchCircle,
  apiKey: string
): Promise<{
  places: GooglePlaceResult[];
  calls: number;
  truncatedCircles: number;
}> {
  const byId = new Map<string, GooglePlaceResult>();
  const queue: SearchCircle[] = [root];
  let calls = 0;
  let truncatedCircles = 0;

  while (queue.length > 0) {
    const circle = queue.shift() as SearchCircle;
    const { places, saturated } = await searchNearbyOnce(category, circle, apiKey);
    calls++;

    for (const place of places) {
      if (place.id) byId.set(place.id, place);
    }

    if (saturated) {
      if (circle.depth < MAX_SUBDIVISION_DEPTH) {
        queue.push(...subdivideCircle(circle));
      } else {
        truncatedCircles++;
      }
    }

    // Small delay to avoid rate limiting
    await sleep(200);
  }

  return { places: [...byId.values()], calls, truncatedCircles };
}

export async function discoverGooglePlaces(
  config: DiscoveryConfig,
  apiKey: string
): Promise<DiscoveredPOI[]> {
  const categories = config.googleCategories || [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "gym",
    "supermarket",
  ];

  const minRating = config.minRating || 0;
  const allPOIs: DiscoveredPOI[] = [];
  const seenPoiIds = new Set<string>();
  const rejections: QualityRejection[] = [];
  let totalEvaluated = 0;
  let totalCalls = 0;
  let totalTruncated = 0;

  for (const category of categories) {
    console.log(`  → Søker etter ${category}...`);

    try {
      const { places, calls, truncatedCircles } = await collectNearbyForCategory(
        category,
        { ...config.center, radius: config.radius, depth: 0 },
        apiKey
      );
      totalCalls += calls;
      totalTruncated += truncatedCircles;

      const categoryDef = GOOGLE_CATEGORY_MAP[category] || {
        id: category,
        name: category,
        icon: "MapPin",
        color: "#6b7280",
      };

      let addedCount = 0;
      for (const place of places) {
        // FieldMask garanterer feltene, men vern mot delvise objekter.
        const placeName = place.displayName?.text;
        if (!placeName || !place.location) {
          continue;
        }

        // Filter by actual distance (Google API treats radius as preference, not strict).
        // Måles mot den OPPRINNELIGE senteret, så delsirklene ikke utvider grensen.
        const distance = calculateDistance(
          config.center.lat,
          config.center.lng,
          place.location.latitude,
          place.location.longitude
        );
        if (distance > config.radius) {
          continue;
        }

        // Filter by type match — Google returns junk (stadiums, offices) for some categories
        const validTypes = VALID_TYPES_FOR_CATEGORY[category];
        if (validTypes && place.types) {
          const hasMatch = place.types.some((t) => validTypes.has(t));
          if (!hasMatch) {
            continue;
          }
        }

        // Diskvalifiserende typer: et treningssenter eller en parkeringsplass
        // som ALLE bærer en idrettstype skal ikke bli idrettsanlegg.
        const excludedTypes = EXCLUDED_TYPES_FOR_CATEGORY[category];
        if (excludedTypes && place.types?.some((t) => excludedTypes.has(t))) {
          continue;
        }

        // Filter by rating
        if (place.rating && place.rating < minRating) {
          continue;
        }

        // Quality filter chain (business_status → distance → quality → name_mismatch)
        // New API bruker samme businessStatus-enum-strenger som legacy
        // (OPERATIONAL/CLOSED_TEMPORARILY/CLOSED_PERMANENTLY).
        totalEvaluated++;
        const qualityResult = evaluateGooglePlaceQuality(
          {
            name: placeName,
            business_status: place.businessStatus,
            rating: place.rating,
            user_ratings_total: place.userRatingCount,
          },
          categoryDef.id,
          distance,
          rejections
        );
        if (!qualityResult.pass) {
          continue;
        }

        // INGEN per-kategori-cap her. Fram til 2026-08-24 sto det et
        // `if (addedCount >= maxPerCategory) break;` på denne linja, med
        // maxPerCategory = 20 — samme tall som API-taket, så det var usynlig at
        // det fantes. Nå er sirkelen den eneste grensen.

        // Create POI ID with source prefix (using Google place id for stability)
        const id = generatePoiId("google", placeName, place.id);

        // Check for duplicates (på tvers av kategorier — første treff eier stedet)
        if (seenPoiIds.has(id)) {
          continue;
        }
        seenPoiIds.add(id);

        allPOIs.push({
          id,
          name: placeName,
          coordinates: {
            lat: place.location.latitude,
            lng: place.location.longitude,
          },
          address: place.shortFormattedAddress,
          category: categoryDef,
          googlePlaceId: place.id,
          googleRating: place.rating,
          googleReviewCount: place.userRatingCount,
          source: "google",
        });

        addedCount++;
      }

      const subInfo = calls > 1 ? ` (${calls} kall, sirkelen delt)` : "";
      console.log(`    ✓ Fant ${addedCount} ${category}${subInfo}`);
      if (truncatedCircles > 0) {
        console.warn(
          `    ⚠️  ${category}: ${truncatedCircles} delsirkel(er) var fortsatt mettet på dybde ${MAX_SUBDIVISION_DEPTH} — det finnes mer enn vi hentet`
        );
      }
    } catch (error) {
      console.error(`    ✗ Feil ved søk etter ${category}:`, error);
    }
  }

  console.log(
    `  Σ ${totalCalls} searchNearby-kall over ${categories.length} kategorier`
  );
  if (totalTruncated > 0) {
    console.warn(
      `  ⚠️  ${totalTruncated} delsirkler nådde dybdegrensa mettet — hev MAX_SUBDIVISION_DEPTH for full dekning`
    );
  }

  // Log quality filter stats
  if (totalEvaluated > 0) {
    const stats = calculateQualityStats(totalEvaluated, rejections);
    logQualityFilterStats(stats);
  }

  return allPOIs;
}

// === Google Places Text Search (recall-fiks 2026-08-12) ===

/**
 * Tekstsøk-kandidat: norsk søkeord + Placy-kategorien resultatene skal få.
 * Brukes for hverdagssteder uten (pålitelig) Google-type — f.eks. trafikkskole
 * og ungdomsklubb. Typefiltrert searchNearby bommet på hele denne halen i
 * Straumen-fasitøvelsen (recall 18 %).
 */
export interface TextSearchQuery {
  query: string;
  category: Category;
}

/**
 * searchText-pass over en liste norske kategorisøk. Samme kvalitetskjede og
 * distansefilter som searchNearby (locationBias er en preferanse, ikke en
 * begrensning — post-filter på faktisk avstand er obligatorisk). Ingen
 * VALID_TYPES-sjekk: tekstresultater er heterogent typet, og kvalitetskjeden
 * + distansetak bærer junk-vernet.
 */
/**
 * `places:searchText` HAR paginering — til forskjell fra `searchNearby`.
 * Verifisert mot API-et 2026-08-24: `pageSize: 20` gir 20 treff og en
 * `nextPageToken` i svaret. Fram til nå ba vi om `maxResultCount: 10` og
 * hentet aldri side to, så et tekstsøk kunne aldri gi mer enn 10 steder
 * uansett hvor mange som fantes.
 */
const TEXT_PAGE_SIZE = 20;

/** Maks antall sider per tekstsøk. 3 × 20 = 60 steder per søkeord. */
const TEXT_MAX_PAGES = 3;

async function searchTextPage(
  query: string,
  config: { center: Coordinates; radius: number },
  apiKey: string,
  pageToken?: string
): Promise<{ places: GooglePlaceResult[]; nextPageToken?: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEARBY_TIMEOUT_MS);
  let response: Response;
  try {
    belastApiKall("places-text");
    response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": `${NEARBY_FIELD_MASK},nextPageToken`,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "no",
        pageSize: TEXT_PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
        locationBias: {
          circle: {
            center: {
              latitude: config.center.lat,
              longitude: config.center.lng,
            },
            radius: config.radius,
          },
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error(`    ✗ Feil ved tekstsøk «${query}»: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return {
    places: (data.places || []) as GooglePlaceResult[],
    nextPageToken: data.nextPageToken as string | undefined,
  };
}

export async function discoverGooglePlacesByText(
  config: { center: Coordinates; radius: number },
  queries: TextSearchQuery[],
  apiKey: string
): Promise<DiscoveredPOI[]> {
  const allPOIs: DiscoveredPOI[] = [];
  const seenPoiIds = new Set<string>();
  const rejections: QualityRejection[] = [];
  let totalEvaluated = 0;

  for (const { query, category } of queries) {
    console.log(`  → Tekstsøk: «${query}»...`);

    try {
      // Hent alle sider FØRST, så aksept-løkka ser hele settet.
      const places: GooglePlaceResult[] = [];
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const page = await searchTextPage(query, config, apiKey, pageToken);
        if (!page) break;
        places.push(...page.places);
        pageToken = page.nextPageToken;
        pages++;
        if (pageToken) await sleep(200);
      } while (pageToken && pages < TEXT_MAX_PAGES);

      if (pageToken && pages >= TEXT_MAX_PAGES) {
        console.warn(
          `    ⚠️  «${query}»: flere sider gjenstår etter ${TEXT_MAX_PAGES} — det finnes mer enn vi hentet`
        );
      }

      let addedCount = 0;

      for (const place of places) {
        const placeName = place.displayName?.text;
        if (!placeName || !place.location) continue;

        const distance = calculateDistance(
          config.center.lat,
          config.center.lng,
          place.location.latitude,
          place.location.longitude
        );
        if (distance > config.radius) continue;

        totalEvaluated++;
        const qualityResult = evaluateGooglePlaceQuality(
          {
            name: placeName,
            business_status: place.businessStatus,
            rating: place.rating,
            user_ratings_total: place.userRatingCount,
          },
          category.id,
          distance,
          rejections
        );
        if (!qualityResult.pass) continue;

        const id = generatePoiId("google", placeName, place.id);
        if (seenPoiIds.has(id)) continue;
        seenPoiIds.add(id);

        allPOIs.push({
          id,
          name: placeName,
          coordinates: {
            lat: place.location.latitude,
            lng: place.location.longitude,
          },
          address: place.shortFormattedAddress,
          category,
          googlePlaceId: place.id,
          googleRating: place.rating,
          googleReviewCount: place.userRatingCount,
          source: "google",
        });
        addedCount++;
      }

      const pageInfo = pages > 1 ? ` (${pages} sider)` : "";
      console.log(`    ✓ Fant ${addedCount} for «${query}»${pageInfo}`);
    } catch (error) {
      console.error(`    ✗ Feil ved tekstsøk «${query}»:`, error);
    }

    await sleep(200);
  }

  if (totalEvaluated > 0) {
    logQualityFilterStats(calculateQualityStats(totalEvaluated, rejections));
  }

  return allPOIs;
}

// === Entur Stop Places Discovery ===

const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";

const STOP_PLACES_QUERY = `
  query GetNearbyStopPlaces($lat: Float!, $lon: Float!, $distance: Float!) {
    nearest(
      latitude: $lat
      longitude: $lon
      maximumDistance: $distance
      filterByPlaceTypes: [stopPlace]
      filterByInUse: true
      multiModalMode: parent
    ) {
      edges {
        node {
          place {
            ... on StopPlace {
              id
              name
              latitude
              longitude
              transportMode
            }
          }
          distance
        }
      }
    }
  }
`;

interface EnturStopPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  transportMode: string[];
}

export async function discoverEnturStops(
  config: DiscoveryConfig
): Promise<DiscoveredPOI[]> {
  console.log("  → Søker etter kollektivholdeplasser...");

  try {
    const response = await fetch(ENTUR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "placy-story-generator",
      },
      body: JSON.stringify({
        query: STOP_PLACES_QUERY,
        variables: {
          lat: config.center.lat,
          lon: config.center.lng,
          distance: config.radius,
        },
      }),
    });

    if (!response.ok) {
      console.error(`    ✗ Entur API feil: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.errors) {
      console.error("    ✗ Entur GraphQL feil:", data.errors[0]?.message);
      return [];
    }

    const edges = data.data?.nearest?.edges || [];
    const pois: DiscoveredPOI[] = [];

    for (const edge of edges) {
      const place = edge.node?.place as EnturStopPlace;
      if (!place || !place.id) continue;

      // Determine transport mode
      const modes = place.transportMode || [];
      let category = TRANSPORT_CATEGORIES.bus;
      let suffix = "";
      let categoryId = "bus";

      if (modes.includes("rail")) {
        category = TRANSPORT_CATEGORIES.train;
        categoryId = "train";
        suffix = " stasjon";
      } else if (modes.includes("tram")) {
        category = TRANSPORT_CATEGORIES.tram;
        categoryId = "tram";
        suffix = " holdeplass";
      } else if (modes.includes("metro")) {
        category = TRANSPORT_CATEGORIES.train;
        categoryId = "train";
        suffix = " T-bane";
      } else {
        suffix = " bussholdeplass";
      }

      const name = place.name + (place.name.toLowerCase().includes("holdeplass") || place.name.toLowerCase().includes("stasjon") ? "" : suffix);

      // Distance-based quality filter for transport
      const stopDistance = calculateDistance(
        config.center.lat,
        config.center.lng,
        place.latitude,
        place.longitude
      );
      if (!isWithinMaxDistance(stopDistance)) {
        continue;
      }

      // Create POI ID with source prefix (using Entur stopplace_id for stability)
      const id = generatePoiId("entur", name, place.id);

      // Skip duplicates
      if (pois.some((p) => p.id === id)) continue;

      pois.push({
        id,
        name,
        coordinates: {
          lat: place.latitude,
          lng: place.longitude,
        },
        category,
        source: "entur",
        enturStopplaceId: place.id,
      });
    }

    console.log(`    ✓ Fant ${pois.length} holdeplasser`);
    return pois;
  } catch (error) {
    console.error("    ✗ Entur API feil:", error);
    return [];
  }
}

// === Trondheim Bysykkel Discovery ===

const BYSYKKEL_STATION_INFO_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_information.json";

interface BysykkelStation {
  station_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
}

export async function discoverBysykkelStations(
  config: DiscoveryConfig
): Promise<DiscoveredPOI[]> {
  console.log("  → Søker etter bysykkelstasjoner...");

  try {
    const response = await fetch(BYSYKKEL_STATION_INFO_URL, {
      headers: {
        "Client-Identifier": "placy-story-generator",
      },
    });

    if (!response.ok) {
      console.error(`    ✗ Bysykkel API feil: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const stations: BysykkelStation[] = data.data?.stations || [];

    const pois: DiscoveredPOI[] = [];

    for (const station of stations) {
      // Check if within radius
      const distance = calculateDistance(
        config.center.lat,
        config.center.lng,
        station.lat,
        station.lon
      );

      if (distance > config.radius) continue;

      // Distance-based quality filter for bike stations
      if (!isWithinMaxDistance(distance)) {
        continue;
      }

      const name = `Trondheim Bysykkel: ${station.name}`;

      // Create POI ID with source prefix (using station_id for stability)
      const id = generatePoiId("bysykkel", name, station.station_id);

      pois.push({
        id,
        name,
        coordinates: {
          lat: station.lat,
          lng: station.lon,
        },
        address: station.address,
        category: TRANSPORT_CATEGORIES.bike,
        source: "bysykkel",
        bysykkelStationId: station.station_id,
      });
    }

    console.log(`    ✓ Fant ${pois.length} bysykkelstasjoner`);
    return pois;
  } catch (error) {
    console.error("    ✗ Bysykkel API feil:", error);
    return [];
  }
}

// === Main Discovery Function ===

export async function discoverPOIs(
  config: DiscoveryConfig,
  googleApiKey: string
): Promise<DiscoveredPOI[]> {
  console.log(`\n🔍 Discovering POIs around (${config.center.lat}, ${config.center.lng})...`);
  console.log(`   Radius: ${config.radius}m\n`);

  const allPOIs: DiscoveredPOI[] = [];

  // Google Places
  if (config.googleCategories && config.googleCategories.length > 0) {
    console.log("📍 Google Places:");
    const googlePOIs = await discoverGooglePlaces(config, googleApiKey);
    allPOIs.push(...googlePOIs);
  }

  // Transport
  if (config.includeTransport !== false) {
    console.log("\n🚌 Transport:");
    const enturPOIs = await discoverEnturStops(config);
    allPOIs.push(...enturPOIs);

    const bysykkelPOIs = await discoverBysykkelStations(config);
    allPOIs.push(...bysykkelPOIs);
  }

  console.log(`\n✅ Totalt funnet: ${allPOIs.length} POI-er`);

  return allPOIs;
}

// === Helper Functions ===

/**
 * Generate a unique POI ID with source prefix.
 *
 * Uses external ID when available for stability (ID won't change if name changes).
 * Falls back to slugified name with source prefix.
 *
 * Examples:
 * - google-ChIJN1t_tDeuEmsR (using place_id)
 * - entur-NSR-StopPlace-58366 (using stopplace_id)
 * - bysykkel-123 (using station_id)
 * - google-cafe-lansen (fallback using name)
 */
function generatePoiId(
  source: "google" | "entur" | "bysykkel" | "manual",
  name: string,
  externalId?: string
): string {
  if (externalId) {
    // Clean the external ID (replace colons with dashes for URL-safety)
    const cleanId = externalId.replace(/:/g, "-");
    return `${source}-${cleanId}`;
  }
  return `${source}-${slugify(name)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export categories and utilities for use elsewhere
export { GOOGLE_CATEGORY_MAP, TRANSPORT_CATEGORIES, generatePoiId };
