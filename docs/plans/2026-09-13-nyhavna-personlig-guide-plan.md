---
title: Nyhavna – personlig samtaleguide og kartfremheving
type: feat
date: 2026-09-13
topic: nyhavna-personlig-guide
status: under arbeid
---

# Nyhavna – personlig samtaleguide og kartfremheving

Kort lokal plan for byggeprompten i `/tmp/compound-engineering-501/ce-handoff/placy-0d5187471d/nyhavna-fable-totalprompt.md`.
Demo: `http://127.0.0.1:3101/eiendom/nyhavna-utvikling/nyhavna/leve`. Modell mini + stemme marin holdes fast.

## Utgangspunkt (kontrollert 2026-09-13 09:00)

- Arbeidstre rent (kun `next-env.d.ts`). De ucommittede endringene briefen advarte om er alt committet (`dbb149b`, `dc5e534`).
- Serveren på 3101 kjører produksjonsbygget fra 08:30 med **fullmodellen** (startet med env-overstyring). `.env.local` sier mini. Restart etter bygg gir mini.
- Kunnskap: 56 FAQ (8 nabolag + 4–10 per boardtema; de tre nyhavna.no-temaene har 0 FAQ, men kuraterte fakta i `knowledge.ts`), 39 bekreftede / 11 uavklarte fakta, 7 kartsteder, 8 ikke-plasserte omtaler.
- Samtalen er serverstyrt: `route.ts` lager kallet, `sideband.ts` eier kunnskapsverktøy og videreføring, nettleseren utfører bare kartkommandoer.

## Arbeidsdeling

| Del | Eier | Filer |
|---|---|---|
| A. nyhavna.no-dekning + prosjektavgrenset kunnskapspakke | underagent | `lib/demo/nyhavna-leve/site-knowledge.ts` (+test), `docs/research/nyhavna-leve-demo/site-coverage.md` |
| B. Fremheving av flere steder i kartet (tilstand + begge motorer) | underagent | `board-state.tsx`, `BoardMarker.tsx`, `BoardMap.tsx`, `use-board-marker-set.ts`, `BoardMap3D.tsx`, `use-3d-marker-declutter.ts`, `map-view-3d.tsx`, `PoiMarkerContent.tsx` (+tester) |
| C. Samtaletilstand, kapitler, verktøy, hilsen, stemmeinstruks, integrasjon, verifisering, logg | hovedagent | `lib/realtime/*`, `board-tools.ts`, `voice/*`, `route.ts`, docs |

## Kontrakter

**Kart (B → C):** `BoardState.highlightedPoiIds: BoardPOIId[]` (ordnet), actions `HIGHLIGHT_POIS {ids}` (erstatter) og `CLEAR_HIGHLIGHTS`. Ingen navigasjons-action rører settet. Fremhevet markør: alltid synlig (også utenfor aktivt filter/utsnitt), aldri demotert, navn vist, ring + nummer i rekkefølge, i begge motorer. Kamera flyttes IKKE av reduceren – verktøyet gjør det én gang per ny gruppe.

**Kunnskap (A → C):** `nyhavnaSiteKnowledge.entries[]` med `id`, `kind`, `status` (existing / planned / adopted-plan / vision / unresolved), `themes` (board-kategori-ID-er eller `nyhavna`), `text`, `keywords`, kilde-URL og kontrolldato; `searchSiteKnowledge(query, {themes, limit})` og `siteKnowledgeForTheme(themeId)`. Aldri oppdiktede markører; `mapPoiIds` bare fra eksisterende `leve-*`-ID-er.

**Samtale (C):** deterministisk `TourState` på serveren (interesser, tema nå, neste, gjennomgått, fremhevet i rekkefølge, avstikker/returpunkt, åpne spørsmål). Modellen oppdaterer via validerte verktøy: `set_interests`, `open_theme`, `note_detour`, `return_to_tour`, `find_project_info`; kartverktøy `highlight_places`, `clear_highlights` (+ eksisterende). Kompakt samtalenotat sendes som systemmelding når tilstanden endres. FAQ-katalogen blir stående i den faste (cachede) instruksjonen fordi den gir svar + kartvisning i én runde; kapittelpakken hentes ved temainngang.

**Stemme:** språk og uttale beskrives hver for seg og positivt; «Placy» ut av talt hilsen og selvomtale; kommentaren om at trimming forårsaker dialektdrift rettes til hypotese. Lyttetest leveres som protokoll – kan ikke lyttes av agenten.

## Ferdigkriterier (fra briefen)

To ulike interesser → ulikt første tema. Tre steder fremhevet samtidig uten detaljkort; «det andre stedet» fungerer. Fordypning → retur; ny interesse endrer resten. Avbrudd stopper gamle kartendringer. Notatet overlever simulert forkorting. Manglende fakta sies ærlig. Stopp avslutter sesjonen; ny samtale starter tomt. Verifisert i nettleser på desktop og mobilbredde. Lint, test, tsc, bygg. Stopp 3101 før bygg.
