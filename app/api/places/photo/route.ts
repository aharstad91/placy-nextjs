import { NextRequest, NextResponse } from "next/server";

// Google Place Photo proxy
// Proxies photo requests to avoid exposing API key to client

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const photoReference = searchParams.get("photoReference");
  const maxWidth = searchParams.get("maxWidth") || "400";

  if (!photoReference) {
    return NextResponse.json(
      { error: "photoReference is required" },
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
    // Google Places Photo API URL
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Places Photo API error: ${response.status}`);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with long cache headers (30 days)
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=2592000", // 30 days
        "CDN-Cache-Control": "public, max-age=2592000",
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
