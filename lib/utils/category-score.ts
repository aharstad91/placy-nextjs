// Category score calculation and quote generation for Report
// Based on Walk Score methodology with weighted factors

// Named constants (no magic numbers)
const SCORE_WEIGHTS = {
  count: 0.30,
  rating: 0.25,
  proximity: 0.25,
  variety: 0.20,
} as const;

const THRESHOLDS = {
  maxPOIsForFullScore: 10,
  maxWalkTimeMinutes: 15,
  maxCategoriesForVariety: 5,
} as const;

const DEFAULT_SCORE_WHEN_NO_DATA = 50;

// Individual score functions (testable)
export function normalizeCount(totalPOIs: number): number {
  return Math.min(100, (totalPOIs / THRESHOLDS.maxPOIsForFullScore) * 100);
}

export function normalizeRating(avgRating: number | null): number {
  return avgRating !== null ? (avgRating / 5) * 100 : DEFAULT_SCORE_WHEN_NO_DATA;
}

export function normalizeProximity(avgWalkMinutes: number | null): number {
  if (avgWalkMinutes === null) return DEFAULT_SCORE_WHEN_NO_DATA;
  return Math.max(0, 100 - (avgWalkMinutes / THRESHOLDS.maxWalkTimeMinutes) * 100);
}

export function normalizeVariety(uniqueCategories: number): number {
  const adjusted = Math.max(0, uniqueCategories - 1);
  return Math.min(100, (adjusted / (THRESHOLDS.maxCategoriesForVariety - 1)) * 100);
}

// Main function (composition)
export interface CategoryScoreInput {
  totalPOIs: number;
  avgRating: number | null;
  avgWalkTimeMinutes: number | null;
  uniqueCategories: number;
}

export interface CategoryScoreBreakdown {
  readonly count: number;
  readonly rating: number;
  readonly proximity: number;
  readonly variety: number;
}

export interface CategoryScore {
  readonly total: number;
  readonly breakdown: CategoryScoreBreakdown;
}

export function calculateCategoryScore(input: CategoryScoreInput): CategoryScore {
  const breakdown: CategoryScoreBreakdown = {
    count: Math.round(normalizeCount(input.totalPOIs)),
    rating: Math.round(normalizeRating(input.avgRating)),
    proximity: Math.round(normalizeProximity(input.avgWalkTimeMinutes)),
    variety: Math.round(normalizeVariety(input.uniqueCategories)),
  };

  const total = Math.round(
    breakdown.count * SCORE_WEIGHTS.count +
    breakdown.rating * SCORE_WEIGHTS.rating +
    breakdown.proximity * SCORE_WEIGHTS.proximity +
    breakdown.variety * SCORE_WEIGHTS.variety
  );

  return { total, breakdown };
}

// Quote generation
const QUOTE_LEVELS = ["exceptional", "very_good", "good", "sufficient", "limited"] as const;
type QuoteLevel = typeof QUOTE_LEVELS[number];

// Default fallbacks for any theme
const DEFAULT_TEMPLATES: Record<QuoteLevel, string> = {
  exceptional: "Eksepsjonelt tilbud i området",
  very_good: "Svært godt tilbud i området",
  good: "Godt tilbud i området",
  sufficient: "Tilstrekkelig tilbud i området",
  limited: "Begrenset tilbud i umiddelbar nærhet",
};

// Theme IDs (e.g. "mat-drikke") and sub-category IDs (e.g. "restaurant") share
// the same key-space. generateCategoryQuote() resolves the correct template by
// looking up the provided key — callers pass theme ID at theme level and
// category ID at sub-section level.
const QUOTE_TEMPLATES: Record<string, Record<QuoteLevel, string[]>> = {
  // === Theme-level quotes (keyed by theme ID) ===
  "mat-drikke": {
    exceptional: [
      "Matmekka med alt fra gatemat til fine dining",
      "Et område som bugner av matopplevelser",
    ],
    very_good: [
      "Rikt utvalg av mat og drikke i gangavstand",
      "Solid matscene med varierte muligheter",
    ],
    good: ["Godt utvalg av spisesteder i nærområdet"],
    sufficient: ["Noen utvalgte spisesteder i nærheten"],
    limited: ["Begrenset mattilbud i umiddelbar nærhet"],
  },
  transport: {
    exceptional: [
      "Knutepunkt med alle transportformer",
      "Svært godt tilknyttet kollektivnettet",
    ],
    very_good: [
      "Svært godt utvalg av transportmuligheter",
      "Enkel tilgang til buss, trikk og sykkel",
    ],
    good: ["God kollektivdekning i gangavstand"],
    sufficient: ["Tilgang til kollektivtransport"],
    limited: ["Begrenset kollektivtilbud i umiddelbar nærhet"],
  },
  hverdagsbehov: {
    exceptional: [
      "Alt av tjenester og handel i gangavstand",
      "Komplett tilbud for hverdagens behov",
    ],
    very_good: [
      "Bredt utvalg av butikker og tjenester",
      "Gode handlemuligheter rett utenfor døren",
    ],
    good: ["Godt utvalg av dagligvare og tjenester"],
    sufficient: ["Noen butikker og tjenester i nærområdet"],
    limited: ["Begrenset tilbud i umiddelbar nærhet"],
  },
  "kultur-opplevelser": {
    exceptional: [
      "Kulturelt sentrum med rikt tilbud",
      "Kunst, kultur og opplevelser i overflod",
    ],
    very_good: [
      "Variert kulturtilbud i gangavstand",
      "Rik tilgang på kulturopplevelser",
    ],
    good: ["Godt utvalg av kulturaktiviteter"],
    sufficient: ["Noen kulturelle tilbud i nærheten"],
    limited: ["Begrenset kulturtilbud i umiddelbar nærhet"],
  },
  "trening-velvare": {
    exceptional: [
      "Treningsparadis med varierte muligheter",
      "Alt for den aktive livsstilen",
    ],
    very_good: [
      "Svært godt utvalg for trening og helse",
      "Gode muligheter for en aktiv hverdag",
    ],
    good: ["Godt utvalg av treningsmuligheter"],
    sufficient: ["Noen treningsfasiliteter i nærheten"],
    limited: ["Begrenset treningstilbud i umiddelbar nærhet"],
  },

  // === Sub-category-level quotes (keyed by category ID) ===
  restaurant: {
    exceptional: [
      "Matmekka — mangfoldig restaurantscene",
      "Restaurantutvalg i toppklasse",
    ],
    very_good: [
      "Rikt restaurantutvalg i gangavstand",
      "Solid restaurantscene med varierte kjøkken",
    ],
    good: ["Godt utvalg av restauranter"],
    sufficient: ["Noen restauranter i nærheten"],
    limited: ["Begrenset restauranttilbud"],
  },
  cafe: {
    exceptional: [
      "Kafé-paradis med noe for enhver smak",
      "Rikholdig kafékultur i nabolaget",
    ],
    very_good: [
      "Bredt utvalg av kaféer i gangavstand",
      "Levende kaféscene rett utenfor døren",
    ],
    good: ["Godt utvalg av kaféer"],
    sufficient: ["Noen kaféer i nærheten"],
    limited: ["Begrenset kafétilbud"],
  },
  bar: {
    exceptional: [
      "Livlig uteliv med varierte barer",
      "Sentrum for byens barliv",
    ],
    very_good: [
      "Godt utvalg av barer og utesteder",
      "Aktiv barscene i gangavstand",
    ],
    good: ["Hyggelige barer i nærområdet"],
    sufficient: ["Noen barer i nærheten"],
    limited: ["Begrenset bartilbud"],
  },
  bakery: {
    exceptional: ["Bakerimekka med ferske brød og kaker"],
    very_good: ["Godt utvalg av bakerier"],
    good: ["Noen fine bakerier i nærheten"],
    sufficient: ["Et bakeri i nærheten"],
    limited: ["Begrenset bakeritilbud"],
  },
  supermarket: {
    exceptional: ["Komplett dagligvaretilbud i gangavstand"],
    very_good: ["Flere dagligvarebutikker rett i nærheten"],
    good: ["Godt utvalg av dagligvare"],
    sufficient: ["Dagligvare tilgjengelig i nærheten"],
    limited: ["Begrenset dagligvaretilbud"],
  },
  shopping: {
    exceptional: [
      "Handlemekka med alt du trenger",
      "Rikt utvalg av butikker og kjøpesentre",
    ],
    very_good: [
      "Bredt utvalg av butikker i gangavstand",
      "Gode shoppingmuligheter",
    ],
    good: ["Godt utvalg av butikker"],
    sufficient: ["Noen butikker i nærområdet"],
    limited: ["Begrenset shoppingtilbud"],
  },
  bus: {
    exceptional: ["Knutepunkt med hyppige avganger"],
    very_good: ["Svært god bussdekning i gangavstand"],
    good: ["God busstilgang"],
    sufficient: ["Busstopp i nærheten"],
    limited: ["Begrenset busstilbud"],
  },
};

function getQuoteLevel(score: number): QuoteLevel {
  if (score >= 90) return "exceptional";
  if (score >= 75) return "very_good";
  if (score >= 60) return "good";
  if (score >= 40) return "sufficient";
  return "limited";
}

// Seeded random for consistency
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function generateCategoryQuote(
  themeId: string,
  score: number,
  variety: number,
  seed?: string
): string {
  const level = getQuoteLevel(score);
  const templates = QUOTE_TEMPLATES[themeId]?.[level];

  if (!templates || templates.length === 0) {
    return DEFAULT_TEMPLATES[level];
  }

  // Select based on variety or seed
  const index = seed
    ? Math.abs(hashCode(seed)) % templates.length
    : variety > 3 ? 0 : Math.min(1, templates.length - 1);

  return templates[index];
}
