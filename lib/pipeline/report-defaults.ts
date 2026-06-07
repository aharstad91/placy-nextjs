/**
 * Statiske default-tekster og tema-definisjoner for basic-tier rapport-board.
 * Samme tekst for alle prosjekter — kan overskrives per prosjekt i Supabase
 * uten at re-kjøring av pipelinen clobbrer overstyringen (merge-semantikk).
 */

export interface ReportThemeDefault {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  color: string;
  leadText: string;
}

export const REPORT_THEME_DEFAULTS: ReportThemeDefault[] = [
  {
    id: "hverdagsliv",
    name: "Hverdagsliv",
    icon: "ShoppingCart",
    categories: [
      "shopping",
      "supermarket",
      "pharmacy",
      "convenience",
      "liquor_store",
      "doctor",
      "dentist",
      "hospital",
      "haircare",
      "bank",
      "post",
    ],
    color: "#36d16f",
    leadText: "Dagligvarer, apotek og hverdagstjenester i nærheten.",
  },
  {
    id: "barn-oppvekst",
    name: "Barn & Oppvekst",
    icon: "GraduationCap",
    categories: ["skole", "barnehage", "lekeplass", "idrett"],
    color: "#f8ae17",
    leadText: "Skoler, barnehager og lekeplasser for familier med barn.",
  },
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    color: "#f35a5a",
    leadText: "Restauranter, kaféer og spisesteder i nærområdet.",
  },
  {
    id: "natur-friluftsliv",
    name: "Natur & Friluftsliv",
    icon: "Trees",
    categories: ["park", "outdoor", "badeplass"],
    color: "#22c68d",
    leadText: "Parker, friluftsområder og badeplasser i nærheten.",
  },
  {
    id: "transport",
    name: "Transport & Mobilitet",
    icon: "Bus",
    categories: [
      "bus",
      "train",
      "tram",
      "bike",
      "parking",
      "carshare",
      "taxi",
      "charging_station",
    ],
    color: "#4d93f8",
    leadText: "Kollektivtransport, sykkel og parkeringsmuligheter.",
  },
  {
    id: "trening-aktivitet",
    name: "Trening & Aktivitet",
    icon: "Dumbbell",
    categories: ["gym", "swimming", "spa", "fitness_park"],
    color: "#f05da7",
    leadText: "Treningssentre, svømmehaller og aktivitetstilbud.",
  },
];

/**
 * Per-by discovery radius for Google Places og offentlige POI-kildar.
 * Fallback er suburban (2500 m) — der vi ikke vet by er dette trygt.
 */
export const REPORT_DISCOVERY_RADIUS: Record<string, number> = {
  oslo: 1500,
  bergen: 1800,
  trondheim: 2000,
  stavanger: 2000,
  default: 2500,
};

export function getDiscoveryRadius(city: string | undefined): number {
  if (!city) return REPORT_DISCOVERY_RADIUS.default;
  const key = city.toLowerCase();
  return REPORT_DISCOVERY_RADIUS[key] ?? REPORT_DISCOVERY_RADIUS.default;
}
