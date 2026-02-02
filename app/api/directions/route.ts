import { NextRequest, NextResponse } from "next/server";

// Mapbox Directions API proxy
// Brukes for å beregne reisetider mellom prosjekt-sentrum og POI-er
// Supports both origin/destination and multi-waypoint (waypoints) formats

export async function GET(request: NextRequest) {
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
    // Mapbox Directions API URL
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;

    const response = await fetch(url);

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
