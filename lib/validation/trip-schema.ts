import { z } from "zod";
import {
  createTripStopId,
  createPOIId,
  type TripConfig,
  type TripStopConfig,
  type NonEmptyArray,
} from "@/lib/types";
import { TripError } from "@/lib/errors/trip-errors";

const TripStopConfigSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  nameOverride: z.string().optional(),
  descriptionOverride: z.string().optional(),
  imageUrlOverride: z.string().url().optional(),
  transitionText: z.string().optional(),
});

const TripConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  difficulty: z.enum(["easy", "moderate", "challenging"]).optional(),
  stops: z.array(TripStopConfigSchema).min(1),
  precomputedDistanceMeters: z.number().positive().optional(),
  precomputedDurationMinutes: z.number().positive().optional(),
});

export function parseTripConfig(data: unknown): TripConfig {
  const result = TripConfigSchema.safeParse(data);

  if (!result.success) {
    throw new TripError(
      `Invalid trip config: ${result.error.message}`,
      "INVALID_TRIP_CONFIG"
    );
  }

  const parsed = result.data;

  return {
    ...parsed,
    stops: parsed.stops.map((stop) => ({
      ...stop,
      id: createTripStopId(stop.id),
      poiId: createPOIId(stop.poiId),
    })) as NonEmptyArray<TripStopConfig>,
  };
}
