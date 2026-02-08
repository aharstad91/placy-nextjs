// NOTE: Wildcard import pulls entire lucide-react into this chunk.
// This is intentional — POI categories use 20+ different icons dynamically
// (Coffee, Croissant, Pill, Film, Bike, etc.) so tree-shaking isn't viable.
// If bundle size becomes an issue, switch to @lucide/lab dynamic imports.
import * as LucideIcons from "lucide-react";

/**
 * Resolve a Lucide icon name to its component.
 * Falls back to MapPin for unknown names.
 */
export function getIcon(iconName: string): LucideIcons.LucideIcon {
  const Icon = (
    LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
  )[iconName];
  return Icon || LucideIcons.MapPin;
}
