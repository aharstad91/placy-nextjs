import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  boardCapability: vi.fn(),
  serviceJson: vi.fn(),
}));

vi.mock("@/lib/live/board-gateway", () => ({
  boardCapability: mocks.boardCapability,
  serviceJson: mocks.serviceJson,
  sameOrigin: (request: NextRequest) => request.headers.get("origin") === request.nextUrl.origin,
}));

import { POST } from "@/app/api/board-assistant/route";

const version = "a".repeat(64);
const body = { customer: "kunde", projectSlug: "prosjekt", contentVersion: version, sdp: "v=0\r\n" };

describe("board assistant gateway", () => {
  beforeEach(() => {
    process.env.ANJA_CAPABILITY_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    mocks.serviceJson.mockReset().mockResolvedValue({
      response: new Response(JSON.stringify({ sdp: "answer", sessionId: "live_test" }), {
        status: 200, headers: { "X-Anja-Session": "11111111-1111-4111-8111-111111111111" },
      }),
      payload: { sdp: "answer", sessionId: "live_test" },
    });
  });

  it("krever same-origin og utsteder kun HttpOnly-cookie", async () => {
    const request = new NextRequest("https://placy.no/api/board-assistant", {
      method: "POST",
      headers: { origin: "https://placy.no", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("placy_anja=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(await response.json()).toEqual({ sdp: "answer", sessionId: "live_test" });
    expect(mocks.serviceJson).toHaveBeenCalledWith("/sessions", expect.anything());
  });

  it("videresender tjenestens versjonsavvisning uten å utstede capability", async () => {
    mocks.serviceJson.mockResolvedValueOnce({
      response: new Response(JSON.stringify({ error: "Datagrunnlaget er oppdatert. Last boardet på nytt." }), { status: 409 }),
      payload: { error: "Datagrunnlaget er oppdatert. Last boardet på nytt." },
    });
    const request = new NextRequest("https://placy.no/api/board-assistant", {
      method: "POST", headers: { origin: "https://placy.no", "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const response = await POST(request);
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("skjuler muterende rute for fremmed origin", async () => {
    const request = new NextRequest("https://placy.no/api/board-assistant", {
      method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify(body),
    });
    expect((await POST(request)).status).toBe(404);
  });
});
