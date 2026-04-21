import type { BentoCell } from "./BentoShowcase";
import type { POI, Coordinates } from "@/lib/types";

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
 * Hverdagsliv bento — *rendyrket* variant: ALL cells are about ONE subject,
 * the Valentinlyst Senter hub. Tenants are shown as individual cells; remaining
 * tenants listed as pills in a footer row. Apple-style coherent zoom-in on a
 * single entity, not a mixed summary of the theme.
 *
 * The horizon block (15 min by car) is NOT part of the bento — it's a separate
 * narrative unit rendered as its own card below.
 */
export function getValentinlystBento(
  pois: POI[],
  center: Coordinates,
): BentoCell[] | null {
  // Find the Valentinlyst Senter parent POI
  const featured = pois.find((p) => p.name.toLowerCase().includes("valentinlyst senter"));
  if (!featured) return null;

  const children = featured.childPOIs ?? [];

  const walkMin = (p: POI | undefined): number | null => {
    if (!p) return null;
    if (p.travelTime?.walk != null) return Math.round(p.travelTime.walk / 60);
    const m = Math.round((haversineM(center, p.coordinates) * 1.3) / 83);
    return m > 0 ? m : null;
  };

  const tenantByCat = (catIds: string[]): POI | undefined =>
    children.find((p) => catIds.includes(p.category.id));

  const coop = tenantByCat(["supermarket", "grocery"]);
  const boots = tenantByCat(["pharmacy"]);
  const frisor = tenantByCat(["haircare", "hairdresser"]);
  const bakeri = tenantByCat(["bakery"]);

  // Remaining tenants not shown as prominent cells — go into "og mer"-pills
  const prominentIds = new Set([coop, boots, frisor, bakeri].filter(Boolean).map((p) => p!.id));
  const remaining = children.filter((p) => !prominentIds.has(p.id));

  const featuredMin = walkMin(featured);
  const featuredName = featured.name;
  const googleWebsite = featured.googleWebsite;
  const utforskUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(featuredName + " butikker åpningstider")}`;

  const cells: BentoCell[] = [];

  // Hero (2×2) — Valentinlyst Senter with actions
  cells.push({
    colSpan: 2,
    rowSpan: 2,
    tone: "sage",
    kicker: featuredMin != null ? `${featuredMin} MIN UNNA` : "I NABOLAGET",
    title: featuredName,
    body:
      featured.editorialHook ??
      "Nabolagets praktiske nav — dagligvare, apotek, frisør og vinmonopol samlet på ett sted.",
    image: "/illustrations/hverdagsliv.jpg",
    imageTreatment: "dominant",
    actions: [
      ...(googleWebsite
        ? ([
            {
              label: "Nettside",
              url: googleWebsite,
              variant: "primary",
              icon: "external",
            },
          ] as const)
        : []),
      {
        label: "Utforsk med AI",
        url: utforskUrl,
        variant: "ghost",
        icon: "sparkles",
      },
    ],
  });

  // Tenant cells — all inside Valentinlyst, all use featured's walk time
  const tenantCell = (
    tenant: POI | undefined,
    kicker: string,
    tone: "terracotta" | "stone" | "cream",
  ): BentoCell | null => {
    if (!tenant) return null;
    return {
      colSpan: 1,
      rowSpan: 1,
      tone,
      kicker,
      title: tenant.name.replace(" Valentinlyst", ""), // shorten for bento
      stat: featuredMin != null ? { value: `${featuredMin}`, unit: "min" } : undefined,
      iconName: tenant.category.icon,
    };
  };

  const c1 = tenantCell(coop, "Dagligvare", "terracotta");
  const c2 = tenantCell(boots, "Apotek", "cream");
  const c3 = tenantCell(frisor, "Frisør", "stone");
  const c4 = tenantCell(bakeri, "Bakeri", "cream");

  for (const c of [c1, c2, c3, c4]) if (c) cells.push(c);

  // "Og mer" footer row (4×1) — remaining tenants as pills
  if (remaining.length > 0) {
    cells.push({
      colSpan: 4,
      rowSpan: 1,
      tone: "sage",
      kicker: "Og mer innendørs",
      title: `${children.length} leietakere i senteret`,
      pills: remaining.map((t) => ({
        label: t.name.replace(" Valentinlyst", ""),
        iconName: t.category.icon,
        color: t.category.color,
      })),
    });
  }

  return cells;
}

/**
 * Horizon card — separate narrative unit rendered below the bento.
 * Explicitly about "outside the immediate neighborhood".
 */
export function getHverdagslivHorizonCell(): BentoCell {
  return {
    colSpan: 4,
    rowSpan: 1,
    tone: "night",
    kicker: "Utvidet horisont — 15 min med bil",
    title: "Hele byen åpner seg opp",
    body: "Sirkus Shopping, Moholt Storsenter, Lade Arena og City Syd — alle innen kvarteret. Bakklandet og Solsiden et par busstopp unna når du vil ut.",
  };
}
