/**
 * Offentlige POI-kildar for basic-tier rapport-pipeline:
 * NSR (skoler), Barnehagefakta (barnehager), Overpass (idrettsanlegg).
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
  planSchoolDeduplication,
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
  { id: "idrett", name: "Idrettsanlegg", icon: "Trophy", color: "#f59e0b" },
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
  counts: { nsr: number; barnehagefakta: number; overpass: number };
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
    .select("poi_id, pois!inner(id, name, lat, lng, category_id)")
    .eq("project_id", projectId);

  const pooled = (links ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.pois)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p?.category_id === "skole")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng }));

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

  const unlink = planSchoolDeduplication(
    selected.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })),
    pooled,
    protectedIds
  );
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
      `https://www.barnehagefakta.no/api/Location/radius/${lat}/${lng}/0.025`,
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

async function importOverpass(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  warnings: string[]
): Promise<number> {
  const delta = 0.025;
  const south = lat - delta;
  const north = lat + delta;
  const west = lng - delta;
  const east = lng + delta;

  const query = `[out:json][timeout:25];(
  way["leisure"="sports_centre"](${south},${west},${north},${east});
  node["leisure"="sports_centre"](${south},${west},${north},${east});
  way["leisure"="pitch"]["sport"~"soccer|football|handball|tennis|basketball"](${south},${west},${north},${east});
  way["leisure"="swimming_pool"](${south},${west},${north},${east});
);out center;`;

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
  const elements = ((raw as any)?.elements ?? []) as Record<string, unknown>[];
  const pois: PoiInsert[] = [];

  for (const el of elements) {
    const name = (el.tags as Record<string, string> | undefined)?.name;
    if (!name) continue;

    let elLat: number;
    let elLng: number;

    if (el.type === "way" && el.center) {
      const center = el.center as { lat: number; lon: number };
      elLat = center.lat;
      elLng = center.lon;
    } else {
      elLat = el.lat as number;
      elLng = el.lon as number;
    }

    if (!elLat || !elLng) continue;
    if (haversineMeters(lat, lng, elLat, elLng) > radiusMeters) continue;

    const osmId = `osm-${el.type as string}${el.id as number}`;
    pois.push({
      id: osmId,
      name,
      lat: elLat,
      lng: elLng,
      category_id: "idrett",
      source: "osm",
      osm_id: osmId,
    });
  }

  if (pois.length === 0) {
    warnings.push("Overpass: ingen idrettsanlegg funnet innenfor radius");
    return 0;
  }

  return upsertAndLink(supabase, projectId, pois, "osm_id");
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
  // Fjern gamle natur-lenker før re-linking (sikrer at cap på MAX_NATUR gjelder)
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

  const MAX_NATUR = 20;

  const inRadius = (naturPois ?? [])
    .filter((p: { lat: number; lng: number }) =>
      haversineMeters(lat, lng, p.lat, p.lng) <= radiusMeters
    )
    .sort((a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
      haversineMeters(lat, lng, a.lat, a.lng) - haversineMeters(lat, lng, b.lat, b.lng)
    )
    .slice(0, MAX_NATUR);

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

  // Link eksisterende natur-POI-er fra DB (ingen external API)
  const naturLinked = await runSource("Natur", warnings, () =>
    linkNaturPois(supabase, projectId, lat, lng, radiusMeters, warnings)
  );
  if (naturLinked > 0) {
    warnings.push(`ℹ️  Natur: linket ${naturLinked} eksisterende POI-er fra DB`);
  }

  return { counts: { nsr, barnehagefakta, overpass }, warnings };
}
