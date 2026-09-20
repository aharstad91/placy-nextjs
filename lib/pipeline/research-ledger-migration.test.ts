import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/093_research_ledger.sql",
);

describe("research ledger migration contract", () => {
  it("creates a service-role-only, versioned audit ledger", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    for (const table of [
      "research_packages",
      "research_entities",
      "research_claims",
    ]) {
      expect(sql).toContain(`CREATE TABLE v2.${table}`);
      expect(sql).toContain(`ALTER TABLE v2.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toContain("TO service_role");
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]+research_(packages|entities|claims)/);
  });

  it("enforces package mode, mapping integrity and one current claim version", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("package_mode IN ('full_snapshot', 'delta')");
    expect(sql).toContain(
      "CHECK ((mapping_status = 'mapped') = (mapped_poi_id IS NOT NULL))",
    );
    expect(sql).toContain("CREATE UNIQUE INDEX research_claims_current_uniq");
    expect(sql).toContain("WHERE superseded_at IS NULL");
  });

  it("cannot mark a time-sensitive claim publishable without valid_until", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain(
      "(review_status = 'approved_time_sensitive' AND valid_until IS NOT NULL)",
    );
  });

  it("imports the package through one restricted transactional RPC", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION v2.import_research_package(p_payload jsonb)",
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION v2.import_research_package(jsonb) FROM PUBLIC",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION v2.import_research_package(jsonb) TO service_role",
    );
  });
});
