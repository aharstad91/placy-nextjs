---
date: 2026-03-03
topic: verifisert-tekstgenerering
---

# Verifisert tekstgenerering for boligrapporter

## Problemet

Generate-bolig produserer tema-tekster (kort + lang per tema) som påstår ting som ikke er verifisert:
- "Svømmebasseng i Blussuvollhallen" — usikkert om det faktisk finnes
- "Grip klatresenter på Leangen — alt i gangavstand" — det er 22 min gange
- "Etablert i 2007" — gjettet, ikke verifisert

Konsekvens: Megleren mister tillit til hele produktet. En megler som sender feil info til en kjøper taper kunder.

## Kjerneprinsipp

**Teksten får bare påstå det vi kan verifisere.** To kilder:
1. POI-data (navn, koordinater, beregnet gangavstand, kategori, rating)
2. WebSearch (ekte fakta om stedene)

Ingen gjetning. Hvis vi ikke vet det, sier vi det ikke.

## Hva vi bygger

En tekst-pipeline som bruker WebSearch til å kuratere verifiserte nabolagstekster.

### Flyten per tema:
1. **POI-data** gir oss stedene og beregnet gangavstand
2. **WebSearch per sted** gir oss ekte fakta (hva stedet er, hva det er kjent for, om det faktisk eksisterer)
3. **Claude skriver tekst** med Curator-stemme basert på verifisert kunnskap
4. **Mekanisk sjekk**: hvert faktum i teksten har en kilde (POI-data eller WebSearch)
5. Alt som ikke kan verifiseres → droppes eller omformuleres

### Harde regler:
- Gangavstand = beregnet fra POI-data (`distanceMeters / 80`), aldri gjettet
- Hvert stedsnavn = bekreftet via WebSearch
- "I gangavstand" = under 15 min. Over det = "kort sykkeltur" / "i nærheten"
- Ingen fakta uten kilde

### Output per tema:
- **Kort tekst** (alltid synlig) — nabolagskarakter, 1-2 setninger
- **Lang tekst** (bak "Fortell meg mer") — utdyper, 4-6 setninger

## Nøkkelbeslutninger

1. **Curator-stemme + strenge fakta-regler** — ikke enten/eller. Sem & Johnsen gjetter ikke, de skriver godt om ting de vet.
2. **WebSearch er verifiseringsverktøy**, ikke kreativt verktøy — vi søker for å bekrefte, ikke for å finne pynt.
3. **POI-data er primærkilde** — gangavstand, stedsnavn, kategori. WebSearch supplerer med kontekst.
4. **Mekanisk sjekk etter generering** — hvert stedsnavn og avstandspåstand sjekkes mot data.

## Hva dette erstatter

Forrige tilnærming (gjort tidligere i denne sesjonen) skrev specs og eksempler for "bridgeText" og "extendedBridgeText" i Curator-skillen. Det var bedre instruksjoner, men ingen mekanisk garanti for korrekthet. Denne tilnærmingen bygger verifisering inn i selve pipelinen.

## Åpne spørsmål

- Skal den mekaniske sjekken blokkere (tekst avvises) eller auto-korrigere (skriv om)?
- Hvor mange WebSearches per tema er rimelig? (6 temaer × N steder per tema)
- Skal vi beholde Curator text-type-specs som skrivemal, eller forenkle?

## Neste steg

→ Planlegge konkret implementering i generate-bolig.md
