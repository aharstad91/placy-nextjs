import { z } from "zod";

import { localPlacesSchema } from "@/lib/demo/local-board/schema";

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const groupSchema = z.object({
  category: categorySchema,
  /** Board-temaet i det lokale datasettet kan være grovere enn standardens underkategori. */
  sourceCategoryId: z.string().min(1).optional(),
  placeIds: z.array(z.string().min(1)).min(1),
  markerImagePrefix: z.string().startsWith("/").optional(),
});

const optionsSchema = z.object({
  projectId: z.string().min(1),
  category: categorySchema.optional(),
  sourceCategoryId: z.string().min(1).optional(),
  placeIds: z.array(z.string().min(1)).min(1).optional(),
  markerImagePrefix: z.string().startsWith("/").optional(),
  groups: z.array(groupSchema).min(1).optional(),
}).superRefine((value, context) => {
  const legacyComplete = Boolean(value.category && value.placeIds);
  if (legacyComplete === Boolean(value.groups)) {
    context.addIssue({
      code: "custom",
      message: "Bruk enten category + placeIds eller groups",
    });
  }
});

export interface LocalBoardPoiPackage {
  categories: Array<{ id: string; name: string; icon: string; color: string }>;
  pois: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string | null;
    featured_image?: string;
    category_id: string;
    description: string;
    editorial_hook: string;
    story_priority: "must_have";
    poi_tier: 1;
    source: "audited_local_board";
    poi_metadata: {
      owner_project_id: string;
      local_board_place_id: string;
      knowledge_level: "audited";
      development_status: "planned" | "existing";
      location_precision: "sourced" | "approximate";
      location_note?: string;
      marker_image?: string;
    };
  }>;
}

/** Builds project-owned POIs for concepts that have no safe shared-pool identity. */
export function buildLocalBoardPoiPackage(
  placesInput: unknown,
  optionsInput: unknown,
): LocalBoardPoiPackage {
  const places = localPlacesSchema.parse(placesInput);
  const options = optionsSchema.parse(optionsInput);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const groups = options.groups ?? [{
    category: options.category!,
    sourceCategoryId: options.sourceCategoryId,
    placeIds: options.placeIds!,
    markerImagePrefix: options.markerImagePrefix,
  }];
  const selected = groups.flatMap((group) => group.placeIds.map((placeId) => {
      const place = placeById.get(placeId);
      if (!place) throw new Error(`Ukjent lokalt sted: ${placeId}`);
      const sourceCategoryId = group.sourceCategoryId ?? group.category.id;
      if (place.categoryId !== sourceCategoryId) {
        throw new Error(`${placeId} tilhører ${place.categoryId}, ikke ${sourceCategoryId}`);
      }
      if (place.knowledgeLevel !== "audited") {
        throw new Error(`${placeId} er registerdata og kan ikke promoteres`);
      }
      return { place, group };
    }));
  return {
    categories: groups.map((group) => group.category),
    pois: selected.map(({ place, group }) => ({
      id: `project:${options.projectId}:${place.id}`,
      name: place.name,
      lat: place.coordinates.lat,
      lng: place.coordinates.lng,
      address: place.address ?? null,
      ...(place.image ? { featured_image: place.image } : {}),
      category_id: group.category.id,
      description: place.summary,
      editorial_hook: place.summary,
      story_priority: "must_have",
      poi_tier: 1,
      source: "audited_local_board",
      poi_metadata: {
        owner_project_id: options.projectId,
        local_board_place_id: place.id,
        knowledge_level: "audited",
        development_status: place.status === "existing" ? "existing" : "planned",
        location_precision: place.locationPrecision,
        ...(place.locationNote ? { location_note: place.locationNote } : {}),
        ...(group.markerImagePrefix
          ? { marker_image: `${group.markerImagePrefix}${place.id}.webp` }
          : {}),
      },
    })),
  };
}
