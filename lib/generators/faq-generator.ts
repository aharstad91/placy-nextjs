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

import { isAnchorPOI } from "@/lib/board/anchor-poi";
import {
  AREA_BOARD_QUESTIONS,
  faqQuestionsForTheme,
} from "@/lib/editorial/category-specs";
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

/**
 * Et sted slik FAQ-en ser det: POI-en, pluss ankeret det eventuelt ligger inne i.
 *
 * Board-laget ABSORBERER medlemmene av et kjøpesenter inn i senterets kort (R5),
 * og fram til 2026-09-06 fikk FAQ-en den absorberte lista. Konsekvensen var at
 * hvert sted inne i et senter var usynlig for svarene: på Wesselsløkka svarte
 * apotek-raden «Apotek 1 Strindheim, 17 minutter» mens Boots Apotek lå 8
 * minutter unna inne i Valentinlyst Senter, og bakeri-raden bommet med elleve
 * minutter på samme måte. 220 av boardets 1 615 steder var medlemmer.
 *
 * Medlemmet beholder sitt eget navn, sin egen gangtid og sine egne
 * åpningstider — det er dem spørsmålet handler om. `faqAnchor` bærer bare det
 * ene medlemmet ikke kan svare på selv: HVOR det ligger, og hvilket kort på
 * kartet som åpner når leseren klikker.
 */
type FaqPoi = POI & { faqAnchor?: { id: string; name: string } };

/** «I gangavstand» for FAQ-svarene. Ti minutter er ærendsavstand til fots. */
export const WALK_RADIUS_MIN = 10;

/** Restaurantspørsmålet spør om man slipper å dra til byen — da er ramma videre. */
const DINING_RADIUS_MIN = 15;

/** Så mange steder et svar navngir før det blir en liste framfor en setning. */
const MAX_NAMED = 2;

/**
 * Sykkeltiden som gjør at et sted utenfor gangavstand fortsatt nevnes med
 * sykkel og ikke bil. Over dette er bilen det ærlige alternativet.
 */
const BIKE_RADIUS_MIN = 15;

/**
 * «I nærheten» for innendørs-spørsmålet på Området: et kvarter til fots ELLER
 * et kvarter med sykkel. Familiens regnværsdag går lenger enn ærendet, men
 * Området skal ikke sende dem 40 minutter av gårde — det svaret bor i
 * Opplevelsers egne rader.
 */
const INNENDORS_RADIUS_MIN = 15;

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

/**
 * Generiske ord i et senternavn. Brukes bare til å finne senterets EGENNAVN, så
 * «Valentinlyst Senter» kan gjenkjennes i «Rosenborg bakeri Valentinlyst».
 */
const ANCHOR_GENERIC_WORDS = new Set([
  "senter",
  "senteret",
  "centeret",
  "center",
  "shopping",
  "mall",
  "arena",
  "torg",
  "kvartalet",
  "gården",
  "garden",
  "city",
  "as",
]);

/**
 * Sier medlemmets navn allerede hvor det ligger?
 *
 * Norske senterbutikker heter ofte etter senteret: «Fresh Fitness Valentinlyst»,
 * «Dromedar Kaffebar Sirkus». Å legge på « i Valentinlyst Senter» der gir en
 * setning som sier stedet to ganger. Sammenligningen går på senterets egennavn,
 * ikke hele navnet, fordi det er den delen butikken låner.
 */
function nameCarriesAnchor(poiName: string, anchorName: string): boolean {
  const haystack = poiName.toLocaleLowerCase("nb-NO");
  return anchorName
    .toLocaleLowerCase("nb-NO")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !ANCHOR_GENERIC_WORDS.has(w))
    .some((w) => haystack.includes(w));
}

/**
 * Kortform: rydd navnet OG lenk det, i ett.
 *
 * Ligger stedet inne i et anker, LENKER vi til ankeret og ikke til medlemmet.
 * Medlemmet har ingen markør på kartet — det er absorbert — så en lenke dit
 * ville degradert til ren tekst (`boardLinkResolvers`), og klikket ville ikke
 * gjort noe. Ankeret er dessuten det ærlige svaret på «hvor er det»: det er
 * bygget du går inn i.
 */
function namedPoi(poi: FaqPoi): string {
  const navn = cleanPoiName(poi.name);
  const anchor = poi.faqAnchor;
  if (!anchor) return poiLink(navn, poi);
  const label = nameCarriesAnchor(navn, anchor.name) ? navn : `${navn} i ${anchor.name}`;
  return `[${label}](poi:${anchor.id})`;
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

/** Precomputet sykkeltid. Samme kontrakt som `walkMinutes`: et tall eller ingenting. */
function bikeMinutes(poi: POI): number | undefined {
  const bike = poi.travelTime?.bike;
  return typeof bike === "number" && Number.isFinite(bike) ? bike : undefined;
}

/** Precomputet biltid. Samme kontrakt som `walkMinutes`. */
function carMinutes(poi: POI): number | undefined {
  const car = poi.travelTime?.car;
  return typeof car === "number" && Number.isFinite(car) ? car : undefined;
}

/**
 * Det raskere alternativet til å gå, når stedet ligger utenfor gangavstand.
 *
 * Sykkel når sykkelturen er innenfor `BIKE_RADIUS_MIN`, ellers bil. ALDRI
 * begge: «37 til fots, 17 med sykkel eller 9 med bil» er en liste, ikke en
 * setning, og leseren trenger ett alternativ — det hun faktisk ville valgt.
 * Innenfor gangavstand finnes ikke noe alternativ å nevne: da går man.
 */
function alternativTid(poi: POI): string | undefined {
  const w = walkMinutes(poi);
  if (w === undefined || w <= WALK_RADIUS_MIN) return undefined;
  const bike = bikeMinutes(poi);
  if (bike !== undefined && bike <= BIKE_RADIUS_MIN) return `${bike} med sykkel`;
  const car = carMinutes(poi);
  return car !== undefined ? `${car} med bil` : undefined;
}

/**
 * Reisetiden i en leddsetning: «8 minutter til fots», eller utenfor
 * gangavstand «42 minutter til fots eller 18 med sykkel». Bare målte tall —
 * kalleren har alt filtrert på `walkMinutes`.
 */
function reisetid(poi: POI): string {
  const tilFots = `${minutter(walkMinutes(poi)!)} til fots`;
  const alt = alternativTid(poi);
  return alt ? `${tilFots} eller ${alt}` : tilFots;
}

/**
 * Samme opplysning etter «ligger»: «12 minutter unna», eller «42 minutter unna
 * til fots, eller 18 med sykkel». Egen ordstilling fordi «ligger 42 minutter
 * til fots eller 18 med sykkel unna» ikke er norsk.
 */
function unna(poi: POI): string {
  const w = minutter(walkMinutes(poi)!);
  const alt = alternativTid(poi);
  return alt ? `${w} unna til fots, eller ${alt}` : `${w} unna`;
}

/**
 * Kategori-portet ordfilter på navnet.
 *
 * Google-kategorien er ofte bredere enn spørsmålet: `library` rommer NTNU
 * Marinbiblioteket, `kirke` rommer sykehjemskapellet, `doctor` rommer
 * urologen. Filteret går ALDRI på navnet alene — kalleren har allerede
 * begrenset til én kategori, og ordet avgjør bare innenfor den (samme regel
 * som `norskStedsnavn` i pipelinen). `krever` er en allowlist (minst ett ord
 * må finnes), `utelukker` en blocklist (ingen av ordene får finnes).
 */
function navnefilter(
  poi: POI,
  filter: { krever?: readonly string[]; utelukker?: readonly string[] },
): boolean {
  const navn = poi.name.toLocaleLowerCase("nb-NO");
  if (filter.utelukker?.some((ord) => navn.includes(ord))) return false;
  if (filter.krever && !filter.krever.some((ord) => navn.includes(ord))) return false;
  return true;
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

/**
 * Er stedet innenfor det spørsmålet kaller «i nærheten»?
 *
 * Flere av spørsmålene lover nærhet i selve teksten — «Finnes det kafé i
 * NABOLAGET?», «Er det en pub eller bar I NÆRHETEN?» — og byggerne svarte med
 * det nærmeste som fantes, uansett hvor langt det var. På Wesselsløkka ga det
 * «Filo Café ligger 22 minutter til fots» som svar på om det finnes kafé i
 * nabolaget. Tallet var riktig og svaret var feil.
 *
 * Løsningen er IKKE å droppe raden: at nærmeste kafé ligger 22 minutter unna er
 * en opplysning en kjøper vil ha. Den er å SCOPE påstanden, slik `lading` alt
 * gjorde — «Nærmeste X på kartet er …». Da svarer setningen på det den kan
 * svare på, og lover ikke nærhet den ikke har.
 */
function erINaerheten(poi: FaqPoi): boolean {
  const w = walkMinutes(poi);
  return w !== undefined && w <= WALK_RADIUS_MIN;
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
  const w = walkMinutes(naermest)!;
  return erINaerheten(naermest)
    ? `Nærmeste tannlege er ${namedPoi(naermest)}, ${minutter(w)} til fots.`
    : `Nærmeste tannlege på kartet er ${namedPoi(naermest)}, ${minutter(w)} til fots.`;
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
 * Ærendtypene bak `uten-bil` og `tjenester-samme-sted`. Svaret er hvilke
 * TYPER som dekkes, ikke hvilke butikker: én forelder med handlepose bryr seg
 * om «får jeg gjort det», ikke om kjedenavnet. Ærendene navngis bare når de er
 * dekket — aldri «resten krever bil», for det vet ikke poolen.
 */
const ÆREND: ReadonlyArray<{ navn: string; cats: string[] }> = [
  { navn: "dagligvare", cats: ["supermarket", "convenience"] },
  { navn: "apotek", cats: ["pharmacy"] },
  { navn: "post", cats: ["post"] },
  { navn: "bank", cats: ["bank"] },
  { navn: "frisør", cats: ["haircare"] },
  { navn: "kjøpesenter", cats: ["shopping"] },
  // Ærend som ligger i ANDRE temaer enn Hverdagsliv, og som derfor var
  // usynlige så lenge svaret leste temaets egen liste. Det er de samme
  // gåturene: bakeriet på veg hjem, treningssenteret etter jobb,
  // barnehagelevering før, og et bysykkelstativ som gjør resten gåbart.
  { navn: "bakeri", cats: ["bakery"] },
  { navn: "treningssenter", cats: ["gym"] },
  { navn: "barnehage", cats: ["barnehage"] },
  { navn: "bysykkel", cats: ["bike"] },
];

/** Ærendtypene et sett steder dekker, i `ÆREND`-lista si rekkefølge. */
function aerendtyper(pois: readonly POI[]): string[] {
  return ÆREND.filter(({ cats }) => {
    const set = new Set(cats);
    return pois.some((p) => set.has(p.category.id));
  }).map(({ navn }) => navn);
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
  const w = minutter(walkMinutes(naermest)!);
  return erINaerheten(naermest)
    ? `${namedPoi(naermest)} ligger ${w} til fots${hale}.`
    : `Nærmeste kafé på kartet er ${namedPoi(naermest)}, ${w} til fots${hale}.`;
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
  const w = minutter(walkMinutes(naermest)!);
  return erINaerheten(naermest)
    ? `${namedPoi(naermest)} ligger ${w} til fots.`
    : `Nærmeste pub eller bar på kartet er ${namedPoi(naermest)}, ${w} til fots.`;
}

/**
 * SØNDAGSÅPENT — lister stedene de cachede tidene VET er åpne på søndag.
 * Steder uten cachede tider påstås ingenting om, i tråd med positiv-regelen.
 */
function sondagsapent(input: FaqGeneratorInput): string | undefined {
  // Samme ramme som `spisesteder`: spørsmålet er om du slipper å dra til byen
  // på en søndag, ikke om det finnes en åpen dør et sted i kommunen. Uten
  // rammen listet svaret steder 40 minutter unna som «åpent på søndag».
  const kandidater = naermesteMedTid(input, "restaurant", "cafe", "bar", "bakery").filter(
    (p) => walkMinutes(p)! <= DINING_RADIUS_MIN,
  );
  const aapne: Array<{ poi: FaqPoi; tider: DayHours }> = [];
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
    erINaerheten(naermest)
      ? `${namedPoi(naermest)} er nærmeste badeplass, ${minutter(walkMinutes(naermest)!)} til fots.`
      : `Nærmeste badeplass på kartet er ${namedPoi(naermest)}, ${minutter(walkMinutes(naermest)!)} til fots.`,
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
  const w = minutter(walkMinutes(naermest)!);
  return erINaerheten(naermest)
    ? `${namedPoi(naermest)} ligger ${w} unna${hale}.`
    : `Nærmeste marina på kartet er ${namedPoi(naermest)}, ${w} unna${hale}.`;
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
  const w = minutter(walkMinutes(naermest)!);
  return erINaerheten(naermest)
    ? `${namedPoi(naermest)} har bysykkelstativ, ${w} unna.`
    : `Nærmeste bysykkelstativ på kartet er ${namedPoi(naermest)}, ${w} unna.`;
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

/** Åpner senteret før dette, teller det som «før jobb». */
const TRENE_TIDLIG_MIN = 6 * 60;

/** Stenger senteret etter dette, teller det som «sent på kvelden». */
const TRENE_SENT_MIN = 23 * 60;

/**
 * TIDLIG/SENT — svarer med YTTERPUNKTENE fra de cachede åpningstidene:
 * hvem åpner tidligst, hvem stenger senest.
 *
 * ET YTTERPUNKT MÅ FINNES, ELLERS INGEN RAD. Fram til 2026-09-06 falt bygger-en
 * tilbake på «X holder åpent 08–15.45 på hverdager» når hverken tidlig- eller
 * sen-terskelen var nådd. Det er et sant utsagn som svarer NEI på spørsmålet
 * uten å si nei — og på Wesselsløkka kom setningen fra et studentvelferdskontor
 * 37 minutter unna, feilkategorisert som treningssenter. Kravet om et
 * ytterpunkt luker ut begge deler: et kontor med kontortid blir aldri hverken
 * det som åpner først eller det som stenger sist.
 */
function treneTidligSent(input: FaqGeneratorInput): string | undefined {
  const medTider = naermesteMedTid(input, "gym")
    .map((poi) => ({ poi, tider: hverdagstider(poi) }))
    .filter((g): g is { poi: FaqPoi; tider: DayHours } => g.tider !== null);
  if (medTider.length === 0) return undefined;

  const tidligst = medTider.reduce((a, b) => (b.tider.openMin < a.tider.openMin ? b : a));
  const senest = medTider.reduce((a, b) => (b.tider.closeMin > a.tider.closeMin ? b : a));
  const erTidlig = tidligst.tider.openMin <= TRENE_TIDLIG_MIN;
  const erSent = senest.tider.closeMin >= TRENE_SENT_MIN;

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
  if (erTidlig) {
    return `${namedPoi(tidligst.poi)} åpner ${formatHourRange(tidligst.tider).split("–")[0]} på hverdager.`;
  }
  if (erSent) {
    return `${namedPoi(senest.poi)} holder åpent til ${klokkeslett(senest.tider.closeMin)} på hverdager.`;
  }
  return undefined; // Verken tidlig eller sent: spørsmålet har ikke et ja her.
}

/** SVØMMEHALL — finnes-spørsmål. */
function svommehall(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "swimming");
  if (!naermest) return undefined;
  const w = minutter(walkMinutes(naermest)!);
  return erINaerheten(naermest)
    ? `${namedPoi(naermest)} er nærmeste svømmehall, ${w} til fots.`
    : `Nærmeste svømmehall på kartet er ${namedPoi(naermest)}, ${w} til fots.`;
}

/** TRENINGSPARK — utendørs apparater. */
function treningspark(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "fitness_park");
  if (!naermest) return undefined;
  const w = minutter(walkMinutes(naermest)!);
  return erINaerheten(naermest)
    ? `${namedPoi(naermest)} er nærmeste utendørs treningspark, ${w} til fots.`
    : `Nærmeste utendørs treningspark på kartet er ${namedPoi(naermest)}, ${w} til fots.`;
}

// ── Katalogens S-spørsmål (2026-09-06) ──────────────────────────────────────
//
// Setningsformene er skrevet i `docs/research/2026-09-06-faq-byggere-
// setningsformer-fable.md` og implementeres her ordrett. Tre ting går igjen:
//
// FILTERET ER ET KRAV, IKKE EN FINPUSS. Målt på Wesselsløkka 2026-09-06 var
// tre av fire «nærmeste» i Opplevelser feil sted: et forskningsbibliotek, et
// monument, et sykehjemskapell. Google-kategorien er bredere enn spørsmålet, og
// `navnefilter` lukker gapet innenfor kategorien.
//
// «PÅ KARTET» UTENFOR RADIUSEN, som ellers i fila. Radiusen er `WALK_RADIUS_MIN`
// med mindre spørsmålet er et serverings-spørsmål (`DINING_RADIUS_MIN`).
//
// REISETIDEN BÆRER ETT ALTERNATIV utenfor gangavstand (`reisetid`): sykkel når
// den er innenfor et kvarter, ellers bil. Sykkel- og biltid er precomputet
// sammen med gangtiden, og brukes bare der de er det.

/**
 * Åpner de to stedene SAMME kort på kartet?
 *
 * Er begge medlemmer av det samme ankeret, lenker begge navnene til
 * senterets kort, og «X er nærmeste kino. Y ligger 38 minutter unna» blir to
 * navn på én dør. Målt på Wesselsløkka: Trondheim Film Club og Cinemateket
 * ligger begge i Olavskvartalet, og raden navnga dem begge med samme
 * minuttall og samme lenke.
 */
function sammeKort(a: FaqPoi, b: FaqPoi): boolean {
  const kortA = a.faqAnchor?.id ?? a.id;
  const kortB = b.faqAnchor?.id ?? b.id;
  return kortA === kortB;
}

/**
 * Den vanligste svarformen i katalogen: nærmeste sted med SLAGSORD, og den
 * neste som hale.
 *
 * «[X] er nærmeste legesenter, 8 minutter til fots.» innenfor radiusen;
 * «Nærmeste legesenter på kartet er [X], 42 minutter til fots eller 18 med
 * sykkel.» utenfor. Slagsordet er en funksjon fordi noen spørsmål svarer med
 * det ordet navnet bærer (folkebibliotek, kapell, menighetshus).
 */
function naermesteAvSlag(
  kandidater: readonly FaqPoi[],
  slag: (poi: FaqPoi) => string,
  radius: number = WALK_RADIUS_MIN,
): string | undefined {
  const [naermest] = kandidater;
  if (!naermest) return undefined;
  const w = walkMinutes(naermest)!;
  const parts = [
    w <= radius
      ? `${namedPoi(naermest)} er nærmeste ${slag(naermest)}, ${minutter(w)} til fots.`
      : `Nærmeste ${slag(naermest)} på kartet er ${namedPoi(naermest)}, ${reisetid(naermest)}.`,
  ];
  const neste = kandidater.find((p) => !sammeKort(p, naermest));
  if (neste) parts.push(`${namedPoi(neste)} ligger ${unna(neste)}.`);
  return parts.join(" ");
}

/** Nærmeste i kategorien(e) fra ET VILKÅRLIG sett, kun POI-er med målt gangtid. */
function naermesteMedTidFra(
  pois: readonly FaqPoi[],
  center: Coordinates,
  ...cats: string[]
): FaqPoi[] {
  return byWalkThenDistance(inCategories(pois, ...cats), center).filter(
    (p) => walkMinutes(p) !== undefined,
  );
}

/**
 * SKOLEVEI — formen er ET TALL, ikke nærhet. Skolen er gitt av kretsen, aldri
 * «nærmeste skole-POI», så det finnes ingen «på kartet»-variant: spørsmålet
 * lover ikke at skolen er nær, det spør hvor langt det er. Mangler én av
 * skolene målt gangtid, utelates DEN setningen — aldri et estimat.
 */
function skolevei(input: FaqGeneratorInput): string | undefined {
  const schools = input.boardFacts?.schools;
  const maal = (fact: { navn: string; orgnr: string } | undefined) => {
    if (!fact) return undefined;
    const poi = findSchoolPoi(input.allPois, fact);
    const w = poi ? walkMinutes(poi) : undefined;
    return w === undefined ? undefined : { lenke: poiLink(fact.navn, poi), w };
  };
  const barn = maal(schools?.barneskole);
  const ung = maal(schools?.ungdomsskole);

  if (barn && ung) {
    return `Skoleveien til ${barn.lenke} er ${minutter(barn.w)} til fots, og til ${ung.lenke}, der ungdomstrinnet hører til, ${minutter(ung.w)}.`;
  }
  if (barn) return `Skoleveien til ${barn.lenke} er ${minutter(barn.w)} til fots.`;
  if (ung) {
    return `Skoleveien til ${ung.lenke}, der ungdomstrinnet hører til, er ${minutter(ung.w)} til fots.`;
  }
  return undefined;
}

/**
 * Ord som gjør en `doctor`-rad til et LEGESENTER. En allowlist, ikke en
 * blocklist: kategorien rommer gynekolog, urolog og nevrolog, og lista over
 * spesialister er lengre enn lista over ord for allmennlege.
 */
const LEGESENTER_ORD = [
  "legesenter",
  "legekontor",
  "legegruppe",
  "fastlege",
  "helsesenter",
  "medisinsk",
] as const;

/** LEGESENTER — nærmeste allmennlege. Ledig fastlegeplass påstås aldri. */
function legesenter(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "doctor").filter((p) =>
    navnefilter(p, { krever: LEGESENTER_ORD }),
  );
  return naermesteAvSlag(kandidater, () => "legesenter");
}

/**
 * PIZZA — Google-typen `pizza_restaurant` lagres ikke i poolen (katalogen § 5
 * pkt 9), så porten er ordet i navnet innenfor `restaurant`. Ingen
 * merkevareliste: en liste over kjeder er kuratering, ikke data.
 */
function pizza(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "restaurant").filter((p) =>
    navnefilter(p, { krever: ["pizza", "pizzeria"] }),
  );
  return naermesteAvSlag(kandidater, () => "pizzasted", DINING_RADIUS_MIN);
}

/**
 * HUNDEPARK — kategorien `hundepark` ELLER en `park` med ordet i navnet:
 * begge Wesselsløkka-parkene ligger som `park` til de er omkategorisert.
 * Inngjerding påstås aldri — derfor sier spørsmålet hundepark, ikke løsområde.
 */
function hund(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "hundepark", "park").filter(
    (p) => p.category.id === "hundepark" || navnefilter(p, { krever: ["hundepark"] }),
  );
  return naermesteAvSlag(kandidater, () => "hundepark");
}

/** Er idrettsanlegget en HALL? Svømmehallen er sitt eget spørsmål. */
function erIdrettshall(poi: POI): boolean {
  return navnefilter(poi, { krever: ["hall", "arena"], utelukker: ["svømme"] });
}

/**
 * IDRETTSANLEGG — leser `idrett` fra HELE boardet: kategorien ligger i
 * Oppvekst-temaet, spørsmålet i Trening (katalogen § 5 pkt 8). Spørsmålet
 * nevner både baner og haller, så halen er den andre sorten når begge finnes:
 * det er de to navngitte stedene. Ingen antall — ankere teller som én på
 * kartet, og «11 anlegg» ville ikke stemt med det leseren ser.
 */
function idrettsanlegg(input: FaqGeneratorInput): string | undefined {
  const alle = naermesteMedTidFra(input.allPois, input.center, "idrett");
  const [naermest] = alle;
  if (!naermest) return undefined;
  const w = walkMinutes(naermest)!;
  const parts = [
    w <= WALK_RADIUS_MIN
      ? `${namedPoi(naermest)} er nærmeste idrettsanlegg, ${minutter(w)} til fots.`
      : `Nærmeste idrettsanlegg på kartet er ${namedPoi(naermest)}, ${reisetid(naermest)}.`,
  ];
  const andreSort = erIdrettshall(naermest)
    ? alle.find((p) => p !== naermest && !erIdrettshall(p))
    : alle.find((p) => p !== naermest && erIdrettshall(p));
  if (andreSort) {
    const ord = erIdrettshall(andreSort) ? "idrettshall" : "bane";
    parts.push(`${namedPoi(andreSort)} er nærmeste ${ord}, ${reisetid(andreSort)}.`);
  }
  return parts.join(" ");
}

/**
 * Ordene et folkebibliotek faktisk heter. `deichman` står der fordi Oslos 22
 * filialer er den ene store operatøren som bruker merkenavn i stedet for ordet
 * («Deichman Stovner», «Deichman meråpent») — uten den mister Oslo hele raden.
 * Ingen annen operatør i poolen gjør det samme.
 */
const BIBLIOTEK_ORD = ["bibliotek", "library", "bokbuss", "deichman"] as const;

/**
 * Bibliotek som IKKE låner ut til publikum, eller ikke er et bibliotek i det
 * hele tatt.
 *
 * MÅLT PÅ HELE POOLEN 2026-09-06: 71 `library`-rader, og bare rundt 20 av dem
 * er folkebibliotek. Kategorien rommer universitetsfilialer (NTNU har elleve),
 * fylkesbibliotekene (bibliotekenes bibliotek, ikke publikums),
 * Nasjonalbiblioteket, bokbytteskap i telefonkiosker — og ting som ikke er
 * bibliotek i det hele tatt: «Kafén i Ila», «LINK arkitektur AS», «Bergen
 * Dansesenter».
 *
 * Navnegaten tar 48 av de 51 feilene. De siste seks som slipper gjennom
 * (BAS biblioteket, Europarettsbiblioteket, Gunnerus Library, KVT Bibliotek,
 * Musikkbiblioteket, Tibi) har ingenting felles leksikalsk, og å liste dem ved
 * navn ville vært kuratering, ikke data. Det ÆRLIGE fikset er kilden
 * katalogen alt navngir: Nasjonalbibliotekets Base Bibliotek med
 * `bibliotektype = folkebibliotek`. Til den er koblet på, er dette gulvet.
 */
const IKKE_UTLAAN_ORD = [
  // Studiested og forskning
  "ntnu",
  "universitet",
  "university",
  "høgskole",
  "høyskole",
  "oslomet",
  "uib",
  "student",
  "akademi",
  "institutt",
  "fakultet",
  "skolebibliotek",
  "ungdomsskole",
  "videregående",
  "sophus",
  "sverdrup",
  "humsam",
  "realfag",
  "teknologi",
  "økonomi",
  "juridisk",
  "medisin",
  "samfunnsvitenskap",
  "arkitektur",
  "marin",
  "forsknings",
  // Bibliotekenes bibliotek og depotene — ikke publikumsutlån
  "fylkesbibliotek",
  "national library",
  "nasjonalbibliotek",
  "fellesmagasin",
  "magasin",
  "depot",
  "dora",
  "picture collection",
  "sykehus",
  // Bokbytteskap og lesekiosker: et skap er ikke et bibliotek
  "telefonkiosk",
  "phone booth",
  "bokbytte",
  "bokskap",
  "lesekiosk",
  "lesesal",
] as const;

/** Er stedet et utlånsbibliotek, slik spørsmålet mener det? */
function erUtlaansbibliotek(poi: POI): boolean {
  return navnefilter(poi, { krever: BIBLIOTEK_ORD, utelukker: IKKE_UTLAAN_ORD });
}

/** BIBLIOTEK — nærmeste utlånsbibliotek, med det ordet navnet bærer. */
function bibliotek(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "library").filter(erUtlaansbibliotek);
  return naermesteAvSlag(kandidater, (p) =>
    navnefilter(p, { krever: ["folkebibliotek"] }) ? "folkebibliotek" : "bibliotek",
  );
}

/**
 * POST I BUTIKK — vertsbutikken, ikke pakkeboksen.
 *
 * Katalogen hadde dette som S+ på Bring Pickup Point API. Målt i poolen
 * 2026-09-06 trengs den ikke: 24 `post`-rader, og navnet bærer «Post i Butikk»
 * ordrett på nesten alle — det er slik Posten merker vertsbutikkene sine. Samme
 * navnegate som `legesenter` og `pizza`.
 *
 * Pakkeautomatene faller ut med vilje. Spørsmålsteksten ble snevret til «Post i
 * butikk» nettopp fordi det er det kilden lover, og en automat er ikke en
 * betjent disk. PostNord og Helthjem finnes ikke i kilden og nevnes ikke —
 * svaret sier hva som ER der, ikke hva som mangler.
 */
function pakkerPost(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "post").filter((p) =>
    navnefilter(p, {
      krever: ["post i butikk"],
      utelukker: ["pakkeautomat", "pakkeboks"],
    }),
  );
  const [naermest] = kandidater;
  if (!naermest) return undefined;
  const w = walkMinutes(naermest)!;
  const parts = [
    w <= WALK_RADIUS_MIN
      ? `${namedPoi(naermest)} har Post i butikk, ${minutter(w)} til fots.`
      : `Nærmeste Post i butikk på kartet er ${namedPoi(naermest)}, ${reisetid(naermest)}.`,
  ];
  const neste = kandidater.find((p) => !sammeKort(p, naermest));
  if (neste) parts.push(`${namedPoi(neste)} er alternativet, ${unna(neste)}.`);
  return parts.join(" ");
}

/** KINO — traff riktig på Wesselsløkka uten filter. Bussreisen er ikke målt. */
function kino(input: FaqGeneratorInput): string | undefined {
  return naermesteAvSlag(naermesteMedTid(input, "cinema"), () => "kino");
}

/**
 * Steder i `kirke`-kategorien som ikke er et gudshus med åpne tilbud.
 *
 * To slag, begge målt på poolen 2026-09-06: institusjonskapellet (Zion bo- og
 * servicesenter, St. Olavs Hospital Kapell — merk at Google skriver den
 * engelske formen, så «sykehus» alene fanget den ikke) og
 * ADMINISTRASJONEN (menighetskontoret, kirkelig fellesråd, Frelsesarmeens
 * divisjonskontor). Et kontor er ikke en kirke du kan gå inn i.
 */
const IKKE_MENIGHET_ORD = [
  "sykehjem",
  "bo- og service",
  "helsehus",
  "sykehus",
  "hospital",
  "omsorgssenter",
  "krematorium",
  "gravlund",
  "gravplass",
  "kirkegård",
  "menighetskontor",
  "fellesråd",
  "ecclesiastical council",
  "divisjon",
] as const;

/** Er stedet en menighet med åpne tilbud, slik spørsmålet mener det? */
function erMenighet(poi: POI): boolean {
  return navnefilter(poi, { utelukker: IKKE_MENIGHET_ORD });
}

/**
 * Slagsordet et gudshus bærer i navnet. Rekkefølgen er bevisst: «kirkesenter»
 * inneholder «kirke» og må prøves først.
 */
const KIRKE_SLAG = ["menighetshus", "bedehus", "kirkesenter", "kapell", "kirke"] as const;

function kirkeSlag(poi: POI): string {
  const navn = poi.name.toLocaleLowerCase("nb-NO");
  return KIRKE_SLAG.find((ord) => navn.includes(ord)) ?? "kirke";
}

/** KIRKE — nærmeste menighet. Menighetshusets faste tilbud er kuratert (K). */
function kirke(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "kirke").filter(erMenighet);
  return naermesteAvSlag(kandidater, kirkeSlag);
}

/** Ord som sier at stedet er et museum med publikum, ikke et monument. */
const MUSEUM_ORD = ["museum", "museet", "musea", "samling", "galleri", "kunsthall"] as const;

/**
 * Kvalifiserer stedet som museum? Navnet ELLER cachede åpningstider: Berlin
 * Wall Segments har ingen av delene, et museum med publikum har begge.
 * Åpningstidene er stedfortreder for «åpent for publikum» — feltet poolen
 * ikke har.
 */
function erMuseum(poi: POI): boolean {
  // Parkeringsplassen til et museum er ikke et museum, og den arver
  // åpningstidene som ellers ville sluppet den gjennom porten under
  // («NTNU Ringve botaniske hage Parkering», målt i poolen).
  if (navnefilter(poi, { krever: ["parkering", "parking"] })) return false;
  return (
    navnefilter(poi, { krever: MUSEUM_ORD }) ||
    parseWeekdayText(poi.openingHoursJson?.weekday_text) !== null
  );
}

/** MUSEUM — nærmeste museum med publikum. */
function museum(input: FaqGeneratorInput): string | undefined {
  const kandidater = naermesteMedTid(input, "museum").filter(erMuseum);
  return naermesteAvSlag(kandidater, () => "museum");
}

/** «850 meter» under kilometeren, «1,4 kilometer» over. */
function gangavstandTekst(m: number): string {
  if (m < 1000) return roundedMeters(m);
  const km = (m / 1000).toFixed(1).replace(".", ",");
  return `${km} kilometer`;
}

/**
 * SKOLESKYSS — formen er AVSTANDEN, så lovteksten.
 *
 * Lovsetningen alene er ALDRI en rad. Den er identisk på alle adresser, og det
 * var nøyaktig derfor `barnehage-plass` gikk ut av katalogen: et svar som er
 * likt overalt svarer ikke på noe om denne boligen. Kommer avstanden, bærer den
 * lovsetningen; uteblir avstanden, uteblir raden.
 *
 * Bare positiv form. «Retten gjelder fra to kilometer», aldri «dere har ikke
 * rett» — kommunen kan innvilge skyss for trafikkfarlig veg uavhengig av
 * avstand, og et nei fra oss ville vært feil like ofte som det var ubehagelig.
 */
function skoleskyss(input: FaqGeneratorInput): string | undefined {
  const s = input.boardFacts?.schools;
  const del = (skole: typeof s extends undefined ? never : NonNullable<typeof s>["barneskole"]) =>
    skole?.gangMeter
      ? { navn: poiLink(skole.navn, findSchoolPoi(input.allPois, skole)), m: skole.gangMeter }
      : undefined;
  const barn = del(s?.barneskole);
  const ung = del(s?.ungdomsskole);
  if (!barn && !ung) return undefined;

  const først = barn ?? ung!;
  const avstand = barn && ung
    ? `Til ${barn.navn} er det ${gangavstandTekst(barn.m)} langs gangveien, og ${gangavstandTekst(ung.m)} til ${ung.navn}.`
    : `Til ${først.navn} er det ${gangavstandTekst(først.m)} langs gangveien.`;
  return `${avstand} Gratis skoleskyss gjelder fra to kilometer for 1. trinn og fire kilometer fra 2. trinn.`;
}

/**
 * FREKVENS — formen er ANTALL I VINDU, ikke per time. Katalogen skrev «ganger i
 * timen», men et to-timers vindu delt på to gir halve avganger; tellingen i
 * vinduet er tallet leseren kan slå opp hos Entur.
 *
 * NULL I KVELDSVINDUET SKRIVES. Det er ikke poolens recall-problem — Enturs
 * avgangsliste er komplett for datoen, og «ingen avganger» er like etterprøvbart
 * som «fjorten». Dette er den ene raden i hele katalogen der en negativ
 * opplysning er sann nok til å stå.
 */
function frekvens(input: FaqGeneratorInput): string | undefined {
  const f = input.boardFacts?.frequency;
  if (!f) return undefined;
  const stopp = poiLink(f.stopName, stopPoi(input, f.stopPlaceId));
  const antall = (n: number) => (n === 1 ? "én avgang" : `${n} avganger`);
  // Klokkeslettene padres til to sifre. Setningen bærer BÅDE klokkeslett og
  // antall, og «Mellom 7 og 9 går det 12 avganger» lar leseren lure på hvilke
  // tall som er hva. «07» er utvetydig en tid.
  const time = (h: number) => String(h).padStart(2, "0");
  return (
    `Mellom ${time(f.morgen.fraTime)} og ${time(f.morgen.tilTime)} på hverdager går det ` +
    `${antall(f.morgen.avganger)} mot ${f.retning} fra ${stopp}, og ` +
    `${antall(f.kveld.avganger)} mellom ${time(f.kveld.fraTime)} og ${time(f.kveld.tilTime)}.`
  );
}

/** ` med linje 1 og 70` eller ` til fots` — samme hale som `cityCentreSentence`. */
function linjeHale(lines: readonly string[]): string {
  return lines.length > 0 ? ` med linje ${ogJoin([...lines])}` : " til fots";
}

/**
 * TIL ARBEIDSPLASSENE — formen er REISETID PER MÅL. Åpner «Reisen til» fordi
 * `tilSentrum` alt åpner «Til ${sentrum} tar det».
 *
 * Tre mål, ikke to. Regelen om maks to navngitte steder finnes for at et svar
 * ikke skal bli en liste leseren hopper over — men her ER destinasjonene
 * spørsmålet, og lista er redaksjonelt valgt til nettopp tre.
 */
function tilArbeidsplassene(input: FaqGeneratorInput): string | undefined {
  const medReise = (input.boardFacts?.workplaces ?? []).filter((w) => w.patterns.length > 0);
  if (medReise.length === 0) return undefined;
  const [først, ...resten] = medReise;
  const deler = resten.map(
    (w) => `til ${w.navn} ${w.patterns[0].minutes} minutter${linjeHale(w.patterns[0].lines)}`,
  );
  const hale = deler.length > 0 ? `, ${ogJoin(deler)}` : "";
  return `Reisen til ${først.navn} tar ${først.patterns[0].minutes} minutter${linjeHale(først.patterns[0].lines)}${hale}.`;
}

/**
 * Klokkeslett som kan ligge etter midnatt: «23.45», «00.30».
 *
 * `klokkeslett` gir «midnatt» for 1440 og har ingen form for tidene etter, og
 * det er nattavgangene som er hele poenget med spørsmålet.
 */
function klokkeslettDøgn(minutt: number): string {
  const m = minutt % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}.${String(min).padStart(2, "0")}`;
}

/**
 * SISTE AVGANG — formen er KLOKKESLETT PER UKEDAGSTYPE. Modus-nøytral i teksten
 * («avgang», ikke «buss») selv om id-en sier buss: i Bergen er svaret bybanen.
 *
 * Helgelinja nevnes bare når den er en ANNEN enn hverdagslinja. Nattavgangene i
 * Trondheim kjører ofte egne linjenummer, og da er det en opplysning; er det
 * samme linje, er gjentakelsen bare støy.
 */
function sisteBuss(input: FaqGeneratorInput): string | undefined {
  const d = input.boardFacts?.lastDeparture;
  const hverdag = d?.hverdag;
  if (!d || !hverdag) return undefined;

  const til = (x: { tilNavn?: string }) => (x.tilNavn ? ` til ${x.tilNavn}` : "");
  const sammeSted = d.helg?.tilNavn === hverdag.tilNavn;
  const sammeLinje =
    d.helg !== undefined &&
    d.helg.lines.length === hverdag.lines.length &&
    d.helg.lines.every((l) => hverdag.lines.includes(l));

  // Går siste avgang likt hele uka, er ukedagsdelingen ikke en opplysning —
  // den er en gjentakelse. Da sies tallet én gang, og at det gjelder også i
  // helga.
  if (d.helg && sammeSted && sammeLinje && d.helg.minutt === hverdag.minutt) {
    return `Siste avgang fra ${d.fraNavn}${til(hverdag)} går ${klokkeslettDøgn(hverdag.minutt)}${linjeHale(hverdag.lines)}, også natt til lørdag og søndag.`;
  }

  // Ender de to reisene ULIKE steder, må destinasjonen stå på hver av dem.
  // «Siste avgang til Valentinlyst … natt til lørdag går den 01.27» ville
  // påstått at nattbussen også ender på Valentinlyst, og det gjør den ikke.
  if (d.helg && !sammeSted) {
    return (
      `Siste avgang fra ${d.fraNavn} går ${klokkeslettDøgn(hverdag.minutt)} på hverdager,` +
      `${linjeHale(hverdag.lines)}${til(hverdag)}. ` +
      `Natt til lørdag og søndag går den ${klokkeslettDøgn(d.helg.minutt)},` +
      `${linjeHale(d.helg.lines)}${til(d.helg)}.`
    );
  }

  const parts = [
    `Siste avgang fra ${d.fraNavn}${til(hverdag)} går ${klokkeslettDøgn(hverdag.minutt)} på hverdager${linjeHale(hverdag.lines)}.`,
  ];
  if (d.helg) {
    parts.push(
      `Natt til lørdag og søndag går den ${klokkeslettDøgn(d.helg.minutt)}${sammeLinje ? "" : linjeHale(d.helg.lines)}.`,
    );
  }
  return parts.join(" ");
}

/**
 * Ankerets medlemmer, tilbake i lista de ble absorbert ut av.
 *
 * Board-laget fjerner medlemmene fra temaets liste og henger dem på ankerets
 * kort i stedet (`report-data.ts`). Riktig for kartet — ett kjøpesenter er én
 * markør — og feil for FAQ-en, som ikke spør om markører, men om «hvor er
 * nærmeste apotek».
 *
 * Medlemmene hentes fra `allPois`, som er hele boardets sett og har dem alle.
 * To porter, og begge trengs: ankeret må ligge i DETTE temaet (ellers ville et
 * senter i Hverdagsliv sluppet restaurantene sine inn i Mat & drikke uten at
 * senteret selv står der), og medlemmets kategori må høre til temaet (ellers
 * ville apoteket inne i senteret dukket opp i alle temaer senteret står i).
 */
function withAnchorMembers(input: FaqGeneratorInput): FaqPoi[] {
  const anchors = new Map(
    input.pois.filter(isAnchorPOI).map((p) => [p.id, p] as const),
  );
  if (anchors.size === 0) return [...input.pois];

  const cats = new Set(input.categoryIds);
  const members: FaqPoi[] = [];
  for (const poi of input.allPois) {
    if (!poi.parentPoiId) continue;
    const anchor = anchors.get(poi.parentPoiId);
    if (!anchor || !cats.has(poi.category.id)) continue;
    members.push({
      ...poi,
      faqAnchor: { id: anchor.id, name: cleanPoiName(anchor.name) },
    });
  }
  return members.length > 0 ? [...input.pois, ...members] : [...input.pois];
}

/**
 * Hele boardets steder, med medlemmene merket med ankeret sitt.
 *
 * `allPois` inneholder medlemmene fra før — det er temalistene som mangler dem.
 * Her trengs derfor ingen innfletting, bare merkingen, slik at et svar som går
 * på tvers av temaene (`uten-bil`, områdets svar) navngir medlemmet med bygget
 * det ligger i og lenker til kortet som finnes.
 */
function markAnchorMembers(allPois: readonly POI[]): FaqPoi[] {
  const anchors = new Map(
    allPois.filter(isAnchorPOI).map((p) => [p.id, p] as const),
  );
  if (anchors.size === 0) return [...allPois];
  return allPois.map((poi) => {
    const anchor = poi.parentPoiId ? anchors.get(poi.parentPoiId) : undefined;
    return anchor
      ? { ...poi, faqAnchor: { id: anchor.id, name: cleanPoiName(anchor.name) } }
      : poi;
  });
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
  // `uten-bil` bodde her til 2026-09-06 og flyttet til Området (katalogen § 6):
  // det er tverrgående, og Hverdagsliv slapp id-en.
  apotek,
  tannlege,
  kjopesenter,
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
  // Katalogens S-spørsmål (2026-09-06), setningsformene fra Fable-leveransen.
  skolevei,
  skoleskyss,
  "pakker-post": pakkerPost,
  frekvens,
  "til-arbeidsplassene": tilArbeidsplassene,
  "siste-buss": sisteBuss,
  legesenter,
  pizza,
  hund,
  idrettsanlegg,
  bibliotek,
  kino,
  kirke,
  museum,
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
export function generateCategoryFaq(rawInput: FaqGeneratorInput): FaqEntry[] {
  // Ankerets medlemmer inn FØR byggerne kjører — de spør etter «nærmeste», og
  // et absorbert sted er fortsatt et sted du kan gå til.
  const input: FaqGeneratorInput = {
    ...rawInput,
    pois: withAnchorMembers(rawInput),
    allPois: markAnchorMembers(rawInput.allPois),
  };
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

export interface AreaFaqTheme {
  id: string;
  label: string;
  /** Temaets board-filtrerte POI-er. Utelatt = temaet bidrar bare med lenke. */
  pois?: readonly POI[];
}

export interface GlobalFaqInput {
  boardFacts?: ReportBoardFacts;
  curated?: readonly ReportFaqAnswer[];
  /** Tema-IDer, etiketter og POI-settene deres. Etikettene er kilden til
   *  kategorilenker; POI-settene er kilden til de tverrgående svarene. */
  themes: ReadonlyArray<AreaFaqTheme>;
  /** Boligens koordinat. Kun brukt til å sortere steder uten målt gangtid. */
  center?: Coordinates;
  /**
   * Hele boardets POI-sett, medlemmene av et anker inkludert.
   *
   * Temalistene over har medlemmene absorbert inn i senterets kort, og to av
   * områdesvarene trenger dem tilbake: «hva ligger nærmest» og «er noe åpent
   * sent» handler om dører, ikke om markører. `gangavstand` gjør det ikke —
   * det tallet skal stemme med det leseren kan telle på kartet, og der er
   * senteret ÉN ting.
   */
  allPois?: readonly POI[];
}

/** Spørsmåls-id for det deterministiske reise-svaret på boardnivå. */
export const GLOBAL_TRANSIT_ID = "til-byen";

/**
 * Den ene kuraterte id-en som IKKE blir en FAQ-rad: den er OMRÅDETS INTRO.
 *
 * «Hva kjennetegner området?» er spørsmålet en intro besvarer, og på
 * områdestoppet står svaret som prosa øverst — slik hvert tema har sin
 * body-tekst over utvalget sitt (2026-08-27). Å ha det begge steder ville vist
 * samme avsnitt to ganger på samme flate; å ha det bare i trekkspillet gjorde
 * strøkets egen stemme til den ene raden ingen åpnet.
 *
 * Id-en er kontrakten: kurator-arbeidsflyten (`curate-area`) er uendret, og
 * strøk som allerede har svaret får introen uten ny kurering.
 */
export const GLOBAL_INTRO_ID = "karakteristikk";

/** Områdets intro fra strøkets kuraterte svar, eller undefined. Ingen
 *  deterministisk erstatning: har vi ikke strøkets ord, dikter vi ikke opp et
 *  avsnitt om det (flaten faller tilbake på én navigerende setning). */
export function areaIntroFromCurated(
  curated: readonly ReportFaqAnswer[] | undefined,
): string | undefined {
  const svar = curated?.find((c) => c.id === GLOBAL_INTRO_ID)?.svar?.trim();
  return svar || undefined;
}

// ── Områdets svarbyggere ────────────────────────────────────────────────────
//
// Samme regler som tema-byggerne over (positive påstander, gangtid kun der den
// er målt, ingen diktede svar), med ett tillegg: de er TVERRGÅENDE. Et svar her
// ser hele boardet, og det er hele grunnen til at spørsmålet ikke bor i et tema.

type AreaAnswerBuilder = (input: GlobalFaqInput) => string | undefined;

/** Grensen for «i gangavstand» i områdesvarene — samme tall som ellers. */
const AREA_NEAR_MIN = 5;

/** Fra dette klokkeslettet regnes et sted som åpent på kvelden. */
const AREA_LATE_MIN = 21 * 60;

/**
 * Boardets steder, hvert sted ÉN gang.
 *
 * Temaene er disjunkte i `REPORT_THEME_DEFAULTS`, men et sted som likevel havner
 * i to temaer skal ikke telles to ganger i et tall leseren kan etterprøve mot
 * kartet.
 */
function areaPois(input: GlobalFaqInput): POI[] {
  const seen = new Map<string, POI>();
  for (const theme of input.themes) {
    for (const poi of theme.pois ?? []) {
      if (!seen.has(poi.id)) seen.set(poi.id, poi);
    }
  }
  return [...seen.values()];
}

/**
 * Boardets steder MED ankermedlemmene, hvert sted én gang.
 *
 * Medlemmene hentes fra `allPois` og merkes med ankeret sitt, slik at et svar
 * kan navngi «Boots Apotek i Valentinlyst Senter» og lenke til kortet som
 * faktisk finnes på kartet. Uten `allPois` (eldre kallere, tester) er dette
 * identisk med `areaPois` — ingen medlemmer, ingen endring.
 */
function areaPoisWithMembers(input: GlobalFaqInput): FaqPoi[] {
  const base = areaPois(input);
  if (!input.allPois || input.allPois.length === 0) return base;

  const anchors = new Map(
    input.allPois.filter(isAnchorPOI).map((p) => [p.id, p] as const),
  );
  if (anchors.size === 0) return base;

  const seen = new Set(base.map((p) => p.id));
  const members: FaqPoi[] = [];
  for (const poi of input.allPois) {
    if (seen.has(poi.id) || !poi.parentPoiId) continue;
    const anchor = anchors.get(poi.parentPoiId);
    if (!anchor) continue;
    seen.add(poi.id);
    members.push({
      ...poi,
      faqAnchor: { id: anchor.id, name: cleanPoiName(anchor.name) },
    });
  }
  return members.length > 0 ? [...base, ...members] : base;
}

/** `[Transport & Mobilitet](category:transport)` når temaet nådde boardet. */
function themeLink(theme: AreaFaqTheme): string {
  return `[${theme.label}](category:${theme.id})`;
}

/** «ett sted» / «4 steder». Samme grunn som `minutter`: «1 steder» er en feil
 *  leseren legger merke til før hun legger merke til tallet. */
function steder(n: number): string {
  return n === 1 ? "ett sted" : `${n} steder`;
}

/**
 * Klokkeslettet alene, i den formen en dør skriver det: «23», «21.30».
 *
 * Midnatt får ordet, ikke tallet: Google lagrer stengetiden som 24.00, og «har
 * åpent til 24» leses som en skrivefeil selv når det er riktig.
 */
function klokkeslett(min: number): string {
  if (min >= 1440) return "midnatt";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? String(h) : `${h}.${String(m).padStart(2, "0")}`;
}

/**
 * TIL BYEN — formen er REISETID MED LENKE INN. Fakta er de samme som
 * transportmalens `til-sentrum`; forskjellen er at områdets versjon sender
 * leseren videre til temaet i stedet for å utdype selv.
 */
function tilByen(input: GlobalFaqInput): string | undefined {
  const sentrum = cityCentreSentence(input.boardFacts);
  if (!sentrum) return undefined;
  const transport = input.themes.find((t) => t.id === "transport");
  const lenke = transport
    ? ` Se ${themeLink(transport)} for holdeplassene i nabolaget.`
    : "";
  return `${sentrum}${lenke}`;
}

/**
 * NÆRMEST — formen er NAVN MED MINUTTER I PARENTES, og den finnes bare her:
 * ingen kategori kan svare, fordi svaret går på tvers av alle.
 */
function naermest(input: GlobalFaqInput): string | undefined {
  const nærmeste = areaPoisWithMembers(input)
    .filter((p) => walkMinutes(p) !== undefined)
    .sort(
      (a, b) =>
        walkMinutes(a)! - walkMinutes(b)! || a.name.localeCompare(b.name, "nb"),
    )
    .slice(0, 3);
  const [først] = nærmeste;
  if (!først) return undefined;
  const navn = nærmeste.map((p) => namedPoi(p));
  const tid = walkMinutes(først)!;
  // Tre steder med samme tall leser som en feil, ikke som tre naboer. Da sies
  // tallet ÉN gang — det er samme opplysning, ikke tre.
  if (nærmeste.every((p) => walkMinutes(p) === tid)) {
    return nærmeste.length === 1
      ? endSentence(`${navn[0]} ligger ${minutter(tid)} unna`)
      : endSentence(`${ogJoin(navn)} ligger alle ${minutter(tid)} unna`);
  }
  const deler = nærmeste.map(
    (p) => `${namedPoi(p)} (${minutter(walkMinutes(p)!)})`,
  );
  return endSentence(`Nærmest ligger ${ogJoin(deler)}`);
}

/**
 * GANGAVSTAND — formen er TERSKLER. To tall, ikke en vurdering: hvor mye som
 * ligger under ti minutter, og hvor mye av det som ligger under fem.
 *
 * Bare målte tider telles, så tallet er alltid et gulv — aldri en påstand om at
 * resten ligger LENGER unna (poolen er recall-begrenset, og en manglende måling
 * er ikke en avstand).
 */
function gangavstand(input: GlobalFaqInput): string | undefined {
  const tider = areaPois(input)
    .map((p) => walkMinutes(p))
    .filter((m): m is number => m !== undefined);
  const innenTi = tider.filter((m) => m <= WALK_RADIUS_MIN).length;
  if (innenTi === 0) return undefined;
  const innenFem = tider.filter((m) => m <= AREA_NEAR_MIN).length;
  const først = steder(innenTi);
  const parts = [
    `${først[0].toLocaleUpperCase("nb-NO")}${først.slice(1)} på kartet ligger innenfor ti minutter til fots.`,
  ];
  // «Innenfor», ikke «under»: grensene er inklusive (ti minutter er i
  // gangavstand), og et sted som ligger PÅ streken skal ikke telles i en setning
  // som sier at det ligger under den.
  //
  // Bare når det andre tallet sier noe nytt: «Ett sted ligger innenfor ti
  // minutter. Ett av dem innenfor fem» er samme sted, talt to ganger.
  if (innenFem > 0 && innenFem < innenTi) {
    parts.push(
      innenFem === 1
        ? "Ett av dem ligger innenfor fem."
        : `${innenFem} av dem ligger innenfor fem.`,
    );
  }
  return parts.join(" ");
}

/**
 * MEST AV — formen er RANGERING MED LENKER. Den svarer på hva slags nabolag
 * dette er i tall, og den er samtidig veien videre: begge navnene bytter stopp.
 */
function mestAv(input: GlobalFaqInput): string | undefined {
  const rangert = input.themes
    .map((theme) => ({ theme, n: theme.pois?.length ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.theme.label.localeCompare(b.theme.label, "nb"));
  const [først, andre] = rangert;
  if (!først) return undefined;
  const parts = [`${themeLink(først.theme)} er størst, med ${steder(først.n)}.`];
  if (andre) parts.push(`${themeLink(andre.theme)} følger med ${steder(andre.n)}.`);
  return parts.join(" ");
}

/**
 * Steder det gir mening å si at «har åpent» om.
 *
 * Uten denne porten svarte raden «Dokkparken har åpent til midnatt»: Google
 * lagrer åpningstider på parker, badeplasser og idrettsanlegg også, og en park
 * med 00–24 vinner alltid sorteringen på seneste stengetid. Et friområde
 * stenger ikke, og «åpent sent» om en park svarer ikke på spørsmålet — det som
 * spørres om er om det finnes en dør å gå inn i om kvelden.
 */
const EVENING_CATEGORIES: ReadonlySet<string> = new Set([
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "supermarket",
  "convenience",
  "liquor_store",
  "gym",
  "pharmacy",
  "shopping",
  "butikk",
  "cinema",
  "swimming",
]);

/**
 * ÅPENT SENT — formen er KLOKKESLETT. Hverdagskonsensus, ikke «ofte åpent
 * sent»: står det et tall, gjelder det alle fem hverdagene.
 *
 * Tre porter, og alle tre kom av samme feilsvar: kategorien må være et sted med
 * en dør (`EVENING_CATEGORIES`), stedet må ligge i gangavstand (et kjøpesenter
 * 40 minutter unna svarer ikke på om NABOLAGET har noe åpent), og stengetiden
 * må være etter terskelen.
 */
function apentSent(input: GlobalFaqInput): string | undefined {
  const sene = areaPoisWithMembers(input)
    .filter((poi) => EVENING_CATEGORIES.has(poi.category.id) && erINaerheten(poi))
    .map((poi) => ({ poi, tid: hverdagstider(poi) }))
    .filter(
      (x): x is { poi: FaqPoi; tid: DayHours } =>
        x.tid !== null && x.tid.closeMin >= AREA_LATE_MIN,
    )
    .sort(
      (a, b) =>
        b.tid.closeMin - a.tid.closeMin ||
        a.poi.name.localeCompare(b.poi.name, "nb"),
    )
    .slice(0, MAX_NAMED);
  const [først, andre] = sene;
  if (!først) return undefined;
  const sent = klokkeslett(først.tid.closeMin);
  // Samme stengetid = én setning med to navn, av samme grunn som i `naermest`.
  if (andre && andre.tid.closeMin === først.tid.closeMin) {
    return `${namedPoi(først.poi)} og ${namedPoi(andre.poi)} har åpent til ${sent} på hverdager.`;
  }
  const parts = [`${namedPoi(først.poi)} har åpent til ${sent} på hverdager.`];
  if (andre) {
    parts.push(
      `${namedPoi(andre.poi)} stenger ${klokkeslett(andre.tid.closeMin)}.`,
    );
  }
  return parts.join(" ");
}

/**
 * UTEN BIL — terskelspørsmålet. Det spør om summen av hverdagen, ikke om én
 * kategori, og det er derfor det bor på Området og ikke i Hverdagsliv
 * (katalogen § 6, flyttet 2026-09-06): bakeriet ligger i Mat & drikke,
 * treningssenteret i Trening, barnehagen i Oppvekst. Alle er ærend du gjør til
 * fots. Medlemmene av et kjøpesenter teller med — apoteket inne i senteret er
 * et apotek du kan gå til.
 */
function utenBil(input: GlobalFaqInput): string | undefined {
  const dekket = aerendtyper(areaPoisWithMembers(input).filter(erINaerheten));

  if (dekket.length >= 4) {
    return `Hverdagsærendene er i gangavstand: ${ogJoin(dekket)} ligger alle innenfor ${WALK_RADIUS_MIN} minutter til fots.`;
  }
  if (dekket.length >= 2) {
    return `Deler av hverdagen er i gangavstand: ${ogJoin(dekket)} ligger innenfor ${WALK_RADIUS_MIN} minutter til fots.`;
  }
  return undefined; // Én eller null ærend-typer: ikke nok til et ærlig ja.
}

/**
 * TJENESTER SAMME STED — formen er ANKER MED ÆRENDTYPER. Anker-registeret
 * (kjøpesenter-familien, `parentPoiId`) er nøyaktig denne dataen. Medlemmene
 * beskrives som typer, ikke butikknavn — det er slik `uten-bil` alt snakker,
 * og det er det som holder maks-to-navn-regelen: de to ankrene er de to
 * navngitte stedene. Et anker som bare dekker ÉN ærendtype er ikke «samle», og
 * telles ikke.
 *
 * Området eier medlemslista (katalogen § 6); Hverdagslivs `kjopesenter` skal
 * ikke liste medlemmer.
 */
function tjenesterSammeSted(input: GlobalFaqInput): string | undefined {
  const alle = input.allPois ?? [];
  const ankre = alle
    .filter((a) => isAnchorPOI(a) && walkMinutes(a) !== undefined)
    .sort((a, b) => walkMinutes(a)! - walkMinutes(b)!)
    .map((anker) => ({
      anker,
      aerend: aerendtyper(alle.filter((p) => p.parentPoiId === anker.id)),
    }))
    .filter(({ aerend }) => aerend.length >= 2);

  const [først, neste] = ankre;
  if (!først) return undefined;
  const w = walkMinutes(først.anker)!;
  const parts = [
    w <= WALK_RADIUS_MIN
      ? `På ${namedPoi(først.anker)} ligger ${ogJoin(først.aerend)} samlet, ${minutter(w)} til fots.`
      : `Nærmeste sted på kartet som samler flere ærender er ${namedPoi(først.anker)}, ${reisetid(først.anker)}, med ${ogJoin(først.aerend)}.`,
  ];
  if (neste) {
    parts.push(`${namedPoi(neste.anker)} samler ${ogJoin(neste.aerend)}, ${reisetid(neste.anker)}.`);
  }
  return parts.join(" ");
}

/**
 * Innendørs-kategoriene bak `regnvaersdag`, med ordet svaret bruker om dem.
 * `idrett` er med bare når stedet er en hall — en kunstgressbane er ikke et
 * sted å gå inn i når det regner.
 */
const INNENDORS_SLAG: ReadonlyArray<{ cat: string; slag: string; port?: (poi: POI) => boolean }> = [
  { cat: "library", slag: "bibliotek", port: erUtlaansbibliotek },
  { cat: "swimming", slag: "svømmehall" },
  { cat: "museum", slag: "museum", port: erMuseum },
  { cat: "cinema", slag: "kino" },
  { cat: "gym", slag: "treningssenter" },
  { cat: "idrett", slag: "idrettshall", port: erIdrettshall },
];

/** Innenfor for regnværsdagen: et kvarter til fots ELLER et kvarter med sykkel. */
function erInnendorsNaer(poi: POI): boolean {
  const w = walkMinutes(poi);
  const b = bikeMinutes(poi);
  return (
    (w !== undefined && w <= INNENDORS_RADIUS_MIN) ||
    (b !== undefined && b <= INNENDORS_RADIUS_MIN)
  );
}

/**
 * REGNVÆRSDAG — formen er TO STEDER AV ULIKT SLAG. To kinoer svarer ikke på
 * «hva finnes»; nærmeste i hver kategori navngis, og de to nærmeste
 * kategoriene blir svaret. Ingen «på kartet»-variant: spørsmålet lover
 * nærhet, og utenfor et kvarter utelates raden — det svaret bor i
 * Opplevelsers egne rader. Samme filtre som der: et forskningsbibliotek er
 * ikke mer innendørs-tilbud for en familie her enn i Opplevelser.
 */
function regnvaersdag(input: GlobalFaqInput): string | undefined {
  const steder = areaPoisWithMembers(input)
    .filter((p) => walkMinutes(p) !== undefined && erInnendorsNaer(p))
    .sort((a, b) => walkMinutes(a)! - walkMinutes(b)!);
  const perSlag = INNENDORS_SLAG.map(({ cat, slag, port }) => {
    const naermest = steder.find((p) => p.category.id === cat && (!port || port(p)));
    return naermest ? { poi: naermest, slag } : undefined;
  })
    .filter((x): x is { poi: FaqPoi; slag: string } => x !== undefined)
    .sort((a, b) => walkMinutes(a.poi)! - walkMinutes(b.poi)!)
    .slice(0, MAX_NAMED);

  const [først, andre] = perSlag;
  if (!først) return undefined;
  const del = (x: { poi: FaqPoi; slag: string }) =>
    `${namedPoi(x.poi)} er nærmeste ${x.slag}, ${reisetid(x.poi)}`;
  if (!andre) return `${del(først)}.`;
  return `${del(først)}, og ${namedPoi(andre.poi)} nærmeste ${andre.slag}, ${reisetid(andre.poi)}.`;
}

const AREA_ANSWER_BUILDERS: Record<string, AreaAnswerBuilder> = {
  "til-byen": tilByen,
  naermest,
  gangavstand,
  "mest-av": mestAv,
  "apent-sent": apentSent,
  "uten-bil": utenBil,
  "tjenester-samme-sted": tjenesterSammeSted,
  regnvaersdag,
};

/**
 * Områdets FAQ — boardets første stopp, der ingen kategori er valgt.
 *
 * Samme fletting som `generateCategoryFaq`, mot `AREA_BOARD_QUESTIONS`: kuratert
 * svar på en katalog-id VINNER og beholder plassen sin, kurators egne id-er
 * legges til til slutt. Den ene forskjellen er `GLOBAL_INTRO_ID`, som aldri blir
 * en rad — den er introen over lista.
 */
export function generateGlobalFaq(input: GlobalFaqInput): FaqEntry[] {
  const curatedById = new Map((input.curated ?? []).map((c) => [c.id, c]));
  const brukt = new Set<string>([GLOBAL_INTRO_ID]);
  const entries: FaqEntry[] = [];

  for (const question of AREA_BOARD_QUESTIONS) {
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
    const svar = AREA_ANSWER_BUILDERS[question.id]?.(input);
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
