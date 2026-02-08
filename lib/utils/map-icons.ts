import {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

/**
 * Shared icon lookup — resolves category icon names to Lucide components.
 * Replaces 7+ duplicated ICON_MAP constants across Report components.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Bus,
  ShoppingCart,
  Dumbbell,
  Landmark,
  TreePine,
  ShoppingBag,
  Wine,
  Mountain,
  Building2,
};

/**
 * Get a Lucide icon component by name. Falls back to MapPin if not found.
 * Checks the static ICON_MAP first for fast lookup, then falls back to
 * the full lucide-react export for dynamic category icons.
 */
export function getIcon(iconName: string): LucideIcon {
  if (ICON_MAP[iconName]) return ICON_MAP[iconName];
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName];
  return Icon || MapPin;
}
