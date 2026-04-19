---
title: "Inline Staged-Animation Reveal Button"
category: ui-patterns
tags: [ux-pattern, progressive-disclosure, micro-interaction, state-machine, fake-loading, tailwind-animate, dynamic-import]
module: report
date: 2026-04-18
symptom: "Ekstra innhold tilgjengelig men server-rendret i DOM — hvordan avsløre det uten å bruke drawer/modal som bryter lesetråden?"
root_cause: "Drawer/sheet-mønstre tvinger brukeren til kontekstbytte. Når innhold logisk tilhører en seksjon, bør det leve der — med kontrollert, opt-in reveal."
---

# Inline Staged-Animation Reveal Button

## Problem

Rapport-produktet hadde Gemini-grounded innhold (narrativ + kilder + Google-
attribusjon) per kategori. Første iterasjon la dette i en Sheet-drawer som
skled inn fra høyre ved klikk på "Utdyp med Google AI".

Brukeren flagget at dette var feil:
- Drawer tok leseren ut av rapport-flow'en
- Innholdet tilhørte kategorien, ikke et separat overlay
- Kontekstbytte (eksplicit open → close) brøt lesetråden
- Gemini-narrative var god nok til å stå som "del av rapporten", ikke som tillegg

## Environment

- Module: `components/variants/report/` (Report-produkt)
- Stack: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, `tailwindcss-animate`
- Related: `ReportGroundingInline.tsx`, brukes i `ReportThemeSection.tsx`
- Date: 2026-04-18

## Solution: Inline Staged-Reveal

Tre-fase state-maskin med teatralsk loading-pause, fade-in der knappen stod, og
kollaps-mulighet:

```tsx
type ViewState = "idle" | "loading" | "expanded";

export default function InlineStagedReveal({ data }: Props) {
  const [state, setState] = useState<ViewState>("idle");

  function handleExpand() {
    setState("loading");
    // Theatre-pause: data er allerede i DOM. ~1s "fake fetch" gir brukeren
    // tid til å oppfatte at noe hentes og forstå at klikket hadde effekt.
    setTimeout(() => setState("expanded"), 1000);
  }

  if (state === "idle") {
    return (
      <button onClick={handleExpand} className="pill-button">
        <Icon /> Utdyp med Google AI
      </button>
    );
  }

  if (state === "loading") {
    return (
      <button disabled aria-busy="true" className="pill-button animate-pulse">
        <Spinner className="animate-spin" /> Henter utdyping…
      </button>
    );
  }

  // state === "expanded"
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="attribution-header"><GoogleGLogo /> Utdyping fra Google AI</div>
      <ProseContent data={data} />
      <Sources sources={data.sources} />
      <button onClick={() => setState("idle")} className="collapse-link">
        Skjul utdyping
      </button>
    </div>
  );
}
```

### Hvorfor hver fase teller

1. **`idle`**: Knappen er tydelig men diskret. Leseren velger om de vil se mer.
2. **`loading`**: Teateret. Data er allerede i DOM (server-rendret som hidden eller
   lazy-importert). Men den ~1s pausen gir brukeren:
   - **Agens** — de ba om utdyping, og de får det
   - **Forventning** — spinneren signaliserer at det tar tid å hente
   - **Verdi-oppfatning** — innhold som vises umiddelbart føles gratis;
     innhold som "hentes" føles som noe med substans
3. **`expanded`**: Fade-in fra bunn gjør at innholdet "vokser" naturlig fra der
   knappen stod. Ingen hopp, ingen overlay, bare rapport-kroppen som utvider seg.

### Typografi-integrasjon

Nøkkel: utvidet innhold må matche *nøyaktig* stylingen til paragrafene rundt.
Ellers føles det fortsatt som et tillegg.

```tsx
{/* Match surrounding text EKSAKT — ikke bruk prose-sm eller andre "variant"-klasser */}
<div className="text-base md:text-lg text-[#4a4a4a] leading-[1.8] [&>p]:mb-5 [&>p:last-child]:mb-0">
  <ReactMarkdown>{narrative}</ReactMarkdown>
</div>
```

- `[&>p]:mb-5` gir eksplisitt avsnitts-spacing mellom react-markdown's
  genererte `<p>`-elementer (fra `\n\n` i markdown)
- `[&>p:last-child]:mb-0` forhindrer dobbel margin før neste seksjon
- Font-size/farge/line-height kopieres 1:1 fra surrounding text

## Prevention / Best Practices

### Når bruke dette mønsteret

- Innhold som *utvider* den omkringliggende seksjonen (ikke tilhører separat scope)
- Innhold som er verdifullt men ikke alle trenger
- Data som allerede er tilgjengelig (DOM eller state) — ingen reell fetch
- Progressive disclosure som skal føles "innebygd", ikke "eksternt"

### Når IKKE bruke

- Faktisk asynk operasjon (bruk real spinner + error handling)
- Modalt innhold som krever fokus/navigasjon (bruk drawer/dialog)
- Innhold som logisk hører til separat kontekst (egen side / sheet)

### Anti-patterns å unngå

1. **Drawer/sheet når innhold tilhører seksjonen** — bryter lese-flow
2. **`prose` eller `prose-sm`-klasser som endrer font-størrelse** — bryter visuell
   integrasjon. Kopier surrounding styling eksakt.
3. **Ingen theatre-pause** — umiddelbar reveal føles som en teknisk glitch, ikke
   som et svar på klikket. Bruk 800-1200ms selv om data er inline.
4. **Glemme kollaps-knapp** — brukeren må kunne gå tilbake til ren lesemodus
5. **Animate-from-top når innholdet kommer under knappen** — bruk
   `slide-in-from-bottom-2` så innholdet føles som utvekst fra der knappen var

### Bundle-splitting

Hvis utvidet-state bruker tunge avhengigheter (react-markdown, chart-libs):

```tsx
// Dynamic-import hele komponenten så dependencies holdes ute av main chunk.
// ssr: default — knappen rendres server-side, expanded-state kun client.
const InlineStagedReveal = dynamic(() => import("./InlineStagedReveal"));
```

Knappen serveres i initial HTML (SEO + first paint), expanded-content hydrerer
kun hvis bruker klikker.

## Relaterte mønstre

- **Load-more-knapp** (GuideMapLayout.tsx): enkel toggle uten loading-state. Bruk
  når ekstra data er synlig umiddelbart uten forventning om "arbeid".
- **Accordion** (UI primitive): når innhold skal ekspandere/kollapse uten
  theatre-pause. Mindre dramatisk, raskere for gjenbruk.
- **Drawer/Sheet** (radix-ui): når innhold tilhører separat kontekst eller
  trenger full fokus/scroll.

## References

- Komponent: `components/variants/report/ReportGroundingInline.tsx`
- Brukt i: `components/variants/report/ReportThemeSection.tsx`
- Relatert pattern: `components/guide/GuideMapLayout.tsx:138` (Load-more uten staging)
- Grounding-context: `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`
- Plan: `docs/plans/2026-04-18-feat-gemini-grounding-rapport-plan.md`
- `tailwindcss-animate`: `animate-in fade-in slide-in-from-bottom-2 duration-500`
