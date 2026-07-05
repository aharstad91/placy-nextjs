import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Kontrakt-vakter for r12.3 (PRD 12 Unit 3): reportTier-setteren er
 * read-modify-write av JSONB-config (aldri flat kolonne), validerer input
 * FØR skriving, bevarer resten av config, og returnerer readiness-funn
 * som forhåndsvisning (deklarasjon+validering — aldri render-gating).
 */

vi.mock("server-only", () => ({}));

const supabaseHolder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/client", () => ({
  createServerClient: () => supabaseHolder.client,
}));

import { setReportTier } from "./set-report-tier";

interface LogEntry {
  table: string;
  ops: Array<[string, unknown[]]>;
}

function makeSupabaseMock(queue: Array<{ data?: unknown; error?: unknown }>) {
  const log: LogEntry[] = [];
  const makeBuilder = (table: string) => {
    const entry: LogEntry = { table, ops: [] };
    log.push(entry);
    const builder: Record<string, unknown> = {};
    const chain =
      (name: string) =>
      (...args: unknown[]) => {
        entry.ops.push([name, args]);
        return builder;
      };
    for (const m of ["select", "update", "eq", "maybeSingle"]) {
      builder[m] = chain(m);
    }
    (builder as { then: unknown }).then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected: (e: unknown) => unknown
    ) =>
      Promise.resolve(queue.shift() ?? { data: null, error: null }).then(onFulfilled, onRejected);
    return builder;
  };
  return {
    client: { schema: () => ({ from: (t: string) => makeBuilder(t) }) },
    log,
  };
}

function updatePayload(log: LogEntry[]): Record<string, unknown> {
  const entry = log.find((e) => e.ops.some(([n]) => n === "update"))!;
  const [payload] = entry.ops.find(([n]) => n === "update")![1] as [Record<string, unknown>];
  return payload;
}

const EXISTING_CONFIG = {
  reportConfig: {
    themes: [
      { id: "transport", name: "Transport", editorial: { body: "Kuratert tekst." } },
    ],
    heroIntro: "bevart",
  },
  discoveryRadiusMeters: 1500,
};

beforeEach(() => {
  supabaseHolder.client = null;
});

describe("setReportTier", () => {
  it("avviser ugyldig tier FØR noe leses/skrives (3, '2', 0)", async () => {
    const { client, log } = makeSupabaseMock([]);
    supabaseHolder.client = client;
    for (const bad of [3, "2", 0]) {
      await expect(setReportTier({ productId: "p1", reportTier: bad })).rejects.toThrow(
        /Ugyldig reportTier/
      );
    }
    expect(log.length).toBe(0);
  });

  it("read-modify-write: setter tier og BEVARER resten av config", async () => {
    const { client, log } = makeSupabaseMock([
      { data: { id: "p1", config: EXISTING_CONFIG } },
      { data: null, error: null },
    ]);
    supabaseHolder.client = client;

    const result = await setReportTier({ productId: "p1", reportTier: 2 });

    const payload = updatePayload(log);
    const cfg = payload.config as typeof EXISTING_CONFIG & {
      reportConfig: { reportTier?: number };
    };
    expect(cfg.reportConfig.reportTier).toBe(2);
    expect(cfg.reportConfig.heroIntro).toBe("bevart");
    expect(cfg.discoveryRadiusMeters).toBe(1500);
    expect(result.reportTier).toBe(2);
  });

  it("undefined fjerner deklarasjonen (nivå 1-default, feltet utelates)", async () => {
    const configWithTier = {
      ...EXISTING_CONFIG,
      reportConfig: { ...EXISTING_CONFIG.reportConfig, reportTier: 2 },
    };
    const { client, log } = makeSupabaseMock([
      { data: { id: "p1", config: configWithTier } },
      { data: null, error: null },
    ]);
    supabaseHolder.client = client;

    const result = await setReportTier({ productId: "p1", reportTier: undefined });

    const payload = updatePayload(log);
    const rc = (payload.config as { reportConfig: Record<string, unknown> }).reportConfig;
    expect("reportTier" in rc).toBe(false);
    expect(result.reportTier).toBeUndefined();
  });

  it("returnerer readiness-funn som forhåndsvisning ved nivå 2 uten dekning", async () => {
    const bareConfig = {
      reportConfig: { themes: [{ id: "transport", name: "Transport" }] },
    };
    const { client } = makeSupabaseMock([
      { data: { id: "p1", config: bareConfig } },
      { data: null, error: null },
    ]);
    supabaseHolder.client = client;

    const result = await setReportTier({ productId: "p1", reportTier: 2 });
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.level === "error")).toBe(true);
  });

  it("kaster ved ukjent produkt og ved skrive-feil (eksplisitt error-håndtering)", async () => {
    const missing = makeSupabaseMock([{ data: null }]);
    supabaseHolder.client = missing.client;
    await expect(setReportTier({ productId: "ukjent", reportTier: 1 })).rejects.toThrow(
      /ikke funnet/
    );

    const writeFail = makeSupabaseMock([
      { data: { id: "p1", config: EXISTING_CONFIG } },
      { data: null, error: { message: "RLS says no" } },
    ]);
    supabaseHolder.client = writeFail.client;
    await expect(setReportTier({ productId: "p1", reportTier: 1 })).rejects.toThrow(
      /Kunne ikke skrive/
    );
  });
});
