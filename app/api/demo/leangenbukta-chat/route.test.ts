import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueLbDemoCookie, LB_DEMO_COOKIE } from "@/lib/demo/leangenbukta-site/access";
import { issueTranscript } from "@/lib/demo/leangenbukta-chat/transcript";
import { loadLiveDemo } from "@/lib/live/demos";
import { getSitePages } from "@/lib/demo/leangenbukta-site/pages";
import registryFile from "@/data/demo/leangenbukta-lokal/sources.json";

const ACCESS_CODE = "leangenbukta-demo-code";
const COOKIE_SECRET = "s".repeat(40);

function setDemoEnv() {
  process.env.PLACY_LB_DEMO_ACCESS_CODE = ACCESS_CODE;
  process.env.PLACY_LB_DEMO_COOKIE_SECRET = COOKIE_SECRET;
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.PLACY_LB_DEMO_USAGE_STORE;
}

function visitorCookie() {
  const token = issueLbDemoCookie(ACCESS_CODE)!;
  return `${LB_DEMO_COOKIE}=${token}`;
}

function visitorIdFromCookie(cookie: string): string {
  const token = cookie.split("=")[1];
  const body = token.split(".")[0];
  return (JSON.parse(Buffer.from(body, "base64url").toString()) as { visitorId: string }).visitorId;
}

function post(body: unknown, headers: Record<string, string> = {}) {
  const raw = JSON.stringify(body);
  return new NextRequest("http://localhost/api/demo/leangenbukta-chat", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(raw)), ...headers },
    body: raw,
  });
}

function responsesPayload(output: unknown) {
  return { ok: true, json: async () => ({ status: "completed", output, usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 0 } } }) };
}

function finalMessage(reply: string, answerType: string, linkIds: string[] = [], sourceIds: string[] = []) {
  return [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ reply, answer_type: answerType, link_ids: linkIds, source_ids: sourceIds }) }] }];
}

function projectInfoCall(query: string) {
  return responsesPayload([{ type: "function_call", call_id: "call_1", name: "find_project_info", arguments: JSON.stringify({ query, theme_id: "leangenbukta-prosjektet" }) }]);
}

const KNUTEPUNKTET_SOURCE = registryFile.find((source) => source.url === "https://leangenbukta.no/knutepunktet/")!;

beforeEach(() => {
  setDemoEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.PLACY_LB_DEMO_ACCESS_CODE;
  delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
  delete process.env.OPENAI_API_KEY;
  delete process.env.PLACY_LB_CHAT_ALLOWED_ORIGINS;
});

describe("POST /api/demo/leangenbukta-chat", () => {
  it("svarer 401 uten tilgang", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hei", pageId: "forside" }));
    expect(res.status).toBe(401);
  });

  it("svarer 400 på ukjent pageId uten å kalle modellen", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "ukjent-side" }, { cookie }));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
    // AE5: aldri et svar fra et annet grunnlag, men alltid en vei videre.
    const body = await res.json();
    expect(body.links.map((link: { id: string }) => link.id)).toEqual(["board", "contact"]);
  });

  it("avviser en fremmed origin", async () => {
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie, origin: "https://ikke-tillatt.example.com" }));
    expect(res.status).toBe(403);
  });

  it("godtar samme vert når Next dev normaliserer URL-en til localhost", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Hei der.", "smalltalk"))));
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hei", pageId: "forside" }, {
      cookie: visitorCookie(), host: "127.0.0.1:3107", origin: "http://127.0.0.1:3107",
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe("Hei der.");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("godtar en origin i PLACY_LB_CHAT_ALLOWED_ORIGINS", async () => {
    process.env.PLACY_LB_CHAT_ALLOWED_ORIGINS = "https://leangenbukta.no";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Hei der.", "smalltalk"))));
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie, origin: "https://leangenbukta.no" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://leangenbukta.no");
  });

  it("svarer 429 og kaller ikke modellen når kvoten er brukt", async () => {
    process.env.PLACY_LB_DEMO_CHAT_VISITOR_DAILY = "0";
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie }));
    expect(res.status).toBe(429);
    expect(global.fetch).not.toHaveBeenCalled();
    delete process.env.PLACY_LB_DEMO_CHAT_VISITOR_DAILY;
  });

  it("feiler lukket med 503 i produksjon uten sentralt kvotelager", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie: visitorCookie() }));
    expect(res.status).toBe(503);
    expect((await res.json()).links.map((link: { id: string }) => link.id)).toEqual(["board", "contact"]);
    expect(global.fetch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("gir et faktasvar med lenker og et nytt transcript ved en gyldig, godkjent samtale", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          responsesPayload([{ type: "function_call", call_id: "call_1", name: "find_project_info", arguments: JSON.stringify({ query: "treningsrom Knutepunktet", theme_id: "leangenbukta-prosjektet" }) }]),
        )
        .mockResolvedValueOnce(responsesPayload(finalMessage("Knutepunktet er planlagt med treningsrom, ikke bekreftet ferdig.", "fact", ["board"]))),
    );
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Er treningsrommet i Knutepunktet ferdig?", pageId: "forside" }, { cookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toContain("Knutepunktet");
    expect(data.links).toEqual([{ id: "board", label: "Åpne Board", href: "/demo/leangenbukta-lokal" }]);
    expect(typeof data.transcript).toBe("string");
    expect(typeof data.datasetVersion).toBe("string");
  });

  it("erstatter et fact-svar uten verktøybevis med det faste kunnskapshull-svaret", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Ja, boligen koster 4 millioner.", "fact"))));
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hva koster Knutepunktet?", pageId: "forside" }, { cookie }));
    const data = await res.json();
    expect(data.answerType).toBe("gap");
    expect(data.reply).toContain("kildebelagt grunnlag");
  });

  it("ignorerer en forfalsket eller en annen besøkendes transcript og starter uten historikk", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Hei igjen.", "smalltalk"))));
    const { POST } = await import("./route");
    const otherToken = issueTranscript({ visitorId: "en-annen-besøkende", snapshotId: "uansett", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside", transcript: otherToken }, { cookie }));
    expect(res.status).toBe(200);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    // Bare den nye brukermeldingen skal være med i input — ingen turer fra det forfalskede tokenet.
    expect(sentBody.input).toHaveLength(1);
  });

  it("svarer 409 når transcriptets snapshotId ikke matcher dagens datagrunnlag", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const visitorId = visitorIdFromCookie(cookie);
    const staleToken = issueTranscript({ visitorId, snapshotId: "en-gammel-versjon-som-ikke-finnes", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });
    const res = await POST(post({ message: "Hei", pageId: "forside", transcript: staleToken }, { cookie }));
    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("belaster ikke kvoten når forespørselen uansett feiler deterministisk (stale transcript, 409)", async () => {
    // AE6: kvoten skal trekkes FØR modellkallet, men ETTER alle sjekker som
    // uansett ville feilet uten modellkall (her: transcriptets snapshotId er
    // foreldet). Med en dagskvote på 1 skal derfor det andre, gyldige forsøket
    // fortsatt gå gjennom — den mislykkede 409-forespørselen skal ikke ha
    // brukt opp den besøkendes eneste melding.
    process.env.PLACY_LB_DEMO_CHAT_VISITOR_DAILY = "1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Hei igjen.", "smalltalk"))));
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const visitorId = visitorIdFromCookie(cookie);
    const staleToken = issueTranscript({ visitorId, snapshotId: "en-gammel-versjon-som-ikke-finnes", previousTurns: [], newTurns: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }] });

    const staleRes = await POST(post({ message: "Hei", pageId: "forside", transcript: staleToken }, { cookie }));
    expect(staleRes.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();

    const validRes = await POST(post({ message: "Hei", pageId: "forside" }, { cookie }));
    expect(validRes.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    delete process.env.PLACY_LB_DEMO_CHAT_VISITOR_DAILY;
  });

  it("dropper forsøk på vilkårlige lenke-ID-er (URL/javascript:) fra modellen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Se her.", "smalltalk", ["https://evil.example.com", "javascript:alert(1)"]))),
    );
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie }));
    const data = await res.json();
    expect(data.links).toEqual([]);
  });

  it("saner <script> i svaret til ren tekst i responsen (ingen HTML sendes)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("<script>alert(1)</script> er bare tekst.", "smalltalk"))));
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie }));
    const data = await res.json();
    expect(data.reply).toBe("<script>alert(1)</script> er bare tekst.");
    expect(typeof data.reply).toBe("string");
  });

  it("svarer 502 ved leverandørfeil uten å lekke leverandørens feiltekst eller nøkkel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { message: "hemmelig intern feil fra OpenAI" } }) }));
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).not.toContain("hemmelig intern feil");
    expect(JSON.stringify(data)).not.toContain(process.env.OPENAI_API_KEY);
    expect(data.links[0].href).toBe("/demo/leangenbukta-lokal");
  });

  it("svarer 504 ved tidsavbrudd", async () => {
    process.env.PLACY_LB_CHAT_TIMEOUT_MS = "20";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })),
    );
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie }));
    expect(res.status).toBe(504);
    delete process.env.PLACY_LB_CHAT_TIMEOUT_MS;
  });

  it("kobler side-ID til byggkontekst i instruksjonen som sendes til modellen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Ok.", "smalltalk"))));
    const { POST } = await import("./route");
    const cookie = visitorCookie();
    await POST(post({ message: "Hei", pageId: "beliggenhet" }, { cookie }));
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.instructions).toContain("Beliggenhet");
    // Tekstchatten får sine egne kompakte regler, ikke Anjas manus og data:
    // fakta skal komme fra et ferskt verktøykall.
    expect(sentBody.instructions.length).toBeLessThan(8000);
    expect(sentBody.instructions).toContain("kall ALLTID et kunnskapsverktøy");
    for (const embedded of ["STEDER OG REISETIDER (data)", "SPØRSMÅL OG SVAR (data", "KILDER (data)", "PRESENTASJON:", "highlight_places", "show_category"]) {
      expect(sentBody.instructions).not.toContain(embedded);
    }
  });
});

describe("POST /api/demo/leangenbukta-chat — kilder, forbehold og feil premisser", () => {
  it("viser bare kilder som modellen siterte OG verktøyene returnerte i denne meldingen, med etikett fra registeret", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(projectInfoCall("innflytting Knutepunktet"))
        .mockResolvedValueOnce(responsesPayload(finalMessage(
          "Knutepunktet har forventet innflytting siste kvartal 2026, men datoen er ikke bekreftet.",
          "fact",
          [],
          [KNUTEPUNKTET_SOURCE.id, "koteng-godkjent-fasit", "citylade-6434272b"],
        ))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Når kan man flytte inn i Knutepunktet?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.answerType).toBe("fact");
    expect(data.sources).toEqual([{ id: KNUTEPUNKTET_SOURCE.id, label: KNUTEPUNKTET_SOURCE.label, page: KNUTEPUNKTET_SOURCE.page, checkedAt: KNUTEPUNKTET_SOURCE.checkedAt }]);
  });

  it("viser ingen kilder når modellen siterer ID-er uten å ha kalt et verktøy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Hei! Hva lurer du på?", "smalltalk", [], [KNUTEPUNKTET_SOURCE.id]))));
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hei", pageId: "forside" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.sources).toEqual([]);
    expect(data.notice).toBeNull();
  });

  it("faktasvar uten bevis: fast kunnskapshull, ingen kilder, og alltid Board og salgsteamet som vei videre", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Boligen koster 4 millioner.", "fact", [], [KNUTEPUNKTET_SOURCE.id]))));
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hva koster en leilighet i Knutepunktet?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.answerType).toBe("gap");
    expect(data.reply).not.toContain("4 millioner");
    expect(data.sources).toEqual([]);
    expect(data.links.map((link: { id: string }) => link.id)).toEqual(["board", "contact"]);
  });

  it("2008-premisset: bekrefter aldri innflytting i 2008 når verktøyene ikke har årstallet", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(projectInfoCall("innflytting Knutepunktet 2008"))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Ja, innflyttingen i Knutepunktet var i 2008.", "fact", ["board"], [KNUTEPUNKTET_SOURCE.id]))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Innflyttingen i Knutepunktet var vel i 2008?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.answerType).toBe("gap");
    expect(data.reply).not.toMatch(/^Ja\b/);
    expect(data.reply).toContain("2008");
    expect(data.sources).toEqual([]);
    expect(data.links.map((link: { id: string }) => link.id)).toContain("contact");
  });

  it("2008-premisset: et årstall bare brukeren har nevnt blir ikke bevis, heller ikke i et «smalltalk»-svar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(responsesPayload(finalMessage("Leangenbukta ble bygget i 2008.", "smalltalk"))));
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Leangenbukta ble bygget i 2008, ikke sant?", pageId: "forside" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.answerType).toBe("gap");
    expect(data.reply).not.toContain("ble bygget i 2008");
  });

  it("et kildebelagt årstall slipper gjennom uten å gjenta forbeholdet modellen allerede ga", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(projectInfoCall("innflytting Knutepunktet"))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Utbygger oppgir forventet innflytting siste kvartal 2026. Det er et anslag, ikke en bekreftet dato.", "fact", ["contact"], [KNUTEPUNKTET_SOURCE.id]))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Når kan man flytte inn i Knutepunktet?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.answerType).toBe("fact");
    expect(data.reply).toContain("2026");
    expect(data.notice).toBeNull();
  });

  it("legger til tidsforbehold når et faktasvar om innflytting utelater det", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(projectInfoCall("innflytting Knutepunktet"))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Innflytting i Knutepunktet er oppgitt til siste kvartal 2026.", "fact", ["contact"], [KNUTEPUNKTET_SOURCE.id]))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Når kan man flytte inn i Knutepunktet?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.notice?.kind).toBe("timing");
  });

  it("pris- og ledighetsspørsmål får salgsforbehold", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(projectInfoCall("pris Knutepunktet"))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Kilden oppgir leiligheter fra 2 450 000 kr.", "fact", ["contact"], [KNUTEPUNKTET_SOURCE.id]))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hva koster leilighetene, og er noen ledige?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.notice?.kind).toBe("sales");
  });

  it("usikkert prosjektgrunnlag uten pris- eller tidsord får et forbehold om planlagt/uavklart", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(projectInfoCall("fellesfasiliteter Knutepunktet"))
        .mockResolvedValueOnce(responsesPayload(finalMessage("Knutepunktet skal huse prosjektets felles fasiliteter.", "fact", [], [KNUTEPUNKTET_SOURCE.id]))),
    );
    const { POST } = await import("./route");
    const res = await POST(post({ message: "Hvilke fellesarealer får beboerne?", pageId: "knutepunktet" }, { cookie: visitorCookie() }));
    const data = await res.json();
    expect(data.notice?.kind).toBe("provisional");
  });
});

describe("GET /api/demo/leangenbukta-chat", () => {
  it("gir sidetittel, forslag og datasettversjon uten modellkall og uten kvotebruk", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { GET } = await import("./route");
    const cookie = visitorCookie();
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const req = new NextRequest("http://localhost/api/demo/leangenbukta-chat?pageId=forside", { headers: { cookie } });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.starters.length).toBeGreaterThan(0);
    expect(data.datasetVersion).toBe(demo.snapshotId);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  async function getPage(pageId: string) {
    const { GET } = await import("./route");
    const req = new NextRequest(`http://localhost/api/demo/leangenbukta-chat?pageId=${pageId}`, { headers: { cookie: visitorCookie() } });
    return (await GET(req)).json();
  }

  it("oppgir når siste registrerte kilde ble kontrollert", async () => {
    const data = await getPage("forside");
    const latest = registryFile.map((source) => source.checkedAt).sort().at(-1);
    expect(data.contentCheckedAt).toBe(latest);
  });

  it("gir en sidetilpasset åpning: forsiden om prosjektet, byggsiden om bygget", async () => {
    const home = await getPage("forside");
    const building = await getPage("knutepunktet");
    expect(home.opening).toContain("Leangenbukta");
    expect(building.opening).toContain("Knutepunktet");
    expect(building.opening).not.toBe(home.opening);
  });

  it("forsiden og hver byggside har minst to forslag", async () => {
    const pages = getSitePages().filter((page) => page.kind === "home" || page.kind === "building");
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const data = await getPage(page.id);
      expect(data.starters.length, page.id).toBeGreaterThanOrEqual(2);
      expect(typeof data.opening, page.id).toBe("string");
    }
  });

  it("svarer 401 uten tilgang", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/demo/leangenbukta-chat?pageId=forside");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
