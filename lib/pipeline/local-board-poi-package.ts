import { z } from "zod";

import { localPlacesSchema } from "@/lib/demo/local-board/schema";

const optionsSchema = z.object({
  projectId: z.string().min(1),
  category: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  placeIds: z.array(z.string().min(1)).min(1),
  markerImagePrefix: z.string().startsWith("/"),
});

export interface LocalBoardPoiPackage {
  category: { id: string; name: string; icon: string; color: string };
  pois: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string | null;
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
      marker_image: string;
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
  const selected = options.placeIds.map((placeId) => {
    const place = placeById.get(placeId);
    if (!place) throw new Error(`Ukjent lokalt sted: ${placeId}`);
    if (place.categoryId !== options.category.id) {
      throw new Error(`${placeId} tilhører ${place.categoryId}, ikke ${options.category.id}`);
    }
    if (place.knowledgeLevel !== "audited") {
      throw new Error(`${placeId} er registerdata og kan ikke promoteres`);
    }
    return place;
  });
  return {
    category: options.category,
    pois: selected.map((place) => ({
      id: `project:${options.projectId}:${place.id}`,
      name: place.name,
      lat: place.coordinates.lat,
      lng: place.coordinates.lng,
      address: place.address ?? null,
      category_id: options.category.id,
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
        marker_image: `${options.markerImagePrefix}${place.id}.webp`,
      },
    })),
  };
}
