---
title: AI-tekstkvalitet — de fire kvalitetslagene
date: 2026-03-03
category: best-practices
tags: [editorial, curator, bridge-text, ai-generation, text-quality, roadmap]
module: lib/generators, curator
problem_type: quality-strategy
source: "Reddet fra feat/megler-theme-intro (commit 538c5b6) før branch-sletting 2026-07-08. Opprinnelig en PROJECT-LOG-refleksjon; bevart som frittstående doc fordi den syntetiserer 12+ brainstorms og 8+ solutions til et prioritert kvalitetskart for produktets kjerneverdi."
---

# AI-tekstkvalitet — de fire kvalitetslagene

**Prinsipp:** Placy "går ikke god" for AI-genererte tekster — men kvaliteten på førsteutkastet avgjør produktets verdi. Jo bedre draft, jo mindre jobb for kunden, jo mer salgbart produktet er.

Gjennomgang av all eksisterende tenkning (12+ brainstorms, 8+ solutions) viser fire kvalitetslag:

## Lag 1 — Bedre input (kunnskapsgrunnlag)
- City Knowledge Base (brainstorm 2026-02-15) foreslo strukturert bykunnskap som fundament. Aldri bygget.
- Nabolagstekster trenger *områdekunnskap* — ikke bare POI-data. Hvilken skolekrets? Hvilke turstier kobler seg? Lokal historie?
- Gapet: Curator har POI-data (navn, rating) men mangler nabolags-kontekst. Resultatet er at tekster gjetter ("over førti år") i stedet for å vite.

## Lag 2 — Bedre skriveinstruksjoner (curator-registre)
- Writing Levels brainstorm (2026-02-14) identifiserte at bridgeText ≠ editorial_hook. BridgeText = nabolagskarakter med ankersteder. ExtendedBridgeText = dypere dykk med bevegelse.
- Gapet: Curator-skillen har IKKE bridgeText eller extendedBridgeText som definerte teksttyper med maler og eksempler. Bare editorial_hook, local_insight, intro_text, seo_description er formalisert.
- **TODO:** Legg til bridgeText + extendedBridgeText i curator/references/text-type-specs.md med register, lengde, struktur og eksempler (bruk Brøset-tekstene som fasit).

## Lag 3 — Verifisering per påstand
- Curator-sjekklisten sier "WebSearch-verifisert", men dette gjøres bare for POI-hooks (batch curator pattern), ikke for nabolagstekster.
- Restaurant-batch fant 6 faktafeil i 93 POIs — bevis på at verifisering fanger reelle feil.
- Ferskvare-regelen (2026-02-08) gjelder her også — ingen årstall vi gjetter på, ingen nåtidspåstander om ansatte.
- **TODO:** Integrer WebSearch-verifisering i bridgeText-generering. Hver faktapåstand ("under ti minutters gangavstand", "etablert i 2007") bør verifiseres.

## Lag 4 — Feedback loop (kunden som kvalitetskontroll)
- Kunden (megleren) kjenner nabolaget bedre enn oss. Én revisjonsrunde gjør teksten sannferdig OG gir eierskap.
- **Over tid: diff-logging av hva kunden endrer gir oss mønstre.** "Kunder stryker alltid årstall vi gjetter på" → slutt å gjette. "Kunder legger til gatenavn" → inkluder gatenavn systematisk.
- Trenger: (a) redigeringsflate i admin for bridgeText/extendedBridgeText, (b) diff-logging av endringer.

## Prioritert rekkefølge
1. **Lag 2 først** — koster bare noen timers arbeid, og gir umiddelbar kvalitetsforbedring på alle nye prosjekter. Legg bridgeText/extendedBridgeText inn i curator-skillen med Brøset som fasit-eksempler.
2. **Lag 3 parallelt** — WebSearch-verifisering kan bakes inn i /generate-bolig-pipelinen.
3. **Lag 4 når admin-UI bygges** — redigeringsflate + diff-logging.
4. **Lag 1 langsiktig** — City Knowledge Base er det mest ambisiøse, men også det som gir størst moat over tid.

## Relaterte dokumenter
- `docs/brainstorms/2026-02-14-curator-writing-levels-brainstorm.md`
- `docs/brainstorms/2026-02-15-city-knowledge-base-brainstorm.md`
- `docs/solutions/best-practices/editorial-voice-skill-from-inspiration-texts.md`
- `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md`
- `docs/solutions/best-practices/restaurant-curator-batch-pattern-20260214.md`

## Parkert / Åpne spørsmål
- **Profilbilde for presenter**: Fortsatt åpent
- **Skal extendedBridgeText genereres automatisk i /generate-bolig?** Ja, men trenger Lag 2 + 3 først
- **Redigeringsflate for kunder**: Trenger admin-UI-arbeid — parkert til admin-sprint
- **City Knowledge Base**: Stor investering. Verdt det langsiktig, men ikke blokkerende for nåværende kvalitet.

## Retning
- **Tekstkvalitet er produktets kjerneverdi.** Dårlige tekster = kunden bruker ikke produktet. Gode tekster = kunden viser det til boligkjøpere.
- Neste konkrete steg: Utvid curator-skillen med bridgeText/extendedBridgeText-registre. Da kan /generate-bolig produsere bedre tekster automatisk.
- Feedback loop er den langsiktige flywheel-en — men den krever at kunden faktisk bruker og redigerer. Admin-UI er prerequisite.
