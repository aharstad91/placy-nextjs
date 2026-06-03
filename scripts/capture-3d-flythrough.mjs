#!/usr/bin/env node
/**
 * capture-3d-flythrough — fanger en kamera-flythrough i Google Photorealistic
 * 3D Tiles (rapport-boardet) til en bildesekvens, via Chrome DevTools Protocol
 * `Page.startScreencast`.
 *
 * Hvorfor screencast og ikke vanlige screenshots: gmp-map-3d rendrer kontinuerlig
 * (tiles streames/refines), så enkeltbilde-`captureScreenshot` timer ut. Screencast
 * streamer frames mens scenen rendrer — samme mekanisme som DevTools' egen opptaks-
 * funksjon — og gir en jevn fangst av en GPU-drevet flythrough.
 *
 * Scriptet DRIVER ikke kameraet: det åpner boardet med ?fly=1 og TAR OPP mens
 * PRODUKTET spiller intro-flythrough-en (oval-spiral låst på objektet, fra
 * Nidarosdomen-retningen). Banen eies av `components/variants/report/board/
 * board-intro-flythrough.ts` — én kilde, ingen duplisert kamera-matte. Synk skjer
 * via window.__placyIntroFly (settling→running→done): scriptet starter opplevelsen,
 * venter til "settling", starter screencast i settle-fasen (kort åpnings-beat),
 * og tar opp til "done". ?fly=1 skjuler også kategori-POI-pins (render-nivå).
 * Modellen (ModelLayer3D) er allerede montert i boardet.
 *
 * Output: JPG-frames + concat.txt (med per-frame varighet fra screencast-
 * timestamps) i FRAME_DIR. Bygg mp4 etterpå med ffmpeg (se scripts kommentar nederst).
 *
 * Krever: `ws` (i node_modules), system-Chrome, kjørende dev-server.
 *
 * Bruk:
 *   node scripts/capture-3d-flythrough.mjs
 *   # deretter:
 *   ffmpeg -f concat -safe 0 -i /tmp/placy-3d-flythrough-frames/concat.txt \
 *     -vsync vfr -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart out.mp4
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import http from "node:http";
import { WebSocket } from "ws";

// ── config ──────────────────────────────────────────────────────────────────
const URL =
  process.env.FLY_URL ||
  "http://localhost:3001/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board";
const PORT = Number(process.env.FLY_PORT || 9223);
const W = Number(process.env.FLY_W || 1280);
const H = Number(process.env.FLY_H || 720);
const FRAME_DIR = process.env.FLY_FRAMES || "/tmp/placy-3d-flythrough-frames";
const CHROME =
  process.env.FLY_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ── Opptaks-config ───────────────────────────────────────────────────────────
// Selve kamera-banen (oval-spiral låst på objektet, fra Nidarosdomen) eies av
// PRODUKTET: `components/variants/report/board/board-intro-flythrough.ts`, spilt
// live via ?fly=1. Dette scriptet DRIVER ikke lenger kameraet — det åpner ?fly=1,
// starter opplevelsen og TAR OPP mens boardet spiller flythrough-en. Fase-synk
// går via `window.__placyIntroFly` (settling→running→done) som boardet setter.
const HOLD_END_MS = 2200; // dvel på objekt-heroen etter "done" før opptaket stoppes
const CLEAN_SETTLE_MS = 1500; // la tiles streame inn på start-posituren før opptak
const MAX_GAP = 0.25; // klamp mid-flight frame-gaps (tile-load-stall → innhent, ikke frys)

// ── CDP plumbing ─────────────────────────────────────────────────────────────
let chrome, ws;
let msgId = 0;
const pending = new Map();
const frames = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function httpGetJson(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: PORT, path }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function waitForPageTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await httpGetJson("/json");
      const page = list.find(
        (t) => t.type === "page" && (t.url || "").includes("rapport-board"),
      );
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error("page target not found");
}

async function evalPage(expression, awaitPromise = true) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(
      "page eval error: " + JSON.stringify(r.exceptionDetails).slice(0, 400),
    );
  }
  return r.result?.value;
}

/** Vent (in-page poll) til boardet melder en gitt intro-flythrough-fase via
 *  window.__placyIntroFly ("settling"|"running"|"done"). Resolver true ved treff,
 *  false ved timeout. */
function waitForFlyPhase(target, timeoutMs) {
  const iters = Math.ceil(timeoutMs / 200);
  return evalPage(
    `(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));` +
      `for(let i=0;i<${iters};i++){if(window.__placyIntroFly===${JSON.stringify(
        target,
      )})return true;await s(200);}return false;})()`,
    true,
  );
}

async function main() {
  rmSync(FRAME_DIR, { recursive: true, force: true });
  mkdirSync(FRAME_DIR, { recursive: true });
  const profile = "/tmp/placy-fly-chrome-profile";
  rmSync(profile, { recursive: true, force: true });

  // Legg på ?fly=1 → boardet spiller intro-flythrough live (board-intro-
  // flythrough) OG dropper kategori-POI-pins (fly impliserer film). Vi tar bare
  // opp; boardet driver kameraet.
  const pageUrl = URL + (URL.includes("?") ? "&" : "?") + "fly=1";

  chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${W},${H + 120}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate,MediaRouter",
      "--hide-crash-restore-bubble",
      "--autoplay-policy=no-user-gesture-required",
      pageUrl,
    ],
    { stdio: "ignore" },
  );

  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl, {
    perMessageDeflate: false,
    maxPayload: 512 * 1024 * 1024,
  });
  await new Promise((res, rej) => {
    ws.on("open", res);
    ws.on("error", rej);
  });
  ws.on("message", (buf) => {
    const m = JSON.parse(buf.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    } else if (m.method === "Page.screencastFrame") {
      const { data, metadata, sessionId } = m.params;
      frames.push({ ts: metadata.timestamp, data });
      send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  // Tving eksakt viewport (headed-vindu har toolbar — override gir rene WxH-frames).
  await send("Emulation.setDeviceMetricsOverride", {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await sleep(3500); // initial board load

  // Avvis splash (wheel-gest) + start opplevelsen → boardet avdekkes og starter
  // intro-flythrough-en (?fly=1 → free mode + flythrough-effekt). Ingen Fri-klikk:
  // boardet er allerede i "free" under fly=1.
  await evalPage(`(async()=>{
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<6;i++){[window,document,document.body].forEach(t=>{try{t.dispatchEvent(new WheelEvent('wheel',{deltaY:420,bubbles:true}))}catch{}});await s(280);}
    await s(500);
    const start=[...document.querySelectorAll('button')].find(b=>/Start opplevelsen|Fortsett/i.test(b.textContent||''));
    if(start) start.click();
    return true;
  })()`);

  // Vent på at kartet + modellen er klare.
  const ready = await evalPage(`(async()=>{
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<60;i++){const m=document.querySelector('gmp-map-3d');if(m&&document.querySelector('gmp-model-3d')&&m.center)return true;await s(500);}
    return false;
  })()`);
  if (!ready) throw new Error("map/model not ready");

  // Vent på at boardets intro-flythrough har startet (fase "settling"). Bygget er
  // alt i senter, kameraet på start-posituren (avstand). Pins er allerede skjult
  // via ?fly=1 (render-nivå i BoardMap3D — trygt, ingen DOM-race).
  const started = await waitForFlyPhase("settling", 15000);
  if (!started) throw new Error("intro-flythrough startet ikke (?fly=1)");

  // Ren hero-modus: skjul alle ikke-kart-søsken oppover ancestor-kjeden (fjerner
  // sidebar + toggles + overlays). Google-attribusjon + prosjekt-label ligger INNI
  // gmp-map-3d → beholdes (ToS). Returnerer kartets bounding-rect for evt. crop.
  let mapRect = { x: 0, y: 0, width: W, height: H };
  if (process.env.FLY_CLEAN !== "0") {
    mapRect = await evalPage(`(()=>{
      const map=document.querySelector('gmp-map-3d');
      if(!map) return null;
      let node=map;
      while(node && node!==document.body){
        const parent=node.parentElement; if(!parent) break;
        for(const sib of Array.from(parent.children)){
          if(sib!==node && !sib.contains(map)) sib.style.setProperty('display','none','important');
        }
        node=parent;
      }
      window.dispatchEvent(new Event('resize'));
      const r=map.getBoundingClientRect();
      return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};
    })()`);
    console.log("map rect after clean:", JSON.stringify(mapRect));
  }

  // La tiles streame inn på start-posituren, og start så opptaket MENS boardet
  // fortsatt holder establishing-posituren (settle-fasen før "running") → en kort
  // åpnings-beat før bevegelsen setter inn.
  await sleep(CLEAN_SETTLE_MS);

  // ── opptak ──
  await send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: W,
    maxHeight: H,
    everyNthFrame: 1,
  });

  // Ta opp gjennom hele oval-spiralen til boardet melder "done".
  const done = await waitForFlyPhase("done", 30000);
  if (!done) console.warn("advarsel: nådde ikke 'done' innen timeout — stopper likevel");

  await sleep(HOLD_END_MS); // dvel på hero-bygget
  await send("Page.stopScreencast");
  await sleep(300);

  // ── skriv frames + concat med per-frame varighet fra timestamps ──
  const t0 = frames.length ? frames[0].ts : 0;
  const lines = [];
  frames.forEach((f, i) => {
    const name = `frame-${String(i).padStart(5, "0")}.jpg`;
    writeFileSync(`${FRAME_DIR}/${name}`, Buffer.from(f.data, "base64"));
    lines.push(`file '${name}'`);
    // Per-frame-varighet:
    //  • Siste frame: holdes HOLD_END_MS — under slutt-holdet er scenen statisk
    //    så screencast slutter å emittere; vi gir landings-framet hele hold-
    //    varigheten → filmen DVELER på hero-bygget i stedet for å kutte idet
    //    kameraet lander.
    //  • Frame 0: beholder sin naturlige gap = åpnings-holdet på W1 (vid etabl.).
    //  • Alle andre: KLAMPES til MAX_GAP. Streaming-fotogrammetri staller av og
    //    til mens GPU laster tiles → screencast lager da en flere-sekunders gap
    //    som ville blitt en frys MIDT i bevegelsen. Klamping gjør en slik stall
    //    til et kjapt innhent i stedet for en synlig frys (ikke-deterministisk
    //    per opptak, så dette må håndteres robust, ikke håpes bort).
    let dur;
    if (i === frames.length - 1) {
      dur = HOLD_END_MS / 1000;
    } else {
      const gap = Math.max(0.001, frames[i + 1].ts - f.ts);
      dur = i === 0 ? gap : Math.min(gap, MAX_GAP);
    }
    lines.push(`duration ${dur.toFixed(4)}`);
  });
  if (frames.length) {
    lines.push(`file 'frame-${String(frames.length - 1).padStart(5, "0")}.jpg'`);
  }
  writeFileSync(`${FRAME_DIR}/concat.txt`, lines.join("\n"));

  const span = frames.length ? (frames[frames.length - 1].ts - t0).toFixed(2) : 0;
  console.log(
    `✓ ${frames.length} frames over ${span}s → ${FRAME_DIR}  (avg ${(
      frames.length / Math.max(0.001, Number(span))
    ).toFixed(1)} fps)`,
  );

  try {
    ws.close();
  } catch {}
  chrome.kill("SIGTERM");
}

main().catch(async (err) => {
  console.error("FAILED:", err.message);
  try {
    ws?.close();
  } catch {}
  try {
    chrome?.kill("SIGKILL");
  } catch {}
  process.exit(1);
});
