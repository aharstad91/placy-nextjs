import { NextRequest, NextResponse } from "next/server";

// Google Place Photo proxy
// Proxies photo requests to avoid exposing API key to client
// NOTE: This is a legacy fallback. New imports use Places API (New)
// and store CDN URLs directly. This proxy is still needed for
// components that fallback to photoReference when featuredImage is null.

const PHOTO_REF_PATTERN = /^[A-Za-z0-9_-]{1,500}$/;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const photoReference = searchParams.get("photoReference");
  const maxWidthParam = searchParams.get("maxWidth") || "400";

  if (!photoReference || !PHOTO_REF_PATTERN.test(photoReference)) {
    return NextResponse.json(
      { error: "Valid photoReference is required" },
      { status: 400 }
    );
  }

  const maxWidth = Math.min(Math.max(Number(maxWidthParam) || 400, 1), 1600);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Places Photo API error: ${response.status}`);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with long cache headers (30 days)
    // s-maxage for Vercel CDN, stale-while-revalidate for instant revalidation
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Places Photo API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch photo" },
      { status: 500 }
    );
  }
}
