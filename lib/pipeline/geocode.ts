/**
 * Geocoding helpers for pipeline scripts — kaller Mapbox direkte uten dev-server.
 * Token hentes fra MAPBOX_TOKEN (server) eller NEXT_PUBLIC_MAPBOX_TOKEN (dev).
 *
 * Provider er LÅST til Mapbox Geocoding v6 (`match_code`) — Beslutning #13
 * (Search Box forkastet: returnerer ingen relevance/confidence). v6 har IKKE
 * et flatt `relevance`-float som v5 hadde; det eksponerte kvalitetsfeltet er
 * derfor et normalisert `confidence: number` (0–1) utledet av `match_code`.
 * Mapbox-token må ligge i `access_token`-querystringen — det er API-ets eneste
 * auth-mekanisme (ingen header-variant finnes), og tokenet er ikke en Google-
 * style hemmelighet (jf. CLAUDE.md-unntaket for NEXT_PUBLIC_MAPBOX_TOKEN).
 */

export interface GeocodeResult {
  placeName: string;
  lat: number;
  lng: number;
  /**
   * Normalisert kvalitet 0–1 fra v6 `match_code.confidence`:
   * exact→1, high→0.75 (begge ≥0.5 = passerer), medium→0.4, low→0.2
   * (begge <0.5 = avbryt), ukjent/manglende→0 (avbryt-trygt).
   */
  confidence: number;
  /** Laveste nivå i kontekst-hierarkiet (by, kommune eller sted) */
  city?: string;
  /** Fylke/region */
  region?: string;
}

/**
 * Confidence-terskel — den ENESTE kvalitetsvakten før writes. exact/high
 * (≥0.5) passerer, medium/low (<0.5) avbryter provisjonen (AC2).
 */
export const GEOCODE_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Avbryt-gaten (load-bearing): true = trygg nok til å skrive, false = avbryt.
 * Eksportert + testet så et stille-brutt gate fanges (AC5).
 */
export function meetsGeocodeConfidence(result: GeocodeResult): boolean {
  return result.confidence >= GEOCODE_CONFIDENCE_THRESHOLD;
}

// ─── Mapbox Geocoding v6 respons-typer (ingen `any`) ─────────────────────────

type V6Confidence = "exact" | "high" | "medium" | "low";

const CONFIDENCE_SCORE: Record<V6Confidence, number> = {
  exact: 1,
  high: 0.75,
  medium: 0.4,
  low: 0.2,
};

/** Map v6 `match_code.confidence`-enum → normalisert 0–1. Ukjent → 0 (avbryt-trygt). */
function normalizeConfidence(confidence: string | undefined): number {
  if (confidence && confidence in CONFIDENCE_SCORE) {
    return CONFIDENCE_SCORE[confidence as V6Confidence];
  }
  return 0;
}

interface V6ContextEntry {
  name?: string;
}

interface V6Properties {
  full_address?: string;
  place_formatted?: string;
  name?: string;
  coordinates?: { longitude?: number; latitude?: number };
  match_code?: { confidence?: string };
  context?: {
    place?: V6ContextEntry;
    locality?: V6ContextEntry;
    region?: V6ContextEntry;
  };
}

interface V6Feature {
  geometry?: { coordinates?: [number, number] };
  properties?: V6Properties;
}

interface V6Response {
  features?: V6Feature[];
}

function getToken(): string {
  const token =
    process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("MAPBOX_TOKEN er ikke konfigurert i .env.local");
  return token;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const token = getToken();
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${token}&country=no&limit=5&language=no`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox geocode feila: ${res.status}`);
  const data = (await res.json()) as V6Response;

  return (data.features ?? []).map((f): GeocodeResult => {
    const props = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    const lng = coords?.[0] ?? props.coordinates?.longitude ?? 0;
    const lat = coords?.[1] ?? props.coordinates?.latitude ?? 0;
    const ctx = props.context ?? {};
    return {
      placeName:
        props.full_address ?? props.place_formatted ?? props.name ?? query,
      lat,
      lng,
      confidence: normalizeConfidence(props.match_code?.confidence),
      city: ctx.place?.name ?? ctx.locality?.name,
      region: ctx.region?.name,
    };
  });
}

export interface KommuneInfo {
  kommunenummer: string;
  kommunenavn: string;
}

interface KartverketPunkt {
  kommunenummer?: string | number;
  kommunenavn?: string;
}

export async function getKommunenummer(
  lat: number,
  lng: number
): Promise<KommuneInfo | null> {
  const url = `https://api.kartverket.no/kommuneinfo/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      // Fail-soft: konsekvensen er at NSR-skoler (kommune-scoped) kan mangle
      // for denne lokasjonen. Logges, men kaster aldri (AC3).
      console.warn(
        `Kartverket kommune-oppslag feilet (${res.status}) for ${lat},${lng} — NSR-skoler kan mangle`
      );
      return null;
    }
    const data = (await res.json()) as KartverketPunkt;
    if (!data.kommunenummer) return null;
    return {
      kommunenummer: String(data.kommunenummer).padStart(4, "0"),
      kommunenavn: data.kommunenavn ?? "",
    };
  } catch (err) {
    console.warn(
      `Kartverket kommune-oppslag kastet for ${lat},${lng}: ${
        err instanceof Error ? err.message : String(err)
      } — NSR-skoler kan mangle`
    );
    return null;
  }
}
