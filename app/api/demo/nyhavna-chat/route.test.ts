import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueTranscript } from "@/lib/demo/site-chat/transcript";
import { transcriptScope } from "@/lib/demo/site-chat/profile";
import { leangenbuktaChatProfile } from "@/lib/demo/leangenbukta-chat/profile";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";
import { issueLbDemoCookie, LB_DEMO_COOKIE } from "@/lib/demo/leangenbukta-site/access";
import { loadLiveDemo } from "@/lib/live/demos";
import { NH_CHAT_COOKIE } from "@/lib/demo/nyhavna-chat/access";
import { NH_CATEGORY_QUESTIONS } from "@/lib/demo/nyhavna-chat/categories";
import { NH_REPLIES } from "@/lib/demo/nyhavna-chat/instructions";
import board from "@/data/demo/nyhavna-lokal/board.json";

const LOCAL = "http://localhost:3107";

function get(pageId: string, headers: Record<string, string> = {}, base = LOCAL) {
  return new NextRequest(`${base}/api/demo/nyhavna-chat?pageId=${encodeURIComponent(pageId)}`, { headers: { host: new URL(base).host, ...headers } });
}

function post(body: unknown, headers: Record<string, string> = {}, base = LOCAL) {
  const raw = JSON.stringify(body);
  return new NextRequest(`${base}/api/demo/nyhavna-chat`, {
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

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/demo/nyhavna-chat", () => {
  it("gir sidens åpning, forslag og Nyhavnas åtte temaer lokalt", async () => {
    const { GET } = await import("./route");
    const res = await GET(get("beliggenhet"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pageTitle).toBe("Beliggenhet");
    expect(body.opening).toMatch(/Nyhavna i dag/);
    expect(body.starters).toEqual(["Hvor handler vi dagligvarer?", "Hvordan kommer vi oss til sentrum?", "Hvilke barnehager finnes i nærområdet?"]);
    expect(body.categories.map((category: { id: string }) => category.id)).toEqual(board.categories.map((category) => category.id));
    expect(body.categories[5].questions).toEqual([...NH_CATEGORY_QUESTIONS.transport]);
    expect(body.datasetVersion).toBe((await loadLiveDemo("nyhavna-lokal")).snapshotId);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("avviser ukjente sider med en vei videre", async () => {
    const { GET } = await import("./route");
    const res = await GET(get("om-selskapet"));
    expect(res.status).toBe(400);
    expect((await res.json()).links.map((link: { id: string }) => link.id)).toEqual(["board", "contact"]);
  });

  it("finnes ikke i et ukonfigurert produksjonsbygg", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", vi.fn());
    const { GET, POST } = await import("./route");
    expect((await GET(get("forside"))).status).toBe(404);
    expect((await POST(post({ message: "Hei", pageId: "forside" }))).status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("utsteder en besøkscookie når chatten er slått på, og gjenbruker den", async () => {
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "n".repeat(40));
    const { GET } = await import("./route");
    const first = await GET(get("forside", {}, "https://www.placy.example"));
    expect(first.status).toBe(200);
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    expect(cookie.startsWith(`${NH_CHAT_COOKIE}=`)).toBe(true);
    const second = await GET(get("forside", { cookie }, "https://www.placy.example"));
    expect(second.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/demo/nyhavna-chat", () => {
  it("svarer med fakta fra Nyhavnas datasett, Nyhavnas kilde og bare lovlige lenker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(responsesPayload([{ type: "function_call", call_id: "call_1", name: "find_project_info", arguments: JSON.stringify({ query: "bydel boliger", theme_id: "nyhavna-bydel" }) }]))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Nyhavna Utvikling planlegger boliger for kjøp og leie; det er en plan, ikke et tilbud i dag.", "fact", ["board", "page:beliggenhet", "https://evil.example"], ["bo-felles", "oppdiktet-kilde"]))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hva planlegges på Nyhavna?", pageId: "forside" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.answerType).toBe("fact");
    expect(data.sources.map((source: { id: string }) => source.id)).toEqual(["bo-felles"]);
    expect(data.links).toEqual([
      { id: "board", label: "Utforsk Nyhavna med Placy", href: "/demo/nyhavna-lokal" },
      { id: "page:beliggenhet", label: "Beliggenhet", href: "/demo/nyhavna-nettside/beliggenhet" },
    ]);
    expect(data.evidence[0].tool).toBe("find_project_info");
    expect(data.datasetVersion).toBe((await loadLiveDemo("nyhavna-lokal")).snapshotId);

    // Det som gikk til modellen: Nyhavnas egen instruks og verktøysvar fra nyhavna.no.
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const first = JSON.parse((calls[0][1] as RequestInit).body as string);
    expect(first.instructions).toContain("TEKSTCHAT om Nyhavna");
    expect(first.instructions).toContain("SIDEKONTEKST: Brukeren står på siden «Nyhavna»");
    expect(first.instructions).not.toContain("Leangenbukta");
    const second = JSON.parse((calls[1][1] as RequestInit).body as string);
    const toolOutput = second.input.find((item: { type?: string }) => item.type === "function_call_output");
    expect(toolOutput.output).toContain("https://nyhavna.no/bo/");
  });

  it("erstatter et faktasvar uten verktøybevis med Nyhavnas faste kunnskapshull-svar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Leilighetene koster 5 millioner.", "fact"))));
    const { POST } = await import("./route");
    const data = await (await POST(post({ message: "Hva koster en leilighet?", pageId: "forside" }))).json();
    expect(data.answerType).toBe("gap");
    expect(data.reply).toBe(NH_REPLIES.knowledgeGap);
    expect(data.links.map((link: { id: string }) => link.id)).toEqual(["board", "contact"]);
    expect(data.sources).toEqual([]);
  });

  it("slipper aldri gjennom et årstall verktøyene ikke har", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(responsesPayload([{ type: "function_call", call_id: "call_1", name: "find_project_info", arguments: JSON.stringify({ query: "bydel boliger", theme_id: "nyhavna-bydel" }) }]))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Ja, du kan flytte inn i 2031.", "fact", [], ["bo-felles"]))),
    );
    const { POST } = await import("./route");
    const data = await (await POST(post({ message: "Kan jeg flytte inn på Nyhavna i 2031?", pageId: "forside" }))).json();
    expect(data.answerType).toBe("gap");
    expect(data.reply).toBe(NH_REPLIES.unsupportedYear(["2031"]));
  });

  it("fortsetter en Nyhavna-samtale, men tar aldri inn en samtale fra Leangenbukta (heller ikke med begge nøklene satt)", async () => {
    const nyhavna = await loadLiveDemo("nyhavna-lokal");
    const leangenbukta = await loadLiveDemo("leangenbukta-lokal");
    const turns = [{ role: "user" as const, text: "Hei" }, { role: "assistant" as const, text: "Hei! Hva lurer du på?" }];
    // Begge kundenes nøkler satt samtidig: ingen av dem låner den andres.
    vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", "s".repeat(40));
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "n".repeat(40));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responsesPayload(finalMessage("Gjerne.", "smalltalk"))));
    const { POST } = await import("./route");

    const own = issueTranscript({ scope: transcriptScope(nyhavnaChatProfile), visitorId: "local", snapshotId: nyhavna.snapshotId, previousTurns: [], newTurns: turns });
    expect((await POST(post({ message: "Takk", pageId: "forside", transcript: own }))).status).toBe(200);
    const sent = JSON.parse(((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
    expect(sent.input).toHaveLength(3);

    // Et ekte Leangenbukta-token for samme besøkende — også med Nyhavnas
    // innholdsversjon — blir aldri Nyhavna-historikk: signaturen er kundens egen.
    for (const snapshotId of [leangenbukta.snapshotId, nyhavna.snapshotId]) {
      vi.mocked(global.fetch).mockClear();
      const foreign = issueTranscript({ scope: transcriptScope(leangenbuktaChatProfile), visitorId: "local", snapshotId, previousTurns: [], newTurns: turns });
      expect((await POST(post({ message: "Takk", pageId: "forside", transcript: foreign }))).status).toBe(200);
      const replayed = JSON.parse(((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string);
      expect(replayed.input).toHaveLength(1);
    }
  });

  it("trekker Nyhavnas egen kvote, ikke Leangenbuktas", async () => {
    vi.stubEnv("PLACY_NH_CHAT_MESSAGE_VISITOR_DAILY", "0");
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hei", pageId: "forside" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(NH_REPLIES.quota.visitor);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("feiler lukket med 503 i produksjon uten sentralt kvotelager, og gir den nye besøkende en cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "n".repeat(40));
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hei", pageId: "forside" }, {}, "https://www.placy.example"));
    expect(res.status).toBe(503);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${NH_CHAT_COOKIE}=`));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("gir ikke en Leangenbukta-cookie noen Nyhavna-identitet i produksjon", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLACY_NH_CHAT_ENABLED", "true");
    vi.stubEnv("PLACY_NH_CHAT_COOKIE_SECRET", "n".repeat(40));
    vi.stubEnv("PLACY_LB_DEMO_ACCESS_CODE", "leangenbukta-demo-code");
    vi.stubEnv("PLACY_LB_DEMO_COOKIE_SECRET", "s".repeat(40));
    vi.stubGlobal("fetch", vi.fn());
    const { GET } = await import("./route");
    const res = await GET(get("forside", { cookie: `${LB_DEMO_COOKIE}=${issueLbDemoCookie("leangenbukta-demo-code")}` }, "https://www.placy.example"));
    // Ukjent for Nyhavna: behandles som en ny, anonym besøkende.
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${NH_CHAT_COOKIE}=`));
  });

  it("avviser en fremmed origin", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ message: "Hei", pageId: "forside" }, { origin: "https://evil.example" }))).status).toBe(403);
  });
});
