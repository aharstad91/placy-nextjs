# POI Data Sourcing Guide

Hvordan hente, kurasere og lagre POI-data for Placy.

## TL;DR

```
Fakta (koordinater, navn, type) = fritt tilgjengelig
Tekst/bilder = ikke kopier
Egen innsikt = Placy eier
```

## Juridisk grunnlag

### Hva du kan bruke fritt

| Data | Eksempel | Kilde |
|------|----------|-------|
| Koordinater | `63.4353, 10.4015` | Kart, GPS |
| Navn | "Pirbadet" | Offentlig kjent |
| Type/kategori | "badeplass" | Fakta |
| Åpningstider | "08-20" | Fakta |
| Fasiliteter | "toalett, parkering" | Fakta |

### Hva du IKKE kan kopiere

| Data | Hvorfor |
|------|---------|
| Beskrivelser | Opphavsrettslig beskyttet tekst |
| Bilder | Opphavsrett |
| Hele databaser | Sui generis databasevern |
| Logoer/branding | Varemerkerett |

## Workflow

### 1. Identifiser kategori

Eksempler på POI-kategorier:
- Badeplasser
- Turløyper
- Lekeplasser
- Holdeplasser
- Sykkelstasjoner

### 2. Finn datakilder

**Åpne data-portaler (best):**
- [data.trondheim.kommune.no](https://data.trondheim.kommune.no)
- [Geonorge](https://geonorge.no)
- [data.norge.no](https://data.norge.no)

**Referansekilder (for fakta):**
- Kommune-nettsider
- Google Maps
- OpenStreetMap

### 3. Hent fakta

For hver POI, noter:

```json
{
  "name": "Korsvika",
  "type": "badeplass",
  "coordinates": [63.4401, 10.4156],
  "source_reference": "trondheim.kommune.no/badeplasser"
}
```

### 4. Skriv egen innsikt

Legg til Placy-verdi:

```json
{
  "name": "Korsvika",
  "type": "badeplass",
  "coordinates": [63.4401, 10.4156],
  "editorialHook": "Trondheims mest populære bystrand med sandbunn og grunne områder.",
  "localInsight": "Kom tidlig på varme dager - parkeringen fylles fort."
}
```

### 5. Lagre med metadata

```json
{
  "id": "badeplass-korsvika",
  "name": "Korsvika",
  "category": "badeplass",
  "coordinates": {
    "lat": 63.4401,
    "lng": 10.4156
  },
  "editorialHook": "...",
  "localInsight": "...",
  "_meta": {
    "created": "2026-01-25",
    "source": "manual-curation",
    "sourceReference": "trondheim.kommune.no/badeplasser"
  }
}
```

## Kildetyper

### NLOD-lisensierte data

Norsk lisens for offentlige data. Krever attribusjon.

**Bruk:**
```json
{
  "_meta": {
    "license": "NLOD",
    "attribution": "Inneholder data under NLOD fra Trondheim kommune"
  }
}
```

**Vis attribusjon:** På "Om data"-side eller i footer.

### Faktabasert kurasjon

Når du henter fakta fra nettsider (ikke åpne data-portaler).

**Bruk:**
```json
{
  "_meta": {
    "source": "manual-curation",
    "sourceReference": "URL brukt som referanse"
  }
}
```

**Attribusjon:** Ikke påkrevd, men sourceReference gir sporbarhet.

## Eksempel: Badeplasser i Trondheim

### Steg 1: Finn kilder

- [Trondheim kommune - Badeplasser](https://www.trondheim.kommune.no/tema/kultur-og-fritid/park-og-mark/badeplasser/)
- [Trondheimskartet](https://kart.trondheim.kommune.no)

### Steg 2: Noter fakta

| Navn | Koordinater | Type |
|------|-------------|------|
| Korsvika | 63.4401, 10.4156 | badeplass |
| Djupvika | 63.4512, 10.4089 | badeplass |
| Ringvebukta | 63.4178, 10.4634 | badeplass |

### Steg 3: Skriv egen innsikt

Besøk stedene eller research på nett for å skrive:
- `editorialHook`: Én setning om det unike
- `localInsight`: Insider-tips

### Steg 4: Importer til Placy

Bruk eksisterende import-script eller legg til manuelt i dataset.

## Oppsummering

| Handling | OK? |
|----------|-----|
| Kopiere koordinater fra kommunekart | ✅ |
| Notere navn og type fra nettside | ✅ |
| Skrive egne beskrivelser | ✅ |
| Kopiere beskrivelser fra nettside | ❌ |
| Laste ned og bruke bilder | ❌ |
| Bruke NLOD-data med attribusjon | ✅ |
