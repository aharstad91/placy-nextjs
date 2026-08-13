/**
 * Dekningsregnskap: postnummer → område → kunnskap.
 *
 * Svarer på spørsmålet Placy ikke kunne svare på før: hvilke steder dekker vi, og
 * hva mangler. Regnskapet er både arbeidskøen (hva kureres neste) og
 * salgs-argumentet («43 av 105 postnumre i markedet»).
 *
 * Ren logikk. Lesing og utskrift ligger i `scripts/coverage-report.ts`.
 *
 * BEGGE RETNINGER AV HULL RAPPORTERES. Et regnskap som bare lister postnumre
 * ville oversett et kuratert område med tom `postal_codes` — og det var nøyaktig
 * situasjonen til Straumen, det mest komplette området vi har, og Oppdal.
 */

import { REPORT_THEME_DEFAULTS } from "./report-defaults";

/** De seks bolig-temaene. Næring har sitt eget sett og er ikke med her. */
export const BOLIG_THEME_IDS: readonly string[] = REPORT_THEME_DEFAULTS.map((t) => t.id);

/**
 * Hvor mange høydepunkter et tema minst må ha for at temaet kan regnes som dekket.
 *
 * Terskelen er 1, ikke 4 slik den først var tenkt. Grunnen er konkret: transport
 * har ett høydepunkt i Straumen, og det er riktig kuratering — sanntid fra Entur
 * svarer på holdeplasser, så en lang liste bussholdeplasser med egen tekst er
 * ikke målet. En terskel på 4 ville gjort `dekket` uoppnåelig av en grunn som
 * ikke er et hull.
 *
 * Kravet ligger i stedet på at ALLE høydepunktene kurator har valgt, har tekst.
 * Det måler det vi faktisk vil vite: er det vi viser fram, dekket.
 */
export const MIN_HIGHLIGHTS_PER_THEME = 1;

export type CoverageStatus = "ukjent" | "geometri" | "kuratert" | "dekket";

const STATUS_RANK: Record<CoverageStatus, number> = {
  ukjent: 0,
  geometri: 1,
  kuratert: 2,
  dekket: 3,
};

export interface ThemeEditorial {
  body?: string;
  highlightCandidates?: string[];
}

export interface AreaCoverageInput {
  id: string;
  name_no: string;
  /** Vi leser den ikke, bare om den finnes — geofencen krever den. */
  boundary: unknown;
  boundary_source: string | null;
  postal_codes: string[] | null;
  report_editorial: Record<string, ThemeEditorial> | null;
}

export interface PostalAreaInput {
  postnummer: string;
  poststed: string;
  kommunenummer: string;
  kommunenavn: string;
  /** Del av markedet vi selger inn i (jf. KOMMUNER i postal-area-import). */
  marked: boolean;
}

export interface AreaStatus {
  id: string;
  name: string;
  status: CoverageStatus;
  boundary_source: string | null;
  /** Temaer med redaksjonell tekst, av BOLIG_THEME_IDS.length. */
  temaerMedTekst: number;
  /** Antall høydepunkt-POIer kurator har valgt, på tvers av temaene. */
  hoydepunkter: number;
  /** Av dem, hvor mange som har brukbar tekst. */
  hoydepunkterMedTekst: number;
  /** Temaer som mangler høydepunkter helt. */
  temaerUtenHoydepunkt: string[];
  merknad?: string;
}

export interface PostalCoverage {
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  marked: boolean;
  status: CoverageStatus;
  /** Områdene som lister dette postnummeret. Flere enn ett = overlapp. */
  areaIds: string[];
}

export interface LedgerResult {
  perPostnummer: PostalCoverage[];
  areaStatuses: AreaStatus[];
  /** Områder med innhold eller form, men uten postnummer — usynlige i regnskapet. */
  omraderUtenPostnummer: AreaStatus[];
  /** Postnumre listet av flere områder. */
  overlapp: Array<{ postnummer: string; areaIds: string[] }>;
  totals: {
    alle: Record<CoverageStatus, number>;
    marked: Record<CoverageStatus, number>;
  };
}

/**
 * Klassifiser ett område.
 *
 * Rekkefølgen er streng: uten form kan geofencen aldri treffe området, så
 * redaksjonelt innhold alene gir ikke dekning. Det er ikke en teknikalitet — et
 * område med tekst og uten polygon leverer ingenting til noen bolig.
 */
export function classifyArea(
  area: AreaCoverageInput,
  poiHarTekst: (poiId: string) => boolean
): AreaStatus {
  const editorial = area.report_editorial ?? {};
  const harForm = area.boundary !== null && area.boundary !== undefined;

  let temaerMedTekst = 0;
  let hoydepunkter = 0;
  let hoydepunkterMedTekst = 0;
  const temaerUtenHoydepunkt: string[] = [];

  for (const themeId of BOLIG_THEME_IDS) {
    const tema = editorial[themeId];
    if ((tema?.body ?? "").trim().length > 0) temaerMedTekst++;

    const highlights = tema?.highlightCandidates ?? [];
    if (highlights.length < MIN_HIGHLIGHTS_PER_THEME) temaerUtenHoydepunkt.push(themeId);
    hoydepunkter += highlights.length;
    hoydepunkterMedTekst += highlights.filter((id) => poiHarTekst(id)).length;
  }

  const base = {
    id: area.id,
    name: area.name_no,
    boundary_source: area.boundary_source,
    temaerMedTekst,
    hoydepunkter,
    hoydepunkterMedTekst,
    temaerUtenHoydepunkt,
  };

  if (!harForm) {
    return {
      ...base,
      status: "ukjent",
      merknad:
        temaerMedTekst > 0
          ? "har redaksjonelt innhold men mangler polygon — geofencen kan ikke treffe det"
          : "mangler både polygon og innhold",
    };
  }

  const alleTemaerHarTekst = temaerMedTekst === BOLIG_THEME_IDS.length;
  if (!alleTemaerHarTekst) return { ...base, status: "geometri" };

  const alleHoydepunkterHarTekst =
    temaerUtenHoydepunkt.length === 0 && hoydepunkterMedTekst === hoydepunkter;

  return { ...base, status: alleHoydepunkterHarTekst ? "dekket" : "kuratert" };
}

export function buildCoverageLedger(input: {
  postalAreas: PostalAreaInput[];
  areas: AreaCoverageInput[];
  /** POI-IDer som har brukbar tekst (kuratert, eller leverandør-tekst som passerte porten). */
  poiIdsMedTekst: Set<string>;
}): LedgerResult {
  const { postalAreas, areas, poiIdsMedTekst } = input;
  const poiHarTekst = (id: string) => poiIdsMedTekst.has(id);

  const areaStatuses = areas.map((a) => classifyArea(a, poiHarTekst));
  const statusById = new Map(areaStatuses.map((s) => [s.id, s]));

  // postnummer → områdene som lister det
  const areasByPostnummer = new Map<string, string[]>();
  for (const area of areas) {
    for (const postnummer of new Set(area.postal_codes ?? [])) {
      const ids = areasByPostnummer.get(postnummer);
      if (ids) ids.push(area.id);
      else areasByPostnummer.set(postnummer, [area.id]);
    }
  }

  const perPostnummer: PostalCoverage[] = postalAreas.map((pa) => {
    const areaIds = areasByPostnummer.get(pa.postnummer) ?? [];

    // Høyeste status vinner. Et postnummer som ligger i både et kuratert og et
    // ukuratert område ER dekket for boligen som ligger der — geofencen finner
    // det kuraterte.
    let status: CoverageStatus = "ukjent";
    for (const id of areaIds) {
      const kandidat = statusById.get(id)?.status ?? "ukjent";
      if (STATUS_RANK[kandidat] > STATUS_RANK[status]) status = kandidat;
    }

    return {
      postnummer: pa.postnummer,
      poststed: pa.poststed,
      kommunenavn: pa.kommunenavn,
      marked: pa.marked,
      status,
      areaIds,
    };
  });

  const overlapp = [...areasByPostnummer.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([postnummer, areaIds]) => ({ postnummer, areaIds }));

  // Områder som har noe å vise (form eller innhold) men ingen postnummer — de
  // ville ellers falt helt ut av regnskapet.
  const omraderUtenPostnummer = areas
    .filter((a) => (a.postal_codes ?? []).length === 0)
    .map((a) => statusById.get(a.id)!)
    .filter((s) => s.temaerMedTekst > 0 || s.boundary_source !== null);

  const tom = (): Record<CoverageStatus, number> => ({
    ukjent: 0,
    geometri: 0,
    kuratert: 0,
    dekket: 0,
  });
  const totals = { alle: tom(), marked: tom() };
  for (const p of perPostnummer) {
    totals.alle[p.status]++;
    if (p.marked) totals.marked[p.status]++;
  }

  return { perPostnummer, areaStatuses, omraderUtenPostnummer, overlapp, totals };
}

/**
 * Har dette POI-et brukbar tekst?
 *
 * `curated` er Placy-eid og vinner alltid. `generated` skrives bare når den
 * passerte kvalitetsporten, så at feltet finnes med en narrative er nok —
 * porten kjører før skriving, ikke ved lesing.
 */
export function poiHarBrukbarTekst(grounding: unknown): boolean {
  if (typeof grounding !== "object" || grounding === null) return false;
  const g = grounding as {
    curated?: { narrative?: unknown };
    generated?: { narrative?: unknown };
  };
  const curated = typeof g.curated?.narrative === "string" ? g.curated.narrative.trim() : "";
  if (curated.length > 0) return true;
  const generated =
    typeof g.generated?.narrative === "string" ? g.generated.narrative.trim() : "";
  return generated.length > 0;
}
