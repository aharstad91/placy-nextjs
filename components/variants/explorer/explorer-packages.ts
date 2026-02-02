import type { CategoryPackage } from "@/lib/types";

export type { CategoryPackage };

export const EXPLORER_PACKAGES: CategoryPackage[] = [
  {
    id: "food",
    name: "Mat & Drikke",
    icon: "UtensilsCrossed",
    categoryIds: ["restaurant", "cafe", "supermarket", "bakery", "bar"],
  },
  {
    id: "practical",
    name: "Praktisk",
    icon: "ShoppingBag",
    categoryIds: ["supermarket", "pharmacy", "bank", "post_office", "convenience"],
  },
  {
    id: "transport",
    name: "Transport",
    icon: "Bus",
    categoryIds: ["bus", "train", "tram", "bike", "taxi", "airport", "parking", "carshare", "ferry"],
  },
  {
    id: "active",
    name: "Aktiv",
    icon: "Dumbbell",
    categoryIds: ["gym", "outdoor", "bike", "park", "swimming"],
  },
  {
    id: "all",
    name: "Alt",
    icon: "Globe",
    categoryIds: [], // Special case: activates all categories
  },
];
