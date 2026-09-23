import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tester `public/embed/placy-chat.js` som den faktisk lastes: en frittstående
 * `<script>`-tag uten byggesteg. Filen evalueres direkte i jsdom, akkurat som
 * en nettleser ville kjørt den — ingen import, ingen transformasjon.
 */

declare global {
  interface Window {
    PlacyChat?: { open: (options?: { question?: string }) => void; close: () => void };
  }
}

const CODE = readFileSync(join(process.cwd(), "public/embed/placy-chat.js"), "utf8");

function appendScriptTag(overrides: Record<string, string> = {}) {
  const script = document.createElement("script");
  script.src = "/embed/placy-chat.js";
  const attrs = {
    "data-endpoint": "/api/demo/leangenbukta-chat",
    "data-page-id": "forside",
    "data-label": "Spør om Leangenbukta",
    "data-board-href": "/demo/leangenbukta-lokal",
    ...overrides,
  };
  for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
  document.body.appendChild(script);
  return script;
}

function loadWidget(overrides?: Record<string, string>) {
  appendScriptTag(overrides);
  // Kjører produksjonsskriptet slik det faktisk lastes, uten byggesteg.
  (0, eval)(CODE);
}

function host() {
  return document.querySelector("[data-placy-chat-host]") as HTMLElement;
}

function shadow() {
  return host().shadowRoot as ShadowRoot;
}

function panel() {
  return shadow().querySelector(".panel") as HTMLElement;
}

function button() {
  return shadow().querySelector(".btn") as HTMLButtonElement;
}

async function tick(ms = 20) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ starters: [] })));
});

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as { __PLACY_CHAT_LOADED__?: boolean }).__PLACY_CHAT_LOADED__;
  delete (window as unknown as { PlacyChat?: unknown }).PlacyChat;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("placy-chat widget — idempotens", () => {
  it("oppretter bare én instans selv om skriptet lastes to ganger", () => {
    loadWidget();
    loadWidget();
    expect(document.querySelectorAll("[data-placy-chat-host]")).toHaveLength(1);
  });
});

describe("placy-chat widget — åpne/lukke", () => {
  it("åpner panelet, flytter fokus inn, og lukker med Escape tilbake til knappen", async () => {
    loadWidget();
    button().focus();
    expect(shadow().activeElement).toBe(button());

    window.PlacyChat!.open();
    expect(panel().hidden).toBe(false);
    await tick();
    expect(shadow().activeElement).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(panel().hidden).toBe(true);
    expect(shadow().activeElement).toBe(button());
  });

  it("close() lukker uten at noe er åpnet, uten å kaste", () => {
    loadWidget();
    expect(() => window.PlacyChat!.close()).not.toThrow();
  });

  it("fokusfellen holder Tab innenfor panelet", async () => {
    loadWidget();
    window.PlacyChat!.open();
    await tick();
    const items = Array.from(shadow().querySelectorAll("button:not([disabled]), a[href], textarea")) as HTMLElement[];
    const last = items[items.length - 1];
    last.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    panel().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("placy-chat widget — data-placy-chat-open", () => {
  it("åpner chatten og sender et forslag fra et vanlig knapp-element på siden", async () => {
    loadWidget();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return jsonResponse({ reply: "Svar om Knutepunktet.", answerType: "fact", links: [], transcript: "tok" });
      }),
    );
    const trigger = document.createElement("button");
    trigger.setAttribute("data-placy-chat-open", "");
    trigger.setAttribute("data-placy-chat-question", "Hva finnes rundt Knutepunktet?");
    document.body.appendChild(trigger);

    trigger.click();
    expect(panel().hidden).toBe(false);
    await tick(30);

    const userMsg = shadow().querySelector(".msg.user");
    expect(userMsg?.textContent).toBe("Hva finnes rundt Knutepunktet?");
  });
});

describe("placy-chat widget — sideskifte i klientnavigert app", () => {
  it("bruker siste data-placy-page-id i DOM-en, ikke skriptets data-page-id, i GET og POST", async () => {
    loadWidget();
    const marker1 = document.createElement("div");
    marker1.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker1);
    const marker2 = document.createElement("div");
    marker2.setAttribute("data-placy-page-id", "knutepunktet");
    document.body.appendChild(marker2);

    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
      return jsonResponse({ reply: "ok", answerType: "smalltalk", links: [], transcript: "tok" });
    });
    vi.stubGlobal("fetch", fetchMock);

    window.PlacyChat!.open();
    await tick();
    const [startersUrl] = fetchMock.mock.calls[0] as [string];
    expect(startersUrl).toContain("pageId=knutepunktet");
  });

  it("beholder transcript på tvers av et sidebytte i samme fane", async () => {
    loadWidget();
    const marker = document.createElement("div");
    marker.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker);

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      void init;
      if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
      return jsonResponse({ reply: "ok", answerType: "smalltalk", links: [], transcript: "transcript-1" });
    });
    vi.stubGlobal("fetch", fetchMock);

    window.PlacyChat!.open({ question: "Hei" });
    await tick(30);

    marker.setAttribute("data-placy-page-id", "beliggenhet");
    const textarea = shadow().querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Neste spørsmål";
    (shadow().querySelector(".send") as HTMLButtonElement).click();
    await tick(30);

    const lastCallBody = JSON.parse((fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as RequestInit).body as string);
    expect(lastCallBody.transcript).toBe("transcript-1");
    expect(lastCallBody.pageId).toBe("beliggenhet");
  });
});

describe("placy-chat widget — ingen HTML-injeksjon og board-lenke", () => {
  it("setter serverinnhold som ren tekst og bruker data-board-href for board-lenker", async () => {
    loadWidget();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return jsonResponse({
          reply: "<script>alert(1)</script> er bare tekst.",
          answerType: "fact",
          links: [{ id: "board", label: "Åpne Board", href: "/annen/sti" }],
          transcript: "tok",
        });
      }),
    );
    window.PlacyChat!.open({ question: "Hei" });
    await tick(30);

    expect(shadow().innerHTML).not.toContain("<script>alert(1)</script>");
    const assistantMsg = shadow().querySelector(".msg.assistant") as HTMLElement;
    // Første barnenode er selve svarteksten, satt med `textContent` — den skal
    // stå igjen som ren tekst, ikke bli et kjørbart element.
    expect(assistantMsg.childNodes[0].textContent).toBe("<script>alert(1)</script> er bare tekst.");
    const link = assistantMsg.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/demo/leangenbukta-lokal");
  });

  it("viser aldri en lenke for en ekstern eller protokollrelativ href fra serveren", async () => {
    loadWidget();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return jsonResponse({
          reply: "Svar.",
          answerType: "fact",
          links: [{ id: "page:evil", label: "Ekstern", href: "//evil.example.com" }],
          transcript: "tok",
        });
      }),
    );
    window.PlacyChat!.open({ question: "Hei" });
    await tick(30);
    const assistantMsg = shadow().querySelector(".msg.assistant") as HTMLElement;
    expect(assistantMsg.querySelector("a")).toBeNull();
  });
});

describe("placy-chat widget — CSS", () => {
  it("har en mobil-brekkpunktregel for panelet (bottom sheet under 700px)", () => {
    loadWidget();
    const styleText = shadow().querySelector("style")!.textContent!;
    expect(styleText).toContain("@media (max-width:700px)");
    expect(styleText).toContain("prefers-reduced-motion");
  });
});
