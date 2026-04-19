/**
 * Pre-prompt sanitering av Gemini-narrative før Claude får lov å se den.
 *
 * Beskytter mot prompt-injection ved å strippe:
 * - Markdown-lenker (Claude re-adder kun poi:-lenker)
 * - Kontroll-tegn og zero-width chars
 * - RTL-overrides og non-printable Unicode
 *
 * DoS-beskyttelse via hard length-cap på input.
 */

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

// Unicode-kategorier å strippe:
// - U+0000-U+001F: kontroll-tegn (unntatt \n, \t)
// - U+200B-U+200F: zero-width chars + RTL/LTR-overrides
// - U+202A-U+202E: embedding/override
// - U+2060-U+206F: word joiner + invisible separators
// - U+FEFF: byte-order-mark
const DANGEROUS_CHARS_RE =
  /[\u0000-\u0008\u000B-\u001F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

export interface SanitizeOptions {
  /** Maks input-lengde (DoS-beskyttelse). Default 3000. */
  maxLength?: number;
}

export interface SanitizeResult {
  sanitized: string;
  strippedLinks: number;
  strippedChars: number;
  truncated: boolean;
}

/**
 * Strip markdown-lenker, kontroll-chars, og trunkér til maks-lengde.
 */
export function sanitizeGeminiInput(
  input: string,
  opts: SanitizeOptions = {},
): SanitizeResult {
  const { maxLength = 3000 } = opts;

  // 1. Strip markdown-lenker (behold linktekst)
  let strippedLinks = 0;
  let result = input.replace(MARKDOWN_LINK_RE, (_, text) => {
    strippedLinks += 1;
    return text;
  });

  // 2. Strip farlige unicode-chars
  const beforeCharStrip = result.length;
  result = result.replace(DANGEROUS_CHARS_RE, "");
  const strippedChars = beforeCharStrip - result.length;

  // 3. Trunkér
  let truncated = false;
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
    truncated = true;
  }

  return {
    sanitized: result,
    strippedLinks,
    strippedChars,
    truncated,
  };
}
