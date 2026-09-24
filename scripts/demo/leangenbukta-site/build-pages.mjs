#!/usr/bin/env node
/**
 * Bygger de lokale sidene i Leangenbukta-kopien fra det frosne inventaret (2026-09-23).
 *
 *   node scripts/demo/leangenbukta-site/build-pages.mjs [--check]
 *
 * Leser  docs/research/leangenbukta-nettside/manifest.json      (U1-inventaret)
 *        docs/research/leangenbukta-nettside/snapshot/<id>.html  (rå HTML per side)
 *        docs/research/leangenbukta-nettside/asset-map.json      (kilde-URL → lokal fil)
 *        scripts/demo/leangenbukta-site/pages-config.json        (Placy-plasseringer og chatforslag)
 * Skriver data/demo/leangenbukta-nettside/pages/<id>.html        (rensede fragmenter)
 *         data/demo/leangenbukta-nettside/pages.json             (runtime-registeret)
 *         docs/research/leangenbukta-nettside/link-report.json   (hver lenke og hvor den havnet)
 *
 * Fragmentet er innholdet i `#ajax-content-wrap` uten bunnfelt og cookie-banner:
 * skallet (header, meny, bunnfelt) er felles og ligger i `site-chrome.tsx`.
 * Rensingen fjerner alt som kan kjøre eller sende noe (skript, stilark,
 * `on*`-handlere, skjema-innsending, iframes) og skriver om hver lenke og hvert
 * medium. En intern lenke som ikke har en disposisjon i manifestet stopper
 * bygget: en kopi som stille lenker ut av seg selv er feilen dekningsregnskapet
 * finnes for å fange.
 *
 * `--check` skriver ingenting og feiler hvis fragmentene ikke er à jour.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const RESEARCH = path.join(ROOT, "docs/research/leangenbukta-nettside");
const PUBLIC_DIR = path.join(ROOT, "public/demo/leangenbukta-nettside");
const OUT_DIR = path.join(ROOT, "data/demo/leangenbukta-nettside/pages");
const REGISTRY = path.join(ROOT, "data/demo/leangenbukta-nettside/pages.json");
const SITE_BASE = "/demo/leangenbukta-nettside";
const SOURCE_HOSTS = new Set(["leangenbukta.no", "www.leangenbukta.no"]);
const CHECK = process.argv.includes("--check");

const manifest = JSON.parse(fs.readFileSync(path.join(RESEARCH, "manifest.json"), "utf8"));
const rawAssetMap = JSON.parse(fs.readFileSync(path.join(RESEARCH, "asset-map.json"), "utf8"));
/** Kilde-URL-er sammenlignes dekodet: kunden har filnavn med «–» som noen sider skriver prosent-kodet. */
const decodeKey = (value) => {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};
const assetMap = Object.fromEntries(Object.entries(rawAssetMap).map(([key, value]) => [decodeKey(key), value]));
/**
 * WordPress lager beskårne varianter (`-600x400.jpg`) av hvert bilde. Er akkurat
 * den varianten ikke lastet ned, brukes en annen variant av samme original.
 */
const variantBase = (url) => url.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "").replace(/-scaled(?=\.[a-z0-9]+$)/i, "");
const byVariantBase = new Map();
for (const [key, value] of Object.entries(assetMap)) {
  const base = variantBase(key);
  if (!byVariantBase.has(base) || (value.bytes ?? 0) > (byVariantBase.get(base).bytes ?? 0)) byVariantBase.set(base, value);
}
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/demo/leangenbukta-site/pages-config.json"), "utf8"));

/** Normalisert nøkkel for en kilde-URL: uten fragment, spørring og avsluttende skråstrek. */
function urlKey(raw) {
  const url = new URL(raw);
  const host = url.hostname.replace(/^www\./, "");
  return `${host}${url.pathname.replace(/\/+$/, "") || "/"}`;
}

/**
 * Der WordPress serverer SAMME innlegg under to slugger, velger inventaret én
 * som kanonisk. Kopien skal bruke sluggen nettstedet selv lenker til (menyen
 * lenker til /om-prosjektet/, ikke /om-prosjektet-2/), så config kan snu paret.
 * Hver overstyring er begrunnet i pages-config.json.
 */
const entries = manifest.entries.map((entry) => {
  const override = config.dispositionOverrides?.[entry.id];
  return override ? { ...entry, disposition: override.disposition, duplicateOf: override.duplicateOf } : entry;
});
const byKey = new Map();
for (const entry of entries) {
  for (const raw of [entry.sourceUrl, entry.finalUrl, entry.canonicalUrl].filter(Boolean)) {
    try {
      byKey.set(urlKey(raw), entry);
    } catch {
      /* ugyldig URL i inventaret registreres av dekningskontrollen */
    }
  }
}
const byId = new Map(entries.map((entry) => [entry.id, entry]));
for (const id of Object.keys(config.dispositionOverrides ?? {})) if (!byId.has(id)) throw new Error(`dispositionOverrides nevner ukjent side ${id}`);

/** Følger duplikat- og omdirigeringskjeder til siden som faktisk bygges. */
function resolveEntry(entry, seen = new Set()) {
  if (!entry || seen.has(entry.id)) return null;
  seen.add(entry.id);
  if (entry.disposition === "local") return entry;
  if (entry.disposition === "duplicate" && entry.duplicateOf) return resolveEntry(byId.get(entry.duplicateOf), seen);
  if (entry.disposition === "redirect" && entry.redirectTo) {
    try {
      return resolveEntry(byKey.get(urlKey(entry.redirectTo)) ?? byId.get(entry.redirectTo), seen);
    } catch {
      return resolveEntry(byId.get(entry.redirectTo), seen);
    }
  }
  return null;
}

const localEntries = entries.filter((entry) => entry.disposition === "local");
/**
 * Lokal sti = kildens sti. Da er kopiens adresser de samme som kundens egne
 * (`/knutepunktet`, `/salgsmateriell/prislister`), og en side kan sammenlignes
 * med originalen ved å bytte domene.
 */
const localPath = (entry) => (entry.id === "forside" ? "" : new URL(entry.sourceUrl).pathname.replace(/\/+$/, "").toLowerCase());

const linkReport = [];
const problems = [];

/**
 * Hvor en lenke fra kopien skal gå. Første-parts sider blir lokale ruter;
 * dokumenter, boligvelger, portaler og alt på andre domener går til originalen
 * og merkes som eksterne. Ukjente første-parts sider er en byggefeil.
 */
function rewriteHref(href, fromId) {
  const raw = href.trim();
  if (!raw || raw === "#") return { href: "#", kind: "anchor" };
  if (raw.startsWith("#")) return { href: raw, kind: "anchor" };
  if (/^(mailto|tel):/i.test(raw)) return { href: raw, kind: "contact" };
  if (/^javascript:/i.test(raw)) return { href: null, kind: "dropped" };
  // Kildefeil: flere sider lenker til en e-postadresse uten `mailto:`, som
  // nettleseren leser som en relativ side og gir 404. Kopien retter lenken slik
  // at kontaktknappen virker; feilen er ført i inventory.md som funn til kunden.
  if (/^[^\s/@]+@[^\s/@]+\.[a-z]{2,}$/i.test(raw)) return { href: `mailto:${raw}`, kind: "contact", fixed: "mailto" };
  let url;
  try {
    url = new URL(raw, "https://leangenbukta.no/");
  } catch {
    problems.push(`${fromId}: ugyldig lenke ${raw}`);
    return { href: null, kind: "dropped" };
  }
  if (!/^https?:$/.test(url.protocol)) return { href: null, kind: "dropped" };
  if (!SOURCE_HOSTS.has(url.hostname)) return { href: url.toString(), kind: "external" };
  // Boligvelgeren er et eksternt salgssystem (Plyo) også når den ligger under
  // kundens domene: den skal åpnes hos originalen, ikke som en lokal kopi.
  if (url.pathname.startsWith("/boligvelger")) return { href: url.toString(), kind: "external" };
  const entry = byKey.get(urlKey(url.toString()));
  if (!entry) {
    // Opplastede filer (prospekter, prislister, bilder) er dokumenter hos originalen.
    if (url.pathname.startsWith("/wp-content/")) return { href: url.toString(), kind: "document" };
    problems.push(`${fromId}: intern lenke uten disposisjon i manifestet: ${url}`);
    return { href: url.toString(), kind: "external" };
  }
  const target = resolveEntry(entry);
  if (!target) return { href: url.toString(), kind: entry.kind === "document" ? "document" : "external" };
  return { href: `${SITE_BASE}${localPath(target)}${url.hash}`, kind: "local", target: target.id };
}

const localFiles = new Set(fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : []);
const localPageFiles = new Set(fs.existsSync(path.join(PUBLIC_DIR, "pages")) ? fs.readdirSync(path.join(PUBLIC_DIR, "pages")) : []);

/** Lokal offentlig sti for en medie-URL, eller null hvis den ikke er lastet ned. */
function localAsset(raw) {
  let key;
  try {
    key = decodeKey(new URL(raw, "https://leangenbukta.no/").toString().split("#")[0]);
  } catch {
    return null;
  }
  const mapped = (assetMap[key] ?? byVariantBase.get(variantBase(key)))?.localPath;
  if (typeof mapped === "string") {
    const rel = mapped.replace(/^\/?(public\/)?demo\/leangenbukta-nettside\//, "");
    const base = path.basename(rel);
    if (rel.startsWith("pages/") ? localPageFiles.has(base) : localFiles.has(rel)) return `${SITE_BASE}/${rel}`;
  }
  return null;
}

/** Største srcset-kandidat med bredde ≤ 1600 som finnes lokalt, ellers `src`. */
function bestImage($img) {
  const candidates = ($img.attr("srcset") ?? "")
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .filter(([u, w]) => u && /^\d+w$/.test(w ?? ""))
    .map(([u, w]) => ({ url: u, width: Number(w.slice(0, -1)) }))
    .sort((a, b) => b.width - a.width);
  for (const candidate of candidates.filter((c) => c.width <= 1600)) {
    const local = localAsset(candidate.url);
    if (local) return local;
  }
  for (const raw of [$img.attr("data-nectar-img-src"), $img.attr("data-src"), $img.attr("src"), ...candidates.map((c) => c.url)]) {
    if (raw && !raw.startsWith("data:")) {
      const local = localAsset(raw);
      if (local) return local;
    }
  }
  return null;
}

const dimsCache = new Map();
async function dims(publicPath) {
  if (dimsCache.has(publicPath)) return dimsCache.get(publicPath);
  const file = path.join(ROOT, "public", publicPath);
  let result = null;
  try {
    if (file.endsWith(".svg")) {
      const text = fs.readFileSync(file, "utf8").slice(0, 4000);
      const viewBox = /viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/.exec(text);
      const w = /\swidth=["']([\d.]+)/.exec(text);
      const h = /\sheight=["']([\d.]+)/.exec(text);
      if (viewBox) result = [Math.round(Number(viewBox[1])), Math.round(Number(viewBox[2]))];
      else if (w && h) result = [Math.round(Number(w[1])), Math.round(Number(h[1]))];
    } else {
      const meta = await sharp(file).metadata();
      if (meta.width && meta.height) result = [meta.width, meta.height];
    }
  } catch {
    result = null;
  }
  dimsCache.set(publicPath, result);
  return result;
}

function rewriteCssUrls(style, fromId) {
  return style.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _q, raw) => {
    if (raw.startsWith("data:")) return whole;
    const local = localAsset(raw);
    if (!local) {
      problems.push(`${fromId}: bakgrunnsbilde ikke lastet ned: ${raw}`);
      return "none";
    }
    return `url(${local})`;
  });
}

function externalLabel(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "originalsiden";
  }
}

/**
 * Salients CSS styrer sidemalene via body-klassene (`single-post`,
 * `page-template-default` …) og `data-bg-header`. Skallet setter dem på
 * wrapperen, og det må derfor vite dem per side.
 */
const bodyAttributes = {};

async function buildFragment(entry) {
  const file = path.join(RESEARCH, "snapshot", `${entry.id}.html`);
  const $ = load(fs.readFileSync(file, "utf8"));
  bodyAttributes[`${SITE_BASE}${localPath(entry)}`] = {
    className: ($("body").attr("class") ?? "").split(/\s+/).filter((c) => c && !/^cmatic-/.test(c)).join(" "),
    bgHeader: $("body").attr("data-bg-header") ?? "false",
  };
  const $wrap = $("#ajax-content-wrap");
  if (!$wrap.length) throw new Error(`${entry.id}: fant ikke #ajax-content-wrap`);

  // Skallet og tredjepartslag hører ikke til sideinnholdet.
  $wrap.find("#footer-outer, #slide-out-widget-area, #slide-out-widget-area-bg, .nectar-social.fixed, #to-top, #cookie-law-info-bar, .cli-modal, .cli-modal-backdrop, #cookie-law-info-again, .wt-cli-cookie-bar-container").remove();
  $wrap.find("script, style, link, meta, noscript, template, object, embed").remove();

  // Skjemaer sender aldri noe fra kopien: de erstattes av en synlig vei til
  // originalens skjema.
  $wrap.find("form").each((_, form) => {
    const $form = $(form);
    const original = entry.finalUrl ?? entry.sourceUrl;
    $form.replaceWith(
      `<div class="demo-form-notice" role="note"><p><strong>Skjemaet sendes på leangenbukta.no.</strong> Dette er en demokopi, og ingenting sendes herfra.</p><p><a class="nectar-button medium regular extra-color-2 regular-button" href="${original}" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span>Gå til skjemaet på leangenbukta.no</span></a></p></div>`,
    );
  });
  $wrap.find("iframe").each((_, frame) => {
    const src = $(frame).attr("src") ?? $(frame).attr("data-src") ?? "";
    const href = src.startsWith("//") ? `https:${src}` : src;
    const label = /youtube|vimeo/.test(href) ? "Se videoen" : "Åpne innholdet";
    $(frame).replaceWith(
      href.startsWith("http")
        ? `<p class="demo-embed-notice"><a href="${href}" data-demo-external="true" target="_blank" rel="noopener noreferrer">${label} på ${externalLabel(href)}</a></p>`
        : "",
    );
  });

  // Attributter som kan kjøre kode, eller som bare gir mening med temaets JS.
  $wrap.find("*").each((_, el) => {
    for (const name of Object.keys(el.attribs ?? {})) {
      if (/^on/i.test(name)) $(el).removeAttr(name);
    }
  });

  for (const el of $wrap.find("a[href]").toArray()) {
    const $a = $(el);
    const result = rewriteHref($a.attr("href"), entry.id);
    linkReport.push({ from: entry.id, source: $a.attr("href"), to: result.href, kind: result.kind, target: result.target });
    if (!result.href) {
      $a.removeAttr("href");
      continue;
    }
    $a.attr("href", result.href);
    if (result.kind === "external" || result.kind === "document") {
      $a.attr("target", "_blank").attr("rel", "noopener noreferrer").attr("data-demo-external", "true");
    } else {
      $a.removeAttr("target").removeAttr("rel");
    }
  }

  for (const el of $wrap.find("img").toArray()) {
    const $img = $(el);
    if (!$img.attr("src") && !$img.attr("srcset") && !$img.attr("data-src")) {
      // Kilden har selv et bilde uten adresse (tomt salgslederbilde); det vises ikke der heller.
      linkReport.push({ from: entry.id, source: "", to: null, kind: "empty-image" });
      $img.remove();
      continue;
    }
    const local = bestImage($img);
    if (!local) {
      problems.push(`${entry.id}: bilde ikke lastet ned: ${$img.attr("src")}`);
      $img.remove();
      continue;
    }
    const size = await dims(local);
    if (!size) {
      problems.push(`${entry.id}: fant ikke mål for ${local}`);
      $img.remove();
      continue;
    }
    const alt = $img.attr("alt") ?? "";
    const className = $img.attr("class");
    const style = $img.attr("style");
    for (const name of Object.keys(el.attribs)) $img.removeAttr(name);
    $img.attr({ src: local, alt, width: String(size[0]), height: String(size[1]) });
    if (className) $img.attr("class", className.replace(/\blazyload\b/g, "").trim());
    if (style) $img.attr("style", rewriteCssUrls(style, entry.id));
  }

  for (const el of $wrap.find("video source[src], video[src], video[poster]").toArray()) {
    const $el = $(el);
    for (const name of ["src", "poster"]) {
      const value = $el.attr(name);
      if (!value) continue;
      const local = localAsset(value);
      if (local) $el.attr(name, local);
      else {
        problems.push(`${entry.id}: video/poster ikke lastet ned: ${value}`);
        $el.removeAttr(name);
      }
    }
  }

  // «Advanced WordPress Backgrounds» legger bakgrunnen som et søsken ETTER
  // raden og lar jarallax flytte den inn med JS. Uten JS blir raden tom og
  // bildet havner under den. Her flyttes bakgrunnen inn i radens egen
  // bakgrunnslag, og en videobakgrunn blir et ekte <video>-element (samme grep
  // som forsidens helt).
  for (const el of $wrap.find(".nk-awb-after-vc_row").toArray()) {
    const $awb = $(el);
    const $row = $awb.prev(".wpb_row");
    const $layer = $row.find("> .row-bg-wrap .inner-wrap").first();
    const $wrapEl = $awb.find(".nk-awb-wrap").first();
    const type = $wrapEl.attr("data-awb-type");
    let media = "";
    if (type === "video") {
      const src = ($wrapEl.attr("data-awb-video") ?? "").replace(/^mp4:/, "");
      const local = src ? localAsset(src) : null;
      if (local) media = `<video autoplay muted loop playsinline><source src="${local}" type="video/mp4"></video>`;
      else if (src) problems.push(`${entry.id}: bakgrunnsvideo ikke lastet ned: ${src}`);
    }
    if (!media) {
      const $img = $awb.find("img").first();
      if ($img.length) media = $.html($img);
    }
    if ($layer.length && media) $layer.append(`<div class="demo-awb">${media}</div>`);
    else if (media) problems.push(`${entry.id}: fant ikke raden til en AWB-bakgrunn`);
    $awb.remove();
  }

  // Salient lat-laster bakgrunner via data-attributter som temaets JS setter
  // inn; uten JS må de bli vanlig CSS.
  for (const el of $wrap.find("[data-nectar-img-src]").toArray()) {
    const $el = $(el);
    const local = localAsset($el.attr("data-nectar-img-src"));
    if (local && !$el.is("img")) {
      $el.attr("style", `${$el.attr("style") ?? ""};background-image:url(${local})`.replace(/^;/, ""));
    }
    $el.removeAttr("data-nectar-img-src");
  }
  for (const el of $wrap.find("[style*='url(']").toArray()) {
    const $el = $(el);
    $el.attr("style", rewriteCssUrls($el.attr("style"), entry.id));
  }

  // Kolonner som bare er et bakgrunnsbilde (`data-bg-cover`) får høyden sin
  // av temaets JS, som regner ut bildets høyde ved kolonnebredden. Uten JS
  // er kolonnen tom og bildet usynlig når kolonnene stables på mobil. Bildets
  // sideforhold legges på som CSS-variabel; demo.css bruker det under 1000 px.
  for (const el of $wrap.find('.wpb_column[data-bg-cover="true"]').toArray()) {
    const $col = $(el);
    if ($col.find(".wpb_wrapper").first().text().trim() || $col.find(".wpb_wrapper img").length) continue;
    const bg = /url\(([^)]+)\)/.exec($col.find(".column-image-bg").first().attr("style") ?? "");
    if (!bg) continue;
    const size = await dims(bg[1].replace(/['"]/g, ""));
    if (!size) continue;
    $col.attr("style", `${$col.attr("style") ?? ""};--demo-cover-ratio:${size[0]} / ${size[1]}`.replace(/^;/, ""));
  }

  const placement = config.pages[entry.id]?.placement ?? null;
  if (placement) insertSlot($, $wrap, placement, entry.id);

  return $wrap.html().replace(/\n\s*\n+/g, "\n").trim();
}

/**
 * Setter inn plassholderen for Placy-feltet.
 *
 * Innholdsradene er enten sidens toppnivå-rader (WordPress-sider) eller
 * radene i innleggets `.content-inner` (WordPress-innlegg — flere av
 * byggsidene er innlegg under «Aktuelt»).
 *
 * Byggsider og Beliggenhet: rett etter første innholdsrad, som er
 * byggidentiteten (logo/navn, kort beskrivelse, knapper til boligvelger og
 * prospekt) eller innleggets innledning. Da kommer Placy før de lange
 * salgsdetaljene. Artikler og prosjektsider: foran «Meld din interesse»- og
 * kontaktradene, ellers etter siste innholdsrad — en nøktern videre-lenke.
 */
function insertSlot($, $wrap, placement, id) {
  const marker = `<div data-placy-slot="${placement}"></div>`;
  const postRows = $wrap.find(".post-content .content-inner > .wpb_row");
  const rows = postRows.length
    ? postRows
    : $wrap.find(".main-content > .row > .wpb_row").filter((_, el) => !$(el).parents(".wpb_row").length);
  if (!rows.length) throw new Error(`${id}: ingen innholdsrader å plassere Placy i`);
  if (placement === "building" || placement === "location") {
    rows.first().after(marker);
    return;
  }
  const contact = rows.filter((_, el) => $(el).is("#kontakt") || $(el).find(".demo-form-notice, #kontakt").length > 0).first();
  if (contact.length && contact.prev().length) contact.before(marker);
  else rows.last().after(marker);
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

const registry = { snapshotDate: manifest.checkedAt ?? "2026-09-23", pages: [] };
const fragments = new Map();

for (const entry of localEntries) {
  const settings = config.pages[entry.id] ?? {};
  const page = {
    id: entry.id,
    path: localPath(entry),
    title: settings.title ?? entry.title.replace(/\s*[–|-]\s*Leangenbukta\s*$/i, "").trim(),
    kind: settings.kind ?? entry.kind,
    sourceUrl: entry.sourceUrl,
    ...(settings.boardTopicId ? { boardTopicId: settings.boardTopicId } : {}),
    chatStarters: settings.chatStarters ?? config.defaultStarters[settings.kind ?? entry.kind] ?? [],
  };
  if (entry.id !== "forside" && !config.handwritten.includes(entry.id)) {
    fragments.set(entry.id, await buildFragment(entry));
  }
  registry.pages.push(page);
}
for (const extra of config.extraPages) registry.pages.push(extra);

const missingPlacement = registry.pages.filter((page) => page.kind === "building" && config.pages[page.id]?.placement !== "building");
for (const page of missingPlacement) problems.push(`${page.id}: byggside uten Placy-plassering i pages-config.json`);
for (const id of Object.keys(config.pages)) if (!registry.pages.some((page) => page.id === id)) problems.push(`pages-config.json nevner ukjent side ${id}`);

if (problems.length) {
  console.error(`${problems.length} problem(er):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

if (CHECK) {
  let stale = 0;
  for (const [id, html] of fragments) {
    const file = path.join(OUT_DIR, `${id}.html`);
    if (!fs.existsSync(file) || digest(fs.readFileSync(file, "utf8")) !== digest(html)) stale += 1;
  }
  const current = fs.existsSync(REGISTRY) ? fs.readFileSync(REGISTRY, "utf8") : "";
  if (current !== `${JSON.stringify(registry, null, 2)}\n`) stale += 1;
  if (stale) {
    console.error(`${stale} fil(er) er ikke à jour — kjør byggeskriptet.`);
    process.exit(1);
  }
  console.log(`OK: ${fragments.size} fragmenter og registeret er à jour.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const file of fs.readdirSync(OUT_DIR)) if (!fragments.has(file.replace(/\.html$/, ""))) fs.rmSync(path.join(OUT_DIR, file));
for (const [id, html] of fragments) fs.writeFileSync(path.join(OUT_DIR, `${id}.html`), `${html}\n`);
fs.writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, "data/demo/leangenbukta-nettside/body-attributes.json"), `${JSON.stringify(bodyAttributes, null, 2)}\n`);
fs.writeFileSync(path.join(RESEARCH, "link-report.json"), `${JSON.stringify(linkReport, null, 2)}\n`);
// Oppslagstabellen de håndskrevne filene (forsiden, skallet) er skrevet om etter.
const linkMap = Object.fromEntries(entries.filter((entry) => entry.sourceUrl).map((entry) => [entry.sourceUrl, rewriteHref(entry.sourceUrl, "link-map").href]));
fs.writeFileSync(path.join(RESEARCH, "link-map.json"), `${JSON.stringify(linkMap, null, 2)}\n`);

// Medier inventaret lastet ned, men som ingen side eller stilark bruker
// (typisk ekstra srcset-varianter), slettes: de ville bare gjort repoet og
// utrullingen tyngre. Kjør scope-page-css.mjs FØR dette skriptet.
const referenced = [
  ...fragments.values(),
  fs.readFileSync(path.join(ROOT, "app/demo/leangenbukta-nettside/pages.css"), "utf8"),
  fs.readFileSync(path.join(ROOT, "app/demo/leangenbukta-nettside/page.tsx"), "utf8"),
].join("\n");
let pruned = 0;
for (const file of fs.readdirSync(path.join(PUBLIC_DIR, "pages"))) {
  if (!referenced.includes(`/pages/${file}`)) {
    fs.rmSync(path.join(PUBLIC_DIR, "pages", file));
    pruned += 1;
  }
}
if (pruned) console.log(`${pruned} ubrukte mediefiler slettet fra public/demo/leangenbukta-nettside/pages/.`);

const counts = linkReport.reduce((acc, link) => ({ ...acc, [link.kind]: (acc[link.kind] ?? 0) + 1 }), {});
console.log(`${registry.pages.length} sider i registeret, ${fragments.size} fragmenter bygd. Lenker: ${JSON.stringify(counts)}`);
