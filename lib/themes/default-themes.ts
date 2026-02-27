import type { ThemeDefinition } from "./theme-definitions";

/**
 * Default themes shared between Report and Explorer.
 *
 * Every POI category used in the system must map to exactly one theme.
 * See ALL_CATEGORIES_BY_THEME for the full mapping.
 */
export const DEFAULT_THEMES: ThemeDefinition[] = [
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
    color: "#ef4444",
  },
  {
    id: "kultur-opplevelser",
    name: "Kultur & Opplevelser",
    icon: "Landmark",
    categories: ["museum", "library", "cinema", "park", "outdoor", "badeplass"],
    color: "#0ea5e9",
  },
  {
    id: "barnefamilier",
    name: "Barn & Oppvekst",
    icon: "GraduationCap",
    categories: ["skole", "barnehage", "lekeplass", "idrett"],
    color: "#f59e0b",
  },
  {
    id: "hverdagsbehov",
    name: "Hverdagsbehov",
    icon: "ShoppingCart",
    categories: [
      "supermarket",
      "pharmacy",
      "shopping",
      "haircare",
      "bank",
      "post_office",
      "convenience",
      "hospital",
      "doctor",
      "dentist",
    ],
    color: "#22c55e",
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
      "airport",
      "ferry",
    ],
    color: "#3b82f6",
  },
  {
    id: "trening-velvare",
    name: "Trening & Velvære",
    icon: "Dumbbell",
    categories: ["gym", "spa", "swimming"],
    color: "#ec4899",
  },
];

/**
 * Lookup: category → theme ID.
 * Built from DEFAULT_THEMES so every category resolves to a theme.
 */
export const CATEGORY_TO_THEME: Record<string, string> = {};
for (const theme of DEFAULT_THEMES) {
  for (const cat of theme.categories) {
    CATEGORY_TO_THEME[cat] = theme.id;
  }
}

/**
 * Get the theme a category belongs to.
 * Returns "hverdagsbehov" as fallback for unknown categories.
 */
export function getThemeForCategory(categoryId: string): string {
  return CATEGORY_TO_THEME[categoryId] ?? "hverdagsbehov";
}
