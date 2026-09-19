import { writeFile } from "node:fs/promises";

import { mergeBoardAssistantConfig } from "@/lib/admin/board-assistant";
import { revalidateProject } from "@/lib/pipeline/provision";
import { createServerClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

interface Options {
  customer: string;
  projectSlug: string;
  name: string;
  greeting: string | null;
  receiptPath: string | null;
  write: boolean;
}

function options(): Options {
  const values = process.argv.slice(2);
  const value = (flag: string, fallback: string | null = null) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] ?? fallback : fallback;
  };
  const customer = value("--customer");
  const projectSlug = value("--project");
  if (!customer || !projectSlug) {
    throw new Error("--customer og --project er påkrevd");
  }
  return {
    customer,
    projectSlug,
    name: value("--name", "Anja")!,
    greeting: value("--greeting"),
    receiptPath: value("--receipt"),
    write: values.includes("--write"),
  };
}

async function main() {
  const args = options();
  const db = createServerClient().schema("v2");
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id")
    .eq("customer_id", args.customer)
    .eq("url_slug", args.projectSlug)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Prosjektet finnes ikke");

  const { data: product, error: productError } = await db
    .from("products")
    .select("id,config,updated_at")
    .eq("project_id", project.id)
    .eq("product_type", "report")
    .maybeSingle();
  if (productError) throw new Error(productError.message);
  if (!product) throw new Error("Rapportproduktet finnes ikke");

  const config = (product.config ?? {}) as Record<string, Json | undefined>;
  const reportConfig = (config.reportConfig ?? {}) as Record<string, Json | undefined>;
  const assistant = mergeBoardAssistantConfig(reportConfig.assistant, {
    name: args.name,
    greeting: args.greeting,
  });
  const nextConfig = {
    ...config,
    reportConfig: {
      ...reportConfig,
      assistant,
    },
  } as Json;
  const preview = {
    schemaVersion: 1,
    projectId: project.id,
    customer: args.customer,
    projectSlug: args.projectSlug,
    productId: product.id,
    previousAssistant: reportConfig.assistant ?? null,
    assistant,
    preservedReportConfigKeys: Object.keys(reportConfig).sort(),
  };

  if (!args.write) {
    process.stdout.write(`${JSON.stringify({ status: "dry_run", ...preview }, null, 2)}\n`);
    return;
  }

  const { data: updated, error: updateError } = await db
    .from("products")
    .update({ config: nextConfig })
    .eq("id", product.id)
    .eq("updated_at", product.updated_at)
    .select("id,updated_at");
  if (updateError) throw new Error(updateError.message);
  if (updated.length !== 1) {
    throw new Error("Optimistisk lås feilet; produktet ble endret underveis");
  }
  const { revalidated } = await revalidateProject(
    args.customer,
    args.projectSlug,
    undefined,
    { existed: true },
  );
  const receipt = {
    status: "updated",
    appliedAt: new Date().toISOString(),
    ...preview,
    updatedAt: updated[0]!.updated_at,
    revalidated,
  };
  if (args.receiptPath) {
    await writeFile(args.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
