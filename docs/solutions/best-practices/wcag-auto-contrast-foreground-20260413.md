---
title: "WCAG auto-contrast: sRGB-linearisering + kontrast-ratio-sammenligning"
category: best-practices
tags: [wcag, accessibility, contrast, theme, luminance, whitelabel]
module: theme-utils
created: 2026-04-13
---

# WCAG auto-contrast for whitelabel-farger

**Gjelder:** Hver gang tekstfarge skal velges automatisk basert på kundens primærfarge (header, CTA-knapper, badges, etc.).

## Problem

Naiv luminance-formel:

```typescript
// ❌ FEIL — Rec. 601 luma, opererer på gamma-komprimerte verdier
const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
```

Dette er gamle TV-standarden (Rec. 601), IKKE sRGB. Den **feil-klassifiserer mid-tones**:

| Farge | Naiv formel | WCAG-korrekt |
|-------|-------------|--------------|
| `#808080` (grå) | 0.50 | 0.22 |
| `#204c4c` (mørk teal) | 0.27 | 0.04 |
| `#808080` feilklassifiseres som "lys", men er faktisk mørk | | |

En fast luminance-terskel (f.eks. 0.5) gir dårlige valg for brand-farger i "danger zone" (luminance 0.15–0.22).

## Løsning

To prinsipper:

### 1. WCAG 2.1 sRGB-linearisering

```typescript
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  // ITU-R BT.709-koeffisienter (IKKE Rec. 601 — viktig!)
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}
```

Koeffisientene er 0.2126/0.7152/0.0722 (BT.709), ikke 0.299/0.587/0.114 (601).

### 2. Kontrast-ratio mot begge kandidater, ikke fast terskel

```typescript
const SOFT_WHITE_LUMINANCE = 0.955; // #fafafa
const SOFT_BLACK_LUMINANCE = 0.008; // #1a1a1a

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function pickContrastForeground(bgHex: string): string {
  const L = relativeLuminance(...hexToRgb(bgHex));
  const whiteContrast = contrastRatio(SOFT_WHITE_LUMINANCE, L);
  const blackContrast = contrastRatio(L, SOFT_BLACK_LUMINANCE);
  return whiteContrast >= blackContrast ? SOFT_WHITE : SOFT_BLACK;
}
```

Dette tilsvarer en effektiv terskel rundt luminance 0.18, men beregnet dynamisk — bedre for mid-tone brand-farger.

## Hvorfor soft-white/soft-black, ikke rent svart/hvit

- `#ffffff` på farget bakgrunn = glare
- `#000000` på farget bakgrunn = hard "trykt" følelse
- `#fafafa` (soft-white) + `#1a1a1a` (soft-black) gir 17.4:1 kontrast (WCAG AAA) og ser mye bedre ut
- Stripe, Radix, Tailwind bruker alle soft-varianter

## Dev-warning for problem-farger

```typescript
if (process.env.NODE_ENV === "development") {
  const best = Math.max(whiteContrast, blackContrast);
  if (best < 4.5) {
    console.warn(
      `[theme] Lav kontrast (${best.toFixed(2)}:1) for ${bgHex} — under WCAG AA for liten tekst`
    );
  }
}
```

Fanger "danger zone"-farger (luminance 0.15–0.22) under utvikling, gir kundene insentiv til å velge bedre primary-farger.

## WCAG AA-krav oppsummert

| Tekststørrelse | AA-krav |
|----------------|---------|
| Liten (<24px normal, <19px bold) | 4.5:1 |
| Stor (≥24px normal, ≥19px bold) | 3.0:1 |

For header med 18px bold tekst: 3.0:1 holder. Men algoritmen streber etter maks kontrast uansett.

## Eksempler fra Placy

- **Wesselsløkka teal `#204c4c`** → luminance 0.044 → white wins med 13.0:1 ✓ AAA
- **Cream `#f7f4ec`** → luminance 0.90 → black wins med 16.4:1 ✓ AAA
- **Problemfarge dempet grønn `#5c8a4f`** → luminance 0.178 → black vinner, men knapt 4.2:1 (AA fail for liten tekst)

## Implementering

Se `lib/theme-utils.ts` — `computeLuminance` og `pickContrastForeground`.

## Kilder

- [WCAG 2.1 §1.4.3](https://www.w3.org/TR/WCAG21/#contrast-minimum) (relative luminance definisjon)
- [Polished.js readableColor](https://polished.js.org/docs/#readablecolor) (samme pattern)
- Chroma.js contrast-helpere
