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
 * Flythrough-en er en Marketer-stil INTRO-FILM: en kontinuerlig 4-waypoint-bue
 * (vid etablering → sveip → innflyvning → hero-landing på modellen). Den bruker
 * samme `flyCameraTo`-primitiv som kamera-directoren (board-3d-camera-director /
 * use-board-3d-camera), men selve 4-punkts-banen er foreløpig capture-lokal
 * (POC) — den er IKKE promotert til directorens 2-punkts (a→b) per-kategori-
 * modell ennå. Modellen (ModelLayer3D) er allerede montert i boardet.
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

// ── Kamera-bane: Marketer-stil intro-film, 4 waypoints ───────────────────────
// Sentrert rundt modell-koordinatet (Sjøgangen 7 / Stasjonskvartalet, Brattøra).
// Filmen er GJENNOMGÅENDE: heading svinger ~135° mens range kollapser 1600→235 m
// og sentrene glir inn på modellen → en kontinuerlig "fly inn over byen og land
// på bygget"-bue (W1 vid etablering → W2 sveip → W3 innflyvning → W4 hero på
// modellen). Hvert ben fyres OVERLAP_MS FØR forrige er ferdig, så farten aldri
// faller til null på et waypoint — det er det som gir den sømløse Marketer-
// følelsen i stedet for "hopp-stopp-hopp". Tunes mot tiles i Chrome.
const M = { lat: 63.436523, lng: 10.400747 };
const WAYPOINTS = [
  { center: { lat: M.lat - 0.0016, lng: M.lng + 0.0011, altitude: 0 }, range: 1600, tilt: 60, heading: 205 }, // W1 vid etablering (fjord + by)
  { center: { lat: M.lat - 0.0008, lng: M.lng + 0.0006, altitude: 0 }, range: 950, tilt: 63, heading: 250 }, // W2 sveip over Brattøra
  { center: { lat: M.lat - 0.0003, lng: M.lng + 0.0002, altitude: 0 }, range: 480, tilt: 66, heading: 300 }, // W3 innflyvning
  { center: { lat: M.lat - 0.0001, lng: M.lng - 0.0002, altitude: 0 }, range: 320, tilt: 63, heading: 332 }, // W4 hero på modellen (mot fjorden)
];
// Per-ben-varighet (ms), ett tall per ben (W1→W2, W2→W3, W3→W4). Et lengre
// etableringsben + kortere innflyvning gir tilnærmet konstant fart → jevnere
// (de store range/heading-spranga tidlig dekkes saktere). Validert mot tiles.
const LEG_DURATIONS = [6200, 5200, 4800];
const OVERLAP_MS = Number(process.env.FLY_OVERLAP_MS || 500); // start neste ben så tidlig
const HOLD_START_MS = 1400; // hold på W1 før bevegelsen starter
const HOLD_END_MS = 2600; // hold på modellen (W4) til slutt
const TILES_SETTLE_MS = 4500; // la tiles ved W1 streame inn før opptak
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

  // Sett start-pose (W1) umiddelbart, la tiles streame inn før opptak.
  await fly(WAYPOINTS[0], 0);
  await sleep(TILES_SETTLE_MS);

  // ── opptak ──
  await send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: W,
    maxHeight: H,
    everyNthFrame: 1,
  });
  await sleep(HOLD_START_MS);

  // Kjør benene W1→W2→W3→W4. Fyr neste ben OVERLAP_MS før forrige er ferdig så
  // farten aldri faller til null på et waypoint (sømløs, ikke hopp-stopp). Siste
  // ben får full varighet + slack så landingen rekker å fullføre før hold.
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const dur = LEG_DURATIONS[i - 1] ?? 5200;
    await fly(WAYPOINTS[i], dur); // GPU-timet easing per ben
    const isLast = i === WAYPOINTS.length - 1;
    await sleep(isLast ? dur + 300 : dur - OVERLAP_MS);
  }

  await sleep(HOLD_END_MS); // hold på modellen
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
