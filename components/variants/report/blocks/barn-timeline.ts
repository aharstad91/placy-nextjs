import type { POI, Coordinates } from "@/lib/types";
import type { TimelineNode } from "./TimelineRow";
import type { StatItem } from "./StatRow";
import { getSchoolZone } from "@/lib/utils/school-zones";

/** Haversine meters */
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

const HIGHER_ED_KEYWORDS = ["vgs", "videregående"];

function walkMinFor(poi: POI | undefined, center: Coordinates): number | null {
  if (!poi) return null;
  if (poi.travelTime?.walk != null) return Math.round(poi.travelTime.walk / 60);
  const m = Math.round((haversineM(center, poi.coordinates) * 1.3) / 83);
  return m > 0 ? m : null;
}

/**
 * Skole-løp timeline — progresjonen barneskole → ungdomsskole → VGS.
 * Bruker skole-zone-lookup for å finne riktig barneskole + ungdomsskole,
 * og fuzzy name-match for å peke til faktiske POIer (gir korrekte walk-times).
 */
export function getBarnTimeline(
  pois: POI[],
  center: Coordinates,
): TimelineNode[] | null {
  const zone = getSchoolZone(center.lat, center.lng);
  if (!zone.barneskole && !zone.ungdomsskole) return null;

  // Fuzzy-match zone name to POI
  const findSchoolPOI = (zoneName: string | null): POI | undefined => {
    if (!zoneName) return undefined;
    const needle = zoneName.toLowerCase();
    return pois.find((p) => {
      if (p.category.id !== "skole") return false;
      const pn = p.name.toLowerCase();
      // Skip higher ed for barneskole/ungdomsskole match
      if (HIGHER_ED_KEYWORDS.some((kw) => pn.includes(kw))) return false;
      return pn.includes(needle) || (needle.length >= 4 && pn.includes(needle.slice(0, -1)));
    });
  };

  // VGS = nearest higher-ed
  const vgs = pois
    .filter(
      (p) =>
        p.category.id === "skole" &&
        HIGHER_ED_KEYWORDS.some((kw) => p.name.toLowerCase().includes(kw)),
    )
    .sort((a, b) => haversineM(center, a.coordinates) - haversineM(center, b.coordinates))[0];

  const barneskole = findSchoolPOI(zone.barneskole);
  const ungdomsskole = findSchoolPOI(zone.ungdomsskole);

  const nodes: TimelineNode[] = [];

  if (barneskole) {
    const min = walkMinFor(barneskole, center);
    nodes.push({
      kicker: "Barneskole · 1–7",
      title: barneskole.name.replace(/\s*skole$/i, " skole"),
      subtitle: `Skolekrets ${zone.barneskole ?? ""}`.trim(),
      stat: min != null ? { value: `${min}`, unit: "min gange" } : undefined,
      iconName: "GraduationCap",
      iconColor: "#f59e0b",
    });
  }

  if (ungdomsskole) {
    const min = walkMinFor(ungdomsskole, center);
    nodes.push({
      kicker: "Ungdomsskole · 8–10",
      title: ungdomsskole.name.replace(/\s*skole$/i, " skole"),
      subtitle: `Skolekrets ${zone.ungdomsskole ?? ""}`.trim(),
      stat: min != null ? { value: `${min}`, unit: "min gange" } : undefined,
      iconName: "GraduationCap",
      iconColor: "#f59e0b",
    });
  }

  if (vgs) {
    const min = walkMinFor(vgs, center);
    nodes.push({
      kicker: "Videregående · 11–13",
      title: vgs.name,
      subtitle: "Nærmeste VGS",
      stat: min != null ? { value: `${min}`, unit: "min gange" } : undefined,
      iconName: "GraduationCap",
      iconColor: "#f59e0b",
    });
  }

  return nodes.length >= 2 ? nodes : null;
}

/**
 * Støtte-stats under timeline: barnehager, lekeplasser, idrettsanlegg,
 * nærmeste lekeplass — viser at området er rikt for barnefamilier utover
 * selve skolene.
 */
export function getBarnStats(
  pois: POI[],
  center: Coordinates,
): StatItem[] {
  const barnehager = pois.filter((p) => p.category.id === "barnehage");
  const lekeplasser = pois.filter((p) => p.category.id === "lekeplass");
  const idrett = pois.filter((p) => p.category.id === "idrett");

  const nearestLekeplass = [...lekeplasser].sort(
    (a, b) => haversineM(center, a.coordinates) - haversineM(center, b.coordinates),
  )[0];
  const nearestBarnehage = [...barnehager].sort(
    (a, b) => haversineM(center, a.coordinates) - haversineM(center, b.coordinates),
  )[0];

  const stats: StatItem[] = [];

  if (nearestBarnehage) {
    const min = walkMinFor(nearestBarnehage, center);
    stats.push({
      kicker: "Nærmeste barnehage",
      value: min != null ? `${min}` : "–",
      unit: "min",
      subtitle: nearestBarnehage.name,
      iconName: "Baby",
      iconColor: "#ec4899",
      tone: "terracotta",
    });
  }

  if (barnehager.length > 0) {
    stats.push({
      kicker: "Barnehager i nabolaget",
      value: `${barnehager.length}`,
      unit: barnehager.length === 1 ? "stk" : "stk",
      subtitle: "Kommunale og private i kort avstand",
      iconName: "Baby",
      iconColor: "#ec4899",
      tone: "cream",
    });
  }

  if (nearestLekeplass) {
    const min = walkMinFor(nearestLekeplass, center);
    stats.push({
      kicker: "Nærmeste lekeplass",
      value: min != null ? `${min}` : "–",
      unit: "min",
      subtitle: nearestLekeplass.name,
      iconName: "ToyBrick",
      iconColor: "#8b5cf6",
      tone: "stone",
    });
  }

  if (idrett.length > 0) {
    stats.push({
      kicker: "Idrettsanlegg",
      value: `${idrett.length}`,
      unit: idrett.length === 1 ? "anlegg" : "anlegg",
      subtitle: "Fotball, svømming, håndball, friidrett",
      iconName: "Trophy",
      iconColor: "#0ea5e9",
      tone: "sage",
    });
  }

  return stats.slice(0, 4);
}
