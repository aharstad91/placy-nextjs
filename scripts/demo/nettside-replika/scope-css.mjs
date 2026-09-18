import fs from "node:fs";
import path from "node:path";
import postcss from "/Users/andreasharstad/Documents/placy/node_modules/postcss/lib/postcss.mjs";
import { createRequire } from "node:module";
const require_ = createRequire("/Users/andreasharstad/Documents/placy/package.json");
const selectorParser = require_("postcss-selector-parser");

const DIR = "/private/tmp/claude-501/-Users-andreasharstad-Documents-placy/13b5c44d-3db1-4246-a090-f7e05f014319/scratchpad/lb";
const DEST = "/Users/andreasharstad/Documents/placy/public/demo/leangenbukta-nettside";
const SCOPE = ".leangenbukta-site";
const DROP = new Set([2, 6, 8, 9, 11, 14, 26, 27, 29, 30, 45]);

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "css-manifest.json"), "utf8"));
const assetMap = JSON.parse(fs.readFileSync(path.join(DIR, "asset-map.json"), "utf8"));
const localFiles = new Set(fs.readdirSync(DEST));

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
    const local = assetMap[clean];
    if (!local || !localFiles.has(local)) return "url(about:blank)";
    return `url("/demo/leangenbukta-nettside/${local}")`;
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
out.push(`/* leangenbukta.no stylesheet snapshot, hentet 2026-09-16. Alle selektorer avgrenset til ${SCOPE}. */`);

for (const node of manifest) {
  if (DROP.has(node.i)) continue;
  let css = fs.readFileSync(path.join(DIR, node.file), "utf8");
  if (!css.trim()) continue;
  css = rewriteUrls(css, node.url);
  let result;
  try {
    result = scopeCss(css);
  } catch (err) {
    console.error("PARSE FAIL", node.i, node.url || "(inline)", err.message);
    continue;
  }
  out.push(`\n/* --- ${node.i.toString().padStart(2, "0")}: ${node.url || "inline <style>"} --- */`);
  out.push(result);
}

// Siste sveip: IE-hacks som postcss beholder som råtekst.
let finalCss = out.join("\n");
finalCss = finalCss.replace(/([;{])\s*[*_$][-a-zA-Z]+\s*:[^;}]*;?/g, "$1");
// Skrivefeil i kundens egen CSS (!improtant o.l.) stopper Lightning CSS i Next 16.
finalCss = finalCss.replace(/!\s*(?!important\b)[a-zA-Z]+/g, "!important");

const target = "/Users/andreasharstad/Documents/placy/app/demo/leangenbukta-nettside/original.css";
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, finalCss);
console.log("wrote", target, (fs.statSync(target).size / 1024).toFixed(0) + " KB");
