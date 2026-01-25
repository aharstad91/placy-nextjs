# POI Data Sourcing Strategy

**Date:** 2026-01-25
**Status:** Decided

## What We're Building

En strategi for hvordan Placy henter, lagrer og bruker POI-data fra offentlige kilder (kommuner, statlige etater) på en juridisk trygg måte.

## Context

Placy trenger rike POI-datasett (badeplasser, parker, turstier, etc.) for å bygge stories. Offentlige kilder som Trondheim kommune har mye av denne dataen tilgjengelig, men det er uklart hva som er lovlig å gjenbruke.

## Key Decisions

### 1. Fakta vs. kreative verk

**Beslutning:** Fakta (koordinater, navn, type sted) er fritt tilgjengelig og ikke opphavsrettslig beskyttet.

**Begrunnelse:** Norsk og internasjonal opphavsrett beskytter kreative verk, ikke fakta. At Pirbadet ligger på `63.4353, 10.4015` er et faktum som kan brukes fritt.

### 2. Egen datakurasjon

**Beslutning:** Placy oppretter egne datapunkter med:
- Koordinater (fakta - kan hentes fra offentlige kilder)
- Navn/tittel (fakta)
- Type/kategori (fakta)
- Egne beskrivelser og editorial hooks (eget innhold)

**Begrunnelse:** Dette skaper et genuint nytt verk som Placy eier. Beskrivelser, innsikt og kurasjon er verdien Placy tilfører.

### 3. Hva vi IKKE gjør

**Beslutning:** Vi kopierer ikke:
- Tekstbeskrivelser fra kilder
- Bilder/illustrasjoner
- Hele databaser (sui generis databasevern)

### 4. Transparens og attribusjon

**Beslutning:** Være åpen om datakilder der det er relevant, men ikke påkrevd for faktabasert data.

**Eksempel:** "Badeplasser i Trondheim" krever ingen attribusjon siden det er egne datapunkter. Ved bruk av NLOD-lisensierte datasett: attribuer på "Om data"-side.

### 5. Data presisjon

**Beslutning:** Bruke korrekte koordinater uten bevisst degradering.

**Begrunnelse:** Datakvalitet er kritisk for en lokasjonsbasert tjeneste. "Skjuling" er juridisk unødvendig og skader produktet.

## Workflow for nye POI-kategorier

```
1. Identifiser datakilde (kommune, Geonorge, etc.)
2. Sjekk om det finnes i åpne data-portal
   - Ja: Last ned, noter lisens (typisk NLOD)
   - Nei: Bruk som referanse for faktauthenting
3. Opprett egne datapunkter med korrekte koordinater
4. Skriv egne beskrivelser og editorial hooks
5. Lagre i Placy-format med kilde-metadata
```

## When to Use Official Open Data

| Scenario | Tilnærming |
|----------|-----------|
| Data eksisterer i åpen data-portal | Bruk direkte, attribuer per NLOD |
| Kun tilgjengelig på nettside | Hent fakta, skriv eget innhold |
| Trenger omfattende metadata | Kontakt dataeier for eksport |

## Open Questions

1. **Automatisering:** Skal vi bygge scripts for å hente fakta fra offentlige kilder, eller fortsette manuell kurasjon?
2. **Datakvalitet:** Hvordan verifisere at koordinater fra ulike kilder er presise?
3. **Oppdateringer:** Hvordan håndtere at badeplasser åpnes/stenges over tid?

## Out of Scope

- Scraping av beskrivelser og tekst
- Kopiering av bilder
- Automatisk synkronisering med kilder (vurderes senere)

## Next Steps

1. Fortsette med manuell kurasjon av POI-kategorier
2. Dokumentere kilder i metadata for sporbarhet
3. Vurdere åpne data-portaler for fremtidige kategorier
