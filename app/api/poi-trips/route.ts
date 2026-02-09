import { NextRequest, NextResponse } from "next/server";
import { getTripsByPoiIdAsync } from "@/lib/data-server";

export async function GET(request: NextRequest) {
  const poiId = request.nextUrl.searchParams.get("poiId");

  if (!poiId) {
    return NextResponse.json({ error: "poiId required" }, { status: 400 });
  }

  const trips = await getTripsByPoiIdAsync(poiId);
  return NextResponse.json(trips);
}
