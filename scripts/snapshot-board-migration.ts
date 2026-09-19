import { writeFile } from "node:fs/promises";

import { createServerClient } from "@/lib/supabase/client";

function options() {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const customer = value("--customer");
  const projectSlug = value("--project");
  const outputPath = value("--output");
  if (!customer || !projectSlug || !outputPath) {
    throw new Error("--customer, --project og --output er påkrevd");
  }
  return { customer, projectSlug, outputPath };
}

async function main() {
  const args = options();
  const db = createServerClient().schema("v2");
  const { data: project, error: projectError } = await db.from("projects")
    .select("id,name,customer_id,url_slug,updated_at")
    .eq("customer_id", args.customer)
    .eq("url_slug", args.projectSlug)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Prosjektet finnes ikke");

  const [{ data: product, error: productError }, { data: binding, error: bindingError }] = await Promise.all([
    db.from("products").select("id,product_type,config,version,updated_at")
      .eq("project_id", project.id).eq("product_type", "report").maybeSingle(),
    db.from("voice_projects").select("slug,project_id,content_source,enabled,public_tenant_id")
      .eq("project_id", project.id).maybeSingle(),
  ]);
  if (productError) throw new Error(productError.message);
  if (bindingError) throw new Error(bindingError.message);
  if (!product) throw new Error("Rapportproduktet finnes ikke");

  const snapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    purpose: "Rollback snapshot before local-demo to standard-board migration",
    project,
    reportProduct: product,
    voiceBinding: binding ?? null,
  };
  await writeFile(args.outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    status: "captured",
    outputPath: args.outputPath,
    projectId: project.id,
    productId: product.id,
    productUpdatedAt: product.updated_at,
    hasVoiceBinding: binding !== null,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
