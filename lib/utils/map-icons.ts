import {
  Award, Baby, Bike, Blocks, BookOpen, Building2, Bus, Car, CarFront, CarTaxiFront,
  Church, Coffee, Croissant, Disc, Dog, Drama, Dumbbell, Film, GraduationCap, Home, Hospital,
  Landmark, Mail, MapPin, ParkingCircle, Pill, Plane, Scissors,
  ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope, Ticket,
  TrainFront, TramFront, TreePine, Trophy, UtensilsCrossed, Waves, Wine,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Award, Baby, Bike, Blocks, BookOpen, Building2, Bus, Car, CarFront, CarTaxiFront,
  Church, Coffee, Croissant, Disc, Dog, Drama, Dumbbell, Film, GraduationCap, Home, Hospital,
  Landmark, Mail, MapPin, ParkingCircle, Pill, Plane, Scissors,
  ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope, Ticket,
  TrainFront, Tram: TramFront, TreePine, Trophy, UtensilsCrossed, Waves, Wine, Zap,
};

/**
 * Resolve a Lucide icon name to its component.
 * Falls back to MapPin for unknown names.
 */
export function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? MapPin;
}
