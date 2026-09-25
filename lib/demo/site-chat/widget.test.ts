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
    // Talestyringen ligger skjult i treet; `hidden` holder den ute av Tab-rekken.
    const items = (Array.from(panel().querySelectorAll("button:not([disabled]), a[href], textarea")) as HTMLElement[])
      .filter((el) => !el.closest("[hidden]"));
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
  it("oppdaterer en åpen chat ved sideskifte og ignorerer et sent svar fra forrige side", async () => {
    loadWidget();
    const marker = document.createElement("div");
    marker.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker);
    const pending: Record<string, (body: unknown) => void> = {};
    const fetchMock = vi.fn((url: string) => new Promise<Response>((resolve) => {
      const pageId = new URL(String(url), "http://localhost").searchParams.get("pageId")!;
      pending[pageId] = (body) => resolve({ ok: true, json: async () => body } as Response);
    }));
    vi.stubGlobal("fetch", fetchMock);

    window.PlacyChat!.open();
    expect(pending.forside).toBeDefined();
    marker.setAttribute("data-placy-page-id", "knutepunktet");
    await tick();
    expect(pending.knutepunktet).toBeDefined();

    pending.knutepunktet({ opening: "Hei fra Knutepunktet", starters: ["Spør om bygget"] });
    await tick();
    pending.forside({ opening: "Gammel forside", starters: ["Gammelt forslag"] });
    await tick();

    expect(shadow().querySelector(".opening")?.textContent).toBe("Hei fra Knutepunktet");
    expect(Array.from(shadow().querySelectorAll(".starter")).map((el) => el.textContent)).toEqual(["Spør om bygget"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignorerer den første forsideresponsen etter navigasjon forside–bygg–forside", async () => {
    loadWidget();
    const marker = document.createElement("div");
    marker.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker);
    const pending: Array<{ pageId: string; resolve: (body: unknown) => void }> = [];
    vi.stubGlobal("fetch", vi.fn((url: string) => new Promise<Response>((resolve) => {
      pending.push({
        pageId: new URL(String(url), "http://localhost").searchParams.get("pageId")!,
        resolve: (body) => resolve({ ok: true, json: async () => body } as Response),
      });
    })));

    window.PlacyChat!.open();
    marker.setAttribute("data-placy-page-id", "knutepunktet");
    await tick();
    marker.setAttribute("data-placy-page-id", "forside");
    await tick();
    expect(pending.map((item) => item.pageId)).toEqual(["forside", "knutepunktet", "forside"]);

    pending[2].resolve({ opening: "Ny forside", starters: ["Nytt forslag"] });
    await tick();
    pending[0].resolve({ opening: "Gammel forside", starters: ["Gammelt forslag"] });
    pending[1].resolve({ opening: "Gammelt bygg", starters: ["Byggforslag"] });
    await tick();
    expect(shadow().querySelector(".opening")?.textContent).toBe("Ny forside");
    expect(Array.from(shadow().querySelectorAll(".starter")).map((el) => el.textContent)).toEqual(["Nytt forslag"]);
  });

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

    const postCalls = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST");
    const lastCallBody = JSON.parse((postCalls[postCalls.length - 1][1] as RequestInit).body as string);
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
  it("viser prototypemerket uten en egen statuslinje", async () => {
    loadWidget();
    expect(shadow().querySelector(".head .badge")?.textContent).toMatch(/prototype/i);
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ starters: [], opening: "Hei!", prototype: true, contentCheckedAt: "2026-09-21" })));
    window.PlacyChat!.open();
    await tick();
    expect(shadow().querySelector(".honesty")).toBeNull();
    expect(panel().hasAttribute("aria-describedby")).toBe(false);
    expect(shadow().querySelector(".head .badge")?.textContent).toMatch(/prototype/i);
  });

  it("viser merkevare og prototypemerke i toppen, og hilsenen før forslagene", async () => {
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
    expect(follows(head, opening)).toBe(true);
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

describe("placy-chat widget — tale via broen", () => {
  const STATE = "placy-chat:voice-state";
  const COMMAND = "placy-chat:voice-command";
  let commands: Array<Record<string, unknown>>;
  const onCommand = (event: Event) => commands.push((event as CustomEvent).detail);

  beforeEach(() => {
    commands = [];
    window.addEventListener(COMMAND, onCommand);
  });
  afterEach(() => window.removeEventListener(COMMAND, onCommand));

  function bridge(detail: Record<string, unknown>) {
    window.dispatchEvent(new CustomEvent(STATE, { detail: { available: true, status: "idle", error: null, notice: null, messages: [], ...detail } }));
  }
  const $ = (selector: string) => shadow().querySelector(selector) as HTMLElement;
  const modeButtons = () => Array.from(shadow().querySelectorAll(".mode")) as HTMLButtonElement[];
  const voiceBubbles = () => Array.from(shadow().querySelectorAll(".msg.voice-message")).map((el) => el.textContent);
  const dividers = () => Array.from(shadow().querySelectorAll(".divider")).map((el) => el.textContent);
  const textarea = () => $("textarea") as HTMLTextAreaElement;

  async function startVoice() {
    loadWidget();
    bridge({});
    window.PlacyChat!.open();
    await tick();
    modeButtons()[1].click();
    ($(".voicebtn:not(.stop)") as HTMLButtonElement).click();
  }

  // Samme regel som widgetens fokusfelle: `hidden` er synlighetsgaten.
  const tabbable = () => (Array.from(panel().querySelectorAll("button:not([disabled]), a[href], textarea")) as HTMLElement[])
    .filter((el) => !el.closest("[hidden]"));

  it("uten bro er det bare tekstchat: ingen moduser i panelet", async () => {
    loadWidget();
    window.PlacyChat!.open();
    await tick();
    expect($(".modes").hidden).toBe(true);
    expect($(".inputrow").hidden).toBe(false);
  });

  it("finner en bro som var montert før skriptet, via hello", async () => {
    const answer = () => bridge({});
    window.addEventListener("placy-chat:voice-hello", answer);
    loadWidget();
    window.removeEventListener("placy-chat:voice-hello", answer);
    window.PlacyChat!.open();
    await tick();
    expect($(".modes").hidden).toBe(false);
    expect(modeButtons().map((b) => b.textContent)).toEqual(["Skriv", "Snakk"]);
    // Tilgjengelig navn begynner med den synlige etiketten.
    expect(modeButtons().map((b) => b.getAttribute("aria-label"))).toEqual(["Skriv til Anja", "Snakk med Anja"]);
  });

  it("venter på første chat-svar før tale kan starte, slik at besøkscookien er satt", async () => {
    let resolveBootstrap: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveBootstrap = resolve; })));
    loadWidget();
    bridge({});

    window.PlacyChat!.open();
    // Åpningen henter først chatprofilen, som i Nyhavna også setter den
    // besøksbundne cookien taleserveren krever.
    expect($(".modes").hidden).toBe(true);
    modeButtons()[1].click();
    ($(".voice-start") as HTMLButtonElement).click();
    expect(commands).toEqual([]);

    resolveBootstrap({ ok: true, json: async () => ({ starters: [] }) } as Response);
    await tick();
    expect($(".modes").hidden).toBe(false);

    modeButtons()[1].click();
    ($(".voice-start") as HTMLButtonElement).click();
    expect(commands).toEqual([{ type: "start" }]);
  });

  it("skjuler tale igjen når første chat-svar er ugyldig, i stedet for å vise en start som vil avvises", async () => {
    let resolveBootstrap: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveBootstrap = resolve; })));
    loadWidget();
    bridge({});
    window.PlacyChat!.open();

    resolveBootstrap({ ok: true, json: async () => null } as Response);
    await tick();
    expect($(".modes").hidden).toBe(true);
    modeButtons()[1].click();
    ($(".voice-start") as HTMLButtonElement).click();
    expect(commands).toEqual([]);
  });

  it("Snakk bytter tekstfeltet mot talestyring i samme felt: ingen tekstfelt eller Send i layout eller tabulatorrekke", async () => {
    loadWidget();
    bridge({});
    window.PlacyChat!.open();
    await tick();
    const composer = $(".composer");
    modeButtons()[1].click();
    expect($(".inputrow").hidden).toBe(true);
    expect($(".voice").hidden).toBe(false);
    expect($(".voice").parentElement).toBe(composer);
    expect(tabbable()).not.toContain(textarea());
    expect(tabbable()).not.toContain($(".send"));
    // Én tydelig startknapp, og den har fokus.
    expect($(".voice-start").hidden).toBe(false);
    expect($(".voice-live").hidden).toBe(true);
    expect(shadow().activeElement).toBe($(".voice-start"));

    ($(".voice-start") as HTMLButtonElement).click();
    expect($(".voice-start").hidden).toBe(true);
    expect($(".voice-live").hidden).toBe(false);
    expect($(".voice-status").textContent).toBe("Kobler til …");
    // Fokus fra den skjulte startknappen havner på Avbryt, ikke i et skjult tekstfelt.
    expect(shadow().activeElement).toBe($(".voicebtn.stop"));
    expect($(".voicebtn.stop").textContent).toBe("Avbryt");
    bridge({ status: "listening", continuity: { status: "none" } });
    expect($(".voicebtn.stop").textContent).toBe("Avslutt tale");
    expect(tabbable()).not.toContain(textarea());

    // Tilbake til Skriv: tekstfeltet kommer tilbake i samme felt, med fokus.
    modeButtons()[0].click();
    expect(commands).toContainEqual({ type: "stop" });
    expect($(".inputrow").hidden).toBe(false);
    expect($(".voice").hidden).toBe(true);
    expect(shadow().activeElement).toBe(textarea());
    expect($(".composer")).toBe(composer);
  });

  it("feltene har samme høyde og toner inn uten bevegelse ved prefers-reduced-motion", () => {
    loadWidget();
    const styleText = shadow().querySelector("style")!.textContent!;
    expect(styleText).toContain(".inputrow{display:flex;align-items:flex-end;gap:8px;min-height:46px}");
    expect(styleText).toContain(".voice{display:flex;align-items:stretch;min-height:46px}");
    expect(styleText).toContain("min-height:46px;max-height:120px");
    expect(styleText).toMatch(/prefers-reduced-motion:reduce\)\{[^@]*\.inputrow,\.voice-start,\.voice-live\{animation:none!important\}/);
  });

  it("gjenåpnet chat i Snakk gir fokus til Start tale, ikke til det skjulte tekstfeltet", async () => {
    loadWidget();
    bridge({});
    window.PlacyChat!.open();
    await tick();
    modeButtons()[1].click();
    window.PlacyChat!.close();
    window.PlacyChat!.open();
    await tick();
    expect(shadow().activeElement).toBe($(".voice-start"));
  });

  it("viser mikrofoninformasjon som en stille boble i loggen før første start, starter først ved klikk, og sier aldri «ny samtale»", async () => {
    loadWidget();
    bridge({});
    window.PlacyChat!.open();
    await tick();
    modeButtons()[1].click();
    expect(modeButtons()[1].getAttribute("aria-pressed")).toBe("true");
    expect($(".voice").hidden).toBe(false);
    const info = $(".msg.mic-info");
    expect(info.parentElement).toBe($(".log"));
    expect(info.classList.contains("divider")).toBe(false);
    expect(info.querySelector("svg")).not.toBeNull();
    expect(info.textContent).toMatch(/^Om talesamtalen/);
    expect(info.textContent).toMatch(/mikrofonen/);
    expect(info.textContent).toMatch(/OpenAI/);
    expect(info.textContent).toMatch(/fortsetter fra samtalen/);
    expect(info.textContent).toMatch(/Avslutt tale, bytter til Skriv eller lukker chatten/);
    expect(commands).toEqual([]);
    ($(".voice-start") as HTMLButtonElement).click();
    expect(commands).toEqual([{ type: "start" }]);
    bridge({ status: "listening", continuity: { status: "none" } });
    expect(dividers().at(-1)).toBe("Anja er klar til å snakke.");
    expect(dividers().join(" ")).not.toMatch(/ny samtale/i);
    // Bare én gang per side.
    modeButtons()[0].click();
    bridge({ status: "idle", handoff: { id: 1, status: "ready", transcript: "t", voiceTurns: 0 } });
    modeButtons()[1].click();
    expect(shadow().querySelectorAll(".msg.mic-info")).toHaveLength(1);
  });

  it("viser status som tekst (prikken er tillegg) og kunngjør den for skjermlesere", async () => {
    await startVoice();
    const announcer = shadow().querySelector(".composer [role='status']") as HTMLElement;
    expect($(".dot").getAttribute("aria-hidden")).toBe("true");
    bridge({ status: "listening" });
    expect($(".voice-status").textContent).toMatch(/Lytter/);
    expect(announcer.textContent).toMatch(/Lytter/);
    expect($(".voice").getAttribute("data-status")).toBe("listening");
    ($(".voicebtn.stop") as HTMLButtonElement).click();
    expect(announcer.textContent).toBe("Skriv er valgt.");
  });

  it("viser status og transkript løpende i samme logg, uten duplikater", async () => {
    await startVoice();
    bridge({ status: "connecting" });
    expect($(".voice-status").textContent).toBe("Kobler til …");
    bridge({ status: "listening", messages: [{ id: "voice-u1", role: "user", text: "Hvordan er" }] });
    expect($(".voice-status").textContent).toMatch(/Lytter/);
    bridge({ status: "thinking", messages: [{ id: "voice-u1", role: "user", text: "Hvordan er det å bo her?" }] });
    expect($(".voice-status").textContent).toBe("Anja finner svaret …");
    const both = [
      { id: "voice-u1", role: "user", text: "Hvordan er det å bo her?" },
      { id: "voice-a1", role: "assistant", text: "Rolig, med turområder rett ved." },
    ];
    bridge({ status: "speaking", messages: both });
    bridge({ status: "speaking", messages: both });
    expect($(".voice-status").textContent).toBe("Anja snakker");
    expect(voiceBubbles()).toEqual(["Hvordan er det å bo her?", "Rolig, med turområder rett ved."]);
    // En ny sesjon begynner med tom liste; gamle bobler blir stående.
    bridge({ status: "listening", messages: [] });
    expect(voiceBubbles()).toHaveLength(2);
  });

  it("under talen er det ingen skriveflyt; et forslag i loggen går til talesesjonen, og et utkast venter i Skriv", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({ starters: ["Er det barnehage i nærheten?"] }));
    loadWidget();
    bridge({});
    window.PlacyChat!.open();
    await tick();
    textarea().value = "Halvskrevet utkast";
    modeButtons()[1].click();
    ($(".voice-start") as HTMLButtonElement).click();
    bridge({ status: "listening" });
    expect($(".inputrow").hidden).toBe(true);
    vi.mocked(fetch).mockClear();
    ($(".starter") as HTMLButtonElement).click();
    expect(commands).toContainEqual({ type: "text", text: "Er det barnehage i nærheten?" });
    expect(commands.filter((c) => c.type === "text")).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    modeButtons()[0].click();
    expect(textarea().value).toBe("Halvskrevet utkast");
  });

  it("bytte beholder boblene og loggens rulleposisjon", async () => {
    await startVoice();
    bridge({ status: "speaking", messages: [{ id: "voice-a1", role: "assistant", text: "Hei." }] });
    const log = $(".log");
    log.scrollTop = 7;
    const before = Array.from(log.children);
    modeButtons()[0].click();
    expect(Array.from(log.children).slice(0, before.length)).toEqual(before);
    expect(voiceBubbles()).toEqual(["Hei."]);
    // Overgangsnotatet kommer først når overføringen er ferdig.
    expect(log.scrollTop).toBe(7);
  });

  describe("én samtale på tvers av skriving og tale", () => {
    // Broen melder «overføring pågår» synkront når stopp-kommandoen kommer, slik voice-bridge.tsx gjør.
    let handoffId = 0;
    const bridgeStops = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "stop") bridge({ status: "listening", handoff: { id: ++handoffId, status: "pending" } });
    };
    beforeEach(() => window.addEventListener(COMMAND, bridgeStops));
    afterEach(() => window.removeEventListener(COMMAND, bridgeStops));

    async function textThenVoice() {
      vi.mocked(fetch).mockImplementation((_url, init) =>
        init?.method === "POST" ? jsonResponse({ reply: "Svar.", transcript: "tekst-historikk" }) : jsonResponse({ starters: [] }));
      loadWidget();
      bridge({});
      window.PlacyChat!.open();
      await tick();
      textarea().value = "Første tekstspørsmål";
      ($(".send") as HTMLButtonElement).click();
      await tick();
      modeButtons()[1].click();
      ($(".voicebtn:not(.stop)") as HTMLButtonElement).click();
      bridge({ status: "listening", continuity: { status: "carried", turns: 2, trimmed: false } });
      bridge({ status: "speaking", messages: [{ id: "voice-a1", role: "assistant", text: "Som jeg skrev …" }] });
    }
    const posts = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => JSON.parse(String(init!.body)));

    it("tekst → tale → tekst → tale: tokenet går inn i talen, og tekstchatten fortsetter med serverens nye token", async () => {
      await textThenVoice();
      expect(commands).toContainEqual({ type: "start", transcript: "tekst-historikk" });
      expect(dividers()).toContain("Anja er klar til å snakke og fortsetter fra samtalen over.");

      ($(".voicebtn.stop") as HTMLButtonElement).click();
      bridge({ status: "idle", handoff: { id: handoffId, status: "pending" } });
      expect(modeButtons()[0].getAttribute("aria-pressed")).toBe("true");
      expect(($(".send") as HTMLButtonElement).disabled).toBe(true);
      // Mens overføringen pågår, venter meldingen i feltet i stedet for å gå uten talens kontekst.
      textarea().value = "Hva sa du om skolen?";
      ($(".send") as HTMLButtonElement).click();
      expect(posts()).toHaveLength(1);

      bridge({ status: "idle", handoff: { id: handoffId, status: "ready", transcript: "tale-historikk", voiceTurns: 2, trimmed: false } });
      expect(dividers().at(-1)).toBe("Tilbake til skriving. Chatten fortsetter fra talesamtalen.");
      expect(voiceBubbles()).toEqual(["Som jeg skrev …"]);
      ($(".send") as HTMLButtonElement).click();
      await tick();
      expect(posts()[1]).toMatchObject({ message: "Hva sa du om skolen?", transcript: "tale-historikk" });

      // Andre bytte til tale: samtykket er gitt, så talen starter direkte med
      // nyeste token — det tekstchatten nettopp utstedte etter talens token.
      commands = [];
      modeButtons()[1].click();
      expect(commands).toEqual([{ type: "start", transcript: "tekst-historikk" }]);
    });

    it("bruker talens token i neste skrevne melding", async () => {
      await textThenVoice();
      ($(".voicebtn.stop") as HTMLButtonElement).click();
      bridge({ status: "idle", handoff: { id: handoffId, status: "ready", transcript: "tale-historikk", voiceTurns: 2, trimmed: true } });
      expect(dividers().at(-1)).toMatch(/de siste delene av samtalen/);
      textarea().value = "Og barnehagen?";
      ($(".send") as HTMLButtonElement).click();
      await tick();
      expect(posts()[1]).toMatchObject({ message: "Og barnehagen?", transcript: "tale-historikk" });
    });

    it("sier ærlig fra når overføringen feiler, og beholder tekstturene fra før talen", async () => {
      await textThenVoice();
      window.PlacyChat!.close();
      bridge({ status: "idle", handoff: { id: handoffId, status: "failed" } });
      expect(dividers().at(-1)).toMatch(/kunne ikke overføres.*ser ikke det som ble sagt/);
      expect(voiceBubbles()).toEqual(["Som jeg skrev …"]);
      window.PlacyChat!.open();
      await tick();
      textarea().value = "Etter talen";
      ($(".send") as HTMLButtonElement).click();
      await tick();
      expect(posts()[1]).toMatchObject({ message: "Etter talen", transcript: "tekst-historikk" });
    });

    it("sier fra når talen ikke fikk med seg tekstsamtalen", async () => {
      loadWidget();
      bridge({});
      window.PlacyChat!.open();
      await tick();
      modeButtons()[1].click();
      ($(".voicebtn:not(.stop)") as HTMLButtonElement).click();
      bridge({ status: "listening", continuity: { status: "rejected" } });
      expect(dividers().at(-1)).toMatch(/fikk ikke med seg samtalen over/);
    });
  });

  it("Avslutt tale stopper sesjonen og beholder boblene", async () => {
    await startVoice();
    bridge({ status: "speaking", messages: [{ id: "voice-a1", role: "assistant", text: "Hei, jeg er Anja." }] });
    ($(".voicebtn.stop") as HTMLButtonElement).click();
    expect(commands).toContainEqual({ type: "stop" });
    expect(voiceBubbles()).toEqual(["Hei, jeg er Anja."]);
    expect(modeButtons()[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("går tilbake til skriving med synlig årsak når mikrofon eller kvote stopper starten", async () => {
    await startVoice();
    bridge({ status: "connecting" });
    bridge({ status: "error", error: "Mikrofonen er ikke tilgjengelig. Tillat mikrofon i nettleseren, og prøv igjen." });
    expect(modeButtons()[0].getAttribute("aria-pressed")).toBe("true");
    expect($(".voice").hidden).toBe(true);
    expect(shadow().querySelector(".msg.error")?.textContent).toMatch(/Mikrofonen er ikke tilgjengelig/);
  });

  it("skjuler talen og avslutter når broen forsvinner", async () => {
    await startVoice();
    bridge({ status: "listening" });
    window.dispatchEvent(new CustomEvent(STATE, { detail: { available: false } }));
    expect($(".modes").hidden).toBe(true);
    expect($(".inputrow").hidden).toBe(false);
    expect(dividers().at(-1)).toBe("Tilbake til skriving.");
  });
});

describe("placy-chat widget — temarad", () => {
  const CATEGORIES = [
    { id: "leangenbukta-prosjektet", label: "Leangenbukta", icon: "Building2", color: "#91563e", questions: ["Hva er Leangenbukta?", "Hvilke bygg er i salg nå?", "Hva finnes i nærområdet?"] },
    { id: "hverdag", label: "Hverdag", icon: "ShoppingCart", color: "#36d16f", questions: ["Hvor er nærmeste dagligvarebutikk?", "Hvor er nærmeste apotek?", "Hvilke kjøpesentre ligger i nærheten?"] },
    { id: "oppvekst", label: "Oppvekst", icon: "GraduationCap", color: "#f8ae17", questions: ["Hvilken skolekrets hører Leangenbukta til?", "Hvilke barnehager ligger i nærheten?", "Hvor kan barna leke ute?"] },
  ];
  const $ = (selector: string) => shadow().querySelector(selector) as HTMLElement;
  const tabs = () => Array.from(shadow().querySelectorAll("[role='tab']")) as HTMLButtonElement[];
  const questions = () => Array.from(shadow().querySelectorAll(".starter")).map((el) => el.textContent);
  const selected = () => tabs().filter((tab) => tab.getAttribute("aria-selected") === "true").map((tab) => tab.textContent);

  function withCategories(extra: Record<string, unknown> = {}) {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ reply: "Svar.", answerType: "fact", links: [], transcript: "tok-1" });
      void url;
      return jsonResponse({ opening: "Hei!", starters: ["Sidens forslag"], categories: CATEGORIES, ...extra });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function openWithRail(extra?: Record<string, unknown>) {
    const fetchMock = withCategories(extra);
    loadWidget();
    window.PlacyChat!.open();
    await tick();
    return fetchMock;
  }

  it("står fast mellom toppen og loggen, som faner med første tema valgt og dets tre forslag", async () => {
    await openWithRail();
    const rail = $(".rail");
    expect(rail.hidden).toBe(false);
    expect(rail.previousElementSibling).toBe($(".head"));
    expect(rail.nextElementSibling).toBe($(".log"));
    expect($("[role='tablist']").getAttribute("aria-label")).toBe("Tema for spørsmålsforslag");
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Leangenbukta", "Hverdag", "Oppvekst"]);
    expect(selected()).toEqual(["Leangenbukta"]);
    // Ett forslagssett: temaets, ikke sidens `starters` ved siden av.
    expect(questions()).toEqual(CATEGORIES[0].questions);
    const panelEl = $(".starters");
    expect(panelEl.getAttribute("role")).toBe("tabpanel");
    expect(panelEl.getAttribute("aria-labelledby")).toBe(tabs()[0].id);
    expect(tabs()[0].getAttribute("aria-controls")).toBe(panelEl.id);
    expect($(".starters-label").textContent).toBe("Forslag til spørsmål – Leangenbukta");
    // Ikon i temaets farge; CSS har myk flate, hevet valgt pille og sideveis rulling.
    expect((tabs()[1].querySelector(".tab-icon") as HTMLElement).style.backgroundColor).toBe("rgb(54, 209, 111)");
    expect(tabs()[1].querySelector(".tab-icon svg")).not.toBeNull();
    const css = shadow().querySelector("style")!.textContent!;
    expect(css).toMatch(/\.rail\{flex:none/);
    expect(css).toMatch(/\.rail-track\{[^}]*overflow-x:auto/);
    expect(css).toMatch(/\.tab\[aria-selected='true'\]\{background:#fff[^}]*box-shadow/);
    expect(css).toMatch(/\.tab:focus-visible\{outline/);
  });

  it("et nytt tema bytter til dets tre forslag, og et forslag sendes som nøyaktig den viste teksten", async () => {
    const fetchMock = await openWithRail();
    tabs()[1].click();
    expect(selected()).toEqual(["Hverdag"]);
    expect(questions()).toEqual(CATEGORIES[1].questions);
    expect($(".starters").getAttribute("aria-labelledby")).toBe(tabs()[1].id);
    (shadow().querySelectorAll(".starter")[1] as HTMLButtonElement).click();
    await tick();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string).message).toBe("Hvor er nærmeste apotek?");
  });

  it("piltaster, Home og End flytter valg og fokus; bare valgt fane er i tabulatorrekken", async () => {
    await openWithRail();
    tabs()[0].focus();
    const key = (k: string) => $("[role='tablist']").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    key("ArrowRight");
    expect(selected()).toEqual(["Hverdag"]);
    expect(shadow().activeElement).toBe(tabs()[1]);
    key("End");
    expect(selected()).toEqual(["Oppvekst"]);
    key("ArrowRight");
    expect(selected()).toEqual(["Leangenbukta"]);
    key("ArrowLeft");
    expect(selected()).toEqual(["Oppvekst"]);
    key("Home");
    expect(shadow().activeElement).toBe(tabs()[0]);
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(questions()).toEqual(CATEGORIES[0].questions);
  });

  it("fokusfellen hopper over de ikke-valgte fanene og holder Tab i panelet", async () => {
    await openWithRail();
    const close = $(".close") as HTMLButtonElement;
    close.focus();
    const back = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    panel().dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(shadow().activeElement).not.toBe(tabs()[1]);
  });

  it("toner kanten ut der det finnes flere temaer å rulle til", async () => {
    await openWithRail();
    const track = $(".rail-track");
    Object.defineProperty(track, "scrollWidth", { configurable: true, value: 600 });
    Object.defineProperty(track, "clientWidth", { configurable: true, value: 360 });
    track.dispatchEvent(new Event("scroll"));
    expect(track.classList.contains("fade-end")).toBe(true);
    expect(track.classList.contains("fade-start")).toBe(false);
    track.scrollLeft = 240;
    track.dispatchEvent(new Event("scroll"));
    expect(track.classList.contains("fade-start")).toBe(true);
    expect(track.classList.contains("fade-end")).toBe(false);
  });

  it("i en påbegynt samtale flyttes de nye forslagene nederst, uten å viske ut samtalen eller tokenet", async () => {
    const fetchMock = await openWithRail();
    (shadow().querySelector(".starter") as HTMLButtonElement).click();
    await tick();
    const log = $(".log");
    expect(log.lastElementChild?.classList.contains("msg")).toBe(true);
    tabs()[2].click();
    expect(log.lastElementChild).toBe($(".starters"));
    expect(shadow().querySelectorAll(".msg.user")).toHaveLength(1);
    expect(shadow().querySelectorAll(".msg.assistant:not(.opening)")).toHaveLength(1);
    (shadow().querySelector(".starter") as HTMLButtonElement).click();
    await tick();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(JSON.parse(posts[1][1]!.body as string)).toMatchObject({ message: CATEGORIES[2].questions[0], transcript: "tok-1" });
  });

  it("uten temaer i svaret (eldre endepunkt) er raden skjult og sidens forslag vises som før", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ opening: "Hei!", starters: ["Sidens forslag", "Et til"] })));
    loadWidget();
    window.PlacyChat!.open();
    await tick();
    expect($(".rail").hidden).toBe(true);
    expect(tabs()).toHaveLength(0);
    expect(questions()).toEqual(["Sidens forslag", "Et til"]);
    expect($(".starters").hasAttribute("role")).toBe(false);
  });

  it("stoler ikke på ukjente ikoner, farger eller HTML fra serveren", async () => {
    await openWithRail({
      categories: [
        { id: "x", label: "<img src=x onerror=alert(1)>", icon: "javascript:alert(1)", color: "red;background:url(//evil)", questions: ["<b>Spørsmål</b>"] },
        { id: "Bad ID!", label: "Bort", icon: "Bus", color: "#000000", questions: ["Q"] },
        { id: "tom", label: "Tom", icon: "Bus", color: "#000000", questions: [] },
      ],
    });
    expect(tabs()).toHaveLength(1);
    const tab = tabs()[0];
    expect(tab.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(tab.querySelector("img")).toBeNull();
    expect(tab.querySelector("svg")).toBeNull();
    expect((tab.querySelector(".tab-icon") as HTMLElement).style.backgroundColor).toBe("rgb(145, 86, 62)");
    expect(questions()).toEqual(["<b>Spørsmål</b>"]);
    expect(shadow().querySelector(".starter b")).toBeNull();
  });

  it("beholder valgt tema ved sideskifte og ignorerer et sent svar fra forrige side", async () => {
    loadWidget();
    const marker = document.createElement("div");
    marker.setAttribute("data-placy-page-id", "forside");
    document.body.appendChild(marker);
    const pending: Record<string, (body: unknown) => void> = {};
    vi.stubGlobal("fetch", vi.fn((url: string) => new Promise<Response>((resolve) => {
      const pageId = new URL(String(url), "http://localhost").searchParams.get("pageId")!;
      pending[pageId] = (body) => resolve({ ok: true, json: async () => body } as Response);
    })));
    const forPage = (first: string[]) => ({ opening: "Hei!", categories: [{ ...CATEGORIES[0], questions: first }, ...CATEGORIES.slice(1)] });

    window.PlacyChat!.open();
    pending.forside(forPage(["Forsidespørsmål 1", "Forsidespørsmål 2", "Forsidespørsmål 3"]));
    await tick();
    tabs()[1].click();
    marker.setAttribute("data-placy-page-id", "knutepunktet");
    await tick();
    // Raden står mens den nye siden lastes; valgt tema og forslag byttes ikke ut.
    expect($(".rail").hidden).toBe(false);
    expect(questions()).toEqual(CATEGORIES[1].questions);
    marker.setAttribute("data-placy-page-id", "beliggenhet");
    await tick();

    pending.beliggenhet(forPage(["Beliggenhet 1", "Beliggenhet 2", "Beliggenhet 3"]));
    await tick();
    pending.knutepunktet(forPage(["Knutepunktet 1", "Knutepunktet 2", "Knutepunktet 3"]));
    await tick();
    expect(selected()).toEqual(["Hverdag"]);
    tabs()[0].click();
    expect(questions()).toEqual(["Beliggenhet 1", "Beliggenhet 2", "Beliggenhet 3"]);
  });

  it("i en pågående tale går et temaforslag til talesesjonen, ikke som skrevet melding", async () => {
    const commands: Array<Record<string, unknown>> = [];
    const onCommand = (event: Event) => commands.push((event as CustomEvent).detail);
    window.addEventListener("placy-chat:voice-command", onCommand);
    const bridge = (detail: Record<string, unknown>) =>
      window.dispatchEvent(new CustomEvent("placy-chat:voice-state", { detail: { available: true, status: "idle", error: null, notice: null, messages: [], ...detail } }));
    const fetchMock = withCategories();
    loadWidget();
    bridge({});
    window.PlacyChat!.open();
    await tick();
    (shadow().querySelectorAll(".mode")[1] as HTMLButtonElement).click();
    ($(".voice-start") as HTMLButtonElement).click();
    bridge({ status: "listening" });
    tabs()[2].click();
    expect($(".inputrow").hidden).toBe(true);
    (shadow().querySelectorAll(".starter")[2] as HTMLButtonElement).click();
    expect(commands).toContainEqual({ type: "text", text: "Hvor kan barna leke ute?" });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    window.removeEventListener("placy-chat:voice-command", onCommand);
  });
});

describe("placy-chat widget — en annen nettsidekopi (Nyhavna, 2026-09-24)", () => {
  it("bruker kopiens endepunkt, side og merke, og tar bare gyldige #rrggbb-farger", async () => {
    const page = document.createElement("main");
    page.setAttribute("data-placy-page-id", "beliggenhet");
    document.body.appendChild(page);
    loadWidget({
      "data-endpoint": "/api/demo/nyhavna-chat",
      "data-label": "Spør om Nyhavna",
      "data-board-href": "/demo/nyhavna-lokal",
      "data-offset-bottom": "20px",
      "data-accent": "#005ef5",
      "data-surface": "#f7f5eb",
      "data-border": "red; background:url(x)",
      "data-soft": "#12345",
    });
    expect(host().style.getPropertyValue("--placy-chat-accent")).toBe("#005ef5");
    expect(host().style.getPropertyValue("--placy-chat-surface")).toBe("#f7f5eb");
    expect(host().style.getPropertyValue("--placy-chat-border")).toBe("");
    expect(host().style.getPropertyValue("--placy-chat-soft")).toBe("");
    expect(button().textContent).toBe("Spør om Nyhavna");
    window.PlacyChat!.open();
    await tick();
    expect(fetch).toHaveBeenCalledWith("/api/demo/nyhavna-chat?pageId=beliggenhet", expect.anything());
  });

  it("uten farger beholder widgeten Leangenbuktas standardpalett", () => {
    loadWidget();
    expect(host().getAttribute("style")).toBeNull();
    const css = shadow().querySelector("style")!.textContent!;
    expect(css).toContain("var(--placy-chat-accent,#91563e)");
    expect(css).toContain("var(--placy-chat-surface,#faf6f2)");
  });
});
