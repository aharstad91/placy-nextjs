/**
 * Foreslå `postal_codes` for områder som har polygon men tom postnummerliste.
 *
 * Motsatt retning av `derive-area-boundary.ts`: der leses postnumre og lages
 * geometri, her leses geometri og foreslås postnumre.
 *
 * HVORFOR DET TRENGS: Straumen og Oppdal har håndtegnet polygon men tom
 * `postal_codes`. Dekningsregnskapet slår opp postnummer → område, så uten
 * tilknytning var de usynlige i regnskapet — inkludert Straumen, som er det mest
 * komplette området vi har (alle seks temaer, 29 av 30 høydepunkter med tekst).
 *
 * FORESLÅR, SKRIVER IKKE. Grunnen er ikke risiko — ingenting er shippet — men at
 * postnummer-tilknytning er en påstand om hvor et strøk *er*, og det er kurators
 * beslutning, ikke en geometrisk bieffekt. Samme prinsipp som at
 * `scripts/curate-pois.ts --list` lager en arbeidsliste framfor å skrive tekst.
 *
 * METODEN ER TILNÆRMET. To tester i hver sin retning, fordi begge har en blindsone:
 *
 *   1. Postnummerets punkter mot områdets polygon — fanger delvis overlapp, men
 *      ser ikke et lite område som ligger helt inne i et stort postnummer (da er
 *      ingen av postnummerets hjørner innenfor det lille området).
 *   2. Områdets punkter mot postnummerets polygon — fanger nettopp det tilfellet.
 *
 * Begge retninger bruker `interiorWitnesses`, ikke ringpunktene rå. Postnummer-
 * og krets-polygoner kommer fra hver sin kilde (Kartverket og Trondheim
 * kommune), så en delt grense faller aldri helt sammen — rå ringpunkter ville
 * gitt noen falske treff for hvert eneste naboområde.
 *
 * SENTERPUNKTET BRUKES IKKE. `center_lat`/`center_lng` ble håndskrevet i
 * migrasjon 050 og bommer beviselig: Vikåsen står med 63.4300/10.4800, som
 * ligger utenfor hele VIKÅSEN-kretsen. To-veis-testen over dekker uansett
 * tilfellet senteret var ment å fange.
 *
 * Det som fortsatt kan overses er et postnummer som overlapper området i et smalt
 * bånd uten at noe punkt fra noen av sidene havner innenfor. For en håndfull
 * områder er kurator-bekreftelse billigere enn en eksakt polygon-skjæring, som
 * ville krevd et clipping-bibliotek vi ellers ikke trenger (samme avveining som
 * «ingen ekte union» i derive-area-boundary.ts).
 */

import {
  interiorWitnesses,
  pointInGeometry,
  type GeoJsonPolygonGeometry,
} from "@/lib/utils/geo";

export interface PostalAreaWithMeta {
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  boundary: { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface AreaForSuggestion {
  id: string;
  name_no: string;
  boundary: GeoJsonPolygonGeometry | null;
  boundary_source: string | null;
  postal_codes: string[] | null;
}

export interface PostalCandidate {
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  /** Punkter fra postnummeret som ligger inne i området. */
  postnummerIOmrade: number;
  /** Punkter fra området som ligger inne i postnummeret. */
  omradeIPostnummer: number;
  /** Andel av postnummeret som ligger i området, 0–1. «Er dette postnummeret dekket?» */
  andelAvPostnummer: number;
  /** Andel av området som ligger i postnummeret, 0–1. «Hvor ligger dette strøket?» */
  andelAvOmrade: number;
}

export interface Suggestion {
  id: string;
  name: string;
  boundary_source: string | null;
  /** Postnumrene raden har i dag — slik at forslaget kan leses som en diff. */
  naavaerende: string[];
  /** Sortert med sterkeste signal først. Over terskelen. */
  kandidater: PostalCandidate[];
  /**
   * Under terskelen — så vidt inntil, eller en flik i hjørnet.
   *
   * Rapporteres i stedet for å kastes: postnummer- og kretsgrenser er tegnet
   * for hver sin hensikt (postrute mot skoleopptak) og faller aldri sammen, så
   * et strøk klipper alltid borti naboene sine. Et svakt treff er som regel
   * støy, men det er kurator som skal se det og avgjøre.
   */
  svakeTreff: PostalCandidate[];
}

export type SkipReason = "har-postnummer" | "mangler-boundary" | "gjettet-form";

export interface SuggestionResult {
  suggestions: Suggestion[];
  /** Vurdert, men ingen postnummer overlappet. Rapporteres, ikke utelates. */
  utenTreff: Array<{ id: string; name: string }>;
  hoppetOver: Array<{ id: string; name: string; reason: SkipReason }>;
}

export interface SuggestOptions {
  /**
   * Ta med områder som allerede har `postal_codes`.
   *
   * Trengs når formen er byttet til noe autoritativt: postnumrene fra migrasjon
   * 050 er da eldre og svakere enn geometrien de skulle beskrive, og skal leses
   * som en diff mot det geometrien sier.
   */
  inkluderEksisterende?: boolean;
  /**
   * Krev at formen er autoritativ (`curated` eller `krets`).
   *
   * En `derived`-form er selv avledet av postnumrene, så å utlede postnumre fra
   * den er en sirkel: den ville bare bekreftet gjetningen den kom fra.
   */
  kunAutoritativForm?: boolean;
  /** Overstyr terskelen. Se `TERSKEL`. */
  terskel?: number;
}

const AUTORITATIV = new Set(["curated", "krets"]);

/**
 * Hvor stor andel som må ligge innenfor før et treff regnes som ekte.
 *
 * 15 % på én av de to retningene. Uten terskel ble Ila foreslått med 13
 * postnumre, flere av dem med ett eneste punkt innenfor — postnummergrenser og
 * skolekretsgrenser er tegnet for hver sin hensikt og krysser hverandre overalt.
 * Terskelen skiller «strøket ligger her» fra «strøket klipper hjørnet».
 */
export const TERSKEL = 0.15;

export function suggestPostalCodes(
  areas: AreaForSuggestion[],
  postalAreas: PostalAreaWithMeta[],
  options: SuggestOptions = {}
): SuggestionResult {
  const {
    inkluderEksisterende = false,
    kunAutoritativForm = false,
    terskel = TERSKEL,
  } = options;

  const suggestions: Suggestion[] = [];
  const utenTreff: Array<{ id: string; name: string }> = [];
  const hoppetOver: Array<{ id: string; name: string; reason: SkipReason }> = [];

  // Beregnes én gang per postnummer, ikke per område — 114 polygoner × 46 områder.
  const postalWitnesses = new Map(
    postalAreas.map((p) => [p.postnummer, interiorWitnesses(p.boundary)])
  );

  for (const area of areas) {
    const name = area.name_no;
    const naavaerende = area.postal_codes ?? [];

    if (!inkluderEksisterende && naavaerende.length > 0) {
      hoppetOver.push({ id: area.id, name, reason: "har-postnummer" });
      continue;
    }
    if (!area.boundary) {
      hoppetOver.push({ id: area.id, name, reason: "mangler-boundary" });
      continue;
    }
    if (kunAutoritativForm && !AUTORITATIV.has(area.boundary_source ?? "")) {
      hoppetOver.push({ id: area.id, name, reason: "gjettet-form" });
      continue;
    }
    const areaBoundary = area.boundary;
    const areaWitnesses = interiorWitnesses(areaBoundary);

    const kandidater: PostalCandidate[] = [];

    for (const postal of postalAreas) {
      // Retning 1: postnummeret inn i området.
      let postnummerIOmrade = 0;
      for (const [lng, lat] of postalWitnesses.get(postal.postnummer) ?? []) {
        if (pointInGeometry(lng, lat, areaBoundary)) postnummerIOmrade++;
      }

      // Retning 2: området inn i postnummeret. Fanger et lite område som ligger
      // helt inne i ett stort postnummer, der retning 1 ikke gir noe utslag.
      let omradeIPostnummer = 0;
      for (const [lng, lat] of areaWitnesses) {
        if (pointInGeometry(lng, lat, postal.boundary)) omradeIPostnummer++;
      }

      if (postnummerIOmrade === 0 && omradeIPostnummer === 0) continue;

      const postalPunkter = postalWitnesses.get(postal.postnummer)?.length ?? 0;
      kandidater.push({
        postnummer: postal.postnummer,
        poststed: postal.poststed,
        kommunenavn: postal.kommunenavn,
        postnummerIOmrade,
        omradeIPostnummer,
        andelAvPostnummer: postalPunkter === 0 ? 0 : postnummerIOmrade / postalPunkter,
        andelAvOmrade:
          areaWitnesses.length === 0 ? 0 : omradeIPostnummer / areaWitnesses.length,
      });
    }

    if (kandidater.length === 0) {
      utenTreff.push({ id: area.id, name });
      continue;
    }

    // Sorter på hvor mye av OMRÅDET som ligger i postnummeret: det svarer på
    // «hvor hører dette strøket hjemme», ikke «hvor stort er postnummeret».
    const sorter = (a: PostalCandidate, b: PostalCandidate) =>
      b.andelAvOmrade - a.andelAvOmrade ||
      b.andelAvPostnummer - a.andelAvPostnummer ||
      a.postnummer.localeCompare(b.postnummer);

    const over = kandidater
      .filter((k) => k.andelAvOmrade >= terskel || k.andelAvPostnummer >= terskel)
      .sort(sorter);
    const under = kandidater
      .filter((k) => k.andelAvOmrade < terskel && k.andelAvPostnummer < terskel)
      .sort(sorter);

    if (over.length === 0) {
      utenTreff.push({ id: area.id, name });
      continue;
    }

    suggestions.push({
      id: area.id,
      name,
      boundary_source: area.boundary_source,
      naavaerende,
      kandidater: over,
      svakeTreff: under,
    });
  }

  return { suggestions, utenTreff, hoppetOver };
}
