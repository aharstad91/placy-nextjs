#!/usr/bin/env node
/**
 * Dev-server for prototypes/ — vanilla HTML/CSS/JS-prototyper uten Next.
 *
 * Gjør tre ting:
 *   1. Genererer prototypes/_shared/env.js fra .env.local (kun public
 *      Mapbox-token) — statiske filer kan ikke lese env selv.
 *   2. Serverer prototypes/ statisk på 0.0.0.0 slik at telefonen på samme
 *      nett når den direkte (ingen Next/HMR/allowedDevOrigins-problematikk).
 *   3. Live-reload: fs.watch + Server-Sent Events, reload-snippet injiseres
 *      i all HTML. Lagre fil → alle åpne faner laster på nytt.
 *
 * Usage: npm run proto   (port 4400, overstyr med PORT=)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "prototypes");
const REPO = path.resolve(ROOT, "..");
const PORT = Number(process.env.PORT || 4400);

// 1) env.js fra .env.local — kun NEXT_PUBLIC_-token, aldri secrets
const envLocal = fs.readFileSync(path.join(REPO, ".env.local"), "utf8");
const mapboxToken = /^NEXT_PUBLIC_MAPBOX_TOKEN=(.*)$/m.exec(envLocal)?.[1]?.trim() ?? "";
fs.mkdirSync(path.join(ROOT, "_shared"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "_shared", "env.js"),
  `// Autogenerert av scripts/proto-serve.mjs — gitignored, IKKE rediger\n` +
    `window.PROTO_ENV = { MAPBOX_TOKEN: ${JSON.stringify(mapboxToken)} };\n`
);

// 2) Live-reload: SSE-klienter + debounced fs.watch
const sseClients = new Set();
let reloadTimer = null;
fs.watch(ROOT, { recursive: true }, (_event, filename) => {
  if (filename && filename.includes("_shared/env.js")) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const res of sseClients) res.write("data: reload\n\n");
  }, 120);
});

const RELOAD_SNIPPET =
  `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }

    if (url.pathname === "/__reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 500\n\n");
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    // Resolve fil — katalog → index.html, guard mot path traversal
    let filePath = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    // Fall tilbake til repoets public/ — board-dataen peker på ekte assets
    // (`/illustrations/hverdagsliv.jpg`), og prototypene skal vise DE bildene,
    // ikke plassholdere.
    if (!fs.existsSync(filePath)) {
      const inPublic = path.normalize(
        path.join(REPO, "public", decodeURIComponent(url.pathname))
      );
      if (inPublic.startsWith(path.join(REPO, "public")) && fs.existsSync(inPublic)) {
        filePath = inPublic;
      }
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`404: ${url.pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });

    if (ext === ".html") {
      const html = fs.readFileSync(filePath, "utf8");
      res.end(
        html.includes("</body>")
          ? html.replace("</body>", `${RELOAD_SNIPPET}</body>`)
          : html + RELOAD_SNIPPET
      );
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  })
  .listen(PORT, "0.0.0.0", () => {
    const lanIp = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === "IPv4" && !i.internal)?.address;
    console.log(`\n  Placy prototyper (live-reload på)\n`);
    console.log(`  Desktop:  http://localhost:${PORT}`);
    if (lanIp) console.log(`  Mobil:    http://${lanIp}:${PORT}   (samme wifi)`);
    console.log("");
  });
