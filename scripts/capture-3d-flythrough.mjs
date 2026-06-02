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
 * Flythrough-en drives av SAMME `flyCameraTo` som kamera-directoren bruker
 * (board-3d-camera-director / use-board-3d-camera), så videoen representerer det
 * som faktisk kjører i produktet. Modellen (ModelLayer3D) er allerede montert i
 * boardet.
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

// Kamera-bane: sentrert på modell-koordinatet (Sjøgangen 7 / Stasjonskvartalet).
// A = vid + høyt (by-kontekst), B = tett nærbilde på bygget. Heading roterer
// under nedstigningen → en dynamisk "fly inn og land på bygget"-bue.
const MODEL = { lat: 63.436523, lng: 10.400747, altitude: 0 };
const A = { center: MODEL, range: 1250, tilt: 57, heading: 150 };
const B = { center: MODEL, range: 250, tilt: 67, heading: 238 };
const HOLD_A_MS = 1200;
const MOVE_MS = 8500;
const HOLD_B_MS = 2200;
const TILES_SETTLE_A_MS = 4000; // la tiles ved A streame inn før opptak

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

function fly(pose, durationMillis) {
  return evalPage(
    `(()=>{const m=document.querySelector('gmp-map-3d');if(!m)return false;m.flyCameraTo({endCamera:${JSON.stringify(
      pose,
    )},durationMillis:${durationMillis}});return true;})()`,
    false,
  );
}

async function main() {
  rmSync(FRAME_DIR, { recursive: true, force: true });
  mkdirSync(FRAME_DIR, { recursive: true });
  const profile = "/tmp/placy-fly-chrome-profile";
  rmSync(profile, { recursive: true, force: true });

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
      URL,
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

  // Avvis splash (wheel-gest), start opplevelsen, bytt til Fri (director slipper kameraet).
  await evalPage(`(async()=>{
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<6;i++){[window,document,document.body].forEach(t=>{try{t.dispatchEvent(new WheelEvent('wheel',{deltaY:420,bubbles:true}))}catch{}});await s(280);}
    await s(500);
    const start=[...document.querySelectorAll('button')].find(b=>/Start opplevelsen|Fortsett/i.test(b.textContent||''));
    if(start) start.click();
    await s(900);
    const fri=[...document.querySelectorAll('button')].find(b=>/^\\s*Fri\\s*$/i.test(b.textContent||''));
    if(fri) fri.click();
    return true;
  })()`);

  // Vent på at modellen + kartet er klare.
  const ready = await evalPage(`(async()=>{
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<60;i++){const m=document.querySelector('gmp-map-3d');if(m&&document.querySelector('gmp-model-3d')&&m.center)return true;await s(500);}
    return false;
  })()`);
  if (!ready) throw new Error("map/model not ready");

  // Ren hero-modus: skjul alle ikke-kart-søsken oppover ancestor-kjeden
  // (fjerner sidebar + Auto/Fri-toggle + nav + overlays) og utvid kart-stien
  // best-effort. Google sin attribusjon + prosjekt-label ligger INNI gmp-map-3d
  // → beholdes (ToS). Returnerer kartets bounding-rect for evt. crop.
  let mapRect = { x: 0, y: 0, width: W, height: H };
  if (process.env.FLY_CLEAN !== "0") {
    mapRect = await evalPage(`(()=>{
      const map=document.querySelector('gmp-map-3d');
      if(!map) return null;
      let node=map;
      while(node && node!==document.body){
        const parent=node.parentElement; if(!parent) break;
        for(const sib of Array.from(parent.children)){
          // Skjul kun ekte søsken som IKKE inneholder kartet (display:none er
          // trygt — kan ikke kollapse kartet selv). Ingen dimensjons-forsering.
          if(sib!==node && !sib.contains(map)) sib.style.setProperty('display','none','important');
        }
        node=parent;
      }
      window.dispatchEvent(new Event('resize'));
      const r=map.getBoundingClientRect();
      return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};
    })()`);
    await sleep(1500);
    console.log("map rect after clean:", JSON.stringify(mapRect));
  }

  // Sett startpose A umiddelbart, la tiles streame inn.
  await fly(A, 0);
  await sleep(TILES_SETTLE_A_MS);

  // ── opptak ──
  await send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: W,
    maxHeight: H,
    everyNthFrame: 1,
  });
  await sleep(HOLD_A_MS);
  await fly(B, MOVE_MS); // jevn nedstigning A→B (GPU-timet easing)
  await sleep(MOVE_MS + 300);
  await sleep(HOLD_B_MS);
  await send("Page.stopScreencast");
  await sleep(300);

  // ── skriv frames + concat med per-frame varighet fra timestamps ──
  const t0 = frames.length ? frames[0].ts : 0;
  const lines = [];
  frames.forEach((f, i) => {
    const name = `frame-${String(i).padStart(5, "0")}.jpg`;
    writeFileSync(`${FRAME_DIR}/${name}`, Buffer.from(f.data, "base64"));
    lines.push(`file '${name}'`);
    const dur =
      i < frames.length - 1
        ? Math.max(0.001, frames[i + 1].ts - f.ts)
        : 0.12;
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
