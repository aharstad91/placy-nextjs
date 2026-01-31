"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

interface CategoryPopupProps {
  packageName: string;
  categories: Category[];
  activeCategories: Set<string>;
  onToggleCategory: (categoryId: string) => void;
  onClose: () => void;
}

export default function CategoryPopup({
  packageName,
  categories,
  activeCategories,
  onToggleCategory,
  onClose,
}: CategoryPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  return (
    <div
      ref={ref}
      className="absolute left-[60px] top-0 ml-2 bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[200px] z-50 animate-in fade-in zoom-in-95 duration-150"
    >
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
        {packageName}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          const isActive = activeCategories.has(cat.id);

          return (
            <button
              key={cat.id}
              onClick={() => onToggleCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                isActive
                  ? "text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
              style={isActive ? { backgroundColor: cat.color } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
