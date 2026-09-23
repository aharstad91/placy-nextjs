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
  var sending = false;

  // ---------------------------------------------------------------------
  // DOM / Shadow root
  // ---------------------------------------------------------------------
  var host = document.createElement("div");
  host.setAttribute("data-placy-chat-host", "");
  var shadow = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:var(--placy-chat-font,'Open Sans',system-ui,sans-serif)}",
    ".btn{position:fixed;bottom:" + cfg.offsetBottom + ";right:20px;z-index:2147483000;",
    "background:var(--placy-chat-accent,#6b4f3a);color:#fff;border:none;border-radius:999px;",
    "padding:12px 18px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22)}",
    ".btn:hover{filter:brightness(1.05)}",
    ".btn:focus-visible,.iconbtn:focus-visible,.send:focus-visible,textarea:focus-visible,.linkbtn:focus-visible{outline:3px solid var(--placy-chat-accent,#6b4f3a);outline-offset:2px}",
    ".panel{position:fixed;z-index:2147483001;background:#fff;color:var(--placy-chat-text,#2a2c2e);",
    "display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,.28);",
    "top:0;right:0;bottom:0;width:400px;max-width:100vw;transform:translateX(100%);transition:transform .22s ease}",
    ".panel.open{transform:translateX(0)}",
    // `display:flex` over overstyrer `hidden`-attributtet; uten denne regelen
    // ligger et lukket panel igjen i tilgjengelighetstreet og tabulatorrekken.
    ".panel[hidden]{display:none}",
    "@media (max-width:700px){.panel{top:auto;left:0;right:0;bottom:0;width:100%;height:85vh;",
    "transform:translateY(100%);border-radius:16px 16px 0 0}.panel.open{transform:translateY(0)}}",
    "@media (prefers-reduced-motion:reduce){.panel{transition:none}}",
    ".head{padding:16px;border-bottom:1px solid var(--placy-chat-border,#d6c6b7);display:flex;align-items:flex-start;gap:8px}",
    ".head h2{font-size:16px;margin:0;flex:1}",
    ".close{background:none;border:none;font-size:20px;line-height:1;cursor:pointer;padding:4px 8px;color:inherit}",
    ".honesty{font-size:12px;color:#5b5b5b;padding:8px 16px;border-bottom:1px solid var(--placy-chat-border,#d6c6b7)}",
    ".starters{padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px}",
    ".starter{border:1px solid var(--placy-chat-border,#d6c6b7);background:#faf6f1;border-radius:999px;",
    "padding:6px 10px;font-size:12px;cursor:pointer;color:inherit}",
    ".log{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}",
    ".msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap}",
    ".msg.user{align-self:flex-end;background:var(--placy-chat-accent,#6b4f3a);color:#fff}",
    ".msg.assistant{align-self:flex-start;background:#f1ece5}",
    ".msg.error{align-self:flex-start;background:#fbeaea;color:#7a1f1f}",
    ".links{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}",
    ".linkbtn{font-size:12px;padding:5px 9px;border-radius:8px;border:1px solid var(--placy-chat-accent,#6b4f3a);",
    "background:#fff;color:var(--placy-chat-accent,#6b4f3a);text-decoration:none;cursor:pointer}",
    ".status{font-size:12px;color:#666;padding:0 16px}",
    ".inputrow{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--placy-chat-border,#d6c6b7)}",
    "textarea{flex:1;resize:none;border:1px solid var(--placy-chat-border,#d6c6b7);border-radius:8px;",
    "padding:8px;font-size:14px;min-height:40px;max-height:120px;color:inherit}",
    ".send{background:var(--placy-chat-accent,#6b4f3a);color:#fff;border:none;border-radius:8px;padding:0 16px;cursor:pointer}",
    ".send:disabled{opacity:.5;cursor:default}",
    ".powered{font-size:11px;color:#9a9a9a;text-align:center;padding:4px 0 10px}",
  ].join("");
  shadow.appendChild(style);

  var button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = cfg.label;
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
  var title = document.createElement("h2");
  title.id = "placy-chat-title";
  title.textContent = cfg.label;
  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close";
  closeBtn.setAttribute("aria-label", "Lukk chat");
  closeBtn.textContent = "×";
  head.appendChild(title);
  head.appendChild(closeBtn);

  var honesty = document.createElement("p");
  honesty.className = "honesty";
  honesty.textContent = "Konsept. Svarene bygger på Placys kontrollerte kunnskap om Leangenbukta – sjekk alltid detaljer med megler.";

  var starters = document.createElement("div");
  starters.className = "starters";

  var log = document.createElement("div");
  log.className = "log";
  log.setAttribute("aria-live", "polite");

  var status = document.createElement("p");
  status.className = "status";
  status.hidden = true;

  var inputRow = document.createElement("div");
  inputRow.className = "inputrow";
  var textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Skriv en melding");
  // Samme grense som serveren håndhever (600 tegn); lenger tekst ville gitt 400.
  textarea.maxLength = 600;
  textarea.rows = 1;
  var sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.className = "send";
  sendBtn.textContent = "Send";
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);

  var powered = document.createElement("p");
  powered.className = "powered";
  powered.textContent = "Drevet av Placy";

  panel.appendChild(head);
  panel.appendChild(honesty);
  panel.appendChild(starters);
  panel.appendChild(log);
  panel.appendChild(status);
  panel.appendChild(inputRow);
  panel.appendChild(powered);
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

  function setStatus(text) {
    status.hidden = !text;
    status.textContent = text || "";
  }

  function loadStarters() {
    var pageId = currentPageId();
    if (startersLoadedForPage === pageId) return;
    startersLoadedForPage = pageId;
    starters.textContent = "";
    fetch(cfg.endpoint + "?pageId=" + encodeURIComponent(pageId), { credentials: "include" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.starters)) return;
        data.starters.forEach(function (text) {
          if (typeof text !== "string") return;
          var b = document.createElement("button");
          b.type = "button";
          b.className = "starter";
          b.textContent = text;
          b.addEventListener("click", function () { sendMessage(text); });
          starters.appendChild(b);
        });
      })
      .catch(function () { /* forslag er en bonus; stillhet ved feil */ });
  }

  function sendMessage(text) {
    var message = (text || textarea.value).trim();
    if (!message || sending) return;
    sending = true;
    sendBtn.disabled = true;
    textarea.value = "";
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
          return;
        }
        if (typeof data.transcript === "string") transcript = data.transcript;
        var replyEl = addMessage("assistant", data.reply);
        addLinks(replyEl, data.links);
      })
      .catch(function () {
        addMessage("error", "Chatten fikk ikke kontakt. Sjekk nettforbindelsen og prøv igjen.");
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
        setStatus("");
      });
  }

  // ---------------------------------------------------------------------
  // Åpne / lukke / fokusfelle (WAI-ARIA APG dialog-modal)
  // ---------------------------------------------------------------------
  // Ingen `offsetParent`-filtrering: panelets `hidden`-attributt er selve
  // synlighetsgaten (fjernet fra tabulatorrekkefølgen når lukket), og et
  // åpent panel har ingen interne elementer som skal utelates.
  function focusable() {
    return Array.prototype.slice.call(panel.querySelectorAll("button:not([disabled]), a[href], textarea, [tabindex]:not([tabindex='-1'])"));
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
    open = false;
    panel.classList.remove("open");
    panel.hidden = true;
    panel.removeEventListener("keydown", onKeydown);
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    else button.focus();
  }

  button.addEventListener("click", function () { if (open) closeChat(); else openChat(); });
  closeBtn.addEventListener("click", closeChat);
  sendBtn.addEventListener("click", function () { sendMessage(); });
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
