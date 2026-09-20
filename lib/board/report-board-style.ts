import type { CSSProperties } from "react";

import { hexToHslChannels, pickContrastForeground } from "@/lib/theme-utils";
import type { Project, ReportBrandPresentation } from "@/lib/types";

const FONT_FAMILIES = new Set(["Mukta", "Unbounded", "Figtree"]);
const RADIUS = /^\d+(?:\.\d+)?(?:px|rem)$/;

export type ReportBoardStyle = CSSProperties & Record<`--${string}`, string>;

function safeBrand(project: Project): ReportBrandPresentation | undefined {
  if (!project.reportConfig?.assets?.brand) return undefined;
  const candidate = project.reportConfig.presentation?.brand;
  if (!candidate || typeof candidate !== "object") return undefined;
  return candidate;
}

/**
 * Bygger kun CSS-variabler fra allowlistede verdier. Prosjektets JSONB er ikke
 * runtime-validert av v2-lesestien, så TypeScript-typen alene er ikke en
 * sikkerhetsgrense.
 */
export function buildReportBoardStyle(project: Project): ReportBoardStyle {
  const style = {} as ReportBoardStyle;
  const setColor = (cssVar: `--${string}`, value: unknown) => {
    if (typeof value !== "string") return;
    const channels = hexToHslChannels(value);
    if (channels) style[cssVar] = channels;
  };

  const theme = project.theme;
  if (theme) {
    setColor("--background", theme.backgroundColor);
    setColor("--foreground", theme.foregroundColor);
    setColor("--primary", theme.primaryColor);
    setColor("--primary-foreground", theme.primaryForegroundColor);
    setColor("--card", theme.cardColor);
    setColor("--muted", theme.mutedColor);
    setColor("--muted-foreground", theme.mutedForegroundColor);
    setColor("--border", theme.borderColor);
    if (typeof theme.fontFamily === "string") style["--font-family"] = theme.fontFamily;
    if (theme.primaryColor && !theme.primaryForegroundColor) {
      const foreground = pickContrastForeground(theme.primaryColor);
      if (foreground) style["--primary-foreground"] = foreground;
    }
  }

  const brand = safeBrand(project);
  if (!brand) return style;
  setColor("--background", brand.surfaceColor);
  setColor("--card", brand.surfaceColor);
  setColor("--foreground", brand.inkColor);
  setColor("--primary", brand.accentColor);
  setColor("--primary-foreground", brand.accentForegroundColor);
  setColor("--muted", brand.mutedColor);
  setColor("--muted-foreground", brand.mutedForegroundColor);
  if (typeof brand.radius === "string" && RADIUS.test(brand.radius)) {
    style["--radius"] = brand.radius;
  }
  if (
    typeof brand.headingFontFamily === "string" &&
    FONT_FAMILIES.has(brand.headingFontFamily)
  ) {
    style["--board-heading-font"] = brand.headingFontFamily;
  }
  if (
    typeof brand.headingFontWeight === "number" &&
    Number.isInteger(brand.headingFontWeight) &&
    brand.headingFontWeight >= 100 &&
    brand.headingFontWeight <= 900
  ) {
    style["--board-heading-weight"] = String(brand.headingFontWeight);
  }
  return style;
}
