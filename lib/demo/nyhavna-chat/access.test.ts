import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueNhChatCookie, NH_CHAT_COOKIE, nhChatAccess, nhChatConfigured, nhChatEnabled, nhChatVisitor, nhChatVoiceEnabled, verifyNhChatCookie,
} from "@/lib/demo/nyhavna-chat/access";

const SECRET = "n".repeat(40);

function request(host: string, cookie?: string) {
  return new Request(`http://${host}/api/demo/nyhavna-chat`, { headers: { host, ...(cookie ? { cookie } : {}) } });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Nyhavna-chattens tilgang", () => {
  it("slipper bare loopback inn på en ukonfigurert utviklingsserver", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(nhChatEnabled()).toBe(true);
    expect(nhChatConfigured()).toBe(false);
    expect(nhChatVisitor(request("localhost:3107"))).toEqual({ visitorId: "local", via: "local" });
    expect(nhChatVisitor(request("127.0.0.1:3107"))).toEqual({ visitorId: "local", via: "local" });
    expect(nhChatVisitor(request("demo.example"))).toBeNull();
    expect(nhChatAccess(request("demo.example"))).toBeNull();
  });

  it("feiler lukket i et ukonfigurert produksjonsbygg, også med Host: localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(nhChatEnabled()).toBe(false);
    expect(nhChatAccess(request("localhost"))).toBeNull();
    // Nøkkel uten påslag (eller påslag uten nøkkel) er fortsatt av.
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", SECRET);
    expect(nhChatEnabled()).toBe(false);
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "for-kort");
    expect(nhChatEnabled()).toBe(false);
  });

  it("utsteder en signert, httpOnly besøkscookie og kjenner den igjen", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", SECRET);
    const first = nhChatAccess(request("demo.example"))!;
    expect(first.visitor.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.setCookie).toMatch(new RegExp(`^${NH_CHAT_COOKIE}=[^;]+; Path=/; Max-Age=\\d+; HttpOnly; SameSite=Lax; Secure$`));
    const cookie = first.setCookie!.split(";")[0];
    const again = nhChatAccess(request("demo.example", cookie))!;
    expect(again.visitor.visitorId).toBe(first.visitor.visitorId);
    expect(again.setCookie).toBeUndefined();
  });

  it("avviser en endret, utløpt eller fremmed cookie", () => {
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", SECRET);
    const now = Date.now();
    const issued = issueNhChatCookie(now)!;
    expect(verifyNhChatCookie(issued.value, now)?.visitorId).toBe(issued.visitorId);
    const [body, signature] = issued.value.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, visitorId: "00000000-0000-0000-0000-000000000000", exp: now + 1000 })).toString("base64url");
    expect(verifyNhChatCookie(`${forged}.${signature}`, now)).toBeNull();
    expect(verifyNhChatCookie(`${body}.${signature}x`, now)).toBeNull();
    expect(verifyNhChatCookie(issued.value, now + 15 * 24 * 60 * 60 * 1000)).toBeNull();
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "m".repeat(40));
    expect(verifyNhChatCookie(issued.value, now)).toBeNull();
  });

  it("slår bare på stemmen utenfor loopback med et eget flagg", () => {
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", SECRET);
    expect(nhChatVoiceEnabled()).toBe(false);
    vi.stubEnv("PLACY_NH_CHAT_VOICE", "true");
    expect(nhChatVoiceEnabled()).toBe(true);
  });
});
