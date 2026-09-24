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

describe("placy-chat widget — feil og nettverksbrudd", () => {
  it("viser feilmelding og fallback-lenker ved et ikke-ok svar (429), og lar brukeren sende på nytt", async () => {
    loadWidget();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return jsonResponse(
          {
            error: "For mange forespørsler. Vent litt og prøv igjen.",
            links: [
              { id: "board", label: "Åpne Board", href: "/et-annet/board" },
              { id: "contact", label: "Kontakt oss", href: "/kontakt" },
            ],
          },
          false,
        );
      }),
    );
    window.PlacyChat!.open({ question: "Hei" });
    await tick(30);

    const errorMsg = shadow().querySelector(".msg.error") as HTMLElement;
    expect(errorMsg.childNodes[0].textContent).toBe("For mange forespørsler. Vent litt og prøv igjen.");

    const links = Array.from(errorMsg.querySelectorAll("a")) as HTMLAnchorElement[];
    expect(links).toHaveLength(2);
    // Board-lenken bruker skriptets egen `data-board-href`, ikke serverens.
    expect(links[0].getAttribute("href")).toBe("/demo/leangenbukta-lokal");
    expect(links[1].getAttribute("href")).toBe("/kontakt");

    const sendBtn = shadow().querySelector(".send") as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);

    // Widgeten skal fortsatt kunne brukes til en ny melding.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return jsonResponse({ reply: "Prøv nummer to.", answerType: "fact", links: [], transcript: "tok2" });
      }),
    );
    const textarea = shadow().querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Ny melding";
    sendBtn.click();
    await tick(30);
    const messages = shadow().querySelectorAll(".msg.user");
    expect(messages[messages.length - 1].textContent).toBe("Ny melding");
    expect(shadow().querySelector(".msg.assistant")?.textContent).toBe("Prøv nummer to.");
  });

  it("viser nettverksfeilmelding når forespørselen avvises, og lar brukeren sende på nytt", async () => {
    loadWidget();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return Promise.reject(new Error("network"));
      }),
    );
    window.PlacyChat!.open({ question: "Hei" });
    await tick(30);

    const errorMsg = shadow().querySelector(".msg.error") as HTMLElement;
    expect(errorMsg.textContent).toBe("Chatten fikk ikke kontakt. Sjekk nettforbindelsen og prøv igjen.");

    const sendBtn = shadow().querySelector(".send") as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);

    // Widgeten skal fortsatt kunne brukes til en ny melding etter nettverksfeilen.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
        return jsonResponse({ reply: "Nå virker det.", answerType: "fact", links: [], transcript: "tok3" });
      }),
    );
    const textarea = shadow().querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Andre forsøk";
    sendBtn.click();
    await tick(30);
    const messages = shadow().querySelectorAll(".msg.user");
    expect(messages[messages.length - 1].textContent).toBe("Andre forsøk");
    expect(shadow().querySelector(".msg.assistant")?.textContent).toBe("Nå virker det.");
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

describe("placy-chat widget — prototypestatus, åpning, kilder og forbehold", () => {
  function honesty() {
    return shadow().querySelector(".honesty") as HTMLElement;
  }

  it("sier at chatten er en prototype før serveren har svart, og viser nyeste registrerte kildekontroll etterpå", async () => {
    loadWidget();
    expect(shadow().querySelector(".head .badge")?.textContent).toMatch(/prototype/i);
    expect(honesty().textContent).toMatch(/ikke godkjent/i);
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ starters: [], opening: "Hei!", prototype: true, contentCheckedAt: "2026-09-21" })));
    window.PlacyChat!.open();
    await tick();
    // `contentCheckedAt` er nyeste `checkedAt` i kilderegisteret, ikke en
    // dato alle kildene er kontrollert på — teksten må si akkurat det.
    expect(honesty().textContent).toContain("Nyeste registrerte kildekontroll: 21.09.2026");
    expect(honesty().textContent).not.toMatch(/sist kontrollert/i);
    expect(shadow().querySelector(".head .badge")?.textContent).toMatch(/prototype/i);
  });

  it("viser merkevare og prototypemerke i toppen, statuslinja under, og hilsenen før forslagene", async () => {
    loadWidget();
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({
      starters: ["Når er Knutepunktet ferdig?", "Hva finnes i nærheten?"],
      opening: "Hei! Spør meg om Knutepunktet.",
      contentCheckedAt: "2026-09-21",
    })));
    window.PlacyChat!.open();
    await tick();
    const head = shadow().querySelector(".head") as HTMLElement;
    expect(head.querySelector(".mark svg")).not.toBeNull();
    expect(head.querySelector("h2")?.textContent).toBe("Spør om Leangenbukta");
    expect(head.textContent).toContain("Drevet av Placy");

    const opening = shadow().querySelector(".msg.opening") as HTMLElement;
    const starterButtons = Array.from(shadow().querySelectorAll(".starter")) as HTMLButtonElement[];
    expect(starterButtons.map((b) => b.textContent)).toEqual(["Når er Knutepunktet ferdig?", "Hva finnes i nærheten?"]);
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(head, honesty())).toBe(true);
    expect(follows(honesty(), opening)).toBe(true);
    expect(follows(opening, starterButtons[0])).toBe(true);
    expect(follows(starterButtons[0], shadow().querySelector("textarea") as Node)).toBe(true);
  });

  it("viser hilsenen øverst også når chatten åpnes med et spørsmål fra siden", async () => {
    loadWidget();
    let resolveStarters: (value: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("?pageId=")) return new Promise<Response>((resolve) => { resolveStarters = resolve; });
      return new Promise<Response>(() => {});
    }));
    window.PlacyChat!.open({ question: "Når er Knutepunktet ferdig?" });
    await tick();
    resolveStarters({ ok: true, json: async () => ({ starters: [], opening: "Hei!" }) } as Response);
    await tick();
    const log = shadow().querySelector(".log") as HTMLElement;
    expect(log.firstElementChild?.classList.contains("opening")).toBe(true);
    expect(log.firstElementChild?.textContent).toBe("Hei!");
  });

  it("flytter forslagene for en ny side til slutten av en påbegynt samtale", async () => {
    loadWidget();
    const marker = document.createElement("div");
    marker.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker);
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("?pageId=")) {
        return jsonResponse({ starters: [String(url).includes("knutepunktet") ? "Om Knutepunktet" : "Om forsiden"], opening: "Hei!" });
      }
      return jsonResponse({ reply: "Svar.", answerType: "fact", links: [], transcript: "tok" });
    }));
    window.PlacyChat!.open({ question: "Hei" });
    await tick(30);
    window.PlacyChat!.close();
    marker.setAttribute("data-placy-page-id", "knutepunktet");
    window.PlacyChat!.open();
    await tick();
    const log = shadow().querySelector(".log") as HTMLElement;
    expect(log.lastElementChild?.classList.contains("starters")).toBe(true);
    expect(log.lastElementChild?.textContent).toContain("Om Knutepunktet");
  });

  it("har en merket startknapp med synlig etikett nederst til høyre over til-toppen-knappen", () => {
    loadWidget();
    expect(button().textContent).toBe("Spør om Leangenbukta");
    expect(button().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    const styleText = shadow().querySelector("style")!.textContent!;
    expect(styleText).toContain(".btn{position:fixed;bottom:76px;right:20px");
  });

  it("viser sidens åpning som første melding og bytter den når siden byttes før samtalen har startet", async () => {
    loadWidget();
    const marker = document.createElement("div");
    marker.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker);
    vi.stubGlobal("fetch", vi.fn((url: string) => jsonResponse({
      starters: ["Hva er Leangenbukta?"],
      opening: String(url).includes("knutepunktet") ? "Du ser på Knutepunktet." : "Velkommen til Leangenbukta.",
    })));
    window.PlacyChat!.open();
    await tick();
    expect(shadow().querySelector(".msg.opening")?.textContent).toBe("Velkommen til Leangenbukta.");
    window.PlacyChat!.close();
    marker.setAttribute("data-placy-page-id", "knutepunktet");
    window.PlacyChat!.open();
    await tick();
    expect(shadow().querySelectorAll(".msg.opening")).toHaveLength(1);
    expect(shadow().querySelector(".msg.opening")?.textContent).toBe("Du ser på Knutepunktet.");
  });

  it("viser kilder som ren tekst (aldri lenker) og et forbehold bare når serveren sender ett", async () => {
    loadWidget();
    const replies = [
      {
        reply: "Forventet siste kvartal 2026.",
        answerType: "fact",
        links: [],
        sources: [{ id: "leangenbukta-6e190f5f", label: "Leangenbukta", page: "Knutepunktet – Leangenbukta", checkedAt: "2026-09-18" }, { label: "<img src=x onerror=alert(1)>" }],
        notice: { kind: "timing", text: "Framdrift kan endre seg." },
        transcript: "t1",
      },
      { reply: "Hei igjen!", answerType: "smalltalk", links: [], sources: [], notice: null, transcript: "t2" },
    ];
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("?pageId=")) return jsonResponse({ starters: [] });
      return jsonResponse(replies.shift());
    }));
    window.PlacyChat!.open({ question: "Når kan jeg flytte inn?" });
    await tick(30);
    const first = shadow().querySelector(".msg.assistant:not(.opening)") as HTMLElement;
    const sources = first.querySelector(".sources") as HTMLElement;
    expect(sources.textContent).toMatch(/^Kilder i oppslaget: /);
    expect(sources.textContent).toContain("Knutepunktet – Leangenbukta");
    expect(sources.querySelector("a, img")).toBeNull();
    expect(first.querySelector(".notice")?.textContent).toBe("Framdrift kan endre seg.");

    const textarea = shadow().querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Takk";
    (shadow().querySelector(".send") as HTMLButtonElement).click();
    await tick(30);
    const all = shadow().querySelectorAll(".msg.assistant:not(.opening)");
    const second = all[all.length - 1] as HTMLElement;
    expect(second.querySelector(".notice")).toBeNull();
    expect(second.querySelector(".sources")).toBeNull();
  });
});
