---
title: Curator text types — bridgeText, extendedBridgeText, heroIntro
date: 2026-03-03
tags: [curator, text-quality, generate-bolig, bridgeText, extendedBridgeText, heroIntro]
category: feature-implementations
module: curator-skill, generate-bolig
symptoms: [AI-generisk tekst, POI-hooks klebet sammen, uverifiserte påstander, manglende extendedBridgeText]
---

# Curator text types — bridgeText, extendedBridgeText, heroIntro

## Problem

Steg 11 i generate-bolig genererte bridgeText/heroIntro ad hoc uten å bruke Curator-skillen og uten WebSearch-verifisering av påstander. extendedBridgeText ble ikke generert i pipelinen i det hele tatt — det ble lagt til manuelt via migrasjon 046.

Resultatet var tekster som leste som "POI-hooks klebet sammen" i stedet for nabolagskarakter, og som inneholdt uverifiserte påstander.

## Løsning

### Workstream A: Formalisere som Curator-teksttyper

Lagt til 3 nye teksttyper i Curator-skillen:

| Fil | Endring |
|-----|---------|
| `text-type-specs.md` | heroIntro, bridgeText, extendedBridgeText — med lengde, funksjon, register per tema, og Brøset 046 som eksempel |
| `bridge-text-calibration.md` | **NY** — komplett gullstandard med mønster-analyse, anti-mønstre, ankersted-valgguide |
| `SKILL.md` | 3 nye rader i hurtigreferanse-tabellen + referanse til kalibreringsfil |

### Workstream B: Restrukturere generate-bolig Steg 11 (research-først)

Erstattet det gamle Steg 11 (ad hoc generering) med research-først-tilnærming i 3 delsteg:

| Delsteg | Funksjon |
|---------|----------|
| 11a | **Research** — WebSearch per POI, beregn gangavstand, bygg verifisert faktabase per tema |
| 11b | **Skriv** — Curator-stemme, men KUN fra faktabasen. Ingen tilleggsfakta, ingen gjetning |
| 11c | **Mekanisk sjekk** — 6 kontrollpunkter: stedsnavn, avstand, fakta, ferskvare, repetisjon, AI-tone |

**Nøkkelendring vs. første forsøk:** Første versjon skrev tekster først og verifiserte etterpå (5 steg). Problemet: Curator-stemmens vektlegging av "navngi, mal bevegelse, bruk kontraster" presset Claude til å gjette for å fylle ut teksten. Research-først eliminerer dette — skriveren har KUN verifiserte fakta å jobbe med.

**Avstandskategorier (mekanisk, aldri gjettet):**
- ≤15 min (distanceMeters/80): "i gangavstand"
- 16-25 min: "kort sykkeltur" / "i nærheten"
- >25 min: nevnes ikke som nært

Oppdatert Steg 13 QA med ny Sjekk 7 (tekstkvalitet) som kjører Steg 11c mekanisk sjekk som uavhengig validering.

## Nøkkelinnsikt

**Research først, skriv etterpå.** Den viktigste lærdommen: gi Claude en Curator-stemme og si "skriv godt" → Claude gjetter for å fylle ut. Gi Claude en verifisert faktabase og si "skriv godt med KUN dette" → Claude skriver godt om ting den vet.

**bridgeText er en plakett ved inngangen til en sal** — den beskriver rommet, ikke enkeltverkene. 1-2 ankersteder som ytterpunkter definerer spennet, men teksten handler om nabolagskarakter.

**Anti-mønster:** "Bula Neobistro — åpnet av Top Chef-vinner — ..., Backstube baker tyske surdeigsbrød..., og Spontan Vinbar er anbefalt i Guide Michelin" → leser som tre POI-hooks, ikke nabolagskarakter.

**Brøset 046 er gullstandarden** — alle nye tekster kalibreres mot dette settet.

**Uverifiserte påstander dreper tillit.** "Svømmebasseng i Blussuvollhallen" (ikke bekreftet), "Grip klatresenter i gangavstand" (22 min gange) — én slik feil og megleren mister tillit til hele produktet.

## Relevante filer

- `.claude/skills/curator/references/text-type-specs.md`
- `.claude/skills/curator/references/bridge-text-calibration.md`
- `.claude/skills/curator/SKILL.md`
- `.claude/commands/generate-bolig.md`
