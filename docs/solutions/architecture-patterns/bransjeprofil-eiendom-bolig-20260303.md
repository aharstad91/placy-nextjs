---
title: "Bransjeprofil: Eiendom - Bolig"
category: architecture-patterns
tags: [themes, categories, bolig, bransjeprofil, analytics, explorer, report]
module: themes
created: 2026-03-03
---

# Bransjeprofil: Eiendom - Bolig

## Konsept: Bransjeprofil

En **bransjeprofil** definerer alt et prosjekt innen en bransje trenger: temaer, kategorier, standardinnstillinger og datakilder. Profilen kobles til prosjektets bransje-tag (envalg: "Eiendom - Bolig", "Hotell", etc.) og fungerer som boilerplate for nye prosjekter.

### Systemlogikk: Bransje-tag → Bransjeprofil

```
Prosjekt har bransje-tag (envalg, radio buttons i admin)
    ↓
Tag bestemmer hvilken bransjeprofil som lastes
    ↓
Bransjeprofilen definerer:
  - Hvilke temaer som vises (navn, ikon, farge, rekkefølge)
  - Hvilke kategorier som tilhører hvert tema
  - Standardinnstillinger (radius, minRating, datakilder)
    ↓
Alle produkter leser fra samme profil:
  - WelcomeScreen → viser temaer som avkryssingsbokser
  - Explorer → viser tema-chips med kategori-filtrering
  - Report → strukturerer seksjoner etter tema-rekkefølge
  - Analytics → tracker interesse per kategori, aggregerer per tema
```

**Én kilde til sannhet.** Endrer du temaene i bransjeprofilen, endres de overalt.

## Designprinsipp

Temaene er designet ut fra **meglerens vanligste spørsmål fra boligkjøpere** — ikke informasjonsarkitektur, men reelle kjøpsbeslutninger.

## 7 temaer for Eiendom - Bolig

| # | ID | Navn | Ikon | Farge | Meglersspørsmålet |
|---|-----|------|------|-------|-------------------|
| 1 | `barn-oppvekst` | Barn & Oppvekst | GraduationCap | #f59e0b | "Er det bra for barna?" |
| 2 | `hverdagsliv` | Hverdagsliv | ShoppingCart | #22c55e | "Hva kan jeg ordne i nærheten?" |
| 3 | `mat-drikke` | Mat & Drikke | UtensilsCrossed | #ef4444 | "Er det et levende nabolag?" |
| 4 | `opplevelser` | Opplevelser | Landmark | #0ea5e9 | "Er det noe å gjøre her?" |
| 5 | `natur-friluftsliv` | Natur & Friluftsliv | Trees | #10b981 | "Er det grønt i nærheten?" |
| 6 | `trening-aktivitet` | Trening & Aktivitet | Dumbbell | #ec4899 | "Kan jeg trene i nærheten?" |
| 7 | `transport` | Transport & Mobilitet | Bus | #3b82f6 | "Hvordan kommer jeg meg rundt?" |

## Kategorier per tema

### 1. Barn & Oppvekst
- `skole` — Barne- og ungdomsskoler (kilde: NSR)
- `barnehage` — Barnehager (kilde: Barnehagefakta)
- `lekeplass` — Lekeplasser (kilde: OSM/Overpass)
- `idrett` — Idrettsanlegg (kilde: OSM/Overpass)

### 2. Hverdagsliv
- `supermarket` — Dagligvarebutikker
- `pharmacy` — Apotek
- `convenience` — Nærbutikker
- `doctor` — Legekontor
- `dentist` — Tannleger
- `hospital` — Sykehus/legevakt
- `haircare` — Frisører
- `bank` — Banker
- `post_office` — Postkontor

### 3. Mat & Drikke
- `restaurant` — Restauranter
- `cafe` — Kafeer
- `bar` — Barer
- `bakery` — Bakerier

### 4. Opplevelser
- `museum` — Museer
- `library` — Bibliotek
- `cinema` — Kinoer
- `bowling` — Bowlinghaller (ny kategori)
- `amusement` — Aktivitetsparker/trampolineparker (ny kategori)
- `theatre` — Teater (ny kategori)

### 5. Natur & Friluftsliv
- `park` — Parker og grøntområder
- `outdoor` — Turstier og friluftsområder
- `badeplass` — Badeplasser

### 6. Trening & Aktivitet
- `gym` — Treningssentre
- `swimming` — Svømmehaller
- `spa` — Spa og velvære
- `fitness_park` — Utendørs treningsparker (ny kategori)

### 7. Transport & Mobilitet
- `bus` — Bussholdeplasser
- `train` — Togstasjoner
- `tram` — Trikkeholdeplasser
- `bike` — Bysykkelstasjoner
- `parking` — Parkering
- `carshare` — Bildeling
- `taxi` — Taxiholdeplasser
- `charging_station` — Ladestasjoner (ny kategori)

## Endringer fra forrige tema-sett (6 temaer)

| Før | Nå | Endring |
|-----|-----|---------|
| Kultur & Opplevelser | **Opplevelser** + **Natur & Friluftsliv** | Splittet — natur og kultur er ulike kjøpsargumenter |
| Trening & Velvære | **Trening & Aktivitet** | Omdøpt — "velvære" er vagt, "aktivitet" er bredere |
| Hverdagsbehov | **Hverdagsliv** | Omdøpt — mykere, mer hverdagslig |
| barnefamilier | **barn-oppvekst** | Bedre ID |

### Nye kategorier
- `bowling`, `amusement`, `theatre` — under Opplevelser
- `fitness_park` — under Trening & Aktivitet
- `charging_station` — under Transport

## Analytics-kobling

Tema-tracking og kjøpersegmentering løses på **kategori-nivå**, ikke tema-nivå. Temaene skal gi god UX — analytics er et separat lag som leser klikkmønstre.

Eksempel: Klikk på `skole` + `barnehage` = barnefamilie-signal, uavhengig av tema-toggle.

WelcomeScreen-avkrysning er første datapunkt (anonymt, cookieless).

## Standardinnstillinger for Eiendom - Bolig

| Parameter | Verdi |
|-----------|-------|
| Radius | 2000–2500m |
| minRating | 0 (ingen filtrering) |
| Datakilder | Google Places, NSR, Barnehagefakta, OSM/Overpass, Entur, Bysykkel |
| Tema-rekkefølge | Som tabellen over (barn først) |

## Fremtidige bransjeprofiler

Samme mønster skal brukes for:
- **Eiendom - Næring** — kontorlokaler, næringsparker (transport, mat, møterom, parkering)
- **Hotell** — gjesterettet (restauranter, severdigheter, uteliv, transport)
- **Kultur** — besøksrettet (opplevelser, mat, transport)
- **Kommune** — innbyggerrettet (helhetlig tjenestetilbud)
