import { NextRequest, NextResponse } from "next/server";

// Entur Mobility v2 API for Hyre car-sharing data
// Uses same infrastructure as scripts/import-hyre-stations.ts

const ENTUR_MOBILITY_URL = "https://api.entur.io/mobility/v2/graphql";

const STATION_QUERY = `
  query GetHyreStation($lat: Float!, $lon: Float!, $range: Int!) {
    stations(
      lat: $lat
      lon: $lon
      range: $range
      availableFormFactors: [CAR]
      systems: ["hyrenorge"]
    ) {
      id
      name {
        translation {
          value
        }
      }
      numVehiclesAvailable
    }
  }
`;

// Validate stationId format (alphanumeric, colons, hyphens, underscores)
const STATION_ID_PATTERN = /^[A-Za-z0-9:_-]+$/;

export async function GET(request: NextRequest) {
  const stationId = request.nextUrl.searchParams.get("stationId");

  if (!stationId) {
    return NextResponse.json({ error: "stationId is required" }, { status: 400 });
  }

  if (!STATION_ID_PATTERN.test(stationId)) {
    return NextResponse.json({ error: "Invalid stationId format" }, { status: 400 });
  }

  try {
    // Entur Mobility API doesn't support querying by station ID directly.
    // We query all Hyre stations within a wide range and filter by ID.
    // In practice this is fast (<500ms) and returns ~10-20 stations.
    const response = await fetch(ENTUR_MOBILITY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "placy-neighborhood-stories",
      },
      body: JSON.stringify({
        query: STATION_QUERY,
        variables: {
          lat: 63.43,  // Trondheim center
          lon: 10.4,
          range: 15000,
        },
      }),
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      throw new Error(`Entur Mobility API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || "GraphQL error");
    }

    const stations = data.data?.stations || [];
    const station = stations.find((s: { id: string }) => s.id === stationId);

    if (!station) {
      return NextResponse.json({ error: "Station not found" }, { status: 404 });
    }

    return NextResponse.json({
      stationName: station.name?.translation?.[0]?.value || "Unknown",
      numVehiclesAvailable: station.numVehiclesAvailable ?? 0,
    });
  } catch (error) {
    console.error("Hyre API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicle availability" },
      { status: 500 }
    );
  }
}
