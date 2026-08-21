/**
 * Finn POI-tekst som er forankret i ETT prosjekt.
 *
 * BAKGRUNN (2026-08-14): Andreas så «Grilstadstranda is a popular bathing
 * spot…» på et norsk board. Oversettelsen var symptomet; da den ble sporet,
 * viste det seg at den norske kildeteksten sa «Kort vei fra Overvik» — på et
 * Ranheim-board, om et prosjekt som ikke finnes lenger.
 *
 * DEN STRUKTURELLE FEILEN: `pois` er ÉN rad delt av alle boards. En tekst som
 * navngir et prosjekt er derfor bare sann på det ene boardet, og feil på alle
 * andre som viser samme POI. Det er samme prinsipp som ble slått fast
 * 2026-08-12 om tema-oversettelsene: globale nøkler kan aldri bære stedsbundet
 * prosa. Per-board-tekst hører hjemme i grounding/kuratering, ikke på POI-raden.
 *
 * Ren modul: ingen IO.
 */

/**
 * Prosjektnavn som ikke lenger finnes i `projects`, men fortsatt står i
 * POI-tekst. Kan ikke utledes av databasen — prosjektet er borte, navnet lever
 * bare i prosaen. Utvid listen når et nytt dødt navn dukker opp i auditen.
 */
export const KJENTE_DODE_PROSJEKTNAVN = [
  "Overvik",
  "StasjonsKvartalet",
  "Vikhammer",
  "Hommelvik",
  "Saksvik",
  "Sveberg",
] as const;

/** Feltene som kan bære redaksjonell POI-tekst. */
export const TEKSTFELT = ["editorial_hook", "local_insight", "description"] as const;

export type Tekstfelt = (typeof TEKSTFELT)[number];

export interface LegacyTextPoi {
  id: string;
  name: string;
  editorial_hook?: string | null;
  local_insight?: string | null;
  description?: string | null;
  grounding?: { curated?: unknown; generated?: unknown } | null;
}

export interface LegacyTextHit {
  poi: LegacyTextPoi;
  /** Felt → prosjektnavnet teksten forankrer seg i. */
  felter: Array<{ felt: Tekstfelt; prosjekt: string; tekst: string }>;
  /** Har POI-en grounded/kuratert tekst som overtar når feltet tømmes? */
  harErstatning: boolean;
}

/**
 * Bygg søkemønsteret. Navnene sorteres lengst først så «Grilstad Marina»
 * matcher før «Grilstad» ville gjort det, og regex-metategn escapes — et
 * prosjektnavn er fri tekst fra en operatør, ikke et mønster vi kontrollerer.
 */
export function byggProsjektnavnListe(
  levendeProsjektnavn: string[],
  dodeNavn: readonly string[] = KJENTE_DODE_PROSJEKTNAVN,
): string[] {
  const alle = [...new Set([...levendeProsjektnavn, ...dodeNavn])]
    .map((n) => n.trim())
    .filter((n) => n.length >= 4); // «Ila» o.l. gir for mange falske treff
  return alle.sort((a, b) => b.length - a.length);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finner første prosjektnavn teksten nevner, eller null. */
export function finnProsjektnavnITekst(
  tekst: string | null | undefined,
  prosjektnavn: string[],
): string | null {
  if (!tekst) return null;
  for (const navn of prosjektnavn) {
    if (byggNavneRegex(navn).test(tekst)) return navn;
  }
  return null;
}

/**
 * Ordgrense så «Lade» ikke treffer «Ladestien» — men BETINGET.
 *
 * `\b` krever et ord-tegn på innsiden. Et navn som slutter på «)» fikk derfor
 * et mønster som aldri kunne matche: i «Kvartal (nord).» er både «)» og «.»
 * ikke-ord-tegn, så det finnes ingen grense mellom dem.
 */
function byggNavneRegex(navn: string): RegExp {
  const kilde = escapeRegex(navn);
  const start = /^\w/.test(navn) ? "\\b" : "";
  const slutt = /\w$/.test(navn) ? "\\b" : "";
  return new RegExp(`${start}${kilde}${slutt}`, "i");
}

export function finnLegacyTekst(
  pois: LegacyTextPoi[],
  prosjektnavn: string[],
): LegacyTextHit[] {
  const treff: LegacyTextHit[] = [];

  for (const poi of pois) {
    const felter: LegacyTextHit["felter"] = [];
    for (const felt of TEKSTFELT) {
      const tekst = poi[felt];
      const prosjekt = finnProsjektnavnITekst(tekst, prosjektnavn);
      if (prosjekt && tekst) felter.push({ felt, prosjekt, tekst });
    }
    if (felter.length === 0) continue;

    treff.push({
      poi,
      felter,
      harErstatning: Boolean(poi.grounding?.curated || poi.grounding?.generated),
    });
  }

  return treff;
}

/**
 * Hvilke felter skal nulles, og mister POI-en all tekst av det?
 *
 * Hele feltet tømmes, ikke bare setningen med prosjektnavnet: teksten er
 * gjennomgående skrevet SOM en relasjon til prosjektet («Treningsalternativ i
 * gangavstand fra Overvik»), så det som blir igjen er enten tomt eller en
 * påstand uten innhold.
 */
export function planTekstopprydding(treff: LegacyTextHit): {
  patch: Record<string, null>;
  mister_all_tekst: boolean;
} {
  const patch: Record<string, null> = {};
  for (const { felt } of treff.felter) patch[felt] = null;

  const beholdt = TEKSTFELT.filter(
    (f) => !(f in patch) && Boolean(treff.poi[f]),
  );
  return {
    patch,
    mister_all_tekst: beholdt.length === 0 && !treff.harErstatning,
  };
}
