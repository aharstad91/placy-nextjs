/**
 * Velg skoler til et board ut fra SKOLEKRETS, ikke avstand.
 *
 * BAKGRUNN (2026-08-14, Andreas' funn på Ranheim): `importNSR` valgte
 * *nærmeste* skole per type innenfor discovery-radiusen. Nærmeste er ikke
 * kretsskolen. På Grilstad Marina ga det «Stiftelsen steinerskolen på Rotvoll»
 * som barneskole (1 150 m) mens den faktiske kretsskolen — Ranheim skole —
 * bare lå på boardet fordi noen hadde lagt den inn for hånd. Ungdomsskolen
 * manglet helt fra NSR-importen.
 *
 * Kretsskolen er et faktum om ADRESSEN, ikke om avstanden: en bolig i Vikåsen
 * sogner til Markaplassen (2,9 km) uansett hvor mange skoler som ligger nærmere.
 * Derfor gjelder ingen radius for kretsvalget.
 *
 * Ren modul: ingen IO. `getSchoolZone` (Trondheim-polygoner) og NSR-henting
 * gjøres av kalleren.
 */

import { calculateDistance } from "@/lib/utils/geo";

/**
 * `grunnskole` = 1–10-skole som dekker BÅDE barne- og ungdomstrinn.
 *
 * Den er ikke en finesse: NSR koder alle Trondheims grunnskoler som nace
 * 85.201, og kommunen har ikke én eneste 85.21x-enhet. Uten denne verdien
 * kunne typen «ungdomsskole» aldri oppstå i Trondheim, og kretsmatchen for
 * ungdomstrinnet ville alltid bommet. Markaplassen skole er nettopp en slik
 * 1–10-skole, og den ER ungdomsskolen for MARKAPLASSEN-kretsen.
 */
export type SchoolType = "barneskole" | "ungdomsskole" | "grunnskole" | "videregaende";

export interface SchoolCandidate {
  id: string;
  name: string;
  type: SchoolType;
  /** Meter fra boardets senter. */
  distanceMeters: number;
}

export interface SchoolZoneNames {
  /** Kretsnavn fra kommunens polygon, f.eks. "RANHEIM". Null utenfor dekning. */
  barneskole: string | null;
  ungdomsskole: string | null;
}

export type SelectionReason = "krets" | "naermeste";

export interface SchoolPick {
  candidate: SchoolCandidate;
  type: SchoolType;
  reason: SelectionReason;
}

export interface SelectionResult {
  picks: SchoolPick[];
  warnings: string[];
}

/**
 * Reduser skole- og kretsnavn til en sammenlignbar nøkkel.
 *
 * Kretsnavnet ER skolenavnet i kommunens data («RANHEIM», «MARKAPLASSEN»,
 * «Hansbakken»), mens NSR skriver «Ranheim skole» og «Markaplassen skole».
 * Nøkkelen fjerner derfor skoleslags-ordene, ikke bare store bokstaver.
 * Norske bokstaver translittereres FØR tegnfjerning — `ø` er en egen
 * Unicode-bokstav, ikke o + diakritikk (samme felle som `slugify` beskriver).
 */
export function normalizeSchoolKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/\b(videreg[a]ende|ungdomsskolen|ungdomsskole|barneskolen|barneskole|skolen|skole)\b/g, " ")
    .replace(/\b(as|sa|stiftelsen)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finn skolen som bærer kretsens navn, blant kandidater av riktig type.
 *
 * Eksakt nøkkeltreff først. Prefiks-treff er fallback fordi enkelte kretser
 * dekker en skole med utvidet navn; nærmeste kandidat vinner ved flere treff,
 * så valget er deterministisk.
 */
export function matchKretsToSchool(
  kretsName: string | null,
  candidates: SchoolCandidate[],
  type: SchoolType,
): SchoolCandidate | null {
  if (!kretsName) return null;
  const wanted = normalizeSchoolKey(kretsName);
  if (wanted === "") return null;

  // En 1–10-skole dekker begge trinn og er derfor gyldig for begge kretstyper.
  const eligible = (c: SchoolCandidate) =>
    c.type === type ||
    (c.type === "grunnskole" && (type === "barneskole" || type === "ungdomsskole"));

  // ÉN ordning, ikke to: eksplisitt type før 1–10-skole, deretter avstand.
  // Sorteres det på avstand til slutt i en egen runde, vinner nærmeste uansett
  // type — og «Charlottenlund barneskole» ville kapret ungdomskretsen fra
  // «Charlottenlund ungdomsskole», siden begge normaliserer til «charlottenlund».
  const ranked = candidates.filter(eligible).sort((a, b) => {
    const typeRank = (c: SchoolCandidate) => (c.type === type ? 0 : 1);
    if (typeRank(a) !== typeRank(b)) return typeRank(a) - typeRank(b);
    if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
    return a.name.localeCompare(b.name);
  });

  const exact = ranked.find((c) => normalizeSchoolKey(c.name) === wanted);
  if (exact) return exact;

  const prefix = ranked.find((c) => normalizeSchoolKey(c.name).startsWith(`${wanted} `));
  if (prefix) return prefix;

  // Kommunen og NSR staver ikke alltid likt: kretsen heter BLUSSUVOLD, skolen
  // heter «Blussuvoll skole». Én tegns forskjell godtas — men BARE når treffet
  // er entydig, ellers gjetter vi mellom to ekte skoler.
  const near = ranked.filter((c) => isOneEditApart(normalizeSchoolKey(c.name), wanted));
  return near.length === 1 ? near[0] : null;
}

/**
 * Er de to strengene maks én redigering fra hverandre (bytte, innsetting,
 * sletting)? Egen implementasjon framfor full Levenshtein fordi terskelen ER 1
 * — alt over er utenfor det vi tør matche automatisk.
 */
export function isOneEditApart(a: string, b: string): boolean {
  // Under 6 tegn er én redigering en for stor andel av navnet til å være trygg.
  if (a.length < 6 || b.length < 6) return a === b;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (short.length === long.length) i++;
    j++;
  }
  return edits + (long.length - j) <= 1;
}

/**
 * Kjøre-, musikk- og danseskoler er ikke grunnskoler.
 *
 * De må lukes ut på navn fordi NSR gir dem grunnskole-koder: «Møller bilskolen
 * AS avd Trøndelag» sto som ungdomsskolen på Wesselsløkka-boardet.
 */
const IKKE_GRUNNSKOLE =
  /\b(bilskole|bilskolen|trafikkskole|kjoreskole|kjøreskole|sjoskole|sjøskole|musikkskole|danseskole|rideskole|folkehogskole|folkehøgskole|fagskole|kompetanse|bedriftshjelp|fagakademi)\b/i;

/**
 * Utled skoleslag fra NSR-raden.
 *
 * Nace-koden alene holder ikke: Trondheim koder ALLE sine 80 grunnskoler som
 * 85.201 og har ikke én 85.21x-enhet, så typen «ungdomsskole» kunne aldri
 * oppstå. Navnet bærer informasjonen kommunen ikke la i koden.
 */
export function resolveSchoolTypeFromNsr(
  naceKode: string,
  name: string,
): SchoolType | null {
  if (IKKE_GRUNNSKOLE.test(name)) return null;

  const lower = name.toLowerCase();
  if (naceKode === "85.310" || naceKode === "85.320") return "videregaende";
  if (lower.includes("videregående") || lower.includes("videregaende")) return "videregaende";
  if (lower.includes("ungdomsskole")) return "ungdomsskole";
  if (lower.includes("barneskole")) return "barneskole";
  if (naceKode.startsWith("85.21")) return "ungdomsskole";
  if (naceKode === "85.201" || naceKode === "85.202") return "grunnskole";
  return null;
}

export interface PooledSchool {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Navnenøkkel for DUBLETT-sammenligning — beholder skoleslaget.
 *
 * `normalizeSchoolKey` stripper «barneskole»/«ungdomsskole» fordi kretsen bare
 * bærer stedsnavnet. Til dublettdeteksjon er nettopp det ordet forskjellen:
 * «Charlottenlund barneskole» og «Charlottenlund ungdomsskole» er to skoler på
 * samme tomt, og med den andre nøkkelen ble den ene feilaktig fjernet fra
 * poolen. Selskapsform og «Stiftelsen» stripes fortsatt, så «Lukas videregående
 * skole» og «Lukas videregående skole AS» regnes som samme.
 */
export function normalizeFullSchoolName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/\b(as|asa|sa|ba|stiftelsen)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finn skoler som alt ligger i boardets pool og er SAMME skole som en vi
 * nettopp valgte, bare fra en annen kilde.
 *
 * Nødvendig fordi kretsvalget henter NSR-raden mens OSM-sveipet og gammel
 * håndkuratering kan ha sin egen rad for samme skole — uten felles ekstern
 * nøkkel, så `upsertAndLink` ser dem ikke. Uten dette steget ville
 * krets-fiksen lagt «Charlottenlund ungdomsskole» og «Ranheim skole» dobbelt
 * på kartet.
 *
 * `protectedIds` er rader kuratering peker på; de fjernes aldri.
 */
export function planSchoolDeduplication(
  selected: PooledSchool[],
  pooled: PooledSchool[],
  protectedIds: ReadonlySet<string>,
  maxDistanceMeters = 250,
): PooledSchool[] {
  const selectedIds = new Set(selected.map((s) => s.id));
  const unlink: PooledSchool[] = [];

  for (const candidate of pooled) {
    if (selectedIds.has(candidate.id) || protectedIds.has(candidate.id)) continue;
    const candidateKey = normalizeFullSchoolName(candidate.name);
    if (candidateKey === "") continue;

    const twin = selected.find((s) => {
      const key = normalizeFullSchoolName(s.name);
      if (key !== candidateKey) return false;
      return (
        calculateDistance(s.lat, s.lng, candidate.lat, candidate.lng) <= maxDistanceMeters
      );
    });
    if (twin) unlink.push(candidate);
  }

  return unlink;
}

/** Nærmeste kandidat av en type innenfor radius. Deterministisk ved likhet. */
export function nearestOfType(
  candidates: SchoolCandidate[],
  type: SchoolType,
  radiusMeters: number,
): SchoolCandidate | null {
  const eligible = (c: SchoolCandidate) =>
    c.type === type ||
    (c.type === "grunnskole" && (type === "barneskole" || type === "ungdomsskole"));
  // Eksplisitt type før 1–10-skole, deretter avstand. Uten type-prioriteten
  // kaprer en nærliggende 1–10-skole ungdomsskole-plassen fra den ekte
  // ungdomsskolen litt lenger unna.
  return (
    [...candidates]
      .filter((c) => eligible(c) && c.distanceMeters <= radiusMeters)
      .sort((a, b) => {
        const rank = (c: SchoolCandidate) => (c.type === type ? 0 : 1);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
        return a.name.localeCompare(b.name);
      })[0] ?? null
  );
}

/**
 * Velg skolene som skal importeres.
 *
 * - `barneskole` og `ungdomsskole`: kretsskolen, UANSETT avstand. Finnes ingen
 *   krets (utenfor Trondheim) eller ingen navnematch, faller vi tilbake til
 *   nærmeste innenfor radius — samme oppførsel som før.
 * - `videregaende`: nærmeste innenfor radius. Det finnes ingen kretsdata for
 *   videregående; inntak er fylkeskommunalt og karakterbasert.
 * - Er nærmeste en ANNEN skole enn kretsskolen, tas begge med. Kretsskolen er
 *   svaret på «hvor går ungene», den nærmeste er fortsatt et nabolagsfaktum,
 *   og å fjerne den ville tatt bort innhold boards viser i dag.
 *
 * Stedsnøytralitet (Straumen-prinsippet): «ingen kretsdata her» må ha definert
 * oppførsel, ikke tom liste.
 */
export function selectSchools(
  zone: SchoolZoneNames,
  candidates: SchoolCandidate[],
  radiusMeters: number,
): SelectionResult {
  const picks: SchoolPick[] = [];
  const warnings: string[] = [];
  const chosen = new Set<string>();

  const add = (candidate: SchoolCandidate | null, type: SchoolType, reason: SelectionReason) => {
    if (!candidate || chosen.has(candidate.id)) return;
    chosen.add(candidate.id);
    picks.push({ candidate, type, reason });
  };

  for (const type of ["barneskole", "ungdomsskole"] as const) {
    const kretsName = zone[type];
    const kretsSchool = matchKretsToSchool(kretsName, candidates, type);

    if (kretsSchool) {
      add(kretsSchool, type, "krets");
    } else if (kretsName) {
      warnings.push(
        `Kretsen «${kretsName}» (${type}) har ingen NSR-skole med samme navn — faller tilbake til nærmeste.`,
      );
    }

    const nearest = nearestOfType(candidates, type, radiusMeters);
    if (nearest && nearest.id !== kretsSchool?.id) {
      add(nearest, type, "naermeste");
    }
  }

  add(nearestOfType(candidates, "videregaende", radiusMeters), "videregaende", "naermeste");

  return { picks, warnings };
}
