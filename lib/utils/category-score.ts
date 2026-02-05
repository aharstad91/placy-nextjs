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

const QUOTE_TEMPLATES: Record<string, Record<QuoteLevel, string[]>> = {
  food: {
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
  shopping: {
    exceptional: [
      "Handlemekka med alt du trenger",
      "Rikt utvalg av butikker og kjøpesentre",
    ],
    very_good: [
      "Bredt utvalg av butikker i gangavstand",
      "Gode handlemuligheter rett utenfor døren",
    ],
    good: ["Godt utvalg av dagligvare og shopping"],
    sufficient: ["Noen butikker i nærområdet"],
    limited: ["Begrenset handletilbud i umiddelbar nærhet"],
  },
  services: {
    exceptional: [
      "Alt av tjenester i gangavstand",
      "Komplett servicetilbud rett utenfor døren",
    ],
    very_good: [
      "Svært godt utvalg av tjenester",
      "Enkelt å få utført daglige ærender",
    ],
    good: ["Godt utvalg av hverdagstjenester"],
    sufficient: ["Noen tjenester i nærområdet"],
    limited: ["Begrenset servicetilbud i umiddelbar nærhet"],
  },
  fitness: {
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
  culture: {
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
  outdoors: {
    exceptional: [
      "Naturperle med grøntområder og friluftsliv",
      "Unike muligheter for naturopplevelser",
    ],
    very_good: [
      "Rik tilgang på grøntområder og parker",
      "Gode muligheter for friluftsliv",
    ],
    good: ["God tilgang til parker og grøntområder"],
    sufficient: ["Noen grøntområder i nærheten"],
    limited: ["Begrenset tilgang til grøntområder"],
  },
  nightlife: {
    exceptional: [
      "Livlig natteliv med varierte tilbud",
      "Sentrum for byens uteliv",
    ],
    very_good: [
      "Godt utvalg av barer og utesteder",
      "Aktiv utelivsscene i gangavstand",
    ],
    good: ["Hyggelige utesteder i nærområdet"],
    sufficient: ["Noen utesteder i nærheten"],
    limited: ["Begrenset uteliv i umiddelbar nærhet"],
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
