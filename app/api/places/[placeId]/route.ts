import { NextRequest, NextResponse } from "next/server";

// Google Places API proxy with caching
// Fetches place details including rating, reviews, photos, website, phone, and opening hours

interface CacheEntry {
  data: PlaceDetails;
  timestamp: number;
}

interface PlaceDetails {
  rating?: number;
  reviewCount?: number;
  photos?: Array<{
    reference: string;
    url: string;
  }>;
  website?: string;
  phone?: string;
  openingHours?: string[];
  isOpen?: boolean;
}

// In-memory cache (24 hour TTL)
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function cleanCache() {
  const now = Date.now();
  cache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const { placeId } = await params;

  if (!placeId) {
    return NextResponse.json(
      { error: "placeId is required" },
      { status: 400 }
    );
  }

  // Clean expired cache entries periodically
  if (Math.random() < 0.1) {
    cleanCache();
  }

  // Check cache first
  const cached = cache.get(placeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Fields to fetch from Google Places API
    const fields = [
      "rating",
      "user_ratings_total",
      "photos",
      "website",
      "formatted_phone_number",
      "opening_hours",
    ].join(",");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.result) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

    const place = data.result;

    const placeDetails: PlaceDetails = {
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      photos: place.photos?.slice(0, 5).map((photo: { photo_reference: string }) => ({
        reference: photo.photo_reference,
        url: `/api/places/photo?photoReference=${photo.photo_reference}&maxWidth=400`,
      })),
      website: place.website,
      phone: place.formatted_phone_number,
      openingHours: place.opening_hours?.weekday_text,
      isOpen: place.opening_hours?.open_now,
    };

    // Store in cache
    cache.set(placeId, {
      data: placeDetails,
      timestamp: Date.now(),
    });

    return NextResponse.json(placeDetails, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Places API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}
