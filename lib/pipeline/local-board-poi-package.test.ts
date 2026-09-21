import { describe, expect, it } from "vitest";

import { buildLocalBoardPoiPackage } from "@/lib/pipeline/local-board-poi-package";

const place = {
  id: "harbour",
  name: "Harbour",
  categoryId: "development",
  coordinates: { lat: 63.4, lng: 10.4 },
  summary: "A planned district.",
  sourceIds: ["source"],
  checkedAt: "2026-09-19",
  status: "planned",
  locationPrecision: "approximate",
  locationNote: "Area marker, not a boundary.",
  facts: [],
  caveats: [],
  image: "/illustrations/nyhavna-harbour.webp",
};

describe("buildLocalBoardPoiPackage", () => {
  it("promotes audited project concepts with explicit ownership and precision", () => {
    const result = buildLocalBoardPoiPackage([place], {
      projectId: "customer_project",
      category: { id: "development", name: "Development", icon: "Building2", color: "#123456" },
      placeIds: ["harbour"],
      markerImagePrefix: "/illustrations/nyhavna-",
    });
    expect(result.pois[0]).toMatchObject({
      id: "project:customer_project:harbour",
      featured_image: "/illustrations/nyhavna-harbour.webp",
      poi_tier: 1,
      poi_metadata: {
        owner_project_id: "customer_project",
        development_status: "planned",
        location_precision: "approximate",
        marker_image: "/illustrations/nyhavna-harbour.webp",
      },
    });
    expect(result.categories).toEqual([
      { id: "development", name: "Development", icon: "Building2", color: "#123456" },
    ]);
  });

  it("refuses to promote a place under the wrong category", () => {
    expect(() => buildLocalBoardPoiPackage([place], {
      projectId: "customer_project",
      category: { id: "other", name: "Other", icon: "MapPin", color: "#123456" },
      placeIds: ["harbour"],
      markerImagePrefix: "/illustrations/nyhavna-",
    })).toThrow("harbour tilhører development");
  });

  it("promotes several local themes into standard subcategories without fake marker images", () => {
    const second = {
      ...place,
      id: "gym",
      name: "Gym",
      categoryId: "training-theme",
      status: "existing" as const,
      locationPrecision: "sourced" as const,
      locationNote: undefined,
    };
    const result = buildLocalBoardPoiPackage([place, second], {
      projectId: "customer_project",
      groups: [
        {
          category: { id: "development", name: "Development", icon: "Building2", color: "#123456" },
          placeIds: ["harbour"],
          markerImagePrefix: "/illustrations/nyhavna-",
        },
        {
          category: { id: "gym", name: "Treningssenter", icon: "Dumbbell", color: "#ec4899" },
          sourceCategoryId: "training-theme",
          placeIds: ["gym"],
        },
      ],
    });

    expect(result.categories).toHaveLength(2);
    expect(result.pois[1]).toMatchObject({
      category_id: "gym",
      poi_metadata: { local_board_place_id: "gym" },
    });
    expect(result.pois[1]!.poi_metadata).not.toHaveProperty("marker_image");
  });
});
