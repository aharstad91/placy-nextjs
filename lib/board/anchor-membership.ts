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
}

export const DEFAULT_MIN_MEMBERS = 4;
export const DEFAULT_MAX_MEMBER_DISTANCE_M = 250;
export const DEFAULT_TIGHT_RADIUS_M = 60;

/** Placy-kategorien kjøpesentre får (`shopping_mall` → `shopping`). */
const ANCHOR_CATEGORY = "shopping";

const METERS_PER_DEGREE_LAT = 111_320;

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

  const sortedCandidates = [...candidates].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const candidateIds = new Set(sortedCandidates.map((c) => c.id));

  // Et anker kan aldri være medlem av et annet anker: da ville City Lade blitt
  // slukt av Lade Arena og senterets eget navn forsvunnet fra kartet.
  const members = pois.filter(
    (p) => !candidateIds.has(p.id) && p.categoryId !== ANCHOR_CATEGORY,
  );

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

  const ranked = [...sortedCandidates].sort((a, b) => {
    const sa = ownSupport.get(a.id)!;
    const sb = ownSupport.get(b.id)!;
    return (
      sb.containment - sa.containment ||
      sb.own - sa.own ||
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

  for (const candidate of sortedCandidates) {
    const hits = grouped.get(candidate.id) ?? [];
    if (hits.length < minMembers) {
      rejected.push({
        anchorId: candidate.id,
        name: candidate.name,
        memberCount: hits.length,
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

  return { anchors, parentByPoiId, rejected };
}
