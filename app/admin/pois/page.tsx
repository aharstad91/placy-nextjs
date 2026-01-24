import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { POIAdminClient } from "./poi-admin-client";
import type { DbCategory, DbPoi } from "@/lib/supabase/types";

// Auth check - redirect if admin not enabled
const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Server Actions
async function createPOI(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = crypto.randomUUID();
  const name = formData.get("name") as string;
  const lat = parseFloat(formData.get("lat") as string);
  const lng = parseFloat(formData.get("lng") as string);
  const categoryId = formData.get("categoryId") as string;
  const address = formData.get("address") as string | null;
  const description = formData.get("description") as string | null;
  const editorialHook = formData.get("editorialHook") as string | null;
  const localInsight = formData.get("localInsight") as string | null;
  const storyPriority = formData.get("storyPriority") as "must_have" | "nice_to_have" | "filler" | null;

  const { error } = await supabase.from("pois").insert({
    id,
    name,
    lat,
    lng,
    category_id: categoryId,
    address: address || null,
    description: description || null,
    editorial_hook: editorialHook || null,
    local_insight: localInsight || null,
    story_priority: storyPriority || null,
    // google_place_id is null for native POIs
  });

  if (error) {
    throw new Error(`Failed to create POI: ${error.message}`);
  }

  revalidatePath("/admin/pois");
}

async function deletePOI(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;

  const { error } = await supabase.from("pois").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete POI: ${error.message}`);
  }

  revalidatePath("/admin/pois");
}

async function updatePOI(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const lat = parseFloat(formData.get("lat") as string);
  const lng = parseFloat(formData.get("lng") as string);
  const categoryId = formData.get("categoryId") as string;
  const address = formData.get("address") as string | null;
  const description = formData.get("description") as string | null;
  const editorialHook = formData.get("editorialHook") as string | null;
  const localInsight = formData.get("localInsight") as string | null;
  const storyPriority = formData.get("storyPriority") as "must_have" | "nice_to_have" | "filler" | null;

  const { error } = await supabase
    .from("pois")
    .update({
      name,
      lat,
      lng,
      category_id: categoryId,
      address: address || null,
      description: description || null,
      editorial_hook: editorialHook || null,
      local_insight: localInsight || null,
      story_priority: storyPriority || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update POI: ${error.message}`);
  }

  revalidatePath("/admin/pois");
}

export default async function AdminPOIsPage() {
  // Redirect if admin not enabled
  if (!adminEnabled) {
    redirect("/");
  }

  const supabase = createServerClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Supabase ikke konfigurert</h1>
          <p className="mt-2 text-gray-600">
            Sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i .env
          </p>
        </div>
      </div>
    );
  }

  // Fetch all POIs (native + Google)
  const { data: pois, error: poisError } = await supabase
    .from("pois")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch categories
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (poisError || categoriesError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Database-feil</h1>
          <p className="mt-2 text-gray-600">
            {poisError?.message || categoriesError?.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Laster...</div>}>
      <POIAdminClient
        pois={pois || []}
        categories={categories || []}
        createPOI={createPOI}
        deletePOI={deletePOI}
        updatePOI={updatePOI}
      />
    </Suspense>
  );
}
