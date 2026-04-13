---
title: "Apple-style to-tone emphasis via markdown-parsing i innhold"
category: ui-patterns
tags: [typography, apple-style, emphasis, markdown, editorial, content-ui]
module: report
created: 2026-04-13
---

# Apple-style two-tone emphasis

**Gjelder:** Editorial/content-tung UI hvor forfatteren må kunne signalere hvilken del av teksten som skal fremheves — uten å endre kode per innholdsbit.

## Problem

Flat intro-tekst gir ingen visuell rytme:

```
Brøset er godt koblet — hverdagsmobilitet på gangavstand og regional
tilgjengelighet innen kort rekkevidde.
```

Leser må lese alt likt — ingen signaler om "hvor landet hovedpåstanden". Apple product pages løser dette med **mørk emphasis på kjerneclaim + lys supporting detail**:

> **18MP Center Stage-frontkamera.** Det skaper et helt nytt bilde.

Men i content-drevne UIer (CMS, database-lagret tekst) kan du ikke hardkode `<strong>`-tags — forfatteren må kunne signalere emphasis uten å skrive kode.

## Løsning: Parse `**markdown**` fra innhold i render

### Shared utility

`lib/utils/render-emphasized-text.tsx`:

```tsx
import React from "react";

/**
 * Apple-style two-tone emphasis: **phrase** in source text → darker/weighted span.
 * Surrounding text inherits parent color (usually softer).
 *
 * Usage in content: "**Short claim.** Supporting detail here."
 */
export function renderEmphasizedText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} className="text-[#1a1a1a] font-medium">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
```

### Bruk i komponent

```tsx
<p className="text-xl md:text-2xl text-[#6a6a6a] leading-snug tracking-tight">
  {renderEmphasizedText(theme.bridgeText)}
</p>
```

### Innholdet

```
**Brøset er godt koblet.** Hverdagsmobilitet på gangavstand og regional
tilgjengelighet innen kort rekkevidde. Buss, bysykkel og bildeling gjør
bilen til et valg — ikke en nødvendighet.
```

Renderes som:
- **"Brøset er godt koblet."** → text-[#1a1a1a] font-medium
- "Hverdagsmobilitet på gangavstand..." → arver parent-farge (#6a6a6a)
- Andre setning → samme som første (lysere)

## Hvorfor dette fungerer

- **Forfatterstyrt** — redaktør skriver `**foo**` der emphasis hører hjemme, uten kode
- **Render-time** — ingen pre-processing, ingen HTML-lagring i DB
- **CSS-drevet** — tomme font-family endringer, bare font-weight + color
- **Skalerbart** — samme util på tvers av komponenter (hero, kategori-seksjon, card, etc.)

## Writing pattern

**Apple-rytme:** Konfident påstand → mykere utdyping.

```
**Short confident claim.** Supporting detail goes here, which may span
one or two sentences and provides the concrete facts behind the claim.
```

### Anti-patterns

- ❌ Fordel mange **bolds** i én setning → mister fokus
- ❌ Bold hele setninger → tilbake til flat tekst
- ❌ Bold bare enkeltord midt i setning → føles merkelig ryddet
- ❌ Bold etter komma istedenfor punktum → bryter rytmen

## Typografi-støtte

For best effekt, paring med:
- **Leading**: `leading-snug` (1.375) eller `leading-tight` (1.25)
- **Tracking**: `tracking-tight` på både heading og body
- **Base color**: `#6a6a6a` (medium grey) for surrounding text
- **Emphasis color**: `#1a1a1a` (near-black, ikke pure black)
- **Emphasis weight**: `font-medium` (500) — ikke `font-bold` (700), for subtil differensiering
- **Font size**: minst `text-xl md:text-2xl` — effekten tapes på liten tekst

## Hvor brukt i Placy

- `ReportHero.tsx` — `heroIntro` for hovedkategorien
- `ReportThemeSection.tsx` — `bridgeText` per kategori (7 bruk per rapport)
- Potensielt: summary, POI-beskrivelser, CTA-tekst

## Content-migration for eksisterende tekst

Legg emphasis inn via SQL-migration for prod-data:

```sql
UPDATE products SET config = jsonb_set(config,
  '{reportConfig,heroIntro}',
  '"Wesselsløkka ligger... noe som gjør dette til **byens mest gjennomtenkte nabolag** for de..."'::jsonb
) WHERE id = '...';
```

Se `supabase/migrations/062_...`, `063_...`, `064_...` for faktiske eksempler.

## Relatert

- Pattern inspirert av Apple product pages (iPhone-feature-sider, Mac Pro, etc.)
- Kombinerer godt med typografi-hierarki: hero-heading → two-tone intro → body
