import { NextRequest, NextResponse } from "next/server";

// Mapbox Geocoding API proxy
// Søk: /api/geocode?q=Storgata+1,+Oslo
// Reverse: /api/geocode?lat=59.9139&lng=10.7522

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 });
  }

  try {
    let url: string;

    if (query) {
      // Forward geocoding (address → coordinates)
      url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=NO&limit=5&language=no`;
    } else if (lat && lng) {
      // Reverse geocoding (coordinates → address)
      url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=no`;
    } else {
      return NextResponse.json(
        { error: "Missing query parameter. Use ?q=address or ?lat=...&lng=..." },
        { status: 400 }
      );
    }

    const res = await fetch(url);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
