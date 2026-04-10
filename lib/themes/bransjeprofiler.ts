import type { ThemeDefinition } from "./theme-definitions";
import { DEFAULT_THEMES } from "./default-themes";

/**
 * Bransjeprofil — industry profile that determines themes, categories,
 * explorer caps, and default settings for a project.
 *
 * Connected via project's bransje-tag (single-select).
 *
 * Override priority (highest to lowest):
 * 1. project.reportConfig.themes — project-specific override
 * 2. bransjeprofil.themes — tag-driven
 * 3. DEFAULT_THEMES — global fallback
 */
/**
 * Feature flags for bransjeprofil-driven UI behavior.
 * Only runtime/UI features — not admin or pipeline concerns.
 */
export interface BransjeprofilFeatures {
  dayFilter?: boolean;
  agendaView?: boolean;
  eventUrl?: boolean;
  kompass?: boolean;
  profilFilter?: boolean;
}

export interface Bransjeprofil {
  tag: string;
  themes: ThemeDefinition[];
  defaults: {
    radius: number;
    minRating: number;
    venueType: "hotel" | "residential" | "commercial";
  };
  explorerCaps: Record<string, number>;
  explorerTotalCap: number;
  features?: BransjeprofilFeatures;
}

/**
 * Eiendom - Bolig: 7 temaer basert på meglerens vanligste spørsmål fra boligkjøpere.
 * Se docs/solutions/architecture-patterns/bransjeprofil-eiendom-bolig-20260303.md
 */
const BOLIG_THEMES: ThemeDefinition[] = [
  {
    id: "barn-oppvekst",
    name: "Barn & Aktivitet",
    icon: "GraduationCap",
    categories: ["skole", "barnehage", "lekeplass", "idrett"],
    color: "#f59e0b",
  },
  {
    id: "hverdagsliv",
    name: "Hverdagsliv",
    icon: "ShoppingCart",
    categories: [
      "supermarket",
      "pharmacy",
      "convenience",
      "doctor",
      "dentist",
      "hospital",
      "haircare",
      "bank",
      "post_office",
    ],
    color: "#22c55e",
  },
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    color: "#ef4444",
  },
  {
    id: "opplevelser",
    name: "Opplevelser",
    icon: "Landmark",
    categories: ["museum", "library", "cinema", "bowling", "amusement", "theatre"],
    color: "#0ea5e9",
  },
  {
    id: "natur-friluftsliv",
    name: "Natur & Friluftsliv",
    icon: "Trees",
    categories: ["park", "outdoor", "badeplass"],
    color: "#10b981",
  },
  {
    id: "trening-aktivitet",
    name: "Trening & Aktivitet",
    icon: "Dumbbell",
    categories: ["gym", "swimming", "spa", "fitness_park"],
    color: "#ec4899",
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
    color: "#3b82f6",
  },
];

/**
 * Eiendom - Næring: 5 temaer for bedriftseiere og kontorsjefer.
 * Se docs/solutions/architecture-patterns/bransjeprofil-eiendom-naering-20260303.md
 */
const NAERING_THEMES: ThemeDefinition[] = [
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    color: "#ef4444",
  },
  {
    id: "transport",
    name: "Transport & Mobilitet",
    icon: "Bus",
    categories: [
      "bus",
      "tram",
      "train",
      "parking",
      "carshare",
      "bike",
      "scooter",
      "charging_station",
      "airport_bus",
    ],
    color: "#3b82f6",
  },
  {
    id: "trening-aktivitet",
    name: "Trening & Aktivitet",
    icon: "Dumbbell",
    categories: ["gym", "swimming", "fitness_park"],
    color: "#ec4899",
  },
  {
    id: "hverdagstjenester",
    name: "Hverdagstjenester",
    icon: "ShoppingCart",
    categories: ["supermarket", "pharmacy", "haircare"],
    color: "#22c55e",
  },
  {
    id: "nabolaget",
    name: "Nabolaget",
    icon: "MapPin",
    categories: ["park", "outdoor", "hotel", "conference", "museum", "cinema", "library"],
    color: "#8b5cf6",
  },
];

/**
 * All bransjeprofiler indexed by tag name.
 */
export const BRANSJEPROFILER: Record<string, Bransjeprofil> = {
  "Eiendom - Bolig": {
    tag: "Eiendom - Bolig",
    themes: BOLIG_THEMES,
    defaults: {
      radius: 2000,
      minRating: 0,
      venueType: "residential",
    },
    explorerCaps: {
      "barn-oppvekst": 20,
      "hverdagsliv": 25,
      "mat-drikke": 60,
      "opplevelser": 15,
      "natur-friluftsliv": 15,
      "trening-aktivitet": 15,
      "transport": 20,
    },
    explorerTotalCap: 120,
    features: {
      profilFilter: true,
    },
  },
  "Eiendom - Næring": {
    tag: "Eiendom - Næring",
    themes: NAERING_THEMES,
    defaults: {
      radius: 1500,
      minRating: 0,
      venueType: "commercial",
    },
    explorerCaps: {
      "mat-drikke": 60,
      "transport": 25,
      "trening-aktivitet": 15,
      "hverdagstjenester": 15,
      "nabolaget": 20,
    },
    explorerTotalCap: 100,
  },
  /**
   * Event: Festivaler, åpne hus, kulturnetter, kunsthelger.
   * Themes auto-genereres fra import-kategorier (Kulturnatt-mønsteret).
   * Høy total cap — event-data er kuratert, ikke scraped.
   */
  "Event": {
    tag: "Event",
    themes: [],
    defaults: {
      radius: 5000,
      minRating: 0,
      venueType: "commercial",
    },
    explorerCaps: {},
    explorerTotalCap: 999,
    features: {
      dayFilter: true,
      agendaView: true,
      eventUrl: true,
      kompass: true,
    },
  },
};

/**
 * Alias mapping for backward-compatible URL theme IDs.
 * Old theme IDs from DEFAULT_THEMES → new bransjeprofil theme IDs.
 */
export const THEME_ID_ALIASES: Record<string, string> = {
  "kultur-opplevelser": "opplevelser",
  "barnefamilier": "barn-oppvekst",
  "hverdagsbehov": "hverdagsliv",
  "trening-velvare": "trening-aktivitet",
};

/**
 * Resolve a theme ID, applying aliases for backward compatibility.
 */
export function resolveThemeId(themeId: string): string {
  return THEME_ID_ALIASES[themeId] ?? themeId;
}

/**
 * Get the bransjeprofil for a project based on its tags.
 * Returns the matching profile, or a fallback profile using DEFAULT_THEMES.
 */
export function getBransjeprofil(tags?: string[]): Bransjeprofil {
  const tag = tags?.[0];
  if (tag && BRANSJEPROFILER[tag]) {
    return BRANSJEPROFILER[tag];
  }

  // Fallback: use DEFAULT_THEMES (existing 6 themes)
  return {
    tag: "",
    themes: DEFAULT_THEMES,
    defaults: {
      radius: 2000,
      minRating: 0,
      venueType: "residential",
    },
    explorerCaps: {
      "mat-drikke": 60,
      "kultur-opplevelser": 15,
      "barnefamilier": 15,
      "transport": 20,
      "trening-velvare": 15,
      "hverdagsbehov": 20,
    },
    explorerTotalCap: 300,
  };
}

/**
 * Build a category → theme ID lookup from a set of themes.
 * Replaces the static CATEGORY_TO_THEME global.
 */
export function buildCategoryToTheme(themes: ThemeDefinition[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const theme of themes) {
    for (const cat of theme.categories) {
      map[cat] = theme.id;
    }
  }
  return map;
}
