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
 * 1. Complement the hero insight card — never repeat Tier 1 POIs
 * 2. Focus on mood, context, and Tier 2 POIs that give the area character
 * 3. Contrast pairs: nær ↔ fjern, innendørs ↔ utendørs
 * 4. Last sentence = hverdagskonklusjon
 * 5. Never generic — always name actual POIs
 * 6. Two sentences per theme (calibrated to Brøset output)
 */

import type { POI, Coordinates } from "@/lib/types";

// ============================================================
// Public API
// ============================================================

/**
 * Generate S&J-style bridge text for a theme.
 * Returns undefined if insufficient POI data for a meaningful text.
 *
 * @param excludePOIIds - POI IDs already shown in the hero insight card (Tier 1).
 *   The generated text will avoid naming these and focus on Tier 2 POIs instead.
 */
export function generateBridgeText(
  themeId: string,
  pois: POI[],
  center: Coordinates,
  excludePOIIds?: Set<string>,
): string | undefined {
  const gen = GENERATORS[themeId];
  if (!gen || pois.length === 0) return undefined;
  const exclude = excludePOIIds ?? new Set();
  const text = gen(pois, center, exclude);
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

type Gen = (pois: POI[], center: Coordinates, exclude: Set<string>) => string;

/**
 * Barn & Aktivitet
 * Hero insight card shows: skolekrets (barneskole, ungdomsskole, VGS) + barnehage/lekeplass count
 * Text complements: barnevennlighet, trygghet, lekeplasser med navn, organisert idrett
 */
function barnOppvekst(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const lek = byDistance(inCats(pois, "lekeplass"), c).filter((p) => !exclude.has(p.id));
  const idrett = byDistance(inCats(pois, "idrett"), c).filter((p) => !exclude.has(p.id));
  // Secondary schools/barnehager not in the card
  const bhg = byDistance(inCats(pois, "barnehage"), c).filter((p) => !exclude.has(p.id));

  const parts: string[] = [];

  // Sentence 1: barnevennlighet + lekeplass/barnehage character
  if (lek[0] && bhg.length > 2) {
    parts.push(
      `Et trygt og barnevennlig nabolag med ${bhg.length} barnehager i gangavstand og lekeplass ved ${clean(lek[0])}.`,
    );
  } else if (lek[0]) {
    parts.push(
      `Rolige omgivelser der barna kan leke trygt — ${clean(lek[0])} ${prox(lek[0], c)}.`,
    );
  } else if (bhg.length > 2) {
    parts.push(
      `Et barnevennlig område med ${bhg.length} barnehager i nabolaget.`,
    );
  } else {
    parts.push("Et rolig og barnevennlig nabolag.");
  }

  // Sentence 2: organized activity (idrett) — gives character
  if (idrett[0]) {
    parts.push(
      `${clean(idrett[0])} gir rom for organisert aktivitet ${prox(idrett[0], c)}.`,
    );
  }

  return parts.join(" ");
}

/**
 * Hverdagsliv
 * Hero insight card shows: kjøpesenter (anchor) + dagligvare, apotek, lege
 * Text complements: hva som finnes i tillegg til kjøpesenteret, eller dagligvare-bredde uten kjøpesenter
 */
function hverdagsliv(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const tier2 = byDistance(pois.filter((p) => !exclude.has(p.id)), c);

  // Kjøpesenter er i hero (excluded) — bruk det som narrativt knutepunkt
  const kjøpesenter = pois.find((p) => p.category.id === "shopping" && exclude.has(p.id));

  // Sekundære butikker som IKKE er i hero
  const butikker = tier2.filter((p) =>
    ["supermarket", "convenience"].includes(p.category.id),
  );

  const parts: string[] = [];

  if (kjøpesenter) {
    if (butikker.length >= 1) {
      parts.push(
        `I tillegg til ${clean(kjøpesenter)} finnes ${clean(butikker[0])} ${prox(butikker[0], c)} for daglig handel.`,
      );
    } else {
      const walkable = countWithin(pois, c, 15);
      if (walkable >= 5) {
        parts.push(
          `${clean(kjøpesenter)} samler det meste under ett tak — hverdagen ordnes uten bil.`,
        );
      }
    }
  } else if (butikker.length >= 2) {
    parts.push(
      `${clean(butikker[0])} og ${clean(butikker[1])} ${prox(butikker[0], c)} gir godt utvalg i gangavstand.`,
    );
    const walkable = countWithin(pois, c, 15);
    if (walkable >= 5) {
      parts.push("Det meste ordnes uten bil.");
    }
  } else if (butikker[0]) {
    parts.push(`${clean(butikker[0])} ${prox(butikker[0], c)}.`);
  } else {
    const walkable = countWithin(pois, c, 15);
    if (walkable >= 5) {
      parts.push("De viktigste hverdagstjenestene er samlet i gangavstand — alt ordnes uten bil.");
    } else {
      parts.push("De viktigste hverdagstjenestene i nabolaget.");
    }
  }

  return parts.join(" ");
}

/**
 * Mat & Drikke
 * Hero insight card shows: top 3 rated places
 * Text complements: mangfold, karakter, sekundære steder, "morgenkaffe til fredagskveld"
 */
function matDrikke(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  // Tier 2: places NOT in the top-rated card
  const tier2 = pois.filter((p) => !exclude.has(p.id));
  const kafeer = byDistance(inCats(tier2, "cafe", "bakery"), c);
  const restauranter = byDistance(inCats(tier2, "restaurant"), c);
  const barer = byDistance(inCats(tier2, "bar"), c);

  const parts: string[] = [];

  // Sentence 1: secondary places that give character
  const charPoi = kafeer[0] ?? restauranter[0] ?? barer[0];
  if (charPoi && (kafeer.length + restauranter.length + barer.length) >= 2) {
    const second = kafeer[0]?.id !== charPoi.id ? kafeer[0] : (restauranter[0] ?? barer[0]);
    if (second) {
      parts.push(`Fra ${clean(charPoi)} til ${clean(second)} — nabolaget har sitt eget mattilbud.`);
    } else {
      parts.push(`${clean(charPoi)} gir nabolaget karakter.`);
    }
  } else if (charPoi) {
    parts.push(`${clean(charPoi)} ${prox(charPoi, c)}.`);
  }

  // Sentence 2: honest breadth conclusion
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
 * Hero insight card shows: nearest per type (bibliotek, kino, museum, teater)
 * Text complements: what makes the cultural life unique, secondary spots, breadth
 */
function opplevelser(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const tier2 = byDistance(pois.filter((p) => !exclude.has(p.id)), c);

  const parts: string[] = [];

  if (tier2.length >= 2) {
    parts.push(
      `${ogJoin(tier2.slice(0, 2).map(clean))} utvider kulturtilbudet i nabolaget.`,
    );
  } else if (tier2[0]) {
    parts.push(`${clean(tier2[0])} ${prox(tier2[0], c)}.`);
  }

  if (pois.length >= 4) {
    parts.push("Aldri langt til neste opplevelse.");
  } else if (pois.length >= 2) {
    parts.push("Et kulturliv som gir hverdagen farge.");
  }

  return parts.join(" ");
}

/**
 * Natur & Friluftsliv
 * Hero insight card shows: primary nature area + 2 secondary spots
 * Text complements: mood, trails, seasonal character, "marka utenfor døren"
 */
function naturFriluftsliv(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const tier2 = byDistance(pois.filter((p) => !exclude.has(p.id)), c);
  const bade = byDistance(inCats(tier2, "badeplass"), c);

  const parts: string[] = [];

  // Sentence 1: mood + secondary spots
  if (tier2.length >= 2) {
    parts.push(
      `${clean(tier2[0])} og ${clean(tier2[1])} gir grønne drag midt i nabolaget.`,
    );
  } else if (tier2[0]) {
    parts.push(`${clean(tier2[0])} gir grønne rom i nabolaget.`);
  } else {
    // All nature is in the card — focus on mood
    parts.push("Naturen er aldri langt unna — turstier og grøntområder rett utenfor døren.");
  }

  // Sentence 2: badeplass or seasonal element
  if (bade[0] && !exclude.has(bade[0].id)) {
    parts.push(`${clean(bade[0])} gir bademuligheter om sommeren.`);
  }

  return parts.join(" ");
}

/**
 * Trening & Aktivitet
 * Hero insight card shows: nearest gym, pool, fitness park
 * Text complements: variation, outdoor options, secondary gyms, "noe for alle"
 */
function treningAktivitet(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const tier2 = byDistance(pois.filter((p) => !exclude.has(p.id)), c);
  const gyms = inCats(tier2, "gym");
  const fitPark = byDistance(inCats(tier2, "fitness_park"), c);

  const parts: string[] = [];

  // Sentence 1: secondary gyms or variation
  if (gyms.length >= 2) {
    parts.push(
      `${ogJoin(gyms.slice(0, 2).map(clean))} gir alternativer for den som vil variere.`,
    );
  } else if (gyms[0]) {
    parts.push(`${clean(gyms[0])} ${prox(gyms[0], c)} som alternativ.`);
  } else if (tier2.length > 0) {
    parts.push("Varierte treningsmuligheter i gangavstand.");
  } else {
    parts.push("Noe for alle — fra styrketrening til lagsport.");
  }

  // Sentence 2: outdoor contrast
  if (fitPark[0]) {
    parts.push(`${clean(fitPark[0])} for utendørs trening.`);
  }

  return parts.join(" ");
}

/**
 * Transport & Mobilitet
 * Hero insight card shows: nearest bus/tram/train stops
 * Text complements: frequency, flexibility, bike options, secondary routes
 */
function transport(pois: POI[], c: Coordinates, exclude: Set<string>): string {
  const tier2 = pois.filter((p) => !exclude.has(p.id));
  const sykkel = byDistance(inCats(tier2, "bike"), c);
  const extraBuss = byDistance(inCats(tier2, "bus"), c);

  const parts: string[] = [];

  // Sentence 1: bike or secondary bus coverage
  if (sykkel[0]) {
    parts.push(`Bysykkel på ${clean(sykkel[0])} for kortere turer.`);
  } else if (extraBuss.length >= 2) {
    parts.push(`Flere busstopp i nabolaget gir hyppige avganger og fleksibilitet.`);
  } else {
    // All transit is in the card — focus on conclusion
    const busNear = countWithin(inCats(pois, "bus"), c, 10);
    if (busNear >= 3) {
      parts.push(`${busNear} busstopp i gangavstand gir god dekning i alle retninger.`);
    } else {
      parts.push("God kollektivdekning i gangavstand.");
    }
  }

  // Sentence 2: bike if not primary, or parking/carshare
  if (!sykkel[0]) {
    const bike2 = byDistance(inCats(pois, "bike"), c)[0];
    if (bike2) {
      parts.push(`Bysykkel på ${clean(bike2)} for kortere turer.`);
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
