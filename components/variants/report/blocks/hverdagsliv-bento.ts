import type { BentoCell } from "./BentoShowcase";
import type { POI, Coordinates } from "@/lib/types";
import type { ReportThemeStats } from "../report-data";

/** Haversine meters between two coords */
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

/**
 * Hverdagsliv bento — pilot composition.
 *
 * Digs into child POIs (Valentinlyst Senter) for featured tenants, falls back
 * to standalone POIs if needed. Copy is hardcoded for the pilot.
 */
export function getHverdagslivBento(
  pois: POI[],
  stats: ReportThemeStats,
  center: Coordinates,
): BentoCell[] {
  // Flatten: top-level POIs + all their children. Bento cells can reference either.
  const allWithChildren: POI[] = [];
  for (const p of pois) {
    allWithChildren.push(p);
    if (p.childPOIs) allWithChildren.push(...p.childPOIs);
  }

  // Walk time: prefer actual travelTime, fall back to haversine × 1.3 @ 83 m/min
  // (matches the estimator used by ReportHeroInsight for consistency).
  const walkMin = (p: POI | undefined): number | null => {
    if (!p) return null;
    if (p.travelTime?.walk != null) return Math.round(p.travelTime.walk / 60);
    const m = Math.round((haversineM(center, p.coordinates) * 1.3) / 83);
    return m > 0 ? m : null;
  };

  const nearestInCats = (catIds: string[]): POI | undefined => {
    const matches = allWithChildren.filter((p) => catIds.includes(p.category.id));
    matches.sort((a, b) => (walkMin(a) ?? Infinity) - (walkMin(b) ?? Infinity));
    return matches[0];
  };
  const findByName = (needle: string) =>
    allWithChildren.find((p) =>
      p.name.toLowerCase().includes(needle.toLowerCase()),
    );

  // Featured: Valentinlyst Senter
  const featured = findByName("Valentinlyst Senter") ?? pois[0];
  const featuredMin = walkMin(featured);

  // Nearest per category (child POIs from featured get priority due to same location)
  const frisor = nearestInCats(["haircare", "hairdresser"]);
  const apotek = nearestInCats(["pharmacy"]);
  const vinmono = nearestInCats(["liquor_store"]);
  const matbutikk = nearestInCats(["supermarket", "grocery"]);

  const cells: BentoCell[] = [];

  // A — Hero (2 cols × 2 rows): Featured senter with image dominant
  if (featured) {
    cells.push({
      colSpan: 2,
      rowSpan: 2,
      tone: "sage",
      kicker: featuredMin != null ? `${featuredMin} MIN UNNA` : "ALT UNDER ETT TAK",
      title: featured.name,
      body:
        featured.editorialHook ??
        "Hverdagen samlet på ett sted — dagligvare, apotek, frisør og vinmonopol.",
      image: "/illustrations/hverdagsliv.jpg",
      // Marks this cell as "image-dominant" — less text wash, text at bottom
      imageTreatment: "dominant",
    });
  }

  // B — Stat: total POIs
  cells.push({
    colSpan: 1,
    rowSpan: 1,
    tone: "terracotta",
    kicker: "I nærheten",
    title: "tilbud innen gangavstand",
    stat: { value: `${stats.totalPOIs}` },
  });

  // C — Matbutikk / dagligvare
  if (matbutikk) {
    const min = walkMin(matbutikk);
    cells.push({
      colSpan: 1,
      rowSpan: 1,
      tone: "stone",
      kicker: "Dagligvare",
      title: matbutikk.name,
      stat: min != null ? { value: `${min}`, unit: "min" } : undefined,
    });
  }

  // D — Apotek
  if (apotek) {
    const min = walkMin(apotek);
    cells.push({
      colSpan: 1,
      rowSpan: 1,
      tone: "cream",
      kicker: "Apotek",
      title: apotek.name,
      stat: min != null ? { value: `${min}`, unit: "min" } : undefined,
    });
  }

  // E — Frisør
  if (frisor) {
    const min = walkMin(frisor);
    cells.push({
      colSpan: 1,
      rowSpan: 1,
      tone: "stone",
      kicker: "Frisør",
      title: frisor.name,
      stat: min != null ? { value: `${min}`, unit: "min" } : undefined,
    });
  }

  // (Vinmonopol dropped to keep a clean 2×2 hero + 4 stat-cells + horizon grid.
  // Can be re-added once we allow 6+1 layouts.)
  void vinmono;

  // F — Horisont-utvidelse (full bredde)
  cells.push({
    colSpan: 4,
    rowSpan: 1,
    tone: "night",
    kicker: "Utvidet horisont — 15 min med bil",
    title: "Hele byen åpner seg opp",
    body: "Sirkus Shopping, Moholt Storsenter, Lade Arena og City Syd — alle innen kvarteret. Bakklandet og Solsiden et par busstopp unna når du vil ut.",
  });

  return cells;
}
