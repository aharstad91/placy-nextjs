import type { ViewportRect } from "./board-types";
import type { TravelMode } from "@/lib/types";

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
 * Den regner ikke ut avstander. Reisetidene er precomputet for alle tre modus
 * (`v2.project_pois.travel_times` → `POI.travelTime.{walk,bike,car}`, i MINUTTER)
 * og måles alltid fra BOLIGEN, aldri fra kartsenteret (R6). Kartutsnittet
 * bestemmer hvilke punkter som står i lista — aldri hva de måles fra. Derfor tar
 * funksjonen heller ikke inn home-koordinater: den trenger dem ikke.
 *
 * Modusen (`options.travelMode`) velger HVILKEN precomputet verdi som leses. Den
 * endrer aldri hvilke punkter som er på boardet — bare tallene og rekkefølgen.
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
    /** Precomputet reisetid per modus, i MINUTTER. En modus kan mangle på
     *  punkter uten ruteberegning (R26). Dekningen er full på alle ni boards per
     *  2026-08-14 (backfill: `scripts/backfill-travel-times.ts`), men grenen er
     *  ikke død: POI-er lagt til utenfor provisjonerings-løpet får ingen reisetid
     *  før backfillen kjøres igjen, og det har skjedd to ganger. */
    travelTime?: Partial<Record<TravelMode, number>>;
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
  /** Reisetid i minutter fra boligen i AKTIV modus, eller `undefined` når den
   *  mangler (R26 — raden rendres da uten minutt-tall). Navnet er bevisst
   *  modus-nøytralt: et felt som het `walkMinutes` men bar biltid ville vært en
   *  felle for neste leser. */
  minutes?: number;
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
  /** Laveste reisetid i aktiv modus blant de synlige som HAR en. `undefined` når
   *  ingen av dem har det (kortet rendres da uten tidsspenn). */
  minMinutes?: number;
  /** Høyeste reisetid i aktiv modus blant de synlige som har en. */
  maxMinutes?: number;
  /** Inntil `rowsPerCategory` punkter: sub-kategori-diversifisert utvalg,
   *  presentert som tidsstige. */
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
  minMinutes?: number;
  maxMinutes?: number;
}): string {
  const coverage =
    category.visibleCount === category.totalCount
      ? `${category.totalCount} ${category.totalCount === 1 ? "sted" : "steder"}`
      : `${category.visibleCount} av ${category.totalCount} synlig`;
  if (category.minMinutes === undefined || category.maxMinutes === undefined) {
    return coverage;
  }
  const span =
    category.minMinutes === category.maxMinutes
      ? `${category.minMinutes} min`
      : `${category.minMinutes}–${category.maxMinutes} min`;
  return `${coverage} · ${span}`;
}

/** Precomputet reisetid for valgt modus, eller `undefined` når verdien mangler
 *  eller ikke er et brukbart tall (NaN/Infinity fra en korrupt rad skal aldri
 *  lekke ut i et tidsspenn eller en sortering). */
function minutesOf(
  poi: NeighbourhoodPOIInput,
  mode: TravelMode,
): number | undefined {
  const value = poi.raw.travelTime?.[mode];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Hvilke reisemodus boardet har data for (R6).
 *
 * En modus er tilgjengelig hvis minst ett punkt har en brukbar verdi for den.
 * Avledningen hører i lesemodellen, ikke i UI-et: både chipen på ruta og
 * kart-kontrollen må lese samme svar, ellers kan de vise ulike sett med modus.
 *
 * Rekkefølgen er kanonisk (gå, sykkel, bil) — den er også visningsrekkefølgen,
 * fra tregeste til raskeste, slik at tallene i panelet leser som en stige.
 */
export function availableTravelModes(
  categories: readonly NeighbourhoodCategoryInput<NeighbourhoodPOIInput>[],
): TravelMode[] {
  const modes: TravelMode[] = ["walk", "bike", "car"];
  return modes.filter((mode) =>
    categories.some((category) =>
      category.pois.some((poi) => minutesOf(poi, mode) !== undefined),
    ),
  );
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

/** Reisetid stigende, punkter uten tid sist, deretter navn som tie-break så
 *  rekkefølgen er stabil mellom renders. */
function compareRows<P extends NeighbourhoodPOIInput>(
  a: NeighbourhoodRow<P>,
  b: NeighbourhoodRow<P>,
): number {
  const aw = a.minutes ?? Infinity;
  const bw = b.minutes ?? Infinity;
  if (aw !== bw) return aw - bw;
  const byName = a.poi.name.localeCompare(b.poi.name, "nb");
  if (byName !== 0) return byName;
  return a.poi.id.localeCompare(b.poi.id);
}

/**
 * Velger HVILKE punkter kortet viser — ikke rekkefølgen.
 *
 * Rå tidssortering ga «tre bysykkelstasjoner på rad» under Transport
 * (`docs/solutions/logic-errors/report-poi-sorting-clustered-first-load-20260304.md`).
 * Den opprinnelige `diversifiedSelection()` ble slettet i cutoveren 2026-07-06;
 * mønsteret reimplementeres her.
 *
 * Terskelen (åpen i planen): round-robin over sub-kategori-bøttene, altså
 * **høyst ett punkt per sub-kategori per runde**. Bøttene ligger i
 * første-forekomst-rekkefølge, som med tidssortert input betyr «nærmeste
 * sub-kategori først» — så runde 0 plukker det nærmeste punktet i hver
 * sub-kategori før runde 1 henter det nest nærmeste i den første.
 *
 * Utvalget re-sorteres på tid til slutt: variasjon avgjør hvem som er med, tid
 * avgjør rekkefølgen. Kortet leses som en stige uansett.
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
  options: {
    rowsPerCategory?: number;
    /**
     * Aktiv reisemodus. Styrer BÅDE tallene og rekkefølgen: `minMinutes` er
     * mode-avledet, og kategori-sorteringen leser den — så et bytte til bil
     * reordner kategoriene på samme premiss som radene. En kategori-rekkefølge
     * sortert på gangtid mens radene viser biltid ville lest som en feil.
     */
    travelMode?: TravelMode;
  } = {},
): NeighbourhoodList<P> {
  const rowsPerCategory = options.rowsPerCategory ?? DEFAULT_ROWS_PER_CATEGORY;
  const travelMode = options.travelMode ?? "walk";
  const out: NeighbourhoodCategory<P>[] = [];
  const visiblePoiIds: string[] = [];
  let visibleCount = 0;

  for (const category of categories) {
    const visible: NeighbourhoodRow<P>[] = [];
    for (const poi of category.pois) {
      if (rect && !isWithin(rect, poi)) continue;
      visible.push({ poi, minutes: minutesOf(poi, travelMode) });
    }
    if (visible.length === 0) continue; // R14

    visible.sort(compareRows);

    // Tidsspennet leses av de sorterte radene som HAR en tid: første og siste
    // slike. De uten ligger sist, så et enkelt filter holder — og NaN kan ikke
    // lekke inn, siden minutesOf allerede har silt dem ut.
    const timed = visible.filter((r) => r.minutes !== undefined);
    const minMinutes = timed.length > 0 ? timed[0].minutes : undefined;
    const maxMinutes =
      timed.length > 0 ? timed[timed.length - 1].minutes : undefined;

    visibleCount += visible.length;
    for (const row of visible) visiblePoiIds.push(row.poi.id);
    out.push({
      id: category.id,
      label: category.label,
      icon: category.icon,
      color: category.color,
      visibleCount: visible.length,
      totalCount: category.pois.length,
      minMinutes,
      maxMinutes,
      rows: diversifyBySubCategory(visible, rowsPerCategory),
      hasMore: visible.length > rowsPerCategory,
    });
  }

  // R10: nærmeste kategori først, i AKTIV modus. Kategorier uten tider i det
  // hele tatt havner sist (Infinity), med etiketten som tie-break for stabil
  // rekkefølge.
  out.sort((a, b) => {
    const aw = a.minMinutes ?? Infinity;
    const bw = b.minMinutes ?? Infinity;
    if (aw !== bw) return aw - bw;
    return a.label.localeCompare(b.label, "nb");
  });

  return { categories: out, visiblePoiIds, visibleCount, scoped: rect !== null };
}
