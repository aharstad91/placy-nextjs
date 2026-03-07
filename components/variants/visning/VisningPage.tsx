"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";

interface VisningPOI {
  id: string;
  name: string;
  categoryColor: string;
  walkMinutes: number | null;
}

interface VisningThemeGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  pois: VisningPOI[];
}

interface VisningPageProps {
  projectName: string;
  address: string;
  themeGroups: VisningThemeGroup[];
  explorerUrl: string;
}

export default function VisningPage({
  projectName,
  address,
  themeGroups,
  explorerUrl,
}: VisningPageProps) {
  // First 3 themes open by default
  const [openThemes, setOpenThemes] = useState<Set<string>>(
    () => new Set(themeGroups.slice(0, 3).map((g) => g.id))
  );

  const toggleTheme = (id: string) => {
    setOpenThemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="max-w-lg mx-auto px-4 pb-12">
      {/* Header */}
      <div className="pt-6 pb-4 text-center">
        <h1 className="text-lg font-bold text-gray-900">{projectName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{address}</p>
      </div>

      {/* Theme groups */}
      <div className="space-y-3">
        {themeGroups.map((group) => {
          const isOpen = openThemes.has(group.id);

          return (
            <div
              key={group.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Theme header */}
              <button
                onClick={() => toggleTheme(group.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {group.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {group.pois.length}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* POI list */}
              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {group.pois.map((poi) => (
                    <div
                      key={poi.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: poi.categoryColor }}
                      />
                      <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                        {poi.name}
                      </span>
                      {poi.walkMinutes != null && (
                        <span className="flex items-center gap-0.5 text-xs text-gray-500 flex-shrink-0">
                          <MapPin className="w-3 h-3" />
                          {poi.walkMinutes} min
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {themeGroups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">Ingen steder registrert for dette prosjektet.</p>
        </div>
      )}

      {/* QR Code section */}
      <div className="mt-8 text-center">
        <div className="inline-block bg-white rounded-xl border border-gray-200 p-6">
          <QRCodeSVG
            value={explorerUrl}
            size={160}
            level="H"
            includeMargin
          />
          <p className="text-xs text-gray-500 mt-3">
            Skann for interaktivt nabolagskart
          </p>
        </div>
      </div>
    </div>
  );
}
