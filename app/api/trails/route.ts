import { NextRequest, NextResponse } from "next/server";
import { fetchTrails } from "@/lib/generators/trail-fetcher";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";

// Overpass API proxy — fetches hiking/cycling/walking trails as GeoJSON
// Used by Report trail overlay and generate-story pipeline

// Audit-fiks 2026-07-06: per-IP rate-limit på offentlig Overpass-proxy.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

// Maks radius mot Overpass — ubegrenset query kan hente store mengder OSM-data.
const MAX_RADIUS_KM = 20;

export async function GET(request: NextRequest) {
  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const searchParams = request.nextUrl.searchParams;
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const radiusKmStr = searchParams.get("radiusKm");
  const typesStr = searchParams.get("types");

  // Validate required params
  if (!latStr || !lngStr) {
    return NextResponse.json(
      { error: "lat and lng query parameters are required" },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng must be valid numbers" },
      { status: 400 }
    );
  }

  const radiusKmRaw = radiusKmStr ? parseFloat(radiusKmStr) : 3;

  if (isNaN(radiusKmRaw) || radiusKmRaw <= 0) {
    return NextResponse.json(
      { error: "radiusKm must be a positive number" },
      { status: 400 }
    );
  }

  // Clamp til maks 20 km — stopper unbounded Overpass-query.
  const radiusKm = Math.min(radiusKmRaw, MAX_RADIUS_KM);

  // Parse types (comma-separated), default to all
  const validTypes = new Set(["bicycle", "hiking", "foot"]);
  let types: ("bicycle" | "hiking" | "foot")[] | undefined;

  if (typesStr) {
    const parsed = typesStr.split(",").map((t) => t.trim());
    const invalid = parsed.filter((t) => !validTypes.has(t));

    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid route types: ${invalid.join(", ")}. Valid types: bicycle, hiking, foot` },
        { status: 400 }
      );
    }

    types = parsed as ("bicycle" | "hiking" | "foot")[];
  }

  try {
    const geojson = await fetchTrails({ lat, lng, radiusKm, types });

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control":
          "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Trails API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch trails";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
