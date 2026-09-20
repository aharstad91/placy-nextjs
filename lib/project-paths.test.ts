import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPublicProjectSlug, RESERVED_PROJECT_SLUGS } from "@/lib/project-paths";

describe("public project namespace", () => {
  it("reserves every concrete app and public directory so new routes cannot shadow customer slugs", () => {
    for (const root of ["app", "public"]) {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("(")) {
          expect(RESERVED_PROJECT_SLUGS, `${root}/${entry.name}`).toContain(entry.name);
        }
      }
    }
  });
  it.each(["nyhavna", "leangen", "customer-project", "x".repeat(80)])("accepts public slug %s", slug => {
    expect(isPublicProjectSlug(slug)).toBe(true);
  });
  it.each(["", "../nyhavna", "Nyhavna", "x".repeat(81), ...RESERVED_PROJECT_SLUGS])("rejects invalid or reserved slug %s", slug => {
    expect(isPublicProjectSlug(slug)).toBe(false);
  });
});
