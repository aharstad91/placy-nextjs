/** Reviewed facts only. Default previews database diff; --apply writes it.
 * Usage: npx tsx scripts/apply-local-activities.ts data/knowledge/broset-activities.json [--apply]
 * No Places, routing or LLM calls. Existing rows use optimistic locking. */
import "@/scripts/load-env";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/client";
import { LocalActivitySchema } from "@/lib/knowledge/local-activities";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import type { TablesV2 } from "@/lib/supabase/types";

const Input = z.object({
  projectId: z.string().min(1),
  facts: z.array(LocalActivitySchema.extend({
    topic: z.literal("local_knowledge"), fact_text: z.string().min(1),
  })).min(1),
});

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) throw new Error("Provide the reviewed JSON file, optionally --apply");
  const input = Input.parse(JSON.parse(readFileSync(file, "utf8")));
  const ids = input.facts.map((fact) => fact.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate fact IDs");
  const db = createServerClient().schema("v2");
  const { data: product, error } = await db.from("products").select("*")
    .eq("project_id", input.projectId).eq("product_type", "report").single();
  if (error || !product) throw new Error(error?.message ?? "Product missing");
  const existing: TablesV2<"place_knowledge">[] = [];
  for (const batch of chunkIds(ids)) {
    const result = await db.from("place_knowledge").select("*").in("id", batch);
    if (result.error) throw new Error(result.error.message);
    existing.push(...result.data);
  }
  const config = z.record(z.string(), z.unknown()).parse(product.config);
  const reportConfig = z.record(z.string(), z.unknown()).parse(config.reportConfig);
  const oldIds = z.array(z.string()).optional().parse(reportConfig.localActivityIds) ?? [];
  const nextConfig = { ...config, reportConfig: { ...reportConfig, localActivityIds: [...new Set([...oldIds, ...ids])] } };
  const changed = input.facts.filter((fact) => {
    const old = existing.find((row) => row.id === fact.id);
    const canonical = (row: unknown) => {
      const parsed = Input.shape.facts.element.parse(row);
      return JSON.stringify({ ...parsed, verified_at: new Date(parsed.verified_at).toISOString() });
    };
    return !old || canonical(old) !== canonical(fact);
  });
  console.log(JSON.stringify({ projectId: input.projectId, facts: input.facts.length, changed: changed.map((f) => f.id), selectedIds: nextConfig.reportConfig.localActivityIds }, null, 2));
  if (!process.argv.includes("--apply")) return;
  const backup = join(mkdtempSync(join(tmpdir(), "placy-activities-")), "before.json");
  writeFileSync(backup, JSON.stringify({ product, facts: existing, newIds: ids.filter((id) => !existing.some((r) => r.id === id)) }, null, 2));
  console.log(`Backup: ${backup}`);
  for (const fact of changed) {
    const old = existing.find((row) => row.id === fact.id);
    const row = { ...fact, updated_at: new Date().toISOString() };
    const result = old
      ? await db.from("place_knowledge").update(row).eq("id", fact.id).eq("updated_at", old.updated_at).select("id")
      : await db.from("place_knowledge").insert(row).select("id");
    if (result.error || result.data?.length !== 1) throw new Error(`Fact ${fact.id} not written. Backup: ${backup}. ${result.error?.message ?? "Concurrent change"}`);
  }
  if (JSON.stringify(config) !== JSON.stringify(nextConfig)) {
    const result = await db.from("products").update({
      config: nextConfig as TablesV2<"products">["config"], updated_at: new Date().toISOString(),
    }).eq("id", product.id).eq("updated_at", product.updated_at).select("id");
    if (result.error || result.data?.length !== 1) throw new Error(`Product selection not written; facts may have been written. Backup: ${backup}. ${result.error?.message ?? "Concurrent change"}`);
  }
  console.log("Applied. Re-run preview to verify zero changed facts. Product cache revalidates within its existing one-hour interval; restart local preview for immediate review.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
