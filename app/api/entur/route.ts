import { NextRequest, NextResponse } from "next/server";

// Entur JourneyPlanner API for sanntidsdata og reiseplanlegging
// Dokumentasjon: https://developer.entur.org/

const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";

// GraphQL query for å hente avganger fra en holdeplass
const DEPARTURES_QUERY = `
  query GetDepartures($stopPlaceId: String!, $numberOfDepartures: Int!) {
    stopPlace(id: $stopPlaceId) {
      id
      name
      estimatedCalls(numberOfDepartures: $numberOfDepartures) {
        expectedDepartureTime
        actualDepartureTime
        realtime
        destinationDisplay {
          frontText
        }
        serviceJourney {
          line {
            id
            publicCode
            transportMode
            presentation {
              colour
              textColour
            }
          }
        }
      }
    }
  }
`;

// GraphQL query for reiseplanlegging
const TRIP_QUERY = `
  query GetTrip($from: Location!, $to: Location!, $numTripPatterns: Int!) {
    trip(from: $from, to: $to, numTripPatterns: $numTripPatterns) {
      tripPatterns {
        duration
        walkDistance
        legs {
          mode
          distance
          duration
          fromPlace {
            name
          }
          toPlace {
            name
          }
          line {
            publicCode
            name
            transportMode
          }
        }
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stopPlaceId = searchParams.get("stopPlaceId");
  const numberOfDepartures = parseInt(searchParams.get("limit") || "5");

  if (!stopPlaceId) {
    return NextResponse.json(
      { error: "stopPlaceId is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(ENTUR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "placy-neighborhood-stories",
      },
      body: JSON.stringify({
        query: DEPARTURES_QUERY,
        variables: {
          stopPlaceId,
          numberOfDepartures,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Entur API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || "GraphQL error");
    }

    const stopPlace = data.data?.stopPlace;
    if (!stopPlace) {
      return NextResponse.json(
        { error: "Stop place not found" },
        { status: 404 }
      );
    }

    // Formater avgangene
    const departures = stopPlace.estimatedCalls?.map((call: {
      expectedDepartureTime: string;
      actualDepartureTime: string | null;
      realtime: boolean;
      destinationDisplay: { frontText: string };
      serviceJourney: {
        line: {
          publicCode: string;
          transportMode: string;
          presentation: { colour: string; textColour: string };
        };
      };
    }) => ({
      departureTime: call.actualDepartureTime || call.expectedDepartureTime,
      isRealtime: call.realtime,
      destination: call.destinationDisplay?.frontText,
      lineCode: call.serviceJourney?.line?.publicCode,
      transportMode: call.serviceJourney?.line?.transportMode,
      lineColor: call.serviceJourney?.line?.presentation?.colour,
    })) || [];

    return NextResponse.json({
      stopPlace: {
        id: stopPlace.id,
        name: stopPlace.name,
      },
      departures,
    });
  } catch (error) {
    console.error("Entur API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch departures" },
      { status: 500 }
    );
  }
}

// POST for reiseplanlegging
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fromLat, fromLng, toLat, toLng, numTrips = 3 } = body;

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json(
      { error: "from and to coordinates are required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(ENTUR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ET-Client-Name": "placy-neighborhood-stories",
      },
      body: JSON.stringify({
        query: TRIP_QUERY,
        variables: {
          from: {
            coordinates: {
              latitude: fromLat,
              longitude: fromLng,
            },
          },
          to: {
            coordinates: {
              latitude: toLat,
              longitude: toLng,
            },
          },
          numTripPatterns: numTrips,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Entur API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || "GraphQL error");
    }

    const tripPatterns = data.data?.trip?.tripPatterns || [];

    // Formater reisealternativene
    const trips = tripPatterns.map((pattern: {
      duration: number;
      walkDistance: number;
      legs: Array<{
        mode: string;
        distance: number;
        duration: number;
        fromPlace: { name: string };
        toPlace: { name: string };
        line: { publicCode: string; name: string; transportMode: string } | null;
      }>;
    }) => ({
      duration: Math.ceil(pattern.duration / 60), // Minutter
      walkDistance: Math.round(pattern.walkDistance),
      legs: pattern.legs.map((leg) => ({
        mode: leg.mode,
        distance: Math.round(leg.distance),
        duration: Math.ceil(leg.duration / 60),
        from: leg.fromPlace?.name,
        to: leg.toPlace?.name,
        lineCode: leg.line?.publicCode,
        lineName: leg.line?.name,
      })),
    }));

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("Entur API error:", error);
    return NextResponse.json(
      { error: "Failed to plan trip" },
      { status: 500 }
    );
  }
}
