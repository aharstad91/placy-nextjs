import { NextRequest, NextResponse } from "next/server";

// Mapbox Directions API proxy
// Brukes for å beregne reisetider mellom prosjekt-sentrum og POI-er

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const profile = searchParams.get("profile") || "walking";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Origin and destination are required" },
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
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin};${destination}?access_token=${mapboxToken}&geometries=geojson&overview=full`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    // Returner forenklet respons
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return NextResponse.json({
        duration: Math.ceil(route.duration / 60), // Konverter til minutter
        distance: Math.round(route.distance), // Meter
        geometry: route.geometry,
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
