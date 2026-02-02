import { z } from "zod";
import {
  createGuideStopId,
  createPOIId,
  type GuideConfig,
  type GuideStopConfig,
  type NonEmptyArray,
} from "@/lib/types";
import { GuideError } from "@/lib/errors/guide-errors";

const GuideStopConfigSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  nameOverride: z.string().optional(),
  descriptionOverride: z.string().optional(),
  imageUrlOverride: z.string().url().optional(),
  transitionText: z.string().optional(),
});

const GuideConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  difficulty: z.enum(["easy", "moderate", "challenging"]).optional(),
  stops: z.array(GuideStopConfigSchema).min(1),
  precomputedDistanceMeters: z.number().positive().optional(),
  precomputedDurationMinutes: z.number().positive().optional(),
});

export function parseGuideConfig(data: unknown): GuideConfig {
  const result = GuideConfigSchema.safeParse(data);

  if (!result.success) {
    throw new GuideError(
      `Invalid guide config: ${result.error.message}`,
      "INVALID_GUIDE_CONFIG"
    );
  }

  const parsed = result.data;

  return {
    ...parsed,
    stops: parsed.stops.map((stop) => ({
      ...stop,
      id: createGuideStopId(stop.id),
      poiId: createPOIId(stop.poiId),
    })) as NonEmptyArray<GuideStopConfig>,
  };
}
