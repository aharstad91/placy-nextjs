# Brainstorm: Trips-samleside redesign

**Dato:** 2026-02-09
**Kontekst:** Trips-samlesiden ser tom ut med kun 1 dummy-trip. Trenger mer innhold + nytt design inspirert av Apple Store.

---

## Problem

1. **Innholdsmangel** — Kun 1 trip ("Art and Vintage" / Trondheim Byvandring i culture-kategorien)
2. **Design** — Nåværende layout: enkel kategori-filtrering + 160px kort i horisontal scroll. Fungerer med mange trips, men ser fattig ut med 1.
3. **Ønsket opplevelse** — Apple Store-aktig med kategori-kort topp, fremhevede trips, kategorirader.

---

## Utfordring 1: Innhold (seed-trips)

Vi har to valg:

### A) Lage ekte trips i Supabase (anbefalt)
- Trondheim har rikelig med POI-er i systemet allerede (258 steder innenfor gangavstand fra Scandic Nidelven)
- Vi kan lage 4-6 trips med variasjon i kategori/vanskelighetsgrad
- Fordel: Ekte data, tester hele systemet end-to-end, gir realistisk opplevelse
- Ulempe: Trenger seed-script + manuell kurering av stopp/tekster

**Forslag til trips:**

| Trip | Kategori | Stopp | Beskrivelse |
|------|----------|-------|-------------|
| Trondheim Byvandring | culture | 6 | (eksisterende) |
| Bakklandet & Bryggene | culture | 5 | Historisk vandring langs Nidelva |
| Best of Coffee | food | 4 | Trondheims beste kaffebarrar |
| Foodie Walk | food | 6 | Smak av byen — fra bakeri til fine dining |
| Fjordstien | nature | 4 | Naturtur langs fjorden |
| Family Fun | family | 5 | Barnevennlige aktiviteter i sentrum |

### B) Dummy-data i frontend (rask, men falsk)
- Hardkodede kort-data som ikke leder noe sted
- Kun for design-prototyping
- Ulempe: Må fjernes igjen, tester ikke systemet

**Beslutning:** Vi bør gå for A — lage ekte seed-trips. Men vi trenger ikke perfekt innhold; seed-data med rimelige titler og noen stopp holder.

---

## Utfordring 2: Design — Apple Store-inspirert layout

### Referanse: Apple Store (apple.com/no/store)
1. **Topp:** Kategori-navigasjon med ikoner (Mac, iPhone, iPad osv.) — runde bilder med label under
2. **"Akkurat kommet inn":** Store produktkort horisontalt med bilde, tittel, pris — mørk bakgrunn
3. **Lenger ned:** Kategorirader med produktkort

### Oversatt til Placy Trips:

#### Seksjon 1: Kategori-kort (gjenbruk fra Report)
- Grid med kategori-kort som i ReportHero (bilde #8)
- Ikon + kategorinavn + antall trips
- Klikk = scroll til kategori-seksjon (eller filter)
- **Kan gjenbruke** designet fra `ReportHero.tsx` linje 122-158

#### Seksjon 2: Fremhevede trips (Featured)
- Store horisontale kort (ala Apple "Akkurat kommet inn")
- Flagget med `featured: true` i trip-data
- Bredere kort med bilde, tittel, beskrivelse, kategori-badge, varighet
- Horisontal scroll med snap

#### Seksjon 3: Kategorirader
- Per kategori: overskrift + horisontale trip-kort
- Samme mønster som nå, men med større/rikere kort
- Viser bare kategorier som har trips

### Trip-kort design (oppgradert)

Nåværende kort: 160px bredt, 4:5, minimalt info.

**Foreslått oppgradering:**

**Featured kort (stort):**
- ~300px bredt, 16:9 eller 3:4 aspect ratio
- Bakgrunnsbilde med gradient overlay
- Tittel (stor), beskrivelse (1 linje), kategori-badge
- Varighet + antall stopp + vanskelighetsgrad
- Snap scroll

**Standard kort (i kategorirader):**
- ~200px bredt, 4:5 aspect ratio
- Cover image
- Tittel, varighet, stopp-count, vanskelighetsgrad
- Subtilt rikere enn nåværende

---

## Foreslått layout (top → bottom)

```
┌─────────────────────────────────────────┐
│ Header: "Utforsk turer"                 │
│ Søkefelt                                │
├─────────────────────────────────────────┤
│ Kategori-kort (grid, fra Report)        │
│ [🍽 Mat] [🏛 Kultur] [🌿 Natur] [👨‍👩‍👧 Familie] │
├─────────────────────────────────────────┤
│ "Anbefalt" — Featured trips             │
│ [═══ Stort kort ═══] [═══ Stort kort ═══│
├─────────────────────────────────────────┤
│ "Mat & Drikke"                      >   │
│ [kort] [kort] [kort]                    │
├─────────────────────────────────────────┤
│ "Kultur & Opplevelser"              >   │
│ [kort] [kort] [kort]                    │
└─────────────────────────────────────────┘
```

---

## Scope-forslag

### Fase 1 (nå): Seed-data + Redesign
1. **Lag seed-migration** med 5-6 trips + project_trips-koblinger
2. **Redesign TripLibraryClient** med Apple Store-inspirert layout
3. **Kategori-kort** gjenbrukt fra Report-design
4. **Featured-seksjon** for trips flagget `featured: true`
5. **Oppgraderte standard-kort** i kategorirader

### Fase 2 (senere): Polering
- Cover-bilder for alle trips (kan bruke Unsplash/Mapbox static for nå)
- Animasjoner og overganger
- Trip-preview hover-effekt

---

## Åpne spørsmål

1. **Seed-data:** Skal vi lage en SQL-migrasjon med trips, eller et Node-script?
2. **POI-er:** Skal seed-trips bruke eksisterende POI-er fra Scandic Nidelven-prosjektet, eller trenger vi nye?
3. **Bilder:** Hva bruker vi som cover-bilder for seed-trips? Mapbox static images? Placeholder gradients?
4. **Kategori-kort:** Skal de filtrere (som nå) eller scrolle til seksjon (som i Report)?
