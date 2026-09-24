/*!
 * Placy-chat — frittstående innbyggingswidget for Leangenbukta-kundedemoen (2026-09-23).
 *
 * Lastes akkurat slik en WordPress-side ville lastet den:
 *   <script src="/embed/placy-chat.js" data-endpoint="/api/demo/leangenbukta-chat"
 *           data-page-id="forside" data-label="Spør om Leangenbukta"
 *           data-board-href="/demo/leangenbukta-lokal" defer></script>
 *
 * Ingen avhengigheter, ingen build-steg, ingen global lekkasje utover
 * `window.PlacyChat`. All UI ligger i et Shadow DOM med egen CSS, slik at
 * verten (Leangenbuktas WordPress-stiler) ikke kan lekke inn eller ut.
 * Server-svar settes ALLTID med `textContent`, aldri `innerHTML` — det er
 * grunnen til at en `<script>` eller `javascript:`-lenke i et modellsvar
 * aldri kan bli kjørbar eller klikkbar her, uansett hva serveren skulle sende.
 *
 * Tale (2026-09-24): finnes det en talebro på siden (Leangenbukta-kopien
 * monterer `voice-bridge.tsx`), får panelet «Skriv» / «Snakk med Anja». Broen
 * eier WebRTC; widgeten viser bare status og transkript som bobler i samme
 * logg. Protokollen: lib/demo/leangenbukta-chat/voice-channel.ts. Uten bro
 * kommer det aldri en tilstand, og widgeten er ren tekstchat.
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
      offsetBottom: data.offsetBottom || "76px",
    };
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
    thinking: "Anja finner fram svaret …",
    speaking: "Anja snakker",
  };
  var voice = {
    available: false,
    mode: "text", // "text" | "voice"
    // "off" | "starting" | "on": widgetens egen fase. `status` er broens.
    session: "off",
    status: "idle",
    notice: null,
  };
  // Talebobler etter broens stabile ID: samme melding oppdateres, aldri dobles.
  var voiceBubbles = new Map();

  // ---------------------------------------------------------------------
  // DOM / Shadow root
  // ---------------------------------------------------------------------
  var host = document.createElement("div");
  host.setAttribute("data-placy-chat-host", "");
  var shadow = host.attachShadow({ mode: "open" });

  // Leangenbuktas egen palett: brunt fra logoen/knappene og sanden fra
  // forsidens kartseksjon. Verten kan overstyre med CSS-variablene.
  var ACCENT = "var(--placy-chat-accent,#91563e)";
  var ACCENT_DARK = "var(--placy-chat-accent-dark,#6f3f2b)";
  var BORDER = "var(--placy-chat-border,#d6c6b7)";
  var CREAM = "#faf6f2";
  var MUTED = "#5d5148";

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
    "border-width:1px 0 0;border-radius:16px 16px 0 0;opacity:1;transform:translateY(100%)}.panel.open{transform:translateY(0)}",
    ".inputrow{padding-bottom:max(12px,env(safe-area-inset-bottom))}}",
    "@media (prefers-reduced-motion:reduce){.panel,.btn{transition:none}.btn:hover{transform:none}.dot{animation:none!important}}",
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
    ".close:hover{background:#efe7df}",
    ".honesty{margin:0;font-size:12px;line-height:1.45;color:" + MUTED + ";background:" + CREAM + ";",
    "padding:0 16px 12px;border-bottom:1px solid " + BORDER + "}",
    ".log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:12px}",
    ".msg{max-width:88%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".msg.user{align-self:flex-end;background:" + ACCENT + ";color:#fff;border-bottom-right-radius:4px}",
    ".msg.assistant{align-self:flex-start;background:#f6f0ea;border:1px solid #ebe0d5;border-bottom-left-radius:4px}",
    ".msg.error{align-self:flex-start;background:#fbeaea;color:#7a1f1f;border-bottom-left-radius:4px}",
    ".msg .notice{margin:10px 0 0;padding:6px 10px;background:#fff;border-left:3px solid " + ACCENT + ";",
    "border-radius:0 6px 6px 0;font-size:13px;line-height:1.45;color:#4a3b30;white-space:normal}",
    ".msg .sources{margin:10px 0 0;padding-top:8px;border-top:1px solid #e3d6c9;font-size:12px;line-height:1.45;color:" + MUTED + ";white-space:normal}",
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
    ".inputrow{display:flex;align-items:flex-end;gap:8px;padding:12px;border-top:1px solid " + BORDER + ";background:#fff}",
    "textarea{flex:1;min-width:0;resize:none;border:1px solid #cbb9a8;border-radius:12px;background:#fff;",
    "padding:11px 12px;font-size:16px;line-height:1.35;min-height:44px;max-height:120px;color:inherit}",
    "textarea:focus{border-color:" + ACCENT + "}",
    "textarea::placeholder{color:#8a7b6f}",
    ".send{display:inline-flex;align-items:center;gap:6px;height:44px;background:" + ACCENT + ";color:#fff;border:none;",
    "border-radius:12px;padding:0 14px 0 16px;font-size:14px;font-weight:600;cursor:pointer;flex:none}",
    ".send:hover{background:" + ACCENT_DARK + "}",
    ".send svg{width:16px;height:16px}",
    ".send:disabled{opacity:.5;cursor:default}",
    ".divider{align-self:center;max-width:90%;margin:0;font-size:12px;line-height:1.4;color:" + MUTED + ";text-align:center}",
    ".footer{border-top:1px solid " + BORDER + ";padding:10px 12px 0;display:flex;flex-direction:column;gap:8px;background:#fff}",
    ".footer[hidden]{display:none}",
    ".footer:not([hidden])+.inputrow{border-top:none}",
    ".modes{display:inline-flex;align-self:flex-start;gap:2px;padding:3px;border-radius:999px;background:#f3ebe3}",
    ".mode{display:inline-flex;align-items:center;gap:6px;border:none;background:none;border-radius:999px;padding:6px 12px;",
    "font-size:13px;font-weight:600;line-height:1.2;color:" + MUTED + ";cursor:pointer}",
    ".mode svg{width:16px;height:16px}",
    ".mode[aria-pressed='true']{background:#fff;color:" + ACCENT_DARK + ";box-shadow:0 1px 3px rgba(42,44,46,.16)}",
    ".voice{display:flex;flex-direction:column;gap:8px;padding:10px 12px;background:" + CREAM + ";border:1px solid #ebe0d5;border-radius:12px}",
    ".voice[hidden],.voice [hidden]{display:none}",
    ".voice-info{margin:0;font-size:12px;line-height:1.45;color:#4a3b30}",
    ".voice-row{display:flex;align-items:center;gap:10px}",
    ".voice-status{flex:1;min-width:0;margin:0;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:" + ACCENT_DARK + "}",
    ".dot{width:10px;height:10px;border-radius:50%;background:#b9a797;flex:none}",
    ".voice[data-status='listening'] .dot{background:#3f7d4e}",
    ".voice[data-status='thinking'] .dot{background:#c08a2e}",
    ".voice[data-status='speaking'] .dot{background:" + ACCENT + ";animation:placy-pulse 1.2s ease-in-out infinite}",
    ".voice[data-status='connecting'] .dot{animation:placy-pulse 1.2s ease-in-out infinite}",
    "@keyframes placy-pulse{0%,100%{opacity:1}50%{opacity:.35}}",
    ".voice-notice{margin:0;font-size:12px;line-height:1.4;color:#4a3b30}",
    ".voicebtn{display:inline-flex;align-items:center;gap:6px;height:36px;flex:none;border-radius:999px;padding:0 14px;",
    "font-size:13px;font-weight:600;cursor:pointer;border:1px solid " + ACCENT + ";background:" + ACCENT + ";color:#fff}",
    ".voicebtn:hover{background:" + ACCENT_DARK + "}",
    ".voicebtn svg{width:16px;height:16px}",
    ".voicebtn.stop{background:#fff;color:" + ACCENT_DARK + "}",
    ".voicebtn.stop:hover{background:#efe7df}",
    ".voicebtn:disabled{opacity:.5;cursor:default}",
  ].join("");
  shadow.appendChild(style);

  // Små ikoner som inline SVG: ingen eksterne ressurser, ingen innerHTML.
  var SVG_NS = "http://www.w3.org/2000/svg";
  function icon(paths) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
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
  panel.setAttribute("aria-describedby", "placy-chat-status");
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

  var honesty = document.createElement("p");
  honesty.className = "honesty";
  honesty.id = "placy-chat-status";
  var HONESTY_BASE = "Ikke godkjent av utbygger eller megler. Svarene bygger på offentlige kilder og kan inneholde feil.";
  honesty.textContent = HONESTY_BASE;

  var log = document.createElement("div");
  log.className = "log";
  log.setAttribute("aria-live", "polite");

  // Forslagene står i loggen, rett etter sidens hilsen, slik at panelet leses
  // ovenfra: hvem, hva slags svar, hilsen, så hva man kan spørre om.
  var starters = document.createElement("div");
  starters.className = "starters";
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

  // Moduser og talestyring. Skjult til en talebro har meldt seg.
  var footer = document.createElement("div");
  footer.className = "footer";
  footer.hidden = true;
  var modes = document.createElement("div");
  modes.className = "modes";
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Samtaleform");
  function modeButton(label, paths) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mode";
    b.appendChild(icon(paths));
    var span = document.createElement("span");
    span.textContent = label;
    b.appendChild(span);
    return b;
  }
  var textModeBtn = modeButton("Skriv", ICON_TYPE);
  var voiceModeBtn = modeButton("Snakk med Anja", ICON_MIC);
  modes.appendChild(textModeBtn);
  modes.appendChild(voiceModeBtn);

  var voiceBox = document.createElement("div");
  voiceBox.className = "voice";
  voiceBox.hidden = true;
  var voiceInfo = document.createElement("p");
  voiceInfo.className = "voice-info";
  voiceInfo.id = "placy-chat-voice-info";
  voiceInfo.textContent = "Talesamtalen bruker mikrofonen din. Nettleseren spør om tillatelse først, og lyden sendes til OpenAI for å lage svarene. Talen starter som en ny samtale, så Anja ser ikke det som er skrevet over. Lukker du chatten, avsluttes talen.";
  var voiceRow = document.createElement("div");
  voiceRow.className = "voice-row";
  var voiceStatus = document.createElement("p");
  voiceStatus.className = "voice-status";
  voiceStatus.setAttribute("role", "status");
  var dot = document.createElement("span");
  dot.className = "dot";
  dot.setAttribute("aria-hidden", "true");
  var voiceStatusText = document.createElement("span");
  voiceStatus.appendChild(dot);
  voiceStatus.appendChild(voiceStatusText);
  var voiceStart = document.createElement("button");
  voiceStart.type = "button";
  voiceStart.className = "voicebtn";
  voiceStart.setAttribute("aria-describedby", "placy-chat-voice-info");
  voiceStart.appendChild(icon(ICON_MIC));
  var voiceStartLabel = document.createElement("span");
  voiceStartLabel.textContent = "Start talesamtale";
  voiceStart.appendChild(voiceStartLabel);
  var voiceStop = document.createElement("button");
  voiceStop.type = "button";
  voiceStop.className = "voicebtn stop";
  voiceStop.textContent = "Avslutt tale";
  voiceRow.appendChild(voiceStatus);
  voiceRow.appendChild(voiceStart);
  voiceRow.appendChild(voiceStop);
  var voiceNotice = document.createElement("p");
  voiceNotice.className = "voice-notice";
  voiceNotice.hidden = true;
  voiceBox.appendChild(voiceInfo);
  voiceBox.appendChild(voiceRow);
  voiceBox.appendChild(voiceNotice);
  footer.appendChild(modes);
  footer.appendChild(voiceBox);

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

  panel.appendChild(head);
  panel.appendChild(honesty);
  panel.appendChild(log);
  panel.appendChild(status);
  panel.appendChild(footer);
  panel.appendChild(inputRow);
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

  function formatDate(value) {
    var match = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? match[3] + "." + match[2] + "." + match[1] : null;
  }

  function setHonesty(data) {
    var date = formatDate(data && data.contentCheckedAt);
    // `contentCheckedAt` er nyeste `checkedAt` i kilderegisteret — ikke en
    // dato alle kildene er kontrollert på.
    honesty.textContent = HONESTY_BASE + (date ? " Nyeste registrerte kildekontroll: " + date + "." : "");
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

  function loadStarters() {
    var pageId = currentPageId();
    if (startersLoadedForPage === pageId) return;
    var requestId = ++startersRequestId;
    startersLoadedForPage = pageId;
    chips.textContent = "";
    starters.hidden = true;
    // Er samtalen i gang, hører forslagene for den nye siden hjemme nederst.
    if (log.querySelector(".msg:not(.opening)")) log.appendChild(starters);
    fetch(cfg.endpoint + "?pageId=" + encodeURIComponent(pageId), { credentials: "include" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || requestId !== startersRequestId || pageId !== currentPageId()) return;
        setHonesty(data);
        setOpening(data.opening);
        (Array.isArray(data.starters) ? data.starters : []).forEach(function (text) {
          if (typeof text !== "string") return;
          var b = document.createElement("button");
          b.type = "button";
          b.className = "starter";
          b.textContent = text;
          b.addEventListener("click", function () { sendMessage(text); });
          chips.appendChild(b);
        });
        starters.hidden = !chips.childNodes.length;
        // Hilsen og forslag kan komme etter at samtalen er i gang; den nyeste
        // meldingen skal fortsatt være synlig.
        if (log.querySelector(".msg.user")) log.scrollTop = log.scrollHeight;
      })
      .catch(function () { /* forslag er en bonus; stillhet ved feil */ });
  }

  function sendMessage(text) {
    var message = (text || textarea.value).trim();
    if (!message) return;
    // Under talen går skrevet tekst til SAMME talesesjon, ikke til tekstchatten.
    // Broen legger meldingen i transkriptet; boblen kommer derfra.
    if (voice.session === "on") {
      textarea.value = "";
      sendVoiceCommand({ type: "text", text: message.slice(0, 600) });
      return;
    }
    if (voice.session === "starting" || sending) return;
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

  function addDivider(text) {
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
      return;
    }
    if (el.textContent === text) return;
    var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
    el.textContent = text;
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  function renderVoice() {
    footer.hidden = !voice.available;
    textModeBtn.setAttribute("aria-pressed", String(voice.mode === "text"));
    voiceModeBtn.setAttribute("aria-pressed", String(voice.mode === "voice"));
    voiceBox.hidden = !voice.available || voice.mode !== "voice";
    var off = voice.session === "off";
    voiceInfo.hidden = !off;
    voiceStart.hidden = !off;
    voiceStart.disabled = sending;
    voiceStop.hidden = off;
    var shown = off ? "idle" : voice.session === "starting" && !VOICE_ACTIVE[voice.status] ? "connecting" : voice.status;
    voiceBox.setAttribute("data-status", shown);
    voiceStatusText.textContent = off ? "Klar når du er" : VOICE_LABELS[shown] || "Kobler til …";
    voiceNotice.hidden = off || !voice.notice;
    voiceNotice.textContent = voice.notice || "";
    sendBtn.disabled = sending || voice.session === "starting";
    textarea.placeholder = voice.session === "on" ? "Skriv til Anja i talesamtalen …" : "Skriv et spørsmål …";
  }

  function setMode(mode) {
    if (mode === voice.mode) return;
    if (mode === "text" && voice.session !== "off") stopVoice();
    voice.mode = mode;
    renderVoice();
    if (!open) return;
    if (mode === "voice" && voice.session === "off") voiceStart.focus();
    else textarea.focus();
  }

  function startVoice() {
    if (!voice.available || voice.session !== "off" || sending) return;
    voice.session = "starting";
    voice.notice = null;
    addDivider("Talesamtalen starter som en ny samtale");
    renderVoice();
    // Klikket er brukerens handling; broen ber om mikrofon først nå.
    sendVoiceCommand({ type: "start" });
  }

  /**
   * Talen er slutt (stoppet, lukket, feil eller broen forsvant). Synlige
   * bobler blir stående; tekstchattens modellhistorikk starter på nytt, så
   * neste skrevne melding ikke later som den fortsetter samtalen over.
   */
  function endVoice(reason) {
    if (voice.session === "off") return;
    voice.session = "off";
    voice.mode = "text";
    voice.notice = null;
    transcript = null;
    addDivider("Talesamtalen er avsluttet. Skriver du nå, starter tekstchatten en ny samtale.");
    if (reason) addMessage("error", reason);
    renderVoice();
    // Fokus i den nå skjulte taledelen flyttes til tekstfeltet, ikke ut av panelet.
    if (open && shadow.activeElement && voiceBox.contains(shadow.activeElement)) textarea.focus();
  }

  function stopVoice() {
    if (voice.session === "off") return;
    sendVoiceCommand({ type: "stop" });
    endVoice(null);
  }

  function onVoiceState(event) {
    var detail = event && event.detail;
    if (!detail || typeof detail !== "object") return;
    if (detail.available === false) {
      endVoice(null);
      voice.available = false;
      voice.mode = "text";
      renderVoice();
      return;
    }
    voice.available = true;
    voice.status = VOICE_STATUSES[detail.status] ? detail.status : "idle";
    voice.notice = typeof detail.notice === "string" && detail.notice ? detail.notice : null;
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
    renderVoice();
  }

  // ---------------------------------------------------------------------
  // Åpne / lukke / fokusfelle (WAI-ARIA APG dialog-modal)
  // ---------------------------------------------------------------------
  // Ingen `offsetParent`-filtrering: `hidden`-attributtet er synlighetsgaten,
  // både for panelet og for taledelens skjulte knapper.
  function focusable() {
    return Array.prototype.slice.call(panel.querySelectorAll("button:not([disabled]), a[href], textarea, [tabindex]:not([tabindex='-1'])"))
      .filter(function (el) { return !el.closest("[hidden]"); });
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
    window.requestAnimationFrame(function () { panel.classList.add("open"); });
    loadStarters();
    panel.addEventListener("keydown", onKeydown);
    document.addEventListener("keydown", onKeydown);
    window.setTimeout(function () { textarea.focus(); }, 0);
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
  voiceStop.addEventListener("click", function () { stopVoice(); textarea.focus(); });
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
