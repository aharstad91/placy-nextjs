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
    await logEvent({ eventType: "category_opened", projectId: "p1", payload: { category_id: "cafe" } });
    expect(insertMock).toHaveBeenCalledOnce();
    const row = insertMock.mock.calls[0][0];
    expect(row.event_type).toBe("category_opened");
    expect(row.project_id).toBe("p1");
    expect(row.product_id).toBeNull();
    expect(row.payload).toEqual({ category_id: "cafe" });
    expect(typeof row.session_id).toBe("string");
    expect(row.session_id.length).toBeGreaterThan(0);
  });

  it("kalleren kan IKKE sette session_id (injiseres server-side)", async () => {
    insertMock.mockResolvedValue({ error: null });
    // @ts-expect-error session_id finnes ikke på LogEventInput
    await logEvent({ eventType: "board_viewed", session_id: "spoofed" });
    expect(insertMock.mock.calls[0][0].session_id).not.toBe("spoofed");
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
