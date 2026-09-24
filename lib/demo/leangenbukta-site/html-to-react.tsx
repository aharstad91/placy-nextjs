import "server-only";

import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { load } from "cheerio";
import type { AnyNode, Element } from "domhandler";

/**
 * Gjør et ferdig renset sidefragment fra kundens nettsted om til React (2026-09-23).
 *
 * ## Hvorfor ikke `dangerouslySetInnerHTML`
 *
 * Fragmentene er kundens WordPress-markup, renset av
 * `scripts/demo/leangenbukta-site/build-pages.mjs`: skript, stilark,
 * `on*`-handlere og skjema-innsending er fjernet, lenker og medier er skrevet om
 * til lokale stier. Likevel rendres de som React-elementer og ikke som rå HTML:
 * bilder blir `next/image` (prosjektregel), interne lenker blir `next/link`
 * (klientnavigasjon innenfor kopien), og Placy-feltene settes inn som ekte
 * komponenter på plassholderne `<div data-placy-slot="…">`. Et fragment kan
 * derfor aldri kjøre egen kode, uansett hva kilden inneholdt.
 *
 * Konverteringen skjer på serveren ved bygging; cheerio når aldri klienten.
 */

const VOID = new Set(["area", "br", "col", "hr", "img", "input", "source", "track", "wbr"]);
/** Elementer som aldri skal rendres, selv om byggeskriptet skulle ha sluppet dem gjennom. */
const DROP = new Set(["script", "style", "link", "meta", "noscript", "iframe", "object", "embed", "base", "form", "template"]);

const ATTR = new Map<string, string>([
  ["class", "className"], ["for", "htmlFor"], ["tabindex", "tabIndex"], ["colspan", "colSpan"],
  ["rowspan", "rowSpan"], ["maxlength", "maxLength"], ["readonly", "readOnly"],
  ["autocomplete", "autoComplete"], ["crossorigin", "crossOrigin"], ["playsinline", "playsInline"],
  ["autoplay", "autoPlay"], ["datetime", "dateTime"], ["srcset", "srcSet"], ["viewbox", "viewBox"],
  ["preserveaspectratio", "preserveAspectRatio"], ["fill-rule", "fillRule"], ["clip-rule", "clipRule"],
  ["stroke-width", "strokeWidth"], ["stroke-linecap", "strokeLinecap"], ["stroke-linejoin", "strokeLinejoin"],
  ["stroke-miterlimit", "strokeMiterlimit"], ["xlink:href", "xlinkHref"], ["xmlns:xlink", "xmlnsXlink"],
  ["frameborder", "frameBorder"], ["allowfullscreen", "allowFullScreen"], ["cellpadding", "cellPadding"],
  ["cellspacing", "cellSpacing"], ["referrerpolicy", "referrerPolicy"], ["itemprop", "itemProp"],
  ["itemscope", "itemScope"], ["itemtype", "itemType"],
]);
const BOOLEAN = new Set(["controls", "muted", "loop", "autoPlay", "playsInline", "disabled", "checked", "hidden", "itemScope", "readOnly", "allowFullScreen"]);

export type PlacySlots = Record<string, ReactNode>;

function styleObject(value: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of value.split(";")) {
    const index = declaration.indexOf(":");
    if (index < 0) continue;
    const property = declaration.slice(0, index).trim();
    const val = declaration.slice(index + 1).trim();
    if (!property || !val || /expression\(|javascript:|url\(\s*['"]?\s*(?!\/)/i.test(val)) continue;
    const key = property.startsWith("--")
      ? property
      : property.toLowerCase().replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = val;
  }
  return style as CSSProperties;
}

/** Bare lokale stier, ankere, e-post, telefon og vanlige nettadresser kan bli lenker. */
function safeHref(href: string): string | null {
  if (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//"))) return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return null;
}

function props(element: Element, key: string): Record<string, unknown> {
  const out: Record<string, unknown> = { key };
  for (const [rawName, rawValue] of Object.entries(element.attribs)) {
    const name = rawName.toLowerCase();
    if (name.startsWith("on") || name === "srcset" || name === "sizes") continue;
    if (name === "style") {
      out.style = styleObject(rawValue);
      continue;
    }
    const reactName = ATTR.get(name) ?? name;
    if (BOOLEAN.has(reactName)) {
      out[reactName] = true;
      continue;
    }
    out[reactName] = rawValue;
  }
  return out;
}

function renderImage(element: Element, key: string): ReactNode {
  const { src, alt = "", width, height } = element.attribs;
  // Byggeskriptet har skrevet om hver `src` til en lokal fil og lest målene
  // fra den; et bilde uten det har ingen trygg kilde og rendres ikke.
  if (!src || !src.startsWith("/") || src.startsWith("//")) return null;
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const rest = props(element, key);
  delete rest.key;
  delete rest.src;
  delete rest.alt;
  delete rest.width;
  delete rest.height;
  delete rest.loading;
  delete rest.decoding;
  delete rest.fetchpriority;
  return <Image {...rest} key={key} src={src} alt={alt} width={w} height={h} unoptimized={src.endsWith(".svg") || src.endsWith(".gif")} />;
}

function renderNodes(nodes: AnyNode[], slots: PlacySlots, path: string): ReactNode[] {
  return nodes.map((node, index) => renderNode(node, slots, `${path}.${index}`));
}

function renderNode(node: AnyNode, slots: PlacySlots, key: string): ReactNode {
  if (node.type === "text") return (node as unknown as { data: string }).data;
  if (node.type !== "tag") return null;
  const element = node as Element;
  const tag = element.name.toLowerCase();
  if (DROP.has(tag)) return null;

  const slot = element.attribs["data-placy-slot"];
  if (slot !== undefined) return <Fragment key={key}>{slots[slot] ?? null}</Fragment>;

  if (tag === "img") return renderImage(element, key);

  const children = renderNodes(element.children, slots, key);

  if (tag === "a") {
    const href = element.attribs.href ? safeHref(element.attribs.href) : null;
    const rest = props(element, key);
    delete rest.key;
    delete rest.href;
    if (!href) return <span key={key} {...(rest as Record<string, string>)}>{children}</span>;
    // Interne sider navigerer i kopien; alt annet forlater den synlig.
    if (href.startsWith("/demo/")) {
      return <Link {...(rest as Record<string, string>)} key={key} href={href}>{children}</Link>;
    }
    return (
      <a key={key} {...(rest as Record<string, string>)} href={href}>
        {children}
      </a>
    );
  }

  return VOID.has(tag) ? createElement(tag, props(element, key)) : createElement(tag, props(element, key), ...children);
}

export function renderSiteFragment(html: string, slots: PlacySlots = {}): ReactNode {
  const $ = load(html, null, false);
  return <>{renderNodes($.root().contents().toArray(), slots, "f")}</>;
}
