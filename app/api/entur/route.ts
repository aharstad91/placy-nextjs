import { NextRequest, NextResponse } from "next/server";
import { EnturClientError, fetchEnturDepartures, planEnturTrip } from "@/lib/entur/client";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

const errorResponse = (error: unknown, fallback: string) => {
  if (error instanceof EnturClientError && error.code === "not_found") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error("Entur API error:", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
};

export async function GET(request: NextRequest) {
  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const stopPlaceId = request.nextUrl.searchParams.get("stopPlaceId");
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "5", 10);
  if (!stopPlaceId) return NextResponse.json({ error: "stopPlaceId is required" }, { status: 400 });
  try {
    return NextResponse.json(await fetchEnturDepartures(stopPlaceId, limit));
  } catch (error) {
    return errorResponse(error, "Failed to fetch departures");
  }
}

export async function POST(request: NextRequest) {
  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = await request.json();
  const { fromLat, fromLng, toLat, toLng, numTrips = 3 } = body;
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "from and to coordinates are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await planEnturTrip(
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
      numTrips,
    ));
  } catch (error) {
    return errorResponse(error, "Failed to plan trip");
  }
}
