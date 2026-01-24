import { NextRequest, NextResponse } from "next/server";

// Mapbox Matrix API proxy
// Calculates travel times from one origin to multiple destinations in a single request

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { origin, destinations, profile = "walking" } = body;

  if (!origin || !destinations || !Array.isArray(destinations)) {
    return NextResponse.json(
      { error: "Origin and destinations array are required" },
      { status: 400 }
    );
  }

  if (destinations.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Mapbox Matrix API has a limit of 25 coordinates per request
  if (destinations.length > 24) {
    return NextResponse.json(
      { error: "Maximum 24 destinations allowed per request" },
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

  // Map profile names to Mapbox profiles
  const profileMap: Record<string, string> = {
    walking: "walking",
    cycling: "cycling",
    driving: "driving",
    walk: "walking",
    bike: "cycling",
    car: "driving",
  };

  const mapboxProfile = profileMap[profile] || "walking";

  try {
    // Build coordinates string: origin first, then all destinations
    const coordinates = [
      `${origin.lng},${origin.lat}`,
      ...destinations.map(
        (d: { lat: number; lng: number }) => `${d.lng},${d.lat}`
      ),
    ].join(";");

    // Mapbox Matrix API URL
    // sources=0 means we only want times FROM the first coordinate (origin)
    // destinations=1;2;3... means we want times TO all other coordinates
    const destinationIndices = destinations
      .map((_: unknown, i: number) => i + 1)
      .join(";");

    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${mapboxProfile}/${coordinates}?access_token=${mapboxToken}&sources=0&destinations=${destinationIndices}&annotations=duration`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mapbox Matrix API error:", errorText);
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== "Ok") {
      throw new Error(`Mapbox API returned: ${data.code}`);
    }

    // Parse durations from the matrix response
    // durations is a 2D array, we want durations[0] (from origin to all destinations)
    const durations = data.durations?.[0] || [];

    const results = destinations.map(
      (dest: { lat: number; lng: number }, index: number) => ({
        destinationIndex: index,
        coordinates: dest,
        durationMinutes:
          durations[index] !== null
            ? Math.ceil(durations[index] / 60)
            : null,
      })
    );

    return NextResponse.json({
      profile: mapboxProfile,
      results,
    });
  } catch (error) {
    console.error("Travel times API error:", error);
    return NextResponse.json(
      { error: "Failed to calculate travel times" },
      { status: 500 }
    );
  }
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originParam = searchParams.get("origin");
  const destinationsParam = searchParams.get("destinations");
  const profile = searchParams.get("profile") || "walking";

  if (!originParam || !destinationsParam) {
    return NextResponse.json(
      { error: "Origin and destinations are required" },
      { status: 400 }
    );
  }

  // Parse origin (format: lat,lng)
  const [originLat, originLng] = originParam.split(",").map(Number);

  // Parse destinations (format: lat,lng;lat,lng;...)
  const destinations = destinationsParam.split(";").map((coord) => {
    const [lat, lng] = coord.split(",").map(Number);
    return { lat, lng };
  });

  // Create mock request body and call POST handler
  const mockBody = {
    origin: { lat: originLat, lng: originLng },
    destinations,
    profile,
  };

  // Reuse POST logic
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  const profileMap: Record<string, string> = {
    walking: "walking",
    cycling: "cycling",
    driving: "driving",
    walk: "walking",
    bike: "cycling",
    car: "driving",
  };

  const mapboxProfile = profileMap[profile] || "walking";

  try {
    const coordinates = [
      `${mockBody.origin.lng},${mockBody.origin.lat}`,
      ...mockBody.destinations.map((d) => `${d.lng},${d.lat}`),
    ].join(";");

    const destinationIndices = mockBody.destinations
      .map((_, i) => i + 1)
      .join(";");

    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${mapboxProfile}/${coordinates}?access_token=${mapboxToken}&sources=0&destinations=${destinationIndices}&annotations=duration`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== "Ok") {
      throw new Error(`Mapbox API returned: ${data.code}`);
    }

    const durations = data.durations?.[0] || [];

    const results = mockBody.destinations.map((dest, index) => ({
      destinationIndex: index,
      coordinates: dest,
      durationMinutes:
        durations[index] !== null ? Math.ceil(durations[index] / 60) : null,
    }));

    return NextResponse.json({
      profile: mapboxProfile,
      results,
    });
  } catch (error) {
    console.error("Travel times API error:", error);
    return NextResponse.json(
      { error: "Failed to calculate travel times" },
      { status: 500 }
    );
  }
}
