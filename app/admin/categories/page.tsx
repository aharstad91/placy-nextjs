import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { CategoriesAdminClient } from "./categories-admin-client";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Server Actions
async function createCategory(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = crypto.randomUUID();
  const name = formData.get("name") as string;
  const icon = formData.get("icon") as string;
  const color = formData.get("color") as string;

  if (!name || !icon || !color) {
    throw new Error("Alle felt er påkrevd");
  }

  const { error } = await supabase.from("categories").insert({
    id,
    name,
    icon,
    color,
  });

  if (error) {
    throw new Error(`Kunne ikke opprette kategori: ${error.message}`);
  }

  revalidatePath("/admin/categories");
}

async function updateCategory(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const icon = formData.get("icon") as string;
  const color = formData.get("color") as string;

  if (!id || !name || !icon || !color) {
    throw new Error("Alle felt er påkrevd");
  }

  const { error } = await supabase
    .from("categories")
    .update({ name, icon, color })
    .eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke oppdatere kategori: ${error.message}`);
  }

  revalidatePath("/admin/categories");
}

async function deleteCategory(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;

  // Check if category is used by any POIs
  const { count } = await supabase
    .from("pois")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    throw new Error(
      `Kan ikke slette kategorien. Den brukes av ${count} POI${count > 1 ? "-er" : ""}.`
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke slette kategori: ${error.message}`);
  }

  revalidatePath("/admin/categories");
}

export default async function AdminCategoriesPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const supabase = createServerClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">
            Supabase ikke konfigurert
          </h1>
          <p className="mt-2 text-gray-600">
            Sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i .env
          </p>
        </div>
      </div>
    );
  }

  // Fetch categories with POI count using a subquery
  const { data: categories, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Database-feil</h1>
          <p className="mt-2 text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  // Get POI counts per category
  const { data: poiCounts } = await supabase
    .from("pois")
    .select("category_id");

  const countMap: Record<string, number> = {};
  if (poiCounts) {
    for (const poi of poiCounts) {
      if (poi.category_id) {
        countMap[poi.category_id] = (countMap[poi.category_id] || 0) + 1;
      }
    }
  }

  const categoriesWithCount = (categories || []).map((cat) => ({
    ...cat,
    poiCount: countMap[cat.id] || 0,
  }));

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Laster...
        </div>
      }
    >
      <CategoriesAdminClient
        categories={categoriesWithCount}
        createCategory={createCategory}
        updateCategory={updateCategory}
        deleteCategory={deleteCategory}
      />
    </Suspense>
  );
}
