import type { Project } from "@/lib/types";

export interface ReportThemeDefinition {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  intro?: string;
  bridgeText?: string;
}

/**
 * Default report themes optimized for city hotel guests.
 * Order: what a guest cares about most first.
 */
export const REPORT_THEMES: ReportThemeDefinition[] = [
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe", "bar", "bakery"],
  },
  {
    id: "kultur-opplevelser",
    name: "Kultur & Opplevelser",
    icon: "Landmark",
    categories: ["museum", "library", "cinema", "park"],
  },
  {
    id: "hverdagsbehov",
    name: "Hverdagsbehov",
    icon: "ShoppingCart",
    categories: ["supermarket", "pharmacy", "shopping", "haircare"],
  },
  {
    id: "transport",
    name: "Transport & Mobilitet",
    icon: "Bus",
    categories: ["bus", "train", "tram", "bike", "parking", "carshare", "taxi", "airport"],
  },
  {
    id: "trening-velvare",
    name: "Trening & Velvære",
    icon: "Dumbbell",
    categories: ["gym", "spa"],
  },
];

export function getReportThemes(project: Project): ReportThemeDefinition[] {
  if (project.reportConfig?.themes) {
    return project.reportConfig.themes;
  }
  return REPORT_THEMES;
}
