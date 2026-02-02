import type { Project } from "@/lib/types";

export interface ReportThemeDefinition {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  intro?: string;
}

export const REPORT_THEMES: ReportThemeDefinition[] = [
  {
    id: "mat-drikke",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categories: ["restaurant", "cafe"],
  },
  {
    id: "transport",
    name: "Transport & Mobilitet",
    icon: "Bus",
    categories: ["bus", "train", "bike", "parking", "carshare", "taxi", "airport"],
  },
  {
    id: "daglig",
    name: "Daglig & Praktisk",
    icon: "ShoppingCart",
    categories: ["supermarket"],
  },
  {
    id: "aktivitet",
    name: "Aktivitet & Fritid",
    icon: "Dumbbell",
    categories: ["gym", "outdoor"],
  },
];

export function getReportThemes(project: Project): ReportThemeDefinition[] {
  if (project.reportConfig?.themes) {
    return project.reportConfig.themes;
  }
  return REPORT_THEMES;
}
