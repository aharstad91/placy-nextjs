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
