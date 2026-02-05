import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { ProjectsAdminClient } from "./projects-admin-client";
import type { DbCustomer } from "@/lib/supabase/types";
import * as fs from "fs";
import * as path from "path";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Scan JSON project files from data/projects/
function getJSONProjects() {
  const projectsDir = path.join(process.cwd(), "data", "projects");
  const projects: Array<{
    id: string;
    name: string;
    customer: string;
    urlSlug: string;
    productType: string;
    centerLat: number;
    centerLng: number;
    filePath: string;
  }> = [];

  if (!fs.existsSync(projectsDir)) return projects;

  const customers = fs.readdirSync(projectsDir, { withFileTypes: true });
  for (const customerDir of customers) {
    if (!customerDir.isDirectory()) continue;

    const customerPath = path.join(projectsDir, customerDir.name);
    const files = fs.readdirSync(customerPath);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(customerPath, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        projects.push({
          id: `json:${customerDir.name}/${file}`,
          name: data.name || file.replace(".json", ""),
          customer: customerDir.name,
          urlSlug: data.urlSlug || file.replace(".json", ""),
          productType: data.productType || "explorer",
          centerLat: data.centerCoordinates?.lat || 0,
          centerLng: data.centerCoordinates?.lng || 0,
          filePath: `data/projects/${customerDir.name}/${file}`,
        });
      } catch {
        // Skip invalid JSON files
      }
    }
  }

  return projects;
}

// Server Actions
async function createProject(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const customerId = formData.get("customerId") as string;
  const name = formData.get("name") as string;
  const urlSlug = formData.get("urlSlug") as string;
  const centerLat = parseFloat(formData.get("centerLat") as string);
  const centerLng = parseFloat(formData.get("centerLng") as string);
  const productType = (formData.get("productType") as string) || "explorer";

  if (!customerId || !name || !urlSlug) {
    throw new Error("Kunde, navn og URL-slug er påkrevd");
  }

  if (isNaN(centerLat) || isNaN(centerLng)) {
    throw new Error("Ugyldige koordinater");
  }

  // Check if url_slug is unique for this customer
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("customer_id", customerId)
    .eq("url_slug", urlSlug)
    .single();

  if (existing) {
    throw new Error("URL-slug er allerede i bruk for denne kunden");
  }

  // Create project container
  const containerId = `${customerId}_${urlSlug}`;
  const { error: containerError } = await supabase.from("projects").insert({
    id: containerId,
    customer_id: customerId,
    name,
    url_slug: urlSlug,
    center_lat: centerLat,
    center_lng: centerLng,
  });

  if (containerError) {
    throw new Error(`Kunne ikke opprette prosjekt: ${containerError.message}`);
  }

  // Create first product
  const productId = crypto.randomUUID();
  const { error: productError } = await supabase.from("products").insert({
    id: productId,
    project_id: containerId,
    product_type: productType as "explorer" | "report" | "guide",
  });

  if (productError) {
    // Rollback container
    await supabase.from("projects").delete().eq("id", containerId);
    throw new Error(`Kunne ikke opprette produkt: ${productError.message}`);
  }

  revalidatePath("/admin/projects");
}

async function deleteProject(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const deleteType = formData.get("type") as string || "container";

  // Check if this is a JSON project (id starts with "json:")
  if (id.startsWith("json:")) {
    const relativePath = id.replace("json:", "");
    const filePath = path.join(process.cwd(), "data", "projects", relativePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      revalidatePath("/admin/projects");
      return;
    } else {
      throw new Error("JSON-fil ikke funnet");
    }
  }

  // Otherwise, delete from Supabase
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  if (deleteType === "product") {
    // Delete single product (CASCADE will handle product_pois, product_categories)
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      throw new Error(`Kunne ikke slette produkt: ${error.message}`);
    }
  } else {
    // Delete entire container
    // Due to CASCADE, deleting the project will delete:
    // - products (CASCADE)
    // - product_pois (CASCADE from products)
    // - product_categories (CASCADE from products)
    // - project_pois (CASCADE)

    // But we need to handle legacy tables manually (theme_stories, story_sections)
    // Get all products for this container
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .eq("project_id", id);

    const productIds = (products || []).map((p) => p.id);

    // Delete legacy story data for each product
    for (const productId of productIds) {
      // Get theme stories
      const { data: themeStories } = await supabase
        .from("theme_stories")
        .select("id")
        .eq("project_id", productId);

      if (themeStories && themeStories.length > 0) {
        const themeStoryIds = themeStories.map((ts) => ts.id);

        const { data: themeSections } = await supabase
          .from("theme_story_sections")
          .select("id")
          .in("theme_story_id", themeStoryIds);

        if (themeSections && themeSections.length > 0) {
          const themeSectionIds = themeSections.map((s) => s.id);
          await supabase
            .from("theme_section_pois")
            .delete()
            .in("section_id", themeSectionIds);
        }

        await supabase
          .from("theme_story_sections")
          .delete()
          .in("theme_story_id", themeStoryIds);

        await supabase.from("theme_stories").delete().eq("project_id", productId);
      }

      // Delete story sections
      const { data: sections } = await supabase
        .from("story_sections")
        .select("id")
        .eq("project_id", productId);

      if (sections && sections.length > 0) {
        const sectionIds = sections.map((s) => s.id);
        await supabase.from("section_pois").delete().in("section_id", sectionIds);
      }

      await supabase.from("story_sections").delete().eq("project_id", productId);
    }

    // Finally delete the project container (CASCADE handles the rest)
    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) {
      throw new Error(`Kunne ikke slette prosjekt: ${error.message}`);
    }
  }

  revalidatePath("/admin/projects");
}

export default async function AdminProjectsPage() {
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

  // Fetch project containers with products
  const { data: projectContainers, error: projectsError } = await supabase
    .from("projects")
    .select(`
      *,
      products (*)
    `)
    .order("created_at", { ascending: false });

  // Fetch customers for dropdown
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  if (projectsError || customersError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Database-feil</h1>
          <p className="mt-2 text-gray-600">
            {projectsError?.message || customersError?.message}
          </p>
        </div>
      </div>
    );
  }

  // Create customer map for quick lookups
  const customerMap: Record<string, string> = {};
  for (const customer of customers || []) {
    customerMap[customer.id] = customer.name;
  }

  // Transform to hierarchy structure
  const supabaseContainers = (projectContainers || [])
    .filter((container) => container.customer_id !== null)
    .map((container) => ({
      id: container.id,
      name: container.name,
      customer_id: container.customer_id!,
      url_slug: container.url_slug,
      center_lat: Number(container.center_lat),
      center_lng: Number(container.center_lng),
      customerName: customerMap[container.customer_id!] || "Ukjent",
      source: "supabase" as const,
      products: ((container.products as Array<{
        id: string;
        product_type: string;
        story_title: string | null;
      }>) || []).map((p) => ({
        id: p.id,
        type: p.product_type as "explorer" | "report" | "guide",
        title: p.story_title,
      })),
    }));

  // Get JSON projects and group by base slug
  const jsonProjects = getJSONProjects();
  const jsonGrouped = new Map<string, typeof jsonProjects>();

  for (const project of jsonProjects) {
    // Extract base slug (remove -explore, -guide suffix)
    const baseSlug = project.urlSlug
      .replace(/-explore$/, "")
      .replace(/-guide$/, "");
    const key = `${project.customer}/${baseSlug}`;

    if (!jsonGrouped.has(key)) {
      jsonGrouped.set(key, []);
    }
    jsonGrouped.get(key)!.push(project);
  }

  // Convert grouped JSON to container format
  const jsonContainers = Array.from(jsonGrouped.entries()).map(([key, projects]) => {
    const first = projects[0];
    const baseSlug = first.urlSlug
      .replace(/-explore$/, "")
      .replace(/-guide$/, "");

    return {
      id: `json:${key}`,
      name: first.name.replace(/ Explorer$/, "").replace(/ Guide$/, ""),
      customer_id: first.customer,
      url_slug: baseSlug,
      center_lat: first.centerLat,
      center_lng: first.centerLng,
      customerName: first.customer,
      source: "json" as const,
      products: projects.map((p) => ({
        id: p.id,
        type: p.productType as "explorer" | "report" | "guide",
        title: p.name,
        filePath: p.filePath,
      })),
    };
  });

  // Merge and dedupe (Supabase takes priority)
  const supabaseKeys = new Set(
    supabaseContainers.map((p) => `${p.customer_id}/${p.url_slug}`)
  );
  const uniqueJsonContainers = jsonContainers.filter(
    (p) => !supabaseKeys.has(`${p.customer_id}/${p.url_slug}`)
  );

  const allContainers = [...supabaseContainers, ...uniqueJsonContainers];

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Laster...
        </div>
      }
    >
      <ProjectsAdminClient
        containers={allContainers}
        customers={customers || []}
        createProject={createProject}
        deleteProject={deleteProject}
      />
    </Suspense>
  );
}
