import { NextRequest, NextResponse } from "next/server";

// Trondheim Bysykkel GBFS API
const STATION_STATUS_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_status.json";
const STATION_INFO_URL =
  "https://gbfs.urbansharing.com/trondheimbysykkel.no/station_information.json";

interface StationStatus {
  station_id: string;
  num_bikes_available: number;
  num_docks_available: number;
  is_installed: number;
  is_renting: number;
  is_returning: number;
  last_reported: number;
}

interface StationInfo {
  station_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
}

// Cache for station info (rarely changes)
let stationInfoCache: Map<string, StationInfo> | null = null;
let stationInfoCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getStationInfo(): Promise<Map<string, StationInfo>> {
  const now = Date.now();

  if (stationInfoCache && now - stationInfoCacheTime < CACHE_TTL) {
    return stationInfoCache;
  }

  const response = await fetch(STATION_INFO_URL, {
    headers: {
      "Client-Identifier": "placy-neighborhood-stories",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch station info: ${response.status}`);
  }

  const data = await response.json();
  const stations = data.data?.stations || [];

  stationInfoCache = new Map();
  for (const station of stations) {
    stationInfoCache.set(station.station_id, station);
  }
  stationInfoCacheTime = now;

  return stationInfoCache;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get("stationId");

  try {
    // Fetch current station status
    const statusResponse = await fetch(STATION_STATUS_URL, {
      headers: {
        "Client-Identifier": "placy-neighborhood-stories",
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to fetch station status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const stations: StationStatus[] = statusData.data?.stations || [];

    // Get station info for names and locations
    const stationInfo = await getStationInfo();

    if (stationId) {
      // Return single station
      const status = stations.find((s) => s.station_id === stationId);

      if (!status) {
        return NextResponse.json(
          { error: "Station not found" },
          { status: 404 }
        );
      }

      const info = stationInfo.get(stationId);

      return NextResponse.json({
        stationId: status.station_id,
        name: info?.name || "Unknown",
        availableBikes: status.num_bikes_available,
        availableDocks: status.num_docks_available,
        isOpen: status.is_installed === 1 && status.is_renting === 1,
        capacity: info?.capacity,
        coordinates: info
          ? { lat: info.lat, lng: info.lon }
          : null,
        lastUpdated: new Date(status.last_reported * 1000).toISOString(),
      });
    }

    // Return all stations
    const allStations = stations.map((status) => {
      const info = stationInfo.get(status.station_id);
      return {
        stationId: status.station_id,
        name: info?.name || "Unknown",
        availableBikes: status.num_bikes_available,
        availableDocks: status.num_docks_available,
        isOpen: status.is_installed === 1 && status.is_renting === 1,
        capacity: info?.capacity,
        coordinates: info
          ? { lat: info.lat, lng: info.lon }
          : null,
      };
    });

    return NextResponse.json({
      stations: allStations,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Bysykkel API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bike availability" },
      { status: 500 }
    );
  }
}
