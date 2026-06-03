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
 * Flythrough-en er en Marketer-stil BY-FILM: en kontinuerlig 6-waypoint-reise
 * som åpner på Nidarosdomen og glir nordover gjennom Midtbyen til en hero-
 * landing på modellen ved fjorden (kameraet translaterer ~1 km, ikke bare zoom).
 * Den bruker samme `flyCameraTo`-primitiv som kamera-directoren (board-3d-
 * camera-director / use-board-3d-camera), men selve waypoint-banen er foreløpig
 * capture-lokal (POC) — den er IKKE promotert til directorens 2-punkts (a→b)
 * per-kategori-modell ennå. Modellen (ModelLayer3D) er allerede montert i
 * boardet. Kategori-POI-pins skjules under opptak for en ren film (FLY_PINS=1
 * beholder dem).
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

// ── Kamera-bane: Marketer-stil by-flythrough, 6 waypoints ────────────────────
// Åpner på NIDAROSDOMEN (byens landemerke) og glir nordover gjennom Midtbyen,
// over Nidelva og stasjonen, og lander på modellen ved fjorden (Brattøra).
// Kameraet TRANSLATERER ~1 km langs sør→nord-korridoren (ikke bare zoom mot ett
// punkt) → en ekte hero-by-flythrough som "får frem byen" før den ender på
// bygget. 6 fordelte waypoints, gjennomgående via overlap-chaining (hvert ben
// fyres OVERLAP_MS FØR forrige er ferdig → farten faller aldri til null på et
// waypoint = sømløst, ikke hopp-stopp). Validert mot tiles i Chrome (alle
// framinger + ren film). Modellen er M; Nidarosdomen ≈ 63.4270, 10.3969.
const M = { lat: 63.436523, lng: 10.400747 };
const WAYPOINTS = [
  { center: { lat: 63.42705, lng: 10.39685, altitude: 0 }, range: 600, tilt: 64, heading: 357 }, // W1 Nidarosdomen (hero-åpning)
  { center: { lat: 63.429112, lng: 10.397663, altitude: 0 }, range: 545, tilt: 64, heading: 354 }, // W2 over Midtbyen
  { center: { lat: 63.431174, lng: 10.398477, altitude: 0 }, range: 495, tilt: 64, heading: 350 }, // W3 sentrum / Nidelva
  { center: { lat: 63.433142, lng: 10.399253, altitude: 0 }, range: 445, tilt: 63, heading: 345 }, // W4 mot Solsiden / stasjon
  { center: { lat: 63.435017, lng: 10.399992, altitude: 0 }, range: 390, tilt: 63, heading: 339 }, // W5 stasjon / Brattøra-kant
  { center: { lat: 63.436423, lng: 10.400547, altitude: 0 }, range: 320, tilt: 63, heading: 332 }, // W6 hero-landing på modellen (mot fjorden)
];
// Per-ben-varighet (ms), ett tall per ben (5 ben). Litt raskere enn forrige
// iterasjon + jevnt tempo → dynamisk by-reise; marginalt lengre på åpningsbenet
// (Nidarosdomen-reveal) og slutt-benet (settle på bygget). Validert mot tiles.
const LEG_DURATIONS = [3400, 3100, 3000, 3000, 3300];
const OVERLAP_MS = Number(process.env.FLY_OVERLAP_MS || 500); // start neste ben så tidlig
const HOLD_START_MS = 1100; // kort hold på Nidarosdomen før reisen
const HOLD_END_MS = 2400; // dvel på hero-bygget til slutt
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

  // Skjul kategori-POI-pins for en ren cinematisk film. Pins er React-rendret
  // (vis.gl <Marker3D> → gmp-marker-3d-interactive) og RE-MONTERES av boardet
  // per zoom-tier mens kameraet beveger seg → et engangs-skjul (display:none)
  // slås av igjen. En MutationObserver som DETACHER hver interaktiv markør ved
  // innsetting holder dem borte gjennom hele flythrough-en (vis.gl rydder
  // imperativt → ingen React-desync, verifisert uten konsoll-feil). Prosjekt-
  // labelen (gmp-marker-3d) + modellen beholdes. Sett FLY_PINS=1 for å beholde.
  if (process.env.FLY_PINS !== "1") {
    await evalPage(`(()=>{
      const map=document.querySelector('gmp-map-3d');if(!map)return false;
      if(!window.__pinKiller){
        window.__pinKiller=new MutationObserver(ms=>{for(const mu of ms)for(const n of mu.addedNodes){if(n.tagName&&n.tagName.toLowerCase()==='gmp-marker-3d-interactive'){try{n.remove()}catch{}}}});
        window.__pinKiller.observe(map,{childList:true,subtree:true});
      }
      document.querySelectorAll('gmp-marker-3d-interactive').forEach(m=>{try{m.remove()}catch{}});
      return true;
    })()`);
  }

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
