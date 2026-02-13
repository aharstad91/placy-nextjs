import {
  Award, Baby, Bike, Blocks, BookOpen, Building2, Bus, Car,
  Coffee, Croissant, Dog, Dumbbell, Film, Home, Hospital,
  Landmark, Mail, MapPin, ParkingCircle, Pill, Plane, Scissors,
  ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope,
  TrainFront, TramFront, TreePine, Trophy, UtensilsCrossed, Waves, Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Award, Baby, Bike, Blocks, BookOpen, Building2, Bus, Car,
  Coffee, Croissant, Dog, Dumbbell, Film, Home, Hospital,
  Landmark, Mail, MapPin, ParkingCircle, Pill, Plane, Scissors,
  ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope,
  TrainFront, Tram: TramFront, TreePine, Trophy, UtensilsCrossed, Waves, Wine,
};

/**
 * Resolve a Lucide icon name to its component.
 * Falls back to MapPin for unknown names.
 */
export function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? MapPin;
}
