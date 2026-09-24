#!/usr/bin/env node
/**
 * Avgrenser stilarkene de øvrige sidetypene trenger (innlegg, portefølje,
 * galleri, slider, toggles, tabeller) til `.leangenbukta-site` (2026-09-23).
 *
 *   node scripts/demo/leangenbukta-site/scope-page-css.mjs
 *
 * Samme reparasjoner som forsidens `scripts/demo/nettside-replika/scope-css.mjs`
 * (se README der): rot-selektorer byttes mot `:is(div)`, `-ms-`-erklæringer og
 * IE-hacks fjernes. Leser stilarkene U1-inventaret lastet ned
 * (docs/research/leangenbukta-nettside/css-manifest.json) og skriver
 * `app/demo/leangenbukta-nettside/pages.css`, som lastes ETTER original.css.
 * Cookie-banner-, animasjons- og tomme stilark tas ikke med.
 *
 * Etter de eksterne stilarkene kommer sidenes egne inline-`<style>`-blokker
 * (WPBakerys `vc_custom_*`-klasser, Salients dynamiske CSS og elementstiler),
 * slik de står etter stilarkene i originalen. Klassenavnene er unike per side,
 * så blokkene fra alle sider kan ligge i samme fil; like blokker tas med én gang.
 */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { load } from "cheerio";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const DIR = path.join(ROOT, "docs/research/leangenbukta-nettside");
const PUBLIC_DIR = path.join(ROOT, "public/demo/leangenbukta-nettside");
const SCOPE = ".leangenbukta-site";
const SKIP_FILE = /cookie-law-info|animate\.min|honeypot|uaf\.css/;

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "css-manifest.json"), "utf8")).stylesheets;
/** Alle klasser noen side har på <body>, lest fra snapshotene. */
const BODY_CLASSES = new Set(
  fs.readdirSync(path.join(DIR, "snapshot")).flatMap((file) =>
    (/<body[^>]*class="([^"]*)"/.exec(fs.readFileSync(path.join(DIR, "snapshot", file), "utf8"))?.[1] ?? "").split(/\s+/).filter(Boolean),
  ),
);
const assetMap = JSON.parse(fs.readFileSync(path.join(DIR, "asset-map.json"), "utf8"));
const localFiles = new Set([...fs.readdirSync(PUBLIC_DIR), ...fs.readdirSync(path.join(PUBLIC_DIR, "pages")).map((f) => `pages/${f}`)]);
function rewriteUrls(css, baseUrl) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q, raw) => {
    const v = raw.trim();
    if (v.startsWith("data:") || v.startsWith("#")) return whole;
    let abs;
    try {
      abs = new URL(v, baseUrl || "https://leangenbukta.no/").toString();
    } catch {
      return whole;
    }
    const clean = abs.split("#")[0];
    const mapped = assetMap[clean]?.localPath;
    const rel = mapped?.replace(/^\/demo\/leangenbukta-nettside\//, "");
    if (!rel || !localFiles.has(rel)) return "none";
    return `url("/demo/leangenbukta-nettside/${rel}")`;
  });
}

const isRootNode = (n) =>
  (n.type === "tag" && (n.value === "html" || n.value === "body")) ||
  (n.type === "pseudo" && n.value === ":root");

/**
 * Avgrenser én selektor til `.leangenbukta-site`.
 *
 * `html`, `body` og `:root` fjernes uansett hvor i selektoren de står. Kundens
 * CSS har rekkefølge-avhengige regler som `html body .vc_row-fluid>.span_12`;
 * blir `body` stående bak prefikset, snur spesifisiteten og reglene treffer i
 * feil rekkefølge (kolonnene mistet `float:none` på den måten).
 */
function scopeOne(sel) {
  const text = sel.toString().trim();
  if (!text || text.startsWith(SCOPE)) return text;

  const compounds = [];
  const combinators = [];
  let current = [];
  sel.nodes.forEach((n) => {
    if (n.type === "combinator") {
      compounds.push(current);
      combinators.push(n.toString().trim() || " ");
      current = [];
    } else {
      current.push(n);
    }
  });
  compounds.push(current);

  const cleaned = compounds.map((c) => c.filter((n) => !isRootNode(n)));
  let rootCount = 0;
  const rootExtras = [];
  // Selektorer som starter med en body-klasse uten `body` foran
  // (`.single-post .container-wrap`) gjelder wrapperen selv, ikke et
  // barn av den: klassene står på `.leangenbukta-site` (se site-chrome.tsx).
  // Gjelder også etter en fjernet rot (`html .single-post .container-wrap`).
  const firstIndex = cleaned.findIndex((c) => c.length > 0);
  const first = cleaned[firstIndex] ?? [];
  if (
    firstIndex >= 0 &&
    first.every((n) => n.type === "class" || n.type === "attribute") &&
    first.some((n) => n.type === "class" && BODY_CLASSES.has(n.value))
  ) {
    rootExtras.push(...first.map((n) => n.toString().trim()));
    cleaned[firstIndex] = [];
  }
  compounds.forEach((c, i) => {
    const removed = c.length - cleaned[i].length;
    rootCount += removed;
    if (removed > 0 && cleaned[i].length > 0) {
      // `body.material X` -> klassene fra body-compounden hører til wrapperen.
      rootExtras.push(...cleaned[i].map((n) => n.toString().trim()));
      cleaned[i] = [];
    }
  });

  let out = "";
  let wrote = false;
  for (let i = 0; i < cleaned.length; i += 1) {
    const body = cleaned[i].map((n) => n.toString().trim()).join("");
    if (!body) continue;
    if (wrote) out += combinators[i - 1] === " " ? " " : combinators[i - 1] || " ";
    out += body;
    wrote = true;
  }

  // `html`/`body`/`:root` bidrar med type-spesifisitet i originalen. Fjerner vi
  // dem uten å kompensere, snur rekkefølgen mellom regler som var avhengige av
  // nettopp det (menyfargen i off-canvas var første offer). `:is(div)` har
  // spesifisiteten til ett type-selektor og treffer alltid wrapperen.
  const head = SCOPE + rootExtras.join("") + ":is(div)".repeat(rootCount);
  if (!wrote) return head;
  return `${head} ${out}`;
}

function scopeSelector(selector) {
  const parsed = selectorParser().astSync(selector);
  return parsed.nodes.map(scopeOne).join(",");
}

const SKIP_AT = new Set(["font-face", "keyframes", "-webkit-keyframes", "charset", "import", "namespace", "counter-style", "font-feature-values", "property", "page", "viewport", "layer"]);

function scopeCss(css) {
  const root = postcss.parse(css);
  // Gamle IE-hacks (*prop, _prop, progid:-filtre, expression()) er ugyldig CSS
  // for Lightning CSS i Next 16 og fjernes.
  root.walkDecls((decl) => {
    const rawProp = (decl.raws && decl.raws.prop && decl.raws.prop.raw) || decl.prop;
    const prop = rawProp.trim().toLowerCase();
    // Gamle IE-hacks og -ms-prefikser. `display:-ms-flexbox` rett etter
    // `display:flex` får Lightning CSS i Next 16 til å droppe HELE display-
    // erklæringen, og da kollapser Salients kolonner til én kolonne.
    if (
      /^[*_$]/.test(prop) ||
      prop.startsWith("-ms-") ||
      /progid:|expression\s*\(/i.test(decl.value) ||
      (prop === "display" && /^-(ms|webkit|moz)-/.test(decl.value.trim()))
    ) {
      decl.remove();
    }
  });
  root.walkRules((rule) => {
    let p = rule.parent;
    let inSkipped = false;
    while (p) {
      if (p.type === "atrule" && (SKIP_AT.has(p.name.toLowerCase()) || /keyframes$/i.test(p.name))) inSkipped = true;
      p = p.parent;
    }
    if (inSkipped) return;
    try {
      rule.selector = scopeSelector(rule.selector);
    } catch {
      /* leave untouched on parse failure */
    }
  });
  return root.toString();
}

const out = [];
out.push(`/* leangenbukta.no, stilark for sidetypene utover forsiden, hentet 2026-09-23. Alle selektorer avgrenset til ${SCOPE}. */`);

for (const sheet of manifest) {
  if (sheet.status !== "downloaded" || SKIP_FILE.test(sheet.file)) continue;
  let css = fs.readFileSync(path.join(DIR, sheet.file), "utf8");
  if (!css.trim()) continue;
  css = rewriteUrls(css, sheet.sourceUrl);
  let result;
  try {
    result = scopeCss(css);
  } catch (err) {
    console.error("PARSE FAIL", sheet.file, err.message);
    process.exitCode = 1;
    continue;
  }
  out.push(`\n/* --- ${sheet.file}: ${sheet.sourceUrl} --- */`);
  out.push(result);
}

const SKIP_INLINE = /cookie-law|emoji|wp-img-auto-sizes/;
const snapshotDir = path.join(DIR, "snapshot");
const seenBlocks = new Set();
const seenRules = new Set();
const localIds = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8")).entries
  .filter((entry) => entry.disposition === "local" || entry.id === "om-prosjektet" || entry.id === "parktunet1" || entry.id === "saltakshusk")
  .map((entry) => entry.id);
out.push("\n/* --- sidenes inline-stiler --- */");
for (const id of localIds) {
  const file = path.join(snapshotDir, `${id}.html`);
  if (!fs.existsSync(file)) continue;
  const $ = load(fs.readFileSync(file, "utf8"));
  $("style").each((_, el) => {
    const css = $(el).html() ?? "";
    if (!css.trim() || SKIP_INLINE.test($(el).attr("id") ?? "") || seenBlocks.has(css)) return;
    seenBlocks.add(css);
    try {
      // Salients dynamiske CSS er nesten lik på hver side; bare regler som
      // ikke allerede er med, tas med, i den rekkefølgen de først dukker opp.
      // Kundens egne skrivefeil: `!improtant` og en løsrevet `;!important;`.
      const repaired = css.replace(/;\s*!important\s*;/g, ";").replace(/!\s*(?!important\b)[a-zA-Z]+/g, "!important");
      const scoped = postcss.parse(scopeCss(rewriteUrls(repaired, "https://leangenbukta.no/")));
      const fresh = scoped.nodes.map((node) => node.toString()).filter((rule) => !seenRules.has(rule));
      fresh.forEach((rule) => seenRules.add(rule));
      if (fresh.length) out.push(`/* ${id} ${$(el).attr("id") ?? $(el).attr("data-type") ?? "style"} */\n${fresh.join("\n")}`);
    } catch (err) {
      console.error("INLINE PARSE FAIL", id, $(el).attr("id") ?? "", err.message);
    }
  });
}

let finalCss = out.join("\n");
finalCss = finalCss.replace(/([;{])\s*[*_$][-a-zA-Z]+\s*:[^;}]*;?/g, "$1");
finalCss = finalCss.replace(/!\s*(?!important\b)[a-zA-Z]+/g, "!important");

const target = path.join(ROOT, "app/demo/leangenbukta-nettside/pages.css");
fs.writeFileSync(target, finalCss);
console.log("wrote", path.relative(ROOT, target), (fs.statSync(target).size / 1024).toFixed(0) + " KB");
