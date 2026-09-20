import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import {
  boardBrandInputSchema,
  mergeBoardBrandConfig,
} from "@/lib/admin/board-brand";
import { revalidateProject } from "@/lib/pipeline/provision";
import { createServerClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

interface Options {
  customer: string;
  projectSlug: string;
  inputPath: string;
  receiptPath: string | null;
  write: boolean;
}

function options(): Options {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const customer = value("--customer");
  const projectSlug = value("--project");
  const inputPath = value("--input");
  if (!customer || !projectSlug || !inputPath) {
    throw new Error("--customer, --project og --input er påkrevd");
  }
  return {
    customer,
    projectSlug,
    inputPath,
    receiptPath: value("--receipt") ?? null,
    write: values.includes("--write"),
  };
}

async function main() {
  const args = options();
  const input = boardBrandInputSchema.parse(
    JSON.parse(await readFile(args.inputPath, "utf8")),
  );
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

  const current = (product.config ?? {}) as Record<string, Json | undefined>;
  const nextConfig = mergeBoardBrandConfig(current, input);
  const preview = {
    schemaVersion: 1,
    projectId: project.id,
    customer: args.customer,
    projectSlug: args.projectSlug,
    productId: product.id,
    previousAssets:
      ((current.reportConfig as Record<string, Json> | undefined)?.assets ?? null),
    previousPresentation:
      ((current.reportConfig as Record<string, Json> | undefined)?.presentation ?? null),
    assets: input.assets,
    presentation: input.presentation,
  };

  if (!args.write) {
    process.stdout.write(`${JSON.stringify({ status: "dry_run", ...preview }, null, 2)}\n`);
    return;
  }

  if (isDeepStrictEqual(current, nextConfig)) {
    const receipt = {
      status: "unchanged",
      checkedAt: new Date().toISOString(),
      ...preview,
    };
    if (args.receiptPath) {
      await writeFile(args.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    }
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
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
