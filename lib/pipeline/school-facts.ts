/**
 * Build-time skolefakta for én adresse: kretsskolene med trinn og elevtall, og
 * de videregående skolene i kommunen som er verdt å reise til.
 *
 * HVORFOR REGISTERET OG IKKE POI-RADEN: boardet har kretsskolen som POI (steg 3
 * velger den på krets, ikke på avstand), men POI-raden bærer bare navn og
 * koordinat. «1.–7. trinn» og «486 elever» — de to opplysningene en forelder
 * filtrerer på — står strukturert og gratis i NSR, og POI-teksten har dem ikke
 * fordi den deles av alle boards.
 *
 * HVORFOR VIDEREGÅENDE ER ET EGET SPØRSMÅL: `getSchoolZone` dekker bare
 * barne- og ungdomstrinn. Videregående har INGEN kretstilhørighet — inntaket er
 * fylkeskommunalt og karakterbasert — så det eneste sanne svaret er nærhet og
 * reisetid. Derfor listes de med koordinat her, og kalleren henter bussetiden
 * fra Entur.
 *
 * Fail-soft: kaster aldri. Uten kretsdekning (utenfor Trondheim) eller uten
 * registertreff utelates svaret, det dikters ikke.
 */

import {
  avstandMeter,
  fetchKommuneEnheter,
  fetchSkole,
  type RegisterKoordinat,
  type SkoleRegisterFacts,
} from "@/lib/editorial/udir-register";
import { normalizeSchoolKey } from "@/lib/pipeline/zoned-school-selection";
import { getSchoolZone } from "@/lib/utils/school-zones";

/**
 * Så mange videregående vi henter reisetid for. Nærmeste er svaret, resten er
 * «byens øvrige tilbud» — fem gir nok bredde uten å gjøre FAQ-en til en
 * skolekatalog, og holder Entur-kallene per provisjonering nede.
 */
export const MAX_VIDEREGAENDE = 5;

/**
 * Over dette regner vi koordinaten som ødelagt, ikke skolen som langt unna.
 * NSR har poster i Trondheim kommune med koordinat i Guineabukta — de kom ut
 * som 7 106 km fra Ranheim og ville toppet «nærmeste»-lista fra feil ende.
 */
const MAX_PLAUSIBLE_DISTANCE_M = 60_000;

/**
 * Avdelinger som ikke er et valg for en 16-åring. Fengselsundervisning og
 * voksenopplæring ligger i NSR som ordinære videregående enheter, og
 * «Charlottenlund videregående skole avd Trondheim Fengsel» ville ellers stått
 * i FAQ-en som et nabolagstilbud.
 */
const IKKE_ORDINAER_VGS = /\b(fengsel|kretsfengsel|voksenoppl)/i;

export interface KretsSchoolFact {
  /** Kretsnavnet fra kommunens polygon, f.eks. «RANHEIM». */
  krets: string;
  /** Skolenavnet slik NSR skriver det, f.eks. «Ranheim skole». */
  navn: string;
  orgnr: string;
  trinnFra: number | null;
  trinnTil: number | null;
  elevtall: number | null;
  offentlig: boolean;
}

export interface VideregaendeFact {
  navn: string;
  orgnr: string;
  offentlig: boolean;
  /** Luftlinje fra boligen, i meter. */
  distanceM: number;
  koordinat: RegisterKoordinat;
}

export interface SchoolFacts {
  /** Kretsskolen for barnetrinnet. Utelatt utenfor kretsdekning. */
  barneskole?: KretsSchoolFact;
  ungdomsskole?: KretsSchoolFact;
  /** Sortert på luftlinje, nærmest først. Kalleren legger på reisetid. */
  videregaaende: VideregaendeFact[];
}

export interface SchoolFactsResult {
  facts: SchoolFacts;
  warnings: string[];
}

/**
 * Velg den ene skolen kretsnavnet peker på.
 *
 * «CHARLOTTENLUND» treffer tre enheter i NSR: barneskolen, ungdomsskolen og den
 * videregående. Ordet i navnet avgjør — og treffer det ikke entydig, returnerer
 * vi null framfor å gjette. Et feil kretssvar er verre enn ingen krets.
 */
export function pickKretsSchool<T extends { navn: string }>(
  kind: "barneskole" | "ungdomsskole",
  matches: readonly T[],
): T | null {
  if (matches.length === 1) return matches[0];
  const explicit = matches.filter((m) => m.navn.toLowerCase().includes(kind));
  return explicit.length === 1 ? explicit[0] : null;
}

/** Er registerposten plausibel som kretsskole for dette trinnet? */
export function isPlausibleKretsSchool(
  kind: "barneskole" | "ungdomsskole",
  facts: SkoleRegisterFacts,
): boolean {
  if (!facts.aktiv || facts.videregaaende) return false;
  if (facts.trinnFra === null || facts.trinnTil === null) return facts.grunnskole;
  return kind === "barneskole" ? facts.trinnFra <= 1 : facts.trinnTil >= 10;
}

export async function fetchSchoolFacts(options: {
  lat: number;
  lng: number;
  kommunenummer: string;
}): Promise<SchoolFactsResult> {
  const { lat, lng, kommunenummer } = options;
  const warnings: string[] = [];
  const facts: SchoolFacts = { videregaaende: [] };
  const home: RegisterKoordinat = { lat, lng };

  let enheter: Array<{ orgnr: string; navn: string; aktiv: boolean }>;
  try {
    enheter = (await fetchKommuneEnheter("skole", kommunenummer)).filter((e) => e.aktiv);
  } catch (e) {
    warnings.push(
      `⚠️  NSR-oppslag for kommune ${kommunenummer} feilet (${message(e)}) — ingen skolefakta`,
    );
    return { facts, warnings };
  }

  // ── Kretsskolene ──────────────────────────────────────────────────────────
  // Utenfor Trondheim gir polygonene {null, null}. Det er ikke en feil, det er
  // «ingen kretsdata her» — spørsmålet utelates da stille (Straumen-prinsippet).
  const zone = getSchoolZone(lat, lng);
  for (const kind of ["barneskole", "ungdomsskole"] as const) {
    const krets = zone[kind];
    if (!krets) continue;

    const wanted = normalizeSchoolKey(krets);
    const matches = enheter.filter((e) => normalizeSchoolKey(e.navn) === wanted);
    if (matches.length === 0) {
      warnings.push(`⚠️  Kretsen «${krets}» (${kind}) har ingen NSR-enhet med samme navn`);
      continue;
    }
    const picked = pickKretsSchool(kind, matches);
    if (!picked) {
      warnings.push(
        `⚠️  Kretsen «${krets}» (${kind}) treffer ${matches.length} enheter uten entydig valg — utelatt`,
      );
      continue;
    }

    let detail: SkoleRegisterFacts | null = null;
    try {
      detail = await fetchSkole(picked.orgnr);
    } catch (e) {
      warnings.push(`⚠️  NSR-detaljer for ${picked.navn} feilet (${message(e)})`);
    }
    if (!detail || !isPlausibleKretsSchool(kind, detail)) {
      warnings.push(
        `⚠️  ${picked.navn} passer ikke som ${kind} i registeret — kretssvaret utelates`,
      );
      continue;
    }

    facts[kind] = {
      krets,
      navn: detail.navn,
      orgnr: detail.orgnr,
      trinnFra: detail.trinnFra,
      trinnTil: detail.trinnTil,
      elevtall: detail.elevtall,
      offentlig: detail.offentlig,
    };
  }

  // ── Videregående ──────────────────────────────────────────────────────────
  // Navnefilteret først: å hente detaljer for alle 243 aktive enheter i
  // kommunen for å finne 15 videregående er 228 kall til ingen nytte.
  const vgsKandidater = enheter.filter(
    (e) => /videreg/i.test(e.navn) && !IKKE_ORDINAER_VGS.test(e.navn),
  );
  for (const kandidat of vgsKandidater) {
    let detail: SkoleRegisterFacts | null = null;
    try {
      detail = await fetchSkole(kandidat.orgnr);
    } catch (e) {
      warnings.push(`⚠️  NSR-detaljer for ${kandidat.navn} feilet (${message(e)})`);
      continue;
    }
    if (!detail?.videregaaende || !detail.aktiv || !detail.koordinat) continue;

    const distanceM = Math.round(avstandMeter(home, detail.koordinat));
    if (distanceM > MAX_PLAUSIBLE_DISTANCE_M) {
      warnings.push(
        `⚠️  ${detail.navn} har ødelagt koordinat i NSR (${distanceM} m fra boligen) — utelatt`,
      );
      continue;
    }

    facts.videregaaende.push({
      navn: detail.navn,
      orgnr: detail.orgnr,
      offentlig: detail.offentlig,
      distanceM,
      koordinat: detail.koordinat,
    });
  }

  facts.videregaaende.sort((a, b) =>
    a.distanceM !== b.distanceM ? a.distanceM - b.distanceM : a.navn.localeCompare(b.navn, "no"),
  );
  facts.videregaaende = facts.videregaaende.slice(0, MAX_VIDEREGAENDE);

  return { facts, warnings };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
