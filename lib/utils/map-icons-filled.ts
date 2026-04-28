import {
  Baby,
  Bank,
  Barbell,
  Bicycle,
  BookOpen,
  Bread,
  Buildings,
  Bus,
  Car,
  Coffee,
  Cube,
  Dog,
  Envelope,
  FilmStrip,
  ForkKnife,
  GraduationCap,
  Hospital,
  House,
  Lightning,
  MapPin,
  Medal,
  Pill,
  Airplane,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Sparkle,
  Star,
  Stethoscope,
  Tooth,
  Train,
  Tram,
  Tree,
  Trophy,
  Waves,
  Wine,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

/**
 * Map of Lucide-style category icon names to Phosphor equivalents.
 *
 * Phosphor is used here because Lucide icons are stroke-only — they have no
 * filled variants. Phosphor exposes `weight="fill"` which gives solid icons
 * suitable for the rapport map markers, where the category color is carried
 * by the icon fill itself rather than by a saturated background disc.
 *
 * Keys mirror lib/utils/map-icons.ts exactly. Some Phosphor names differ
 * (Bicycle vs Bike, Bread vs Croissant, Buildings vs Building2, Bank vs
 * Landmark, House vs Home, Envelope vs Mail, ForkKnife vs UtensilsCrossed,
 * Lightning vs Zap, Medal vs Award, Tooth vs Smile-for-dentist,
 * FilmStrip vs Film, Barbell vs Dumbbell, Tree vs TreePine, Sparkle vs
 * Sparkles, Airplane vs Plane, Train vs TrainFront).
 *
 * Phosphor has no parking icon and no front-facing car variant — both fall
 * back to Car. Phosphor has no dentist-smile — Tooth is closer to the actual
 * concept than Lucide's Smile anyway.
 */
const FILLED_ICON_MAP: Record<string, PhosphorIcon> = {
  Award: Medal,
  Baby,
  Bike: Bicycle,
  Blocks: Cube,
  BookOpen,
  Building2: Buildings,
  Bus,
  Car,
  CarFront: Car,
  Coffee,
  Croissant: Bread,
  Dog,
  Dumbbell: Barbell,
  Film: FilmStrip,
  GraduationCap,
  Home: House,
  Hospital,
  Landmark: Bank,
  Mail: Envelope,
  MapPin,
  ParkingCircle: Car,
  Pill,
  Plane: Airplane,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Smile: Tooth,
  Sparkles: Sparkle,
  Star,
  Stethoscope,
  TrainFront: Train,
  Tram,
  TramFront: Tram,
  TreePine: Tree,
  Trophy,
  UtensilsCrossed: ForkKnife,
  Waves,
  Wine,
  Zap: Lightning,
};

/**
 * Resolve a Lucide-style icon name to a Phosphor icon component.
 * Caller is responsible for passing weight="fill" (or another weight) when
 * rendering. Falls back to MapPin for unknown names.
 */
export function getFilledIcon(iconName: string): PhosphorIcon {
  return FILLED_ICON_MAP[iconName] ?? MapPin;
}
