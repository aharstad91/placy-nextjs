import { z } from "zod";

import type { Json } from "@/lib/supabase/types";

const internalAssetPath = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9/_\-.]+$/, "asset-URL må være en intern absolutt sti")
  .refine(
    (path) => !path.split("/").some((segment) => segment === "." || segment === ".."),
    "asset-URL kan ikke inneholde relative segmenter",
  );
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const boardBrandInputSchema = z.object({
  assets: z.object({
    brand: z.literal(true),
    logoUrl: internalAssetPath,
    splashImageUrl: internalAssetPath,
    splashVideoUrl: internalAssetPath,
  }),
  presentation: z.object({
    initialView: z.enum(["splash", "revealed"]).optional(),
    brand: z.object({
      surfaceColor: hex,
      inkColor: hex,
      accentColor: hex,
      accentForegroundColor: hex,
      mutedColor: hex,
      mutedForegroundColor: hex,
      radius: z.string().regex(/^\d+(?:\.\d+)?(?:px|rem)$/),
      headingFontFamily: z.enum(["Mukta", "Unbounded", "Figtree"]),
      headingFontWeight: z.number().int().min(100).max(900),
    }),
  }),
});

export type BoardBrandInput = z.infer<typeof boardBrandInputSchema>;

export function mergeBoardBrandConfig(
  current: Record<string, Json | undefined>,
  input: BoardBrandInput,
): Json {
  const reportConfig = (current.reportConfig ?? {}) as Record<
    string,
    Json | undefined
  >;
  const currentAssets = (reportConfig.assets ?? {}) as Record<
    string,
    Json | undefined
  >;
  const currentPresentation = (reportConfig.presentation ?? {}) as Record<
    string,
    Json | undefined
  >;

  return {
    ...current,
    reportConfig: {
      ...reportConfig,
      assets: { ...currentAssets, ...input.assets },
      presentation: { ...currentPresentation, ...input.presentation },
    },
  } as Json;
}
