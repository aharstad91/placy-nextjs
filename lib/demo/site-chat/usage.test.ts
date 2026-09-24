import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeDemoQuota, createMemoryUsageStore, demoMeterLimits, resolveUsageStore, type DemoMeterConfig } from "@/lib/demo/site-chat/usage";

const CHAT: DemoMeterConfig = { meter: "chat_message", envPrefix: "PLACY_LB_DEMO_CHAT", storeEnv: "PLACY_LB_DEMO_USAGE_STORE", defaults: { visitor: 60, global: 600 } };
const VOICE: DemoMeterConfig = { meter: "voice_session", envPrefix: "PLACY_LB_DEMO_VOICE", storeEnv: "PLACY_LB_DEMO_USAGE_STORE", defaults: { visitor: 8, global: 60 } };
const NH_CHAT: DemoMeterConfig = { meter: "nh_chat_message", envPrefix: "PLACY_NH_CHAT_MESSAGE", storeEnv: "PLACY_NH_CHAT_USAGE_STORE", defaults: { visitor: 40, global: 300 } };

afterEach(() => vi.unstubAllEnvs());

describe("døgnkvoter", () => {
  it("stopper besøkende ved egen grense og alle ved samlet grense", async () => {
    vi.stubEnv("PLACY_LB_DEMO_CHAT_VISITOR_DAILY", "2");
    vi.stubEnv("PLACY_LB_DEMO_CHAT_GLOBAL_DAILY", "3");
    const store = createMemoryUsageStore();
    const now = Date.UTC(2026, 8, 23, 12);
    const take = (visitor: string) => consumeDemoQuota(visitor, CHAT, { now, store });
    expect(await take("a")).toEqual({ allowed: true });
    expect(await take("a")).toEqual({ allowed: true });
    expect(await take("a")).toEqual({ allowed: false, reason: "visitor" });
    expect(await take("b")).toEqual({ allowed: true });
    expect(await take("c")).toEqual({ allowed: false, reason: "global" });
    // Nytt døgn, ny kvote.
    expect(await consumeDemoQuota("a", CHAT, { now: now + 24 * 3600 * 1000, store })).toEqual({ allowed: true });
  });

  it("holder stemme og tekst i hver sin teller", async () => {
    vi.stubEnv("PLACY_LB_DEMO_VOICE_VISITOR_DAILY", "1");
    const store = createMemoryUsageStore();
    expect(await consumeDemoQuota("a", VOICE, { store })).toEqual({ allowed: true });
    expect(await consumeDemoQuota("a", VOICE, { store })).toEqual({ allowed: false, reason: "visitor" });
    expect(await consumeDemoQuota("a", CHAT, { store })).toEqual({ allowed: true });
  });

  it("feiler lukket når lageret mangler eller kaster", async () => {
    expect(await consumeDemoQuota("a", CHAT, { store: null })).toEqual({ allowed: false, reason: "store" });
    const broken = { consume: async () => { throw new Error("nede"); } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await consumeDemoQuota("a", CHAT, { store: broken })).toEqual({ allowed: false, reason: "store" });
  });

  it("krever sentralt lager i produksjon", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveUsageStore(CHAT)).toBeNull();
  });

  it("gir trygg standard ved ugyldig miljøverdi", () => {
    vi.stubEnv("PLACY_LB_DEMO_CHAT_VISITOR_DAILY", "mange");
    expect(demoMeterLimits(CHAT).visitor).toBe(60);
  });

  it("holder hver kundes målere, grenser og lagervalg adskilt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_LB_DEMO_USAGE_STORE", "supabase");
    // Leangenbuktas lager slår ikke på Nyhavnas; Nyhavna feiler lukket til eget valg er gjort.
    expect(resolveUsageStore(CHAT)).not.toBeNull();
    expect(resolveUsageStore(NH_CHAT)).toBeNull();
    vi.stubEnv("PLACY_NH_CHAT_USAGE_STORE", "supabase");
    expect(resolveUsageStore(NH_CHAT)).not.toBeNull();
    vi.stubEnv("PLACY_NH_CHAT_MESSAGE_GLOBAL_DAILY", "12");
    expect(demoMeterLimits(NH_CHAT)).toEqual({ visitor: 40, global: 12 });
    const store = createMemoryUsageStore();
    const limits = { visitor: 1, global: 10 };
    expect(await store.consume({ meter: "chat_message", visitorId: "v", day: "2026-09-24", limits })).toEqual({ allowed: true });
    expect(await store.consume({ meter: "nh_chat_message", visitorId: "v", day: "2026-09-24", limits })).toEqual({ allowed: true });
  });

  it("feiler lukket på et ugyldig målernavn, uten å telle noe", async () => {
    const store = createMemoryUsageStore();
    const consume = vi.spyOn(store, "consume");
    expect(await consumeDemoQuota("a", { ...CHAT, meter: "Chat Message; drop" }, { store })).toEqual({ allowed: false, reason: "store" });
    expect(consume).not.toHaveBeenCalled();
  });
});
