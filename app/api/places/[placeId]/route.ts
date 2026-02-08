import { NextRequest, NextResponse } from "next/server";
import { fetchPlaceDetails, type PlaceDetails } from "@/lib/google-places/fetch-place-details";

// Google Places API proxy with caching

interface CacheEntry {
  data: PlaceDetails;
  timestamp: number;
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
    const placeDetails = await fetchPlaceDetails(placeId, apiKey);

    if (!placeDetails) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

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
