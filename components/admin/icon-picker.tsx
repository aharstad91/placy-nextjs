"use client";

import { useState, useMemo } from "react";
import {
  Utensils,
  Coffee,
  Wine,
  ShoppingCart,
  Dumbbell,
  Pill,
  Bus,
  Train,
  Bike,
  Car,
  Building,
  MapPin,
  Home,
  School,
  Hospital,
  Church,
  Library,
  Music,
  Film,
  Theater,
  Palette,
  Camera,
  ShoppingBag,
  Briefcase,
  Landmark,
  TreePine,
  Mountain,
  Waves,
  Sun,
  Moon,
  Star,
  Heart,
  Zap,
  Wifi,
  Phone,
  Mail,
  Globe,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";

// Predefined icon list for categories
const ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "Utensils", icon: Utensils },
  { name: "Coffee", icon: Coffee },
  { name: "Wine", icon: Wine },
  { name: "ShoppingCart", icon: ShoppingCart },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Pill", icon: Pill },
  { name: "Bus", icon: Bus },
  { name: "Train", icon: Train },
  { name: "Bike", icon: Bike },
  { name: "Car", icon: Car },
  { name: "Building", icon: Building },
  { name: "MapPin", icon: MapPin },
  { name: "Home", icon: Home },
  { name: "School", icon: School },
  { name: "Hospital", icon: Hospital },
  { name: "Church", icon: Church },
  { name: "Library", icon: Library },
  { name: "Music", icon: Music },
  { name: "Film", icon: Film },
  { name: "Theater", icon: Theater },
  { name: "Palette", icon: Palette },
  { name: "Camera", icon: Camera },
  { name: "Briefcase", icon: Briefcase },
  { name: "Landmark", icon: Landmark },
  { name: "TreePine", icon: TreePine },
  { name: "Mountain", icon: Mountain },
  { name: "Waves", icon: Waves },
  { name: "Sun", icon: Sun },
  { name: "Moon", icon: Moon },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Wifi", icon: Wifi },
  { name: "Phone", icon: Phone },
  { name: "Mail", icon: Mail },
  { name: "Globe", icon: Globe },
];

// Export icon map for use in other components
export const ICON_MAP: Record<string, LucideIcon> = ICONS.reduce(
  (acc, { name, icon }) => {
    acc[name] = icon;
    return acc;
  },
  {} as Record<string, LucideIcon>
);

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) return ICONS;
    const query = searchQuery.toLowerCase();
    return ICONS.filter((item) => item.name.toLowerCase().includes(query));
  }, [searchQuery]);

  const SelectedIcon = ICON_MAP[value] || MapPin;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all flex items-center gap-3"
      >
        <div className="p-1.5 bg-gray-100 rounded-lg">
          <SelectedIcon className="w-4 h-4 text-gray-600" />
        </div>
        <span className="text-gray-700">{value || "Velg ikon"}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-30 p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter ikon..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
            {filteredIcons.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className={`p-2.5 rounded-lg flex items-center justify-center transition-all ${
                  value === name
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title={name}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Ingen ikoner funnet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
