/**
 * Geocoding helpers for pipeline scripts — kaller Mapbox direkte uten dev-server.
 * Token hentes fra MAPBOX_TOKEN (server) eller NEXT_PUBLIC_MAPBOX_TOKEN (dev).
 */

export interface GeocodeResult {
  placeName: string;
  lat: number;
  lng: number;
  relevance: number;
  /** Laveste nivå i kontekst-hierarkiet (by, kommune eller sted) */
  city?: string;
  /** Fylke/region */
  region?: string;
}

function getToken(): string {
  const token =
    process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("MAPBOX_TOKEN er ikke konfigurert i .env.local");
  return token;
}

export async function geocodeAddress(
  query: string
): Promise<GeocodeResult[]> {
  const token = getToken();
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=NO&limit=5&language=no`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox geocode feila: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.features ?? []).map((f: any) => {
    const [lng, lat] = f.center;
    const city = f.context?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.id?.startsWith("place.") || c.id?.startsWith("locality.")
    )?.text;
    const region = f.context?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.id?.startsWith("region.")
    )?.text;
    return {
      placeName: f.place_name,
      lat,
      lng,
      relevance: f.relevance ?? 0,
      city,
      region,
    };
  });
}

export interface KommuneInfo {
  kommunenummer: string;
  kommunenavn: string;
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
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    if (!data.kommunenummer) return null;
    return {
      kommunenummer: String(data.kommunenummer).padStart(4, "0"),
      kommunenavn: data.kommunenavn ?? "",
    };
  } catch {
    return null;
  }
}
