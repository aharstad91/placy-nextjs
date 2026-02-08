# Brainstorm: POI Admin — Kategorifilter Dropdown

**Dato:** 2026-02-06
**Kontekst:** http://localhost:3000/admin/pois

## Problem

Kategori-filteret i POI-admin sidebar har vokst ut av UI-et. Med 40+ kategorier tar flex-wrap chip-lista opp nesten hele sidebar-høyden. Når en bruker klikker en markør på kartet for å redigere, skyves edit-skjemaet ut av synsfeltet — brukeren ser aldri POI-detaljene.

## Krav

1. Kategori-filteret må ta vesentlig mindre plass i sidebar
2. Alle/Ingen-funksjonalitet må bevares
3. Brukeren må fortsatt kunne se hvilke kategorier som er aktive
4. Edit-skjemaet (POI-detaljer) må være synlig når en markør klikkes
5. URL-synkronisering av filter-state må bevares

## Valgt løsning: Kollapsbar dropdown med multi-select

Bytt ut den flat chip-lista med en kompakt dropdown/popover som åpnes on-demand:

### Design

```
┌──────────────────────────────┐
│ Filter  5/1274    [Alle|Ingen]│
│ ┌────────────────────────────┐│
│ │ 5 kategorier valgt    ▼   ││
│ └────────────────────────────┘│
└──────────────────────────────┘
```

Når dropdown åpnes:
```
┌──────────────────────────────┐
│ Filter  5/1274    [Alle|Ingen]│
│ ┌────────────────────────────┐│
│ │ 5 kategorier valgt    ▲   ││
│ ├────────────────────────────┤│
│ │ 🔍 Søk kategorier...      ││
│ │ ☑ Kafé (26)                ││
│ │ ☑ Restaurant (26)          ││
│ │ ☑ Park (83)                ││
│ │ ☐ Buss (661)               ││
│ │ ☐ Lekeplass (116)          ││
│ │ ☐ Badeplass (26)           ││
│ │ ...                        ││
│ └────────────────────────────┘│
└──────────────────────────────┘
```

### Fordeler
- Kollaps tar ~48px i høyden vs ~400px+ i dag
- Søkbar liste for rask navigering med 40+ kategorier
- Tydelig oppsummering av aktive filtre
- Max-height med scroll for lange lister
- Enkel implementering — kun intern state-endring i sidebar

### Detaljer
- Vis valgte kategorier som en kompakt oppsummering: "5 kategorier valgt" eller navnene hvis <= 3
- Dropdown med max-height + overflow-y-auto
- Checkbox per kategori med count-badge
- Kategori-søk inni dropdown for rask filtrering
- Alle/Ingen-knapper beholdes i header-raden
- Kategoriene sorteres: valgte først, deretter alfabetisk

## Avvist alternativ: Horisontal scrollbar

En horisontal scrollbar med chips ville bevart det visuelle, men gjort det vanskeligere å se alle kategorier og verre for touch-enheter.
