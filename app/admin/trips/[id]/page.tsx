import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/client";
import { getTripByIdAdmin, searchPoisAdmin } from "@/lib/supabase/queries";
import {
  getRequiredString,
  getOptionalString,
  getOptionalNumber,
  getRequiredNumber,
} from "@/lib/utils/form-data";
import { TripEditorClient } from "./trip-editor-client";

export const dynamic = "force-dynamic";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

export default async function TripEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!adminEnabled) {
    redirect("/");
  }

  const { id } = await params;
  const isNew = id === "new";

  const trip = isNew ? null : await getTripByIdAdmin(id);
  if (!isNew && !trip) {
    notFound();
  }

  // --- Server Actions ---

  async function createTrip(formData: FormData) {
    "use server";

    const title = getRequiredString(formData, "title");
    const urlSlug = getRequiredString(formData, "urlSlug");
    const description = getOptionalString(formData, "description");
    const coverImageUrl = getOptionalString(formData, "coverImageUrl");
    const city = getRequiredString(formData, "city");
    const region = getOptionalString(formData, "region");
    const country = getOptionalString(formData, "country") || "NO";
    const centerLat = getRequiredNumber(formData, "centerLat");
    const centerLng = getRequiredNumber(formData, "centerLng");
    const category = getOptionalString(formData, "category");
    const difficulty = getOptionalString(formData, "difficulty");
    const season = getOptionalString(formData, "season") || "all-year";
    const tagsStr = getOptionalString(formData, "tags");
    const tags = tagsStr
      ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const distanceMeters = getOptionalNumber(formData, "distanceMeters");
    const durationMinutes = getOptionalNumber(formData, "durationMinutes");
    const defaultRewardTitle = getOptionalString(formData, "defaultRewardTitle");
    const defaultRewardDescription = getOptionalString(
      formData,
      "defaultRewardDescription"
    );

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { data, error } = await supabase
      .from("trips")
      .insert({
        title,
        url_slug: urlSlug,
        description,
        cover_image_url: coverImageUrl,
        city,
        region,
        country,
        center_lat: centerLat,
        center_lng: centerLng,
        category: category as "food" | "culture" | "nature" | "family" | "active" | "hidden-gems" | null,
        difficulty: difficulty as "easy" | "moderate" | "challenging" | null,
        season: (season || "all-year") as "spring" | "summer" | "autumn" | "winter" | "all-year",
        tags,
        distance_meters: distanceMeters,
        duration_minutes: durationMinutes,
        default_reward_title: defaultRewardTitle,
        default_reward_description: defaultRewardDescription,
        published: false,
        featured: false,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("En trip med denne URL-sluggen finnes allerede.");
      }
      throw new Error(error.message);
    }

    revalidatePath("/admin/trips");
    redirect(`/admin/trips/${data.id}`);
  }

  async function updateTrip(formData: FormData) {
    "use server";

    const tripId = getRequiredString(formData, "tripId");
    const title = getRequiredString(formData, "title");
    const urlSlug = getRequiredString(formData, "urlSlug");
    const description = getOptionalString(formData, "description");
    const coverImageUrl = getOptionalString(formData, "coverImageUrl");
    const city = getRequiredString(formData, "city");
    const region = getOptionalString(formData, "region");
    const country = getOptionalString(formData, "country") || "NO";
    const centerLat = getRequiredNumber(formData, "centerLat");
    const centerLng = getRequiredNumber(formData, "centerLng");
    const category = getOptionalString(formData, "category");
    const difficulty = getOptionalString(formData, "difficulty");
    const season = getOptionalString(formData, "season") || "all-year";
    const tagsStr = getOptionalString(formData, "tags");
    const tags = tagsStr
      ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const distanceMeters = getOptionalNumber(formData, "distanceMeters");
    const durationMinutes = getOptionalNumber(formData, "durationMinutes");
    const defaultRewardTitle = getOptionalString(formData, "defaultRewardTitle");
    const defaultRewardDescription = getOptionalString(
      formData,
      "defaultRewardDescription"
    );
    const featured = formData.get("featured") === "true";

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("trips")
      .update({
        title,
        url_slug: urlSlug,
        description,
        cover_image_url: coverImageUrl,
        city,
        region,
        country,
        center_lat: centerLat,
        center_lng: centerLng,
        category: category as "food" | "culture" | "nature" | "family" | "active" | "hidden-gems" | null,
        difficulty: difficulty as "easy" | "moderate" | "challenging" | null,
        season: (season || "all-year") as "spring" | "summer" | "autumn" | "winter" | "all-year",
        tags,
        distance_meters: distanceMeters,
        duration_minutes: durationMinutes,
        default_reward_title: defaultRewardTitle,
        default_reward_description: defaultRewardDescription,
        featured,
      })
      .eq("id", tripId);

    if (error) {
      if (error.code === "23505") {
        throw new Error("En trip med denne URL-sluggen finnes allerede.");
      }
      throw new Error(error.message);
    }

    revalidatePath("/admin/trips");
    revalidatePath(`/admin/trips/${tripId}`);
  }

  async function deleteTrip(formData: FormData) {
    "use server";

    const tripId = getRequiredString(formData, "tripId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Check if trip is linked to any projects
    const { count } = await supabase
      .from("project_trips")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId);

    if ((count ?? 0) > 0) {
      throw new Error(
        `Kan ikke slette. Trippen er koblet til ${count} prosjekt(er). Fjern koblingene først.`
      );
    }

    const { error } = await supabase.from("trips").delete().eq("id", tripId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/trips");
    redirect("/admin/trips");
  }

  async function togglePublish(formData: FormData) {
    "use server";

    const tripId = getRequiredString(formData, "tripId");
    const published = formData.get("published") === "true";

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("trips")
      .update({ published })
      .eq("id", tripId);

    if (error) throw new Error(error.message);

    revalidatePath("/admin/trips");
    revalidatePath(`/admin/trips/${tripId}`);
  }

  async function addTripStop(formData: FormData) {
    "use server";

    const tripId = getRequiredString(formData, "tripId");
    const poiId = getRequiredString(formData, "poiId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Get max sort_order for this trip
    const { data: existing } = await supabase
      .from("trip_stops")
      .select("sort_order")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { error } = await supabase.from("trip_stops").insert({
      trip_id: tripId,
      poi_id: poiId,
      sort_order: nextOrder,
    });

    if (error) throw new Error(error.message);

    revalidatePath(`/admin/trips/${tripId}`);
  }

  async function updateTripStop(formData: FormData) {
    "use server";

    const stopId = getRequiredString(formData, "stopId");
    const tripId = getRequiredString(formData, "tripId");
    const nameOverride = getOptionalString(formData, "nameOverride");
    const descriptionOverride = getOptionalString(
      formData,
      "descriptionOverride"
    );
    const imageUrlOverride = getOptionalString(formData, "imageUrlOverride");
    const transitionText = getOptionalString(formData, "transitionText");
    const localInsight = getOptionalString(formData, "localInsight");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("trip_stops")
      .update({
        name_override: nameOverride,
        description_override: descriptionOverride,
        image_url_override: imageUrlOverride,
        transition_text: transitionText,
        local_insight: localInsight,
      })
      .eq("id", stopId);

    if (error) throw new Error(error.message);

    revalidatePath(`/admin/trips/${tripId}`);
  }

  async function deleteTripStop(formData: FormData) {
    "use server";

    const stopId = getRequiredString(formData, "stopId");
    const tripId = getRequiredString(formData, "tripId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("trip_stops")
      .delete()
      .eq("id", stopId);

    if (error) throw new Error(error.message);

    revalidatePath(`/admin/trips/${tripId}`);
  }

  async function reorderTripStops(formData: FormData) {
    "use server";

    const tripId = getRequiredString(formData, "tripId");
    const orderJson = getRequiredString(formData, "order");
    let order: { id: string; sort_order: number }[];
    try {
      const parsed = JSON.parse(orderJson);
      if (!Array.isArray(parsed)) throw new Error("Expected array");
      order = parsed;
    } catch {
      throw new Error("Ugyldig rekkefølge-data");
    }

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Update each stop's sort_order
    for (const item of order) {
      const { error } = await supabase
        .from("trip_stops")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);

      if (error) throw new Error(error.message);
    }

    revalidatePath(`/admin/trips/${tripId}`);
  }

  async function searchPois(formData: FormData) {
    "use server";

    const query = getRequiredString(formData, "query");
    const city = getOptionalString(formData, "city");

    const results = await searchPoisAdmin(query, city ?? undefined);

    // Return as serializable data
    return results.map((poi) => ({
      id: poi.id,
      name: poi.name,
      address: poi.address,
      categoryName: poi.category?.name,
      categoryColor: poi.category?.color,
      categoryIcon: poi.category?.icon,
    }));
  }

  return (
    <TripEditorClient
      trip={trip}
      isNew={isNew}
      createTrip={createTrip}
      updateTrip={updateTrip}
      deleteTrip={deleteTrip}
      togglePublish={togglePublish}
      addTripStop={addTripStop}
      updateTripStop={updateTripStop}
      deleteTripStop={deleteTripStop}
      reorderTripStops={reorderTripStops}
      searchPois={searchPois}
    />
  );
}
