/**
 * Centralized URL helpers for the /eiendom/ route structure.
 * All eiendom paths should use these helpers — never hardcode paths inline.
 */

export function eiendomUrl(
  customer: string,
  slug: string,
  mode?: "rapport" | "visning"
) {
  const base = `/eiendom/${customer}/${slug}`;
  return mode ? `${base}/${mode}` : base;
}

export function eiendomGenererUrl() {
  return "/eiendom/generer";
}

export function eiendomTekstUrl() {
  return "/eiendom/tekst";
}
