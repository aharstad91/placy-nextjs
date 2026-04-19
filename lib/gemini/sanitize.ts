/**
 * DOMPurify-wrapper for Google grounding searchEntryPoint.renderedContent.
 *
 * Google ToS krever verbatim rendering av denne HTML-en (inkl. inline CSS),
 * men vi stoler ikke på at Google alltid leverer "safe" HTML. Sanitizer med
 * strikt whitelist som bevarer styling men blokkerer script/iframe/handlers.
 *
 * Kjøres server-side (build-time) før lagring til Supabase — resultatet er
 * trygt å sende til `dangerouslySetInnerHTML` senere.
 */

import DOMPurify from "isomorphic-dompurify";

const SEARCH_ENTRY_POINT_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  // Tag-whitelist: kun det Google trenger for chip-carousel + styling.
  ALLOWED_TAGS: ["style", "div", "a", "span"],
  ALLOWED_ATTR: ["class", "href", "target", "rel", "style"],
  // DOMPurify stripper 'style'/'target' by default; ADD_*-hooks tvinger whitelist.
  ADD_TAGS: ["style"],
  ADD_ATTR: ["target"],
  // <style> uten FORCE_BODY flyttes til <head> og strippes.
  FORCE_BODY: true,
  // Bare http(s)-skjemaer er lovlige hrefs. Blokkerer javascript:/data:.
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus", "onblur"],
  // Ikke konverter til DocumentFragment — vi vil ha ren HTML-streng tilbake.
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

export function sanitizeSearchEntryPointHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  const cleaned = DOMPurify.sanitize(html, SEARCH_ENTRY_POINT_CONFIG);
  return typeof cleaned === "string" ? cleaned : String(cleaned);
}
