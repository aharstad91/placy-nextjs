"use client";

import { useMemo } from "react";
import type { Coordinates, POI } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { resolveThemeId } from "@/lib/themes";
import { getSchoolZone } from "@/lib/utils/school-zones";
import { getIcon } from "@/lib/utils/map-icons";
import { Star } from "lucide-react";

interface HeroInsightProps {
  theme: ReportTheme;
  center: Coordinates;
}

export default function ReportHeroInsight({ theme, center }: HeroInsightProps) {
  const resolved = resolveThemeId(theme.id);
  const Renderer = RENDERERS[resolved];
  if (!Renderer) return null;
  return <Renderer theme={theme} center={center} />;
}

/**
 * Returns the set of POI IDs used in the hero insight card (Tier 1).
 * Used by the text generator to avoid repeating these in prose.
 */
export function getHeroInsightPOIIds(
  themeId: string,
  pois: POI[],
  center: Coordinates,
): Set<string> {
  const resolved = resolveThemeId(themeId);
  const extractor = TIER1_EXTRACTORS[resolved];
  if (!extractor) return new Set();
  return new Set(extractor(pois, center).map((p) => p.id));
}

// ============================================================
// Shared helpers
// ============================================================

/** Haversine distance in meters */
function haversineM(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Walk minutes — uses travelTime if available, else estimates from haversine x 1.3 road factor */
function estimateWalkMin(poi: POI, center: Coordinates): number {
  if (poi.travelTime?.walk != null) return Math.round(poi.travelTime.walk / 60);
  return Math.round((haversineM(center, poi.coordinates) * 1.3) / 83);
}

function fmtWalk(poi: POI, center: Coordinates): string {
  const m = estimateWalkMin(poi, center);
  return m > 0 ? `${m} min` : "";
}

function byWalk(pois: POI[], center: Coordinates): POI[] {
  return [...pois].sort(
    (a, b) => estimateWalkMin(a, center) - estimateWalkMin(b, center),
  );
}

function ofCats(pois: POI[], ...ids: string[]): POI[] {
  const s = new Set(ids);
  return pois.filter((p) => s.has(p.category.id));
}

function nearestOf(pois: POI[], center: Coordinates, ...catIds: string[]): POI | undefined {
  return byWalk(ofCats(pois, ...catIds), center)[0];
}

// ============================================================
// Card wrapper
// ============================================================

function InsightCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#faf9f7] border border-[#eae6e1] px-5 py-4 md:px-6 md:py-5 mb-6">
      <div className="text-xs uppercase tracking-[0.15em] text-[#a0937d] font-medium mb-3">
        {title}
      </div>
      {children}
      {footer && (
        <div className="mt-3 pt-3 border-t border-[#eae6e1] text-sm text-[#8a8a8a]">
          {footer}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 1. Barn & Oppvekst — Skolekretskortet
// ============================================================

const HIGHER_ED = [
  "vgs",
  "videregående",
  "ntnu",
  "høgskole",
  "høyskole",
  "universitet",
];

function isHigherEd(name: string): boolean {
  const lower = name.toLowerCase();
  return HIGHER_ED.some((kw) => lower.includes(kw));
}

/** Fuzzy match: checks if POI name contains the zone name, tolerating 1 character difference at the end */
function fuzzySchoolMatch(poiName: string, zoneName: string): boolean {
  const poi = poiName.toLowerCase();
  const zone = zoneName.toLowerCase();
  // Exact substring match
  if (poi.includes(zone)) return true;
  // Try matching with last char stripped (handles Blussuvold vs Blussuvoll)
  if (zone.length >= 4 && poi.includes(zone.slice(0, -1))) return true;
  return false;
}

function classifySchools(schools: POI[], center: Coordinates) {
  const zone = getSchoolZone(center.lat, center.lng);

  const nonHigherEd = schools.filter((s) => !isHigherEd(s.name));
  const higherEd = byWalk(schools.filter((s) => isHigherEd(s.name)), center);

  let barneskole: POI | null = null;
  let ungdomsskole: POI | null = null;

  if (zone.barneskole) {
    barneskole =
      nonHigherEd.find((s) => fuzzySchoolMatch(s.name, zone.barneskole!)) ?? null;
  }
  if (zone.ungdomsskole) {
    ungdomsskole =
      nonHigherEd.find((s) => fuzzySchoolMatch(s.name, zone.ungdomsskole!)) ?? null;
  }

  // Fallback: nearest schools if no zone data or no match found
  if (!barneskole && nonHigherEd.length > 0) {
    const sorted = byWalk(nonHigherEd, center);
    barneskole = sorted[0] ?? null;
    if (!ungdomsskole && sorted.length > 1) {
      ungdomsskole = sorted[1] ?? null;
    }
  }

  const hasZone = !!(zone.barneskole || zone.ungdomsskole);
  const vgs = higherEd[0] ?? null;

  return { barneskole, ungdomsskole, vgs, hasZone };
}

function BarnOppvekstInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;
  const schools = ofCats(pois, "skole");
  const kindergartens = ofCats(pois, "barnehage");
  const playgrounds = ofCats(pois, "lekeplass");

  const data = useMemo(
    () => classifySchools(schools, center),
    [schools, center],
  );

  if (!data.barneskole && !data.ungdomsskole && !data.vgs) return null;

  const footerParts: string[] = [];
  if (kindergartens.length > 0)
    footerParts.push(`${kindergartens.length} barnehager`);
  if (playgrounds.length > 0)
    footerParts.push(`${playgrounds.length} lekeplasser`);

  return (
    <InsightCard
      title={data.hasZone ? "Skolekrets" : "Skoler i nærheten"}
      footer={
        footerParts.length > 0 ? (
          <>{footerParts.join(" \u00b7 ")} i nabolaget</>
        ) : undefined
      }
    >
      <div className="space-y-2.5">
        {data.barneskole && (
          <SchoolRow level="Barneskole (1\u20137)" poi={data.barneskole} center={center} />
        )}
        {data.ungdomsskole && (
          <SchoolRow level="Ungdomsskole (8\u201310)" poi={data.ungdomsskole} center={center} />
        )}
        {data.vgs && <SchoolRow level="Videreg\u00e5ende" poi={data.vgs} center={center} />}
      </div>
    </InsightCard>
  );
}

function SchoolRow({ level, poi, center }: { level: string; poi: POI; center: Coordinates }) {
  const walk = fmtWalk(poi, center);
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm text-[#8a8a8a] w-[150px] shrink-0">
        {level}
      </span>
      <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
        {poi.name}
      </span>
      {walk && (
        <span className="text-sm text-[#8a8a8a] shrink-0">{walk}</span>
      )}
    </div>
  );
}

// ============================================================
// 2. Hverdagsliv — Nærmeste per behov
// ============================================================

const HVERDAGS_TYPES: { catIds: string[]; label: string }[] = [
  { catIds: ["supermarket", "convenience"], label: "Dagligvare" },
  { catIds: ["pharmacy"], label: "Apotek" },
  { catIds: ["doctor", "dentist", "hospital"], label: "Lege" },
  { catIds: ["haircare"], label: "Fris\u00f8r" },
];

function HverdagslivInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const rows = useMemo(() => {
    return HVERDAGS_TYPES.map((type) => {
      const nearest = nearestOf(pois, center, ...type.catIds);
      if (!nearest) return null;
      return { ...type, poi: nearest };
    }).filter(Boolean) as { catIds: string[]; label: string; poi: POI }[];
  }, [pois, center]);

  if (rows.length < 2) return null;

  const within10 = pois.filter(
    (p) => estimateWalkMin(p, center) <= 10,
  ).length;

  return (
    <InsightCard
      title="Hverdagen i gangavstand"
      footer={
        within10 > 0
          ? `${within10} hverdagstjenester innen 10 min`
          : undefined
      }
    >
      <div className="space-y-1">
        {rows.map((row) => {
          const Icon = getIcon(row.poi.category.icon);
          const walk = fmtWalk(row.poi, center);
          return (
            <div key={row.label} className="flex items-center gap-3 py-1.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: row.poi.category.color + "15" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: row.poi.category.color }} />
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {row.poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {row.label}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// 3. Transport — Holdeplasser
// ============================================================

function TransportInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const stops = useMemo(() => {
    const result: POI[] = [];
    const seen = new Set<string>();

    for (const catId of ["train", "tram", "bus"]) {
      for (const poi of byWalk(ofCats(pois, catId), center)) {
        if (!seen.has(poi.id) && result.length < 4) {
          result.push(poi);
          seen.add(poi.id);
        }
      }
    }

    if (result.length < 4) {
      const bike = nearestOf(pois, center, "bike");
      if (bike && !seen.has(bike.id)) result.push(bike);
    }

    return result;
  }, [pois, center]);

  if (stops.length < 1) return null;

  const transitStops = pois.filter(
    (p) =>
      estimateWalkMin(p, center) <= 5 &&
      ["bus", "tram", "train"].includes(p.category.id),
  ).length;

  return (
    <InsightCard
      title="Kollektivt herfra"
      footer={
        transitStops > 0
          ? `${transitStops} holdeplasser innen 5 min gange`
          : undefined
      }
    >
      <div className="space-y-1">
        {stops.map((poi) => {
          const Icon = getIcon(poi.category.icon);
          const walk = fmtWalk(poi, center);
          return (
            <div key={poi.id} className="flex items-center gap-3 py-1.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {poi.category.name}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// 4. Natur & Friluftsliv — Primærområde
// ============================================================

function NaturInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const areas = useMemo(() => {
    const sorted = byWalk(pois, center);
    return { primary: sorted[0] ?? null, secondary: sorted.slice(1, 3) };
  }, [pois, center]);

  if (!areas.primary) return null;

  return (
    <InsightCard
      title="Naturen er nær"
      footer={
        pois.length > 1
          ? `${pois.length} parker og grøntområder i nabolaget`
          : undefined
      }
    >
      <div className="mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold text-[#1a1a1a]">
            {areas.primary.name}
          </span>
          {fmtWalk(areas.primary, center) && (
            <span className="text-sm text-[#8a8a8a]">
              {fmtWalk(areas.primary, center)}
            </span>
          )}
        </div>
        {areas.primary.editorialHook && (
          <p className="text-sm text-[#6a6a6a] mt-1 leading-relaxed">
            {areas.primary.editorialHook}
          </p>
        )}
      </div>

      {areas.secondary.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {areas.secondary.map((poi) => (
            <span key={poi.id} className="text-[#6a6a6a]">
              {poi.name}{" "}
              <span className="text-[#a0937d]">{fmtWalk(poi, center)}</span>
            </span>
          ))}
        </div>
      )}
    </InsightCard>
  );
}

// ============================================================
// 5. Mat & Drikke — Kvalitetsankeret
// ============================================================

function MatDrikkeInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const topRated = useMemo(() => {
    return [...pois]
      .filter((p) => p.googleRating != null && p.googleRating >= 3.5)
      .sort((a, b) => {
        const rd = (b.googleRating ?? 0) - (a.googleRating ?? 0);
        return rd !== 0
          ? rd
          : (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0);
      })
      .slice(0, 3);
  }, [pois]);

  if (topRated.length < 2) return null;

  const rated = pois.filter((p) => p.googleRating != null);
  const avg =
    rated.length > 0
      ? (rated.reduce((s, p) => s + (p.googleRating ?? 0), 0) / rated.length).toFixed(1)
      : null;

  return (
    <InsightCard
      title="Lokale favoritter"
      footer={<>{pois.length} spisesteder{avg && <> · snittrating {avg}</>}</>}
    >
      <div className="space-y-1">
        {topRated.map((poi) => {
          const walk = fmtWalk(poi, center);
          return (
            <div key={poi.id} className="flex items-center gap-3 py-1.5">
              <div className="flex items-center gap-1 shrink-0 w-12">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium text-[#1a1a1a]">
                  {poi.googleRating?.toFixed(1)}
                </span>
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {poi.category.name}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// 6. Trening & Aktivitet — Breddevisning
// ============================================================

const TRENING_TYPES: { catIds: string[]; label: string }[] = [
  { catIds: ["gym"], label: "Treningssenter" },
  { catIds: ["swimming"], label: "Sv\u00f8mmehall" },
  { catIds: ["fitness_park"], label: "Treningspark" },
  { catIds: ["spa"], label: "Spa" },
];

function TreningInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const byType = useMemo(() => {
    return TRENING_TYPES.map((type) => {
      const nearest = nearestOf(pois, center, ...type.catIds);
      if (!nearest) return null;
      return { ...type, poi: nearest };
    }).filter(Boolean) as { catIds: string[]; label: string; poi: POI }[];
  }, [pois, center]);

  if (byType.length < 1) return null;

  return (
    <InsightCard
      title="Hold deg i form"
      footer={`${pois.length} treningsmuligheter i nabolaget`}
    >
      <div className="space-y-1">
        {byType.map(({ poi, label }) => {
          const Icon = getIcon(poi.category.icon);
          const walk = fmtWalk(poi, center);
          return (
            <div key={poi.id} className="flex items-center gap-3 py-1.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {label}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// 7. Opplevelser — Kulturtilbudet
// ============================================================

const KULTUR_TYPES: { catIds: string[]; label: string }[] = [
  { catIds: ["library"], label: "Bibliotek" },
  { catIds: ["cinema"], label: "Kino" },
  { catIds: ["museum"], label: "Museum" },
  { catIds: ["theatre"], label: "Teater" },
  { catIds: ["bowling", "amusement"], label: "Underholdning" },
];

function OpplevelserInsight({ theme, center }: HeroInsightProps) {
  const pois = theme.allPOIs;

  const byType = useMemo(() => {
    return KULTUR_TYPES.map((type) => {
      const nearest = nearestOf(pois, center, ...type.catIds);
      if (!nearest) return null;
      return { ...type, poi: nearest };
    }).filter(Boolean) as { catIds: string[]; label: string; poi: POI }[];
  }, [pois, center]);

  if (byType.length < 1) return null;

  return (
    <InsightCard
      title="Kultur i nærheten"
      footer={`${pois.length} kulturopplevelser i nabolaget`}
    >
      <div className="space-y-1">
        {byType.map(({ poi, label }) => {
          const Icon = getIcon(poi.category.icon);
          const walk = fmtWalk(poi, center);
          return (
            <div key={poi.id} className="flex items-center gap-3 py-1.5">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: poi.category.color + "15" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: poi.category.color }} />
              </div>
              <span className="font-medium text-[#1a1a1a] text-[15px] flex-1 min-w-0 truncate">
                {poi.name}
              </span>
              <span className="text-sm text-[#8a8a8a] shrink-0 hidden sm:inline">
                {label}
              </span>
              {walk && (
                <span className="text-sm text-[#8a8a8a] shrink-0 w-12 text-right">{walk}</span>
              )}
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ============================================================
// Registries
// ============================================================

const RENDERERS: Record<string, React.FC<HeroInsightProps>> = {
  "barn-oppvekst": BarnOppvekstInsight,
  hverdagsliv: HverdagslivInsight,
  hverdagstjenester: HverdagslivInsight,
  transport: TransportInsight,
  "natur-friluftsliv": NaturInsight,
  "mat-drikke": MatDrikkeInsight,
  "trening-aktivitet": TreningInsight,
  opplevelser: OpplevelserInsight,
};

/** Tier 1 extractors — returns the POIs shown in the hero insight card */
const TIER1_EXTRACTORS: Record<
  string,
  (pois: POI[], center: Coordinates) => POI[]
> = {
  "barn-oppvekst": (pois, center) => {
    const schools = ofCats(pois, "skole");
    const { barneskole, ungdomsskole, vgs } = classifySchools(schools, center);
    return [barneskole, ungdomsskole, vgs].filter(Boolean) as POI[];
  },
  hverdagsliv: (pois, center) => {
    return HVERDAGS_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
  hverdagstjenester: (pois, center) => {
    return HVERDAGS_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
  transport: (pois, center) => {
    const result: POI[] = [];
    const seen = new Set<string>();
    for (const catId of ["train", "tram", "bus"]) {
      for (const poi of byWalk(ofCats(pois, catId), center)) {
        if (!seen.has(poi.id) && result.length < 4) {
          result.push(poi);
          seen.add(poi.id);
        }
      }
    }
    const bike = nearestOf(pois, center, "bike");
    if (bike && !seen.has(bike.id) && result.length < 4) result.push(bike);
    return result;
  },
  "natur-friluftsliv": (pois, center) => {
    const sorted = byWalk(pois, center);
    return sorted.slice(0, 3);
  },
  "mat-drikke": (pois) => {
    return [...pois]
      .filter((p) => p.googleRating != null && p.googleRating >= 3.5)
      .sort((a, b) => {
        const rd = (b.googleRating ?? 0) - (a.googleRating ?? 0);
        return rd !== 0
          ? rd
          : (b.googleReviewCount ?? 0) - (a.googleReviewCount ?? 0);
      })
      .slice(0, 3);
  },
  "trening-aktivitet": (pois, center) => {
    return TRENING_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
  opplevelser: (pois, center) => {
    return KULTUR_TYPES.map((t) => nearestOf(pois, center, ...t.catIds)).filter(
      Boolean,
    ) as POI[];
  },
};
