#!/usr/bin/env node
/**
 * Nettleserkontroll av hver side i Leangenbukta-kopien (2026-09-23).
 *
 *   BASE=http://localhost:3107 node scripts/demo/leangenbukta-site/qa-pages.mjs [--screens]
 *
 * Åpner hver side i sideregisteret på desktop 1440×900 og mobil 390×844 i
 * systemets Chrome og registrerer: HTTP-status, konsollfeil, bilder som ikke
 * lastet, horisontal overflyt, forespørsler til leangenbukta.no ved lasting,
 * Placy-felt og dets plassering på byggsider, chatknappens posisjon mot
 * «til toppen», og om alle lenker i innholdet enten er lokale sider som finnes,
 * ankere, kontaktlenker eller merkede eksterne lenker.
 *
 * Skriver docs/research/leangenbukta-nettside/qa/report.json og, med
 * --screens, skjermbilder av hver byggside og én side per øvrig sidetype.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const BASE = process.env.BASE ?? "http://localhost:3107";
const SITE = "/demo/leangenbukta-nettside";
const OUT = path.join(ROOT, "docs/research/leangenbukta-nettside/qa");
const SCREENS = process.argv.includes("--screens");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "data/demo/leangenbukta-nettside/pages.json"), "utf8"));
const localPaths = new Set(registry.pages.map((page) => `${SITE}${page.path}`));

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

fs.mkdirSync(path.join(OUT, "screens"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const shotKinds = new Set();

for (const [name, options] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext(options);
  for (const page of registry.pages) {
    const tab = await context.newPage();
    const errors = [];
    const sourceRequests = [];
    tab.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text().slice(0, 300));
    });
    tab.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 300)}`));
    tab.on("request", (request) => {
      if (/\/\/(www\.)?leangenbukta\.no\//.test(request.url())) sourceRequests.push(request.url());
    });
    const response = await tab.goto(`${BASE}${SITE}${page.path}`, { waitUntil: "load", timeout: 120_000 });
    await tab.waitForTimeout(800);
    const facts = await tab.evaluate(({ localPaths, site }) => {
      const content = document.querySelector("#ajax-content-wrap") ?? document.body;
      const images = [...content.querySelectorAll("img")].filter((img) => img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0);
      const links = [...content.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), external: a.dataset.demoExternal === "true", text: a.textContent.trim().slice(0, 40) }));
      const bad = links.filter(({ href, external }) => {
        if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
        // Lokale mediefiler (forsidens kart åpnes som bilde) er gyldige mål.
        if (href.startsWith(site) && /\.(png|jpe?g|webp|svg|mp4)$/i.test(href)) return false;
        if (href.startsWith(site)) return !localPaths.includes(href.split("#")[0].replace(/\/$/, ""));
        if (href.startsWith("/demo/leangenbukta-lokal")) return false;
        return !external;
      });
      const field = document.querySelector(".demo-placy-field");
      const fieldTop = field ? field.getBoundingClientRect().top + scrollY : null;
      const firstRow = document.querySelector(".post-content .content-inner > .wpb_row") ?? document.querySelector(".main-content > .row > .wpb_row");
      const chat = document.querySelector("[data-placy-chat-host]") ?? document.querySelector("#placy-chat-host");
      const chatButton = chat?.shadowRoot?.querySelector("button");
      const toTop = document.querySelector("#to-top");
      const box = (el) => (el ? (({ top, bottom, left, right }) => ({ top, bottom, left, right }))(el.getBoundingClientRect()) : null);
      return {
        title: document.title,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        brokenImages: images.map((img) => img.getAttribute("src")),
        badLinks: bad,
        linkCount: links.length,
        placyField: field ? { top: Math.round(fieldTop), variant: [...field.classList].find((c) => c.startsWith("demo-placy-field--")), afterFirstRow: firstRow ? firstRow.nextElementSibling === field : false } : null,
        pageMarker: document.querySelector("[data-placy-page-id]")?.getAttribute("data-placy-page-id") ?? null,
        chatButton: box(chatButton),
        toTop: box(toTop),
        forms: document.querySelectorAll("#ajax-content-wrap form:not([method='dialog'])").length,
      };
    }, { localPaths: [...localPaths], site: SITE });
    const result = { viewport: name, id: page.id, kind: page.kind, status: response?.status(), errors, sourceRequests: sourceRequests.length, ...facts };
    results.push(result);
    const shotKey = `${name}:${page.kind}`;
    if (SCREENS && (page.kind === "building" || !shotKinds.has(shotKey))) {
      shotKinds.add(shotKey);
      await tab.screenshot({ path: path.join(OUT, "screens", `${name}-${page.id}.jpg`), type: "jpeg", quality: 55, fullPage: false });
    }
    await tab.close();
  }
  await context.close();
}
await browser.close();

const problems = results.filter((r) =>
  r.status !== 200 || r.errors.length || r.brokenImages.length || r.badLinks.length || r.overflowX > 1 || r.sourceRequests || r.forms ||
  r.pageMarker !== r.id || (r.kind === "building" && (!r.placyField || !r.placyField.afterFirstRow)));
fs.writeFileSync(path.join(OUT, "report.json"), `${JSON.stringify({ base: BASE, checkedAt: new Date().toISOString(), pages: registry.pages.length, results }, null, 2)}\n`);
console.log(`${results.length} sidevisninger (${registry.pages.length} sider × ${Object.keys(VIEWPORTS).length} flater). Avvik: ${problems.length}`);
for (const r of problems) {
  console.log(`- ${r.viewport} ${r.id}: status=${r.status} feil=${r.errors.length} bilder=${r.brokenImages.length} lenker=${r.badLinks.length} overflyt=${r.overflowX} kildekall=${r.sourceRequests} skjema=${r.forms} markør=${r.pageMarker} placy=${JSON.stringify(r.placyField)}`);
  for (const e of r.errors.slice(0, 2)) console.log(`    ${e}`);
  for (const l of r.badLinks.slice(0, 3)) console.log(`    lenke: ${l.href} «${l.text}»`);
}
process.exitCode = problems.length ? 1 : 0;
