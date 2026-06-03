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
 * Flythrough-en er en Marketer-stil OVAL-SPIRAL låst på objektet: kameraet ser
 * alltid på bygget (center=M) og orbiterer ~250° mens range spiraler inn fra
 * avstand (lokasjons-innsikt) til hero-nærbilde, med en oval utbuling midtveis
 * (spenning). I motsetning til waypoint-chaining drives banen FRAME-FOR-FRAME
 * (rAF + direkte camera-props) med ÉN global easing → konstant fart i midten,
 * mykt kun i start/slutt (ingen ease per waypoint = føles som ekte flyging).
 * Banen er capture-lokal (POC) — IKKE promotert til directorens per-kategori-
 * modell ennå. Modellen (ModelLayer3D) er allerede montert i boardet. Kategori-
 * POI-pins skjules via produkt-flagget ?film=1 (FLY_PINS=1 beholder dem).
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

// ── Kamera-bane: Marketer-stil oval-spiral LÅST på objektet ──────────────────
// Kameraet er låst på objektet (center = M hele tiden) og orbiterer mens range
// spiraler inn fra avstand (lokasjons-innsikt: du ser HVOR bygget ligger ift.
// fjord/by) til et hero-nærbilde. range buler ut midtveis (ECC·sin) → en
// bankende OVAL bue (spenning), ikke en flat sirkel. Drives FRAME-FOR-FRAME
// (requestAnimationFrame + direkte camera-props, ~85 fps) med ÉN global trapes-
// easing: ramp opp i starten, KONSTANT fart i midten, ramp ned på slutten. Det
// fjerner ease-in/out PER waypoint (det som fikk forrige iterasjon til å føles
// som diskrete waypoints). Validert mot tiles i Chrome (s=0/0.5/1).
const M = { lat: 63.436523, lng: 10.400747 }; // objektet — kameraets låste look-at
const PATH = {
  R0: 1100, R1: 300, // range: avstand (kontekst) → hero (spiral inn)
  T0: 68, T1: 62, // tilt: litt mer ovenfra på avstand → skrå hero
  H0: 220, SWEEP: -250, // heading: start + total sveip (°); negativ = med klokka
  ECC: 0.15, // oval: hvor mye range buler ut midtveis (sin-bue) → spenning
};
const FLY_DURATION_MS = Number(process.env.FLY_DUR_MS || 16000); // total bevegelse (eased)
const EASE_IN = 0.16; // andel av tiden brukt på å akselerere i starten
const EASE_OUT = 0.16; // andel brukt på å bremse til slutt (midten = konstant fart)
const HOLD_START_MS = 900; // kort hold på avstands-etableringen
const HOLD_END_MS = 2200; // dvel på hero-bygget til slutt
const TILES_SETTLE_MS = 4500; // la tiles på avstand streame inn før opptak
const MAX_GAP = 0.25; // klamp mid-flight frame-gaps (tile-load-stall → innhent, ikke frys)

/** Kamera-positur ved bane-parameter s∈[0,1] (ren — samme formel i rAF + init). */
function poseAt(s) {
  const base = PATH.R0 + (PATH.R1 - PATH.R0) * s;
  return {
    range: base * (1 + PATH.ECC * Math.sin(Math.PI * s)),
    tilt: PATH.T0 + (PATH.T1 - PATH.T0) * s,
    heading: ((PATH.H0 + PATH.SWEEP * s) % 360 + 360) % 360,
  };
}

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

/** Sett kamera momentant via direkte props, låst på M (for init-posituren). */
function setCameraInstant(pose) {
  return evalPage(
    `(()=>{const m=document.querySelector('gmp-map-3d');if(!m)return false;` +
      `m.center={lat:${M.lat},lng:${M.lng},altitude:0};` +
      `m.range=${pose.range};m.tilt=${pose.tilt};m.heading=${pose.heading};return true;})()`,
    false,
  );
}

/**
 * Kjør hele oval-spiralen frame-for-frame i siden (requestAnimationFrame, direkte
 * camera-props). Én global trapes-easing (ramp opp [0,EI], konstant [EI,1-EO],
 * ramp ned [1-EO,1]) → konstant fart i midten, mykt start/slutt, INGEN ease per
 * waypoint. Resolver når bevegelsen er ferdig (awaitPromise=true).
 */
function runFlythrough() {
  const C = JSON.stringify({
    M,
    PATH,
    DUR: FLY_DURATION_MS,
    EI: EASE_IN,
    EO: EASE_OUT,
  });
  return evalPage(
    `(()=>{
      const C=${C};
      const map=document.querySelector('gmp-map-3d'); if(!map) return false;
      const v=1/(1-C.EI/2-C.EO/2); // topp-fart så total normalisert distanse = 1
      function ease(t){
        if(t<C.EI) return v*t*t/(2*C.EI);                       // ramp opp
        if(t<1-C.EO) return v*C.EI/2 + v*(t-C.EI);              // konstant fart
        const u=t-(1-C.EO);
        return v*C.EI/2 + v*(1-C.EO-C.EI) + v*(u - u*u/(2*C.EO)); // ramp ned
      }
      return new Promise(res=>{
        let t0=null;
        function fr(ts){
          if(t0===null)t0=ts;
          const t=Math.min(1,(ts-t0)/C.DUR);
          const s=ease(t);
          const base=C.PATH.R0+(C.PATH.R1-C.PATH.R0)*s;
          const range=base*(1+C.PATH.ECC*Math.sin(Math.PI*s));
          const tilt=C.PATH.T0+(C.PATH.T1-C.PATH.T0)*s;
          const heading=((C.PATH.H0+C.PATH.SWEEP*s)%360+360)%360;
          map.center={lat:C.M.lat,lng:C.M.lng,altitude:0};
          map.range=range; map.tilt=tilt; map.heading=heading;
          if(t<1) requestAnimationFrame(fr); else res(true);
        }
        requestAnimationFrame(fr);
      });
    })()`,
    true,
  );
}

async function main() {
  rmSync(FRAME_DIR, { recursive: true, force: true });
  mkdirSync(FRAME_DIR, { recursive: true });
  const profile = "/tmp/placy-fly-chrome-profile";
  rmSync(profile, { recursive: true, force: true });

  // Legg på ?film=1 (med mindre FLY_PINS=1) → boardet dropper kategori-POI-pins
  // på render-nivå for en ren cinematisk film (trygt, ingen DOM-race).
  const pageUrl =
    process.env.FLY_PINS === "1"
      ? URL
      : URL + (URL.includes("?") ? "&" : "?") + "film=1";

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

  // Kategori-POI-pins skjules via produkt-flagget ?film=1 (lagt på URL-en under,
  // med mindre FLY_PINS=1) → boardet render'er dem ikke i det hele tatt. Vi gjør
  // det IKKE fra DOM her: pins re-monteres per zoom-tier, og å fjerne dem utenfra
  // krasjer React (removeChild-race på en node React fortsatt eier). Render-nivå
  // i BoardMap3D (markerPOIs → []) er den trygge, race-frie måten.

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

  // Sett start-posituren (s=0, avstand) umiddelbart, la tiles streame inn.
  await setCameraInstant(poseAt(0));
  await sleep(TILES_SETTLE_MS);

  // ── opptak ──
  await send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: W,
    maxHeight: H,
    everyNthFrame: 1,
  });
  await sleep(HOLD_START_MS); // kort hold på avstands-etableringen

  // Kjør hele oval-spiralen som ÉN kontinuerlig, frame-drevet bevegelse (rAF i
  // siden). Ingen ben/overlap → ingen ease per waypoint. awaitPromise venter til
  // bevegelsen er ferdig.
  await runFlythrough();

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
