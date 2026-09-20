import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAnjaService } from "@/lib/live/anja-service-client";

describe("Anja service client", () => {
  beforeEach(() => {
    process.env.ANJA_SERVICE_URL = "https://anja.internal/";
    process.env.ANJA_SERVICE_SECRET = "internal-secret";
  });
  afterEach(() => {
    delete process.env.ANJA_SERVICE_URL;
    delete process.env.ANJA_SERVICE_SECRET;
    vi.unstubAllGlobals();
  });

  it("holder tjenestenøkkel og sesjon i headere", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await callAnjaService("/sessions/context", { method: "POST" }, "session-id");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://anja.internal/sessions/context");
    expect(String(url)).not.toContain("session-id");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer internal-secret");
    expect(headers.get("X-Anja-Session")).toBe("session-id");
  });
});
