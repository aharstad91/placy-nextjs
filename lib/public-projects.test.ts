import { beforeEach, describe, expect, it, vi } from "vitest";

const hostedResult = vi.hoisted(() => ({
  current: { data: null as { slug: string } | null, error: null as { message: string } | null },
}));

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/live/hosted-access", () => ({ hostedVoiceEnabled: () => true }));
vi.mock("@/lib/supabase/client", () => ({
  createServerClient: () => ({
    schema: () => ({
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          abortSignal: () => query,
          maybeSingle: async () => hostedResult.current,
        };
        return query;
      },
    }),
  }),
}));

import {
  findHostedVoiceProjectSlug,
  PublicProjectError,
  resolvePublicProjectRoute,
} from "@/lib/public-projects";

describe("public project route registry", () => {
  beforeEach(() => {
    hostedResult.current = { data: null, error: null };
  });

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

  it("resolves only a valid enabled hosted voice slug", async () => {
    hostedResult.current = { data: { slug: "nyhavna" }, error: null };
    await expect(findHostedVoiceProjectSlug("nyhavna-utvikling", "nyhavna"))
      .resolves.toBe("nyhavna");

    hostedResult.current = { data: { slug: "api" }, error: null };
    await expect(findHostedVoiceProjectSlug("nyhavna-utvikling", "nyhavna"))
      .resolves.toBeUndefined();
  });

  it("keeps hosted voice registry failures retryable", async () => {
    hostedResult.current = { data: null, error: { message: "secret" } };
    await expect(findHostedVoiceProjectSlug("nyhavna-utvikling", "nyhavna"))
      .rejects.toMatchObject({ kind: "unavailable", message: "Public project unavailable" });
  });
});
