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

// === Auto-contrast foreground ===
//
// WCAG 2.1 relative luminance + contrast-ratio-sammenligning for å velge
// lesbar tekst-farge mot kundens primary-bakgrunn. Bruker ITU-R BT.709
// koeffisienter og sRGB-linearisering (ikke naive weighted sum — feil-
// klassifiserer mid-tones).

/** Soft-white foreground. HSL channels for #fafafa. Luminance ≈ 0.955. */
const SOFT_WHITE_CHANNELS = "0 0% 98%";
/** Soft-black foreground. HSL channels for #1a1a1a. Luminance ≈ 0.008. */
const SOFT_BLACK_CHANNELS = "0 0% 10%";

const SOFT_WHITE_LUMINANCE = 0.955;
const SOFT_BLACK_LUMINANCE = 0.008;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.1 relative luminance (0 = sort, 1 = hvit).
 * Returnerer null for ugyldig input — aldri kaster.
 */
export function computeLuminance(hex: string | null | undefined): number | null {
  if (!hex || typeof hex !== "string") return null;

  let normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    normalized = normalized.split("").map((c) => c + c).join("");
  }
  if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Velger soft-white eller soft-black basert på hvilken gir høyest kontrast
 * mot bg-fargen. Returnerer HSL-channels-streng (brukes som
 * `hsl(var(--x))` i Tailwind).
 *
 * I dev-mode: warning hvis beste kontrast < 4.5:1 (WCAG AA liten tekst).
 * Returnerer null for ugyldig input.
 */
export function pickContrastForeground(bgHex: string | null | undefined): string | null {
  const L = computeLuminance(bgHex);
  if (L === null) return null;

  const whiteContrast = contrastRatio(SOFT_WHITE_LUMINANCE, L);
  const blackContrast = contrastRatio(L, SOFT_BLACK_LUMINANCE);

  if (process.env.NODE_ENV === "development") {
    const best = Math.max(whiteContrast, blackContrast);
    if (best < 4.5) {
      console.warn(
        `[theme] Lav kontrast (${best.toFixed(2)}:1) for bg=${bgHex} — under WCAG AA for liten tekst. Vurder å sette primaryForegroundColor eksplisitt.`
      );
    }
  }

  return whiteContrast >= blackContrast ? SOFT_WHITE_CHANNELS : SOFT_BLACK_CHANNELS;
}

/**
 * Stripper protokoll, `www.` og sti fra URL for visning.
 * Returnerer null for ugyldig/manglende URL (inkl. schemes som javascript:).
 *
 * Eks: "https://www.wesselslokka.no/" → "wesselslokka.no"
 */
export function displayDomain(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.includes(".")) return null;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    // Defense in depth: kun http(s) — DB CHECK blokkerer allerede, men sjekk igjen
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Normaliserer URL for bruk som href — sikrer protokoll-prefix.
 * Returnerer null for ugyldig URL (samme validering som displayDomain).
 */
export function safeHref(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.includes(".")) return null;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
