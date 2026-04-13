/**
 * Convert a hex color to space-separated HSL channel values.
 *
 * Returns e.g. "217 91% 60%" from "#3b82f6", matching the shadcn/ui token
 * format where --primary etc. are stored as channel values so Tailwind can
 * wrap them in `hsl(var(--primary) / <alpha-value>)` for opacity modifiers.
 *
 * Returns null for invalid input — never throws.
 */
export function hexToHslChannels(hex: string | null | undefined): string | null {
  if (!hex || typeof hex !== "string") return null;

  let normalized = hex.trim().replace(/^#/, "");

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
}
