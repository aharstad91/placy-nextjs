/*!
 * Placy-chat — frittstående innbyggingswidget for nettsidekopiene
 * (Leangenbukta 2026-09-23, Nyhavna 2026-09-24).
 *
 * Lastes akkurat slik en WordPress-side ville lastet den:
 *   <script src="/embed/placy-chat.js" data-endpoint="/api/demo/leangenbukta-chat"
 *           data-page-id="forside" data-label="Spør om Leangenbukta"
 *           data-board-href="/demo/leangenbukta-lokal" defer></script>
 *
 * En annen kopi setter sitt eget endepunkt, merke, board og farger
 * (`data-accent`, `data-surface` osv., se `readTheme`); uten dem gjelder
 * Leangenbuktas standard.
 *
 * Ingen avhengigheter, ingen build-steg, ingen global lekkasje utover
 * `window.PlacyChat`. All UI ligger i et Shadow DOM med egen CSS, slik at
 * verten (Leangenbuktas WordPress-stiler) ikke kan lekke inn eller ut.
 * Server-svar settes ALLTID med `textContent`, aldri `innerHTML` — det er
 * grunnen til at en `<script>` eller `javascript:`-lenke i et modellsvar
 * aldri kan bli kjørbar eller klikkbar her, uansett hva serveren skulle sende.
 *
 * Tale (2026-09-24): finnes det en talebro på siden (kopiene monterer
 * `components/demo/site-chat-voice-bridge.tsx`), får panelet «Skriv» / «Snakk». Loggen står
 * fast; bare feltet under skifter: tekstfelt og Send i Skriv, talestyring
 * (Start tale, synlig status, Avslutt tale) i Snakk. Under talen finnes ikke
 * noe tekstfelt; skriving er å bytte tilbake til Skriv. Broen eier WebRTC;
 * widgeten viser bare status og transkript som bobler i samme logg.
 * Protokollen: lib/demo/leangenbukta-chat/voice-channel.ts. Uten bro kommer
 * det aldri en tilstand, og widgeten er ren tekstchat.
 *
 * Én samtale: skriving og tale deler historikk gjennom det signerte tokenet.
 * Talen starter med tekstchattens token; når talen er slutt, får widgeten et
 * nytt token fra serveren (`handoff`) med det som faktisk ble sagt. Boblene
 * her er bare visning — de blir aldri sendt som historikk.
 *
 * Temarad (2026-09-24): under toppen står Boardets kategorier som faner
 * (samme form som boardets StoryRail). Valgt tema bestemmer de tre
 * spørsmålsforslagene i loggen — ikke hva Anja vet. Temaene kommer fra GET
 * (`categories`); uten dem er raden skjult og sidens egne forslag vises.
 */
(function () {
  "use strict";
  if (window.__PLACY_CHAT_LOADED__) return;
  window.__PLACY_CHAT_LOADED__ = true;

  var scriptEl = document.currentScript;

  function config() {
    var el = scriptEl || document.querySelector("script[data-placy-chat],script[src*='placy-chat.js']");
    var data = (el && el.dataset) || {};
    return {
      endpoint: data.endpoint || "/api/demo/leangenbukta-chat",
      pageId: data.pageId || "forside",
      label: data.label || "Spør om Leangenbukta",
      boardHref: data.boardHref || "/demo/leangenbukta-lokal",
      offsetBottom: /^\d{1,3}px$/.test(data.offsetBottom || "") ? data.offsetBottom : "76px",
      theme: readTheme(data),
    };
  }

  /**
   * Fargene til verten (2026-09-24): `data-accent`, `data-accent-dark`,
   * `data-border`, `data-surface` (toppen og flater), `data-soft` og
   * `data-soft-border` (assistentens bobler) og `data-muted` (hjelpetekst).
   * Bare `#rrggbb` godtas; alt annet gir Leangenbuktas standardfarge.
   */
  var THEME_KEYS = {
    accent: "--placy-chat-accent",
    accentDark: "--placy-chat-accent-dark",
    border: "--placy-chat-border",
    surface: "--placy-chat-surface",
    soft: "--placy-chat-soft",
    softBorder: "--placy-chat-soft-border",
    muted: "--placy-chat-muted",
  };
  function readTheme(data) {
    var theme = {};
    Object.keys(THEME_KEYS).forEach(function (key) {
      if (typeof data[key] === "string" && /^#[0-9a-f]{6}$/i.test(data[key])) theme[THEME_KEYS[key]] = data[key];
    });
    return theme;
  }

  var cfg = config();

  /**
   * Gjeldende side-ID, lest fra DOM-en ved HVERT kall — ikke cachet ved
   * skriptlasting.
   *
   * Leangenbukta-kopien er en Next-app med klientnavigasjon: skriptet lastes
   * én gang, men brukeren bytter side uten en ny sidelasting. Hver side setter
   * `data-placy-page-id` på et element; siste forekomst i DOM-en vinner (den
   * nyeste siden i tilfelle flere skulle finnes samtidig under en overgang).
   * Faller tilbake på skriptets eget `data-page-id` hvis ingen side har satt
   * attributtet ennå (f.eks. helt tidlig i en sidelasting).
   */
  function currentPageId() {
    var nodes = document.querySelectorAll("[data-placy-page-id]");
    var last = nodes.length ? nodes[nodes.length - 1] : null;
    var fromPage = last && last.getAttribute("data-placy-page-id");
    return fromPage || cfg.pageId;
  }

  // ---------------------------------------------------------------------
  // Tilstand
  // ---------------------------------------------------------------------
  var open = false;
  var transcript = null;
  var lastFocused = null;
  var startersLoadedForPage = null;
  var startersRequestId = 0;
  var sending = false;

  // Tale. Hendelsesnavnene er de samme som i voice-channel.ts.
  var VOICE_HELLO = "placy-chat:voice-hello";
  var VOICE_STATE = "placy-chat:voice-state";
  var VOICE_COMMAND = "placy-chat:voice-command";
  var VOICE_STATUSES = { idle: 1, connecting: 1, listening: 1, thinking: 1, speaking: 1, error: 1 };
  var VOICE_ACTIVE = { connecting: 1, listening: 1, thinking: 1, speaking: 1 };
  var VOICE_LABELS = {
    connecting: "Kobler til …",
    listening: "Lytter – snakk når du vil",
    thinking: "Anja finner svaret …",
    speaking: "Anja snakker",
  };
  // Skjermleseren får vite at feltet under loggen har byttet innhold.
  var VOICE_READY = "Snakk er valgt. Trykk Start tale for å snakke med Anja, eller bytt til Skriv for å skrive.";
  var HANDOFF_SAFETY_MS = 20000;
  var voice = {
    available: false,
    mode: "text", // "text" | "voice"
    // "off" | "starting" | "on": widgetens egen fase. `status` er broens.
    session: "off",
    status: "idle",
    notice: null,
    // Mikrofoninformasjonen er vist, og brukeren har startet tale én gang på
    // denne siden. Deretter starter «Snakk» talen direkte.
    infoShown: false,
    consented: false,
    // Denne talesesjonen er meldt klar, og noe er sagt eller skrevet i den.
    announced: false,
    spoke: false,
    // "pending" mens broen henter nytt historikktoken etter talen.
    handoff: null,
    handoffKey: null,
    handoffTimer: null,
  };
  // Talebobler etter broens stabile ID: samme melding oppdateres, aldri dobles.
  var voiceBubbles = new Map();

  // ---------------------------------------------------------------------
  // DOM / Shadow root
  // ---------------------------------------------------------------------
  var host = document.createElement("div");
  host.setAttribute("data-placy-chat-host", "");
  Object.keys(cfg.theme).forEach(function (name) { host.style.setProperty(name, cfg.theme[name]); });
  var shadow = host.attachShadow({ mode: "open" });

  // Standard er Leangenbuktas palett: brunt fra logoen/knappene og sanden fra
  // forsidens kartseksjon. Verten kan overstyre med data-attributtene over
  // eller CSS-variablene.
  var ACCENT = "var(--placy-chat-accent,#91563e)";
  var ACCENT_DARK = "var(--placy-chat-accent-dark,#6f3f2b)";
  var BORDER = "var(--placy-chat-border,#d6c6b7)";
  var CREAM = "var(--placy-chat-surface,#faf6f2)";
  var MUTED = "var(--placy-chat-muted,#5d5148)";
  var SOFT = "var(--placy-chat-soft,#f6f0ea)";
  var SOFT_BORDER = "var(--placy-chat-soft-border,#ebe0d5)";

  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:var(--placy-chat-font,'Open Sans',system-ui,sans-serif)}",
    "svg{display:block;flex:none}",
    ".btn{position:fixed;bottom:" + cfg.offsetBottom + ";right:20px;z-index:2147483000;",
    "display:inline-flex;align-items:center;gap:8px;max-width:calc(100vw - 40px);",
    "background:" + ACCENT + ";color:#fff;border:none;border-radius:999px;",
    "padding:11px 18px 11px 14px;font-size:14px;font-weight:600;line-height:1.2;cursor:pointer;",
    "box-shadow:0 6px 18px rgba(42,44,46,.24);transition:background-color .15s ease,transform .15s ease}",
    ".btn:hover{background:" + ACCENT_DARK + ";transform:translateY(-1px)}",
    ".btn svg{width:20px;height:20px}",
    ".btn:focus-visible,.close:focus-visible,.starter:focus-visible,.send:focus-visible,textarea:focus-visible,.linkbtn:focus-visible,.mode:focus-visible,.voicebtn:focus-visible{outline:3px solid " + ACCENT + ";outline-offset:2px}",
    ".panel{position:fixed;z-index:2147483001;background:#fff;color:var(--placy-chat-text,#2a2c2e);",
    "display:flex;flex-direction:column;overflow:hidden;border:1px solid " + BORDER + ";border-radius:16px;",
    "box-shadow:0 18px 48px rgba(42,44,46,.28);right:20px;bottom:20px;width:400px;max-width:calc(100vw - 40px);",
    "height:min(680px,calc(100vh - 40px));opacity:0;transform:translateY(12px);transition:transform .2s ease,opacity .2s ease}",
    ".panel.open{opacity:1;transform:translateY(0)}",
    // `display:flex` over overstyrer `hidden`-attributtet; uten denne regelen
    // ligger et lukket panel igjen i tilgjengelighetstreet og tabulatorrekken.
    ".panel[hidden]{display:none}",
    "@media (max-width:700px){.panel{left:0;right:0;bottom:0;width:100%;max-width:100%;height:85vh;height:85dvh;",
    "border-width:1px 0 0;border-radius:16px 16px 0 0;opacity:1;transform:translateY(100%)}.panel.open{transform:translateY(0)}}",
    "@media (prefers-reduced-motion:reduce){.panel,.btn{transition:none}.btn:hover{transform:none}.dot,.inputrow,.voice-start,.voice-live{animation:none!important}}",
    ".head{padding:14px 12px 14px 16px;background:" + CREAM + ";display:flex;align-items:center;gap:10px}",
    ".mark{width:36px;height:36px;border-radius:50%;background:" + ACCENT + ";color:#fff;display:flex;align-items:center;justify-content:center;flex:none}",
    ".mark svg{width:20px;height:20px}",
    ".titles{flex:1;min-width:0}",
    ".head h2{font-size:16px;font-weight:700;line-height:1.25;margin:0;overflow-wrap:anywhere}",
    ".sub{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12px;color:" + MUTED + ";margin:3px 0 0}",
    ".badge{font-size:11px;font-weight:600;letter-spacing:.02em;color:" + ACCENT_DARK + ";background:#fff;",
    "border:1px solid " + BORDER + ";border-radius:999px;padding:1px 8px;line-height:1.5;white-space:nowrap}",
    ".close{width:36px;height:36px;border-radius:50%;background:none;border:none;font-size:22px;line-height:1;",
    "cursor:pointer;color:inherit;flex:none}",
    ".close:hover{background:var(--placy-chat-soft-border,#efe7df)}",
    // Temaraden: samme form som boardets StoryRail — én myk, avrundet flate,
    // ikon i temaets farge over navnet, valgt tema som hvit, hevet pille. Den
    // står fast over loggen; bare loggen ruller.
    ".rail{flex:none;padding:10px 12px 8px;background:#fff;border-bottom:1px solid var(--placy-chat-soft-border,#efe7df)}",
    ".rail[hidden]{display:none}",
    ".rail-shell{border-radius:22px;padding:4px;background:rgba(28,25,23,.05)}",
    ".rail-track{position:relative;display:flex;gap:2px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;",
    "overscroll-behavior-x:contain;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}",
    ".rail-track::-webkit-scrollbar{display:none}",
    // Kanten toner ut der det finnes flere temaer å rulle til.
    ".rail-track.fade-end{-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}",
    ".rail-track.fade-start{-webkit-mask-image:linear-gradient(to right,transparent,#000 28px);mask-image:linear-gradient(to right,transparent,#000 28px)}",
    ".rail-track.fade-start.fade-end{-webkit-mask-image:linear-gradient(to right,transparent,#000 28px,#000 calc(100% - 28px),transparent);",
    "mask-image:linear-gradient(to right,transparent,#000 28px,#000 calc(100% - 28px),transparent)}",
    ".tab{flex:none;display:flex;flex-direction:column;align-items:center;gap:3px;border:none;border-radius:18px;padding:6px 12px 7px;",
    "background:transparent;white-space:nowrap;font-size:12px;font-weight:600;letter-spacing:-.01em;line-height:1.2;color:#6f655d;",
    "cursor:pointer;transition:background-color .2s ease,color .2s ease,box-shadow .2s ease}",
    ".tab:hover{color:#1c1917}",
    // Valgt tema vises med form (hvit pille med kant og skygge), ikke bare farge.
    ".tab[aria-selected='true']{background:#fff;color:#1c1917;box-shadow:inset 0 0 0 1px rgba(28,25,23,.07),0 1px 3px rgba(28,25,23,.1)}",
    ".tab:focus-visible{outline:2px solid " + ACCENT + ";outline-offset:-2px}",
    ".tab-icon{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;color:#fff}",
    ".tab-icon svg{width:13px;height:13px}",
    "@media (prefers-reduced-motion:reduce){.rail-track{scroll-behavior:auto}.tab{transition:none}}",
    ".log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:12px}",
    ".msg{max-width:88%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".msg.user{align-self:flex-end;background:" + ACCENT + ";color:#fff;border-bottom-right-radius:4px}",
    ".msg.assistant{align-self:flex-start;background:" + SOFT + ";border:1px solid " + SOFT_BORDER + ";border-bottom-left-radius:4px}",
    ".msg.error{align-self:flex-start;background:#fbeaea;color:#7a1f1f;border-bottom-left-radius:4px}",
    ".msg .notice{margin:10px 0 0;padding:6px 10px;background:#fff;border-left:3px solid " + ACCENT + ";",
    "border-radius:0 6px 6px 0;font-size:13px;line-height:1.45;color:#4a3b30;white-space:normal}",
    ".msg .sources{margin:10px 0 0;padding-top:8px;border-top:1px solid var(--placy-chat-soft-border,#e3d6c9);font-size:12px;line-height:1.45;color:" + MUTED + ";white-space:normal}",
    ".links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;white-space:normal}",
    ".linkbtn{font-size:13px;line-height:1.3;padding:6px 12px;border-radius:999px;border:1px solid " + ACCENT + ";",
    "background:#fff;color:" + ACCENT_DARK + ";text-decoration:none;cursor:pointer}",
    ".linkbtn:hover{background:" + ACCENT + ";color:#fff}",
    ".starters{display:flex;flex-direction:column;gap:8px}",
    ".starters[hidden]{display:none}",
    ".starters-label{margin:0;font-size:12px;font-weight:600;color:" + MUTED + "}",
    ".chips{display:flex;flex-wrap:wrap;gap:6px}",
    ".starter{border:1px solid " + BORDER + ";background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;",
    "line-height:1.35;text-align:left;max-width:100%;cursor:pointer;color:" + ACCENT_DARK + "}",
    ".starter:hover{background:" + CREAM + ";border-color:" + ACCENT + "}",
    ".status{margin:0;font-size:12px;color:" + MUTED + ";padding:0 16px 8px}",
    // Feltet under loggen. Skriv og Snakk har samme høyde (46px), så loggen
    // verken hopper eller mister rulleposisjonen når modusen byttes.
    ".composer{border-top:1px solid " + BORDER + ";background:#fff;padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px}",
    // Etter grunnregelen, ellers overstyrer `padding` over safe-area-luften i bunnarket.
    "@media (max-width:700px){.composer{padding-bottom:max(12px,env(safe-area-inset-bottom))}}",
    ".inputrow{display:flex;align-items:flex-end;gap:8px;min-height:46px}",
    ".inputrow[hidden]{display:none}",
    "textarea{flex:1;min-width:0;resize:none;border:1px solid #cbb9a8;border-radius:12px;background:#fff;",
    "padding:11px 12px;font-size:16px;line-height:1.35;min-height:46px;max-height:120px;color:inherit}",
    "textarea:focus{border-color:" + ACCENT + "}",
    "textarea::placeholder{color:#8a7b6f}",
    ".send{display:inline-flex;align-items:center;gap:6px;height:44px;background:" + ACCENT + ";color:#fff;border:none;",
    "border-radius:12px;padding:0 14px 0 16px;font-size:14px;font-weight:600;cursor:pointer;flex:none}",
    ".send:hover{background:" + ACCENT_DARK + "}",
    ".send svg{width:16px;height:16px}",
    ".send:disabled{opacity:.5;cursor:default}",
    // Systemmeldinger (bytte mellom skriving og tale, varsler) står i loggen.
    ".divider{align-self:center;max-width:90%;margin:0;padding:4px 12px;border-radius:999px;background:" + CREAM + ";",
    "font-size:12px;line-height:1.45;color:" + MUTED + ";text-align:center}",
    // Mikrofoninformasjonen står som en stille boble fra chatten, ikke som systemmelding.
    ".msg.mic-info{align-self:flex-start;background:#fff;border:1px dashed " + BORDER + ";border-bottom-left-radius:4px;",
    "color:#4a3b30;font-size:13px;white-space:normal}",
    ".mic-info-head{display:flex;align-items:center;gap:6px;margin:0 0 4px;font-size:12px;font-weight:600;color:" + ACCENT_DARK + "}",
    ".mic-info-head svg{width:14px;height:14px}",
    ".mic-info p{margin:0}",
    ".sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}",
    ".modes{display:inline-flex;align-self:flex-start;flex:none;gap:2px;padding:3px;border-radius:999px;background:var(--placy-chat-soft,#f3ebe3)}",
    ".modes[hidden]{display:none}",
    ".mode{display:inline-flex;align-items:center;gap:6px;border:none;background:none;border-radius:999px;padding:6px 14px;",
    "font-size:13px;font-weight:600;line-height:1.2;color:" + MUTED + ";cursor:pointer;transition:background-color .15s ease,color .15s ease}",
    ".mode svg{width:16px;height:16px}",
    ".mode[aria-pressed='true']{background:#fff;color:" + ACCENT_DARK + ";box-shadow:0 1px 3px rgba(42,44,46,.16)}",
    // Det feltet som kommer til syne, toner inn; det som går, forsvinner med én gang.
    ".inputrow,.voice-start,.voice-live{animation:placy-in .18s ease-out}",
    "@keyframes placy-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}",
    ".voice{display:flex;align-items:stretch;min-height:46px}",
    ".voice[hidden],.voice [hidden]{display:none}",
    ".voicebtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;border-radius:12px;padding:0 16px;",
    "font-size:14px;font-weight:600;cursor:pointer;border:1px solid " + ACCENT + ";background:" + ACCENT + ";color:#fff;white-space:nowrap}",
    ".voicebtn:hover{background:" + ACCENT_DARK + "}",
    ".voicebtn svg{width:18px;height:18px}",
    ".voicebtn:disabled{opacity:.5;cursor:default}",
    ".voice-start{flex:1;min-height:46px}",
    ".voice-live{flex:1;display:flex;align-items:center;gap:10px;min-width:0;padding:0 5px 0 14px;border-radius:12px;",
    "background:" + CREAM + ";border:1px solid " + SOFT_BORDER + "}",
    // Statusen står alltid som tekst; prikken er bare et tillegg.
    ".voice-status{flex:1;min-width:0;margin:0;font-size:14px;font-weight:600;color:#4a3b30;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".dot{width:10px;height:10px;border-radius:50%;background:#b9a797;flex:none}",
    ".voice[data-status='listening'] .dot{background:#3f7d4e}",
    ".voice[data-status='thinking'] .dot{background:#c08a2e;animation:placy-pulse 1.6s ease-in-out infinite}",
    ".voice[data-status='speaking'] .dot{background:" + ACCENT + ";animation:placy-pulse 1.2s ease-in-out infinite}",
    ".voice[data-status='connecting'] .dot{animation:placy-pulse 1.2s ease-in-out infinite}",
    "@keyframes placy-pulse{0%,100%{opacity:1}50%{opacity:.35}}",
    ".voicebtn.stop{height:36px;align-self:center;padding:0 12px;font-size:13px;background:#fff;color:" + ACCENT_DARK + "}",
    ".voicebtn.stop:hover{background:var(--placy-chat-soft-border,#efe7df)}",
    // Smale mobiler: modusikonene går, og statusen får mest mulig plass.
    "@media (max-width:420px){.mode svg{display:none}.voice-live{gap:8px;padding-left:12px}.voice-status{font-size:13px}}",
  ].join("");
  shadow.appendChild(style);

  // Små ikoner som inline SVG: ingen eksterne ressurser, ingen innerHTML.
  var SVG_NS = "http://www.w3.org/2000/svg";
  function icon(paths, strokeWidth) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", strokeWidth || "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    paths.forEach(function (d) {
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
    return svg;
  }
  var ICON_CHAT = ["M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0.5A2.5 2.5 0 0 1 5 12.5z"];
  var ICON_PIN = ["M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z", "M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"];
  var ICON_SEND = ["M4 12h15", "M13 6l6 6-6 6"];
  var ICON_MIC = ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M5.5 11a6.5 6.5 0 0 0 13 0", "M12 17.5V21"];
  var ICON_TYPE = ["M4 7h16", "M4 12h16", "M4 17h10"];

  // Boardets temaikoner (Lucide, sirkler og rektangler skrevet om til stier).
  // Serveren sender bare ikonets navn; et navn som ikke står her, gir en
  // farget sirkel uten ikon — aldri en sti eller URL fra serveren.
  var CATEGORY_ICONS = {
    Building2: ["M10 12h4", "M10 8h4", "M14 21v-3a2 2 0 0 0-4 0v3", "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2", "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"],
    ShoppingCart: ["M7 21a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M18 21a1 1 0 1 0 2 0a1 1 0 1 0-2 0", "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"],
    GraduationCap: ["M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z", "M22 10v6", "M6 12.5V16a6 3 0 0 0 12 0v-3.5"],
    UtensilsCrossed: ["m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8", "M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7", "m2.1 21.8 6.4-6.3", "m19 5-7 7"],
    Trees: ["M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z", "M7 16v6", "M13 19v3", "M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"],
    Bus: ["M8 6v6", "M15 6v6", "M2 12h19.6", "M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3", "M5 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M9 18h5", "M14 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0"],
    Dumbbell: ["M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z", "m2.5 21.5 1.4-1.4", "m20.1 3.9 1.4-1.4", "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z", "m9.6 14.4 4.8-4.8"],
    Film: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M7 3v18", "M3 7.5h4", "M3 12h18", "M3 16.5h4", "M17 3v18", "M17 7.5h4", "M17 16.5h4"],
  };

  var button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.appendChild(icon(ICON_CHAT));
  var buttonLabel = document.createElement("span");
  buttonLabel.textContent = cfg.label;
  button.appendChild(buttonLabel);
  button.setAttribute("aria-haspopup", "dialog");
  shadow.appendChild(button);

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "placy-chat-title");
  panel.hidden = true;

  var head = document.createElement("div");
  head.className = "head";
  var mark = document.createElement("span");
  mark.className = "mark";
  mark.appendChild(icon(ICON_PIN));
  var titles = document.createElement("div");
  titles.className = "titles";
  var title = document.createElement("h2");
  title.id = "placy-chat-title";
  title.textContent = cfg.label;
  var sub = document.createElement("div");
  sub.className = "sub";
  var poweredBy = document.createElement("span");
  poweredBy.textContent = "Drevet av Placy";
  var badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "Prototype";
  sub.appendChild(poweredBy);
  sub.appendChild(badge);
  titles.appendChild(title);
  titles.appendChild(sub);
  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close";
  closeBtn.setAttribute("aria-label", "Lukk chat");
  closeBtn.textContent = "×";
  head.appendChild(mark);
  head.appendChild(titles);
  head.appendChild(closeBtn);

  // Temaraden under toppen: Boardets kategorier som faner. Valget bytter bare
  // forslagene i loggen — Anja har samme kunnskap uansett tema. Uten temaer
  // fra serveren (eldre endepunkt, feil) er raden skjult.
  var rail = document.createElement("div");
  rail.className = "rail";
  rail.hidden = true;
  var railShell = document.createElement("div");
  railShell.className = "rail-shell";
  var railTrack = document.createElement("div");
  railTrack.className = "rail-track";
  railTrack.setAttribute("role", "tablist");
  railTrack.setAttribute("aria-label", "Tema for spørsmålsforslag");
  railShell.appendChild(railTrack);
  rail.appendChild(railShell);

  var log = document.createElement("div");
  log.className = "log";
  log.setAttribute("aria-live", "polite");

  // Forslagene står i loggen, rett etter sidens hilsen, slik at panelet leses
  // ovenfra: hvem, hilsen, så hva man kan spørre om.
  var starters = document.createElement("div");
  starters.className = "starters";
  starters.id = "placy-chat-suggestions";
  starters.hidden = true;
  var startersLabel = document.createElement("p");
  startersLabel.className = "starters-label";
  startersLabel.textContent = "Forslag til spørsmål";
  var chips = document.createElement("div");
  chips.className = "chips";
  starters.appendChild(startersLabel);
  starters.appendChild(chips);
  log.appendChild(starters);

  var status = document.createElement("p");
  status.className = "status";
  status.hidden = true;

  // Feltet under loggen: modusvelger (bare med talebro), så enten tekstfeltet
  // (Skriv) eller talestyringen (Snakk). Det skjulte feltet har `hidden` og
  // er dermed ute av både layout, tabulatorrekke og tilgjengelighetstre.
  var composer = document.createElement("div");
  composer.className = "composer";
  var modes = document.createElement("div");
  modes.className = "modes";
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Samtaleform");
  modes.hidden = true;
  function modeButton(label, ariaLabel, paths) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mode";
    // Tilgjengelig navn begynner med den synlige etiketten (WCAG 2.5.3).
    b.setAttribute("aria-label", ariaLabel);
    b.appendChild(icon(paths));
    var span = document.createElement("span");
    span.textContent = label;
    b.appendChild(span);
    return b;
  }
  var textModeBtn = modeButton("Skriv", "Skriv til Anja", ICON_TYPE);
  var voiceModeBtn = modeButton("Snakk", "Snakk med Anja", ICON_MIC);
  modes.appendChild(textModeBtn);
  modes.appendChild(voiceModeBtn);

  // Talestyringen: én startknapp når talen er av; synlig status (tekst og
  // prikk) og Avslutt tale når den er i gang.
  var voiceBox = document.createElement("div");
  voiceBox.className = "voice";
  voiceBox.hidden = true;
  var MIC_INFO = "Nettleseren spør om lov til å bruke mikrofonen første gang. Lyden sendes til OpenAI for å lage svarene. Anja fortsetter fra samtalen her. Mikrofonen stopper når du trykker Avslutt tale, bytter til Skriv eller lukker chatten.";
  var voiceInfo = document.createElement("p");
  voiceInfo.className = "voice-info sr-only";
  voiceInfo.id = "placy-chat-voice-info";
  voiceInfo.textContent = MIC_INFO;
  var voiceStart = document.createElement("button");
  voiceStart.type = "button";
  voiceStart.className = "voicebtn voice-start";
  voiceStart.setAttribute("aria-describedby", "placy-chat-voice-info");
  voiceStart.appendChild(icon(ICON_MIC));
  var voiceStartLabel = document.createElement("span");
  voiceStartLabel.textContent = "Start tale";
  voiceStart.appendChild(voiceStartLabel);
  var voiceLive = document.createElement("div");
  voiceLive.className = "voice-live";
  voiceLive.hidden = true;
  var dot = document.createElement("span");
  dot.className = "dot";
  dot.setAttribute("aria-hidden", "true");
  var voiceStatus = document.createElement("p");
  voiceStatus.className = "voice-status";
  var voiceStop = document.createElement("button");
  voiceStop.type = "button";
  voiceStop.className = "voicebtn stop";
  voiceStop.textContent = "Avslutt tale";
  voiceLive.appendChild(dot);
  voiceLive.appendChild(voiceStatus);
  voiceLive.appendChild(voiceStop);
  voiceBox.appendChild(voiceStart);
  voiceBox.appendChild(voiceLive);
  voiceBox.appendChild(voiceInfo);

  // Alltid i treet (aldri inne i et skjult felt), så skjermlesere hører både
  // modusbytte og talestatus.
  var announcer = document.createElement("p");
  announcer.className = "sr-only";
  announcer.setAttribute("role", "status");

  var inputRow = document.createElement("div");
  inputRow.className = "inputrow";
  var textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Skriv en melding");
  textarea.placeholder = "Skriv et spørsmål …";
  // Samme grense som serveren håndhever (600 tegn); lenger tekst ville gitt 400.
  textarea.maxLength = 600;
  textarea.rows = 1;
  var sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.className = "send";
  var sendLabel = document.createElement("span");
  sendLabel.textContent = "Send";
  sendBtn.appendChild(sendLabel);
  sendBtn.appendChild(icon(ICON_SEND));
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);
  composer.appendChild(modes);
  composer.appendChild(inputRow);
  composer.appendChild(voiceBox);
  composer.appendChild(announcer);

  panel.appendChild(head);
  panel.appendChild(rail);
  panel.appendChild(log);
  panel.appendChild(status);
  panel.appendChild(composer);
  shadow.appendChild(panel);

  function ready() {
    if (document.body) document.body.appendChild(host);
    else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(host); });
  }
  ready();

  // ---------------------------------------------------------------------
  // Meldinger
  // ---------------------------------------------------------------------
  function addMessage(role, text) {
    var el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text; // ALDRI innerHTML for serverinnhold.
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function addLinks(container, links) {
    if (!links || !links.length) return;
    var wrap = document.createElement("div");
    wrap.className = "links";
    links.forEach(function (link) {
      if (!link) return;
      // Board-lenker bruker skriptets EGEN `data-board-href` i UI-et, ikke
      // nødvendigvis serverens standardsti — dette lar samme widget peke til
      // riktig lokalt board uten en serverendring.
      var href = link.id === "board" ? cfg.boardHref : link.href;
      if (typeof href !== "string" || href.charAt(0) !== "/" || href.charAt(1) === "/") return; // kun interne, relative stier
      var a = document.createElement("a");
      a.className = "linkbtn";
      a.href = href;
      a.textContent = String(link.label || href);
      wrap.appendChild(a);
    });
    if (wrap.childNodes.length) container.appendChild(wrap);
  }

  // Serveren har allerede snevret kildene inn til registerkilder verktøyene
  // returnerte; her vises de bare som tekst — aldri som lenke eller HTML.
  function addSources(container, sources) {
    if (!Array.isArray(sources)) return;
    var labels = [];
    sources.forEach(function (source) {
      if (!source || typeof source.label !== "string" || typeof source.id !== "string") return;
      var page = typeof source.page === "string" && source.page && source.page !== source.label ? " – " + source.page : "";
      labels.push(source.label + page);
    });
    if (!labels.length) return;
    var el = document.createElement("p");
    el.className = "sources";
    el.textContent = "Kilder i oppslaget: " + labels.join("; ");
    container.appendChild(el);
  }

  function addNotice(container, notice) {
    if (!notice || typeof notice.text !== "string" || !notice.text) return;
    var el = document.createElement("p");
    el.className = "notice";
    el.setAttribute("role", "note");
    el.textContent = notice.text;
    container.appendChild(el);
  }

  // Sidens åpning står øverst i loggen til samtalen har startet, og byttes når
  // brukeren går til en annen side før første melding. Åpnes chatten med et
  // spørsmål fra siden, kan hilsenen komme etter brukerens melding; den settes
  // da likevel øverst, så lenge ingen svar har kommet.
  var openingEl = null;
  function setOpening(text) {
    if (typeof text !== "string" || !text) return;
    if (log.querySelector(".msg.assistant:not(.opening), .msg.error")) return;
    if (openingEl && log.querySelector(".msg.user")) return;
    if (!openingEl) {
      openingEl = document.createElement("div");
      openingEl.className = "msg assistant opening";
      log.insertBefore(openingEl, log.firstChild);
    }
    openingEl.textContent = text;
  }

  function setStatus(text) {
    status.hidden = !text;
    status.textContent = text || "";
  }

  function conversationStarted() {
    return !!log.querySelector(".msg:not(.opening)");
  }

  function renderStarters(list) {
    chips.textContent = "";
    list.forEach(function (text) {
      if (typeof text !== "string" || !text) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "starter";
      b.textContent = text;
      // Nøyaktig den viste teksten, i Skriv og i en pågående tale.
      b.addEventListener("click", function () { sendMessage(text); });
      chips.appendChild(b);
    });
    starters.hidden = !chips.childNodes.length;
  }

  // ---------------------------------------------------------------------
  // Temaraden
  // ---------------------------------------------------------------------
  var CATEGORY_ID = /^[a-z0-9-]{1,60}$/;
  var HEX_COLOR = /^#[0-9a-f]{6}$/i;
  var categories = [];
  var activeCategoryId = null;
  var railKey = "";

  /** Bare det raden trenger, og bare verdier som er trygge å sette i DOM-en. */
  function readCategories(value) {
    if (!Array.isArray(value)) return [];
    var list = [];
    var seen = {};
    value.slice(0, 12).forEach(function (item) {
      if (!item || typeof item.id !== "string" || !CATEGORY_ID.test(item.id) || seen[item.id]) return;
      if (typeof item.label !== "string" || !item.label.trim()) return;
      var questions = Array.isArray(item.questions)
        ? item.questions.filter(function (q) { return typeof q === "string" && q.trim() && q.length <= 200; }).slice(0, 3)
        : [];
      if (!questions.length) return;
      seen[item.id] = true;
      list.push({
        id: item.id,
        label: item.label.trim().slice(0, 40),
        icon: typeof item.icon === "string" && Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, item.icon) ? item.icon : null,
        color: typeof item.color === "string" && HEX_COLOR.test(item.color) ? item.color : "#91563e",
        questions: questions,
      });
    });
    return list;
  }

  function railTabs() {
    return Array.prototype.slice.call(railTrack.children);
  }

  function activeCategory() {
    for (var i = 0; i < categories.length; i++) if (categories[i].id === activeCategoryId) return categories[i];
    return categories[0] || null;
  }

  /** Tonet kant bare der det finnes flere temaer å rulle til. */
  function updateRailEdges() {
    var rest = railTrack.scrollWidth - railTrack.clientWidth - railTrack.scrollLeft;
    railTrack.classList.toggle("fade-start", railTrack.scrollLeft > 2);
    railTrack.classList.toggle("fade-end", rest > 2);
  }

  function revealTab(tab) {
    if (!tab || !railTrack.clientWidth) return;
    var left = tab.offsetLeft - 20;
    var right = tab.offsetLeft + tab.offsetWidth + 20;
    if (left < railTrack.scrollLeft) railTrack.scrollLeft = Math.max(0, left);
    else if (right > railTrack.scrollLeft + railTrack.clientWidth) railTrack.scrollLeft = right - railTrack.clientWidth;
  }

  /** Faner bygges bare når temaene endrer seg, så fokus i raden overlever et sideskifte. */
  function renderRail() {
    rail.hidden = !categories.length;
    var key = categories.map(function (c) { return [c.id, c.label, c.icon, c.color].join(":"); }).join("|");
    if (key !== railKey) {
      railKey = key;
      railTrack.textContent = "";
      categories.forEach(function (category, index) {
        var tab = document.createElement("button");
        tab.type = "button";
        tab.className = "tab";
        tab.id = "placy-chat-tab-" + index;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", starters.id);
        tab.setAttribute("data-category-id", category.id);
        var swatch = document.createElement("span");
        swatch.className = "tab-icon";
        swatch.setAttribute("aria-hidden", "true");
        swatch.style.backgroundColor = category.color;
        if (category.icon) swatch.appendChild(icon(CATEGORY_ICONS[category.icon], "2"));
        var label = document.createElement("span");
        label.textContent = category.label;
        tab.appendChild(swatch);
        tab.appendChild(label);
        tab.addEventListener("click", function () { selectCategory(category.id, false); });
        railTrack.appendChild(tab);
      });
    }
    if (categories.length) starters.setAttribute("role", "tabpanel");
    else {
      starters.removeAttribute("role");
      starters.removeAttribute("aria-labelledby");
    }
  }

  /** Viser det valgte temaets forslag; faller tilbake på første tema (prosjektet). */
  function showCategory() {
    var category = activeCategory();
    if (!category) return null;
    activeCategoryId = category.id;
    var selectedTab = null;
    railTabs().forEach(function (tab) {
      var selected = tab.getAttribute("data-category-id") === category.id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) selectedTab = tab;
    });
    if (selectedTab) starters.setAttribute("aria-labelledby", selectedTab.id);
    startersLabel.textContent = "Forslag til spørsmål – " + category.label;
    renderStarters(category.questions);
    return selectedTab;
  }

  function selectCategory(id, moveFocus) {
    activeCategoryId = id;
    var tab = showCategory();
    revealTab(tab);
    updateRailEdges();
    if (moveFocus && tab) tab.focus();
    // I en påbegynt samtale flyttes forslagene ned til den nyeste meldingen,
    // der de synes. Samtalen og historikktokenet røres ikke.
    if (conversationStarted()) {
      log.appendChild(starters);
      log.scrollTop = log.scrollHeight;
    }
  }

  var RAIL_KEYS = { ArrowLeft: -1, ArrowRight: 1, Home: "first", End: "last" };
  railTrack.addEventListener("keydown", function (event) {
    if (!Object.prototype.hasOwnProperty.call(RAIL_KEYS, event.key) || !categories.length) return;
    event.preventDefault();
    var step = RAIL_KEYS[event.key];
    var index = categories.indexOf(activeCategory());
    var next = step === "first" ? 0 : step === "last" ? categories.length - 1 : (index + step + categories.length) % categories.length;
    selectCategory(categories[next].id, true);
  });
  railTrack.addEventListener("scroll", updateRailEdges, { passive: true });
  // Mus uten sideveis rulling: vertikalt hjul ruller raden sidelengs.
  railTrack.addEventListener("wheel", function (event) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || railTrack.scrollWidth <= railTrack.clientWidth) return;
    event.preventDefault();
    railTrack.scrollLeft += event.deltaY;
  }, { passive: false });
  window.addEventListener("resize", updateRailEdges);

  function loadStarters() {
    var pageId = currentPageId();
    if (startersLoadedForPage === pageId) return;
    var requestId = ++startersRequestId;
    startersLoadedForPage = pageId;
    // Uten temarad forsvinner forrige sides forslag med én gang. Med rad står
    // temaene og forslagene til den nye sidens svar kommer, og byttes på plass.
    if (!categories.length) {
      chips.textContent = "";
      starters.hidden = true;
    }
    // Er samtalen i gang, hører forslagene for den nye siden hjemme nederst.
    if (conversationStarted()) log.appendChild(starters);
    fetch(cfg.endpoint + "?pageId=" + encodeURIComponent(pageId), { credentials: "include" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || requestId !== startersRequestId || pageId !== currentPageId()) return;
        setOpening(data.opening);
        // Valgt tema beholdes på tvers av sider når det finnes i det nye svaret.
        categories = readCategories(data.categories);
        renderRail();
        if (categories.length) {
          revealTab(showCategory());
          updateRailEdges();
        } else {
          startersLabel.textContent = "Forslag til spørsmål";
          renderStarters(Array.isArray(data.starters) ? data.starters : []);
        }
        // Hilsen og forslag kan komme etter at samtalen er i gang; den nyeste
        // meldingen skal fortsatt være synlig.
        if (log.querySelector(".msg.user")) log.scrollTop = log.scrollHeight;
      })
      .catch(function () { /* forslag er en bonus; stillhet ved feil */ });
  }

  function sendMessage(text) {
    var message = (text || textarea.value).trim();
    if (!message) return;
    // Under talen finnes ikke tekstfeltet; bare et forslag i loggen kan komme
    // hit. Det går til SAMME talesesjon, så Anja svarer med stemmen. Broen
    // legger meldingen i transkriptet; boblen kommer derfra.
    if (voice.session === "on") {
      if (text) sendVoiceCommand({ type: "text", text: message.slice(0, 600) });
      return;
    }
    // Mens talens historikk overføres, venter meldingen i tekstfeltet: ellers
    // ville tekstchatten svart uten det som nettopp ble sagt.
    if (voice.session === "starting" || sending || voice.handoff === "pending") return;
    if (voice.mode === "voice") setMode("text");
    sending = true;
    textarea.value = "";
    renderVoice();
    addMessage("user", message);
    setStatus("Svarer …");
    fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: message, pageId: currentPageId(), transcript: transcript || undefined }),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (outcome) {
        var data = outcome.data || {};
        if (!outcome.ok || typeof data.reply !== "string") {
          var errorEl = addMessage("error", typeof data.error === "string" ? data.error : "Chatten fikk ikke svar akkurat nå. Prøv igjen om litt.");
          addLinks(errorEl, data.links);
          log.scrollTop = log.scrollHeight;
          return;
        }
        if (typeof data.transcript === "string") transcript = data.transcript;
        var replyEl = addMessage("assistant", data.reply);
        addNotice(replyEl, data.notice);
        addSources(replyEl, data.sources);
        addLinks(replyEl, data.links);
        // Forbehold, kilder og lenker gjør boblen høyere etter `addMessage`.
        log.scrollTop = log.scrollHeight;
      })
      .catch(function () {
        addMessage("error", "Chatten fikk ikke kontakt. Sjekk nettforbindelsen og prøv igjen.");
      })
      .finally(function () {
        sending = false;
        setStatus("");
        renderVoice();
      });
  }

  // ---------------------------------------------------------------------
  // Tale via broen
  // ---------------------------------------------------------------------
  function sendVoiceCommand(command) {
    window.dispatchEvent(new CustomEvent(VOICE_COMMAND, { detail: command }));
  }

  /** Første gang Snakk velges: en stille boble fra chatten om hva talen innebærer. */
  function addMicInfo() {
    var el = document.createElement("div");
    el.className = "msg mic-info";
    el.setAttribute("role", "note");
    var headEl = document.createElement("p");
    headEl.className = "mic-info-head";
    headEl.appendChild(icon(ICON_MIC));
    var label = document.createElement("span");
    label.textContent = "Om talesamtalen";
    headEl.appendChild(label);
    var body = document.createElement("p");
    body.textContent = MIC_INFO;
    el.appendChild(headEl);
    el.appendChild(body);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function addNote(text) {
    var el = document.createElement("p");
    el.className = "divider";
    el.setAttribute("role", "note");
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function upsertVoiceBubble(message) {
    if (!message || typeof message.id !== "string" || typeof message.text !== "string") return;
    if (message.role !== "user" && message.role !== "assistant") return;
    var text = message.text.trim();
    if (!text) return;
    var el = voiceBubbles.get(message.id);
    if (!el) {
      el = addMessage(message.role, text); // textContent, aldri innerHTML
      el.classList.add("voice-message");
      voiceBubbles.set(message.id, el);
      voice.spoke = true;
      return;
    }
    if (el.textContent === text) return;
    var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
    el.textContent = text;
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  function shownStatus() {
    if (voice.session === "off") return "idle";
    return voice.session === "starting" && !VOICE_ACTIVE[voice.status] ? "connecting" : voice.status;
  }

  function voiceShown() {
    return voice.available && voice.mode === "voice";
  }

  /** Kontrollen som skal ha fokus i feltet under loggen for gjeldende modus. */
  function composerControl() {
    if (!voiceShown()) return textarea;
    return voice.session === "off" ? voiceStart : voiceStop;
  }

  function renderVoice() {
    var talking = voiceShown();
    modes.hidden = !voice.available;
    textModeBtn.setAttribute("aria-pressed", String(voice.mode === "text"));
    voiceModeBtn.setAttribute("aria-pressed", String(voice.mode === "voice"));
    inputRow.hidden = talking;
    voiceBox.hidden = !talking;
    var off = voice.session === "off";
    var pending = voice.handoff === "pending";
    voiceStart.hidden = !off;
    voiceStart.disabled = sending || pending;
    voiceLive.hidden = off;
    voiceStop.textContent = voice.session === "starting" ? "Avbryt" : "Avslutt tale";
    var shown = shownStatus();
    voiceBox.setAttribute("data-status", shown);
    voiceStatus.textContent = off ? "" : VOICE_LABELS[shown] || VOICE_LABELS.connecting;
    sendBtn.disabled = sending || voice.session === "starting" || pending;
    // Hva skjermleseren hører: talestatus, eller at feltet har byttet. Settes
    // bare ved endring, så samme status ikke leses opp på nytt.
    var spoken = !voice.available ? ""
      : talking ? (off ? VOICE_READY : voiceStatus.textContent)
      : announcer.textContent ? "Skriv er valgt." : "";
    if (announcer.textContent !== spoken) announcer.textContent = spoken;
    // Fokus på en kontroll som nettopp ble skjult, flyttes til feltets
    // synlige kontroll i stedet for å falle ut av panelet.
    var active = open && shadow.activeElement;
    if (active && active.closest("[hidden]")) composerControl().focus();
  }

  function setMode(mode) {
    if (mode === voice.mode) return;
    if (mode === "text" && voice.session !== "off") stopVoice();
    voice.mode = mode;
    if (mode === "voice" && voice.session === "off") {
      // Første gang: mikrofoninformasjon og en tydelig startknapp. Etter at
      // brukeren har startet tale én gang, starter byttet talen direkte.
      if (voice.consented && voice.handoff !== "pending") {
        renderVoice();
        startVoice();
        return;
      }
      if (!voice.infoShown) {
        voice.infoShown = true;
        addMicInfo();
      }
    }
    renderVoice();
    if (open) composerControl().focus();
  }

  function startVoice() {
    if (!voice.available || voice.session !== "off" || sending || voice.handoff === "pending") return;
    voice.session = "starting";
    voice.notice = null;
    voice.announced = false;
    voice.spoke = false;
    renderVoice();
    // Klikket er brukerens handling; broen ber om mikrofon først nå. Tokenet
    // er tekstchattens signerte historikk; serveren avgjør om det kan brukes.
    sendVoiceCommand(transcript ? { type: "start", transcript: transcript } : { type: "start" });
  }

  /** Talen er klar: si i loggen hva Anja faktisk fikk med seg, slik serveren meldte det. */
  function announceVoice(continuity) {
    voice.announced = true;
    var status = continuity && continuity.status;
    if (status === "carried") addNote("Anja er klar til å snakke og fortsetter fra samtalen over" + (continuity.trimmed ? " (de siste delene av den)." : "."));
    else if (status === "rejected") addNote("Anja er klar til å snakke, men fikk ikke med seg samtalen over. Hun starter uten den.");
    else addNote("Anja er klar til å snakke.");
  }

  /**
   * Talen er slutt (stoppet, lukket, feil eller broen forsvant). Synlige
   * bobler blir stående. Meldingen om overgangen venter på overføringen av
   * historikk når den pågår (`finishHandoff`).
   */
  function endVoice(reason) {
    if (voice.session === "off") return;
    // Stans kan bruke noen sekunder på å tømme siste talefragment. Blokker
    // neste tekstmelding med én gang, før broen får sesjonens nye token.
    if (voice.session === "on") beginHandoff();
    voice.session = "off";
    voice.mode = "text";
    voice.notice = null;
    voice.announced = false;
    if (reason) addMessage("error", reason);
    // Fokus i den nå skjulte taledelen flyttes til tekstfeltet (renderVoice).
    renderVoice();
  }

  function stopVoice() {
    if (voice.session === "off") return;
    sendVoiceCommand({ type: "stop" });
    endVoice(null);
  }

  function beginHandoff() {
    if (voice.handoff === "pending") return;
    voice.handoff = "pending";
    setStatus("Overfører talesamtalen til skrivechatten …");
    window.clearTimeout(voice.handoffTimer);
    voice.handoffTimer = window.setTimeout(function () { finishHandoff(null); }, HANDOFF_SAFETY_MS);
  }

  /** Overføringen er ferdig, feilet eller ble aldri fullført. Tokenet byttes bare ved et gyldig svar. */
  function finishHandoff(handoff) {
    if (voice.handoff !== "pending") return;
    window.clearTimeout(voice.handoffTimer);
    voice.handoff = null;
    setStatus(sending ? "Svarer …" : "");
    if (handoff && handoff.status === "ready" && typeof handoff.transcript === "string" && handoff.transcript) {
      transcript = handoff.transcript;
      addNote(handoff.voiceTurns > 0
        ? "Tilbake til skriving. Chatten fortsetter fra talesamtalen" + (handoff.trimmed ? ", med de siste delene av samtalen." : ".")
        : "Tilbake til skriving.");
    } else {
      addNote("Tilbake til skriving. Talesamtalen kunne ikke overføres, så skrivechatten ser ikke det som ble sagt i talen – bare det som ble skrevet før.");
    }
    renderVoice();
  }

  function onHandoff(handoff) {
    if (!handoff || typeof handoff !== "object" || typeof handoff.id !== "number") return;
    var key = handoff.id + ":" + handoff.status;
    if (key === voice.handoffKey) return;
    voice.handoffKey = key;
    if (handoff.status === "pending") {
      beginHandoff();
      window.clearTimeout(voice.handoffTimer);
      voice.handoffTimer = window.setTimeout(function () { finishHandoff(null); }, HANDOFF_SAFETY_MS);
      return;
    }
    finishHandoff(handoff);
  }

  function onVoiceState(event) {
    var detail = event && event.detail;
    if (!detail || typeof detail !== "object") return;
    if (detail.available === false) {
      var wasVoice = voice.session !== "off";
      var hadSpeech = voice.spoke;
      endVoice(null);
      if (voice.handoff === "pending" && hadSpeech) finishHandoff(null);
      else if (voice.handoff === "pending") {
        window.clearTimeout(voice.handoffTimer);
        voice.handoff = null;
        addNote("Tilbake til skriving.");
      } else if (wasVoice) addNote("Tilbake til skriving.");
      voice.available = false;
      voice.mode = "text";
      renderVoice();
      return;
    }
    voice.available = true;
    voice.status = VOICE_STATUSES[detail.status] ? detail.status : "idle";
    // Overføringen først: den kan meldes i samme øyeblikk som talen slutter.
    onHandoff(detail.handoff);
    var notice = typeof detail.notice === "string" && detail.notice ? detail.notice : null;
    if (notice && notice !== voice.notice && voice.session !== "off") addNote(notice);
    voice.notice = notice;
    if (Array.isArray(detail.messages)) detail.messages.slice(-100).forEach(upsertVoiceBubble);
    var active = VOICE_ACTIVE[voice.status] === 1;
    if (voice.session === "starting") {
      if (active) voice.session = "on";
      // Mikrofon avvist, kvote brukt opp, server utilgjengelig: tilbake til
      // skriving med årsaken synlig. `idle` her er broens tilstand fra før start.
      else if (voice.status === "error") endVoice(typeof detail.error === "string" && detail.error ? detail.error : "Talesamtalen kunne ikke starte.");
    } else if (voice.session === "on" && !active) {
      endVoice(voice.status === "error" ? (typeof detail.error === "string" && detail.error ? detail.error : "Talesamtalen ble avbrutt.") : null);
    }
    if (voice.session === "on" && !voice.announced && voice.status !== "connecting") {
      voice.consented = true;
      announceVoice(detail.continuity);
    }
    renderVoice();
  }

  // ---------------------------------------------------------------------
  // Åpne / lukke / fokusfelle (WAI-ARIA APG dialog-modal)
  // ---------------------------------------------------------------------
  // Ingen `offsetParent`-filtrering: `hidden`-attributtet er synlighetsgaten,
  // både for panelet og for taledelens skjulte knapper.
  function focusable() {
    return Array.prototype.slice.call(panel.querySelectorAll("button:not([disabled]), a[href], textarea, [tabindex]:not([tabindex='-1'])"))
      // Temaraden er én tabulatorstopp (valgt fane); piltastene flytter innad.
      .filter(function (el) { return el.getAttribute("tabindex") !== "-1" && !el.closest("[hidden]"); });
  }

  function trap(event) {
    if (event.key !== "Tab") return;
    var items = focusable();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var activeInShadow = shadow.activeElement;
    if (event.shiftKey && activeInShadow === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeInShadow === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape") { closeChat(); return; }
    trap(event);
  }

  function openChat(options) {
    options = options || {};
    // `document.activeElement` peker på SHADOW-VERTEN når det fokuserte
    // elementet ligger inne i et lukket/åpent shadow-tre (ingen
    // `delegatesFocus`) — det egentlige elementet ligger i
    // `shadowRoot.activeElement`, som må sjekkes FØRST for at fokus faktisk
    // kan gå tilbake dit brukeren sto da chatten ble åpnet (AE4).
    lastFocused = document.activeElement === host ? shadow.activeElement || button : document.activeElement;
    open = true;
    panel.hidden = false;
    // rAF gir nettleseren tid til å legge merke til `hidden=false` før transformen animeres.
    window.requestAnimationFrame(function () {
      panel.classList.add("open");
      // Raden har først bredde når panelet er synlig.
      revealTab(railTabs().filter(function (tab) { return tab.tabIndex === 0; })[0]);
      updateRailEdges();
    });
    loadStarters();
    panel.addEventListener("keydown", onKeydown);
    document.addEventListener("keydown", onKeydown);
    window.setTimeout(function () { composerControl().focus(); }, 0);
    if (options.question) sendMessage(options.question);
  }

  function closeChat() {
    if (!open) return;
    // Lukket panel = ingen løpende tale og ingen løpende kostnad.
    stopVoice();
    open = false;
    panel.classList.remove("open");
    panel.hidden = true;
    panel.removeEventListener("keydown", onKeydown);
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    else button.focus();
  }

  // Next bytter sidemarkøren uten full sidelasting. Et åpent panel må følge
  // den nye siden, også når den forrige sidens GET ennå ikke har svart.
  var pageObserver = new MutationObserver(function () {
    if (!host.isConnected) { pageObserver.disconnect(); return; }
    if (open && startersLoadedForPage !== currentPageId()) loadStarters();
  });
  pageObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-placy-page-id"],
  });

  button.addEventListener("click", function () { if (open) closeChat(); else openChat(); });
  closeBtn.addEventListener("click", closeChat);
  sendBtn.addEventListener("click", function () { sendMessage(); });
  textModeBtn.addEventListener("click", function () { setMode("text"); });
  voiceModeBtn.addEventListener("click", function () { setMode("voice"); });
  voiceStart.addEventListener("click", startVoice);
  voiceStop.addEventListener("click", function () { stopVoice(); composerControl().focus(); });
  window.addEventListener(VOICE_STATE, onVoiceState);
  renderVoice();
  // Broen kan være montert før eller etter skriptet; begge veier møtes her.
  window.dispatchEvent(new CustomEvent(VOICE_HELLO));
  textarea.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Delegert åpning fra sidens eget innhold: <button data-placy-chat-open data-placy-chat-question="...">
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-placy-chat-open]") : null;
    if (!target) return;
    event.preventDefault();
    openChat({ question: target.getAttribute("data-placy-chat-question") || undefined });
  });

  window.PlacyChat = {
    open: openChat,
    close: closeChat,
  };
})();
