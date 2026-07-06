import { describe, it, expect, vi, beforeEach } from "vitest";

const { insertMock, createServerClientMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: createServerClientMock,
}));

import { logEvent } from "./log-event";

beforeEach(() => {
  insertMock.mockReset();
  createServerClientMock.mockReset();
  // standard: klient-kjede der .schema().from().insert() returnerer insertMock
  createServerClientMock.mockReturnValue({
    schema: () => ({ from: () => ({ insert: insertMock }) }),
  });
});

describe("logEvent", () => {
  it("happy path: gyldig input → INSERT med riktig shape + server-injisert session_id", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({ eventType: "category_opened", projectId: "placy-demo_ranheim", payload: { category_id: "cafe" } });
    expect(insertMock).toHaveBeenCalledOnce();
    const row = insertMock.mock.calls[0][0];
    expect(row.event_type).toBe("category_opened");
    expect(row.project_id).toBe("placy-demo_ranheim");
    expect(row.product_id).toBeNull();
    expect(row.payload).toEqual({ category_id: "cafe" });
    expect(typeof row.session_id).toBe("string");
    expect(row.session_id.length).toBeGreaterThan(0);
  });

  it("kalleren kan IKKE sette session_id direkte (kun validert sessionId-input)", async () => {
    insertMock.mockResolvedValue({ error: null });
    // @ts-expect-error session_id finnes ikke på LogEventInput
    await logEvent({ eventType: "board_viewed", session_id: "spoofed" });
    expect(insertMock.mock.calls[0][0].session_id).not.toBe("spoofed");
  });

  it("gyldig klient-sessionId (UUID v4) → brukes verbatim (økt-gruppering)", async () => {
    insertMock.mockResolvedValue({ error: null });
    const clientId = "6f1e0d3a-2b4c-4e5f-89ab-0123456789ab";
    await logEvent({ eventType: "board_viewed", sessionId: clientId });
    await logEvent({ eventType: "poi_clicked", poiId: "x", sessionId: clientId });
    expect(insertMock.mock.calls[0][0].session_id).toBe(clientId);
    expect(insertMock.mock.calls[1][0].session_id).toBe(clientId);
  });

  it("ugyldig sessionId-form (ikke-UUID) → avvises, fersk server-id i stedet", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({
      eventType: "board_viewed",
      sessionId: "andreas@example.com", // PII-/injection-forsøk
    });
    const row = insertMock.mock.calls[0][0];
    expect(row.session_id).not.toBe("andreas@example.com");
    expect(typeof row.session_id).toBe("string");
    expect(row.session_id.length).toBeGreaterThan(0);
  });

  it("ukjent event_type → ingen INSERT, kaster ikke", async () => {
    await expect(logEvent({ eventType: "bogus" as never })).resolves.toBeUndefined();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("INSERT returnerer error → fail-soft (resolver, kaster ikke)", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    await expect(logEvent({ eventType: "board_viewed" })).resolves.toBeUndefined();
  });

  it("createServerClient kaster (manglende nøkkel) → fail-soft", async () => {
    createServerClientMock.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY mangler");
    });
    await expect(logEvent({ eventType: "board_viewed" })).resolves.toBeUndefined();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("synkron throw i insert-kjeden → fail-soft", async () => {
    insertMock.mockImplementation(() => {
      throw new Error("uventet");
    });
    await expect(logEvent({ eventType: "poi_clicked", poiId: "x" })).resolves.toBeUndefined();
  });
});

// Audit-herding 2026-07-06: skjema-validering + volum-demping.
describe("logEvent — herding (validering + demping)", () => {
  it("ukjent payload-nøkkel → avvist, ingen INSERT (jsonb-forgiftning stoppet)", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({
      eventType: "category_opened",
      payload: { category_id: "cafe", evil: "x".repeat(10) } as never,
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("over-stor payload (multi-KB) → avvist på total-cap, ingen INSERT", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({
      eventType: "voiceover_played",
      payload: { voiceover_segment: "x".repeat(50_000) } as never,
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("ugyldig projectId-form → avvist, ingen INSERT", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({ eventType: "board_viewed", projectId: "ikke-en-gyldig-id" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("gyldig productId (UUID) beholdes; ugyldig productId → avvist", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({
      eventType: "board_viewed",
      productId: "6f1e0d3a-2b4c-4e5f-89ab-0123456789ab",
    });
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock.mock.calls[0][0].product_id).toBe(
      "6f1e0d3a-2b4c-4e5f-89ab-0123456789ab",
    );

    insertMock.mockClear();
    await logEvent({ eventType: "board_viewed", productId: "not-a-uuid" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("poiId på ikke-poi_clicked → avvist (attribusjon lekker ikke)", async () => {
    insertMock.mockResolvedValue({ error: null });
    await logEvent({ eventType: "board_viewed", poiId: "ChIJxyz" } as never);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("gyldig kontekst-konvolutt beholdes verbatim i payload", async () => {
    insertMock.mockResolvedValue({ error: null });
    const context = {
      mode: "report" as const,
      has_3d_addon: true,
      categories_presented: ["home", "mat-drikke"],
      locale: "no",
    };
    await logEvent({ eventType: "board_viewed", payload: { context } });
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock.mock.calls[0][0].payload).toEqual({ context });
  });

  it("volum-demping: replay av ÉN session-id kveles etter taket (fail-soft drop)", async () => {
    insertMock.mockResolvedValue({ error: null });
    const sessionId = "6f1e0d3a-2b4c-4e5f-89ab-0123456789ab";
    // 120 er per-session-taket; kjør godt over og verifiser at minst ett dempes.
    for (let i = 0; i < 200; i++) {
      await logEvent({ eventType: "board_viewed", sessionId });
    }
    expect(insertMock.mock.calls.length).toBeLessThan(200);
    expect(insertMock.mock.calls.length).toBeGreaterThan(0);
  });
});
