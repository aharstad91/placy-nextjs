import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

/**
 * Kontrakt-vakter for r03.8 (PRD 3 Unit 8): self-serve konvergert til ÉN
 * pipeline (provisionReportBoard) med ratifisert async-grense:
 * insert pending → HTTP-svar umiddelbart → unstable_after() kjører pipelinen
 * in-process → completed/failed. Maskinfester status-maskinen, intern-
 * fallbacken, dup/kollisjons-sjekkene og PII-grensen i GET.
 */

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);

vi.mock("@/lib/utils/run-after-response", () => ({
  runAfterResponse: (cb: () => Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

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

// Rate-limiter er in-memory og deler tilstand på tvers av tester i samme
// modul-instans. Mock den bort slik at kontrakts-testene ikke avhenger av
// rekkefølge eller akkumulert kall-telling.
vi.mock("@/lib/utils/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => true }),
  getClientIp: () => "test-ip",
}));

// Geofence (Unit 2): default = INNENFOR kuratert dekning (area != null) slik at
// de eksisterende happy-path-testene fortsetter å provisjonere. Rejection-testene
// setter geofenceHolder.area = null (eller throwErr for fail-soft-grenen).
const geofenceHolder = vi.hoisted(() => ({
  area: { id: "ranheim", name_no: "Ranheim" } as unknown,
  warnings: [] as string[],
  throwErr: null as unknown,
}));
vi.mock("@/lib/pipeline/find-area-for-point", () => ({
  findAreaForPoint: vi.fn(async () => {
    if (geofenceHolder.throwErr) throw geofenceHolder.throwErr;
    return { area: geofenceHolder.area, warnings: geofenceHolder.warnings };
  }),
}));

import { POST, GET } from "./route";

/** Scriptbar Supabase-mock: hver await-et query-kjede resolver neste kø-element.
 *  Loggen fanger tabell + kall-kjede for assertions. */
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
    for (const m of [
      "select",
      "insert",
      "update",
      "upsert",
      "eq",
      "gte",
      "not",
      "limit",
      "single",
      "maybeSingle",
    ]) {
      builder[m] = chain(m);
    }
    (builder as { then: unknown }).then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected: (e: unknown) => unknown
    ) =>
      Promise.resolve(queue.shift() ?? { data: null, error: null }).then(
        onFulfilled,
        onRejected
      );
    return builder;
  };
  const rpcLog: Array<{ fn: string; args: unknown }> = [];
  const schema = {
    from: (t: string) => makeBuilder(t),
    rpc: (fn: string, args: unknown) => {
      rpcLog.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    },
  };
  const client = { schema: () => schema };
  return { client, log, rpcLog };
}

function opNames(entry: LogEntry): string[] {
  return entry.ops.map(([n]) => n);
}
function opArgs(entry: LogEntry, name: string): unknown[] | undefined {
  return entry.ops.find(([n]) => n === name)?.[1];
}

const VALID_BODY = {
  address: "Testvegen 12, 7030 Trondheim",
  email: "megler@example.com",
  lat: 63.4,
  lng: 10.4,
  city: "Trondheim",
  consentGiven: true,
};

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generation-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  afterCallbacks.length = 0;
  provisionMock.mockReset();
  // Default: innenfor dekning (eksisterende happy-path-tester provisjonerer)
  geofenceHolder.area = { id: "ranheim", name_no: "Ranheim" };
  geofenceHolder.warnings = [];
  geofenceHolder.throwErr = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/generation-requests — validering", () => {
  it("400 ved ugyldig JSON", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    const req = new NextRequest("http://localhost/api/generation-requests", {
      method: "POST",
      body: "ikke json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400 uten samtykke (consentGiven må være literal true)", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    const res = await POST(postRequest({ ...VALID_BODY, consentGiven: false }));
    expect(res.status).toBe(400);
  });

  it("400 ved ugyldig e-post", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    const res = await POST(postRequest({ ...VALID_BODY, email: "ikke-epost" }));
    expect(res.status).toBe(400);
  });

  it("400 når meglerkontor-navn slugger til reservert kunde (intern)", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    const res = await POST(postRequest({ ...VALID_BODY, brokerage: "Intern" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Ugyldig meglerkontor-navn");
  });
});

describe("POST — duplikat + kollisjon", () => {
  it("returnerer existing:true med id/status/url ved 7-dagers duplikat, uten insert", async () => {
    const { client, log } = makeSupabaseMock([
      {
        data: [
          {
            id: REQUEST_ID,
            address_slug: "testvegen-12",
            status: "completed",
            customer_id: "krogsveen",
            result_url: "/megler/deling/krogsveen/testvegen-12",
          },
        ],
      },
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();
    expect(body.existing).toBe(true);
    expect(body.id).toBe(REQUEST_ID);
    expect(body.status).toBe("completed");
    expect(body.url).toBe("/megler/deling/krogsveen/testvegen-12");
    // ingen insert skjedde
    expect(log.some((e) => opNames(e).includes("insert"))).toBe(false);
    expect(afterCallbacks.length).toBe(0);
  });

  it("slug-kollisjon → suffiks på request-sluggen", async () => {
    const { client, log } = makeSupabaseMock([
      { data: [] }, // dup-sjekk: tom
      { data: [{ id: "annen" }] }, // slug-sjekk: kollisjon
      { data: { id: REQUEST_ID } }, // insert
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();
    expect(body.slug).toMatch(/^testvegen-12-[0-9a-f]{6}$/);

    const insertEntry = log.find((e) => opNames(e).includes("insert"))!;
    const [inserted] = opArgs(insertEntry, "insert") as [Record<string, unknown>];
    expect(inserted.address_slug).toBe(body.slug);
  });
});

describe("POST — status-maskin + én pipeline (async-grensen)", () => {
  function happyQueue() {
    return [
      { data: [] }, // dup-sjekk
      { data: [] }, // slug-sjekk
      { data: { id: REQUEST_ID } }, // insert → id
      { data: null, error: null }, // update (completed/failed) i after()
    ];
  }

  it("svarer pending umiddelbart med provisorisk URL, pipelinen kjører i after()", async () => {
    const { client, log } = makeSupabaseMock(happyQueue());
    supabaseHolder.client = client;

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();

    expect(body.status).toBe("pending");
    expect(body.id).toBe(REQUEST_ID);
    // Unit 3: URL-en er nå delings-siden (address_slug), ikke rå board-URL
    expect(body.url).toBe("/megler/deling/intern/testvegen-12");

    // insert bar pending + profil i housing_type + intern-kunde (ingen brokerage)
    const insertEntry = log.find((e) => opNames(e).includes("insert"))!;
    const [inserted] = opArgs(insertEntry, "insert") as [Record<string, unknown>];
    expect(inserted.status).toBe("pending");
    expect(inserted.housing_type).toBe("bolig");
    expect(inserted.customer_id).toBe("intern");
    expect(inserted.consent_given).toBe(true);

    // pipelinen har IKKE kjørt ennå — den ligger i after-callbacken
    expect(provisionMock).not.toHaveBeenCalled();
    expect(afterCallbacks.length).toBe(1);
  });

  it("after(): completed med autoritativ result_url fra provision-resultatet", async () => {
    const { client, log } = makeSupabaseMock(happyQueue());
    supabaseHolder.client = client;
    // Kjernen eier sluggen — den kan avvike fra request-sluggen
    provisionMock.mockResolvedValue({
      projectId: "intern_testvegen-12b",
      productId: "prod-1",
      customerSlug: "intern",
      slug: "testvegen-12b",
      existed: false,
    });

    await POST(postRequest(VALID_BODY));
    await afterCallbacks[0]();

    expect(provisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VALID_BODY.address,
        customer: "intern",
        profile: "bolig",
        allowUpdate: false,
        confirmCoords: { lat: VALID_BODY.lat, lng: VALID_BODY.lng },
      })
    );

    const updateEntry = log.find((e) => opNames(e).includes("update"))!;
    const [updated] = opArgs(updateEntry, "update") as [Record<string, unknown>];
    expect(updated.status).toBe("completed");
    expect(updated.project_id).toBe("intern_testvegen-12b");
    // Unit 3: result_url peker på delings-siden (kanonisk url_slug), ikke boardet
    expect(updated.result_url).toBe("/megler/deling/intern/testvegen-12b");
    expect(updated.completed_at).toBeTruthy();
    // oppdatering skjer på request-id
    expect(opArgs(updateEntry, "eq")).toEqual(["id", REQUEST_ID]);
  });

  it("after(): pipeline-feil → failed + error_message", async () => {
    const { client, log } = makeSupabaseMock(happyQueue());
    supabaseHolder.client = client;
    provisionMock.mockRejectedValue(new Error("Geocode-confidence for lav"));

    await POST(postRequest(VALID_BODY));
    await afterCallbacks[0]();

    const updateEntry = log.find((e) => opNames(e).includes("update"))!;
    const [updated] = opArgs(updateEntry, "update") as [Record<string, unknown>];
    expect(updated.status).toBe("failed");
    expect(updated.error_message).toBe("Geocode-confidence for lav");
  });

  it("brokerage satt → kunde upsertes med lesbart navn og brukes som customer", async () => {
    const { client, log } = makeSupabaseMock([
      { data: null, error: null }, // customers upsert
      { data: [] }, // dup
      { data: [] }, // slug
      { data: { id: REQUEST_ID } }, // insert
    ]);
    supabaseHolder.client = client;

    const res = await POST(
      postRequest({ ...VALID_BODY, brokerage: "Eiendomsmegler Krogsveen" })
    );
    const body = await res.json();
    expect(body.url).toBe("/megler/deling/eiendomsmegler-krogsveen/testvegen-12");

    const upsertEntry = log.find((e) => e.table === "customers")!;
    const [upserted] = opArgs(upsertEntry, "upsert") as [Record<string, unknown>];
    expect(upserted).toEqual({
      id: "eiendomsmegler-krogsveen",
      name: "Eiendomsmegler Krogsveen",
    });
  });
});

describe("POST — kontor-scoping (officeSlug)", () => {
  const OFFICE_BODY = { ...VALID_BODY, officeSlug: "dnb-midtbyen-x7k2f9" };

  it("gyldig aktiv slug → pending under kontorets kunde, getOrCreateCustomer IKKE kalt", async () => {
    const { client, log } = makeSupabaseMock([
      { data: { customer_id: "dnb-midtbyen", active: true } }, // office lookup
      { data: [] }, // dup
      { data: [] }, // slug
      { data: { id: REQUEST_ID } }, // insert
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(OFFICE_BODY));
    const body = await res.json();

    expect(body.status).toBe("pending");
    expect(body.url).toBe("/megler/deling/dnb-midtbyen/testvegen-12");

    const insertEntry = log.find((e) => opNames(e).includes("insert"))!;
    const [inserted] = opArgs(insertEntry, "insert") as [Record<string, unknown>];
    expect(inserted.customer_id).toBe("dnb-midtbyen");

    // dup-sjekken er scopet på customer_id (per-kontor-dup, R16)
    const dupEntry = log.find(
      (e) => e.table === "generation_requests" && opNames(e).includes("gte")
    )!;
    const eqCalls = dupEntry.ops.filter(([n]) => n === "eq").map(([, a]) => a);
    expect(eqCalls).toContainEqual(["address_normalized", "testvegen 12, 7030 trondheim"]);
    expect(eqCalls).toContainEqual(["customer_id", "dnb-midtbyen"]);

    // ALDRI getOrCreateCustomer for kontor-inngangen (R15)
    expect(log.some((e) => e.table === "customers")).toBe(false);
  });

  it("ukjent/inaktiv slug → 404, ingen kunde-opprettelse, ingen insert/pipeline", async () => {
    const { client, log } = makeSupabaseMock([
      { data: null }, // office lookup: ukjent (eller inaktiv → filtrert bort)
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest({ ...OFFICE_BODY, officeSlug: "finnes-ikke-000000" }));
    expect(res.status).toBe(404);
    expect(log.some((e) => e.table === "customers")).toBe(false);
    expect(log.some((e) => opNames(e).includes("insert"))).toBe(false);
    expect(afterCallbacks.length).toBe(0);
  });

  it("samme adresse samme kontor innen 7 dager → dup-svar peker på delings-siden", async () => {
    const { client } = makeSupabaseMock([
      { data: { customer_id: "dnb-midtbyen", active: true } }, // office lookup
      {
        data: [
          {
            id: REQUEST_ID,
            address_slug: "testvegen-12",
            status: "completed",
            customer_id: "dnb-midtbyen",
            result_url: "/megler/deling/dnb-midtbyen/testvegen-12",
          },
        ],
      }, // dup treff
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(OFFICE_BODY));
    const body = await res.json();
    expect(body.existing).toBe(true);
    expect(body.url).toBe("/megler/deling/dnb-midtbyen/testvegen-12");
  });

  it("pending dup (result_url null) → delings-side bygd fra address_slug", async () => {
    const { client } = makeSupabaseMock([
      { data: { customer_id: "dnb-midtbyen", active: true } }, // office lookup
      {
        data: [
          {
            id: REQUEST_ID,
            address_slug: "testvegen-12",
            status: "pending",
            customer_id: "dnb-midtbyen",
            result_url: null,
          },
        ],
      }, // dup treff (pending — result_url ikke satt ennå)
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(OFFICE_BODY));
    const body = await res.json();
    expect(body.existing).toBe(true);
    expect(body.url).toBe("/megler/deling/dnb-midtbyen/testvegen-12");
  });
});

describe("POST — geofence + etterspørselslogg (R5/R6/R17)", () => {
  it("avvist adresse (åpen side) → outside_coverage + coverage_demand-rad, INGEN insert/pipeline", async () => {
    geofenceHolder.area = null;
    const { client, log, rpcLog } = makeSupabaseMock([
      { data: [{ name_no: "Ranheim" }, { name_no: "Tyholt" }] }, // coveredAreas
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("outside_coverage");
    expect(body.coveredAreas).toEqual(["Ranheim", "Tyholt"]);

    // coverage_demand logget via RPC, uten e-post (ingen opt-in), office_slug null
    expect(rpcLog).toHaveLength(1);
    expect(rpcLog[0].fn).toBe("record_coverage_demand");
    const args = rpcLog[0].args as Record<string, unknown>;
    expect(args.p_email).toBeNull();
    expect(args.p_office_slug).toBeNull();
    expect(args.p_address_normalized).toBe("testvegen 12, 7030 trondheim");

    // ingen generation_requests-insert, ingen pipeline
    expect(log.some((e) => opNames(e).includes("insert"))).toBe(false);
    expect(afterCallbacks.length).toBe(0);
  });

  it("avvisning + notifyWhenCovered=true → e-post lagret i coverage_demand (den eksplisitte andre opt-in-en)", async () => {
    geofenceHolder.area = null;
    const { client, rpcLog } = makeSupabaseMock([
      { data: [{ name_no: "Ranheim" }] }, // coveredAreas
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest({ ...VALID_BODY, notifyWhenCovered: true }));
    const body = await res.json();

    expect(body.status).toBe("outside_coverage");
    expect(body.notified).toBe(true);
    const args = rpcLog[0].args as Record<string, unknown>;
    expect(args.p_email).toBe(VALID_BODY.email);
  });

  it("fail-soft: findAreaForPoint kaster → behandles som utenfor dekning (200), ikke 500", async () => {
    geofenceHolder.throwErr = new Error("Supabase-glipp");
    const { client, rpcLog } = makeSupabaseMock([
      { data: [{ name_no: "Ranheim" }] }, // coveredAreas
    ]);
    supabaseHolder.client = client;

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("outside_coverage");
    expect(rpcLog).toHaveLength(1);
  });

  it("kontor-innsending utenfor dekning → office_slug fanget i coverage_demand", async () => {
    geofenceHolder.area = null;
    const { client, rpcLog } = makeSupabaseMock([
      { data: { customer_id: "dnb-midtbyen", active: true } }, // office lookup
      { data: [{ name_no: "Ranheim" }] }, // coveredAreas
    ]);
    supabaseHolder.client = client;

    const res = await POST(
      postRequest({ ...VALID_BODY, officeSlug: "dnb-midtbyen-x7k2f9" })
    );
    const body = await res.json();
    expect(body.status).toBe("outside_coverage");
    const args = rpcLog[0].args as Record<string, unknown>;
    expect(args.p_office_slug).toBe("dnb-midtbyen-x7k2f9");
  });
});

describe("GET — polling uten PII", () => {
  it("400 ved manglende/ugyldig id", async () => {
    supabaseHolder.client = makeSupabaseMock([]).client;
    const bad = new NextRequest(
      "http://localhost/api/generation-requests?id=ikke-uuid"
    );
    expect((await GET(bad)).status).toBe(400);
    const missing = new NextRequest("http://localhost/api/generation-requests");
    expect((await GET(missing)).status).toBe(400);
  });

  it("404 når raden ikke finnes", async () => {
    supabaseHolder.client = makeSupabaseMock([{ data: null }]).client;
    const req = new NextRequest(
      `http://localhost/api/generation-requests?id=${REQUEST_ID}`
    );
    expect((await GET(req)).status).toBe(404);
  });

  it("returnerer KUN status/resultUrl/errorMessage — aldri email (PII-grensen)", async () => {
    const { client, log } = makeSupabaseMock([
      {
        data: {
          status: "completed",
          result_url: "/eiendom/intern/testvegen-12/rapport-board",
          error_message: null,
        },
      },
    ]);
    supabaseHolder.client = client;

    const req = new NextRequest(
      `http://localhost/api/generation-requests?id=${REQUEST_ID}`
    );
    const res = await GET(req);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      "errorMessage",
      "resultUrl",
      "status",
    ]);
    // select-en ber aldri om email
    const selectArgs = opArgs(log[0], "select") as [string];
    expect(selectArgs[0]).not.toContain("email");
  });
});

describe("kildetekst-kontrakt — én pipeline, v2-targeting", () => {
  const src = readFileSync(
    join(process.cwd(), "app/api/generation-requests/route.ts"),
    "utf8"
  );

  it("kaller Unit 1-kjernen, ikke de døde v1-modulene", () => {
    expect(src).toContain("provisionReportBoard");
    expect(src).not.toContain("createGeneratedProject");
    expect(src).not.toContain("getHousingCategories");
    expect(src).not.toContain("importPOIsToProject");
  });

  it("targeter v2-skjemaet og bevarer async-grensen uten jobbkø", () => {
    expect(src).toContain('schema("v2")');
    expect(src).toContain("runAfterResponse");
    expect(src).toContain("maxDuration = 300");
    expect(src).not.toMatch(/queue|bull|inngest|trigger\.dev/i);
  });
});
