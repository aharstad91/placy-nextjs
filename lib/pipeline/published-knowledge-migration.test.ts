import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/094_published_knowledge.sql",
);

describe("published knowledge migration contract", () => {
  it("uses a security-invoker view available only to service_role", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("CREATE VIEW v2.published_knowledge");
    expect(sql).toContain("WITH (security_invoker = true)");
    expect(sql).toContain(
      "REVOKE ALL ON v2.published_knowledge FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "GRANT SELECT ON v2.published_knowledge TO service_role",
    );
  });

  it("evaluates validity at read time and lets promoted place knowledge win", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("rc.valid_from <= current_date");
    expect(sql).toContain("rc.valid_until >= current_date");
    expect(sql).toContain("promoted.source_claim_id = rc.claim_id");
    expect(sql).toContain("promoted.display_ready = true");
  });
});
