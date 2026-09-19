import { describe, expect, it, vi } from "vitest";
import {
  applyResearchPackage,
  type ApplyResearchPackageDeps,
} from "@/lib/pipeline/apply-research-package";

function input() {
  return {
    schemaVersion: 1,
    packageId: "pkg-1",
    projectId: "customer_project",
    projectName: "Project",
    mode: "delta",
    scopeKey: "project:topics",
    reviewedAt: "2026-09-19",
    sourcePath: null,
    entities: [
      {
        entityId: "topic:one",
        canonicalId: "topic:one",
        name: "Topic",
        entityKind: "topic",
        scope: "project",
        geography: "Project",
        reusableAcrossBoards: false,
        reuseConstraints: null,
        boardId: null,
        mappingStatus: "not_applicable",
      },
    ],
    claims: [],
  };
}

function deps(status: "imported" | "unchanged" = "imported") {
  const order: string[] = [];
  const value: ApplyResearchPackageDeps & { order: string[] } = {
    order,
    resolveProjectRoute: vi.fn(async () => {
      order.push("resolve");
      return { customer: "customer", projectSlug: "project" };
    }),
    importPackage: vi.fn(async () => {
      order.push("import");
      return {
        status,
        package_hash: "a".repeat(64),
        entities: status === "imported" ? 1 : 0,
        claims: 0,
      };
    }),
    revalidate: vi.fn(async () => {
      order.push("revalidate");
      return { revalidated: ["https://www.placy.no"] };
    }),
  };
  return value;
}

describe("applyResearchPackage", () => {
  it("resolves identity, commits, then revalidates the existing board", async () => {
    const testDeps = deps();

    const result = await applyResearchPackage(input(), testDeps);

    expect(testDeps.order).toEqual(["resolve", "import", "revalidate"]);
    expect(result.route).toEqual({
      customer: "customer",
      projectSlug: "project",
    });
    expect(result.revalidated).toEqual(["https://www.placy.no"]);
  });

  it("does not revalidate an idempotent unchanged package", async () => {
    const testDeps = deps("unchanged");

    const result = await applyResearchPackage(input(), testDeps);

    expect(testDeps.order).toEqual(["resolve", "import"]);
    expect(result.revalidated).toEqual([]);
  });

  it("does not invalidate cache after a failed transaction", async () => {
    const testDeps = deps();
    vi.mocked(testDeps.importPackage).mockRejectedValue(
      new Error("transaction rolled back"),
    );

    await expect(applyResearchPackage(input(), testDeps)).rejects.toThrow(
      "transaction rolled back",
    );
    expect(testDeps.revalidate).not.toHaveBeenCalled();
  });
});
