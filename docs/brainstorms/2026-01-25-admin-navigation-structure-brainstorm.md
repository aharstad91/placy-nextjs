# Admin Navigation Structure

**Dato:** 2026-01-25
**Status:** Godkjent konsept

## Hva vi bygger

En tydelig navigasjonsstruktur for admin-dashboardet som grupperer funksjonalitet etter bruksområde, ikke teknisk implementasjon.

## Hvorfor denne tilnærmingen

**Problem:** Admin-verktøyene er fragmenterte. For å fullføre én oppgave må brukeren navigere mellom 5+ ulike sider uten klar sammenheng.

**Løsning:** Organisere navigasjon i logiske grupper basert på hva brukeren prøver å oppnå.

## Navigasjonsstruktur

```
PLACY ADMIN
├── Oversikt (Dashboard)
│   └── Statistikk og status
│
├── Admin
│   ├── Kunder
│   └── Prosjekter
│
├── Data
│   ├── POI-er
│   ├── Kategorier
│   ├── Generator
│   └── Import
│
└── Innhold
    ├── Stories (per prosjekt)
    └── Editorial (bulk hooks/beskrivelser)
```

## Gruppeforklaring

| Gruppe | Formål | Sider |
|--------|--------|-------|
| **Oversikt** | Se status og statistikk | Dashboard |
| **Admin** | Organisasjon og struktur | Kunder, Prosjekter |
| **Data** | POI-data og generering | POI-er, Kategorier, Generator, Import |
| **Innhold** | Redaksjonelt arbeid | Story Editor, Editorial hooks |

## Nøkkelbeslutninger

1. **Grupper etter funksjon, ikke teknisk struktur** - "Data" samler alt som handler om POI-informasjon
2. **Generator hører under Data** - Fordi den produserer POI-data, ikke innhold
3. **Stories og Editorial er separate** - Story = struktur, Editorial = tekst/hooks
4. **Admin er organisasjonsstruktur** - Kunder og prosjekter er hierarki, ikke innhold

## Åpne spørsmål

- [ ] Skal "Import" være egen side eller del av Generator?
- [ ] Trenger vi en egen "Preview"-seksjon for å se resultat?
- [ ] Hvordan håndtere tilgang/roller når det kommer flere brukere?

## Neste steg

Kjør `/workflows:plan` for å implementere navigasjonsstrukturen.
