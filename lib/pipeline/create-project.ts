/**
 * Create a complete project + explorer product in Supabase
 * for the auto-generation pipeline.
 */

import { createServerClient } from "@/lib/supabase/client";

function generateShortId(length = 7): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createGeneratedProject(options: {
  customerSlug: string;
  slug: string;
  address: string;
  lat: number;
  lng: number;
  housingType: "family" | "young" | "senior";
}): Promise<{ projectId: string; productId: string }> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  // 1. Generate UUIDs
  const projectId = crypto.randomUUID();
  const productId = crypto.randomUUID();

  // 2. Insert project
  // discovery_circles is in the database (migration 013) but not in generated TS types,
  // so we cast the insert payload to bypass strict typing.
  const projectInsert = {
    id: projectId,
    customer_id: options.customerSlug,
    name: options.address,
    url_slug: options.slug,
    center_lat: options.lat,
    center_lng: options.lng,
    venue_type: "residential" as const,
    tags: ["Eiendom - Bolig"],
    discovery_circles: [
      { lat: options.lat, lng: options.lng, radiusMeters: 2000 },
    ],
    short_id: generateShortId(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: projectError } = await (supabase
    .from("projects") as any)
    .insert(projectInsert);

  if (projectError) {
    throw new Error(
      `Kunne ikke opprette prosjekt: ${projectError.message}`
    );
  }

  // 3. Insert explorer product (story_title lives on products, not projects)
  const shortAddress = options.address.split(",")[0];
  const { error: productError } = await supabase.from("products").insert({
    id: productId,
    project_id: projectId,
    product_type: "explorer",
    story_title: `Nabolaget rundt ${shortAddress}`,
  });

  if (productError) {
    // Clean up the project we just created
    await supabase.from("projects").delete().eq("id", projectId);
    throw new Error(
      `Kunne ikke opprette produkt: ${productError.message}`
    );
  }

  return { projectId, productId };
}
