import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/prototype/realtime/route";

const key = "test-secret-must-remain-server-side";
const validBody = { sdp: "v=0\r\n", instructions: "Test", tools: [], mode: "text" };

function request(url = "http://localhost:3001/api/prototype/realtime", origin?: string) {
  return new NextRequest(url, {
    method: "POST", body: JSON.stringify(validBody),
    headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("OPENAI_API_KEY", key);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("v=0\r\nanswer", { status: 200 })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("local Realtime session boundary", () => {
  it("keeps the credential in the upstream Authorization header and returns only SDP", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("v=0\r\nanswer");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    expect(init?.headers).toEqual({ Authorization: `Bearer ${key}` });
    const form = init?.body as FormData;
    expect(form.get("session")).not.toContain(key);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const health = await GET(new NextRequest("http://localhost:3001/api/prototype/realtime"));
    expect(await health.text()).not.toContain(key);
  });

  it("rejects nonlocal and cross-origin requests before contacting OpenAI", async () => {
    expect((await POST(request("https://example.com/api/prototype/realtime"))).status).toBe(404);
    expect((await POST(request(undefined, "https://example.com"))).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables the paid session factory in production even on localhost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request())).status).toBe(404);
    expect((await GET(new NextRequest("http://localhost:3001/api/prototype/realtime"))).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts the browser's loopback Host when Next normalizes its URL, but not a different origin", async () => {
    const normalized = (origin: string) => new NextRequest("http://localhost:3101/api/prototype/realtime", {
      method: "POST", body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json", host: "127.0.0.1:3101", origin },
    });
    expect((await POST(normalized("http://127.0.0.1:3101"))).status).toBe(200);
    expect((await POST(normalized("http://127.0.0.1:3102"))).status).toBe(404);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not leak upstream error bodies or credentials", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(`upstream diagnostic ${key}`, { status: 401 }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(key);
    expect(text).not.toContain("upstream diagnostic");
  });

  it.each(["insufficient_quota", "credit_balance_exhausted"])("distinguishes %s from temporary rate limiting", async (code) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: { code, message: key } }, { status: 429 }));
    const response = await POST(request());
    const body = await response.json();
    expect(body.code).toBe("insufficient_quota");
    expect(body.error).toContain("API-kreditt");
    expect(JSON.stringify(body)).not.toContain(key);
  });
});
