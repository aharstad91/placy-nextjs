import { describe, expect, it, vi } from "vitest";
import { askBoardChat, parseBoardChatReply, parseDirectives } from "@/lib/board-agent/client";
import { BOARD_CHAT_ENDPOINT } from "@/lib/board-agent/types";

const board = { selectedCategoryId: null, selectedPlaceId: "dora-1", travelMode: "walk" as const };
const reply = { reply: "Dora 1 Bowling ligger i Dora.", answerType: "fact", links: [], sources: [], notice: null, transcript: "tok", datasetVersion: "v1", directives: [] };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("parseDirectives", () => {
  it("beholder bare kjente kartkommandoer, i rekkefølge og med tak", () => {
    const result = parseDirectives([
      { name: "highlight_places", args: { poi_ids: ["a"] } },
      { name: "reset_board", args: {} },
      { name: "eval", args: {} },
      { name: "show_place", args: ["ikke", "objekt"] },
      { name: "show_category", args: { category_id: "x" } },
      { name: "set_travel_mode", args: { mode: "bike" } },
      { name: "clear_highlights" },
    ]);
    expect(result.map((d) => d.name)).toEqual(["highlight_places", "show_place", "show_category", "set_travel_mode"]);
    expect(result[1].args).toEqual({});
  });
});

describe("parseBoardChatReply", () => {
  it("avviser svar uten tekst, token eller kjent svartype", () => {
    expect(parseBoardChatReply({ ...reply, reply: "" })).toBeNull();
    expect(parseBoardChatReply({ ...reply, transcript: undefined })).toBeNull();
    expect(parseBoardChatReply({ ...reply, answerType: "maybe" })).toBeNull();
  });

  it("dropper lenker med farlige eller ukjente adresser", () => {
    const parsed = parseBoardChatReply({ ...reply, links: [
      { id: "contact", label: "Kontakt", href: "https://nyhavna.no/kontakt" },
      { id: "x", label: "X", href: "javascript:alert(1)" },
      { id: "page", label: "Side", href: "/demo/nyhavna-nettside" },
    ] });
    expect(parsed?.links.map((l) => l.id)).toEqual(["contact", "page"]);
  });
});

describe("kilder", () => {
  it("viser samme kilde bare én gang selv om flere registerposter peker dit", () => {
    const parsed = parseBoardChatReply({ ...reply, sources: [
      { id: "a", label: "havetarena.no", page: "https://havetarena.no", checkedAt: "2026-09-14" },
      { id: "b", label: "havetarena.no", page: "https://havetarena.no", checkedAt: "2026-09-14" },
      { id: "c", label: "Dora Eiendom", page: "https://dora.no", checkedAt: "2026-09-13" },
    ] });
    expect(parsed?.sources.map((s) => s.id)).toEqual(["a", "c"]);
  });
});

describe("askBoardChat", () => {
  it("sender intensjon, token og kartstatus, og leser svaret", async () => {
    const fetchImpl = vi.fn(async () => json(200, reply));
    const outcome = await askBoardChat({ intent: { kind: "place", poiId: "dora-1" }, transcript: "old", board }, new AbortController().signal, fetchImpl as unknown as typeof fetch);
    expect(outcome).toMatchObject({ ok: true, reply: { reply: reply.reply, transcript: "tok" } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(BOARD_CHAT_ENDPOINT);
    expect(JSON.parse(String(init.body))).toEqual({ pageId: "board", intent: { kind: "place", poiId: "dora-1" }, transcript: "old", board });
  });

  it("gir serverens feiltekst videre, og en fast tekst når den mangler", async () => {
    const quota = await askBoardChat({ message: "hei", transcript: null, board }, new AbortController().signal, (async () => json(429, { error: "Kvoten er brukt." })) as unknown as typeof fetch);
    expect(quota).toMatchObject({ ok: false, aborted: false, status: 429, error: "Kvoten er brukt." });
    const broken = await askBoardChat({ message: "hei", transcript: null, board }, new AbortController().signal, (async () => new Response("oops", { status: 502 })) as unknown as typeof fetch);
    expect(broken).toMatchObject({ ok: false, status: 502 });
  });

  it("et avbrutt kall er et avbrudd, ikke en feil", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => { controller.abort(); throw Object.assign(new Error("aborted"), { name: "AbortError" }); });
    expect(await askBoardChat({ message: "hei", transcript: null, board }, controller.signal, fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, aborted: true });
  });

  it("nettverksbrudd gir en forståelig feil uten status", async () => {
    const outcome = await askBoardChat({ message: "hei", transcript: null, board }, new AbortController().signal, (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch);
    expect(outcome).toMatchObject({ ok: false, aborted: false, status: 0 });
  });
});
