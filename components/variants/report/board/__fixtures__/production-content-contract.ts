import type { POI } from "@/lib/types";
import type { ReportData, ReportTheme } from "../../report-data";

export const PRODUCTION_CONTRACT_IDS = {
  audited: "contract-audited-place",
  register: "contract-register-place",
  approximate: "contract-approximate-place",
  planned: "contract-planned-place",
  topicOnly: "contract-topic-only",
  empty: "contract-empty",
} as const;

function poi(id: string, overrides: Partial<POI> = {}): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 63.44, lng: 10.46 },
    category: {
      id: "contract-place",
      name: "Kontraktsted",
      icon: "MapPin",
      color: "#2563eb",
    },
    ...overrides,
  };
}

function theme(
  id: string,
  pois: POI[],
  overrides: Partial<ReportTheme> = {},
): ReportTheme {
  return {
    id,
    name: id,
    icon: "MapPin",
    color: "#2563eb",
    intro: `${id} intro`,
    upperNarrative: `${id} body`,
    pois,
    allPOIs: pois,
    topRanked: pois,
    hiddenPOIs: [],
    richnessScore: 50,
    score: {
      total: 50,
      breakdown: { count: 50, rating: 50, proximity: 50, variety: 50 },
    },
    quote: "",
    stats: {
      totalPOIs: pois.length,
      ratedPOIs: 0,
      avgRating: null,
      totalReviews: 0,
      editorialCount: 0,
      uniqueCategories: pois.length > 0 ? 1 : 0,
    },
    ...overrides,
  };
}

/**
 * Characterization fixture for the ordinary production board before the
 * research ledger is connected. It deliberately includes every semantic
 * boundary the migration must preserve.
 */
export function productionContentContractFixture(): ReportData {
  const audited = poi(PRODUCTION_CONTRACT_IDS.audited, {
    name: "Revidert sted",
    editorialHook: "Godkjent redaksjonell påstand.",
    editorialSources: ["https://example.com/audited"],
  });
  const register = poi(PRODUCTION_CONTRACT_IDS.register, {
    name: "Registersted",
  });
  const approximate = poi(PRODUCTION_CONTRACT_IDS.approximate, {
    name: "Omtrentlig punkt",
    coordinates: { lat: 63.441, lng: 10.461 },
    locationPrecision: "approximate",
    locationNote: "Plasseringen er ikke verifisert mot besøksinngangen.",
  });
  const planned = poi(PRODUCTION_CONTRACT_IDS.planned, {
    name: "Planlagt tilbud",
    coordinates: { lat: 63.442, lng: 10.462 },
    developmentStatus: "planned",
    development: {
      facts: [{ label: "Status", value: "Regulert" }],
      caveats: ["Byggebeslutning og åpningsdato er ikke dokumentert."],
    },
  });

  return {
    projectId: "project-production-contract",
    projectCustomer: "fixture-customer",
    projectName: "Produksjonskontrakt",
    projectSlug: "produksjonskontrakt",
    address: "Kontraktveien 1",
    district: "Testområdet",
    city: "Trondheim",
    centerCoordinates: { lat: 63.44, lng: 10.46 },
    heroMetrics: {} as ReportData["heroMetrics"],
    themes: [
      theme("steder", [audited, register, approximate, planned]),
      theme(PRODUCTION_CONTRACT_IDS.topicOnly, [], {
        faq: [
          {
            id: "topic-only-contract",
            question: "Hva gjelder for temaet?",
            answer: "Dette er et prosjektfaktum uten kartpunkt.",
            source: "knowledge",
          },
        ],
      }),
      theme(PRODUCTION_CONTRACT_IDS.empty, [], {
        intro: undefined,
        upperNarrative: undefined,
      }),
    ],
    allProjectPOIs: [audited, register, approximate, planned],
  };
}
