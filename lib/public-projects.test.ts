import { describe, expect, it, vi } from "vitest";

import { PublicProjectError, resolvePublicProjectRoute } from "@/lib/public-projects";

describe("public project route registry", () => {
  it("resolves identity without loading demo content", async () => {
    const lookup = vi.fn(async () => ({
      slug: "nyhavna",
      customer_id: "nyhavna-utvikling",
      project_id: "nyhavna-utvikling_nyhavna",
      enabled: true,
    }));
    await expect(resolvePublicProjectRoute("nyhavna", lookup)).resolves.toEqual({
      slug: "nyhavna",
      customer: "nyhavna-utvikling",
      projectSlug: "nyhavna",
      projectId: "nyhavna-utvikling_nyhavna",
    });
  });

  it.each(["missing", "api", "../nyhavna"])("fails closed for %s", async (slug) => {
    await expect(resolvePublicProjectRoute(slug, async () => null)).rejects.toBeInstanceOf(PublicProjectError);
  });

  it("treats registry failures as retryable", async () => {
    await expect(resolvePublicProjectRoute("nyhavna", async () => { throw new Error("secret"); }))
      .rejects.toMatchObject({ kind: "unavailable", message: "Public project unavailable" });
  });
});
