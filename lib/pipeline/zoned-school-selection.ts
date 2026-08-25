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

/**
 * Hvorfor en skole ble valgt.
 *
 * `krets` — kretsskolen for adressen, uansett avstand. Det er svaret på «hvor
 *   går ungene», og det ene valget som er et faktum om BOLIGEN.
 * `i-omraadet` — skolen ligger innenfor discovery-radiusen. Et nabolagsfaktum,
 *   ikke et krets-svar.
 * `naermeste` — beholdt for fallbacken når kretsdata mangler helt.
 */
export type SelectionReason = "krets" | "naermeste" | "i-omraadet";

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

/**
 * Finn NSR-skoler som pipelinen har linket tidligere, men ikke lenger velger.
 *
 * Nødvendig fordi valget nå er kretsdrevet: en gammel kjøring linket
 * «Møller bilskolen AS» som ungdomsskolen på Wesselsløkka, og et mellomsteg i
 * denne endringen linket Charlottenlund-skolene 2,4 km unna. Ingen av dem er
 * dubletter, så dublett-ryddingen ser dem ikke.
 *
 * Bare rader pipelinen selv eier (`source === "nsr"`) ryddes — OSM-sveipet og
 * håndkuratering skal ikke røres, og rader kuratering peker på fredes.
 */
export function planStaleSchoolUnlink(
  selectedIds: ReadonlySet<string>,
  pooled: Array<PooledSchool & { source: string | null }>,
  protectedIds: ReadonlySet<string>,
): PooledSchool[] {
  return pooled.filter(
    (p) => p.source === "nsr" && !selectedIds.has(p.id) && !protectedIds.has(p.id),
  );
}

/** Nærmeste kandidat av en type innenfor radius. Deterministisk ved likhet. */
export function nearestOfType(
  candidates: SchoolCandidate[],
  type: SchoolType,
  radiusMeters: number,
  exclude: ReadonlySet<string> = new Set(),
): SchoolCandidate | null {
  const eligible = (c: SchoolCandidate) =>
    c.type === type ||
    (c.type === "grunnskole" && (type === "barneskole" || type === "ungdomsskole"));
  // AVSTAND dominerer her — det er hele poenget med «nærmeste». Et forsøk på å
  // la eksplisitt type gå foran ga Wesselsløkka de to Charlottenlund-skolene
  // 2,4 km unna framfor Eberg skole 665 m unna, fordi Eberg er en 1–10-skole.
  // `exclude` lar kalleren hoppe over rader som alt er valgt, så én skole ikke
  // fyller to plasser når et alternativ finnes.
  return (
    [...candidates]
      .filter(
        (c) =>
          eligible(c) && c.distanceMeters <= radiusMeters && !exclude.has(c.id),
      )
      .sort((a, b) =>
        a.distanceMeters !== b.distanceMeters
          ? a.distanceMeters - b.distanceMeters
          : a.name.localeCompare(b.name),
      )[0] ?? null
  );
}

/**
 * Er de to kandidatene samme skole under to NSR-navn?
 *
 * NSR har både morenheten og avdelingen som egne enheter med egne orgnr:
 * «Stiftelsen steinerskolen på Rotvoll» og «Stiftelsen steinerskolen Rotvoll»
 * ligger på samme koordinat, og «Lukas videregående skole AS» finnes to ganger.
 * Så lenge bare tre skoler ble valgt var dublettene usynlige; når alle skoler
 * innenfor radiusen tas med, blir de to pins på samme punkt.
 *
 * To signaler må være oppfylt samtidig, ellers slår regelen inn på ekte skoler:
 * ordene i det korteste navnet må være en delmengde av det lengste, OG
 * avstanden fra boligen må være praktisk talt den samme (samme tomt).
 * «Charlottenlund barneskole» og «Charlottenlund ungdomsskole» ligger på samme
 * tomt, men ingen av navnene er en delmengde av det andre — de består.
 */
export function isSameSchool(
  a: SchoolCandidate,
  b: SchoolCandidate,
  maxDistanceDeltaMeters = 50,
): boolean {
  if (Math.abs(a.distanceMeters - b.distanceMeters) > maxDistanceDeltaMeters) return false;
  const wordsA = new Set(normalizeFullSchoolName(a.name).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeFullSchoolName(b.name).split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const [small, large] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  for (const w of small) {
    if (!large.has(w)) return false;
  }
  return true;
}

/**
 * Avdelinger som ikke er et skoletilbud for en 16-åring i nabolaget.
 * Fengselsundervisning og voksenopplæring ligger i NSR som ordinære
 * videregående enheter — «Charlottenlund videregående skole avd Trondheim
 * Fengsel» ville ellers blitt en pin på kartet nå som alle skoler innenfor
 * radiusen tas med. Samme regel som `school-facts.ts` bruker på FAQ-siden.
 */
const IKKE_ORDINAERT_TILBUD = /\b(fengsel|kretsfengsel|voksenoppl)/i;

/**
 * Velg skolene som skal importeres.
 *
 * ENDRET 2026-08-24 (Andreas' Steinerskole-funn): valget var kretsskolen for
 * hvert trinn pluss nærmeste videregående — maksimalt TRE skoler per board.
 * Det ga en asymmetri ingen kunne forklare: 19 barnehager fra Barnehagefakta
 * (alt innenfor radius) mot 3 skoler fra NSR, en like god kilde. «Steinerskolen
 * på Rotvoll» lå i poolen fra både NSR og OSM og ble aktivt revet av boardet av
 * `planStaleSchoolUnlink`, fordi den ikke var kretsskole. En privatskole 1,1 km
 * unna er et nabolagsfaktum enten ungene dine sogner dit eller ikke.
 *
 * Nå: kretsskolene FØRST (de er svaret på «hvor går ungene», og gjelder uansett
 * avstand), og deretter ALLE skoler innenfor discovery-radiusen — samme regel
 * som barnehagene. Hvilken som er kretsskolen står fortsatt i board-faktaene
 * («Boligen sogner til …», `lib/generators/faq-generator.ts`), så flere pins
 * gjør ikke krets-svaret utydeligere.
 *
 * Stedsnøytralitet (Straumen-prinsippet): «ingen kretsdata her» må ha definert
 * oppførsel, ikke tom liste. Utenfor Trondheim faller vi tilbake til nærmeste
 * per trinn, slik at et board aldri står uten skole selv om alle ligger utenfor
 * radiusen.
 */
export function selectSchools(
  zone: SchoolZoneNames,
  candidates: SchoolCandidate[],
  radiusMeters: number,
): SelectionResult {
  const picks: SchoolPick[] = [];
  const warnings: string[] = [];
  const chosen = new Set<string>();

  const add = (
    candidate: SchoolCandidate | null,
    type: SchoolType,
    reason: SelectionReason,
  ) => {
    if (!candidate || chosen.has(candidate.id)) return;
    if (IKKE_ORDINAERT_TILBUD.test(candidate.name)) return;
    // NSR-dubletter (morenhet + avdeling på samme koordinat) skal ikke bli to
    // pins på samme punkt.
    if (picks.some((p) => isSameSchool(p.candidate, candidate))) return;
    chosen.add(candidate.id);
    picks.push({ candidate, type, reason });
  };

  // 1. Kretsskolen per trinn — uansett avstand.
  for (const type of ["barneskole", "ungdomsskole"] as const) {
    const kretsName = zone[type];
    const kretsSchool = matchKretsToSchool(kretsName, candidates, type);
    if (kretsSchool) {
      add(kretsSchool, type, "krets");
      continue;
    }
    if (kretsName) {
      warnings.push(
        `Kretsen «${kretsName}» (${type}) har ingen NSR-skole med samme navn — faller tilbake til nærmeste.`,
      );
    }
    add(nearestOfType(candidates, type, radiusMeters, chosen), type, "naermeste");
  }

  // 2. Alle øvrige skoler innenfor radiusen. Nærmest først, så et board med
  //    mange skoler leser i den rekkefølgen en beboer bryr seg om.
  const iOmraadet = candidates
    .filter((c) => c.distanceMeters <= radiusMeters)
    .sort((a, b) =>
      a.distanceMeters !== b.distanceMeters
        ? a.distanceMeters - b.distanceMeters
        : a.name.localeCompare(b.name),
    );
  for (const candidate of iOmraadet) {
    add(candidate, candidate.type, "i-omraadet");
  }

  // 3. Videregående: ingen krets finnes (fylkeskommunalt, karakterbasert
  //    inntak), så nærmeste er svaret hvis ingen lå innenfor radiusen.
  add(
    nearestOfType(candidates, "videregaende", radiusMeters, chosen),
    "videregaende",
    "naermeste",
  );

  return { picks, warnings };
}
