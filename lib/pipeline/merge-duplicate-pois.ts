/**
 * Sammenslåing av dublett-POIer i v2.pois.
 *
 * BAKGRUNN: cutover-migrasjonen (074) skrev nye rader med ny ID-konvensjon
 * (`entur-NSR-StopPlace-<id>`, `bhf-<slug>`) uten å fjerne legacy-radene med
 * samme autoritative nøkkel (`bus-<slug>`, UUID-er). Begge generasjoner ligger
 * i basen, og en re-provisjonering linker den ene mens den andre allerede er
 * linket — boardet får da to pins for samme holdeplass eller barnehage.
 * Oppdaget 2026-08-14 under scout-kjøringen på Ranheim.
 *
 * Denne modulen er REN: ingen IO, ingen Supabase. CLI-en
 * (`scripts/merge-duplicate-pois.ts`) gjør henting, skriving og verifisering.
 * Grunnen er den samme som for `places-backfill-lib`: destruktiv logikk skal
 * kunne kjøres i test uten å røre en database.
 */

import { calculateDistance } from "@/lib/utils/geo";

/** Nøkler som identifiserer det samme stedet på tvers av ID-generasjoner. */
export const AUTHORITATIVE_KEYS = [
  "entur_stopplace_id",
  "barnehagefakta_id",
  "nsr_id",
  "google_place_id",
  "osm_id",
] as const;

export type AuthoritativeKey = (typeof AUTHORITATIVE_KEYS)[number];

export interface MergeablePoi {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  category_id: string | null;
  source: string | null;
  created_at?: string | null;
  entur_stopplace_id?: string | null;
  barnehagefakta_id?: string | null;
  nsr_id?: string | null;
  google_place_id?: string | null;
  osm_id?: string | null;
  grounding?: { curated?: unknown; generated?: unknown } | null;
  opening_hours_json?: unknown;
  gallery_images?: string[] | null;
  google_rating?: number | null;
  editorial_hook?: string | null;
  local_insight?: string | null;
  [key: string]: unknown;
}

export interface DuplicateGroup {
  key: AuthoritativeKey;
  value: string;
  rows: MergeablePoi[];
}

export interface ResolvedGroup extends DuplicateGroup {
  winner: MergeablePoi;
  losers: MergeablePoi[];
  /** Tom liste = trygg å slå sammen automatisk. */
  problems: string[];
}

/**
 * Normaliser navn for sammenligning. Norske bokstaver translittereres FØR
 * tegnfjerning — `ø` er en egen Unicode-bokstav, ikke o + diakritikk, så NFD
 * lar den stå (samme felle som `slugify` dokumenterer).
 */
export function normalizePoiName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/\b(as|asa|sa|ba)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Grupper rader som deler verdi på en autoritativ nøkkel. */
export function groupByAuthoritativeKey(pois: MergeablePoi[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const alreadyGrouped = new Set<string>();

  for (const key of AUTHORITATIVE_KEYS) {
    const buckets = new Map<string, MergeablePoi[]>();
    for (const poi of pois) {
      const value = poi[key];
      if (typeof value !== "string" || value === "") continue;
      // En rad hører til ÉN gruppe. Uten dette ville en rad med både
      // nsr_id og google_place_id kunne slås sammen to ganger, og den andre
      // kjøringen ville pekt på en rad som allerede er slettet.
      if (alreadyGrouped.has(poi.id)) continue;
      const bucket = buckets.get(value) ?? [];
      bucket.push(poi);
      buckets.set(value, bucket);
    }
    for (const [value, rows] of buckets) {
      if (rows.length < 2) continue;
      rows.forEach((r) => alreadyGrouped.add(r.id));
      groups.push({ key, value, rows });
    }
  }

  return groups;
}

/**
 * Datarikdom-score. Kuratert innhold veier tyngst, deretter leverandør-tekst,
 * så Google-kobling og fakta. Brukes bare som tiebreak ETTER kurator-binding.
 */
export function dataRichnessScore(poi: MergeablePoi): number {
  return (
    (poi.grounding?.curated ? 1000 : 0) +
    (poi.grounding?.generated ? 100 : 0) +
    (poi.google_place_id ? 50 : 0) +
    (poi.editorial_hook ? 30 : 0) +
    (poi.local_insight ? 30 : 0) +
    (poi.opening_hours_json ? 20 : 0) +
    ((poi.gallery_images?.length ?? 0) > 0 ? 20 : 0) +
    (poi.google_rating ? 10 : 0)
  );
}

/**
 * Velg kanonisk rad.
 *
 * Rekkefølgen er ikke vilkårlig: en rad som strøkets kuraterte
 * `highlightCandidates` peker på MÅ overleve, ellers mister kurateringen
 * bindingen sin og chipsen forsvinner fra boardet. Datarikdom er tiebreak,
 * og eldste `created_at` avgjør til slutt så valget er deterministisk.
 */
export function chooseCanonical(
  rows: MergeablePoi[],
  curatedIds: ReadonlySet<string>,
): { winner: MergeablePoi; losers: MergeablePoi[] } {
  const ranked = [...rows].sort((a, b) => {
    const curatedA = curatedIds.has(a.id) ? 1 : 0;
    const curatedB = curatedIds.has(b.id) ? 1 : 0;
    if (curatedA !== curatedB) return curatedB - curatedA;

    const scoreA = dataRichnessScore(a);
    const scoreB = dataRichnessScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;

    const createdA = a.created_at ?? "";
    const createdB = b.created_at ?? "";
    if (createdA !== createdB) return createdA.localeCompare(createdB);

    return a.id.localeCompare(b.id);
  });

  const [winner, ...losers] = ranked;
  return { winner, losers };
}

/**
 * Sikkerhetsport: samme nøkkel betyr ikke alltid samme pin.
 *
 * Entur bruker én StopPlace for begge kjøreretninger, så
 * «Bakkegata (fra sentrum)» og «(til sentrum)» deler nøkkel uten å være samme
 * punkt. Uten denne porten ville sammenslåingen slettet en ekte holdeplass.
 */
export function safetyProblems(
  winner: MergeablePoi,
  losers: MergeablePoi[],
  maxDistanceMeters = 100,
): string[] {
  const problems: string[] = [];
  const winnerName = normalizePoiName(winner.name);

  for (const loser of losers) {
    const loserName = normalizePoiName(loser.name);
    const sameName =
      winnerName === loserName ||
      (winnerName !== "" && loserName !== "" &&
        (winnerName.includes(loserName) || loserName.includes(winnerName)));
    if (!sameName) {
      problems.push(`ulikt navn: "${winner.name}" vs "${loser.name}"`);
    }

    const meters = calculateDistance(winner.lat, winner.lng, loser.lat, loser.lng);
    if (meters > maxDistanceMeters) {
      problems.push(`${Math.round(meters)} m mellom "${winner.name}" og "${loser.name}"`);
    }

    if (winner.category_id !== loser.category_id) {
      problems.push(
        `ulik kategori: ${winner.category_id ?? "—"} vs ${loser.category_id ?? "—"}`,
      );
    }
  }

  return [...new Set(problems)];
}

/** Grupper → avgjorte grupper med vinner, tapere og eventuelle innsigelser. */
export function resolveGroups(
  groups: DuplicateGroup[],
  curatedIds: ReadonlySet<string>,
  maxDistanceMeters = 100,
): ResolvedGroup[] {
  return groups.map((group) => {
    const { winner, losers } = chooseCanonical(group.rows, curatedIds);
    return {
      ...group,
      winner,
      losers,
      problems: safetyProblems(winner, losers, maxDistanceMeters),
    };
  });
}

/**
 * Felt vinneren skal arve fra taperen. KUN felter der vinneren mangler verdi —
 * en tapers data skal aldri overskrive kanonisk innhold.
 */
export const ABSORBABLE_FIELDS = [
  "address",
  "google_place_id",
  "google_rating",
  "google_review_count",
  "google_maps_url",
  "google_website",
  "google_phone",
  "google_business_status",
  "opening_hours_json",
  "gallery_images",
  "featured_image",
  "photo_reference",
  "editorial_hook",
  "local_insight",
  "description",
  "grounding",
  "entur_stopplace_id",
  "barnehagefakta_id",
  "nsr_id",
  "osm_id",
  "bysykkel_station_id",
] as const;

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export function buildAbsorptionPatch(
  winner: MergeablePoi,
  losers: MergeablePoi[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of ABSORBABLE_FIELDS) {
    if (!isEmpty(winner[field])) continue;
    for (const loser of losers) {
      if (!isEmpty(loser[field])) {
        patch[field] = loser[field];
        break;
      }
    }
  }

  return patch;
}

export interface LinkRow {
  poi_id: string;
  travel_times?: unknown;
  [key: string]: unknown;
}

export interface LinkPlan<T extends LinkRow> {
  /** Lenker som skal peke på vinneren i stedet. */
  repoint: T[];
  /** Lenker som skal slettes fordi vinneren allerede er lenket samme sted. */
  drop: T[];
}

/**
 * Planlegg omskriving av lenketabeller (`project_pois`, `product_pois`).
 *
 * `ownerKey` er kolonnen som sammen med `poi_id` utgjør unikheten
 * (`project_id` eller `product_id`). Ligger både vinner og taper i samme
 * eier, kan taperen ikke repekes — det ville brutt primærnøkkelen — så den
 * slettes i stedet. Da forsvinner dubletten fra boardet.
 */
export function planLinkRepoint<T extends LinkRow>(
  links: T[],
  ownerKey: string,
  winnerId: string,
  loserIds: ReadonlySet<string>,
): LinkPlan<T> {
  const winnerOwners = new Set(
    links.filter((l) => l.poi_id === winnerId).map((l) => String(l[ownerKey])),
  );

  const repoint: T[] = [];
  const drop: T[] = [];

  for (const link of links) {
    if (!loserIds.has(link.poi_id)) continue;
    const owner = String(link[ownerKey]);
    if (winnerOwners.has(owner)) {
      drop.push(link);
    } else {
      repoint.push(link);
      // En repeket lenke gjør vinneren lenket hos denne eieren, så en senere
      // taper i samme gruppe må slettes i stedet for å repekes.
      winnerOwners.add(owner);
    }
  }

  return { repoint, drop };
}
