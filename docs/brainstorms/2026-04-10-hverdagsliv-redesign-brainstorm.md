---
date: 2026-04-10
topic: hverdagsliv-redesign
---

# Hverdagsliv — Redesign

## What We're Building

Hverdagsliv er tema nr. 2 i megler-dekning (~95% av alle annonser), men har fått minst fokus i Placy og er implementert som et sekundært tema. Vi redesigner det til å være ett av de tyngste temaene — i bredde, dybde og narrativ kvalitet.

Kjerneendringen: **kjøpesenter/lokalsenter som anker**. Der det finnes et kjøpesenter innen rimelig avstand, er det det egentlige hverdagslivet — det samler dagligvare, apotek, vinmonopol, frisør og post under ett tak. Vi løfter dette til primærposisjon og bygger resten av seksjonen rundt det.

## Why This Approach

S&J-analyse (docs/research/2026-04-08-beliggenhetstekst-moensteranalyse.md) viser at meglere aldri bare lister individuelle POI-er — de løfter *senteret* som konsept:
> "Storo Storsenter er rett i nærheten og tilbyr blant annet vinmonopol, apotek og over hundre butikker"

Dagens implementasjon gjør det motsatte: lister Dagligvare, Apotek, Lege og Frisør i likeverdige rader — der frisøren ender opp med like mye visuell vekt som dagligvaren, og kjøpesenteret ikke nevnes i det hele tatt.

## Key Decisions

- **Kjøpesenter alltid med**: Nærmeste kjøpesenter/lokalsenter vises alltid øverst hvis det finnes innen ~15 min gange. Folk kjører langveisfra for å shoppe — det er viktig innsikt uansett lokasjon.
- **Retning A valgt**: Kjøpesenter som anker (ikke bare én POI til i lista).
- **Nettstedslenke**: Bruk `googleWebsite`-feltet (allerede på POI-typen) for direktelenke til kjøpesenterets nettsted.
- **Google AI mode-slot**: Kjøpesenter-kortet designes med en tom slot for Google AI-knapp (feature under bygging i separat worktree). Ikke implementer logikken her — bare legg til `data-google-ai-target`-attributt eller tilsvarende hook.
- **Ny kategori: shopping_mall**: `shopping`-kategorien finnes allerede i `poi-discovery.ts` (linje 60) men er ikke inkludert i hverdagsliv-temaet. Legges til.
- **Ny kategori: Vinmonopol**: Legges til som `liquor_store` i poi-discovery + hverdagsliv-tema. Name-basert visning: hvis POI-navn inneholder "Vinmonopol" → vis som "Vinmonopol", ellers vis kategorinavn.
- **Nytt hierarki i Hero Insight**:
  - Tier 1 (stor, alltid): Kjøpesenter
  - Tier 2 (standard): Dagligvare · Apotek · Lege
  - Tier 3 (kompakt, vis kun hvis finnes): Vinmonopol · Post · Bank · Frisør
- **Ny bridge text**: S&J-nivå narrativ som løfter kjøpesenteret, ikke "X og Y gir variasjon for de som vil veksle mellom butikker."
- **Bakeri = mat & drikke**: Bakeri er ikke hverdagsliv — forblir i mat & drikke-temaet.
- **Vekting**: Frisør nedprioriteres visuelt. Er fortsatt med, men kompakt og uten samme romvekt som dagligvare.

## Open Questions

- Har vi `liquor_store`-data fra Google Places for eksisterende prosjekter (Wesselsløkka, Brøset)? Må sjekkes — kan hende vi må trigge re-import for å få inn Vinmonopol.
- Har vi `liquor_store`-data fra Google Places for eksisterende prosjekter (Wesselsløkka, Brøset)? Må sjekkes — kan hende vi må trigge re-import for å få inn Vinmonopol.

## Next Steps

→ `/workflows:plan` for implementasjonsdetaljer
