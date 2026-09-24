import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeDemoQuota, createMemoryUsageStore, demoMeterLimits, resolveUsageStore } from "@/lib/demo/leangenbukta-site/usage";

afterEach(() => vi.unstubAllEnvs());

describe("døgnkvoter", () => {
  it("stopper besøkende ved egen grense og alle ved samlet grense", async () => {
    vi.stubEnv("PLACY_LB_DEMO_CHAT_VISITOR_DAILY", "2");
    vi.stubEnv("PLACY_LB_DEMO_CHAT_GLOBAL_DAILY", "3");
    const store = createMemoryUsageStore();
    const now = Date.UTC(2026, 8, 23, 12);
    const take = (visitor: string) => consumeDemoQuota(visitor, "chat_message", { now, store });
    expect(await take("a")).toEqual({ allowed: true });
    expect(await take("a")).toEqual({ allowed: true });
    expect(await take("a")).toEqual({ allowed: false, reason: "visitor" });
    expect(await take("b")).toEqual({ allowed: true });
    expect(await take("c")).toEqual({ allowed: false, reason: "global" });
    // Nytt døgn, ny kvote.
    expect(await consumeDemoQuota("a", "chat_message", { now: now + 24 * 3600 * 1000, store })).toEqual({ allowed: true });
  });

  it("holder stemme og tekst i hver sin teller", async () => {
    vi.stubEnv("PLACY_LB_DEMO_VOICE_VISITOR_DAILY", "1");
    const store = createMemoryUsageStore();
    expect(await consumeDemoQuota("a", "voice_session", { store })).toEqual({ allowed: true });
    expect(await consumeDemoQuota("a", "voice_session", { store })).toEqual({ allowed: false, reason: "visitor" });
    expect(await consumeDemoQuota("a", "chat_message", { store })).toEqual({ allowed: true });
  });

  it("feiler lukket når lageret mangler eller kaster", async () => {
    expect(await consumeDemoQuota("a", "chat_message", { store: null })).toEqual({ allowed: false, reason: "store" });
    const broken = { consume: async () => { throw new Error("nede"); } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await consumeDemoQuota("a", "chat_message", { store: broken })).toEqual({ allowed: false, reason: "store" });
  });

  it("krever sentralt lager i produksjon", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveUsageStore()).toBeNull();
  });

  it("gir trygg standard ved ugyldig miljøverdi", () => {
    vi.stubEnv("PLACY_LB_DEMO_CHAT_VISITOR_DAILY", "mange");
    expect(demoMeterLimits("chat_message").visitor).toBe(60);
  });

  it("holder Nyhavnas målere, grenser og lagervalg adskilt fra Leangenbuktas", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_LB_DEMO_USAGE_STORE", "supabase");
    // Leangenbuktas lager slår ikke på Nyhavnas; Nyhavna feiler lukket til eget valg er gjort.
    expect(resolveUsageStore("chat_message")).not.toBeNull();
    expect(resolveUsageStore("nh_chat_message")).toBeNull();
    expect(resolveUsageStore("nh_voice_session")).toBeNull();
    vi.stubEnv("PLACY_NH_CHAT_USAGE_STORE", "supabase");
    expect(resolveUsageStore("nh_chat_message")).not.toBeNull();
    vi.stubEnv("PLACY_NH_CHAT_MESSAGE_GLOBAL_DAILY", "12");
    expect(demoMeterLimits("nh_chat_message")).toEqual({ visitor: 40, global: 12 });
    expect(demoMeterLimits("nh_voice_session")).toEqual({ visitor: 5, global: 30 });
    const store = createMemoryUsageStore();
    const limits = { visitor: 1, global: 10 };
    expect(await store.consume({ meter: "chat_message", visitorId: "v", day: "2026-09-24", limits })).toEqual({ allowed: true });
    expect(await store.consume({ meter: "nh_chat_message", visitorId: "v", day: "2026-09-24", limits })).toEqual({ allowed: true });
  });
});
