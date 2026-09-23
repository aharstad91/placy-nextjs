import "server-only";

import { createServerClient } from "@/lib/supabase/client";

/**
 * Forbruksgrensene for Leangenbukta-kundedemoen (2026-09-23).
 *
 * ## Hva som telles
 *
 * Én meldingstelling for tekstchatten og én sesjonstelling for stemmen, per
 * besøkende og samlet, per døgn (UTC). Ingen meldingstekst, ingen sidetekst og
 * ingen IP lagres — bare meter, besøks-ID fra tilgangscookien, døgn og antall.
 * Grensen håndheves FØR modellkallet, så en brukt kvote koster ingenting.
 *
 * ## Hvorfor to lagre
 *
 * En delt demo kjører på flere serverinstanser samtidig. En teller i minnet ville
 * vært én teller per instans, og kvoten ville i praksis vært ubegrenset. Derfor
 * krever et produksjonsbygg det sentrale lageret (`PLACY_LB_DEMO_USAGE_STORE=
 * supabase`, migrasjon `098_demo_usage.sql`) og NEKTER hvis det mangler eller
 * feiler. Minnelageret finnes bare for lokal utvikling og tester.
 *
 * OpenAI-prosjektets harde månedstak er bakstopperen; denne telleren er det som
 * faktisk stopper en løpsk økt før taket nås.
 */

export type DemoMeter = "chat_message" | "voice_session";

export interface DemoQuotaDecision {
  allowed: boolean;
  /** Hvorfor det ble nei: besøkendes døgnkvote, samlet døgnkvote, eller lageret. */
  reason?: "visitor" | "global" | "store";
}

interface MeterLimits {
  visitor: number;
  global: number;
}

const DEFAULT_LIMITS: Record<DemoMeter, MeterLimits> = {
  chat_message: { visitor: 60, global: 600 },
  voice_session: { visitor: 8, global: 60 },
};

const ENV_PREFIX: Record<DemoMeter, string> = {
  chat_message: "PLACY_LB_DEMO_CHAT",
  voice_session: "PLACY_LB_DEMO_VOICE",
};

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  // En skrivefeil i miljøet skal gi den trygge standarden, ikke ubegrenset.
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function demoMeterLimits(meter: DemoMeter): MeterLimits {
  const prefix = ENV_PREFIX[meter];
  return {
    visitor: positiveInt(process.env[`${prefix}_VISITOR_DAILY`], DEFAULT_LIMITS[meter].visitor),
    global: positiveInt(process.env[`${prefix}_GLOBAL_DAILY`], DEFAULT_LIMITS[meter].global),
  };
}

export interface DemoUsageStore {
  /** Øker begge tellerne atomisk hvis begge er under grensen. */
  consume(input: { meter: DemoMeter; visitorId: string; day: string; limits: MeterLimits }): Promise<DemoQuotaDecision>;
}

export function createMemoryUsageStore(): DemoUsageStore {
  const counts = new Map<string, number>();
  return {
    async consume({ meter, visitorId, day, limits }) {
      const visitorKey = `${meter}:${day}:v:${visitorId}`;
      const globalKey = `${meter}:${day}:global`;
      const visitor = counts.get(visitorKey) ?? 0;
      const global = counts.get(globalKey) ?? 0;
      if (visitor >= limits.visitor) return { allowed: false, reason: "visitor" };
      if (global >= limits.global) return { allowed: false, reason: "global" };
      counts.set(visitorKey, visitor + 1);
      counts.set(globalKey, global + 1);
      return { allowed: true };
    },
  };
}

export function createSupabaseUsageStore(): DemoUsageStore {
  return {
    async consume({ meter, visitorId, day, limits }) {
      // RPC-en er ikke i de genererte typene før migrasjonen er kjørt og typene
      // regenerert; kallet valideres derfor av svaret, ikke av typene.
      const v2 = createServerClient().schema("v2") as unknown as {
        rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await v2.rpc("demo_usage_consume", {
        p_meter: meter,
        p_visitor: visitorId,
        p_day: day,
        p_visitor_limit: limits.visitor,
        p_global_limit: limits.global,
      });
      if (error) throw new Error(`demo_usage_consume: ${error.message}`);
      if (data === "ok") return { allowed: true };
      if (data === "visitor" || data === "global") return { allowed: false, reason: data };
      throw new Error("demo_usage_consume: ukjent svar");
    },
  };
}

let memoryStore: DemoUsageStore | null = null;

/** Lageret dette miljøet skal bruke, eller null når ingen trygg teller finnes. */
export function resolveUsageStore(): DemoUsageStore | null {
  if (process.env.PLACY_LB_DEMO_USAGE_STORE === "supabase") return createSupabaseUsageStore();
  if (process.env.NODE_ENV === "production") return null;
  memoryStore ??= createMemoryUsageStore();
  return memoryStore;
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Trekker én enhet av kvoten, eller sier nei. Feiler lukket: et utilgjengelig
 * lager gir nei, aldri et ubegrenset ja.
 */
export async function consumeDemoQuota(
  visitorId: string,
  meter: DemoMeter,
  options: { now?: number; store?: DemoUsageStore | null } = {},
): Promise<DemoQuotaDecision> {
  const store = options.store === undefined ? resolveUsageStore() : options.store;
  if (!store) return { allowed: false, reason: "store" };
  try {
    return await store.consume({
      meter,
      visitorId,
      day: utcDay(options.now ?? Date.now()),
      limits: demoMeterLimits(meter),
    });
  } catch (error) {
    console.error("lb_demo_usage_store_failed", error instanceof Error ? error.message : "unknown");
    return { allowed: false, reason: "store" };
  }
}
