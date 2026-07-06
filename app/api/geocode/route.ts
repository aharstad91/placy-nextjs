import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";
import { geocodeAddress } from "@/lib/pipeline/geocode";

// Mapbox Geocoding v6-proxy for adresse-autocomplete (bead aod, Beslutning #13-
// oppfølging): runtime-banen deler nå v6-implementasjonen med pipelinen
// (lib/pipeline/geocode.ts) — ingen provider-divergens.
// Søk: /api/geocode?q=Storgata+1,+Oslo
//
// Responskontrakt mot konsumentene (ReportAddressInput/AddressAutocomplete) er
// den minimale formen { features: [{ id, place_name, center }] } — v6-treff
// mappes hit så klientene er uendret.
//
// Reverse-banen (?lat=&lng=) hadde null konsumenter og er fjernet.

// Uautentisert proxy mot betalt Mapbox-API — samme per-IP-grense som
// directions/travel-times (DECISIONS-QUEUE #2). Autocomplete er debounced
// klientside; 60/min dekker legitim skriving med god margin.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter. Use ?q=address" },
      { status: 400 }
    );
  }

  try {
    const results = await geocodeAddress(query);
    return NextResponse.json({
      features: results.map((r, i) => ({
        id: `geocode-v6-${i}`,
        place_name: r.placeName,
        center: [r.lng, r.lat] as [number, number],
      })),
    });
  } catch (error) {
    console.error(
      "Geocoding error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
