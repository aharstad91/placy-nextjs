import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Kontrakt-vakter for r12.5 (PRD 12 Unit 5 AC2): retry re-armer failed-raden
 * (pending + error_message=null + updated_at) OG re-kjører PRD 3-pipelinen —
 * samme fire-and-poll som self-serve/admin-provisjon.
 */

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock("@/lib/utils/run-after-response", () => ({
  runAfterResponse: (cb: () => Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

vi.mock("server-only", () => ({}));

const supabaseHolder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/client", () => ({
  createServerClient: () => supabaseHolder.client,
}));

const provisionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pipeline/provision", () => ({
  provisionReportBoard: provisionMock,
}));

vi.mock("@/lib/pipeline/create-report-project", () => ({
  DEFAULT_CUSTOMER: "intern",
}));

import { POST } from "./route";

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
    for (const m of ["select", "insert", "update", "eq", "limit", "single", "maybeSingle"]) {
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

function opArgs(entry: LogEntry, name: string): unknown[] | undefined {
  return entry.ops.find(([n]) => n === name)?.[1];
}

const REQUEST_ID = "33333333-4444-5555-8666-777777777777";
const FAILED_ROW = {
  id: REQUEST_ID,
  address: "Testvegen 12, 7030 Trondheim",
  customer_id: "koteng",
  housing_type: "bolig",
  geocoded_lat: 63.4,
  geocoded_lng: 10.4,
  geocoded_city: "Trondheim",
};

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/retry-request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_ENABLED", "true");
  afterCallbacks.length = 0;
  provisionMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/retry-request", () => {
  it("403 når admin er av", async () => {
    vi.stubEnv("ADMIN_ENABLED", "false");
    supabaseHolder.client = makeSupabaseMock([]).client;
    expect((await POST(postRequest({ id: REQUEST_ID }))).status).toBe(403);
  });

  it("400 ved ugyldig id", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    expect((await POST(postRequest({ id: "ikke-uuid" }))).status).toBe(400);
  });

  it("404 når ingen failed-rad matcher", async () => {
    supabaseHolder.client = makeSupabaseMock([{ data: null }]).client;
    expect((await POST(postRequest({ id: REQUEST_ID }))).status).toBe(404);
  });

  it("re-armer raden (pending + nullstilt feil + updated_at) og re-kjører pipelinen", async () => {
    const { client, log } = makeSupabaseMock([
      { data: FAILED_ROW }, // oppslag
      { data: null, error: null }, // re-arm update
      { data: null, error: null }, // completed update i after()
    ]);
    supabaseHolder.client = client;
    provisionMock.mockResolvedValue({
      projectId: "koteng_testvegen-12",
      productId: "p1",
      customerSlug: "koteng",
      slug: "testvegen-12",
      existed: true,
    });

    const res = await POST(postRequest({ id: REQUEST_ID }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, status: "pending" });

    // re-arm-update med alle tre feltene, WHERE failed
    const armEntry = log.find((e) => e.ops.some(([n]) => n === "update"))!;
    const [armed] = opArgs(armEntry, "update") as [Record<string, unknown>];
    expect(armed.status).toBe("pending");
    expect(armed.error_message).toBeNull();
    expect(armed.updated_at).toBeTruthy();
    const eqCalls = armEntry.ops.filter(([n]) => n === "eq").map(([, a]) => a);
    expect(eqCalls).toContainEqual(["id", REQUEST_ID]);
    expect(eqCalls).toContainEqual(["status", "failed"]);

    // pipelinen re-kjøres i after() med radens data + allowUpdate
    expect(afterCallbacks.length).toBe(1);
    await afterCallbacks[0]();
    expect(provisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: FAILED_ROW.address,
        customer: "koteng",
        profile: "bolig",
        allowUpdate: true,
        confirmCoords: { lat: 63.4, lng: 10.4 },
      })
    );

    const updateEntries = log.filter((e) => e.ops.some(([n]) => n === "update"));
    const [completed] = opArgs(updateEntries[updateEntries.length - 1], "update") as [
      Record<string, unknown>,
    ];
    expect(completed.status).toBe("completed");
    expect(completed.result_url).toBe("/eiendom/koteng/testvegen-12/rapport-board");
  });

  it("pipeline-feil ved retry → failed + error_message på nytt", async () => {
    const { client, log } = makeSupabaseMock([
      { data: FAILED_ROW },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    supabaseHolder.client = client;
    provisionMock.mockRejectedValue(new Error("Discovery timet ut"));

    await POST(postRequest({ id: REQUEST_ID }));
    await afterCallbacks[0]();

    const updateEntries = log.filter((e) => e.ops.some(([n]) => n === "update"));
    const [failed] = opArgs(updateEntries[updateEntries.length - 1], "update") as [
      Record<string, unknown>,
    ];
    expect(failed.status).toBe("failed");
    expect(failed.error_message).toBe("Discovery timet ut");
  });
});
