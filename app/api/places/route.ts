import { NextRequest, NextResponse } from "next/server";

// Google Places API proxy
// Brukes for å hente POI-detaljer som åpningstider, bilder, og anmeldelser

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;
const ALLOWED_FIELDS = new Set([
  "name", "rating", "user_ratings_total", "opening_hours", "photos",
  "formatted_address", "formatted_phone_number", "website", "price_level",
  "reviews", "geometry", "types", "business_status",
]);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get("placeId");
  const fieldsParam = searchParams.get("fields") || "name,rating,user_ratings_total,opening_hours,photos";

  if (!placeId || !PLACE_ID_PATTERN.test(placeId)) {
    return NextResponse.json(
      { error: "Valid placeId is required" },
      { status: 400 }
    );
  }

  // Validate and filter requested fields
  const fields = fieldsParam.split(",").filter((f) => ALLOWED_FIELDS.has(f.trim())).join(",");
  if (!fields) {
    return NextResponse.json(
      { error: "No valid fields requested" },
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
const ALLOWED_PLACE_TYPES = new Set([
  "restaurant", "cafe", "bar", "bakery", "gym", "spa", "museum",
  "art_gallery", "library", "park", "hotel", "lodging", "pharmacy",
  "hair_care", "beauty_salon", "shopping_mall", "store", "supermarket",
  "tourist_attraction", "church", "movie_theater", "night_club",
]);

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const { lat, lng, radius = 1000, type = "restaurant" } = body;

  // Validate lat/lng as numbers within valid bounds
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
    return NextResponse.json(
      { error: "lat must be a number between -90 and 90" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
    return NextResponse.json(
      { error: "lng must be a number between -180 and 180" },
      { status: 400 }
    );
  }

  // Validate radius
  const parsedRadius = Number(radius);
  if (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 50000) {
    return NextResponse.json(
      { error: "radius must be between 1 and 50000" },
      { status: 400 }
    );
  }

  // Validate type against allowlist
  if (typeof type !== "string" || !ALLOWED_PLACE_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Invalid place type" },
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
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${parsedLat},${parsedLng}&radius=${parsedRadius}&type=${type}&key=${apiKey}`;

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
