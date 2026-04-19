---
date: 2026-04-18
topic: gemini-grounding-rapport
---

# Gemini-grounding i generate-rapport

## What We're Building

Erstatte manuelle WebFetch/WebSearch-trinn i `/generate-rapport`-skillens Steg 2.5 (web-research av ankersteder) og Steg 3.5 (triangulering-gate for framtids-fakta) med Gemini API med `google_search`-tool-grounding. Én API-call per kategori returnerer autoritativ fact-sheet med kilder.

Samme grounding-data brukes til to formål:
1. **Kort form** — Claude kurerer 5-6 setninger til rapport-tekst (følger skill-reglene W/X/Y/Z/Æ)
2. **Lang form** — Gemini's narrativ vises i sheet-drawer med eksplisitt "Google AI"-branding når bruker trykker "Les mer"

Dette erstatter dagens `readMoreQuery`-pattern som sender bruker ut til `google.com/search?udm=50` — brukeren holdes nå i Placy.

## Why This Approach

POC kjørt 2026-04-18 på Stasjonskvartalet + Wesselsløkka (14 kategorier totalt). Alle leverte autoritative kilder (6-17 per kategori) med hyperlokal discovery som Claude's WebSearch ikke finner (Estenstadmarka kilometerfakta, busslinje-nummer, barnehage-historikk, Brøset-skole-status korrekt hedget).

Tre alternativer vurdert:
- (a) Full replacement av Steg 2.5+3.5: valgt for POC-validering
- (b) Parallel validation: unødvendig — POC ga klar signal
- (c) Augment only: øker kompleksitet uten gevinst

For lang form valgte vi (a) bruke Gemini sin narrativ direkte (ikke Claude-kuratert) — brukeren er tydelig på at det er Google AI-kvaliteten som er produktet, og branding som "Google AI" er ærlig og juridisk trygt.

## Key Decisions

- **Modell:** `gemini-2.5-flash` (validert i POC, tilstrekkelig grounding-kvalitet)
- **Ett Gemini-kall per kategori:** 7 kategorier × 50 rapporter ≈ $0.02-0.70/total (trivielt)
- **Build-time only:** ingen runtime LLM-API-kall, konsistent med "ingen runtime LLM"-regel
- **Kort form:** Claude fortsatt ansvarlig, følger W/X/Y/Z/Æ-reglene — Gemini er fact-feed, ikke final tekst
- **Lang form:** Gemini-narrativ direkte, branded som "Google AI" i sheet-drawer
- **URL-resolve:** Redirect-URL-er fra Gemini må resolves til faktiske domener for brukervisning
- **Cache-strategi:** fact-sheet lagres per prosjekt × kategori, gjenbruk under 6 mnd (matcher dagens Steg 2.5-regel)
- **Erstatter dagens readMoreQuery-eksterne-lenke:** bruker forblir i Placy, ingen Google-flukt

## Open Questions

- **Cache-lagringssted:** I `reportConfig.themes[].cachedGrounding` JSON-felt på products-raden, eller ny tabell `report_grounding_cache`? (Kan avgjøres i /plan)
- **Fallback ved Gemini-feil:** Skal vi beholde WebFetch-løypa som backup de første månedene, eller stole på Gemini? (Anbefaler: behold som dokumentert fallback, ikke aktiv kode)
- **Query-forbedringer:** Hverdagsliv-querien bommet på scope i begge POC-runs ("Stasjonskvartalet dagligvare" ga prosjekt-info, ikke omgivelses-tjenester). Må justeres før migrasjon av eksisterende queries.
- **Sheet-drawer UX:** Ny komponent eller gjenbruk av eksisterende? Branding av "Google AI" — logo + attribution per Google's ToS.
- **Eksisterende readMoreQuery på Stasjonskvartalet + Wesselsløkka:** skal de re-genereres med Gemini + lagres tilbake som baseline?

## Next Steps

→ `/plan` for implementasjonsplan:
- Skill-endringer: Steg 2.5 + 3.5 + 6 (skriv kort form) + ny Steg 6b (lang form)
- UI-endring: `ReportThemeSection.tsx` — "Les mer på Google AI"-knapp åpner lokal sheet-drawer i stedet for ekstern lenke
- Datamodell: `reportConfig.themes[].grounding` (fact-sheet + narrative + sources)
- Ny komponent: `GoogleAIGroundingSheet` (med URL-resolve, source-pills, attribution)
- Migrering av Stasjonskvartalet + Wesselsløkka til ny datamodell
- Query-disiplin: retningslinjer for hvordan skrive readMoreQuery som gir riktig scope

## POC-referanser

- Script: `scripts/poc-gemini-grounding.mjs` (takes project_id som CLI-arg)
- Stasjonskvartalet output: `/tmp/gemini-poc-banenor-eiendom_stasjonskvartalet.md`
- Wesselsløkka output: `/tmp/gemini-poc-broset-utvikling-as_wesselslokka.md`
