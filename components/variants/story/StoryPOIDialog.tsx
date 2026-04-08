"use client";

import { useEffect, useRef } from "react";
import type { POI } from "@/lib/types";
import { Star, X, MapPin, Bus, Bike, Car, Loader2 } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";

// --- Variant detection ---

const SCHOOL_CATEGORY_IDS = ["school", "kindergarten"] as const;

type CardVariant = "transit" | "bysykkel" | "hyre" | "school" | "standard";

function getCardVariant(poi: POI): CardVariant {
  if (poi.enturStopplaceId) return "transit";
  if (poi.bysykkelStationId) return "bysykkel";
  if (poi.hyreStationId) return "hyre";
  if (SCHOOL_CATEGORY_IDS.includes(poi.category.id as typeof SCHOOL_CATEGORY_IDS[number])) return "school";
  return "standard";
}

function assertNever(x: never): never {
  throw new Error(`Unexpected card variant: ${x}`);
}

// --- School metadata type guard ---

interface SchoolMetadata {
  schoolLevel?: string;
  schoolType?: "public" | "private";
}

function getSchoolMetadata(poi: POI): SchoolMetadata | null {
  const meta = poi.poiMetadata;
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (!("schoolLevel" in m) && !("schoolType" in m)) return null;
  return { schoolLevel: m.schoolLevel as string | undefined, schoolType: m.schoolType as SchoolMetadata["schoolType"] };
}

// --- Component ---

interface StoryPOIDialogProps {
  poi: POI | null;
  onClose: () => void;
}

export default function StoryPOIDialog({ poi, onClose }: StoryPOIDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const realtimeData = useRealtimeData(poi);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (poi && !dialog.open) dialog.showModal();
    if (!poi && dialog.open) dialog.close();
  }, [poi]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  if (!poi) return null;

  const variant = getCardVariant(poi);
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk ? Math.round(poi.travelTime.walk / 60) : null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      className="backdrop:bg-black/40 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto max-w-sm w-[calc(100%-2rem)] rounded-2xl open:animate-in open:fade-in open:zoom-in-95"
    >
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full"
              style={{ backgroundColor: poi.category.color + "18" }}
            >
              <Icon className="w-5 h-5" style={{ color: poi.category.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a1a1a] text-lg leading-tight">
                {poi.name}
              </h3>
              <span className="text-sm text-[#8a8a8a]">
                {variant === "school" ? formatSchoolSubtitle(poi, getSchoolMetadata(poi)) : poi.category.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#f5f3f0] transition-colors -mt-1 -mr-1"
          >
            <X className="w-4 h-4 text-[#8a8a8a]" />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 px-5 pb-3 text-sm">
          {poi.googleRating != null && (
            <span className="flex items-center gap-1 text-[#4a4a4a]">
              <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
              <span className="font-medium">{poi.googleRating.toFixed(1)}</span>
              {poi.googleReviewCount != null && (
                <span className="text-[#8a8a8a]">({poi.googleReviewCount})</span>
              )}
            </span>
          )}
          {walkMin != null && (
            <span className="flex items-center gap-1 text-[#6a6a6a]">
              <MapPin className="w-3 h-3" />
              {walkMin} min gange
            </span>
          )}
        </div>

        {/* Variant content */}
        <VariantContent variant={variant} poi={poi} realtimeData={realtimeData} />
      </div>
    </dialog>
  );
}

// --- Variant content renderer ---

function VariantContent({
  variant,
  poi,
  realtimeData,
}: {
  variant: CardVariant;
  poi: POI;
  realtimeData: ReturnType<typeof useRealtimeData>;
}) {
  switch (variant) {
    case "standard":
      return <StandardContent poi={poi} />;
    case "transit":
      return <TransitContent poi={poi} realtimeData={realtimeData} />;
    case "bysykkel":
      return <BysykkelContent realtimeData={realtimeData} />;
    case "hyre":
      return <HyreContent realtimeData={realtimeData} />;
    case "school":
      return <SchoolContent poi={poi} />;
    default:
      return assertNever(variant);
  }
}

// --- Standard POI content ---

function StandardContent({ poi }: { poi: POI }) {
  return (
    <>
      {poi.editorialHook && (
        <div className="px-5 pb-4">
          <p className="text-[15px] text-[#3a3a3a] leading-relaxed">{poi.editorialHook}</p>
        </div>
      )}
      {poi.localInsight && (
        <div className="px-5 pb-5 pt-0">
          <p className="text-sm text-[#6a6a6a] italic leading-relaxed">{poi.localInsight}</p>
        </div>
      )}
    </>
  );
}

// --- Transit content (Entur) ---

function TransitContent({ poi, realtimeData }: { poi: POI; realtimeData: ReturnType<typeof useRealtimeData> }) {
  if (realtimeData.loading) {
    return <LoadingSkeleton />;
  }

  if (!realtimeData.entur || realtimeData.entur.departures.length === 0) {
    return <FallbackContent poi={poi} message="Ingen avganger tilgjengelig" />;
  }

  return (
    <div className="px-5 pb-5">
      <div className="text-xs text-[#8a8a8a] mb-2 flex items-center gap-1">
        <Bus className="w-3 h-3" />
        Neste avganger
      </div>
      <div className="space-y-1.5">
        {realtimeData.entur.departures.slice(0, 4).map((dep, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="inline-flex items-center justify-center w-8 h-5 rounded text-xs font-bold text-white"
              style={{ backgroundColor: dep.lineColor || "#666" }}
            >
              {dep.lineCode}
            </span>
            <span className="text-[#3a3a3a] flex-1 truncate">{dep.destination}</span>
            <span className={`font-medium ${dep.isRealtime ? "text-green-700" : "text-[#6a6a6a]"}`}>
              {formatRelativeDepartureTime(dep.departureTime)}
            </span>
          </div>
        ))}
      </div>
      {realtimeData.lastUpdated && (
        <div className="text-xs text-[#aaa] mt-2">
          Oppdatert: {realtimeData.lastUpdated.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

// --- Bysykkel content ---

function BysykkelContent({ realtimeData }: { realtimeData: ReturnType<typeof useRealtimeData> }) {
  if (realtimeData.loading) {
    return <LoadingSkeleton />;
  }

  if (!realtimeData.bysykkel) {
    return (
      <div className="px-5 pb-5">
        <p className="text-sm text-[#8a8a8a]">Sanntidsdata utilgjengelig</p>
      </div>
    );
  }

  const { availableBikes, availableDocks, isOpen } = realtimeData.bysykkel;

  return (
    <div className="px-5 pb-5">
      {!isOpen && (
        <div className="text-sm text-red-600 font-medium mb-2">Stasjonen er stengt</div>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Bike className="w-4 h-4 text-[#4a4a4a]" />
          <span className="text-[#3a3a3a]">
            <span className="font-semibold">{availableBikes}</span> ledige sykler
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 flex items-center justify-center text-[#4a4a4a] text-xs">🔒</span>
          <span className="text-[#3a3a3a]">
            <span className="font-semibold">{availableDocks}</span> ledige låser
          </span>
        </div>
      </div>
      {realtimeData.lastUpdated && (
        <div className="text-xs text-[#aaa] mt-2">
          Oppdatert: {realtimeData.lastUpdated.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

// --- Hyre content ---

function HyreContent({ realtimeData }: { realtimeData: ReturnType<typeof useRealtimeData> }) {
  if (realtimeData.loading) {
    return <LoadingSkeleton />;
  }

  if (!realtimeData.hyre) {
    return (
      <div className="px-5 pb-5">
        <p className="text-sm text-[#8a8a8a]">Sanntidsdata utilgjengelig</p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-5">
      <div className="flex items-center gap-2 text-sm">
        <Car className="w-4 h-4 text-[#4a4a4a]" />
        <span className="text-[#3a3a3a]">
          <span className="font-semibold">{realtimeData.hyre.numVehiclesAvailable}</span> tilgjengelige biler
        </span>
      </div>
      {realtimeData.lastUpdated && (
        <div className="text-xs text-[#aaa] mt-2">
          Oppdatert: {realtimeData.lastUpdated.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

// --- School content ---

function SchoolContent({ poi }: { poi: POI }) {
  const schoolMeta = getSchoolMetadata(poi);

  return (
    <>
      {schoolMeta?.schoolLevel && (
        <div className="px-5 pb-3">
          <span className="text-sm text-[#4a4a4a] font-medium">{schoolMeta.schoolLevel}</span>
        </div>
      )}
      <StandardContent poi={poi} />
    </>
  );
}

// --- Shared helpers ---

function formatSchoolSubtitle(poi: POI, meta: SchoolMetadata | null): string {
  const parts: string[] = [poi.category.name];
  if (meta?.schoolType) {
    parts.push(meta.schoolType === "public" ? "Offentlig" : "Privat");
  }
  return parts.join(" · ");
}

function LoadingSkeleton() {
  return (
    <div className="px-5 pb-5">
      <div className="flex items-center gap-2 text-sm text-[#8a8a8a]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Henter sanntidsdata...
      </div>
    </div>
  );
}

function FallbackContent({ poi, message }: { poi: POI; message: string }) {
  return (
    <>
      <div className="px-5 pb-2">
        <p className="text-xs text-[#aaa]">{message}</p>
      </div>
      <StandardContent poi={poi} />
    </>
  );
}
