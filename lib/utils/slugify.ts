/**
 * Canonical slugify with explicit Norwegian character handling.
 * CRITICAL: æ/ø/å replacements MUST happen BEFORE NFD normalization,
 * because NFD decomposes æ to "a" + combining char (losing the "e").
 */
export function slugify(text: string, maxLength = 63): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
