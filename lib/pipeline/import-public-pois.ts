/**
 * Offentlige POI-kildar for basic-tier rapport-pipeline:
 * NSR (skoler), Barnehagefakta (barnehager), Overpass (idrett, svømming,
 * park, badeplass, marina, utsiktspunkt — hvitelisten i osm-gate.ts),
 * Trondheim parkering (taxiholdeplasser, statisk datasett).
 *
 * Deterministisk og seriell. Fail-soft per kilde — logg + fortsett (aldri abort).
 * Dedup via nsr_id/barnehagefakta_id/osm_id (DB-partial unique indexes).
 *
 * Skriver mot v2-skjemaet (`.schema('v2')`, PRD 3 / r03.4) — DISTINKT fra
 * Google-discovery (import-pois.ts), aldri merget (manifest-patch konflikt #3).
 * Nærings-profil hopper over denne kilden i sin helhet på kaller-nivå
 * (provision-rapport.ts) — skoler/barnehager/idrett er ikke relevant for kontorbygg.
 */

import { createServerClient } from "@/lib/supabase/client";
import { upsertCategories } from "@/lib/supabase/mutations";
import { slugify } from "@/lib/utils/slugify";
import { getSchoolZone } from "@/lib/utils/school-zones";
import {
  OSM_GATE_CATEGORIES,
  buildOverpassQuery,
  emptyLedger,
  evaluateOsmElement,
  osmPoiId,
  osmSourceId,
  recordVerdict,
  summarizeLedger,
  type OverpassElement,
} from "@/lib/pipeline/osm-gate";
import {
  TAXI_CATEGORY,
  taxiStandId,
  taxiStandsWithin,
  TAXI_STANDS_FETCHED_AT,
} from "@/lib/pipeline/taxi-stands";
import {
  planSchoolDeduplication,
  planStaleSchoolUnlink,
  resolveSchoolTypeFromNsr,
  selectSchools,
  type SchoolType,
} from "@/lib/pipeline/zoned-school-selection";

/**
 * Kategori-definisjonene denne modulen skriver POI-er med. MÅ seedes før
 * POI-insert — v2 har ingen FK som fanger manglende definisjon, og en
 * udefinert kategori resolver til «Ukjent» på boardet (temaet forsvinner).
 */
export const PUBLIC_POI_CATEGORIES = [
  { id: "skole", name: "Skole", icon: "GraduationCap", color: "#f59e0b" },
  { id: "barnehage", name: "Barnehage", icon: "Baby", color: "#f59e0b" },
  // Overpass-kildens kategorier arves fra hvitelisten i osm-gate, slik at en
  // ny regel der ikke kan glemme å seede kategorien sin. Verdiene er kopiert
  // fra `v2.categories` i prod, så upserten er en no-op på eksisterende baser.
  ...OSM_GATE_CATEGORIES,
  TAXI_CATEGORY,
];

// ── Haversine distance ─────────────────────────────────────────────────────

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImportPublicPoisResult {
  /** Antall POI-er linket til prosjektet per kilde */
  counts: { nsr: number; barnehagefakta: number; overpass: number; taxi: number };
  /** Advisory-meldinger (ikke feil) */
  warnings: string[];
}

interface PoiInsert {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category_id: string;
  source: string;
  nsr_id?: string;
  barnehagefakta_id?: string;
  osm_id?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function upsertAndLink(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  pois: PoiInsert[],
  sourceIdField?: "nsr_id" | "barnehagefakta_id" | "osm_id"
): Promise<number> {
  if (pois.length === 0) return 0;

  // Pre-lookup: hvis en POI allerede finnes med samme kilde-ID men annen DB-id
  // (f.eks. importert av en annen pipeline med UUID), remap til eksisterende id
  // slik at ON CONFLICT (id) håndterer upsert korrekt uten å krasje på unique-index.
  if (sourceIdField) {
    const sourceIds = pois.map((p) => p[sourceIdField]).filter(Boolean) as string[];
    if (sourceIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase.from("pois") as any)
        .select(`id, ${sourceIdField}`)
        .in(sourceIdField, sourceIds);
      if (existing?.length) {
        const existingMap = new Map<string, string>(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          existing.map((e: any) => [e[sourceIdField], e.id])
        );
        for (const poi of pois) {
          const sid = poi[sourceIdField];
          if (sid) {
            const existingId = existingMap.get(sid);
            if (existingId) poi.id = existingId;
          }
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upserted, error } = await (supabase.from("pois") as any)
    .upsert(pois, { onConflict: "id" })
    .select("id");

  if (error) throw new Error(`pois upsert feilet: ${error.message}`);

  const ids: string[] = (upserted ?? []).map((r: { id: string }) => r.id);

  if (ids.length === 0) return 0;

  const links = ids.map((poi_id) => ({ project_id: projectId, poi_id }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: linkError } = await (supabase.from("project_pois") as any)
    .upsert(links, { onConflict: "project_id,poi_id" });

  if (linkError) throw new Error(`project_pois link feilet: ${linkError.message}`);
  return ids.length;
}

// ── Skole-type-utledning ───────────────────────────────────────────────────

// Skoleslag utledes i lib/pipeline/zoned-school-selection.ts — nace-koden alene
// holdt ikke (Trondheim koder alle grunnskoler som 85.201).

// ── NSR ───────────────────────────────────────────────────────────────────

async function importNSR(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  kommunenummer: string,
  warnings: string[]
): Promise<number> {
  let raw: unknown[];
  try {
    const res = await fetch(
      `https://data-nsr.udir.no/enheter/kommune/${kommunenummer}`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    warnings.push(`NSR: feil ved henting — ${err}. Pipeline fortsetter uten skoler.`);
    return 0;
  }

   
  const candidates: Array<{ poi: PoiInsert; dist: number; type: SchoolType }> = [];

  for (const school of raw as Record<string, unknown>[]) {
    const naceKode = (school.NaceKode1 as string | undefined) ?? "";
    const schoolName = (school.Navn as string | undefined) ?? "Ukjent skole";
    const schoolType = resolveSchoolTypeFromNsr(naceKode, schoolName);
    if (!schoolType) continue;

    const schoolLat = school.Breddegrad as number | null;
    const schoolLng = school.Lengdegrad as number | null;
    if (!schoolLat || !schoolLng) continue;

    // MERK: ingen radius-filtrering her. Kretsskolen er et faktum om adressen,
    // ikke om avstanden — en bolig i Vikåsen sogner til Markaplassen (2,9 km)
    // uansett hvor mange skoler som ligger nærmere. Radiusen brukes bare i
    // nærmeste-fallbacken inne i `selectSchools`.
    const dist = haversineMeters(lat, lng, schoolLat, schoolLng);

    const orgNr = school.OrgNr as string | number;
    const nsrId = `nsr-${orgNr}`;

    candidates.push({
      poi: {
        id: nsrId,
        name: schoolName,
        lat: schoolLat,
        lng: schoolLng,
        category_id: "skole",
        source: "nsr",
        nsr_id: nsrId,
      },
      dist,
      type: schoolType,
    });
  }

  // Kretsskolen først, nærmeste som tillegg/fallback. Utenfor Trondheim gir
  // `getSchoolZone` {null, null} og oppførselen blir den gamle (Straumen-
  // prinsippet: «ingen data her» må ha definert oppførsel).
  const zone = getSchoolZone(lat, lng);
  const byId = new Map(candidates.map((c) => [c.poi.id, c.poi]));
  const { picks, warnings: selectionWarnings } = selectSchools(
    { barneskole: zone.barneskole, ungdomsskole: zone.ungdomsskole },
    candidates.map((c) => ({
      id: c.poi.id,
      name: c.poi.name,
      type: c.type,
      distanceMeters: c.dist,
    })),
    radiusMeters,
  );
  warnings.push(...selectionWarnings.map((w) => `NSR: ${w}`));

  const selected: PoiInsert[] = picks
    .map((p) => byId.get(p.candidate.id))
    .filter((p): p is PoiInsert => p !== undefined);

  for (const pick of picks) {
    if (pick.reason === "krets") {
      warnings.push(
        `ℹ️  Kretsskole (${pick.type}): ${pick.candidate.name} — ${Math.round(pick.candidate.distanceMeters)} m`,
      );
    }
  }

  if (selected.length === 0) {
    warnings.push(`NSR: ingen skoler funnet innenfor ${radiusMeters} m av kommunenr ${kommunenummer}`);
    return 0;
  }

  const linked = await upsertAndLink(supabase, projectId, selected, "nsr_id");

  // Samme skole fra en annen kilde må ut av poolen, ellers legger kretsvalget
  // «Charlottenlund ungdomsskole» og «Ranheim skole» dobbelt på kartet: OSM-
  // sveipet og gammel håndkuratering har egne rader uten felles ekstern nøkkel.
  //
  // Fail-soft: ryddingen er etterarbeid, ikke selve importen. Faller den, skal
  // skolene som nettopp ble linket bli stående — ikke rulles tilbake av en
  // feilende opprydding.
  try {
    await unlinkDuplicateSchools(supabase, projectId, selected, warnings);
  } catch (err) {
    warnings.push(`Dublett-rydding av skoler hoppet over — ${err}`);
  }

  return linked;
}

/**
 * Fjern pool-lenker til skoler som er duplikat av dem vi nettopp valgte.
 *
 * Bare LENKEN fjernes — POI-raden blir stående, så ingenting går tapt og et
 * annet board som bruker raden er upåvirket. Rader som strøk-kuratering peker
 * på fredes.
 */
async function unlinkDuplicateSchools(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  selected: PoiInsert[],
  warnings: string[]
): Promise<void> {
  const { data: links } = await supabase
    .from("project_pois")
    .select("poi_id, pois!inner(id, name, lat, lng, category_id, source)")
    .eq("project_id", projectId);

  const pooled = (links ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.pois)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p?.category_id === "skole")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, source: p.source }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: areas } = await (supabase as any).from("areas").select("report_editorial");
  const protectedIds = new Set<string>();
  for (const area of areas ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const theme of Object.values((area as any).report_editorial ?? {})) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const id of ((theme as any)?.highlightCandidates ?? []) as string[]) {
        protectedIds.add(id);
      }
    }
  }

  const selectedIds = new Set(selected.map((s) => s.id));
  const unlink = [
    ...planSchoolDeduplication(
      selected.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })),
      pooled,
      protectedIds
    ),
    ...planStaleSchoolUnlink(selectedIds, pooled, protectedIds),
  ].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
  if (unlink.length === 0) return;

  const ids = unlink.map((u) => u.id);
  await supabase.from("project_pois").delete().eq("project_id", projectId).in("poi_id", ids);

  const { data: products } = await supabase.from("products").select("id").eq("project_id", projectId);
  for (const product of products ?? []) {
    await supabase
      .from("product_pois")
      .delete()
      .eq("product_id", (product as { id: string }).id)
      .in("poi_id", ids);
  }

  for (const u of unlink) {
    warnings.push(`ℹ️  Dublett-skole fjernet fra poolen: ${u.name} (${u.id})`);
  }
}

// ── Barnehagefakta ────────────────────────────────────────────────────────

/** Overpass krever en reell User-Agent — se kommentaren i importOverpass. */
const OVERPASS_USER_AGENT = "Placy/1.0 (kontakt@placy.no)";

/** Meter per breddegrad (WGS84, tilnærmet — godt nok for en radius-margin). */
const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Barnehagefakta-API-ets radius-parameter er GRADER, og den brukes likt på
 * begge akser (bounding box) — ikke meter, og ikke avstandskorrigert. På 63°
 * nord er 0,025° lengdegrad bare ~1,25 km, så den tidligere hardkodede `0.025`
 * klippet bort barnehager som lå 1,3–2,5 km øst/vest for senteret FØR
 * haversine-filteret under fikk se dem.
 *
 * Grilstad-funn 2026-08-24: Ranheimsfjæra barnehage (kommunal, 1 449 m) og
 * Læringsverkstedet Humlehaugen Doremi (1 853 m) manglet på boardet selv om
 * begge lå godt innenfor prosjektets 2 500 m — de lå 0,026° og 0,034° unna i
 * lengderetningen, altså utenfor 0,025-boksen.
 *
 * Vi konverterer derfor radiusMeters til grader langs den TRANGESTE aksen
 * (lengdegrad = breddegrad delt på cos(lat)) og legger på 20 % margin.
 * Haversine-filteret under gjør den presise avgrensningen; denne verdien skal
 * bare være romslig nok til at API-et ikke klipper for oss.
 */
export function barnehagefaktaRadiusDegrees(
  lat: number,
  radiusMeters: number
): number {
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
  const degrees = (radiusMeters / METERS_PER_DEGREE_LAT / cosLat) * 1.2;
  // Tak på 1,0° (~100 km) — vern mot at en absurd radiusMeters ber om hele landet.
  return Math.min(degrees, 1);
}

async function importBarnehagefakta(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  warnings: string[]
): Promise<number> {
  let raw: unknown[];
  try {
    const res = await fetch(
      `https://www.barnehagefakta.no/api/Location/radius/${lat}/${lng}/${barnehagefaktaRadiusDegrees(
        lat,
        radiusMeters
      ).toFixed(4)}`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    warnings.push(`Barnehagefakta: feil ved henting — ${err}. Pipeline fortsetter uten barnehager.`);
    return 0;
  }

  const pois: PoiInsert[] = [];
  for (const bh of raw as Record<string, unknown>[]) {
    const coords = bh.koordinatLatLng as [number, number] | undefined;
    if (!coords || coords.length < 2) continue;

    const bhLat = coords[0];
    const bhLng = coords[1];
    if (haversineMeters(lat, lng, bhLat, bhLng) > radiusMeters) continue;

    const name = (bh.navn as string | undefined) ?? "Ukjent barnehage";
    const rawId = bh.id as string | number | null;
    const bhId = rawId != null ? `bhf-${rawId}` : `bhf-${slugify(name)}`;

    pois.push({
      id: bhId,
      name,
      lat: bhLat,
      lng: bhLng,
      category_id: "barnehage",
      source: "barnehagefakta",
      barnehagefakta_id: bhId,
    });
  }

  if (pois.length === 0) {
    warnings.push("Barnehagefakta: ingen barnehager innenfor radius");
    return 0;
  }

  return upsertAndLink(supabase, projectId, pois, "barnehagefakta_id");
}

// ── Overpass ──────────────────────────────────────────────────────────────

/**
 * Bounding-box-deltas i grader for en radius i meter, én per akse (breddegrad
 * og lengdegrad skalerer ulikt — se kommentaren i importOverpass). 20 % margin
 * fordi en bbox er en firkant rundt en sirkel; haversine-filteret rydder etterpå.
 */
export function overpassBboxDeltas(
  lat: number,
  radiusMeters: number
): { latDelta: number; lngDelta: number } {
  const latDelta = (radiusMeters / METERS_PER_DEGREE_LAT) * 1.2;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
  return { latDelta, lngDelta: latDelta / cosLat };
}


async function importOverpass(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  warnings: string[]
): Promise<number> {
  // Overpass' bbox er i grader, og en enkelt `delta` på begge akser blir
  // asymmetrisk: på 63° nord er 0,025° i lengderetningen bare ~1,25 km mens
  // det er ~2,8 km i breddretningen. Den tidligere hardkodede 0.025 klippet
  // derfor bort idrettsanlegg 1,3–2,5 km øst/vest for senteret (samme
  // Grilstad-funn 2026-08-24 som traff Barnehagefakta over). Vi regner én
  // delta per akse ut fra prosjektradiusen; haversine-filteret under gjør den
  // presise avgrensningen.
  const { latDelta, lngDelta } = overpassBboxDeltas(lat, radiusMeters);
  const south = lat - latDelta;
  const north = lat + latDelta;
  const west = lng - lngDelta;
  const east = lng + lngDelta;

  // Spørringen bygges FRA hvitelisten i osm-gate, ikke hardkodet her — ellers
  // kan spørringen og porten som filtrerer svaret drifte fra hverandre. Se
  // osm-gate.ts for hvorfor hver tag er med, og hvorfor parkering, lekeplass
  // og benker aldri får bli POI-er uansett hvor godt de er navngitt.
  const query = buildOverpassQuery({ south, west, north, east });

  let raw: unknown;
  let attempt = 0;

  while (attempt <= 1) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          // Overpass svarer 406 Not Acceptable på Node-fetch sin default
          // User-Agent — uten denne headeren har denne kilden ALDRI levert
          // idrettsanlegg (Grilstad-funn 2026-08-24: «Trening & Aktivitet»
          // hadde 4 steder, alle fra Google). Samme verdi som de to andre
          // Overpass-kallstedene (lib/generators/trail-fetcher.ts,
          // scripts/seed-osm-pois.ts) — de satte den fra dag én.
          "User-Agent": OVERPASS_USER_AGENT,
        },
        signal: AbortSignal.timeout(35000),
      });
      if (res.status === 429 || res.status === 500 || res.status === 406) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 5000));
          attempt++;
          continue;
        }
        throw new Error(`HTTP ${res.status} etter retry`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.json();
      break;
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 5000));
        attempt++;
        continue;
      }
      warnings.push(`Overpass: feil ved henting — ${err}. Pipeline fortsetter uten idrettsanlegg.`);
      return 0;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements = ((raw as any)?.elements ?? []) as OverpassElement[];
  const pois: PoiInsert[] = [];
  const ledger = emptyLedger();
  let outsideRadius = 0;

  for (const el of elements) {
    const verdict = evaluateOsmElement(el);
    recordVerdict(ledger, verdict);
    if (!verdict.accept) continue;

    // Bboxen er en firkant rundt sirkelen; haversine gjør den presise
    // avgrensningen. Telles for seg — å ligge utenfor prosjektets radius er
    // ikke en dom over objektet, og skal ikke blandes inn i portens regnskap.
    if (haversineMeters(lat, lng, verdict.lat, verdict.lng) > radiusMeters) {
      outsideRadius++;
      continue;
    }

    pois.push({
      id: osmPoiId(el),
      name: verdict.name,
      lat: verdict.lat,
      lng: verdict.lng,
      category_id: verdict.categoryId,
      source: "osm",
      osm_id: osmSourceId(el),
    });
  }

  // Avvisnings-regnskapet er advisory, men det skal ALDRI være stille: faller
  // 171 parkeringer ut, står det i loggen at 171 parkeringer falt ut, gruppert
  // per grunn. Stille trunkering leses som «vi dekket alt» når vi ikke gjorde det.
  warnings.push(
    outsideRadius > 0
      ? `${summarizeLedger(ledger)}; ${outsideRadius} godkjent men utenfor radius`
      : summarizeLedger(ledger)
  );

  if (pois.length === 0) {
    warnings.push("Overpass: ingen steder passerte porten innenfor radius");
    return 0;
  }

  return upsertAndLink(supabase, projectId, pois, "osm_id");
}

// ── Taxiholdeplasser (Trondheim parkering) ────────────────────────────────

/**
 * Link taxiholdeplassene innenfor radiusen.
 *
 * Ingen nettverkskall — datasettet ligger i repoet (se `taxi-stands.ts` for
 * hvorfor, og `scripts/fetch-taxi-holdeplasser.sh` for hvordan det oppdateres).
 *
 * Ingen dedup-nøkkel mot andre kilder: hverken Google, Entur eller OSM-porten
 * produserer taxiholdeplasser i dag, så det finnes ingen rad å kollidere med.
 * Skulle en slik kilde komme, er `taxi-tk-<slug>`-id-en stabil og lett å mappe.
 */
async function importTaxiStands(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  warnings: string[]
): Promise<number> {
  const nearby = taxiStandsWithin(lat, lng, radiusMeters, haversineMeters);

  if (nearby.length === 0) {
    // Utenfor Trondheim er dette normaltilstanden, ikke en feil — datasettet
    // er kommunens eget og dekker bare Trondheim.
    warnings.push(
      `Taxi: ingen holdeplasser innenfor ${radiusMeters} m (datasettet dekker bare Trondheim, hentet ${TAXI_STANDS_FETCHED_AT})`
    );
    return 0;
  }

  const pois: PoiInsert[] = nearby.map((stand) => ({
    id: taxiStandId(stand),
    name: stand.navn,
    lat: stand.lat,
    lng: stand.lng,
    category_id: TAXI_CATEGORY.id,
    source: "trondheim-parkering",
  }));

  const linked = await upsertAndLink(supabase, projectId, pois);
  warnings.push(
    `ℹ️  Taxi: ${linked} holdeplasser — nærmeste ${nearby[0].navn} (${Math.round(nearby[0].distanceMeters)} m)`
  );
  return linked;
}

// ── Eksisterende natur-POI-linker ─────────────────────────────────────────

async function linkNaturPois(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  warnings: string[]
): Promise<number> {
  // Fjern gamle natur-lenker før re-linking (ren re-link, ingen etterlatte rader)
  const { data: oldNaturLinks } = await supabase
    .from("project_pois")
    .select("poi_id, pois!inner(category_id)")
    .eq("project_id", projectId);

  const oldNaturIds = (oldNaturLinks ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => ["lekeplass", "badeplass", "park", "outdoor"].includes(r.pois?.category_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.poi_id);

  if (oldNaturIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("project_pois") as any)
      .delete()
      .eq("project_id", projectId)
      .in("poi_id", oldNaturIds);
  }

  const { data: naturPois, error } = await supabase
    .from("pois")
    .select("id, lat, lng")
    .in("category_id", ["lekeplass", "badeplass", "park", "outdoor"]);

  if (error) {
    warnings.push(`Natur-POI-er: DB-feil — ${error.message}`);
    return 0;
  }

  // INGEN CAP. Her sto `MAX_NATUR = 20`: de 20 nærmeste uteområdene ble lenket,
  // resten falt stille ut.
  //
  // Funnet som avskaffet den (2026-08-24): Hansbakkfjæra — badeplassen med
  // grillbenker og svaberg øst på Ranheim — ligger 1 835 m fra Strindfjordvegen
  // 10 og havnet på plass 31 av 54 natur-POI-er innenfor radiusen. Kuttlinja
  // (plass 20) gikk ved 1 143 m. Boardet viste altså ikke stranda folk faktisk
  // bruker, mens lekeplasser i borettslag 800 m unna spiste budsjettet.
  //
  // Avstandssortering med et tak er strukturelt feil for denne kategorien:
  // lekeplasser ligger tett innover i boligfeltene, mens kysten og marka
  // strekker seg lineært utover. Taket kutter derfor systematisk sjøkanten —
  // det mest solgbare ved et sted som Ranheim. Sirkelen er grensen.
  const inRadius = (naturPois ?? [])
    .filter((p: { lat: number; lng: number }) =>
      haversineMeters(lat, lng, p.lat, p.lng) <= radiusMeters
    )
    .sort((a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
      haversineMeters(lat, lng, a.lat, a.lng) - haversineMeters(lat, lng, b.lat, b.lng)
    );

  if (inRadius.length === 0) return 0;

  const links = inRadius.map((p: { id: string }) => ({
    project_id: projectId,
    poi_id: p.id,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: linkError } = await (supabase.from("project_pois") as any)
    .upsert(links, { onConflict: "project_id,poi_id" });

  if (linkError) {
    warnings.push(`Natur-POI-er: link feilet — ${linkError.message}`);
    return 0;
  }

  return inRadius.length;
}

// ── Hoved-eksport ─────────────────────────────────────────────────────────

export interface ImportPublicPoisOptions {
  projectId: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  /** Fra Kartverket kommuneinfo-oppslag */
  kommunenummer: string;
}

/**
 * Kjør én kilde fail-soft (AC5 — aldri abort): en feil (fetch ELLER DB-skriving,
 * inkl. en kastet `upsertAndLink`) logges som warning + telles 0, slik at de
 * andre kildene kjører videre. De interne import*-funksjonene fail-softer allerede
 * fetch-feil; denne wrapperen vokter også DB-skrive-feil som ellers ville propagert.
 */
async function runSource(
  label: string,
  warnings: string[],
  fn: () => Promise<number>
): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    warnings.push(
      `${label}: feilet (${err instanceof Error ? err.message : String(err)}). Pipeline fortsetter uten denne kilden.`
    );
    return 0;
  }
}

/**
 * Kjør KUN skole-importen for et eksisterende prosjekt.
 *
 * Finnes fordi skolekrets-fiksen (2026-08-14) må rulles ut på boards som alt
 * er provisjonert, uten å dra med seg resten av pipelinen: full re-kjøring
 * koster Google-kall, re-stokker natur-lenkene (`linkNaturPois` beholder bare
 * de 20 nærmeste) og endrer mer enn skolene på et board som ellers er ferdig.
 */
export async function refreshZonedSchools(
  options: ImportPublicPoisOptions
): Promise<{ linked: number; warnings: string[] }> {
  const baseClient = createServerClient();
  if (!baseClient) throw new Error("Supabase ikke konfigurert");
  const supabase = baseClient.schema("v2") as unknown as typeof baseClient;

  const { projectId, lat, lng, radiusMeters, kommunenummer } = options;
  const warnings: string[] = [];

  await upsertCategories(PUBLIC_POI_CATEGORIES, { schema: "v2" });
  const linked = await importNSR(
    supabase,
    projectId,
    lat,
    lng,
    radiusMeters,
    kommunenummer,
    warnings
  );

  return { linked, warnings };
}

export async function importPublicPois(
  options: ImportPublicPoisOptions
): Promise<ImportPublicPoisResult> {
  const baseClient = createServerClient();
  if (!baseClient) {
    throw new Error("Supabase ikke konfigurert");
  }
  // v2-skrivesti (PRD 3 / r03.4): scoped klient castes til public-typen (v2/public
  // paritet) så alle helper-signaturer + .from()/.select()-kall er uendret; runtime
  // treffer v2. Samme mønster som import-pois/mutations (Andreas: Option A).
  const supabase = baseClient.schema("v2") as unknown as typeof baseClient;

  const { projectId, lat, lng, radiusMeters, kommunenummer } = options;
  const warnings: string[] = [];

  // Seed kategori-definisjonene kildene skriver (cutover-funn 2026-07-06):
  // Google-importen upserter sine kategorier, men denne modulen skrev POI-er
  // med category_id skole/barnehage/idrett UTEN definisjonene → kategorien
  // resolvet til «Ukjent» og hele Barn & Oppvekst-temaet forsvant fra boardet.
  await runSource("Kategorier", warnings, async () => {
    await upsertCategories(PUBLIC_POI_CATEGORIES, { schema: "v2" });
    return PUBLIC_POI_CATEGORIES.length;
  });

  // Seriell utførelse per kilde (maskin-hensyn), hver fail-soft (aldri abort).
  const nsr = await runSource("NSR", warnings, () =>
    importNSR(supabase, projectId, lat, lng, radiusMeters, kommunenummer, warnings)
  );
  const barnehagefakta = await runSource("Barnehagefakta", warnings, () =>
    importBarnehagefakta(supabase, projectId, lat, lng, radiusMeters, warnings)
  );
  const overpass = await runSource("Overpass", warnings, () =>
    importOverpass(supabase, projectId, lat, lng, radiusMeters, warnings)
  );

  const taxi = await runSource("Taxi", warnings, () =>
    importTaxiStands(supabase, projectId, lat, lng, radiusMeters, warnings)
  );

  // Link eksisterende natur-POI-er fra DB (ingen external API)
  const naturLinked = await runSource("Natur", warnings, () =>
    linkNaturPois(supabase, projectId, lat, lng, radiusMeters, warnings)
  );
  if (naturLinked > 0) {
    warnings.push(`ℹ️  Natur: linket ${naturLinked} eksisterende POI-er fra DB`);
  }

  return { counts: { nsr, barnehagefakta, overpass, taxi }, warnings };
}
