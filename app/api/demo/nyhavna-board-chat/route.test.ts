import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { BOARD_CHAT_PAGE_ID } from "@/lib/board-agent/types";
import { loadLiveDemo } from "@/lib/live/demos";
import { transcriptScope } from "@/lib/demo/site-chat/profile";
import { issueTranscript } from "@/lib/demo/site-chat/transcript";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";
import { nyhavnaBoardChatProfile } from "@/lib/demo/nyhavna-chat/board-profile";

const LOCAL = "http://localhost:3107";

function post(body: unknown, headers: Record<string, string> = {}, base = LOCAL) {
  const raw = JSON.stringify(body);
  return new NextRequest(`${base}/api/demo/nyhavna-board-chat`, {
    method: "POST",
    headers: { host: new URL(base).host, "content-type": "application/json", "content-length": String(Buffer.byteLength(raw)), ...headers },
    body: raw,
  });
}

function responsesPayload(output: unknown) {
  return { ok: true, json: async () => ({ status: "completed", output, usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 0 } } }) };
}

function finalMessage(reply: string, answerType: string, linkIds: string[] = [], sourceIds: string[] = []) {
  return [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply, answer_type: answerType, link_ids: linkIds, source_ids: sourceIds }) }] }];
}

function functionCall(callId: string, name: string, args: Record<string, unknown>) {
  return { type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/demo/nyhavna-board-chat — Boardets agentmodus «Spør Anja» (U4, 2026-09-25)", () => {
  it("svarer på et skrevet spørsmål, verktøysettet inkluderer kartverktøyene, og svaret bærer et validert direktiv", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(responsesPayload([functionCall("call_1", "highlight_places", { poi_ids: ["lilleby-skole", "finnes-ikke"] })]))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Her er skolen.", "smalltalk"))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Vis meg en skole", pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Her er skolen.");
    expect(data.directives).toEqual([{ name: "highlight_places", args: { poi_ids: ["lilleby-skole"] } }]);

    // Verktøysettet modellen fikk tilby inkluderer et allowlistet kartverktøy
    // (fraværende i nettsidekopiens tekstchat, se text-tools.test.ts).
    const first = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(first.tools.map((tool: { name: string }) => tool.name)).toContain("highlight_places");
  });

  it("place-brukerinitiativ: komponerer brukerturen selv, sier fra at stedet alt er vist, og trekker kvote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Lilleby skole ligger på Lilleby.", "fact", [], []))));
    const { POST } = await import("./route");
    const res = await POST(post({ intent: { kind: "place", poiId: "lilleby-skole" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(200);
    const first = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    const userTurn = first.input.find((item: { role?: string }) => item.role === "user");
    expect(userTurn.content[0].text).toBe("Jeg valgte «Lilleby skole» i kartet (kart-ID lilleby-skole). Fortell kort om stedet.");
    expect(first.instructions).toContain("BRUKERINITIATIV: Stedet «Lilleby skole» (kart-ID lilleby-skole) er allerede vist i kartet. Ikke kall show_place for det igjen.");
  });

  it("ukjent sted i place-brukerinitiativ er 400 FØR kvoten trekkes (kvote uttømt, likevel ikke 429)", async () => {
    vi.stubEnv("PLACY_NH_CHAT_MESSAGE_VISITOR_DAILY", "0");
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ intent: { kind: "place", poiId: "finnes-ikke" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("gyldig place-brukerinitiativ TREKKER kvote (i motsetning til FAQ under)", async () => {
    vi.stubEnv("PLACY_NH_CHAT_MESSAGE_VISITOR_DAILY", "0");
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ intent: { kind: "place", poiId: "lilleby-skole" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(429);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("theme-brukerinitiativ: komponerer brukerturen og avviser et ukjent tema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Oppvekst handler om skoler og barnehager.", "smalltalk"))));
    const { POST } = await import("./route");
    const res = await POST(post({ intent: { kind: "theme", categoryId: "barn-oppvekst" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(200);
    const first = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    const userTurn = first.input.find((item: { role?: string }) => item.role === "user");
    expect(userTurn.content[0].text).toBe("Jeg valgte temaet «Oppvekst» i kartet (tema-ID barn-oppvekst). Fortell kort om temaet.");

    vi.mocked(fetch).mockClear();
    const rejected = await POST(post({ intent: { kind: "theme", categoryId: "finnes-ikke" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(rejected.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("faq-brukerinitiativ: deterministisk svar, INGEN modellkall og INGEN kvotetrekk, med lenkemarkeringen fjernet og et gyldig highlight_places-direktiv", async () => {
    vi.stubEnv("PLACY_NH_CHAT_MESSAGE_VISITOR_DAILY", "0");
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ intent: { kind: "faq", faqId: "krets" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.answerType).toBe("fact");
    expect(data.reply).toBe("Lilleby barneskole og Rosenborg ungdomsskole er de aktuelle skolene i planmaterialet for Transittkaia. Skoletilhørigheten må avklares for den aktuelle boligen.");
    expect(data.directives).toEqual([{ name: "highlight_places", args: { poi_ids: ["lilleby-skole", "rosenborg-skole"] } }]);
    // Ingen modellkall i det hele tatt — og kvoten (satt til 0 over) hindret ikke svaret.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ukjent FAQ-ID er 400", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ intent: { kind: "faq", faqId: "finnes-ikke" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("kartstatus (board) legges til i instruksen når ID-ene er gyldige, og ukjente ID-er ignoreres stille", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Ok.", "smalltalk"))));
    const { POST } = await import("./route");
    await POST(post({
      message: "Hva ser jeg nå?",
      pageId: BOARD_CHAT_PAGE_ID,
      board: { selectedCategoryId: "barn-oppvekst", selectedPlaceId: "lilleby-skole", travelMode: "bike" },
    }));
    const first = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(first.instructions).toContain("Kartet nå: tema Oppvekst, valgt sted Lilleby skole, reisemåte bike.");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Ok.", "smalltalk"))));
    await POST(post({
      message: "Hva ser jeg nå?",
      pageId: BOARD_CHAT_PAGE_ID,
      board: { selectedCategoryId: "finnes-ikke", selectedPlaceId: null, travelMode: "walk" },
    }));
    const second = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(second.instructions).toContain("Kartet nå: reisemåte walk.");
    expect(second.instructions).not.toContain("tema finnes-ikke");
  });

  it("avviser både message og intent samtidig, og avviser når ingen av dem er satt", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const both = await POST(post({ message: "Hei", intent: { kind: "theme", categoryId: "barn-oppvekst" }, pageId: BOARD_CHAT_PAGE_ID }));
    expect(both.status).toBe(400);
    const neither = await POST(post({ pageId: BOARD_CHAT_PAGE_ID }));
    expect(neither.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("historikktokenet er utbyttbart med Nyhavnas nettsidekopi (samme kunde-ID, datasett og nøkkel)", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const turns = [{ role: "user" as const, text: "Hei" }, { role: "assistant" as const, text: "Hei! Hva lurer du på?" }];
    const fromBoard = issueTranscript({ scope: transcriptScope(nyhavnaBoardChatProfile), visitorId: "local", snapshotId: demo.snapshotId, previousTurns: [], newTurns: turns });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responsesPayload(finalMessage("Gjerne.", "smalltalk"))));
    const { POST: boardPOST } = await import("./route");
    const { POST: sitePOST } = await import("@/app/api/demo/nyhavna-chat/route");

    const onSite = await sitePOST(new NextRequest(`${LOCAL}/api/demo/nyhavna-chat`, {
      method: "POST", headers: { host: new URL(LOCAL).host, "content-type": "application/json" },
      body: JSON.stringify({ message: "Takk", pageId: "forside", transcript: fromBoard }),
    }));
    expect(onSite.status).toBe(200);
    const onSiteBody = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(onSiteBody.input).toHaveLength(3);

    vi.mocked(fetch).mockClear();
    const fromSite = issueTranscript({ scope: transcriptScope(nyhavnaChatProfile), visitorId: "local", snapshotId: demo.snapshotId, previousTurns: [], newTurns: turns });
    const onBoard = await boardPOST(post({ message: "Takk", pageId: BOARD_CHAT_PAGE_ID, transcript: fromSite }));
    expect(onBoard.status).toBe(200);
    const onBoardBody = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(onBoardBody.input).toHaveLength(3);
  });
});
