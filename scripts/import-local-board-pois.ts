import { readFile, writeFile } from "node:fs/promises";

import { buildLocalBoardPoiPackage } from "@/lib/pipeline/local-board-poi-package";
import { revalidateProject } from "@/lib/pipeline/provision";
import { createServerClient } from "@/lib/supabase/client";

function options() {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const customer = value("--customer");
  const projectSlug = value("--project");
  const placesPath = value("--places");
  const configPath = value("--config");
  if (!customer || !projectSlug || !placesPath || !configPath) {
    throw new Error("--customer, --project, --places og --config er påkrevd");
  }
  return {
    customer,
    projectSlug,
    placesPath,
    configPath,
    receiptPath: value("--receipt") ?? null,
    write: values.includes("--write"),
  };
}

async function main() {
  const args = options();
  const [places, config] = await Promise.all([
    readFile(args.placesPath, "utf8").then(JSON.parse),
    readFile(args.configPath, "utf8").then(JSON.parse),
  ]);
  const db = createServerClient().schema("v2");
  const { data: project, error: projectError } = await db.from("projects")
    .select("id").eq("customer_id", args.customer).eq("url_slug", args.projectSlug).maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Prosjektet finnes ikke");
  const poiPackage = buildLocalBoardPoiPackage(places, { ...config, projectId: project.id });
  const { data: products, error: productsError } = await db.from("products")
    .select("id").eq("project_id", project.id);
  if (productsError) throw new Error(productsError.message);
  const preview = {
    schemaVersion: 1,
    projectId: project.id,
    customer: args.customer,
    projectSlug: args.projectSlug,
    category: poiPackage.category,
    poiIds: poiPackage.pois.map((poi) => poi.id),
    productIds: products.map((product) => product.id),
  };
  if (!args.write) {
    process.stdout.write(`${JSON.stringify({ status: "dry_run", ...preview }, null, 2)}\n`);
    return;
  }

  const { error: categoryError } = await db.from("categories").upsert(poiPackage.category);
  if (categoryError) throw new Error(`Kategoriimport feilet: ${categoryError.message}`);
  const { error: poiError } = await db.from("pois").upsert(poiPackage.pois, { onConflict: "id" });
  if (poiError) throw new Error(`POI-import feilet: ${poiError.message}`);
  const projectLinks = poiPackage.pois.map((poi, index) => ({
    project_id: project.id,
    poi_id: poi.id,
    sort_order: index,
  }));
  const { error: projectLinkError } = await db.from("project_pois")
    .upsert(projectLinks, { onConflict: "project_id,poi_id" });
  if (projectLinkError) throw new Error(`Prosjektkobling feilet: ${projectLinkError.message}`);
  const productLinks = products.flatMap((product) => poiPackage.pois.map((poi, index) => ({
    product_id: product.id,
    poi_id: poi.id,
    category_override_id: null,
    sort_order: index,
    featured: true,
  })));
  if (productLinks.length > 0) {
    const { error: productLinkError } = await db.from("product_pois")
      .upsert(productLinks, { onConflict: "product_id,poi_id" });
    if (productLinkError) throw new Error(`Produktkobling feilet: ${productLinkError.message}`);
  }
  for (const product of products) {
    const { error: productCategoryError } = await db.from("product_categories").upsert({
      product_id: product.id,
      category_id: poiPackage.category.id,
      display_order: 0,
    }, { onConflict: "product_id,category_id" });
    if (productCategoryError) throw new Error(`Produktkategori feilet: ${productCategoryError.message}`);
  }
  const { data: written, error: verifyError } = await db.from("pois")
    .select("id,poi_metadata").in("id", poiPackage.pois.map((poi) => poi.id));
  if (verifyError) throw new Error(`POI-verifikasjon feilet: ${verifyError.message}`);
  if (written.length !== poiPackage.pois.length) throw new Error("Ikke alle prosjekt-POI-er ble skrevet");
  const { revalidated } = await revalidateProject(args.customer, args.projectSlug, undefined, { existed: true });
  const receipt = {
    status: "imported",
    appliedAt: new Date().toISOString(),
    ...preview,
    verifiedPoiCount: written.length,
    revalidated,
  };
  if (args.receiptPath) await writeFile(args.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
