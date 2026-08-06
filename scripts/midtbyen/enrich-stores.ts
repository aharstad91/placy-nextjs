/**
 * Berikelse av butikkatalogen — steg 2 av 2 i Midtbyen-demoen.
 *
 * Kjør:  npx tsx scripts/midtbyen/enrich-stores.ts
 * Inn:   lib/gigs/midtbyen/stores.raw.json  (fra fetch-stores.ts)
 * Ut:    lib/gigs/midtbyen/stores.json      (sjekkes inn i repoet)
 *
 * To ting legges til, og begge er synlige i flaten:
 *
 *  - **Åpningstider** via Google Places. Kart-popupen leser
 *    `openingHoursJson.weekday_text` og viser åpent/stengt, så dette er ikke
 *    data som forsvinner i en skuff.
 *  - **Gangtid fra Torvet** via Mapbox Matrix. Nabolagslista sorterer på
 *    nettopp dette feltet og faller tilbake til «uendelig» uten det — uten
 *    dette steget står lista alfabetisk og ser ut som en feil.
 *
 * Places-oppslaget fyller samtidig koordinat for de ni `g.page`-oppføringene
 * som steg 1 ikke kunne stedfeste.
 *
 * Alt er fail-soft PER BUTIKK. En butikk uten Google-treff beholdes uten
 * åpningstider; feil åpningstider ville vært verre enn ingen.
 */

import "../load-env";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { fetchPlaceDetails } from "@/lib/google-places/fetch-place-details";
import { calculateTravelTimes } from "@/lib/pipeline/travel-times";
import { TORVET } from "@/lib/gigs/midtbyen/anchor";
import {
  pickBestPlaceMatch,
  type PlaceCandidate,
} from "@/lib/gigs/midtbyen/match-place";
import type { RawStore, RawStoresFile } from "./fetch-stores";
import type { ParsedCategory } from "@/lib/gigs/midtbyen/parse-stores";

const IN_PATH = join(process.cwd(), "lib/gigs/midtbyen/stores.raw.json");
const OUT_PATH = join(process.cwd(), "lib/gigs/midtbyen/stores.json");

const PLACES_CONCURRENCY = 4;
const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location";
const DETAIL_FIELDS = ["rating", "userRatingCount", "regularOpeningHours"];

export interface EnrichedStore extends RawStore {
  googlePlaceId?: string;
  /** Ukedagsbeskrivelser slik `MapPopupCard` forventer dem. */
  openingHours?: string[];
  googleRating?: number;
  googleReviewCount?: number;
  /** Gangminutter fra Torvet. Mangler når butikken ikke kunne stedfestes. */
  walkMinutes?: number;
}

export interface StoresFile {
  source: string;
  fetchedAt: string;
  enrichedAt: string;
  anchor: { name: string; lat: number; lng: number };
  categories: ParsedCategory[];
  stores: EnrichedStore[];
}

/** Google-søk etter butikken. Feil gir tom liste — aldri et kast oppover. */
async function searchPlaces(
  query: string,
  apiKey: string,
): Promise<PlaceCandidate[]> {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      // Nøkkelen i header, aldri i querystring (CLAUDE.md) — URL-er lekker i logg.
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "no",
      regionCode: "NO",
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: { latitude: TORVET.lat, longitude: TORVET.lng },
          radius: 2000,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`searchText HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }>;
  };

  return (body.places ?? []).map((p) => ({
    placeId: p.id,
    displayName: p.displayName?.text ?? "",
    formattedAddress: p.formattedAddress,
    location: p.location
      ? { lat: p.location.latitude, lng: p.location.longitude }
      : undefined,
  }));
}

async function enrichOne(
  store: RawStore,
  apiKey: string,
  problems: string[],
): Promise<EnrichedStore> {
  const coordinates =
    store.lat !== undefined && store.lng !== undefined
      ? { lat: store.lat, lng: store.lng }
      : undefined;

  let match: PlaceCandidate | null = null;
  try {
    const query = [store.name, store.address, "Trondheim"]
      .filter(Boolean)
      .join(", ");
    match = pickBestPlaceMatch(
      { name: store.name, coordinates },
      await searchPlaces(query, apiKey),
    );
  } catch (error) {
    problems.push(
      `${store.name}: søk feilet — ${error instanceof Error ? error.message : String(error)}`,
    );
    return { ...store };
  }

  if (!match) return { ...store };

  const enriched: EnrichedStore = { ...store, googlePlaceId: match.placeId };

  // Steg 1 fikk ikke koordinat for g.page-oppføringene. Treffet har den.
  if (!coordinates && match.location) {
    enriched.lat = match.location.lat;
    enriched.lng = match.location.lng;
  }

  try {
    const details = await fetchPlaceDetails(match.placeId, apiKey, DETAIL_FIELDS);
    if (details) {
      if (details.openingHours?.length) enriched.openingHours = details.openingHours;
      if (typeof details.rating === "number") enriched.googleRating = details.rating;
      if (typeof details.reviewCount === "number") {
        enriched.googleReviewCount = details.reviewCount;
      }
    }
  } catch (error) {
    // Butikken beholder place-ID og koordinat; kun detaljene mangler.
    problems.push(
      `${store.name}: detaljer feilet — ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return enriched;
}

/** Forrige kjørings berikelse, nøklet på butikknavn. Tom ved første kjøring. */
function readPrevious(): Map<string, EnrichedStore> {
  if (!existsSync(OUT_PATH)) return new Map();
  try {
    const file = JSON.parse(readFileSync(OUT_PATH, "utf-8")) as StoresFile;
    return new Map(file.stores.map((s) => [s.name, s]));
  } catch {
    // En korrupt fil skal ikke blokkere en ny henting — den blir overskrevet.
    return new Map();
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!apiKey || !mapboxToken) {
    console.error(
      "Mangler GOOGLE_PLACES_API_KEY og/eller NEXT_PUBLIC_MAPBOX_TOKEN i .env.local",
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(IN_PATH, "utf-8")) as RawStoresFile;
  console.log(`Leste ${raw.stores.length} butikker fra stores.raw.json`);

  // Gjenbruk tidligere treff med mindre `--force`. Places-oppslag koster penger
  // per kall, og en ny kjøring handler som regel om å tette hullene fra forrige
  // — ikke om å betale for de 137 som allerede satt.
  const force = process.argv.includes("--force");
  const previous = force ? new Map<string, EnrichedStore>() : readPrevious();
  if (previous.size > 0) {
    console.log(
      `  gjenbruker ${previous.size} tidligere treff (kjør med --force for å hente alt på nytt)`,
    );
  }

  const problems: string[] = [];
  const limit = pLimit(PLACES_CONCURRENCY);
  console.log(`Slår opp Google Places (${PLACES_CONCURRENCY} om gangen) …`);
  const enriched = await Promise.all(
    raw.stores.map((store) =>
      limit(async () => {
        const cached = previous.get(store.name);
        // Rader uten place-ID prøves på nytt: det er nettopp dem en ny kjøring
        // skal redde.
        if (!cached?.googlePlaceId) return enrichOne(store, apiKey, problems);
        // Fersk katalogdata vinner; berikelsen bevares.
        return {
          ...store,
          lat: store.lat ?? cached.lat,
          lng: store.lng ?? cached.lng,
          googlePlaceId: cached.googlePlaceId,
          ...(cached.openingHours ? { openingHours: cached.openingHours } : {}),
          ...(cached.googleRating !== undefined
            ? { googleRating: cached.googleRating }
            : {}),
          ...(cached.googleReviewCount !== undefined
            ? { googleReviewCount: cached.googleReviewCount }
            : {}),
        };
      }),
    ),
  );

  // Gangtid fra Torvet for alt som nå har koordinat. Mapbox-modulen batcher
  // selv til 24 destinasjoner per kall og returnerer MINUTTER.
  const located = enriched.filter(
    (s) => s.lat !== undefined && s.lng !== undefined,
  );
  console.log(`Beregner gangtid fra Torvet for ${located.length} butikker …`);
  const warnings: string[] = [];
  const times = await calculateTravelTimes(
    TORVET,
    located.map((s) => ({
      id: s.name,
      coordinates: { lat: s.lat!, lng: s.lng! },
    })),
    mapboxToken,
    ["walk"],
    warnings,
  );
  const walkByName = new Map(
    times
      // 0 minutter ville betydd «står på Torvet» — behandles som manglende
      // svar heller enn å vises som «0 min» i lista.
      .filter((t) => typeof t.walk === "number" && t.walk > 0)
      .map((t) => [t.poiId, t.walk!]),
  );
  for (const store of enriched) {
    const walk = walkByName.get(store.name);
    if (walk !== undefined) store.walkMinutes = walk;
  }

  const file: StoresFile = {
    source: raw.source,
    fetchedAt: raw.fetchedAt,
    enrichedAt: new Date().toISOString(),
    anchor: { name: "Torvet", lat: TORVET.lat, lng: TORVET.lng },
    categories: raw.categories,
    stores: enriched,
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf-8");

  const withCoords = enriched.filter((s) => s.lat !== undefined).length;
  const withHours = enriched.filter((s) => s.openingHours?.length).length;
  const withWalk = enriched.filter((s) => s.walkMinutes !== undefined).length;

  console.log(`\nSkrevet ${OUT_PATH}`);
  console.log(`  ${withCoords}/${enriched.length} med koordinat`);
  console.log(`  ${withWalk}/${enriched.length} med gangtid`);
  console.log(`  ${withHours}/${enriched.length} med åpningstider`);

  const utenGangtid = enriched.filter((s) => s.walkMinutes === undefined);
  if (utenGangtid.length > 0) {
    console.log("  uten gangtid:");
    for (const s of utenGangtid) console.log(`    · ${s.name}`);
  }
  for (const w of warnings) console.log(`  ${w}`);
  if (problems.length > 0) {
    console.log("  problemer:");
    for (const p of problems) console.log(`    · ${p}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
