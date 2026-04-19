/**
 * Intern request/response-shape for Gemini generateContent API med google_search-
 * tool. Kun feltene vi faktisk bruker — API-et har flere enn disse.
 *
 * Validerer via Zod ved parse-tid. Kast ved uventet shape — script-siden
 * tåler per-kategori-feil (Promise.allSettled).
 */

import { z } from "zod";

export const GroundingChunkSchema = z.object({
  web: z
    .object({
      uri: z.string().url(),
      title: z.string().optional(),
    })
    .optional(),
});

export const SearchEntryPointSchema = z.object({
  renderedContent: z.string().min(1),
});

export const GroundingMetadataSchema = z.object({
  groundingChunks: z.array(GroundingChunkSchema).default([]),
  webSearchQueries: z.array(z.string()).default([]),
  searchEntryPoint: SearchEntryPointSchema,
});

export const GeminiCandidateSchema = z.object({
  content: z.object({
    parts: z.array(z.object({ text: z.string().optional() })),
  }),
  groundingMetadata: GroundingMetadataSchema.optional(),
});

export const GeminiResponseSchema = z.object({
  candidates: z.array(GeminiCandidateSchema).min(1),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;
export type GroundingMetadata = z.infer<typeof GroundingMetadataSchema>;
