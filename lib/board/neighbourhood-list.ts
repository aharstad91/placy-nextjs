import type { ViewportRect } from "./board-types";

/**
 * Nabolagsmodellen (mobil nabolagsflate, Unit 2).
 *
 * Gitt board-kategoriene og det ikke-okkluderte kartutsnittet: produser den
 * grupperte, sorterte lista sheeten viser. Rent funksjonelt — ingen React,
 * ingen kart-instans, ingen nettverk. Alt som kan gå galt her kan gås etter
 * i en test.
 *
 * ## Hva modellen IKKE gjør
 *
 * Den regner ikke ut avstander. Gangtidene er precomputet
 * (`v2.project_pois.travel_times` → `POI.travelTime.walk`, i MINUTTER) og måles
 * alltid fra BOLIGEN, aldri fra kartsenteret (R6). Kartutsnittet bestemmer
 * hvilke punkter som står i lista — aldri hva de måles fra. Derfor tar
 * funksjonen heller ikke inn home-koordinater: den trenger dem ikke.
 *
 * ## Nevneren i dekningsbrøken
 *
 * «9 av 17» betyr 17 PÅ BOARDET, ikke 17 i databasen. `CATEGORY_FILTER_RULES` i
 * `components/variants/report/report-data.ts` har allerede kappet `bus`/`tram`/
 * `bike` til de nærmeste fem, `idrett` til tre, `skole` til skolekrets-treff, og
 * merget barn-POIer inn i foreldrene. Settet er altså endelig og beskåret før
 * det når hit — som også er grunnen til at panorering utover bare kan skjule,
 * aldri hente frem nye steder. Ankomstrammen (Unit 5) er motvekten.
 */

/** Minimums-formen et punkt må ha. Strukturell, ikke nominell: `BoardPOI`
 *  oppfyller den, men modulen slipper å importere board-laget (lib/ skal ikke
 *  avhenge av components/). */
export interface NeighbourhoodPOIInput {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  raw: {
    /** Sub-kategorien (f.eks. `bike`, `bus`, `restaurant`) — diversifiserings-
     *  nøkkelen. Samme felt `subFilter` bruker i `BoardMap`. */
    category: { id: string };
    /** Precomputet reisetid i MINUTTER. `walk` mangler på punkter uten
     *  ruteberegning (R26 — dekningen er 100 % på alle fire mål-boards i dag,
     *  så grenen fyrer ikke på produksjonsdata). */
    travelTime?: { walk?: number };
  };
}

/** Minimums-formen en kategori må ha. `BoardCategory` oppfyller den. */
export interface NeighbourhoodCategoryInput<
  P extends NeighbourhoodPOIInput = NeighbourhoodPOIInput,
> {
  id: string;
  label: string;
  icon: string;
  color: string;
  pois: readonly P[];
}

export interface NeighbourhoodRow<P extends NeighbourhoodPOIInput> {
  poi: P;
  /** Gangtid i minutter fra boligen, eller `undefined` når den mangler (R26 —
   *  raden rendres da uten minutt-tall). */
  walkMinutes?: number;
}

export interface NeighbourhoodCategory<P extends NeighbourhoodPOIInput> {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Antall av kategoriens punkter som ligger i utsnittet. */
  visibleCount: number;
  /** Kategoriens totale antall punkter på boardet — nevneren i «9 av 17». */
  totalCount: number;
  /** Laveste gangtid blant de synlige som HAR gangtid. `undefined` når ingen
   *  av dem har det (kortet rendres da uten tidsspenn). */
  minWalk?: number;
  /** Høyeste gangtid blant de synlige som har gangtid. */
  maxWalk?: number;
  /** Inntil `rowsPerCategory` punkter: sub-kategori-diversifisert utvalg,
   *  presentert som gangtidsstige. */
  rows: NeighbourhoodRow<P>[];
  /** true når kategorien har flere synlige punkter enn radene viser — kortet
   *  avsluttes da med en rad som fører til kategorisiden (R11). */
  hasMore: boolean;
}

export interface NeighbourhoodList<P extends NeighbourhoodPOIInput> {
  /** Kategorier med minst ett synlig punkt, nærmeste først. Kategorier uten
   *  synlige punkter faller helt ut (R14). */
  categories: NeighbourhoodCategory<P>[];
  /**
   * ALLE synlige POI-IDer på tvers av kategoriene — ikke bare de som står som
   * rader. Dette er markør-settet: kartet skal vise hvert punkt i utsnittet,
   * mens kortene bare rekker over tre hver.
   */
  visiblePoiIds: string[];
  /** Synlige punkter totalt. 0 → tom tilstand (R25). */
  visibleCount: number;
  /** false når utsnittet manglet og lista viser ALT — degraderingsveien når
   *  kartet ikke kunne leses. Aldri en tom liste av den grunn. */
  scoped: boolean;
}

/** R11: inntil tre punkter per kategorikort. */
export const DEFAULT_ROWS_PER_CATEGORY = 3;

/**
 * «9 av 17 synlig · 4–21 min» — tett, prosafri, og alltid sann.
 *
 * Dekningsbrøken er svaret på hvorfor en utsnitts-scopet liste ikke er en løgn:
 * den sier eksplisitt hvor mange av kategoriens steder som ligger utenfor det
 * brukeren ser. Er alle synlige, skrives det som et rent antall i stedet for
 * «17 av 17».
 *
 * Tar imot den strukturelle minimumsformen, ikke hele kategori-objektet, så
 * både mobilsheetens kort og desktop-panelets viewport-liste kan bruke samme
 * formatering (2026-08-13).
 */
export function categorySubline(category: {
  visibleCount: number;
  totalCount: number;
  minWalk?: number;
  maxWalk?: number;
}): string {
  const coverage =
    category.visibleCount === category.totalCount
      ? `${category.totalCount} ${category.totalCount === 1 ? "sted" : "steder"}`
      : `${category.visibleCount} av ${category.totalCount} synlig`;
  if (category.minWalk === undefined || category.maxWalk === undefined) {
    return coverage;
  }
  const span =
    category.minWalk === category.maxWalk
      ? `${category.minWalk} min`
      : `${category.minWalk}–${category.maxWalk} min`;
  return `${coverage} · ${span}`;
}

/** Precomputet gangtid, eller `undefined` når verdien mangler eller ikke er et
 *  brukbart tall (NaN/Infinity fra en korrupt rad skal aldri lekke ut i et
 *  tidsspenn eller en sortering). */
function walkMinutesOf(poi: NeighbourhoodPOIInput): number | undefined {
  const walk = poi.raw.travelTime?.walk;
  return typeof walk === "number" && Number.isFinite(walk) ? walk : undefined;
}

/**
 * Ligger punktet i utsnittet? Inklusiv på alle fire kanter, så et punkt
 * nøyaktig på kanten alltid havner samme sted — ikke avhengig av
 * flyttalls-støy i unproject.
 *
 * Antar at utsnittet ikke krysser datolinjen (`west <= east`). Placy-boards er
 * enkelt-bys og kameraet rammes inn rundt boligen, så tilfellet oppstår ikke.
 * Skulle det gjøre det, blir resultatet en tom kategori — ikke en krasj.
 */
function isWithin(rect: ViewportRect, poi: NeighbourhoodPOIInput): boolean {
  const { lat, lng } = poi.coordinates;
  return (
    lng >= rect.west && lng <= rect.east && lat >= rect.south && lat <= rect.north
  );
}

/** Gangtid stigende, punkter uten gangtid sist, deretter navn som tie-break så
 *  rekkefølgen er stabil mellom renders. */
function compareRows<P extends NeighbourhoodPOIInput>(
  a: NeighbourhoodRow<P>,
  b: NeighbourhoodRow<P>,
): number {
  const aw = a.walkMinutes ?? Infinity;
  const bw = b.walkMinutes ?? Infinity;
  if (aw !== bw) return aw - bw;
  const byName = a.poi.name.localeCompare(b.poi.name, "nb");
  if (byName !== 0) return byName;
  return a.poi.id.localeCompare(b.poi.id);
}

/**
 * Velger HVILKE punkter kortet viser — ikke rekkefølgen.
 *
 * Rå gangtidssortering ga «tre bysykkelstasjoner på rad» under Transport
 * (`docs/solutions/logic-errors/report-poi-sorting-clustered-first-load-20260304.md`).
 * Den opprinnelige `diversifiedSelection()` ble slettet i cutoveren 2026-07-06;
 * mønsteret reimplementeres her.
 *
 * Terskelen (åpen i planen): round-robin over sub-kategori-bøttene, altså
 * **høyst ett punkt per sub-kategori per runde**. Bøttene ligger i
 * første-forekomst-rekkefølge, som med gangtidssortert input betyr «nærmeste
 * sub-kategori først» — så runde 0 plukker det nærmeste punktet i hver
 * sub-kategori før runde 1 henter det nest nærmeste i den første.
 *
 * Utvalget re-sorteres på gangtid til slutt: variasjon avgjør hvem som er med,
 * gangtid avgjør rekkefølgen. Kortet leses som en stige uansett.
 */
function diversifyBySubCategory<P extends NeighbourhoodPOIInput>(
  sorted: NeighbourhoodRow<P>[],
  limit: number,
): NeighbourhoodRow<P>[] {
  if (sorted.length <= limit) return sorted;

  const buckets = new Map<string, NeighbourhoodRow<P>[]>();
  for (const row of sorted) {
    const key = row.poi.raw.category.id;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  if (buckets.size === 1) return sorted.slice(0, limit);

  const lists = Array.from(buckets.values());
  const picked: NeighbourhoodRow<P>[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let addedThisRound = false;
    for (const list of lists) {
      if (round >= list.length) continue;
      picked.push(list[round]);
      addedThisRound = true;
      if (picked.length === limit) break;
    }
    if (!addedThisRound) break;
  }
  return picked.sort(compareRows);
}

export function buildNeighbourhoodList<P extends NeighbourhoodPOIInput>(
  categories: readonly NeighbourhoodCategoryInput<P>[],
  /** Det ikke-okkluderte kartutsnittet, eller `null` når kartet ikke kunne
   *  leses. `null` = ingen scoping (vis alt), aldri en tom liste.
   *
   *  Objektet er trygt som ARGUMENT — hazarden i
   *  `useeffect-object-dependency-infinite-loop-20260410` gjelder dep-arrays.
   *  Kallstedet (`use-neighbourhood-list`) holder primitivene i sin dep-array
   *  og bygger rektangelet inne i memoen. */
  rect: ViewportRect | null,
  options: { rowsPerCategory?: number } = {},
): NeighbourhoodList<P> {
  const rowsPerCategory = options.rowsPerCategory ?? DEFAULT_ROWS_PER_CATEGORY;
  const out: NeighbourhoodCategory<P>[] = [];
  const visiblePoiIds: string[] = [];
  let visibleCount = 0;

  for (const category of categories) {
    const visible: NeighbourhoodRow<P>[] = [];
    for (const poi of category.pois) {
      if (rect && !isWithin(rect, poi)) continue;
      visible.push({ poi, walkMinutes: walkMinutesOf(poi) });
    }
    if (visible.length === 0) continue; // R14

    visible.sort(compareRows);

    // Tidsspennet leses av de sorterte radene som HAR gangtid: første og siste
    // slike. De uten ligger sist, så et enkelt filter holder — og NaN kan ikke
    // lekke inn, siden walkMinutesOf allerede har silt dem ut.
    const timed = visible.filter((r) => r.walkMinutes !== undefined);
    const minWalk = timed.length > 0 ? timed[0].walkMinutes : undefined;
    const maxWalk =
      timed.length > 0 ? timed[timed.length - 1].walkMinutes : undefined;

    visibleCount += visible.length;
    for (const row of visible) visiblePoiIds.push(row.poi.id);
    out.push({
      id: category.id,
      label: category.label,
      icon: category.icon,
      color: category.color,
      visibleCount: visible.length,
      totalCount: category.pois.length,
      minWalk,
      maxWalk,
      rows: diversifyBySubCategory(visible, rowsPerCategory),
      hasMore: visible.length > rowsPerCategory,
    });
  }

  // R10: nærmeste kategori først. Kategorier uten gangtider i det hele tatt
  // havner sist (Infinity), med etiketten som tie-break for stabil rekkefølge.
  out.sort((a, b) => {
    const aw = a.minWalk ?? Infinity;
    const bw = b.minWalk ?? Infinity;
    if (aw !== bw) return aw - bw;
    return a.label.localeCompare(b.label, "nb");
  });

  return { categories: out, visiblePoiIds, visibleCount, scoped: rect !== null };
}
