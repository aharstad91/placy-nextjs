// NOTE: Wildcard import pulls entire lucide-react into this chunk.
// This is intentional — POI categories use 20+ different icons dynamically
// (Coffee, Croissant, Pill, Film, Bike, etc.) so tree-shaking isn't viable.
// If bundle size becomes an issue, switch to @lucide/lab dynamic imports.
import * as LucideIcons from "lucide-react";

const iconCache = new Map<string, LucideIcons.LucideIcon>();

/**
 * Resolve a Lucide icon name to its component.
 * Falls back to MapPin for unknown names.
 * Results are cached — ~20 unique categories means near-100% hit rate after first render.
 */
export function getIcon(iconName: string): LucideIcons.LucideIcon {
  const cached = iconCache.get(iconName);
  if (cached) return cached;

  const Icon = (
    LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>
  )[iconName];
  const resolved = Icon || LucideIcons.MapPin;
  iconCache.set(iconName, resolved);
  return resolved;
}
