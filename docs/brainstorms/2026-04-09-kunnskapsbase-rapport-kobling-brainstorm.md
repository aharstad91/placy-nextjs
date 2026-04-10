---
date: 2026-04-09
topic: kunnskapsbase-rapport-kobling
---

# Kunnskapsbase → Rapport — verifiserte nabolagstekster med kilder

## Kontekst

Under arbeid med hero insight-kort per kategori (2026-04-09) oppdaget vi at Curator-teksten påsto at "Jonsvatnet er en populære badespot" — det er drikkevann med badeforbud. Google AI verifiserte teksten og fanget feilen med kilde fra Trondheim kommune.

Innsikt: **Placy har allerede en kunnskapsbase (`place_knowledge`) med 226 verifiserte fakta, confidence-nivåer og kilde-sporing.** Men rapporten bruker den ikke. Bridge-tekstene skrives av Curator uten å sjekke mot basen.

## Hva som finnes i dag

- `place_knowledge`-tabell med dual-parent (POI eller area), 20 topics, confidence, source_url
- 226 Trondheim-fakta seedet (migrasjon 039)
- Live i POI-detaljsider og MapPopupCard
- Verifisert-tekstgenerering brainstorm (2026-03-03) — pipeline designet men ikke koblet til rapport

## Gapet

1. **Rapport-tekster trekker ikke fra kunnskapsbasen** — Curator skriver fritt med WebSearch
2. **Ingen "negative fakta"** — basen mangler begrensninger (badeforbud, restriksjoner)
3. **Ingen kilde-lenker i rapport** — leseren ser ikke ut.no, atb.no, kommune.no
4. **Ingen validering mot basen** — generert tekst sjekkes ikke mot verifiserte fakta

## Retning: Tre koblinger

### 1. Generering trekker fra basen (A — ved generering)

Curator/bridge-text-generator får tilgang til `place_knowledge` for det aktuelle området:
- Bruker kun verifiserte fakta i teksten
- Kjenner begrensningene (vet at Jonsvatnet ≠ bading)
- Kan referere til kilder

### 2. Kunnskapsbasen utvides med begrensninger (C — permanent base)

Ny topic eller felt for "negative fakta":
- "Jonsvatnet: badeforbud — drikkevann med restriksjoner" (source: trondheim.kommune.no)
- "Estenstadmarka: deler av stiene stengt ved hogst" (sesongbasert)

### 3. Rapport viser kilde-lenker

Per tema-seksjon: relevante lenker til autoritære kilder
- Natur: ut.no turforslag, kommune.no friluftsliv
- Transport: atb.no rutetabeller, entur.no
- Skoler: kommune.no skolekretser, skolens egen side

## Forretningsverdien

"Placy vet mer om nabolaget enn megleren" — verifisert, kildebasert, med lenker:
- Megleren kan stole på rapporten uten å sjekke selv
- Kjøperen får merverdi via kilde-lenker
- Kunnskapsbasen er en **moat** — kumulativ, vanskelig å kopiere

## Neste steg

1. Brainstorme konkret kobling mellom `place_knowledge` og rapport-tekstgenerering
2. Designe "begrensninger"-laget i kunnskapsbasen
3. Designe kilde-lenker i rapport-UI
4. Prototype med Brøset — utvide 226 fakta med natur/transport/skole-begrensninger
