/**
 * v2-lesesti for boardet — ENESTE lesesti etter cutover-trimmen 2026-07-06
 * (public-legacy-stien i queries.ts er slettet; selve `public`-skjemaet
 * droppes i egen gated sesjon, se docs/rebuild/public-drop-plan.md).
 *
 * Designvalg:
 * - Anon-klienten (RLS respekteres) — dette er den offentlige board-flaten.
 * - Split-queries: v2 har ingen FK-metadata (baseline 070 «INGEN FOREIGN
 *   KEY-constraints») → PostgREST-nested selects feiler; hver tabell hentes
 *   separat og komponeres i JS.
 * - `project_pois.travel_times` (migrasjon 071) mappes → `POI.travelTime`
 *   (enhets-kontrakt: MINUTTER) — oppfyller read-siden av bead 2nj.
 * - Eksplisitt feilhåndtering (r01.6 AC4): hver query logger sin feil og
 *   returnerer null → kalleren viser notFound i stedet for å kaste.
 */

import "server-only";
import { supabase } from "./client";
import type { TablesV2 } from "./types";
import type { DbCategory, DbPoi } from "./types";
import type { Project, ProductType, POI, Category, Story } from "../types";
import { MIN_TRUST_SCORE } from "../utils/poi-trust";

type V2Project = TablesV2<"projects">;
type V2Product = TablesV2<"products">;

// ============================================
// Trust-filter + transformere (flyttet hit fra legacy queries.ts ved cutover)
// ============================================

/** Filter out untrusted POIs. null = show (backward compatible), score < threshold = hide. */
export function filterTrustedPOIs(pois: POI[]): POI[] {
  return pois.filter((poi) => {
    if (poi.trustScore == null) return true;
    return poi.trustScore >= MIN_TRUST_SCORE;
  });
}

export function transformCategory(dbCategory: DbCategory): Category {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    icon: dbCategory.icon,
    color: dbCategory.color,
  };
}

export function transformPOI(
  dbPoi: DbPoi,
  category: Category | undefined
): POI {
  return {
    id: dbPoi.id,
    name: dbPoi.name,
    coordinates: {
      lat: dbPoi.lat,
      lng: dbPoi.lng,
    },
    address: dbPoi.address ?? undefined,
    category: category ?? {
      id: "unknown",
      name: "Ukjent",
      icon: "MapPin",
      color: "#6b7280",
    },
    description: dbPoi.description ?? undefined,
    featuredImage: dbPoi.featured_image ?? undefined,
    googlePlaceId: dbPoi.google_place_id ?? undefined,
    googleRating: dbPoi.google_rating ?? undefined,
    googleReviewCount: dbPoi.google_review_count ?? undefined,
    googleMapsUrl: dbPoi.google_maps_url ?? undefined,
    photoReference: dbPoi.photo_reference ?? undefined,
    editorialHook: dbPoi.editorial_hook ?? undefined,
    localInsight: dbPoi.local_insight ?? undefined,
    storyPriority: dbPoi.story_priority ?? undefined,
    editorialSources: dbPoi.editorial_sources ?? undefined,
    enturStopplaceId: dbPoi.entur_stopplace_id ?? undefined,
    bysykkelStationId: dbPoi.bysykkel_station_id ?? undefined,
    hyreStationId: dbPoi.hyre_station_id ?? undefined,
    trustScore: dbPoi.trust_score ?? undefined,
    trustFlags: dbPoi.trust_flags ?? undefined,
    trustScoreUpdatedAt: dbPoi.trust_score_updated_at ?? undefined,
    facebookUrl: dbPoi.facebook_url ?? undefined,
    googleWebsite: dbPoi.google_website ?? undefined,
    googleBusinessStatus: dbPoi.google_business_status ?? undefined,
    googlePriceLevel: dbPoi.google_price_level ?? undefined,
    googlePhone: ((dbPoi as Record<string, unknown>).google_phone as string | null) ?? undefined,
    openingHoursJson: ((dbPoi as Record<string, unknown>).opening_hours_json as { weekday_text?: string[] } | null) ?? undefined,
    poiTier: (dbPoi.poi_tier as 1 | 2 | 3 | null) ?? undefined,
    tierReason: dbPoi.tier_reason ?? undefined,
    isChain: dbPoi.is_chain ?? undefined,
    isLocalGem: dbPoi.is_local_gem ?? undefined,
    poiMetadata: dbPoi.poi_metadata ?? undefined,
    tierEvaluatedAt: dbPoi.tier_evaluated_at ?? undefined,
    // Event fields (cast because Supabase types may not include new columns yet)
    eventDates: ((dbPoi as Record<string, unknown>).event_dates as string[] | null) ?? undefined,
    eventTimeStart: ((dbPoi as Record<string, unknown>).event_time_start as string | null) ?? undefined,
    eventTimeEnd: ((dbPoi as Record<string, unknown>).event_time_end as string | null) ?? undefined,
    eventDescription: ((dbPoi as Record<string, unknown>).event_description as string | null) ?? undefined,
    eventUrl: ((dbPoi as Record<string, unknown>).event_url as string | null) ?? undefined,
    eventTags: ((dbPoi as Record<string, unknown>).event_tags as string[] | null) ?? undefined,
    parentPoiId: ((dbPoi as Record<string, unknown>).parent_poi_id as string | null) ?? undefined,
    anchorSummary: ((dbPoi as Record<string, unknown>).anchor_summary as string | null) ?? undefined,
  };
}

function parseTravelTimes(raw: unknown): POI["travelTime"] {
  if (raw === null || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const pick = (key: string) =>
    typeof obj[key] === "number" ? (obj[key] as number) : undefined;
  const walk = pick("walk");
  const bike = pick("bike");
  const car = pick("car");
  if (walk === undefined && bike === undefined && car === undefined) {
    return undefined;
  }
  return { walk, bike, car };
}

export async function getProductFromSupabaseV2(
  customerSlug: string,
  projectSlug: string,
  productType: ProductType
): Promise<Project | null> {
  if (!supabase) return null;
  const db = supabase.schema("v2");

  // 1. Prosjekt (miss her = prosjektet finnes ikke → kalleren viser notFound)
  const { data: project, error: projError } = await db
    .from("projects")
    .select("*")
    .eq("customer_id", customerSlug)
    .eq("url_slug", projectSlug)
    .maybeSingle();
  if (projError) {
    console.error("[v2-queries] projects-oppslag feilet:", projError.message);
    return null;
  }
  if (!project) return null;

  // 2. Produkt av riktig type
  const { data: product, error: prodError } = await db
    .from("products")
    .select("*")
    .eq("project_id", project.id)
    .eq("product_type", productType)
    .maybeSingle();
  if (prodError) {
    console.error("[v2-queries] products-oppslag feilet:", prodError.message);
    return null;
  }
  if (!product) return null;

  // 3. Prosjektets POI-pool + precomputede reisetider (071)
  const { data: projectPois, error: ppError } = await db
    .from("project_pois")
    .select("poi_id, travel_times")
    .eq("project_id", project.id);
  if (ppError) {
    console.error("[v2-queries] project_pois-oppslag feilet:", ppError.message);
    return null;
  }
  const travelByPoiId = new Map(
    (projectPois ?? []).map((pp) => [pp.poi_id, parseTravelTimes(pp.travel_times)])
  );

  // 4. Produktets POI-utvalg + featured (rekkefølge = sort_order)
  const { data: productPois, error: prodPoisError } = await db
    .from("product_pois")
    .select("poi_id, featured, sort_order")
    .eq("product_id", product.id)
    .order("sort_order");
  if (prodPoisError) {
    console.error("[v2-queries] product_pois-oppslag feilet:", prodPoisError.message);
    return null;
  }
  const orderedPoiIds = (productPois ?? []).map((pp) => pp.poi_id);
  const featuredSet = new Set(
    (productPois ?? []).filter((pp) => pp.featured).map((pp) => pp.poi_id)
  );

  // 5. POI-data + kategorier (split — ingen FK-metadata i v2)
  let pois: POI[] = [];
  let categoryById = new Map<string, Category>();
  if (orderedPoiIds.length > 0) {
    const { data: poiRows, error: poisError } = await db
      .from("pois")
      .select("*")
      .in("id", orderedPoiIds);
    if (poisError) {
      console.error("[v2-queries] pois-oppslag feilet:", poisError.message);
      return null;
    }

    const categoryIds = Array.from(
      new Set((poiRows ?? []).map((p) => p.category_id).filter((id): id is string => !!id))
    );
    if (categoryIds.length > 0) {
      const { data: catRows, error: catError } = await db
        .from("categories")
        .select("*")
        .in("id", categoryIds);
      if (catError) {
        console.error("[v2-queries] categories-oppslag feilet:", catError.message);
        return null;
      }
      categoryById = new Map(
        (catRows ?? []).map((c) => [c.id, transformCategory(c as DbCategory)])
      );
    }

    const poiById = new Map<string, POI>(
      (poiRows ?? []).map((row) => {
        const category = row.category_id
          ? categoryById.get(row.category_id)
          : undefined;
        const poi: POI = {
          ...transformPOI(row as unknown as DbPoi, category),
          featured: featuredSet.has(row.id) ? true : undefined,
          travelTime: travelByPoiId.get(row.id),
        };
        return [row.id, poi];
      })
    );
    pois = filterTrustedPOIs(
      orderedPoiIds
        .map((id) => poiById.get(id))
        .filter((p): p is POI => p !== undefined)
    );
  }

  // 6. Produktets kategorier (pipeline-skrevet); tomt → avled fra POI-ene
  const { data: productCats, error: prodCatsError } = await db
    .from("product_categories")
    .select("category_id, display_order")
    .eq("product_id", product.id)
    .order("display_order");
  if (prodCatsError) {
    console.error("[v2-queries] product_categories-oppslag feilet:", prodCatsError.message);
    return null;
  }
  let categories: Category[];
  if (productCats && productCats.length > 0) {
    categories = productCats
      .map((pc) => categoryById.get(pc.category_id))
      .filter((c): c is Category => c !== undefined);
  } else {
    const seen = new Map<string, Category>();
    for (const poi of pois) {
      if (poi.category && !seen.has(poi.category.id)) {
        seen.set(poi.category.id, poi.category);
      }
    }
    categories = Array.from(seen.values());
  }

  return {
    id: product.id,
    name: project.name,
    customer: customerSlug,
    urlSlug: project.url_slug,
    productType: product.product_type as ProductType,
    centerCoordinates: { lat: project.center_lat, lng: project.center_lng },
    venueType: (project.venue_type as Project["venueType"]) ?? null,
    tags: project.tags ?? [],
    reportConfig: (product.config as Record<string, unknown>)?.reportConfig as
      | Project["reportConfig"]
      | undefined,
    theme: (project.theme as Project["theme"]) ?? undefined,
    homepageUrl: project.homepage_url ?? null,
    has3dAddon: project.has_3d_addon ?? false,
    story: buildStory(product, project),
    pois,
    categories,
  };
}

function buildStory(product: V2Product, project: V2Project): Story {
  // v2 har ingen story_sections/theme_stories-tabeller (scroll-legacy død) —
  // story-feltene lever flatt på products.
  return {
    id: `${product.id}-story`,
    title: product.story_title ?? project.name,
    introText: product.story_intro_text ?? undefined,
    heroImages: product.story_hero_images ?? undefined,
  };
}
