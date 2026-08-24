/**
 * OSM-porten: avgjør hvilke OpenStreetMap-objekter som får bli publiserbare
 * POI-er i `v2.pois`, og hvilke som ikke får det.
 *
 * Bakgrunn (2026-08-24): OSM er tett av mikro-objekter Google mangler —
 * lekeplasser, benker, bordbenker, badeplasser, grillplasser. Målt innenfor
 * 1 km av Strindfjordvegen 10 på Ranheim: 298 objekter, 258 av dem NAVNLØSE.
 * Men den samme tettheten inneholder objekter det er direkte misvisende å
 * vise: 47 av 69 parkeringsplasser har ingen `access`-tag i det hele tatt, så
 * borettslagets private plasser er ikke skillbare fra offentlige. Og der OSM
 * *har* navn slipper feilen gjennom navnekravet: av de ni `lekeplass`-radene
 * som lå i basen før denne porten var fem feil — to barnehager, et stellerom,
 * et betalt innendørs lekeland, og ett objekt av ukjent art.
 *
 * REGELEN PORTEN HÅNDHEVER er en konsekvens-vurdering, ikke en
 * datakvalitets-vurdering. Spørsmålet er ikke «hvor sikker er dataen?» men
 * «hva koster det om vi tar feil?»:
 *
 *   - Navngitt idrettshall: tar vi feil står det et litt galt navn på et bygg
 *     som utvilsomt er der. Kostnad ≈ 0.
 *   - Lekeplass: tar vi feil har vi fortalt en boligkjøper at barna har en
 *     lekeplass som tilhører et annet borettslags gårdsrom. Kostnad = tillit
 *     hos meglerens kunde, som er hele produktet.
 *
 * Nedsiden er asymmetrisk. Derfor faller tvilstilfeller UT, ikke inn. En benk
 * vi går glipp av koster ingenting.
 *
 * Alt som ikke passerer porten er ikke tapt — det hører i strøkets dossier
 * (`data/areas/<slug>.dossier.md`) som kurator-input, aldri som pin. Se
 * `docs/plans/2026-08-24-001-feat-osm-kandidatkilde-curate-area-plan.md`.
 */

/** Minimal form av et Overpass-element slik `out tags center;` leverer det. */
export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Maskinlesbare avvisningsgrunner. Brukes til avvisnings-regnskapet — ingen
 * stille trunkering: falt 69 parkeringer ut, skal det stå at 69 parkeringer
 * falt ut, gruppert per grunn.
 */
export type OsmGateReason =
  | "ikke-i-hviteliste"
  | "pitch-uten-godkjent-sport"
  | "mangler-koordinat"
  | "mangler-navn"
  | "adgang-ekskluderer-publikum";

export type OsmGateVerdict =
  | { accept: true; categoryId: string; name: string; lat: number; lng: number; rule: string }
  | { accept: false; reason: OsmGateReason; detail: string };

/**
 * `access`-verdier som betyr at publikum IKKE har adgang. Fravær av `access`
 * regnes som godkjent — men bare fordi hvitelisten under er valgt for
 * kategorier der offentlig adgang er strukturelt gitt. Det er nettopp derfor
 * `leisure=playground` ikke kan stå i hvitelisten: der er fravær av `access`
 * det normale (12 av 18 på Ranheim), og default-antakelsen «offentlig» er feil.
 */
const ACCESS_EXCLUDING_PUBLIC = new Set([
  "private",
  "customers",
  "permit",
  "no",
  "residents",
]);

/**
 * `sport`-verdier som gjør en `leisure=pitch` til et anlegg verdt å vise.
 * Samme liste som den opprinnelige hardkodede Overpass-spørringen brukte —
 * bevart for å ikke regressere det som virker. OSM tillater flere verdier
 * skilt med semikolon (`soccer;ice_skating`, `athletics;multi`), så vi tester
 * medlemskap per verdi, ikke på hele strengen.
 */
const ACCEPTED_PITCH_SPORTS = new Set([
  "soccer",
  "football",
  "handball",
  "tennis",
  "basketball",
]);

interface OsmGateRule {
  /** OSM-nøkkelen regelen matcher på. */
  key: string;
  /** Verdien nøkkelen må ha. */
  value: string;
  /** Placy-kategorien objektet blir. Utledes ALDRI av navnet — se Port 4. */
  categoryId: string;
  /** Hvorfor det er forsvarlig å vise dette som pin (Port 1-begrunnelsen). */
  why: string;
}

/**
 * HVITELISTEN (Port 1). Frossen tabell — `osm-gate.test.ts` feiler hvis noen
 * legger til en rad uten `why`, eller peker på en kategori som ikke rendres i
 * noe rapport-tema. Rekkefølgen er prioritet: første treff vinner når et
 * objekt har flere hvitelistede tagger (f.eks. `leisure=park` + `natural=wood`).
 *
 * Hver `categoryId` her MÅ finnes i et aktivt tema i `REPORT_THEME_DEFAULTS`
 * (`lib/pipeline/report-defaults.ts`). Ellers havner raden i poolen uten å
 * rendre noe sted — samme recall-bug som `marina`/`hundepark` hadde før
 * 2026-08-12. Det er grunnen til at `amenity=library`, `amenity=theatre` og
 * `amenity=cinema` IKKE står her: deres tema («opplevelser») er globalt
 * deaktivert i `GLOBAL_DISABLED_REPORT_THEMES` siden 2026-04-28, så de ville
 * blitt importert til ingenting.
 */
export const OSM_GATE_RULES: readonly OsmGateRule[] = Object.freeze([
  {
    key: "leisure",
    value: "sports_centre",
    categoryId: "idrett",
    why: "Offentlig tilgjengelig idrettsanlegg med navn — feil navn er hele nedsiden.",
  },
  {
    key: "leisure",
    value: "sports_hall",
    categoryId: "idrett",
    why: "Som sports_centre; egen tag for innendørshaller.",
  },
  {
    key: "leisure",
    value: "track",
    categoryId: "idrett",
    why: "Løpebane/friidrettsbane — offentlig anlegg, ikke privatiserbart.",
  },
  {
    key: "leisure",
    value: "pitch",
    categoryId: "idrett",
    why: "Bane for lagidrett. Krever godkjent `sport` — se ACCEPTED_PITCH_SPORTS.",
  },
  {
    key: "leisure",
    value: "swimming_pool",
    categoryId: "swimming",
    why: "Svømmehall/basseng med navn. Betaling er normalt og ikke diskvalifiserende.",
  },
  {
    key: "leisure",
    value: "marina",
    categoryId: "marina",
    why: "Navngitt småbåthavn — fysisk anlegg med kjent utstrekning.",
  },
  {
    key: "leisure",
    value: "park",
    categoryId: "park",
    why: "Kommunalt friområde. Navnekravet skiller den fra navnløse restflater.",
  },
  {
    key: "natural",
    value: "beach",
    categoryId: "badeplass",
    why: "Allemannsretten gjelder i strandsonen — adgang kan ikke privatiseres bort.",
  },
  {
    key: "tourism",
    value: "viewpoint",
    categoryId: "outdoor",
    why: "Offentlig utsiktspunkt; navngitt betyr at noen har regnet det som et sted.",
  },
]);

/**
 * PERMANENT UTESTENGT, med grunn. Denne tabellen har ingen funksjon i
 * kjørende kode — den finnes for at avgjørelsene skal være testbare og
 * gjenfinnbare i stedet for bare kommentert. `osm-gate.test.ts` kjører hver
 * nøkkel gjennom porten og krever avvisning.
 */
export const PERMANENTLY_EXCLUDED: Readonly<Record<string, string>> = Object.freeze({
  "amenity=parking":
    "47 av 69 på Ranheim har ingen access-tag — privat og offentlig er ikke skillbart. Og parkering er ikke en grunn til å kjøpe bolig.",
  "amenity=parking_entrance":
    "Innkjørsel til parkering — arver hele problemet fra amenity=parking, og er dessuten et punkt på en vei, ikke et sted.",
  "amenity=parking_space":
    "Én rad per oppmerket bilplass. Samme adgangs-uklarhet som amenity=parking, ganget med antall ruter i asfalten.",
  "amenity=bicycle_parking":
    "52 stykk i Ranheim-sveipet, alle navnløse, adgang like uklar som bilparkering. Hører som aggregat i dossieret, ikke som pin.",
  "leisure=playground":
    "12 av 18 på Ranheim utagget, 0 navngitte i sveipet. De navngitte som lå i basen var to barnehager, et stellerom og et betalt lekeland. Kommer fra SSBs «Parker og turområder» i stedet.",
  "amenity=bench":
    "25 i Ranheim-sveipet, ingen med navn og ingen med adgangstagg. En benk er reell nabolagskvalitet, men som setning i teksten — ikke som pin med kort.",
  "leisure=picnic_table":
    "Navnløs av natur, som amenity=bench. Ti av dem i Ranheim-sveipet, ingen med navn — hører som aggregat i dossieret.",
  "amenity=bbq":
    "Grillplass. Navnløs av natur, som amenity=bench — reell verdi for en beboer, men som setning i teksten, ikke som pin.",
  "amenity=shelter":
    "Gapahuk eller busskur — to helt ulike ting under samme tag, og begge navnløse. Uegnet som pin.",
  "amenity=lounger":
    "Solseng/liggestol. Navnløs av natur, som amenity=bench.",
  "amenity=toilets":
    "Offentlig toalett. Navnløst av natur, og adgang/åpningstid er ukjent — som amenity=bench.",
  "amenity=waste_basket":
    "Søppelkasse. Ingen beslutningsverdi for en boligkjøper, som amenity=bench.",
  "amenity=drinking_water":
    "Drikkefontene. Navnløs av natur, som amenity=bench.",
  "natural=tree": "Mikro-geometri uten beslutningsverdi for en boligkjøper.",
  "natural=rock":
    "Enkeltstående stein eller skjær. Mikro-geometri, som natural=tree.",
  "natural=scrub":
    "Kratt-flate. Mikro-geometri uten navn, som natural=tree.",
  "amenity=restaurant":
    "Google er autoritativ: åpningstider, telefon, bilder, omtaler. OSM tilfører bare foreldelses-risiko.",
  "amenity=cafe":
    "Google har åpningstider, telefon og bilder — som amenity=restaurant. 64 OSM-kafeer lå i basen og er den høyeste foreldelses-risikoen vi har.",
  "amenity=fast_food":
    "Google er autoritativ, som for amenity=restaurant.",
  "amenity=bar":
    "Google er autoritativ, som for amenity=restaurant.",
  "amenity=pharmacy":
    "Apotek — åpningstid er hele poenget, og den har Google. Som amenity=restaurant.",
  "amenity=dentist":
    "Google er autoritativ på helsetjenester med timebestilling. Som amenity=restaurant.",
  "amenity=doctor":
    "Google er autoritativ på helsetjenester med timebestilling. Som amenity=restaurant.",
  "amenity=fuel":
    "Bensinstasjon — kjede og åpningstid kommer fra Google. Som amenity=restaurant.",
  "amenity=post_office":
    "Post i butikk endrer seg ofte og følger butikken. Google er autoritativ, som for amenity=restaurant.",
  "shop=supermarket":
    "Dagligvare — åpningstid er det beboeren faktisk vil vite, og den har Google. Som amenity=restaurant.",
  "shop=hairdresser":
    "68 OSM-frisører lå i basen. Google er autoritativ, som for amenity=restaurant.",
  "amenity=library":
    "Temaet «opplevelser» er globalt deaktivert siden 2026-04-28 — raden ville rendret ingen steder.",
  "amenity=theatre":
    "Temaet «opplevelser» er globalt deaktivert, som for amenity=library — raden ville rendret ingen steder.",
  "amenity=cinema":
    "Temaet «opplevelser» er globalt deaktivert, som for amenity=library — raden ville rendret ingen steder.",
  "amenity=community_centre":
    "`fritidsklubb` ligger i temaet «Barn & Oppvekst», men OSM-taggen betyr bare «forsamlingslokale». Det ene treffet i Ranheim-sveipet er «Rotvoll kunstnerkollektiv SA» — et kunstnerkollektiv vist under Barn & Oppvekst er nøyaktig den feilkategoriseringen porten finnes for å hindre.",
  "place=square":
    "Uklar kategori-tilhørighet. «Archidiakoni plass» og «Blussuvoll plass» lå i basen som park og er ikke parker i noen brukbar forstand.",
});

/** Kategoriene porten kan produsere, med definisjonene de har i `v2.categories`. */
export const OSM_GATE_CATEGORIES = Object.freeze([
  { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
  { id: "swimming", name: "Svømmehall", icon: "Waves", color: "#ec4899" },
  { id: "marina", name: "Småbåthavn", icon: "Anchor", color: "#0ea5e9" },
  { id: "park", name: "Park", icon: "TreePine", color: "#10b981" },
  { id: "badeplass", name: "Badeplass", icon: "Waves", color: "#0ea5e9" },
  { id: "outdoor", name: "Utendørs aktivitet", icon: "TreePine", color: "#10b981" },
]);

function resolveCoordinates(
  el: OverpassElement
): { lat: number; lng: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // 0,0 er Null Island, ikke en koordinat noen POI har.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function hasAcceptedPitchSport(tags: Record<string, string>): boolean {
  const sport = tags.sport;
  if (!sport) return false;
  return sport
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .some((s) => ACCEPTED_PITCH_SPORTS.has(s));
}

/**
 * De fire portene, i den rekkefølgen som gir det mest brukbare
 * avvisnings-regnskapet: hvitelisten først, slik at en navnløs parkering
 * rapporteres som «ikke-i-hviteliste» (som er den reelle grunnen) og ikke som
 * «mangler-navn» (som ville skjult at parkering er utestengt uansett navn).
 */
export function evaluateOsmElement(el: OverpassElement): OsmGateVerdict {
  const tags = el.tags ?? {};

  // Port 1 — hvitelisten. Første treff vinner (rekkefølgen er prioritet).
  const rule = OSM_GATE_RULES.find((r) => tags[r.key] === r.value);
  if (!rule) {
    return { accept: false, reason: "ikke-i-hviteliste", detail: describeTags(tags) };
  }
  const ruleId = `${rule.key}=${rule.value}`;

  // Regel-spesifikt krav (bare `pitch` har et i dag).
  if (ruleId === "leisure=pitch" && !hasAcceptedPitchSport(tags)) {
    return {
      accept: false,
      reason: "pitch-uten-godkjent-sport",
      detail: tags.sport ? `sport=${tags.sport}` : "sport mangler",
    };
  }

  // Port 2a — koordinat. Et objekt uten punkt kan ikke plasseres på et kart.
  const coords = resolveCoordinates(el);
  if (!coords) {
    return { accept: false, reason: "mangler-koordinat", detail: ruleId };
  }

  // Port 2b — navn påkrevd. Ingen navnløs OSM-rad blir POI, noensinne.
  const name = tags.name?.trim();
  if (!name) {
    return { accept: false, reason: "mangler-navn", detail: ruleId };
  }

  // Port 3 — adgang må ikke ekskludere publikum.
  const access = tags.access?.trim().toLowerCase();
  if (access && ACCESS_EXCLUDING_PUBLIC.has(access)) {
    return {
      accept: false,
      reason: "adgang-ekskluderer-publikum",
      detail: `access=${access}`,
    };
  }

  // Port 4 — kategorien kommer fra taggen, aldri fra navnet.
  return {
    accept: true,
    categoryId: rule.categoryId,
    name,
    lat: coords.lat,
    lng: coords.lng,
    rule: ruleId,
  };
}

/**
 * Kort beskrivelse av hva et avvist objekt var, til avvisnings-regnskapet.
 * Plukker den første av de primære OSM-nøklene som finnes, slik at 171
 * parkeringsplasser grupperer seg som «amenity=parking» i rapporten.
 */
const PRIMARY_KEYS = [
  "leisure",
  "amenity",
  "natural",
  "tourism",
  "shop",
  "healthcare",
  "craft",
  "office",
  "historic",
  "man_made",
  "place",
  "public_transport",
] as const;

function describeTags(tags: Record<string, string>): string {
  for (const key of PRIMARY_KEYS) {
    if (tags[key]) return `${key}=${tags[key]}`;
  }
  return "ukjent tag";
}

/**
 * Overpass-spørringen bygges FRA hvitelisten, slik at spørring og port ikke
 * kan drifte fra hverandre. `leisure=pitch` hentes uten sport-filter og
 * filtreres i porten i stedet — det koster noen ekstra elementer over nettet,
 * men gir avvisnings-regnskapet tallet «hvor mange baner manglet brukbar
 * sport», som ellers ville vært usynlig.
 */
export function buildOverpassQuery(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const lines = OSM_GATE_RULES.map(
    (r) => `  nwr["${r.key}"="${r.value}"](${box});`
  );
  return `[out:json][timeout:60];(\n${lines.join("\n")}\n);out tags center;`;
}

/**
 * ID-ene et OSM-objekt får i `v2.pois`. Felles helper fordi de to skrivestiene
 * (`lib/pipeline/import-public-pois.ts` og `scripts/seed-osm-pois.ts`) driftet
 * fra hverandre og lagde en latent duplikat-bombe:
 *
 *   - seed-scriptet skrev `id = "osm-node-123"` og `osm_id = "node/123"`
 *   - pipelinen skrev  `id = "osm-node123"`   og `osm_id = "osm-node123"`
 *
 * Alle 662 `osm-*`-radene i basen har seed-formen, fordi pipelinens
 * Overpass-kilde aldri leverte en rad (Overpass svarte 406 på Node-fetch sin
 * default User-Agent). Idet den kilden begynner å virke, ville pipelinen ha
 * slått opp `osm_id = "osm-node123"`, ikke funnet den eksisterende raden med
 * `osm_id = "node/123"`, og satt inn en ny rad ved siden av den. Derfor følger
 * begge skrivestier nå seed-formen — den basen faktisk inneholder.
 */
export function osmPoiId(el: Pick<OverpassElement, "type" | "id">): string {
  return `osm-${el.type}-${el.id}`;
}

export function osmSourceId(el: Pick<OverpassElement, "type" | "id">): string {
  return `${el.type}/${el.id}`;
}

/** Avvisnings-regnskap: antall per grunn, og per grunn antall per detalj. */
export interface OsmRejectionLedger {
  total: number;
  accepted: number;
  rejected: number;
  byReason: Record<string, number>;
  byDetail: Record<string, number>;
}

export function emptyLedger(): OsmRejectionLedger {
  return { total: 0, accepted: 0, rejected: 0, byReason: {}, byDetail: {} };
}

export function recordVerdict(
  ledger: OsmRejectionLedger,
  verdict: OsmGateVerdict
): void {
  ledger.total += 1;
  if (verdict.accept) {
    ledger.accepted += 1;
    return;
  }
  ledger.rejected += 1;
  ledger.byReason[verdict.reason] = (ledger.byReason[verdict.reason] ?? 0) + 1;
  const detailKey = `${verdict.reason}:${verdict.detail}`;
  ledger.byDetail[detailKey] = (ledger.byDetail[detailKey] ?? 0) + 1;
}

/** Én linje egnet for `warnings` — ingen stille trunkering. */
export function summarizeLedger(ledger: OsmRejectionLedger): string {
  const reasons = Object.entries(ledger.byReason)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${reason} ${n}`)
    .join(", ");
  return `Overpass-porten: ${ledger.accepted} av ${ledger.total} godkjent, ${ledger.rejected} avvist${
    reasons ? ` (${reasons})` : ""
  }`;
}
