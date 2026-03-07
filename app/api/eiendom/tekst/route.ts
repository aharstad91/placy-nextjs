import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { calculateDistance } from "@/lib/utils/geo";

export const maxDuration = 30;

// --- Rate limiting ---
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// --- Input validation ---
const TekstRequestSchema = z.object({
  lat: z.number().min(57.5).max(71.5),
  lng: z.number().min(4.0).max(31.5),
  address: z.string().min(3).max(300),
  targetAudience: z.enum(["family", "young", "senior"]),
});

// --- Google Places types for nearby search ---
const GOOGLE_PLACE_TYPES: Record<string, string[]> = {
  family: ["school", "park", "playground", "grocery_or_supermarket", "doctor", "pharmacy", "gym"],
  young: ["restaurant", "cafe", "bar", "gym", "transit_station", "night_club"],
  senior: ["grocery_or_supermarket", "pharmacy", "doctor", "park", "bus_station", "library"],
};

interface NearbyPlace {
  name: string;
  type: string;
  distanceMeters: number;
  walkMinutes: number;
  rating?: number;
}

async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  audience: string
): Promise<NearbyPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const types = GOOGLE_PLACE_TYPES[audience] || GOOGLE_PLACE_TYPES.family;
  const allPlaces: NearbyPlace[] = [];
  const seenNames = new Set<string>();

  // Fetch for each type (max 3 concurrent to stay within limits)
  const typeBatches = [];
  for (let i = 0; i < types.length; i += 3) {
    typeBatches.push(types.slice(i, i + 3));
  }

  for (const batch of typeBatches) {
    const results = await Promise.all(
      batch.map(async (type) => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${apiKey}&language=no`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          return (data.results || []).slice(0, 5).map((p: { name: string; geometry: { location: { lat: number; lng: number } }; rating?: number }) => ({
            name: p.name,
            type,
            distanceMeters: calculateDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
            walkMinutes: Math.round(calculateDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng) / 80),
            rating: p.rating,
          }));
        } catch {
          return [];
        }
      })
    );

    for (const places of results) {
      for (const place of places) {
        if (!seenNames.has(place.name) && place.distanceMeters <= 2500) {
          seenNames.add(place.name);
          allPlaces.push(place);
        }
      }
    }
  }

  // Sort by distance
  return allPlaces.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function buildPrompt(
  address: string,
  audience: string,
  places: NearbyPlace[]
): string {
  const audienceLabel = {
    family: "Barnefamilie",
    young: "Ung / Førstegangskjøper",
    senior: "Senior",
  }[audience] || "Generell";

  const grouped = places.reduce<Record<string, NearbyPlace[]>>((acc, p) => {
    const key = p.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const poiText = Object.entries(grouped)
    .map(([type, pois]) =>
      `${type}:\n${pois.map((p) => `  - ${p.name} (${p.walkMinutes} min gange${p.rating ? `, ${p.rating}/5` : ""})`).join("\n")}`
    )
    .join("\n\n");

  return `Du er en tekstforfatter for eiendomsmeglere. Skriv en beliggenhetstekst for en bolig.

REGLER (ufravikelige):
1. Navngi, aldri generaliser — bruk konkrete stedsnavn, ikke "fine restauranter"
2. Mal bevegelse — beskriv en mental reise gjennom nabolaget
3. Bruk kontraster — "Rolig villastrøk, men bare 3 minutters gange til Bybanen"
4. Saklig entusiasme — fakta > adjektiver, ALDRI utropstegn
5. Sensorisk presisjon — material, sesong, lyd, lukt der relevant
6. Kun VERIFISERTE fakta — avstandene under er beregnet, bruk dem eksakt

ALDRI bruk: "Fantastisk", "Utrolig", "Du vil elske", "koselig", "hidden gem"
ALLTID bruk: konkrete stedsnavn, eksakte gangavstander, grunnlegger/årstall hvis kjent

ADRESSE: ${address}
MÅLGRUPPE: ${audienceLabel}

NÆRLIGGENDE STEDER (med gangavstand):
${poiText}

Skriv 3-4 avsnitt. Første setning skal fungere alene. Teksten skal passe i en FINN-annonse.
Bruk norsk bokmål. Skriv i tredjeperson (ikke "du").`;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "For mange forespørsler. Prøv igjen om en time." },
      { status: 429 }
    );
  }

  // Validate API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TekstRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { lat, lng, address, targetAudience } = parsed.data;

  // Fetch nearby places
  const places = await fetchNearbyPlaces(lat, lng, targetAudience);

  if (places.length === 0) {
    return NextResponse.json(
      { error: "Fant ingen steder i nærheten. Prøv en annen adresse." },
      { status: 404 }
    );
  }

  // Generate text with Claude
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: buildPrompt(address, targetAudience, places),
        },
      ],
    });

    const textBlock = message.content.find((c) => c.type === "text");
    const generatedText = textBlock?.text ?? "";

    return NextResponse.json({
      text: generatedText,
      poiCount: places.length,
    });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "Kunne ikke generere tekst. Prøv igjen." },
      { status: 500 }
    );
  }
}
