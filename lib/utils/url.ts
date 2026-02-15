/**
 * Validate that a URL uses a safe protocol (http/https).
 * Guards against javascript: and other dangerous URL schemes.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
