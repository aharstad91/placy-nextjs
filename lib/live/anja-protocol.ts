import { z } from "zod";
import { LIVE_VOICES } from "@/lib/live/voices";

export const boardIdentitySchema = z.object({
  customer: z.string().min(1).max(120),
  projectSlug: z.string().min(1).max(160),
  contentVersion: z.string().regex(/^[a-f0-9]{64}$/),
});

export const startBoardSessionSchema = boardIdentitySchema.extend({
  voice: z.enum(LIVE_VOICES).optional(),
  sdp: z.string().startsWith("v=0").max(32_000),
});

export const liveContextSchema = z.union([
  z.object({ kind: z.literal("theme"), id: z.string().max(120), label: z.string().max(120).optional() }),
  z.object({ kind: z.literal("place"), id: z.string().max(120), name: z.string().max(160).optional() }),
  z.object({
    kind: z.literal("state"),
    selected_category_id: z.string().max(120).nullable(),
    selected_place_id: z.string().max(120).nullable(),
    travel_mode: z.string().max(20),
    revealed_place_ids: z.array(z.string().max(120)).max(500).optional(),
  }),
  z.object({ kind: z.literal("text"), text: z.string().max(2_000) }),
]);

export const mapResultSchema = z.object({
  id: z.string().max(120),
  output: z.unknown(),
});

export type BoardIdentity = z.infer<typeof boardIdentitySchema>;
export type StartBoardSession = z.infer<typeof startBoardSessionSchema>;
