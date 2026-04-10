import { NextRequest, NextResponse } from "next/server";

/**
 * Aggregates free-floating micromobility vehicles from Entur Mobility v2 API.
 * Returns total count + per-operator breakdown for scooters/bikes near a location.
 *
 * GET /api/mobility?lat=63.42&lng=10.45&radius=750&formFactors=SCOOTER,SCOOTER_STANDING
 */

const ENTUR_MOBILITY_URL = "https://api.entur.io/mobility/v2/graphql";

const VEHICLES_QUERY = `
  query GetVehicles($lat: Float!, $lon: Float!, $range: Int!, $formFactors: [FormFactor!]) {
    vehicles(
      lat: $lat
      lon: $lon
      range: $range
      formFactors: $formFactors
    ) {
      id
      lat
      lon
      system {
        id
        name {
          translation {
            value
          }
        }
      }
    }
  }
`;

const MAX_RADIUS = 2000;
const DEFAULT_RADIUS = 750;
const VALID_FORM_FACTORS = new Set([
  "BICYCLE",
  "CARGO_BICYCLE",
  "CAR",
  "MOPED",
  "SCOOTER",
  "SCOOTER_STANDING",
  "SCOOTER_SEATED",
  "OTHER",
]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parseFloat(params.get("lat") || "");
  const lng = parseFloat(params.get("lng") || "");
  const radius = Math.min(parseInt(params.get("radius") || String(DEFAULT_RADIUS), 10), MAX_RADIUS);
  const formFactorsParam = params.get("formFactors") || "SCOOTER,SCOOTER_STANDING";

  if (isNaN(lat) || isNaN(lng) || lat < 57 || lat > 72 || lng < 4 || lng > 32) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  if (isNaN(radius) || radius < 100) {
    return NextResponse.json({ error: "Invalid radius (min 100m)" }, { status: 400 });
  }

  const formFactors = formFactorsParam.split(",").filter((f) => VALID_FORM_FACTORS.has(f));
  if (formFactors.length === 0) {
    return NextResponse.json({ error: "No valid formFactors" }, { status: 400 });
  }

  try {
    const response = await fetch(ENTUR_MOBILITY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "placy-neighborhood-stories",
      },
      body: JSON.stringify({
        query: VEHICLES_QUERY,
        variables: {
          lat,
          lon: lng,
          range: radius,
          formFactors,
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

    const vehicles = data.data?.vehicles || [];

    // Aggregate by operator
    const byOperator: Record<string, { name: string; count: number }> = {};
    for (const v of vehicles) {
      const systemId = v.system?.id || "unknown";
      const systemName = v.system?.name?.translation?.[0]?.value || systemId;
      if (!byOperator[systemId]) {
        byOperator[systemId] = { name: systemName, count: 0 };
      }
      byOperator[systemId].count++;
    }

    // Sort by count descending
    const operators = Object.entries(byOperator)
      .map(([systemId, info]) => ({ systemId, ...info }))
      .sort((a, b) => b.count - a.count);

    // Vehicle positions for map rendering
    const positions = vehicles.map((v: { lat: number; lon: number }) => ({
      lat: v.lat,
      lng: v.lon,
    }));

    return NextResponse.json({
      total: vehicles.length,
      byOperator: operators,
      positions,
      radius,
      formFactors,
    });
  } catch (error) {
    console.error("Mobility API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mobility data" },
      { status: 500 },
    );
  }
}
