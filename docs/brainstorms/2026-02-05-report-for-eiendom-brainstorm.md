# Report for Eiendom — Brainstorm

**Dato:** 2026-02-05
**Status:** Utforsket
**Neste steg:** Plan for implementering

---

## Hva vi bygger

Utvide Report-produktet til å fungere bedre for eiendomsbransjen (boligprosjekter og næringsleie), med fokus på lead-generering.

---

## Hvorfor denne tilnærmingen

### Kontekst
- **Explorer** = hovedprodukt for hotell
- **Report** = hovedprodukt for eiendom
- Samme kjerne (POI-er, kart, kategorier), men ulike primærbrukere

### Eiendomsaktørers behov

**Boligkjøpere:**
- Hverdagslogistikk (tid til jobb, skole, butikk)
- Livsstil (kaféer, trening, parker)
- Trygghet og fremtidsutsikter

**Næringsleietakere:**
- Ansattes pendling (kollektiv, parkering)
- Rekruttering (attraktivt område)
- Fasiliteter (lunsj, møteplasser)

### Dagens problem med eiendomsmarkedsføring
- Statiske kart med "5 min til sentrum"-bobler
- Generiske tekstlister
- Vanskelig å verifisere påstander

---

## Nøkkelbeslutninger

### 1. Kategori-quote med sammensatt score

**Hva:** Automatisk generert karakteristikk per tema som beskriver områdets karakter.

**Faktorer:**
| Faktor | Vekt | Logikk |
|--------|------|--------|
| Antall POI-er | 30% | Flere = bedre |
| Gjennomsnittlig rating | 25% | Høyere = bedre |
| Nærhet (gangavstand) | 25% | Flere innen 5 min = bedre |
| Variasjon (underkategorier) | 20% | Flere typer = bedre |

**Score-terskler:**
| Score | Quote-stil |
|-------|------------|
| 90+ | Eksepsjonelt / Enestående |
| 75-89 | Svært godt / Rikt |
| 60-74 | Godt / Solid |
| 40-59 | Tilstrekkelig / Noe |
| < 40 | Begrenset / Få |

**Eksempel-quotes:**
- Mat (høy score + høy variasjon): "Matmekka med alt fra gatemat til fine dining"
- Mat (høy score + lav variasjon): "Sterk café-kultur"
- Transport (høy score): "Knutepunkt med alle transportformer"

### 2. Adresse-input i transport-seksjon

**Hva:** Bruker skriver inn sin adresse → får personlig reisetid fra eiendommen.

**Hvorfor:**
- "12 min til MIN jobb" er mer overbevisende enn "nær sentrum"
- Konkret, kontekstuell interaktivitet
- Brukere som bruker dette er seriøse (lead-signal)

**Teknisk:** Allerede bygget tidligere, kan gjenbrukes.

### 3. Hero-bilde (lavere prioritet)

**Hva:** Konfigurerbart hero-bilde i toppen av Report.

**Hvorfor:** Visuell punch, første inntrykk.

**Status:** Nedprioritert — kan legges til senere.

---

## Hva vi IKKE gjør

- **Global segmenteringsspørsmål** — Kategoriene i toppen er allerede valgt for målgruppen
- **Ny CTA-seksjon** — Finnes allerede (ExplorerCTA)
- **Kollektivinfo i hero** — Dekkes av transport-seksjonen
- **Sammenligning med andre områder (interaktiv)** — For komplekst nå, men quote-systemet gir implisitt sammenligning

---

## Åpne spørsmål

1. **Quote-templates:** Hvor mange forhåndsdefinerte quotes per kategori? Skal de kunne overstyres manuelt?
2. **Score-synlighet:** Skal selve scoren (f.eks. 82/100) vises, eller bare quoten?
3. **Adresse-input UX:** Autocomplete? Validering? Feilhåndtering?
4. **Mobil-opplevelse:** Hvordan fungerer adresse-input på mobil?

---

## Teknisk kontekst

**Eksisterende infrastruktur som kan gjenbrukes:**
- Mapbox Directions API (`/api/directions`) — reisetidsberegning
- Travel time-logikk i Explorer — kan adapteres
- POI-data med kategorier og ratings — allerede tilgjengelig
- ReportConfig — kan utvides med nye felter

**Nye komponenter som trengs:**
- `calculateCategoryScore()` — sammensatt score-beregning
- `generateCategoryQuote()` — quote-generering basert på score
- `AddressInput` komponent — gjenbruk/tilpassing fra tidligere versjon
- Utvidelse av `ReportThemeSection` — vise quote

---

## Prioritert rekkefølge

1. **Kategori-quote system** — Høyest verdi, moderat kompleksitet
2. **Adresse-input i transport** — Høy verdi, lav kompleksitet (gjenbruk)
3. **Hero-bilde** — Lavere verdi, lav kompleksitet

---

*Brainstorm gjennomført 2026-02-05*
