import { NextRequest, NextResponse } from "next/server";

// Google Places API proxy
// Brukes for å hente POI-detaljer som åpningstider, bilder, og anmeldelser

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get("placeId");
  const fields = searchParams.get("fields") || "name,rating,user_ratings_total,opening_hours,photos";

  if (!placeId) {
    return NextResponse.json(
      { error: "placeId is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Google Places Details API URL
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "OK" && data.result) {
      const place = data.result;
      return NextResponse.json({
        name: place.name,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        openingHours: place.opening_hours?.weekday_text,
        isOpen: place.opening_hours?.open_now,
        photos: place.photos?.map((photo: { photo_reference: string }) => ({
          reference: photo.photo_reference,
          url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${apiKey}`,
        })),
      });
    }

    return NextResponse.json(
      { error: "Place not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Places API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}

// Søk etter steder i nærheten
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat, lng, radius = 1000, type = "restaurant" } = body;

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Google Places Nearby Search API URL
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "OK" && data.results) {
      return NextResponse.json({
        places: data.results.map((place: {
          place_id: string;
          name: string;
          geometry: { location: { lat: number; lng: number } };
          rating?: number;
          user_ratings_total?: number;
          types?: string[];
        }) => ({
          placeId: place.place_id,
          name: place.name,
          coordinates: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          types: place.types,
        })),
      });
    }

    return NextResponse.json({
      places: [],
    });
  } catch (error) {
    console.error("Places API error:", error);
    return NextResponse.json(
      { error: "Failed to search places" },
      { status: 500 }
    );
  }
}
