---
date: 2026-04-10
topic: transport-narrative-split
---

# Transport & Mobilitet — narrativ-split over og under kortene

## What We're Building

Transport & Mobilitet-seksjonen har fått mye nytt visuelt innhold (live kollektivavganger, 4 mobilitetskort, kart med live posisjoner), men narrativteksten er kort og sitter kun i ett blokk under kortene. Vi deler narrativet i to posisjonelle felt — `upperNarrative` (over kortene) og `lowerNarrative` (under kortene) — slik at teksten kobler seg naturlig til det brukeren ser, og vi får plass til å skrive fyldigere.

Øvre tekst fokuserer på det som er innen gangavstand (buss, bysykkel, sparkesykkel). Nedre tekst handler om regional kontekst (bil, bildeling, elbillading, tog, flybuss). LLM genererer begge. Transport leder an, mønsteret generaliseres til andre kategorier senere.

## Why This Approach

Vurderte tre alternativer:
- **(a) Utvide bridge text** til en fyldigere paragraf, dropp italic → enklere, men mister visuell pause og blander "intro" med "detaljer"
- **(b) Nytt paragraf under bridge text + beholde dagens "ett blokk under"** → tre tekstblokker på rad før kortene blir tungt
- **(c) Beholde italic bridge (generisk), legg ett paragraf over og ett under kortene** ← valgt

(c) gir klarest hierarki: generisk intro → "her og nå" → visuell bekreftelse (kort) → "derfra kan du…" → kart. Hver tekstblokk har en distinkt jobb og et naturlig tyngdepunkt i layouten.

## Key Decisions

- **Datamodell**: to nye felt på theme — `upperNarrative` og `lowerNarrative`. Posisjonelle navn så mønsteret generaliseres uten transport-språk.
- **Bridge text beholdes**, men strammes inn til kun kategori-nivå intro (ingen sub-kategorier, ingen spesifikke rute-detaljer).
- **LLM genererer begge narrativ** med distinkte prompts per kategori. For transport:
  - Upper: buss + bysykkel + sparkesykkel, "her og nå", 2–4 setninger
  - Lower: bil, bildeling, elbillading, tog, flybuss, "derfra kan du…", 3–5 setninger
- **Inline POI-linking** fungerer for begge felter (samme segment-parser som i dag).
- **Bakoverkompatibilitet**: manglende `lowerNarrative` → fall back til dagens `extendedText`. Manglende `upperNarrative` → rendres ikke (ingen tomme blokker). Andre kategorier enn transport får bare `lowerNarrative` inntil videre.
- **Rendering-rekkefølge**: Tittel → italic bridge → `upperNarrative` → "Kollektivt herfra"-kort → 4 mobilitetskort → "Sjekk din reisetid"-knapp → `lowerNarrative` → kart.
- **Transport-first**: hele splittelsen aktiveres på transport-temaet i første iterasjon. Andre kategorier får feltene i schema men bruker dem ikke før vi bestemmer innhold per kategori.

## Open Questions

- **Hvor sitter tekst-generatoren i dag?** Må lokaliseres (`lib/generators/` eller `.claude/skills/curator/`) før planning for å vite hvor vi utvider prompten.
- **Hvor lagres theme-tekster i DB?** Sannsynligvis `themes`/`report_config`-tabell — må verifiseres før vi legger til kolonner.
- **Migrasjon av eksisterende Wesselsløkka-tekst**: skal dagens narrativ splittes manuelt i to ved implementering, eller regenereres helt på nytt via LLM?
- **Skal bridge text for Wesselsløkka også oppdateres** som del av denne jobben (den er i dag for spesifikk — "Brøsetflata holdeplass med linje 12…"), eller er det en egen følgejobb?

## Next Steps

→ `/workflows:plan` for implementasjonsdetaljer — datamodell, generator-utvidelse, render-endringer, migrasjon.
