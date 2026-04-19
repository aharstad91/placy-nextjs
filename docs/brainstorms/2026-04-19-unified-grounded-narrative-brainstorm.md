---
date: 2026-04-19
topic: unified-grounded-narrative
related: docs/brainstorms/2026-04-18-gemini-grounding-rapport-brainstorm.md
---

# Unified Grounded Narrative — Claude-kuratert Gemini-data med POI-inline

## Bakgrunn

Etter implementering av Gemini-grounding (se forrige brainstorm + pattern-doc
`docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`) er
UX-en: to adskilte tekstblokker per tema — Placy's `lowerNarrative` øverst,
"Utdyp med Google AI"-knapp, deretter Gemini's raw narrative.

**Problemer observert:**
1. To tekster om samme tema leses som repetisjon — bryter rød tråd
2. Placy-tekst har POI-inline-lenker (chips med bilde + hover-card). Gemini-tekst
   har ingen inline-lenker — ser "fattigere" ut
3. Lengde-kontroll på Gemini er vanskelig (prompt-iterasjoner: 1 avsnitt → 6
   avsnitt → 2–3 avsnitt). Stil matcher ikke alltid Placy
4. Placy-tekst er ~20% kortere enn optimalt (henger igjen fra tidligere iterasjon)

## Beslutning: Én tekst, Claude kuraterer begge deler

I stedet for to adskilte tekster, la Claude (via `/generate-rapport`-skillet)
kuratere **én unified tekst per tema** som kombinerer:

- Placy's stemme og editorial perspektiv
- Gemini's grounded fakta (kun fakta som finnes i `grounding.narrative` + `sources`)
- POI-inline-lenker fra prosjektets POI-set

## Arkitektur

```
Steg 2.5 (eksisterer):
  gemini-grounding.ts → lagrer grounding.narrative (raw Gemini), sources,
                        searchEntryPointHtml, webSearchQueries

Steg 2.7 (NYTT — i /generate-rapport-skillet):
  Input:
    - grounding.narrative (Gemini's raw output)
    - grounding.sources (for å vite hvilke fakta er grunnet)
    - Prosjektets POI-set (for POI-inline-matching)
    - Placy-kontekst (venue_type, tema-konfig)
  Output:
    - grounding.curatedNarrative — én unified markdown-tekst
      med POI-inline-lenker [Byhaven](poi:uuid-xxx)
    - grounding.version: 2

UI:
  ReportGroundingInline forenkles — rendrer KUN curatedNarrative
  med gradient fade-out + "Les mer"-knapp
  searchEntryPointHtml + sources-pills under expanded state
```

## Google ToS — compliance preservert

- `searchEntryPointHtml` rendres fortsatt verbatim (DOMPurify-sanert)
- `sources`-pills med URLer er uendret
- "Utdyping fra Google AI"-attribution står
- Claude omskriver **stil**, legger ikke til **fakta** — samme mønster som Perplexity

**Streng prompt-kontrakt:**
> "Bruk KUN fakta fra gemini_narrative og gemini_sources. Ikke legg til navn,
> årstall, eller egenskaper som ikke står der. Hvis et POI-navn ikke er i
> poi_set OG ikke i gemini_narrative, ikke nevn det."

## POI-inline-matching

Claude får POI-settet (navn + uuid + kategori) og legger inn markdown-lenker
`[Navn](poi:uuid)` første gang hvert POI nevnes. ReactMarkdown custom renderer
konverterer `poi:`-lenker til POI-chip (samme komponent som brukes i bridge-text).

**Gotchas:**
- Kun første forekomst per POI → unngå chip-spam
- Navn-kollisjoner: prioriter POI i temaets kategori
- Ambiguous: hvis to POIs kan matche, drop heller enn å gjette

## UX-mønster: fade + "Les mer"

- Curated tekst (~500–700 tegn) alltid synlig — ingen knapp for å vise noe
- Gradient fade-out på bunn + "Les utdyping"-knapp hvis teksten er lang nok
  til å fortjene trunking (>600 tegn)
- Expand → full tekst + sources-pills + searchEntryPointHtml
- Kollaps → tilbake til truncated view

**Attribution:** Google G-logo + "Utdyping fra Google AI"-label over den
unified teksten (ikke i midten). Unified innhold, men klar attribution.

## Alternativer vurdert

### A. To adskilte blokker (status quo)
Klar attribution, men brytes rød tråd, repetisjon. Forkastet.

### B. Unified med fade + "les mer" ← VALGT
Én tekst, Claude kuraterer, POI-inline inkludert.

### C. Switch: "Se Google's utdyping" ERSTATTER Placy
Én tekst om gangen. For drastisk — mister Placy's voice.

### D. Hybrid: Placy-tekst flows inn i Gemini-tekst uten Claude-kurator
Ren concatenation. Stil vil klaske. Forkastet.

## Åpne spørsmål til plan

1. **Schema-versjon:** Bump `groundingVersion` til `z.literal(2)` eller legge
   til `curatedNarrative`-felt som valgfritt?
2. **Fallback:** Hvis Claude-kuratering feiler, vis raw `narrative`? Eller
   vis ikke noe?
3. **Lengde-mål:** Hva skal `curatedNarrative` ha som tegn-mål? 500–700?
   600–850? (brukerinput: +20% fra nåværende, så ~720–840)
4. **Placy-tekst:** Skal `lowerNarrative` erstattes av `curatedNarrative`, eller
   leve videre som tematisk intro? (Forslag: `curatedNarrative` erstatter, én
   tekst per tema)
5. **Regenerering:** Cache-busting via `groundingVersion`-bump tvinger full
   rerun av Gemini-script. Skal vi også lagre en hash av POI-set for å
   invalidere curatedNarrative når POI-settet endres?

## Neste steg

→ `/workflows:plan` over denne brainstormen.
