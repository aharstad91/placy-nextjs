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

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get("stationId");
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");

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

    // Radius mode — aggregate across all stations within radius of (lat,lng)
    if (latParam && lngParam && radiusParam) {
      const lat = Number(latParam);
      const lng = Number(lngParam);
      const radius = Number(radiusParam);

      if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
        return NextResponse.json(
          { error: "Invalid lat/lng/radius parameters" },
          { status: 400 },
        );
      }

      const nearby = stations
        .map((status) => {
          const info = stationInfo.get(status.station_id);
          if (!info) return null;
          const distance = haversineMeters(lat, lng, info.lat, info.lon);
          return { status, info, distance };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null && s.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      const total = nearby.reduce((sum, s) => sum + s.status.num_bikes_available, 0);
      const totalDocks = nearby.reduce((sum, s) => sum + s.status.num_docks_available, 0);
      const nearest = nearby[0];

      return NextResponse.json({
        total,
        totalDocks,
        stations: nearby.length,
        nearest: nearest
          ? {
              stationId: nearest.status.station_id,
              name: nearest.info.name,
              availableBikes: nearest.status.num_bikes_available,
              availableDocks: nearest.status.num_docks_available,
              isOpen:
                nearest.status.is_installed === 1 && nearest.status.is_renting === 1,
              distance: Math.round(nearest.distance),
              walkMin: Math.max(1, Math.round(nearest.distance / 80)),
              coordinates: { lat: nearest.info.lat, lng: nearest.info.lon },
            }
          : null,
        breakdown: nearby.map((s) => ({
          stationId: s.status.station_id,
          name: s.info.name,
          availableBikes: s.status.num_bikes_available,
          capacity: s.info.capacity,
          distance: Math.round(s.distance),
        })),
        positions: nearby.map((s) => ({ lat: s.info.lat, lng: s.info.lon })),
        lastUpdated: new Date().toISOString(),
      });
    }

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
