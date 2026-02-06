/**
 * Shared theme definitions used by both Report and Explorer products.
 *
 * Report extends this with intro/bridgeText via ReportThemeConfig.
 * Explorer uses it directly for theme chips and POI filtering.
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  categories: string[]; // "categories" for Report backward compatibility
  color?: string; // Tailwind-friendly hex for chip styling
}
