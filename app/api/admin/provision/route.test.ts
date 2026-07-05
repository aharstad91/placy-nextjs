import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

/**
 * Kontrakt-vakter for r12.4 (PRD 12 Unit 4): kanonisk admin-provisjon-inngang
 * — requireAdmin-gated, fire-and-poll via generation_requests (samme status-
 * maskin som self-serve), kaller PRD 3-kjernen (aldri story-writer/legacy).
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
    for (const m of ["select", "insert", "update", "upsert", "eq", "gte", "limit", "single", "maybeSingle"]) {
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

const VALID_BODY = {
  address: "Testvegen 12, 7030 Trondheim",
  customer: "koteng",
  profile: "bolig",
  reportTier: 2,
  has3dAddon: true,
  allowUpdate: false,
  lat: 63.4,
  lng: 10.4,
  city: "Trondheim",
};

const REQUEST_ID = "22222222-3333-4444-8555-666666666666";

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/provision", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  afterCallbacks.length = 0;
  provisionMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("gate (AC5)", () => {
  it("403 når ADMIN_ENABLED er av", async () => {
    vi.stubEnv("ADMIN_ENABLED", "false");
    supabaseHolder.client = makeSupabaseMock([]).client;
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });
});

describe("fire-and-poll (AC1/AC4)", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_ENABLED", "true");
  });

  it("400 ved ugyldig tier (3 avvises av OptionalReportTierSchema)", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    const res = await POST(postRequest({ ...VALID_BODY, reportTier: 3 }));
    expect(res.status).toBe(400);
  });

  it("svarer pending umiddelbart; jobb-record pending med profil i housing_type", async () => {
    const { client, log } = makeSupabaseMock([
      { data: [] }, // slug-sjekk
      { data: { id: REQUEST_ID } }, // insert
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();

    expect(body.status).toBe("pending");
    expect(body.id).toBe(REQUEST_ID);
    expect(body.url).toBe("/eiendom/koteng/testvegen-12/rapport-board");

    const insertEntry = log.find((e) => e.ops.some(([n]) => n === "insert"))!;
    const [inserted] = opArgs(insertEntry, "insert") as [Record<string, unknown>];
    expect(inserted.status).toBe("pending");
    expect(inserted.housing_type).toBe("bolig");
    expect(inserted.customer_id).toBe("koteng");
    expect(inserted.email).toBe("operator@placy.no");

    expect(provisionMock).not.toHaveBeenCalled();
    expect(afterCallbacks.length).toBe(1);
  });

  it("after(): kaller PRD 3-kjernen med tier/3d/coords og skriver completed", async () => {
    const { client, log } = makeSupabaseMock([
      { data: [] },
      { data: { id: REQUEST_ID } },
      { data: null, error: null }, // update
    ]);
    supabaseHolder.client = client;
    provisionMock.mockResolvedValue({
      projectId: "koteng_testvegen-12",
      productId: "p1",
      customerSlug: "koteng",
      slug: "testvegen-12",
      existed: false,
    });

    await POST(postRequest(VALID_BODY));
    await afterCallbacks[0]();

    expect(provisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "koteng",
        profile: "bolig",
        reportTier: 2,
        has3dAddon: true,
        allowUpdate: false,
        confirmCoords: { lat: 63.4, lng: 10.4 },
      })
    );

    const updateEntry = log.find((e) => e.ops.some(([n]) => n === "update"))!;
    const [updated] = opArgs(updateEntry, "update") as [Record<string, unknown>];
    expect(updated.status).toBe("completed");
    expect(updated.result_url).toBe("/eiendom/koteng/testvegen-12/rapport-board");
  });

  it("after(): pipeline-feil → failed + error_message", async () => {
    const { client, log } = makeSupabaseMock([
      { data: [] },
      { data: { id: REQUEST_ID } },
      { data: null, error: null },
    ]);
    supabaseHolder.client = client;
    provisionMock.mockRejectedValue(new Error("Finner ikke adresse"));

    await POST(postRequest(VALID_BODY));
    await afterCallbacks[0]();

    const updateEntry = log.find((e) => e.ops.some(([n]) => n === "update"))!;
    const [updated] = opArgs(updateEntry, "update") as [Record<string, unknown>];
    expect(updated.status).toBe("failed");
    expect(updated.error_message).toBe("Finner ikke adresse");
  });
});

describe("kildetekst-kontrakt (AC1/AC2/AC3)", () => {
  const routeSrc = readFileSync(
    join(process.cwd(), "app/api/admin/provision/route.ts"),
    "utf8"
  );
  const clientSrc = readFileSync(
    join(process.cwd(), "app/admin/generate/generate-client.tsx"),
    "utf8"
  );

  it("ruta kaller PRD 3-kjernen — aldri story-writer/legacy generate", () => {
    expect(routeSrc).toContain("provisionReportBoard");
    expect(routeSrc).not.toContain("story-writer");
    expect(routeSrc).toContain("requireAdminApi");
    expect(routeSrc).toContain("maxDuration = 300");
  });

  it("klienten er Mapbox-fri og treffer provisjon-ruta (ikke story-writer)", () => {
    expect(clientSrc).not.toContain("react-map-gl");
    expect(clientSrc).not.toContain("story-writer");
    expect(clientSrc).not.toContain("/api/generate");
    expect(clientSrc).toContain("/api/admin/provision");
  });

  it("ingen runtime-LLM i request-pathen", () => {
    for (const bad of ["gemini", "anthropic", "openai", "generateContent"]) {
      expect(routeSrc.toLowerCase()).not.toContain(bad);
    }
  });
});
