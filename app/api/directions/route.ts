import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";
// Audit-fiks 2026-07-05: oppstrøms-API uten timeout holder rute-funksjonen
// åpen ubestemt ved treg leverandør (connection-utsulting under last).
const UPSTREAM_TIMEOUT_MS = 8000;

// Audit-fiks 2026-07-05 (DECISIONS-QUEUE #2): uautentisert proxy mot betalt
// Mapbox-API trenger per-IP-grense. 60/min er romslig for legitim board-bruk
// (initial-load fyrer ~10-20 kall), men stopper kvote-tapping.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });


// Mapbox Directions API proxy — eierskap: PRD 11 (data-lag); PRD 6 eier polyline-render.
// Eierskap: /api/directions + useRouteData → PRD 11; BoardPathLayer/RouteLayer3D → PRD 6.
//
// MAPBOX TOKEN-SIKKERHET: access_token sendes som URL-querystring — dette er IKKE et
// hemmelig-nøkkel-brudd. NEXT_PUBLIC_MAPBOX_TOKEN er bevisst offentlig/klient-eksponert
// og finnes allerede i nettleserbundlet. Mapbox Directions/Matrix støtter KUN query-param-auth
// (ingen Authorization-header). Ekte hardening = URL-restriksjoner + scope-begrensning i
// Mapbox-kontrollpanelet. Proxy-garantien: logg aldri full request-URL med token.

export async function GET(request: NextRequest) {
  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const waypoints = searchParams.get("waypoints"); // Format: "lng,lat;lng,lat;..."
  const modeParam = searchParams.get("profile") || searchParams.get("mode") || "walking";
  // Map short names to Mapbox profile names
  const profileMap: Record<string, string> = {
    walk: "walking",
    bike: "cycling",
    car: "driving",
    walking: "walking",
    cycling: "cycling",
    driving: "driving",
  };
  const profile = profileMap[modeParam] || "walking";

  // Build coordinates string - either from waypoints or origin/destination
  let coordinates: string;
  if (waypoints) {
    // Multi-waypoint format (for Guide)
    coordinates = waypoints;
  } else if (origin && destination) {
    // Origin/destination format (legacy)
    coordinates = `${origin};${destination}`;
  } else {
    return NextResponse.json(
      { error: "Either waypoints or origin/destination are required" },
      { status: 400 }
    );
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  try {
    // access_token i URL er Mapbox-kontrakten for offentlige tokens (se kommentar øverst).
    // Logg aldri `url`-variabelen — den inneholder tokenet i querystring.
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    // Return response with routes array for compatibility with GuidePage
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return NextResponse.json({
        duration: Math.ceil(route.duration / 60), // Konverter til minutter
        distance: Math.round(route.distance), // Meter
        geometry: route.geometry,
        // Include full routes array for Guide component
        routes: data.routes.map((r: { duration: number; distance: number; geometry: object }) => ({
          duration: Math.ceil(r.duration / 60),
          distance: Math.round(r.distance),
          geometry: r.geometry,
        })),
      });
    }

    return NextResponse.json(
      { error: "No route found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Directions API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch directions" },
      { status: 500 }
    );
  }
}
