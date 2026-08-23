/**
 * FAQ-generator: spørsmålene en megler får på visning, besvart for ÉN adresse.
 *
 * TO LAG, ÉN STEMME. Den deterministiske kjernen svarer på alle adresser fra
 * data vi eier (skolekrets, register, POI-pool, reisetider, transittfakta). Det
 * kuraterte laget overstyrer per spørsmåls-id der strøket er kuratert. Skillet
 * er USYNLIG for leseren — `source` er med for at vi skal kunne evaluere hvilke
 * svar som ville stått på en hvilken som helst adresse, ikke for å rendres.
 *
 * DIKTER ALDRI. Mangler faktumet, utelates spørsmålet. Det er samme regel som
 * i `category-specs.ts`, og den er dyrekjøpt: et gulv på 80 tegn tvang fram
 * generiske nytteklausuler på nettopp de stedene vi visste minst om.
 *
 * ÉN SVARFORM PER KATEGORI, ALDRI ÉN FELLES. Da vi skrev 158 POI-tekster på
 * Ranheim oppsto det en felles setningsmal av seg selv — 41 tekster åpnet likt
 * — og de måtte språkvaskes i egen runde. Malene her er derfor bevisst ulike i
 * FORM, ikke bare i innhold: skole svarer med sogning, barnehage med antall,
 * dagligvare med nærmeste, restaurant med et ja, transport med retninger. En
 * test holder åpningene fra hverandre.
 *
 * TEKST MONTERES VED RENDER, FAKTA LAGRES. Samme modell som `bridgeText`:
 * pipelinen lagrer tall og navn, denne modulen setter setningene. Da kan
 * formuleringene itereres uten å provisjonere seks boards på nytt.
 *
 * TALL SOM IKKE ER MÅLT, SKRIVES IKKE. Gangtid vises kun der den er precomputet
 * (`travelTime.walk`) — aldri et haversine-estimat. Samme regel som den
 * utsnitts-scopede lista i sidebaren, av samme grunn: et tall leseren kan
 * etterprøve på kartet må stemme.
 */

import { faqQuestionsForTheme } from "@/lib/editorial/category-specs";
import {
  formatHourRange,
  parseWeekdayText,
  sundayHours,
  weekdayConsensus,
  type DayHours,
} from "@/lib/generators/opening-hours";
import { normalizeFullSchoolName } from "@/lib/pipeline/zoned-school-selection";
import type { Coordinates, POI, ReportBoardFacts, ReportFaqAnswer } from "@/lib/types";

/** Hvor svaret kom fra. Intern sporbarhet — rendres aldri. */
export type FaqSource = "deterministic" | "curated";

export interface FaqEntry {
  /** Board-lag-spørsmålets id, eller kurators egen for tillegg. */
  id: string;
  question: string;
  /** Svartekst. Kan bære `[tekst](poi:id)` og `[tekst](category:id)`. */
  answer: string;
  source: FaqSource;
}

/** «I gangavstand» for FAQ-svarene. Ti minutter er ærendsavstand til fots. */
export const WALK_RADIUS_MIN = 10;

/** Restaurantspørsmålet spør om man slipper å dra til byen — da er ramma videre. */
const DINING_RADIUS_MIN = 15;

/** Så mange steder et svar navngir før det blir en liste framfor en setning. */
const MAX_NAMED = 2;

export interface FaqGeneratorInput {
  themeId: string;
  /** Temaets `category_id`-liste — broen til malverket. */
  categoryIds: readonly string[];
  /** Temaets board-filtrerte POI-er. */
  pois: readonly POI[];
  /** Hele boardets POI-sett — steder kan kobles på tvers av temaer. */
  allPois: readonly POI[];
  center: Coordinates;
  boardFacts?: ReportBoardFacts;
  /** Kretsnavn fra kommunens polygoner. Fallback når registerfakta mangler. */
  schoolZone?: { barneskole: string | null; ungdomsskole: string | null };
  /** Strøkets kuraterte svar for temaet. */
  curated?: readonly ReportFaqAnswer[];
}

// ── Tekst-hjelpere ──────────────────────────────────────────────────────────

/** `[Ranheim skole](poi:nsr-975278980)` når stedet er på boardet, ellers navnet. */
function poiLink(name: string, poi: POI | undefined): string {
  return poi ? `[${name}](poi:${poi.id})` : name;
}

/**
 * POI-navn i løpende tekst. Registeret og Google skriver den juridiske formen
 * («Grilstad Fus barnehage AS»), og holdeplass-POIene bærer et suffiks
 * kategorien allerede sier. Ingen av delene hører hjemme i en setning.
 */
function cleanPoiName(name: string): string {
  return name
    .replace(/\s+(AS|ASA|SA)$/i, "")
    .replace(/\s+bussholdeplass$/i, "")
    .replace(/\s+holdeplass$/i, "")
    .trim();
}

/** Kortform: rydd navnet OG lenk det, i ett. */
function namedPoi(poi: POI): string {
  return poiLink(cleanPoiName(poi.name), poi);
}

/**
 * Finn skolens POI på boardet.
 *
 * TO VEIER, OG BEGGE TRENGS: `import-public-pois` gir NSR-skoler id-en
 * `nsr-<orgnr>`, men poolen inneholder også eldre rader for de samme skolene
 * fra andre kilder — på Ranheim vant en legacy-UUID dedupen, og id-oppslaget
 * alene ga null lenke på nettopp kretssvaret. Navnematchen bruker
 * `normalizeFullSchoolName`, som BEHOLDER skoleslags-ordet: «Charlottenlund
 * barneskole» og «Charlottenlund ungdomsskole» ligger på samme tomt og må
 * ikke smelte sammen.
 */
function findSchoolPoi(
  pois: readonly POI[],
  school: { navn: string; orgnr: string },
): POI | undefined {
  const byId = pois.find((p) => p.id === `nsr-${school.orgnr}`);
  if (byId) return byId;
  const wanted = normalizeFullSchoolName(school.navn);
  if (!wanted) return undefined;
  const matches = pois.filter(
    (p) => p.category.id === "skole" && normalizeFullSchoolName(p.name) === wanted,
  );
  // Aldri gjett mellom to skoler med samme normaliserte navn.
  return matches.length === 1 ? matches[0] : undefined;
}

/** Precomputet gangtid. Undefined = ikke målt, og da nevnes ingen tid. */
function walkMinutes(poi: POI): number | undefined {
  const walk = poi.travelTime?.walk;
  return typeof walk === "number" && Number.isFinite(walk) ? walk : undefined;
}

/** Nærmest først. POI-er uten målt gangtid havner sist, sortert på luftlinje. */
function byWalkThenDistance(pois: readonly POI[], center: Coordinates): POI[] {
  return [...pois].sort((a, b) => {
    const aw = walkMinutes(a);
    const bw = walkMinutes(b);
    if (aw !== undefined && bw !== undefined && aw !== bw) return aw - bw;
    if (aw !== undefined && bw === undefined) return -1;
    if (aw === undefined && bw !== undefined) return 1;
    return haversineM(center, a.coordinates) - haversineM(center, b.coordinates);
  });
}

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

function inCategories(pois: readonly POI[], ...ids: string[]): POI[] {
  const set = new Set(ids);
  return pois.filter((p) => set.has(p.category.id));
}

/** «A og B», «A, B og C». */
function ogJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} og ${items[items.length - 1]}`;
}

/**
 * Skolenavn i løpende tekst. «Lukas videregående skole AS» er registerets
 * juridiske navn; i en setning er «Lukas videregående» det folk sier.
 */
export function cleanSchoolName(navn: string): string {
  return navn
    .replace(/\s+(AS|ASA|SA)$/i, "")
    .replace(/\s+skole$/i, "")
    .trim();
}

/**
 * Avslutt en setning som ender på et navn vi ikke eier.
 *
 * Destinasjonsskiltene hos AtB er forkortet med punktum («Romolslia via
 * Strindh.-Ladeham.»), og et påsatt setningspunktum ga «Ladeham..». Norsk
 * typografi lar forkortelsespunktumet gjøre begge jobbene.
 */
function endSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Avstand i meter, avrundet så tallet ikke later som det er målt med båndmål. */
function roundedMeters(m: number): string {
  const rounded = m < 200 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50;
  return `${rounded} meter`;
}

/** «1.–7. trinn». Tankestrek og punktum — ellers leses det som et telefonnummer. */
function trinnPhrase(fra: number | null, til: number | null): string | null {
  if (fra === null || til === null) return null;
  return fra === til ? `${fra}. trinn` : `${fra}.–${til}. trinn`;
}

/** «ett minutt» / «5 minutter». Sjøparken ligger ett minutt unna, ikke «1 minutter». */
function minutter(w: number): string {
  return w === 1 ? "ett minutt" : `${w} minutter`;
}

/** Hverdagenes felles åpningstid fra de cachede tidene, eller null. */
function hverdagstider(poi: POI): DayHours | null {
  const days = parseWeekdayText(poi.openingHoursJson?.weekday_text);
  return days ? weekdayConsensus(days) : null;
}

/** «RANHEIM» → «Ranheim». Kretsnavnene står i versaler i kommunens data. */
function titleCase(s: string): string {
  return s
    .toLocaleLowerCase("nb-NO")
    .replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) =>
      sep + ch.toLocaleUpperCase("nb-NO"),
    );
}

// ── Svarbyggere, én per board-spørsmål ──────────────────────────────────────

type AnswerBuilder = (input: FaqGeneratorInput) => string | undefined;

/**
 * SKOLEKRETS — den ene opplysningen en megler får spørsmål om hver eneste
 * visning. Formen er SOGNING: «boligen sogner til X». Den brukes bare her,
 * fordi den bare er sann her — barne- og ungdomstrinn har krets, ingenting
 * annet på boardet har det.
 */
function krets(input: FaqGeneratorInput): string | undefined {
  const { boardFacts, schoolZone, allPois } = input;
  const schools = boardFacts?.schools;
  const parts: string[] = [];

  const sentence = (
    kind: "barneskole" | "ungdomsskole",
    prefix: string,
  ): string | undefined => {
    const fact = schools?.[kind];
    if (fact) {
      const poi = findSchoolPoi(allPois, fact);
      const detaljer = [
        trinnPhrase(fact.trinnFra, fact.trinnTil),
        fact.elevtall !== null ? `${fact.elevtall} elever` : null,
      ].filter((d): d is string => Boolean(d));
      const hale = detaljer.length > 0 ? `, med ${ogJoin(detaljer)}` : "";
      return `${prefix} ${poiLink(fact.navn, poi)}${hale}.`;
    }
    // Uten registerfakta står kretsnavnet fortsatt igjen — det kommer fra
    // kommunens polygoner og er sant uansett om NSR-oppslaget lyktes.
    const zone = schoolZone?.[kind];
    return zone ? `${prefix} ${titleCase(zone)}-kretsen.` : undefined;
  };

  const barn = sentence("barneskole", "Boligen sogner til");
  if (barn) parts.push(barn);
  const ung = sentence("ungdomsskole", "Ungdomstrinnet hører til");
  if (ung) parts.push(ung);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * VIDEREGÅENDE — formen er NÆRHET OG REISETID, aldri sogning. Inntaket er
 * fylkeskommunalt og karakterbasert, så «du får plass her» er et løfte ingen
 * kan gi. Rangeringen står på bussetid og ikke luftlinje, fordi det er
 * spørsmålet som stilles.
 */
function vgsNaerhet(input: FaqGeneratorInput): string | undefined {
  const liste = input.boardFacts?.schools?.videregaaende ?? [];
  const medTid = liste.filter((v) => v.patterns.length > 0);
  if (medTid.length === 0) return undefined;

  const link = (v: (typeof medTid)[number]) =>
    poiLink(cleanSchoolName(v.navn), findSchoolPoi(input.allPois, v));

  const først = medTid[0];
  const tid = først.patterns[0];
  const linjer = tid.lines.length > 0 ? ` med linje ${ogJoin(tid.lines)}` : " til fots";
  const parts = [
    `${link(først)} er raskest å komme til: ${tid.minutes} minutter${linjer}.`,
  ];

  // Er den raskeste PRIVAT, er den nærmeste offentlige en annen opplysning — og
  // for de fleste den som avgjør. Er den allerede offentlig, er nummer to bare
  // et alternativ, og «nærmeste» ville vært feil ord om en som er lenger unna.
  if (først.offentlig) {
    const neste = medTid[1];
    if (neste) parts.push(`${link(neste)} tar ${neste.patterns[0].minutes} minutter.`);
  } else {
    const offentlig = medTid.find((v) => v.offentlig);
    if (offentlig) {
      parts.push(
        `${link(offentlig)} er nærmeste offentlige, ${offentlig.patterns[0].minutes} minutter.`,
      );
    }
  }

  return parts.join(" ");
}

/**
 * BARNEHAGE — formen er ANTALL, fordi én barnehage i gangavstand er en helt
 * annen situasjon for en forelder uten plass enn fem. Navnene kommer etter
 * tallet, ikke i stedet for det.
 */
function barnehageDekning(input: FaqGeneratorInput): string | undefined {
  const alle = byWalkThenDistance(inCategories(input.pois, "barnehage"), input.center);
  if (alle.length === 0) return undefined;

  const iGangavstand = alle.filter((p) => {
    const w = walkMinutes(p);
    return w !== undefined && w <= WALK_RADIUS_MIN;
  });

  const navngi = (pois: POI[]) =>
    ogJoin(
      pois.slice(0, MAX_NAMED).map((p) => {
        const w = walkMinutes(p);
        return `${namedPoi(p)}${w !== undefined ? ` på ${w} minutter` : ""}`;
      }),
    );

  if (iGangavstand.length === 0) {
    // Ingen målte gangtider (gammelt board) eller alle utenfor radiusen —
    // tallet står fortsatt, men uten et minuttall vi ikke har målt.
    return `${alle.length} ${alle.length === 1 ? "barnehage ligger" : "barnehager ligger"} i nabolaget, blant dem ${navngi(alle)}.`;
  }
  if (iGangavstand.length === 1) {
    return `Én barnehage ligger innenfor ${WALK_RADIUS_MIN} minutters gange: ${navngi(iGangavstand)}.`;
  }
  return `${iGangavstand.length} barnehager ligger innenfor ${WALK_RADIUS_MIN} minutters gange, blant dem ${navngi(iGangavstand)}.`;
}

/**
 * DAGLIGVARE — formen er NÆRMESTE PLUSS NESTE. Malen forbyr gangavstand i
 * POI-teksten fordi den er adresseavhengig; her ER den adressen, og da er
 * minuttallet det eneste som betyr noe.
 */
function hverdagshandel(input: FaqGeneratorInput): string | undefined {
  const butikker = byWalkThenDistance(
    inCategories(input.pois, "supermarket", "convenience"),
    input.center,
  );
  if (butikker.length === 0) return undefined;

  const beskriv = (p: POI) => {
    const w = walkMinutes(p);
    return { lenke: namedPoi(p), tid: w !== undefined ? `${w} minutter` : undefined };
  };

  const først = beskriv(butikker[0]);
  const parts = [
    først.tid
      ? `${først.lenke} er nærmest, ${først.tid} til fots.`
      : `${først.lenke} er nærmeste dagligvare.`,
  ];
  if (butikker[1]) {
    const neste = beskriv(butikker[1]);
    parts.push(
      neste.tid ? `${neste.lenke} ligger ${neste.tid} unna.` : `${neste.lenke} ligger også i nabolaget.`,
    );
  }
  return parts.join(" ");
}

/**
 * RESTAURANT — formen er et JA eller et forbehold, fordi spørsmålet er stilt
 * som et ja/nei-spørsmål. Bredden er svaret; en anbefaling ville vært en
 * vurdering, og dem gir vi ikke.
 */
function spisesteder(input: FaqGeneratorInput): string | undefined {
  const steder = byWalkThenDistance(
    inCategories(input.pois, "restaurant", "cafe", "bar", "bakery"),
    input.center,
  );
  if (steder.length === 0) return undefined;

  const iNaerheten = steder.filter((p) => {
    const w = walkMinutes(p);
    return w !== undefined && w <= DINING_RADIUS_MIN;
  });
  const navn = (pois: POI[]) => ogJoin(pois.slice(0, MAX_NAMED).map(namedPoi));

  if (iNaerheten.length >= 2) {
    return `Ja — ${iNaerheten.length} spisesteder ligger innenfor ${DINING_RADIUS_MIN} minutters gange, blant dem ${navn(iNaerheten)}.`;
  }
  const naermeste = steder[0];
  const w = walkMinutes(naermeste);
  return w !== undefined
    ? `Nærmeste spisested er ${namedPoi(naermeste)}, ${w} minutter til fots.`
    : `Nærmeste spisested er ${namedPoi(naermeste)}.`;
}

/** Holdeplass-POI-et for et NSR-stoppested, når det er på boardet. */
function stopPoi(input: FaqGeneratorInput, stopPlaceId: string): POI | undefined {
  return input.allPois.find((p) => p.enturStopplaceId === stopPlaceId);
}

/**
 * HOLDEPLASS — formen er AVSTAND I METER. Ikke minutter: gangtid til et
 * stoppested er ikke precomputet, og et estimat ville vært et tall leseren
 * ikke kan etterprøve. Meterne er målt av Entur.
 */
function naermesteHoldeplass(input: FaqGeneratorInput): string | undefined {
  const stops = input.boardFacts?.stops ?? [];
  if (stops.length === 0) return undefined;

  const [først, neste] = stops;
  const parts = [
    `${poiLink(først.name, stopPoi(input, først.stopPlaceId))} ligger ${roundedMeters(først.distanceM)} fra boligen.`,
  ];
  if (neste) {
    parts.push(
      `${poiLink(neste.name, stopPoi(input, neste.stopPlaceId))} er ${roundedMeters(neste.distanceM)} unna.`,
    );
  }
  return parts.join(" ");
}

/**
 * LINJER — formen er RETNING. Grupperingen per quay er ikke en detalj: en
 * beboer som skal til byen trenger å vite hvilken side av vegen hun skal stå
 * på, og `estimatedCalls` på stoppestedet blander de to
 * (`entur-quay-direction-grouping-Report-20260410`).
 */
function linjer(input: FaqGeneratorInput): string | undefined {
  const stops = input.boardFacts?.stops ?? [];
  const medRetninger = stops.filter((s) => s.directions.some((d) => d.lines.length > 0));
  if (medRetninger.length === 0) return undefined;

  const først = medRetninger[0];
  const retninger = først.directions
    .filter((d) => d.lines.length > 0)
    .map((d) => {
      const linje = `linje ${ogJoin(d.lines)}`;
      return d.destinations[0] ? `${linje} mot ${d.destinations[0]}` : linje;
    });
  const parts = [
    endSentence(`Fra ${poiLink(først.name, stopPoi(input, først.stopPlaceId))} går ${ogJoin(retninger)}`),
  ];

  // Linjer de andre holdeplassene har i tillegg — ikke en gjentakelse av de
  // samme numrene fra en annen adresse.
  const sett = new Set(først.directions.flatMap((d) => d.lines));
  const ekstra = new Map<string, string[]>();
  for (const stop of medRetninger.slice(1)) {
    const nye = [...new Set(stop.directions.flatMap((d) => d.lines))].filter((l) => !sett.has(l));
    if (nye.length > 0) ekstra.set(stop.name, nye);
    for (const l of nye) sett.add(l);
  }
  if (ekstra.size > 0) {
    const [navn, nye] = [...ekstra.entries()][0];
    const stop = medRetninger.find((s) => s.name === navn)!;
    parts.push(
      endSentence(`${poiLink(navn, stopPoi(input, stop.stopPlaceId))} gir i tillegg linje ${ogJoin(nye)}`),
    );
  }

  return parts.join(" ");
}

/**
 * SENTRUM — formen er REISETID MED ALTERNATIV. Den raskeste reisen svarer på
 * spørsmålet; en direkte reise uten bytte er en annen opplysning, og for mange
 * den som avgjør.
 */
function tilSentrum(input: FaqGeneratorInput): string | undefined {
  return cityCentreSentence(input.boardFacts);
}

function cityCentreSentence(boardFacts: ReportBoardFacts | undefined): string | undefined {
  const centre = boardFacts?.cityCentre;
  const raskest = centre?.patterns[0];
  if (!centre || !raskest) return undefined;

  const linjeTekst =
    raskest.lines.length > 0 ? ` med linje ${ogJoin(raskest.lines)}` : " til fots";
  const parts = [`Til ${centre.name} tar det ${raskest.minutes} minutter${linjeTekst}.`];

  const direkte = centre.patterns.find((p) => p.transfers === 0 && p.lines.length > 0);
  if (raskest.transfers > 0 && direkte) {
    parts.push(`Linje ${ogJoin(direkte.lines)} går direkte på ${direkte.minutes} minutter.`);
  }
  return parts.join(" ");
}

// ── Tema-spørsmålenes byggere (2026-08-23, minimum fem per tema) ────────────
//
// Alle henter fra data vi eier: POI-poolen med precomputet gangtid, og de
// cachede åpningstidene. To regler går igjen og er verdt å navngi:
//
// POSITIVE PÅSTANDER, ALDRI NEGATIVE. Poolen er recall-begrenset — at noe
// mangler i den beviser ikke at det mangler i virkeligheten. «X ligger 5
// minutter unna» er trygt; «det finnes ingen innenfor 10 minutter» er en
// påstand poolen ikke kan bære. Der fraværet må sies, scopes det til kartet.
//
// GANGTID KUN DER DEN ER MÅLT — som ellers i fila. Uten `travelTime.walk`
// nevnes stedet uten tall.

/** Nærmeste i kategorien(e), kun POI-er med målt gangtid. */
function naermesteMedTid(input: FaqGeneratorInput, ...cats: string[]): POI[] {
  return byWalkThenDistance(inCategories(input.pois, ...cats), input.center).filter(
    (p) => walkMinutes(p) !== undefined,
  );
}

/** APOTEK — nærmeste, én setning. */
function apotek(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "pharmacy");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} unna.`;
}

/**
 * TANNLEGE — formen er NÆRMESTE MED YRKESORD, fordi spørsmålet er et
 * finnes-spørsmål og navnet alene («Oris Dental») ikke svarer på det.
 */
function tannlege(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "dentist");
  if (!naermest) return undefined;
  return `Nærmeste tannlege er ${namedPoi(naermest)}, ${minutter(walkMinutes(naermest)!)} til fots.`;
}

/** KJØPESENTER — nærmeste, pluss storhandels-alternativet når det finnes. */
function kjopesenter(input: FaqGeneratorInput): string | undefined {
  const sentre = naermesteMedTid(input, "shopping");
  const [naermest, neste] = sentre;
  if (!naermest) return undefined;
  const parts = [
    `${namedPoi(naermest)} er nærmeste kjøpesenter, ${minutter(walkMinutes(naermest)!)} til fots.`,
  ];
  if (neste) {
    parts.push(`For større handel er ${namedPoi(neste)} alternativet, ${minutter(walkMinutes(neste)!)} unna.`);
  }
  return parts.join(" ");
}

/**
 * UTEN BIL — terskelspørsmålet. Svaret er hvilke ÆREND-typer som dekkes til
 * fots, ikke hvilke butikker: én forelder med handlepose bryr seg om «får jeg
 * gjort det», ikke om kjedenavnet. Ærendene navngis bare når de er dekket —
 * aldri «resten krever bil», for det vet ikke poolen.
 */
const ÆREND: ReadonlyArray<{ navn: string; cats: string[] }> = [
  { navn: "dagligvare", cats: ["supermarket", "convenience"] },
  { navn: "apotek", cats: ["pharmacy"] },
  { navn: "post", cats: ["post"] },
  { navn: "bank", cats: ["bank"] },
  { navn: "frisør", cats: ["haircare"] },
  { navn: "kjøpesenter", cats: ["shopping"] },
];

function utenBil(input: FaqGeneratorInput): string | undefined {
  const dekket = ÆREND.filter(({ cats }) =>
    naermesteMedTid(input, ...cats).some((p) => walkMinutes(p)! <= WALK_RADIUS_MIN),
  ).map(({ navn }) => navn);

  if (dekket.length >= 4) {
    return `Hverdagsærendene er i gangavstand: ${ogJoin(dekket)} ligger alle innenfor ${WALK_RADIUS_MIN} minutter til fots.`;
  }
  if (dekket.length >= 2) {
    return `Deler av hverdagen er i gangavstand: ${ogJoin(dekket)} ligger innenfor ${WALK_RADIUS_MIN} minutter til fots.`;
  }
  return undefined; // Én eller null ærend-typer: ikke nok til et ærlig ja.
}

/** LEKEPLASS — nærmeste først, antallet innenfor radiusen som hale. */
function lekeplass(input: FaqGeneratorInput): string | undefined {
  const alle = naermesteMedTid(input, "lekeplass");
  const [naermest] = alle;
  if (!naermest) return undefined;
  const flere = alle.filter(
    (p) => p !== naermest && walkMinutes(p)! <= WALK_RADIUS_MIN,
  ).length;
  const hale =
    flere > 0
      ? ` — og ${flere === 1 ? "én til ligger" : `${flere} til ligger`} innenfor ${WALK_RADIUS_MIN} minutters gange`
      : "";
  return `${namedPoi(naermest)} er nærmeste lekeplass, ${minutter(walkMinutes(naermest)!)} unna${hale}.`;
}

/** FRITID UTENOM SKOLE/BARNEHAGE — fritidsklubben, når den finnes. Kuratert vinner. */
function oppvekstFritid(input: FaqGeneratorInput): string | undefined {
  const [klubb] = naermesteMedTid(input, "fritidsklubb");
  if (!klubb) return undefined;
  return `${namedPoi(klubb)} er fritidsklubben i området, ${minutter(walkMinutes(klubb)!)} til fots.`;
}

/** KAFÉ — nærmeste, med åpningstidene som hale når hverdagene er entydige. */
function kafe(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "cafe");
  if (!naermest) return undefined;
  const tider = hverdagstider(naermest);
  const hale = tider ? `, med åpent ${formatHourRange(tider)} på hverdager` : "";
  return `${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} til fots${hale}.`;
}

/** BAKERI — finnes-spørsmål, besvart med stedet. */
function bakeri(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "bakery");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} baker i nabolaget, ${minutter(walkMinutes(naermest)!)} unna.`;
}

/** PUB/BAR — stedet svarer; et «Ja —» ville kollidert med spisesteder-formen. */
function uteliv(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "bar");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} til fots.`;
}

/**
 * SØNDAGSÅPENT — lister stedene de cachede tidene VET er åpne på søndag.
 * Steder uten cachede tider påstås ingenting om, i tråd med positiv-regelen.
 */
function sondagsapent(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "restaurant", "cafe", "bar", "bakery");
  const aapne: Array<{ poi: POI; tider: DayHours }> = [];
  for (const poi of kandidater) {
    const days = parseWeekdayText(poi.openingHoursJson?.weekday_text);
    if (!days) continue;
    const sondag = sundayHours(days);
    if (sondag && sondag !== "closed") aapne.push({ poi, tider: sondag });
  }
  if (aapne.length === 0) return undefined;

  const navngitt = aapne
    .slice(0, MAX_NAMED)
    .map(({ poi, tider }) => `${namedPoi(poi)} (${formatHourRange(tider)})`);
  const flere = aapne.length - Math.min(aapne.length, MAX_NAMED);
  const hale = flere > 0 ? `, og ${flere} til` : "";
  return `På søndager holder ${ogJoin(navngitt)} åpent${hale}.`;
}

/** GRØNTOMRÅDE — nærmeste, park eller friområde. */
function gronntomrade(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "park", "outdoor");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} er nærmeste grøntområde, ${minutter(walkMinutes(naermest)!)} til fots.`;
}

/** BADING — nærmeste badeplass, med alternativene som hale. */
function bading(input: FaqGeneratorInput): string | undefined {
  const alle = naermesteMedTid(input, "badeplass");
  const [naermest, ...resten] = alle;
  if (!naermest) return undefined;
  const parts = [
    `${namedPoi(naermest)} er nærmeste badeplass, ${minutter(walkMinutes(naermest)!)} til fots.`,
  ];
  if (resten.length > 0) {
    parts.push(`${ogJoin(resten.slice(0, MAX_NAMED).map(namedPoi))} er ${resten.length === 1 ? "alternativet" : "alternativene"}.`);
  }
  return parts.join(" ");
}

/** BÅTLIV — marina/båtforening, nærmeste pluss én. */
function batliv(input: FaqGeneratorInput): string | undefined {
  const [naermest, neste] = naermesteMedTid(input, "marina");
  if (!naermest) return undefined;
  const hale = neste ? `, og ${namedPoi(neste)} ${minutter(walkMinutes(neste)!)}` : "";
  return `${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} unna${hale}.`;
}

/** TOG — stasjonene i poolen, nærmeste først. Kuratert vinner der det finnes. */
function tog(input: FaqGeneratorInput): string | undefined {
  const [naermest, neste] = naermesteMedTid(input, "train");
  if (!naermest) return undefined;
  const hale = neste ? `, og ${namedPoi(neste)} ${minutter(walkMinutes(neste)!)}` : "";
  return `${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} til fots${hale}.`;
}

/**
 * LADING — «på kartet» scoper påstanden når nærmeste er langt unna: poolen
 * kan ikke garantere at det ikke finnes en lader den ikke kjenner.
 */
function lading(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "charging_station");
  if (!naermest) return undefined;
  const w = walkMinutes(naermest)!;
  return w <= WALK_RADIUS_MIN
    ? `${namedPoi(naermest)} har offentlig lading, ${minutter(w)} til fots.`
    : `Nærmeste offentlige ladepunkt på kartet er ${namedPoi(naermest)}, ${minutter(w)} til fots.`;
}

/** BYSYKKEL — stativet, når byen har ordningen her. */
function bysykkel(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "bike");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} har bysykkelstativ, ${minutter(walkMinutes(naermest)!)} unna.`;
}

/** TRENINGSSENTER — nærmeste pluss alternativet. */
function treningssenter(input: FaqGeneratorInput): string | undefined {
  const [naermest, neste] = naermesteMedTid(input, "gym");
  if (!naermest) return undefined;
  const parts = [`${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} unna.`];
  if (neste) {
    parts.push(`${namedPoi(neste)} er alternativet, ${minutter(walkMinutes(neste)!)} til fots.`);
  }
  return parts.join(" ");
}

/**
 * TIDLIG/SENT — svarer med YTTERPUNKTENE fra de cachede åpningstidene:
 * hvem åpner tidligst, hvem stenger senest. Terskler: tidlig er ≤ 06,
 * sent er ≥ 23 — utenfor en vanlig arbeidsdag på begge sider.
 */
function treneTidligSent(input: FaqGeneratorInput): string | undefined {
  const medTider = naermesteMedTid(input, "gym")
    .map((poi) => ({ poi, tider: hverdagstider(poi) }))
    .filter((g): g is { poi: POI; tider: DayHours } => g.tider !== null);
  if (medTider.length === 0) return undefined;

  const tidligst = medTider.reduce((a, b) => (b.tider.openMin < a.tider.openMin ? b : a));
  const senest = medTider.reduce((a, b) => (b.tider.closeMin > a.tider.closeMin ? b : a));
  const erTidlig = tidligst.tider.openMin <= 6 * 60;
  const erSent = senest.tider.closeMin >= 23 * 60;

  if (erTidlig && erSent) {
    if (tidligst.poi === senest.poi) {
      return `Både tidlig og sent: ${namedPoi(tidligst.poi)} holder åpent ${formatHourRange(tidligst.tider)} på hverdager.`;
    }
    const stengetid =
      senest.tider.closeMin === 1440
        ? "ved midnatt"
        : formatHourRange(senest.tider).split("–")[1];
    return `Både tidlig og sent: ${namedPoi(tidligst.poi)} åpner ${formatHourRange(tidligst.tider).split("–")[0]} på hverdager, og ${namedPoi(senest.poi)} stenger først ${stengetid}.`;
  }
  // Uten et ytterpunkt er de faktiske tidene fortsatt svaret på spørsmålet.
  return `${namedPoi(tidligst.poi)} holder åpent ${formatHourRange(tidligst.tider)} på hverdager.`;
}

/** SVØMMEHALL — finnes-spørsmål. */
function svommehall(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "swimming");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} er nærmeste svømmehall, ${minutter(walkMinutes(naermest)!)} til fots.`;
}

/** TRENINGSPARK — utendørs apparater. */
function treningspark(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "fitness_park");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} er nærmeste utendørs treningspark, ${minutter(walkMinutes(naermest)!)} til fots.`;
}

const ANSWER_BUILDERS: Record<string, AnswerBuilder> = {
  krets,
  "vgs-naerhet": vgsNaerhet,
  "barnehage-dekning": barnehageDekning,
  hverdagshandel,
  spisesteder,
  "naermeste-holdeplass": naermesteHoldeplass,
  linjer,
  "til-sentrum": tilSentrum,
  // Tema-spørsmålene (2026-08-23). `turstier`, `marka` og `idrettslag` har
  // ingen bygger med vilje — de er kuratert-eneste, se THEME_BOARD_QUESTIONS.
  apotek,
  tannlege,
  kjopesenter,
  "uten-bil": utenBil,
  lekeplass,
  "oppvekst-fritid": oppvekstFritid,
  kafe,
  bakeri,
  uteliv,
  sondagsapent,
  gronntomrade,
  bading,
  batliv,
  tog,
  lading,
  bysykkel,
  treningssenter,
  "trene-tidlig-sent": treneTidligSent,
  svommehall,
  treningspark,
};

// ── Montering ───────────────────────────────────────────────────────────────

/**
 * FAQ-en for ett tema: deterministiske svar i malverkets rekkefølge, flettet
 * med strøkets kuraterte overstyringer.
 *
 * Kuratert svar på samme id VINNER og bytter ikke plass i rekkefølgen — det er
 * en bedre formulering av samme spørsmål, ikke et nytt. Kuratert svar på en id
 * det deterministiske laget ikke klarte, kommer inn på malverkets plass.
 * Kurators egne id-er legges til til slutt, og krever eget spørsmål.
 */
export function generateCategoryFaq(input: FaqGeneratorInput): FaqEntry[] {
  const questions = faqQuestionsForTheme(input.themeId, input.categoryIds);
  const curatedById = new Map((input.curated ?? []).map((c) => [c.id, c]));
  const brukt = new Set<string>();
  const entries: FaqEntry[] = [];

  for (const { question } of questions) {
    const kuratert = curatedById.get(question.id);
    if (kuratert) {
      brukt.add(question.id);
      entries.push({
        id: question.id,
        question: kuratert.spørsmål ?? question.spørsmål,
        answer: kuratert.svar,
        source: "curated",
      });
      continue;
    }
    const svar = ANSWER_BUILDERS[question.id]?.(input);
    if (!svar) continue; // Uten faktum, ingen rad. Aldri et diktet svar.
    entries.push({
      id: question.id,
      question: question.spørsmål,
      answer: svar,
      source: "deterministic",
    });
  }

  for (const kuratert of input.curated ?? []) {
    if (brukt.has(kuratert.id)) continue;
    // Kurators eget spørsmål må ha en spørsmålstekst — uten den er svaret
    // hjemløst, og å finne på et spørsmål ville vært å dikte i motsatt ende.
    if (!kuratert.spørsmål) continue;
    entries.push({
      id: kuratert.id,
      question: kuratert.spørsmål,
      answer: kuratert.svar,
      source: "curated",
    });
  }

  return entries;
}

export interface GlobalFaqInput {
  boardFacts?: ReportBoardFacts;
  curated?: readonly ReportFaqAnswer[];
  /** Tema-IDer og etiketter som finnes på boardet — kilden til kategorilenker. */
  themes: ReadonlyArray<{ id: string; label: string }>;
}

/** Spørsmåls-id for det deterministiske reise-svaret på boardnivå. */
export const GLOBAL_TRANSIT_ID = "til-byen";

/**
 * Den globale nabolags-FAQ-en: få spørsmål, vist når ingen kategori er valgt.
 *
 * Bevisst SLANK. Den skal binde flatene sammen, ikke konkurrere med
 * kategori-FAQ-ene — derfor lenker svarene inn i kategoriene framfor å
 * gjenta innholdet deres.
 */
export function generateGlobalFaq(input: GlobalFaqInput): FaqEntry[] {
  const entries: FaqEntry[] = [];
  const brukt = new Set<string>();

  // Kuratert først: «hva kjennetegner området?» er strøkets stemme, og den
  // står øverst når den finnes.
  for (const kuratert of input.curated ?? []) {
    if (kuratert.id === GLOBAL_TRANSIT_ID) continue; // håndteres under
    if (!kuratert.spørsmål) continue;
    brukt.add(kuratert.id);
    entries.push({
      id: kuratert.id,
      question: kuratert.spørsmål,
      answer: kuratert.svar,
      source: "curated",
    });
  }

  const transitQuestion = "Hvordan kommer jeg meg til byen?";
  const kuratertTransit = (input.curated ?? []).find((c) => c.id === GLOBAL_TRANSIT_ID);
  if (kuratertTransit) {
    entries.push({
      id: GLOBAL_TRANSIT_ID,
      question: kuratertTransit.spørsmål ?? transitQuestion,
      answer: kuratertTransit.svar,
      source: "curated",
    });
  } else {
    const sentrum = cityCentreSentence(input.boardFacts);
    if (sentrum) {
      const transport = input.themes.find((t) => t.id === "transport");
      const lenke = transport
        ? ` Se [${transport.label}](category:${transport.id}) for holdeplassene i nabolaget.`
        : "";
      entries.push({
        id: GLOBAL_TRANSIT_ID,
        question: transitQuestion,
        answer: `${sentrum}${lenke}`,
        source: "deterministic",
      });
    }
  }

  return entries;
}
