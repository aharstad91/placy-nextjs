/**
 * Rekkevidde-konturer (isokroner) — provisjoneringssteg 7c som henter «hvor
 * langt kommer man på 5, 10 og 15 minutter» fra prosjekt-origo via Mapbox
 * Isochrone og skriver dem til `products.config.reportConfig.isochrones`.
 *
 * Ett kall per profil (walking / cycling / driving), tre kall per prosjekt.
 * Samme veinett som reisetid-steget bruker for POI-minuttene — det er hele
 * poenget: et sted som viser 7 min gange skal ligge innenfor 10-min-konturen.
 *
 * Plassering i rekkefølgen: ETTER board-fakta (7b) og FØR editorial-arven (8),
 * av samme grunn som board-fakta ligger der — alle tre gjør read-modify-write
 * mot samme config-rad, og skrivingene er lettere å resonnere om når de ligger
 * sammenhengende.
 *
 * PER-PROFIL-MERGE: et 429 på sykkel skal ikke slette en frisk sykkel-kontur
 * fra forrige kjøring. Fersk profil vinner, manglende profil beholdes — samme
 * regel som `mergeTravelTimes`.
 *
 * FAIL-SOFT: steget kaster aldri. Mangler alle tre konturene, står boardet
 * uten av/på-knapp og med resten intakt.
 *
 * MAPBOX TOKEN-SIKKERHET: `access_token` i querystring er Isochrone-API-ets
 * eneste auth-mekanisme (ingen header-variant). Logg aldri full request-URL —
 * warnings bærer profil og status, ikke URL.
 */

import { patchThenRevalidate } from "@/lib/pipeline/patch-product-config";
import { IsochroneSetSchema, ISOCHRONE_MINUTES } from "@/lib/types";
import type { IsochroneContours, IsochroneSet, TravelMode } from "@/lib/types";
import { travelModeToMapboxProfile } from "@/lib/utils";

/** Timeout på Supabase REST — samme mønster som board-fakta-steget. */
const REST_TIMEOUT_MS = 30_000;

/** Timeout på Mapbox — samme 8 s som Matrix-kallene i reisetid-steget. */
const MAPBOX_TIMEOUT_MS = 8_000;

/** Isochrone deler rate-limit-karakter med Matrix; samme retry-budsjett. */
const RATE_LIMIT_RETRIES = 4;

/**
 * Forenkling i meter. Isochrone returnerer ellers flere hundre punkter per
 * kontur, som er tungt for tre polygon-elementer på fotorealistiske fliser.
 * Verdien skalerer med profilen: bil-konturen dekker mange kilometer og tåler
 * grovere forenkling enn gangkonturen, som leses tett på.
 */
const GENERALIZE_M: Record<TravelMode, number> = {
  walk: 20,
  bike: 40,
  car: 100,
};

/**
 * `denoise` styrer hvor mange frakoblede flater Mapbox beholder per
 * minuttverdi. 1.0 er maksimal støyfjerning og returnerer BARE den største
 * flaten — et nåbart område som henger på en bru eller gangvei uten kobling i
 * veinettet faller da ut, og ser feilaktig ut som uten rekkevidde på kartet.
 *
 * 0.5 beholder reelle sekundærflater og forkaster de minste flisene. Det gjør
 * MultiPolygon den normale formen, ikke unntaket — begge tegnelagene håndterer
 * det. Prøves på Wesselsløkka før verdien anses låst.
 */
const DENOISE = 0.5;

export interface IsochroneStepResult {
  /** true → ingenting skrevet (ingen konturer, eller fail-soft-stopp). */
  skipped?: boolean;
  /** Settet som ble skrevet (etter merge), når det finnes. */
  isochrones?: IsochroneSet;
  /** Profilene denne kjøringen faktisk hentet ferske konturer for. */
  fetched: TravelMode[];
  warnings: string[];
}

interface ProductRow {
  id: string;
  config: unknown;
  updated_at: string;
}

interface IsochroneFeature {
  properties?: { contour?: number };
  geometry?: unknown;
}

const PROFILES: TravelMode[] = ["walk", "bike", "car"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ventefunksjonen mellom retry-forsøk. Injiserbar for tester. */
export type SleepImpl = (ms: number) => Promise<unknown>;

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}

/**
 * Fetch med retry på 429, som Matrix-kallene. Returnerer null når budsjettet
 * er brukt opp — kalleren samler en warning og dropper profilen.
 */
async function fetchIsochroneWithRetry(
  url: string,
  mode: TravelMode,
  warnings: string[],
  sleepImpl: SleepImpl
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(MAPBOX_TIMEOUT_MS) });
    if (response.status !== 429) return response;

    if (attempt >= RATE_LIMIT_RETRIES) {
      warnings.push(
        `⚠️  Mapbox Isochrone ${mode}: rate-limit (HTTP 429) etter ${RATE_LIMIT_RETRIES + 1} forsøk — profilen hoppet over`
      );
      return null;
    }

    const retryAfter = Number(response.headers?.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    await sleepImpl(waitMs);
  }
}

/**
 * Henter konturene for ÉN profil. Returnerer undefined når profilen ikke kunne
 * hentes eller svaret ikke bar alle tre minuttverdiene — en delvis profil
 * lagres ikke, for da ville boardet vist to av tre ringer uten å si hvorfor.
 */
export async function fetchIsochronesForMode(options: {
  mode: TravelMode;
  centerLat: number;
  centerLng: number;
  token: string;
  warnings: string[];
  /** Injiserbar for tester — unngår ekte backoff-venting. */
  sleepImpl?: SleepImpl;
}): Promise<IsochroneContours | undefined> {
  const { mode, centerLat, centerLng, token, warnings, sleepImpl } = options;
  const profile = travelModeToMapboxProfile[mode];

  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${centerLng},${centerLat}`
  );
  url.searchParams.set("contours_minutes", ISOCHRONE_MINUTES.join(","));
  url.searchParams.set("polygons", "true");
  url.searchParams.set("denoise", String(DENOISE));
  url.searchParams.set("generalize", String(GENERALIZE_M[mode]));
  url.searchParams.set("access_token", token);

  let response: Response | null;
  try {
    response = await fetchIsochroneWithRetry(
      url.toString(),
      mode,
      warnings,
      sleepImpl ?? sleep
    );
  } catch (e) {
    warnings.push(`⚠️  Mapbox Isochrone ${mode} feilet (${message(e)}) — profilen hoppet over`);
    return undefined;
  }
  if (!response) return undefined;

  if (!response.ok) {
    warnings.push(
      `⚠️  Mapbox Isochrone ${mode} svarte HTTP ${response.status} — profilen hoppet over`
    );
    return undefined;
  }

  let features: IsochroneFeature[];
  try {
    const body = (await response.json()) as { features?: IsochroneFeature[] };
    features = Array.isArray(body.features) ? body.features : [];
  } catch (e) {
    warnings.push(
      `⚠️  Mapbox Isochrone ${mode}: svaret var ikke lesbar JSON (${message(e)}) — profilen hoppet over`
    );
    return undefined;
  }

  const byMinute: Record<string, unknown> = {};
  for (const feature of features) {
    const contour = feature.properties?.contour;
    if (contour === undefined || !feature.geometry) continue;
    byMinute[String(contour)] = feature.geometry;
  }

  const missing = ISOCHRONE_MINUTES.filter((m) => byMinute[m] === undefined);
  if (missing.length > 0) {
    warnings.push(
      `⚠️  Mapbox Isochrone ${mode}: svaret manglet kontur for ${missing.join(", ")} min — profilen hoppet over`
    );
    return undefined;
  }

  // Valider geometrien med samme skjema lesestien bruker. Et ugyldig svar for
  // én profil skal ikke ta de andre med seg.
  const probe = IsochroneSetSchema.safeParse({
    isochronesVersion: 1,
    fetchedAt: new Date().toISOString(),
    byMode: { [mode]: byMinute },
  });
  if (!probe.success) {
    warnings.push(
      `⚠️  Mapbox Isochrone ${mode}: geometrien validerte ikke (${probe.error.issues[0]?.message ?? "ukjent"}) — profilen hoppet over`
    );
    return undefined;
  }

  return probe.data.byMode[mode];
}

/**
 * Slår sammen ferske konturer med det som alt står i config: fersk profil
 * vinner, profil som mangler i denne kjøringen beholdes. Returnerer undefined
 * når resultatet ville vært tomt — et tomt sett skal aldri skrives.
 */
export function mergeIsochrones(
  existing: IsochroneSet | undefined,
  fresh: Partial<Record<TravelMode, IsochroneContours>>,
  fetchedAt: string
): IsochroneSet | undefined {
  const byMode: Partial<Record<TravelMode, IsochroneContours>> = { ...(existing?.byMode ?? {}) };
  for (const mode of PROFILES) {
    const value = fresh[mode];
    if (value !== undefined) byMode[mode] = value;
  }
  if (PROFILES.every((mode) => byMode[mode] === undefined)) return undefined;
  return { isochronesVersion: 1, fetchedAt, byMode };
}

/**
 * Henter tre isokron-profiler og skriver dem til produktets config.
 *
 * Tar `productId` og ikke `projectId`: låse-skrivingen adresserer products-raden
 * (`id=eq.<productId>`), akkurat som board-fakta-steget.
 */
export async function computeProjectIsochrones(options: {
  productId: string;
  centerLat: number;
  centerLng: number;
  /** Injiserbar for tester. */
  now?: Date;
  /** Injiserbar for tester — unngår ekte backoff-venting ved 429. */
  sleepImpl?: SleepImpl;
  /**
   * Kalles KUN etter en vellykket skriving. Provisjoneringen har sitt eget
   * revaliderings-steg (9), men et backfill-løp har ikke det — uten dette lå
   * konturene i basen mens boardet fortsatte å vise gammel config, og knappen
   * dukket aldri opp.
   */
  revalidate?: () => Promise<void>;
}): Promise<IsochroneStepResult> {
  const { productId, centerLat, centerLng, now, sleepImpl, revalidate } = options;
  const warnings: string[] = [];

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    warnings.push("⚠️  MAPBOX_TOKEN mangler — rekkevidde-konturer hoppet over");
    return { skipped: true, fetched: [], warnings };
  }

  const fresh: Partial<Record<TravelMode, IsochroneContours>> = {};
  const fetched: TravelMode[] = [];
  for (const mode of PROFILES) {
    const contours = await fetchIsochronesForMode({
      mode,
      centerLat,
      centerLng,
      token,
      warnings,
      sleepImpl,
    });
    if (contours) {
      fresh[mode] = contours;
      fetched.push(mode);
    }
  }

  if (fetched.length === 0) {
    warnings.push("⚠️  Ingen isokron-profiler kunne hentes — konturene ikke skrevet");
    return { skipped: true, fetched: [], warnings };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    warnings.push(
      "⚠️  NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mangler — rekkevidde-konturer ikke skrevet"
    );
    return { skipped: true, fetched, warnings };
  }

  const getUrl = new URL(`${supabaseUrl}/rest/v1/products`);
  getUrl.searchParams.set("id", `eq.${productId}`);
  getUrl.searchParams.set("select", "id,config,updated_at");

  let rows: ProductRow[];
  try {
    const res = await fetch(getUrl.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        // v2 er eneste skjema etter cutover; rå REST treffer `public` som default.
        "Accept-Profile": "v2",
      },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (!res.ok) {
      warnings.push(
        `⚠️  Henting av products-rad feilet (${res.status}) — rekkevidde-konturer ikke skrevet`
      );
      return { skipped: true, fetched, warnings };
    }
    rows = (await res.json()) as ProductRow[];
  } catch (e) {
    warnings.push(
      `⚠️  Henting av products-rad feilet (${message(e)}) — rekkevidde-konturer ikke skrevet`
    );
    return { skipped: true, fetched, warnings };
  }

  const product = Array.isArray(rows) ? rows[0] : undefined;
  if (!product) {
    warnings.push(
      `⚠️  Ingen products-rad for id=${productId} — rekkevidde-konturer ikke skrevet`
    );
    return { skipped: true, fetched, warnings };
  }

  // jsonb-vs-streng: formen må BEVARES ved skriving, ellers bytter raden
  // representasjon under føttene på alle andre lesere.
  const configWasString = typeof product.config === "string";
  let existingConfig: Record<string, unknown>;
  if (configWasString) {
    try {
      existingConfig = JSON.parse(product.config as string) as Record<string, unknown>;
    } catch {
      warnings.push(
        `⚠️  products.config for ${product.id} er korrupt JSON-streng — rekkevidde-konturer ikke skrevet`
      );
      return { skipped: true, fetched, warnings };
    }
  } else {
    existingConfig = (product.config ?? {}) as Record<string, unknown>;
  }

  const rc = (existingConfig.reportConfig ?? {}) as Record<string, unknown>;
  const existingParsed = IsochroneSetSchema.safeParse(rc.isochrones);
  const merged = mergeIsochrones(
    existingParsed.success ? existingParsed.data : undefined,
    fresh,
    (now ?? new Date()).toISOString()
  );
  if (!merged) {
    warnings.push("⚠️  Sammenslåingen ga et tomt sett — rekkevidde-konturer ikke skrevet");
    return { skipped: true, fetched, warnings };
  }

  // Spread-merge KUN isochrones-nøkkelen: temaer, grounding, board-fakta, lyd
  // og alt annet i config overlever urørt.
  const nextConfig = {
    ...existingConfig,
    reportConfig: { ...rc, isochrones: merged },
  };

  const patched = await patchThenRevalidate({
    supabaseUrl,
    supabaseKey: serviceKey,
    productId: product.id,
    updatedAt: product.updated_at,
    config: configWasString ? JSON.stringify(nextConfig) : nextConfig,
    revalidate: revalidate ?? (async () => {}),
  });

  if (!patched.ok) {
    warnings.push(
      patched.reason === "zero-rows"
        ? "⚠️  Optimistisk lås: products.updated_at endret seg under kjøringen — rekkevidde-konturer IKKE skrevet (re-kjør steget)"
        : `⚠️  PATCH av rekkevidde-konturer feilet (${patched.status}) — ingenting skrevet`
    );
    return { skipped: true, isochrones: merged, fetched, warnings };
  }

  return { isochrones: merged, fetched, warnings };
}
