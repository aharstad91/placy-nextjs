/**
 * Bridge Text Generator
 *
 * Generates S&J-inspired bridge text for report themes using
 * actual POI names and estimated distances. Template-based, no LLM.
 *
 * Calibration: .claude/skills/curator/references/bridge-text-calibration.md
 * Research: docs/research/2026-04-08-beliggenhetstekst-moensteranalyse.md
 *
 * Design principles (from Brøset 046 gullstandard):
 * 1. 1–2 ankersteder per theme — show span, not list
 * 2. Contrast pairs: nær ↔ fjern, innendørs ↔ utendørs
 * 3. Last sentence = hverdagskonklusjon
 * 4. Never generic — always name actual POIs
 * 5. Two sentences per theme (calibrated to Brøset output)
 */

import type { POI, Coordinates } from "@/lib/types";

// ============================================================
// Public API
// ============================================================

/**
 * Generate S&J-style bridge text for a theme.
 * Returns undefined if insufficient POI data for a meaningful text.
 */
export function generateBridgeText(
  themeId: string,
  pois: POI[],
  center: Coordinates,
): string | undefined {
  const gen = GENERATORS[themeId];
  if (!gen || pois.length === 0) return undefined;
  const text = gen(pois, center);
  return text || undefined;
}

// ============================================================
// Distance & sorting helpers
// ============================================================

/** Haversine distance in meters */
function distanceM(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Estimated walk minutes. Uses travelTime.walk if available, else Haversine × 1.3 road factor. */
function walkMin(poi: POI, center: Coordinates): number {
  if (poi.travelTime?.walk != null) return poi.travelTime.walk;
  return Math.round((distanceM(center, poi.coordinates) * 1.3) / 83);
}

/** Sort by estimated walk time (nearest first) */
function byDistance(pois: POI[], center: Coordinates): POI[] {
  return [...pois].sort((a, b) => walkMin(a, center) - walkMin(b, center));
}

// ============================================================
// POI selection helpers
// ============================================================

/** Filter POIs by category IDs */
function inCats(pois: POI[], ...cats: string[]): POI[] {
  const set = new Set(cats);
  return pois.filter((p) => set.has(p.category.id));
}

/** Best-rated POI (≥ 4.0 stars, prefer more reviews) */
function topRated(pois: POI[]): POI | undefined {
  return pois
    .filter((p) => (p.googleRating ?? 0) >= 4.0)
    .sort((a, b) => {
      const rd = (b.googleRating ?? 0) - (a.googleRating ?? 0);
      return rd !== 0 ? rd : (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0);
    })[0];
}

// ============================================================
// Text helpers
// ============================================================

/** Clean POI name for prose (strip legal suffixes and redundant labels) */
function clean(poi: POI): string {
  return poi.name
    .replace(/ bussholdeplass$/i, "")
    .replace(/ holdeplass$/i, "")
    .replace(/ AS$/i, "")
    .replace(/ SA$/i, "")
    .trim();
}

/** Natural proximity phrase — calibrated to S&J vocabulary */
function prox(poi: POI, center: Coordinates): string {
  const m = walkMin(poi, center);
  if (m <= 3) return "i gangavstand";
  if (m <= 7) return `${m} minutters gange`;
  return `ca. ${m} minutters gange`;
}

/** Count POIs reachable within N walk minutes */
function countWithin(pois: POI[], center: Coordinates, minutes: number): number {
  return pois.filter((p) => walkMin(p, center) <= minutes).length;
}

/** Join items with "og": ["A","B","C"] → "A, B og C" */
function ogJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " og " + items[items.length - 1];
}

// ============================================================
// Theme generators
// ============================================================

type Gen = (pois: POI[], center: Coordinates) => string;

/**
 * Barn & Oppvekst
 * Anchors: school ↔ barnehage  |  idrett ↔ lekeplass
 * Pattern: "Eberg skole i gangavstand, Brøset barnehage for de minste.
 *           Blussuvoll og Leangen dekker resten — fra svømmehall til friidrettsbane."
 */
function barnOppvekst(pois: POI[], c: Coordinates): string {
  const skoler = byDistance(inCats(pois, "skole"), c);
  const bhg = byDistance(inCats(pois, "barnehage"), c);
  const lek = byDistance(inCats(pois, "lekeplass"), c);
  const idrett = byDistance(inCats(pois, "idrett"), c);

  const parts: string[] = [];

  // Sentence 1: school + barnehage pair
  if (skoler[0] && bhg[0]) {
    parts.push(
      `${clean(skoler[0])} ${prox(skoler[0], c)}, ${clean(bhg[0])} for de minste.`,
    );
  } else if (skoler[0]) {
    parts.push(`${clean(skoler[0])} ${prox(skoler[0], c)}.`);
  } else if (bhg[0]) {
    const n = bhg.length;
    parts.push(
      `${clean(bhg[0])} er nærmeste barnehage${n > 2 ? ` — ${n} alternativer i nærområdet` : ""}.`,
    );
  }

  // Sentence 2: activity contrast (organized ↔ free play)
  if (idrett[0] && lek[0]) {
    parts.push(
      `${clean(idrett[0])} og lekeplass i nabolaget gir rom for både organisert aktivitet og fri lek.`,
    );
  } else if (idrett[0]) {
    parts.push(`${clean(idrett[0])} for organisert aktivitet ${prox(idrett[0], c)}.`);
  } else if (lek[0]) {
    parts.push(`Lekeplass ${prox(lek[0], c)}.`);
  }

  return parts.join(" ");
}

/**
 * Hverdagsliv
 * Anchors: nærbutikk ↔ storhandel/alternativ
 * Pattern: "Valentinlyst Senter med Coop Mega, apotek og frisør i gangavstand
 *           — MENY Moholt for de større handlekurvene. Det meste ordnes uten bil."
 */
function hverdagsliv(pois: POI[], c: Coordinates): string {
  const butikker = byDistance(inCats(pois, "supermarket", "convenience"), c);
  const apotek = inCats(pois, "pharmacy");

  const parts: string[] = [];

  // Sentence 1: nearest + second supermarket (show span)
  if (butikker[0] && butikker[1]) {
    const hasApotek = apotek.length > 0;
    const extras = hasApotek ? " med apotek i nærheten" : "";
    parts.push(
      `${clean(butikker[0])} ${prox(butikker[0], c)}${extras} — ${clean(butikker[1])} for variasjon.`,
    );
  } else if (butikker[0]) {
    parts.push(`${clean(butikker[0])} ${prox(butikker[0], c)}.`);
  }

  // Sentence 2: conclusion
  const walkable = countWithin(pois, c, 15);
  if (walkable >= 5) {
    parts.push("Det meste ordnes uten bil.");
  } else if (walkable >= 3) {
    parts.push("De viktigste hverdagstjenestene i gangavstand.");
  }

  return parts.join(" ");
}

/**
 * Mat & Drikke
 * Anchors: local spot ↔ area character  |  quality + honesty
 * Pattern: "Moholt Allmenning har fått nye spisesteder de siste årene, og
 *           studentbyen tilfører kafeer. Sentrum med full bredde er et kvarter med buss."
 */
function matDrikke(pois: POI[], c: Coordinates): string {
  const kafeer = inCats(pois, "cafe", "bakery");
  const restauranter = inCats(pois, "restaurant");

  const parts: string[] = [];

  // Sentence 1: anchor pair (quality + daily)
  const bestRest = topRated(restauranter) ?? byDistance(restauranter, c)[0];
  const bestKafe = topRated(kafeer) ?? byDistance(kafeer, c)[0];

  if (bestRest && bestKafe) {
    parts.push(`${clean(bestKafe)} og ${clean(bestRest)} gir nabolaget karakter.`);
  } else {
    const anchor = bestRest ?? bestKafe;
    if (anchor) parts.push(`${clean(anchor)} ${prox(anchor, c)}.`);
  }

  // Sentence 2: honest quantity conclusion
  const total = pois.length;
  if (total >= 8) {
    parts.push("Godt utvalg for den som setter pris på å spise ute.");
  } else if (total >= 4) {
    parts.push("Nok til å variere hverdagen uten å dra langt.");
  } else if (total >= 2) {
    parts.push("Sentrum med full restaurantbredde er ikke langt unna.");
  }

  return parts.join(" ");
}

/**
 * Opplevelser
 * Anchors: 2–3 named culture spots
 * Pattern: "Bibliotek, kino og museum i nabolaget. Aldri langt til neste opplevelse."
 */
function opplevelser(pois: POI[], c: Coordinates): string {
  const bib = byDistance(inCats(pois, "library"), c)[0];
  const kino = byDistance(inCats(pois, "cinema"), c)[0];
  const mus = byDistance(inCats(pois, "museum"), c)[0];
  const annet = byDistance(inCats(pois, "bowling", "amusement", "theatre"), c)[0];

  const anchors: POI[] = [bib, mus, kino, annet].filter(Boolean) as POI[];
  if (anchors.length === 0) return "";

  const parts: string[] = [];

  if (anchors.length >= 2) {
    parts.push(`${ogJoin(anchors.slice(0, 3).map(clean))} i nabolaget.`);
  } else {
    parts.push(`${clean(anchors[0])} ${prox(anchors[0], c)}.`);
  }

  if (pois.length >= 4) {
    parts.push("Aldri langt til neste opplevelse.");
  }

  return parts.join(" ");
}

/**
 * Natur & Friluftsliv
 * Anchors: marka/tur ↔ lokal park/badeplass
 * Pattern: "Estenstadmarka starter i enden av gaten — merkede stier, lysløype
 *           om vinteren. Brøset-parken og Leangenbekken gir grønne drag."
 */
function naturFriluftsliv(pois: POI[], c: Coordinates): string {
  const parker = byDistance(inCats(pois, "park"), c);
  const outdoor = byDistance(inCats(pois, "outdoor"), c);
  const bade = byDistance(inCats(pois, "badeplass"), c);

  const parts: string[] = [];

  // Sentence 1: nearest nature area (dramatic proximity)
  const allNature = byDistance([...outdoor, ...parker], c);
  const naturPoi = allNature[0];
  if (naturPoi) {
    const w = walkMin(naturPoi, c);
    if (w <= 5) {
      parts.push(`${clean(naturPoi)} starter rett utenfor døren.`);
    } else {
      parts.push(`${clean(naturPoi)} ${prox(naturPoi, c)}.`);
    }
  }

  // Sentence 2: contrast — badeplass (seasonal) or secondary green space
  if (bade[0]) {
    parts.push(`${clean(bade[0])} gir bademuligheter om sommeren.`);
  } else {
    // Find a secondary green area different from anchor 1
    const secondary = allNature.find((p) => p.id !== naturPoi?.id);
    if (secondary) {
      parts.push(`${clean(secondary)} gir grønne rom midt i nabolaget.`);
    }
  }

  return parts.join(" ");
}

/**
 * Trening & Aktivitet
 * Anchors: named gyms/pools ↔ outdoor option
 * Pattern: "MaxPuls på Moholt, Fresh Fitness på Valentinlyst, svømmebasseng
 *           i Blussuvollhallen — alt i gangavstand. Estenstadmarka har lysløype."
 */
function treningAktivitet(pois: POI[], c: Coordinates): string {
  const gym = byDistance(inCats(pois, "gym"), c);
  const swim = byDistance(inCats(pois, "swimming"), c);
  const fitPark = byDistance(inCats(pois, "fitness_park"), c);

  const parts: string[] = [];

  // Prefer top-rated gym as primary anchor, then nearest as secondary
  const primaryGym = topRated(gym) ?? gym[0];
  const secondaryGym = gym.find((g) => g.id !== primaryGym?.id);

  // Sentence 1: named anchors (max 3) as list
  const anchors: string[] = [];
  if (primaryGym) anchors.push(clean(primaryGym));
  if (secondaryGym) anchors.push(clean(secondaryGym));
  if (swim[0]) anchors.push(`svømmebasseng i ${clean(swim[0])}`);

  if (anchors.length >= 2) {
    parts.push(`${ogJoin(anchors)} — alt i gangavstand.`);
  } else if (anchors.length === 1) {
    const anchor = primaryGym ?? swim[0];
    if (anchor) parts.push(`${anchors[0]} ${prox(anchor, c)}.`);
  }

  // Sentence 2: outdoor contrast
  if (fitPark[0]) {
    parts.push(`${clean(fitPark[0])} for utendørs trening.`);
  }

  return parts.join(" ");
}

/**
 * Transport & Mobilitet
 * Anchors: primary transit (tog > trikk > buss) ↔ sykkel/buss
 * Pattern: "AtB-linje 5 og 22 stopper ved Brøset — sentrum på tolv minutter.
 *           Bysykkel på Moholt og Blussuvoll, sykkelekspressen til Gløshaugen."
 */
function transport(pois: POI[], c: Coordinates): string {
  const buss = byDistance(inCats(pois, "bus"), c);
  const trikk = byDistance(inCats(pois, "tram"), c);
  const tog = byDistance(inCats(pois, "train"), c);
  const sykkel = byDistance(inCats(pois, "bike"), c);

  const parts: string[] = [];

  // Sentence 1: best transit (train > tram > bus)
  if (tog[0]) {
    parts.push(`${clean(tog[0])} ${prox(tog[0], c)}.`);
  } else if (trikk[0]) {
    parts.push(`${clean(trikk[0])} ${prox(trikk[0], c)}.`);
  } else if (buss[0]) {
    const busCount = countWithin(buss, c, 10);
    if (busCount >= 3) {
      parts.push(`${busCount} busstopp innen ti minutters gange.`);
    } else {
      parts.push(`Buss ${prox(buss[0], c)}.`);
    }
  }

  // Sentence 2: alternative transport (bike preferred, bus count as fallback)
  if (sykkel[0]) {
    parts.push(`Bysykkel på ${clean(sykkel[0])} for kortere turer.`);
  } else if (parts.length === 1 && buss.length >= 2) {
    // No bike: mention bus coverage as second sentence
    const busNear = countWithin(buss, c, 10);
    if (busNear >= 3) {
      parts.push(`${busNear} busstopp i gangavstand gir hyppige avganger.`);
    } else if (buss[0] && !tog[0] && !trikk[0]) {
      // Bus was primary — no need to repeat
    } else {
      parts.push(`Buss i tillegg for ruter tog ikke dekker.`);
    }
  }

  return parts.join(" ");
}

// ============================================================
// Registry
// ============================================================

const GENERATORS: Record<string, Gen> = {
  "barn-oppvekst": barnOppvekst,
  "hverdagsliv": hverdagsliv,
  "mat-drikke": matDrikke,
  "opplevelser": opplevelser,
  "natur-friluftsliv": naturFriluftsliv,
  "trening-aktivitet": treningAktivitet,
  transport,
};
