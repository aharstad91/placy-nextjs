---
title: "Bransjeprofil: Eiendom - Næring"
category: architecture-patterns
tags: [themes, categories, naering, bransjeprofil, analytics, explorer, report]
module: themes
created: 2026-03-03
---

# Bransjeprofil: Eiendom - Næring

## Målgruppe

Bedriftseiere, kontorsjefer, gründere som leter etter næringslokaler. Smalere målgruppe enn bolig — færre temaer, men hver med høy relevans.

## Systemlogikk

Se [Bransjeprofil: Eiendom - Bolig](bransjeprofil-eiendom-bolig-20260303.md) for konseptbeskrivelse og systemlogikk (bransje-tag → bransjeprofil → alle produkter).

## 5 temaer for Eiendom - Næring

| # | ID | Navn | Ikon | Farge | Spørsmålet |
|---|-----|------|------|-------|------------|
| 1 | `mat-drikke` | Mat & Drikke | UtensilsCrossed | #ef4444 | "Hvor spiser vi lunsj?" |
| 2 | `transport` | Transport & Mobilitet | Bus | #3b82f6 | "Hvordan kommer folk seg hit?" |
| 3 | `trening-aktivitet` | Trening & Aktivitet | Dumbbell | #ec4899 | "Kan ansatte trene?" |
| 4 | `hverdagstjenester` | Hverdagstjenester | ShoppingCart | #22c55e | "Hva kan ordnes i nærheten?" |
| 5 | `nabolaget` | Nabolaget | MapPin | #8b5cf6 | "Er det et attraktivt område å jobbe i?" |

## Kategorier per tema

### 1. Mat & Drikke
- `restaurant` — Restauranter
- `cafe` — Kafeer
- `bar` — Barer
- `bakery` — Bakerier

### 2. Transport & Mobilitet
- `bus` — Bussholdeplasser
- `tram` — Trikkeholdeplasser
- `train` — Togstasjoner
- `parking` — Parkering
- `carshare` — Bildeling (Hyre etc.)
- `bike` — Bysykkelstasjoner
- `scooter` — Sparkesykler (ny kategori)
- `charging_station` — Ladestasjoner (ny kategori)
- `airport_bus` — Flybuss (ny kategori)

### 3. Trening & Aktivitet
- `gym` — Treningssentre
- `swimming` — Svømmehaller
- `fitness_park` — Utendørs treningsparker (ny kategori)

### 4. Hverdagstjenester
- `supermarket` — Dagligvarebutikker
- `pharmacy` — Apotek
- `haircare` — Frisører

### 5. Nabolaget
- `park` — Parker og grøntområder
- `outdoor` — Grøntområder og turveier
- `hotel` — Hotell (for gjester/kolleger)
- `conference` — Konferanselokaler (ny kategori)
- `museum` — Museer
- `cinema` — Kinoer
- `library` — Bibliotek

## Nye kategorier (krever database-migrasjon)

| Kategori | Tema | Datakilde |
|----------|------|-----------|
| `scooter` | Transport | Voi/Tier API eller OSM |
| `airport_bus` | Transport | Entur (filtrert på flybuss-linjer) |
| `conference` | Nabolaget | Google Places |
| `charging_station` | Transport | Nobil API eller OSM |
| `fitness_park` | Trening | OSM/Overpass |

## Delte temaer med Eiendom - Bolig

| Tema | Bolig | Næring | Forskjell |
|------|-------|--------|-----------|
| Mat & Drikke | Ja | Ja | Likt — lunsj vs. nabolagsliv |
| Transport & Mobilitet | Ja | Ja | Næring har flybuss + sparkesykkel |
| Trening & Aktivitet | Ja | Ja | Likt |
| Hverdagsliv / Hverdagstjenester | Ja | Ja | Næring har smalere utvalg (ikke lege/tannlege/bank/post) |
| Barn & Oppvekst | Ja | Nei | Kun bolig |
| Opplevelser | Ja | Nei | Bakt inn i Nabolaget for næring |
| Natur & Friluftsliv | Ja | Nei | Bakt inn i Nabolaget for næring |
| Nabolaget | Nei | Ja | Kun næring — attraktivitet som salgsargument |

## Standardinnstillinger for Eiendom - Næring

| Parameter | Verdi | Kommentar |
|-----------|-------|-----------|
| Radius | 1000–1500m | Kortere enn bolig — ansatte går/sykler til lunsj |
| minRating | 0 | Ingen filtrering |
| Datakilder | Google Places, Entur, Bysykkel, Nobil, OSM | + flybuss via Entur |
