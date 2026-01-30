export interface CategoryPackage {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  categoryIds: string[];
}

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
