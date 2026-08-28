/**
 * Anker-oppløsning: hvilke POI-er ligger inne i et kjøpesenter?
 *
 * Et kjøpesenter er ÉN destinasjon, ikke 40 butikker. Denne modulen avgjør
 * hvilke POI-er som er MEDLEMMER av et anker, slik at senteret kan vises som ett
 * sted med et innholdsregister i stedet for som N pinner som stables på kartet.
 *
 * Ren funksjon: ingen I/O, ingen nettverk, ingen klokke. Kalleren skaffer data,
 * denne bestemmer — samme kontrakt som `pin-declutter.ts`. Resultatet skrives til
 * `v2.pois.parent_poi_id` i pipelinen og leses av `report-data.ts`.
 *
 * ## De tre gatene, i prioritert rekkefølge
 *
 * 1. **Containment** (`containedInIds`) — Googles egen `containingPlaces`. Målt
 *    2026-08-27 mot Sirkus Shopping: 47 av 52 steder innen 200 m bar feltet, alle
 *    med samme container-id, og de fem uten lå faktisk UTENFOR bygget (EkoMarket,
 *    Peppes Leangen, H2 Frisør på andre siden av gata). Autoritativt når det finnes.
 *
 * 2. **Adresse** — samme normaliserte gate OG husnummer i ankerets husnummer-sett.
 *    Bærer Sirkus, der ankerets koordinat sitter i byggets sørøstre hjørne
 *    (byte-identisk med Levi's Store) og de fjerneste medlemmene ligger ~150 m unna.
 *    Ren nærhet ville bommet skjevt der.
 *
 * 3. **Nærhet** — innenfor {@link TIGHT_RADIUS_M} av ankeret. Bærer Vikhammer
 *    senteret, der Google plasserer ankeret på «Utsikten 13» mens de fem medlemmene
 *    står på «Stasjonsvegen 1» — ulike gatenavn, men 5–25 m faktisk avstand. Ren
 *    adresse-match ville gitt null medlemmer der. Målt: `containingPlaces` er
 *    FRAVÆRENDE på alle fem, så gate 1 redder ikke dette tilfellet.
 *
 * Gatene er ALTERNATIVER (OR), ikke krav som alle må oppfylles. De to målte
 * tilfellene feiler på hver sin gate.
 */

export interface AnchorCandidate {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /**
   * Placy-eid rad (kuratert seed eller redaksjonell tekst). Vinner rangeringen
   * når to kandidater er samme sted under to navn — se `ranked` under.
   */
  curated?: boolean;
  /** Googles antall anmeldelser. Siste skille når ingen annen evidens skiller. */
  reviewCount?: number;
  /**
   * Som på medlemmet. Trengs fordi en kandidat som TAPER kan bli medlem
   * (`absorbRejectedCandidates`), og da skal Googles containment gjelde for den
   * på samme måte som for alle andre.
   */
  containedInIds?: readonly string[];
}

export interface MemberCandidate {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  categoryId: string | null;
  /**
   * POI-id-ene Google oppgir i `containingPlaces`, på Placy-form (`google-<placeId>`).
   * Autoritativ når satt; fraværende for de fleste små sentre.
   */
  containedInIds?: readonly string[];
}

export type MembershipVia = "containment" | "address" | "proximity";

export interface ResolvedAnchor {
  anchorId: string;
  name: string;
  memberIds: string[];
  /** Husnumrene ankeret eier, avledet av naboene innenfor {@link TIGHT_RADIUS_M}. */
  houseNumbers: string[];
  /** Hvilken gate hvert medlem kom inn på. Brukes til kalibrering og rapportering. */
  via: Record<string, MembershipVia>;
}

export interface AnchorResolution {
  anchors: ResolvedAnchor[];
  /** medlem-id → anker-id. Dette er det `parent_poi_id` skal settes til. */
  parentByPoiId: Map<string, string>;
  /**
   * Kandidater som IKKE ble ankre, med antall medlemmer de samlet. Dette er
   * realitets-gaten i praksis: «Tem Im thaimat» og «Parkering ikea leangen»
   * bærer Googles `shopping_mall` uten å samle noe, og faller ut her.
   */
  rejected: Array<{ anchorId: string; name: string; memberCount: number }>;
}

export interface AnchorOptions {
  /**
   * Færreste medlemmer et anker må samle for å bli et anker.
   *
   * Fire. Under det håndterer `spread-co-located.ts` allerede stablingen, og
   * gevinsten ved å skjule tre pinner bak én er mindre enn tapet av tre navn.
   * Marginen er tynn i nedre ende og skal måles, ikke antas: Vikhammer senteret
   * har nøyaktig fem medlemmer i basen.
   */
  minMembers?: number;
  /**
   * Ytre skranke — ingen blir medlem lenger unna enn dette, uansett gate.
   *
   * 250 m mot Sirkus' fjerneste medlemmer på ~150 m. Taket må holde seg godt
   * under avstanden mellom naboankre: på Lade ligger Lade Arena, Hangaren og
   * City Lade 305–520 m fra hverandre, så 250 m hindrer at det ene stjeler det
   * andres medlemmer.
   */
  maxMemberDistanceM?: number;
  /**
   * Nærhets-gaten, og samtidig radiusen husnummer-settet bygges fra.
   *
   * 60 m mot Vikhammers 5–25 m. Må være stram nok til å ikke nå over gata:
   * Sirkus' naboer på andre siden (EkoMarket, Peppes Leangen) ligger 100 m+ unna
   * og skal ikke absorberes.
   */
  tightRadiusM?: number;
  /**
   * Kategoriene et medlem kan ha. `undefined` = alle (kjøpesenteret, som er
   * blandet bruk per definisjon).
   *
   * Idrettsanlegget MÅ sette den. Nærhets-gaten står på 150 m der mot
   * kjøpesenterets 60 m, og 300 m rundt Ranheim Idrettspark inneholder REMA
   * 1000, tannklinikken og folkebiblioteket. Uten kategori-skranken sluker
   * anlegget nabolagets dagligvare.
   */
  memberCategoryIds?: ReadonlySet<string>;
  /**
   * Skal en kandidat som taper mot en annen kandidat bli MEDLEM av den, i
   * stedet for å bli stående som sin egen pinne?
   *
   * Av som standard: kjøpesenter-familien lar «Falkenborgvegen 3» stå som sin
   * egen pinne, slik den har gjort siden 2026-08-27.
   *
   * På for idrettsanlegg, fordi samme anlegg er registrert TO ganger under to
   * navn — «Ranheim Idrettspark» hos Google (og som kuratert seed) og «Ranheim
   * idrettsanlegg» i OSM, 130 m unna. Leangen har samme dublett 50 m fra
   * hverandre. Uten regelen deler de to radene medlemmene mellom seg, begge
   * passerer firetallet, og boardet viser TO anlegg der det er ett.
   *
   * Regelen slår inn to steder, og begge trengs:
   *
   *   1. FØR oppløsningen — to kandidater innenfor `tightRadiusM` av hverandre
   *      er samme sted. Den beste beholder kandidatstatusen, den andre blir
   *      medlem. Dette er det som hindrer at anlegget splittes i to ankre.
   *   2. ETTER oppløsningen — en kandidat som ikke nådde firetallet, men som
   *      ligger innenfor gatene til et anker som gjorde det, blir medlem der.
   *
   * Merk hva regelen IKKE gjør: «Lade idrettspark» (fotball og cricket) og
   * «Lade idrettsanlegg» (tennis og friidrett) ligger 460 m fra hverandre, godt
   * utenfor `tightRadiusM`, og forblir to ankre. Det er riktig — det ER to
   * anlegg som deler adresse.
   */
  absorbRivalCandidates?: boolean;
}

export const DEFAULT_MIN_MEMBERS = 4;
export const DEFAULT_MAX_MEMBER_DISTANCE_M = 250;
export const DEFAULT_TIGHT_RADIUS_M = 60;

/** Placy-kategorien kjøpesentre får (`shopping_mall` → `shopping`). */
const ANCHOR_CATEGORY = "shopping";

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Samme normalisering som `dedupe-colocated-pins.normalizeName` — bare kasus og
 * skilletegn, ingen stemming. Duplisert med vilje: `lib/board/` skal ikke
 * importere fra `lib/pipeline/`, og regelen er tre linjer.
 */
function normalizedName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng =
    (b.lng - a.lng) *
    METERS_PER_DEGREE_LAT *
    Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

// ---------------------------------------------------------------------------
// Adresse-parsing
// ---------------------------------------------------------------------------

/**
 * Adressen er Google-fritekst (`shortFormattedAddress`), ikke strukturerte
 * komponenter — vi ber aldri om `addressComponents`. Faktiske former fra prod:
 *
 *   «Falkenborgvegen 1, Trondheim»
 *   «Sirkus Shopping, Falkenborgvegen 9, Trondheim»      ← venue-navn foran
 *   «SIRKUS SHOPPING, Falkenborgvegen 1, Trondheim»      ← og i VERSALER
 *   «Nye lokaler, Falkenborgvegen 5, i 1 etg, Trondheim» ← støy på begge sider
 *   «Peder Falcks veg 3, 8, Trondheim»                   ← ekstra husnummer
 *   «Falkenborgvegen 4-6»                                ← husnummer-intervall
 *   «Haakon VIIs gt. 12, Trondheim»                      ← romertall i gatenavnet
 *   «Trondheim»                                          ← ingen gate i det hele tatt
 */
export interface ParsedAddress {
  street: string;
  houseNumbers: string[];
}

/** Segmenter som er ren støy og aldri kan være gate + nummer. */
const NOISE_SEGMENT = /^(i\s|etg|etasje|plan\s|inng)/i;

/**
 * Normaliser gatenavn. Slår sammen skrivemåter som ellers ville blitt separate
 * klynger — prod har både «Haakon VIIs gt. 9» og «Haakon VIIs gate 9» som egne
 * adresser for det samme bygget.
 */
export function normalizeStreet(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bgt\.?$/, "gate")
    .replace(/\bg\.$/, "gate")
    .replace(/\bvn\.?$/, "veg")
    .replace(/\.$/, "")
    .trim();
}

/** «4-6» → ["4","5","6"]. Intervaller over 12 avvises som feilparsing. */
function expandRange(from: string, to: string): string[] {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isInteger(a) || !Number.isInteger(b) || b < a || b - a > 12) {
    return [from];
  }
  const out: string[] = [];
  for (let n = a; n <= b; n++) out.push(String(n));
  return out;
}

/** Et segment er «gate + nummer» bare hvis HELE segmentet er det. */
const STREET_SEGMENT =
  /^([a-zæøåäöéèüA-ZÆØÅÄÖÉÈÜ][a-zæøåäöéèüA-ZÆØÅÄÖÉÈÜ.\s'´`-]{1,})\s+(\d+)\s*(?:-\s*(\d+))?\s*([a-zA-Z])?$/;

/** Bare et tall (evt. med bokstav) — et ekstra husnummer for gata foran. */
const BARE_NUMBER_SEGMENT = /^(\d+)\s*(?:-\s*(\d+))?\s*([a-zA-Z])?$/;

export function parseAddress(address: string | null | undefined): ParsedAddress | null {
  if (!address) return null;
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = 0; i < segments.length; i++) {
    if (NOISE_SEGMENT.test(segments[i])) continue;
    const m = STREET_SEGMENT.exec(segments[i]);
    if (!m) continue;

    const street = normalizeStreet(m[1]);
    // «Sirkus Shopping» ville ikke matchet (ingen tall), men korte rester kan.
    if (street.length < 3) continue;

    const suffix = m[4] ? m[4].toLowerCase() : "";
    const numbers = new Set(
      m[3] ? expandRange(m[2], m[3]) : [m[2] + suffix],
    );

    // Absorbér etterfølgende bare-tall-segmenter: «Peder Falcks veg 3, 8».
    for (let j = i + 1; j < segments.length; j++) {
      const bare = BARE_NUMBER_SEGMENT.exec(segments[j]);
      if (!bare) break;
      const s2 = bare[3] ? bare[3].toLowerCase() : "";
      for (const n of bare[2] ? expandRange(bare[1], bare[2]) : [bare[1] + s2]) {
        numbers.add(n);
      }
    }

    return { street, houseNumbers: [...numbers] };
  }
  return null;
}

/**
 * Uten husnummer er adressen ubrukelig som klynge-nøkkel. Målt: 42 POI-er i
 * poolen har adressen «Trondheim» og ingenting mer, pluss tilsvarende for Oslo,
 * Bergen og Ranheim. Uten dette kravet ville alle POI-er i en by kollapset til
 * én klynge.
 */
export function hasHouseNumber(address: string | null | undefined): boolean {
  return parseAddress(address) !== null;
}

// ---------------------------------------------------------------------------
// Oppløsning
// ---------------------------------------------------------------------------

/**
 * Løs opp hvilke POI-er som er medlemmer av hvilket anker.
 *
 * Deterministisk: kandidatene sorteres på id, og når to ankre konkurrerer om
 * samme medlem vinner det nærmeste (tie-break på id). Samme input gir samme
 * resultat uavhengig av rekkefølge.
 */
export function resolveAnchors(
  candidates: readonly AnchorCandidate[],
  pois: readonly MemberCandidate[],
  options: AnchorOptions = {},
): AnchorResolution {
  const minMembers = options.minMembers ?? DEFAULT_MIN_MEMBERS;
  const maxDistance = options.maxMemberDistanceM ?? DEFAULT_MAX_MEMBER_DISTANCE_M;
  const tightRadius = options.tightRadiusM ?? DEFAULT_TIGHT_RADIUS_M;

  const allSorted = [...candidates].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  // ---- Pass 0: to kandidater på samme sted er ÉN kandidat -----------------
  //
  // Rangeringen her er med vilje selvstendig — den kan ikke bruke medlemstall,
  // for det er nettopp medlemstallet som blir feil når anlegget er registrert
  // to ganger. `curated` først (Placy-eid rad er raden brukeren skal se), så
  // antall Google-anmeldelser (anlegget publikum omtaler ER anlegget), så id
  // for determinisme.
  //
  // Målt: «Leangen Idrettsanlegg» (341 anmeldelser) slår OSM-noden «Leangen
  // idrettspark» (null) 50 m unna, og «Ranheim Idrettspark» (kuratert seed)
  // slår OSM-veien «Ranheim idrettsanlegg» 130 m unna.
  const demotedCandidates: AnchorCandidate[] = [];
  let sortedCandidates = allSorted;
  if (options.absorbRivalCandidates) {
    const byStrength = [...allSorted].sort(
      (a, b) =>
        Number(b.curated ?? false) - Number(a.curated ?? false) ||
        (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
        (a.id < b.id ? -1 : 1),
    );
    const kept: AnchorCandidate[] = [];
    for (const candidate of byStrength) {
      if (kept.some((k) => distanceMeters(k, candidate) <= tightRadius)) {
        demotedCandidates.push(candidate);
      } else {
        kept.push(candidate);
      }
    }
    const keptIds = new Set(kept.map((k) => k.id));
    sortedCandidates = allSorted.filter((c) => keptIds.has(c.id));
  }

  const candidateIds = new Set(sortedCandidates.map((c) => c.id));

  // Et anker kan aldri være medlem av et annet anker: da ville City Lade blitt
  // slukt av Lade Arena og senterets eget navn forsvunnet fra kartet.
  //
  // Kategori-skranken er FAMILIENS, ikke global. Kjøpesenteret utelukker hele
  // `shopping` (der er kandidatlista og kategorien det samme settet).
  // Idrettsanlegget kan derimot ikke det: medlemmene DELER kategori med
  // ankeret — «Ranheim Idrettspark» er `idrett`, og det er hver eneste bane og
  // hall inne i den også. Der er `memberCategoryIds` skranken i stedet, og den
  // er det som holder dagligvaren og tannlegen utenfor 300 m-radiusen.
  const memberCategoryIds = options.memberCategoryIds;
  const members: MemberCandidate[] = pois.filter(
    (p) =>
      !candidateIds.has(p.id) &&
      (memberCategoryIds
        ? p.categoryId !== null && memberCategoryIds.has(p.categoryId)
        : p.categoryId !== ANCHOR_CATEGORY),
  );

  // De degraderte fra pass 0 er medlemmer på lik linje med alle andre. De
  // slipper kategori-skranken fordi de per definisjon bærer familiens egen
  // kategori — det var derfor de var kandidater.
  for (const demoted of demotedCandidates) {
    members.push({
      id: demoted.id,
      name: demoted.name,
      address: demoted.address,
      lat: demoted.lat,
      lng: demoted.lng,
      categoryId: null,
      containedInIds: demoted.containedInIds,
    });
  }

  // Husnummer-settet bygges fra naboene innenfor tightRadius. Det er slik
  // Sirkus' 1/5/9 fanges uten å dra inn 35/38 (som ligger opptil 419 m unna).
  const houseNumbersByAnchor = new Map<string, Set<string>>();
  const streetByAnchor = new Map<string, string>();
  for (const anchor of sortedCandidates) {
    const numbers = new Set<string>();
    const own = parseAddress(anchor.address);
    let street = own?.street ?? null;
    for (const p of members) {
      if (distanceMeters(anchor, p) > tightRadius) continue;
      const parsed = parseAddress(p.address);
      if (!parsed) continue;
      // Ankerets gate avledes av naboene når ankerets egen adresse peker et
      // annet sted — Google gir Vikhammer senteret «Utsikten 13» mens medlemmene
      // står på «Stasjonsvegen 1».
      if (street === null) street = parsed.street;
      if (parsed.street === street) for (const n of parsed.houseNumbers) numbers.add(n);
    }
    if (own && own.street === street) for (const n of own.houseNumbers) numbers.add(n);
    if (street !== null) streetByAnchor.set(anchor.id, street);
    houseNumbersByAnchor.set(anchor.id, numbers);
  }

  // ---- Pass 1: hvilke medlemmer KAN hvert anker gjøre krav på? -------------
  const VIA_RANK: Record<MembershipVia, number> = {
    containment: 0,
    address: 1,
    proximity: 2,
  };

  interface Claim {
    poiId: string;
    via: MembershipVia;
    distance: number;
  }
  const claimsByAnchor = new Map<string, Claim[]>();

  for (const anchor of sortedCandidates) {
    const claims: Claim[] = [];
    const anchorStreet = streetByAnchor.get(anchor.id);
    const anchorNumbers = houseNumbersByAnchor.get(anchor.id);
    for (const poi of members) {
      const distance = distanceMeters(anchor, poi);
      if (distance > maxDistance) continue;
      const parsed = parseAddress(poi.address);

      let via: MembershipVia | null = null;
      if (poi.containedInIds?.includes(anchor.id)) {
        via = "containment";
      } else if (
        parsed &&
        anchorStreet === parsed.street &&
        parsed.houseNumbers.some((n) => anchorNumbers?.has(n))
      ) {
        via = "address";
      } else if (distance <= tightRadius) {
        via = "proximity";
      }
      if (via !== null) claims.push({ poiId: poi.id, via, distance });
    }
    claimsByAnchor.set(anchor.id, claims);
  }

  // ---- Pass 2: hvem vinner når to ankre gjør krav på samme medlem? ---------
  //
  // To ankre kan dele gate og husnummer-sett. Prod-eksempelet: Google gir BÅDE
  // «Sirkus Shopping» og «Falkenborgvegen 3» typen `shopping_mall`, de ligger
  // 62 m fra hverandre, og begge ser hele Falkenborgvegen-klyngen. Nærmeste-
  // vinner splittet da Sirkus' 59 medlemmer omtrent i to.
  //
  // Diskriminatoren er ankerets EGEN adresse: senterets registrerte husnummer
  // er det leietakerne faktisk bruker. Sirkus står på «Falkenborgvegen 1», og 26
  // av kandidatene bærer nummer 1. «Falkenborgvegen 3» står på nummer 3, som
  // bare én kandidat bærer. Sirkus vinner dermed hele klyngen, og
  // «Falkenborgvegen 3» faller på realitets-gaten under.
  //
  // Containment trumfer alt: et anker som Google eksplisitt peker på, vinner
  // uansett hvor lite adresse-støtte det har.
  const ownSupport = new Map<string, { containment: number; own: number; total: number }>();
  for (const anchor of sortedCandidates) {
    const own = parseAddress(anchor.address);
    const claims = claimsByAnchor.get(anchor.id) ?? [];
    let containment = 0;
    let ownNumber = 0;
    for (const c of claims) {
      if (c.via === "containment") containment++;
      const parsed = parseAddress(members.find((m) => m.id === c.poiId)!.address);
      if (own && parsed && parsed.street === own.street) {
        if (parsed.houseNumbers.some((n) => own.houseNumbers.includes(n))) ownNumber++;
      }
    }
    ownSupport.set(anchor.id, { containment, own: ownNumber, total: claims.length });
  }

  //
  // To signaler til, og de fyrer bare når evidensen over er lik. De ble lagt
  // til for idrettsanlegget (2026-08-28), der ingen kandidat har containment og
  // OSM-radene ikke har adresse i det hele tatt: «Ranheim Idrettspark» og
  // «Ranheim idrettsanlegg» er 130 m fra hverandre, ser begge hele klyngen, og
  // ville ellers blitt skilt av id-en — altså tilfeldig.
  //
  //   `curated`    Placy-eid rad slår importert rad. Samme prioritet som
  //                `contentRank` i dedupliseringen: skriver vi teksten selv,
  //                er det raden brukeren skal se.
  //   `reviewCount` Anlegget publikum faktisk omtaler ER anlegget. Målt:
  //                «Leangen Idrettsanlegg» har 341 anmeldelser, OSM-noden
  //                «Leangen idrettspark» har null.
  const ranked = [...sortedCandidates].sort((a, b) => {
    const sa = ownSupport.get(a.id)!;
    const sb = ownSupport.get(b.id)!;
    return (
      sb.containment - sa.containment ||
      sb.own - sa.own ||
      Number(b.curated ?? false) - Number(a.curated ?? false) ||
      (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
      sb.total - sa.total ||
      (a.id < b.id ? -1 : 1)
    );
  });

  const best = new Map<string, { anchorId: string; via: MembershipVia; distance: number }>();
  for (const anchor of ranked) {
    for (const claim of claimsByAnchor.get(anchor.id) ?? []) {
      const current = best.get(claim.poiId);
      // Greedy i rangert rekkefølge — men containment kan alltid overta et
      // medlem et svakere anker allerede har tatt på adresse eller nærhet.
      if (!current || VIA_RANK[claim.via] < VIA_RANK[current.via]) {
        best.set(claim.poiId, {
          anchorId: anchor.id,
          via: claim.via,
          distance: claim.distance,
        });
      }
    }
  }

  // Realitets-gaten: et anker som ikke samler nok medlemmer er ikke et anker.
  const grouped = new Map<string, Array<{ poiId: string; via: MembershipVia }>>();
  for (const [poiId, hit] of best) {
    const arr = grouped.get(hit.anchorId);
    if (arr) arr.push({ poiId, via: hit.via });
    else grouped.set(hit.anchorId, [{ poiId, via: hit.via }]);
  }

  const anchors: ResolvedAnchor[] = [];
  const rejected: AnchorResolution["rejected"] = [];
  const parentByPoiId = new Map<string, string>();

  // En degradert rival er SAMME STED som ankeret. Den kan derfor ikke være
  // bevis for at fire ANDRE steder ligger der, og teller ikke i realitets-gaten
  // — den blir bare absorbert. Uten dette skillet ville «Jakobsli
  // idrettsplass» blitt et anker på tre kopier av seg selv pluss én
  // sandvolleyballbane.
  const demotedIds = new Set(demotedCandidates.map((c) => c.id));
  const nameById = new Map(pois.map((p) => [p.id, normalizedName(p.name)]));

  /**
   * Firetallet teller STEDER, ikke rader. To grunner, begge målt i poolen:
   *
   *   - Samme OSM-objekt ligger inne under opptil tre id-former («way/84078489»,
   *     «osm-way84078489», «osm-w84078489»). 60 av 816 OSM-rader er slike
   *     overtallige kopier. De skjules på boardet av `dedupe-colocated-pins`,
   *     men her ville de talt som tre bevis for at anlegget finnes.
   *   - «Øya stadion» samler fire rader som er tre steder — Trondheim Spektrum,
   *     Nidarø tennisanlegg og Øya tennishall (to ganger). Talt som rader blir
   *     den et anker på et falskt firetall.
   *
   * Én normalisert navnekollisjon innenfor ett anlegg (høyst ~500 m på tvers)
   * er samme sted. «Lade 1» og «Lade 2» kolliderer ikke.
   */
  const countPlaces = (hits: Array<{ poiId: string }>): number =>
    new Set(
      hits
        .filter((h) => !demotedIds.has(h.poiId))
        .map((h) => nameById.get(h.poiId) ?? h.poiId),
    ).size;

  for (const candidate of sortedCandidates) {
    const hits = grouped.get(candidate.id) ?? [];
    const placeCount = countPlaces(hits);
    if (placeCount < minMembers) {
      rejected.push({
        anchorId: candidate.id,
        name: candidate.name,
        memberCount: placeCount,
      });
      continue;
    }
    const memberIds = hits.map((h) => h.poiId).sort();
    const via: Record<string, MembershipVia> = {};
    for (const h of hits) {
      via[h.poiId] = h.via;
      parentByPoiId.set(h.poiId, candidate.id);
    }
    anchors.push({
      anchorId: candidate.id,
      name: candidate.name,
      memberIds,
      houseNumbers: [...(houseNumbersByAnchor.get(candidate.id) ?? [])].sort(),
      via,
    });
  }

  // ---- Pass 4: kandidatene som tapte blir medlemmer ----------------------
  //
  // Bare når familien ber om det. Målt tilfelle: Ranheim er registrert som
  // BÅDE «Ranheim Idrettspark» (Google + kuratert seed, Ranheimsvegen 166) og
  // «Ranheim idrettsanlegg» (OSM, 130 m øst). Begge bærer anleggs-ordet, begge
  // ser hele klyngen, og pass 2 gir alle medlemmene til vinneren. Uten dette
  // passet blir taperen stående igjen som en ensom tvillingpinne inntil
  // ankeret — og boardet viser fortsatt to anlegg der det er ett.
  //
  // Gatene er de samme som for et hvilket som helst medlem. En taper som
  // ligger for langt unna, eller som ikke deler adresse eller nærhet med noe
  // anker, beholder pinnen sin. Det er tilsiktet: «Lade idrettsanlegg» (tennis
  // og friidrett) taper mot «Lade idrettspark» (fotball og cricket) 460 m unna,
  // og skal IKKE absorberes — det er to anlegg, ikke ett.
  if (options.absorbRivalCandidates && anchors.length > 0) {
    const anchorByCandidateId = new Map(anchors.map((a) => [a.anchorId, a]));
    const acceptedCandidates = sortedCandidates.filter((c) =>
      anchorByCandidateId.has(c.id),
    );

    for (const loser of sortedCandidates) {
      if (anchorByCandidateId.has(loser.id)) continue;

      let claimed: { anchorId: string; via: MembershipVia; distance: number } | null = null;
      for (const anchor of acceptedCandidates) {
        const distance = distanceMeters(anchor, loser);
        if (distance > maxDistance) continue;
        const parsed = parseAddress(loser.address);
        const anchorStreet = streetByAnchor.get(anchor.id);
        const anchorNumbers = houseNumbersByAnchor.get(anchor.id);

        let via: MembershipVia | null = null;
        if (loser.containedInIds?.includes(anchor.id)) {
          via = "containment";
        } else if (
          parsed &&
          anchorStreet === parsed.street &&
          parsed.houseNumbers.some((n) => anchorNumbers?.has(n))
        ) {
          via = "address";
        } else if (distance <= tightRadius) {
          via = "proximity";
        }
        if (via === null) continue;

        // Beste gate først, så nærmeste, så id — samme determinisme som pass 2.
        if (
          !claimed ||
          VIA_RANK[via] < VIA_RANK[claimed.via] ||
          (VIA_RANK[via] === VIA_RANK[claimed.via] &&
            (distance < claimed.distance ||
              (distance === claimed.distance && anchor.id < claimed.anchorId)))
        ) {
          claimed = { anchorId: anchor.id, via, distance };
        }
      }

      if (!claimed) continue;
      const anchor = anchorByCandidateId.get(claimed.anchorId)!;
      anchor.memberIds = [...anchor.memberIds, loser.id].sort();
      anchor.via[loser.id] = claimed.via;
      parentByPoiId.set(loser.id, claimed.anchorId);
    }
  }

  return { anchors, parentByPoiId, rejected };
}
