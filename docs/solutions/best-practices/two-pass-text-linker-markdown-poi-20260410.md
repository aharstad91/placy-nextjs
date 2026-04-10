---
module: Report
date: 2026-04-10
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Regex POI-matching korrupterer markdown [text](url) lenker i narrativtekst"
  - "POI-navn inside markdown-lenker blir dobbelt-wrappet eller lenkestrukturen brekker"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [text-processing, regex, markdown, poi-matching, narrative, external-links]
---

# Best Practice: To-pass text-linker for markdown + POI-matching

## Problem

Narrativtekster i Report inneholder to typer inline-elementer som skal rendres:
1. **POI-navn** (`"Trondheim Bysykkel"`) → klikk åpner POI-kortdetaljer
2. **Markdown-lenker** (`[Trondheim Bysykkel](https://trondheimbysykkel.no)`) → ekstern URL

Naiv regex-basert POI-matching behandler hele teksten som én streng. Når teksten inneholder `[Trondheim Bysykkel](https://trondheimbysykkel.no)` vil regex matche `"Trondheim Bysykkel"` inne i markdown-lenken og wrappe den med POI-komponent-markup — noe som bryter lenkestrukturen.

## Environment

- Module: Report (narrativtekster i `ReportThemeSection.tsx`)
- Fil: `lib/utils/story-text-linker.ts`
- Date: 2026-04-10

## Symptoms

- Eksterne markdown-lenker `[text](url)` brutt eller dobbelt-wrappet
- POI-ikon dukker opp inni det som skulle vært en ren ekstern lenke
- Lenke-URL forsvinner fra rendered output

## What Didn't Work

**Direct solution:** Mønsteret ble identifisert og fikset i én runde ved design av to-pass-arkitekturen.

## Solution

**To-pass-strategi:**

**Pass 1** — splitt teksten på markdown-lenker `[text](url)` og returner `TextSegment[]` med `type: "external"`:

```typescript
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function splitMarkdownLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  MARKDOWN_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MARKDOWN_LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "external", content: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}
```

**Pass 2** — POI-match kun segmenter med `type: "text"`, la `type: "external"` passere uberørt:

```typescript
export function linkPOIsInText(text: string, pois: POI[]): TextSegment[] {
  const withExternals = splitMarkdownLinks(text); // Pass 1

  if (pois.length === 0) return withExternals;

  // Bygg POI-lookup, longest-first for å unngå delvise matcher
  const pattern = buildPOIPattern(pois);

  const result: TextSegment[] = [];
  for (const seg of withExternals) {
    if (seg.type !== "text") {
      result.push(seg); // ekstern lenke — uberørt
      continue;
    }
    // POI-match kun plaintext-segmenter
    result.push(...matchPOIsInSegment(seg.content, pattern, poiByName, matched));
  }
  return result;
}
```

**TextSegment-type med `"external"`:**
```typescript
export interface TextSegment {
  type: "text" | "poi" | "external";
  content: string;
  poi?: POI;
  url?: string;
}
```

**Rendering i `ReportThemeSection.tsx`:**
```tsx
{segments.map((seg, i) => {
  if (seg.type === "poi") return <POIInlineLink key={i} poi={seg.poi!} content={seg.content} />;
  if (seg.type === "external") return <ExternalInlineLink key={i} content={seg.content} url={seg.url!} />;
  return <span key={i}>{seg.content}</span>;
})}
```

`ExternalInlineLink` ruter videre til `GoogleAIInlineLink` (Popover med Sparkles-ikon) når URL inneholder `google.com/search`.

## Why This Works

Markdown-lenker og POI-navn er overlappende domener — et POI-navn kan dukke opp i display-teksten i en markdown-lenke. Å gjøre ett pass med én regex over hele teksten kan ikke skille mellom de to kontekstene. To-pass-strategien serialiserer problemet: Pass 1 beskytter markdown-lenker ved å gjøre dem til atomare segmenter, deretter får Pass 2 aldri se noe annet enn ren plaintext.

## Prevention

- Legg alltid `MARKDOWN_LINK_RE.lastIndex = 0` før løkker — global regex med stateful lastIndex gir off-by-one ved gjenbruk
- Gjør markdown-splitting **før** enhver teksttransformasjon som bruker regex over hele teksten
- Bruk `type: "external"` som en "no-touch"-markering — all rendering downstream respekterer dette
- Test med tekst der POI-navn og ekstern lenke-display-tekst er identiske (f.eks. `[Trondheim Bysykkel](url)` + POI som heter "Trondheim Bysykkel")

## Related Issues

- Se også: [inline-poi-kortsystem-5-varianter-20260408.md](../feature-implementations/inline-poi-kortsystem-5-varianter-20260408.md) — POI inline-komponent-varianter
