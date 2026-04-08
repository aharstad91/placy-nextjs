"use client";

import type { POI } from "@/lib/types";
import { Star, MapPin, Bus, Bike, Car } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { formatRelativeDepartureTime } from "@/lib/utils/format-time";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

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
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const realtimeData = useRealtimeData(poi);
  const open = poi !== null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent showCloseButton className="max-w-sm p-0 gap-0 overflow-hidden">
          {poi && <POICardContent poi={poi} realtimeData={realtimeData} />}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent>
        <div className="max-h-[85vh] overflow-y-auto">
          {poi && <POICardContent poi={poi} realtimeData={realtimeData} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// --- Shared card content (used by both Dialog and Drawer) ---

function POICardContent({ poi, realtimeData }: { poi: POI; realtimeData: ReturnType<typeof useRealtimeData> }) {
  const variant = getCardVariant(poi);
  const Icon = getIcon(poi.category.icon);
  const walkMin = poi.travelTime?.walk ? Math.round(poi.travelTime.walk / 60) : null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 p-5 pb-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{ backgroundColor: poi.category.color + "18" }}
        >
          <Icon className="w-5 h-5" style={{ color: poi.category.color }} />
        </div>
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg leading-tight">
            {poi.name}
          </DialogTitle>
          <DialogDescription>
            {variant === "school" ? formatSchoolSubtitle(poi, getSchoolMetadata(poi)) : poi.category.name}
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 px-5 pb-3 text-sm">
        {poi.googleRating != null && (
          <span className="flex items-center gap-1 text-foreground/70">
            <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
            <span className="font-medium">{poi.googleRating.toFixed(1)}</span>
            {poi.googleReviewCount != null && (
              <span className="text-muted-foreground">({poi.googleReviewCount})</span>
            )}
          </span>
        )}
        {walkMin != null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {walkMin} min gange
          </span>
        )}
      </div>

      {/* Variant content */}
      <VariantContent variant={variant} poi={poi} realtimeData={realtimeData} />
    </>
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
          <p className="text-[15px] text-foreground/80 leading-relaxed">{poi.editorialHook}</p>
        </div>
      )}
      {poi.localInsight && (
        <div className="px-5 pb-5 pt-0">
          <p className="text-sm text-muted-foreground italic leading-relaxed">{poi.localInsight}</p>
        </div>
      )}
    </>
  );
}

// --- Transit content (Entur) ---

function TransitContent({ poi, realtimeData }: { poi: POI; realtimeData: ReturnType<typeof useRealtimeData> }) {
  if (realtimeData.loading) {
    return <TransitSkeleton />;
  }

  if (!realtimeData.entur || realtimeData.entur.departures.length === 0) {
    return <FallbackContent poi={poi} message="Ingen avganger tilgjengelig" />;
  }

  return (
    <div className="px-5 pb-5">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
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
            <span className="text-foreground/80 flex-1 truncate">{dep.destination}</span>
            <span className={`font-medium ${dep.isRealtime ? "text-green-700" : "text-muted-foreground"}`}>
              {formatRelativeDepartureTime(dep.departureTime)}
            </span>
          </div>
        ))}
      </div>
      <UpdatedAt date={realtimeData.lastUpdated} />
    </div>
  );
}

// --- Bysykkel content ---

function BysykkelContent({ realtimeData }: { realtimeData: ReturnType<typeof useRealtimeData> }) {
  if (realtimeData.loading) {
    return <SimpleSkeleton />;
  }

  if (!realtimeData.bysykkel) {
    return (
      <div className="px-5 pb-5">
        <p className="text-sm text-muted-foreground">Sanntidsdata utilgjengelig</p>
      </div>
    );
  }

  const { availableBikes, availableDocks, isOpen } = realtimeData.bysykkel;

  return (
    <div className="px-5 pb-5">
      {!isOpen && (
        <div className="text-sm text-destructive font-medium mb-2">Stasjonen er stengt</div>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Bike className="w-4 h-4 text-foreground/60" />
          <span className="text-foreground/80">
            <span className="font-semibold">{availableBikes}</span> ledige sykler
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 flex items-center justify-center text-foreground/60 text-xs">🔒</span>
          <span className="text-foreground/80">
            <span className="font-semibold">{availableDocks}</span> ledige låser
          </span>
        </div>
      </div>
      <UpdatedAt date={realtimeData.lastUpdated} />
    </div>
  );
}

// --- Hyre content ---

function HyreContent({ realtimeData }: { realtimeData: ReturnType<typeof useRealtimeData> }) {
  if (realtimeData.loading) {
    return <SimpleSkeleton />;
  }

  if (!realtimeData.hyre) {
    return (
      <div className="px-5 pb-5">
        <p className="text-sm text-muted-foreground">Sanntidsdata utilgjengelig</p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-5">
      <div className="flex items-center gap-2 text-sm">
        <Car className="w-4 h-4 text-foreground/60" />
        <span className="text-foreground/80">
          <span className="font-semibold">{realtimeData.hyre.numVehiclesAvailable}</span> tilgjengelige biler
        </span>
      </div>
      <UpdatedAt date={realtimeData.lastUpdated} />
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
          <span className="text-sm text-foreground/70 font-medium">{schoolMeta.schoolLevel}</span>
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

function UpdatedAt({ date }: { date: Date | null }) {
  if (!date) return null;
  return (
    <div className="text-xs text-muted-foreground/60 mt-2">
      Oppdatert: {date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
    </div>
  );
}

function TransitSkeleton() {
  return (
    <div className="px-5 pb-5 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/4" />
    </div>
  );
}

function SimpleSkeleton() {
  return (
    <div className="px-5 pb-5 space-y-2">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-5 w-36" />
    </div>
  );
}

function FallbackContent({ poi, message }: { poi: POI; message: string }) {
  return (
    <>
      <div className="px-5 pb-2">
        <p className="text-xs text-muted-foreground/60">{message}</p>
      </div>
      <StandardContent poi={poi} />
    </>
  );
}
