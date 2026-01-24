# Placy - Konsept og Funksjonsspesifikasjon

> **Formål:** Teknologi-agnostisk dokumentasjon av Placy som produkt og system.
> Dette dokumentet beskriver *hva* Placy gjør, ikke *hvordan* det er bygget.

---

## 1. Produktvisjon

### Hva er Placy?
Placy er en **lokasjonsbasert storytelling-plattform** som kombinerer:
- **Kuratert lokalkunnskap** (redaksjonelt innhold)
- **Google Places-data** (ratings, bilder, kontaktinfo)
- **Sanntids transport-data** (kollektivtransport, bysykkel, bildeling)

Resultatet er interaktive "nabolagsfortellinger" som gir brukere et komplett bilde av et område - noe verken Google Maps eller tradisjonelle nettsider kan levere alene.

### Kjerneproposisjon
> "Placy kombinerer det Google vet med det bare lokalbefolkningen vet."

---

## 2. Målgrupper

### Sluttbrukere (B2C)
| Segment | Behov | Bruksmønster |
|---------|-------|--------------|
| **Boligkjøpere** | Forstå nabolaget før kjøp | Utforsker transport, fasiliteter, stemning |
| **Leietakere (næring)** | Evaluere beliggenhet for ansatte | Ser på lunsjtilbud, møteplasser, parkering |
| **Turister (nasjonal/internasjonal)** | Oppdage autentiske steder | Lokale favoritter vs turistfeller |
| **Messer/arrangementer** | Orientere seg i ukjent område | Transport, mat, overnatting nær venue |

### Kunder (B2B)
| Segment | Bruk av Placy |
|---------|---------------|
| **Eiendomsutviklere** | Markedsføre boligprosjekter med nabolagsinnhold |
| **Næringseiendom** | Vise fasiliteter rundt kontorbygg |
| **Kommuner/destinasjoner** | Presentere områder for tilflyttere/turister |
| **Hoteller/konferanser** | Guide for gjester |

---

## 3. Kjerneentiteter (Datamodell)

### 3.1 Project (Prosjekt)
**Definisjon:** En container som representerer en kunde, et bygg, eller et geografisk fokusområde.

| Attributt | Beskrivelse |
|-----------|-------------|
| `name` | Prosjektnavn (f.eks. "Ferjemannsveien 10") |
| `customer` | Tilhørende kunde/organisasjon |
| `center_coordinates` | Lat/lng for prosjektets senterpunkt |
| `url_slug` | URL-struktur: `/kunde/prosjekt/` |

**Relasjoner:**
- Har mange **Stories**
- Har mange **POI-er** (via Stories eller direkte)

---

### 3.2 Point of Interest (POI)
**Definisjon:** Et fysisk sted som vises på kart og i lister.

#### To typer med felles visning:
| Type | Datakilde | Redaksjonell kontroll |
|------|-----------|----------------------|
| **Native Point** | Manuelt opprettet | Full kontroll - egen data |
| **Google Point** | Importert fra Google Places | Begrenset - synkronisert data |

#### Felles datastruktur:
| Felt | Type | Beskrivelse |
|------|------|-------------|
| `name` | Text | Stedsnavn |
| `coordinates` | Lat/Lng | Geografisk posisjon |
| `address` | Text | Gateadresse |
| `category` | Taxonomy | Kategori (Restaurant, Treningssenter, etc.) |
| `description` | Rich text | Beskrivelse av stedet |
| `featured_image` | Image | Hovedbilde |

#### Google-spesifikke felt (synkronisert):
| Felt | Beskrivelse |
|------|-------------|
| `google_place_id` | Unik Google-identifikator |
| `google_rating` | Stjernebedømning (1-5) |
| `google_review_count` | Antall anmeldelser |
| `google_maps_url` | Lenke til Google Maps |
| `photo_reference` | For å hente bilder via API |

#### Redaksjonelle felt (Storytelling):
| Felt | Beskrivelse | Eksempel |
|------|-------------|----------|
| `editorial_hook` | Én setning om det unike | "Bokhandel og bar i ett - oppkalt etter Hamsuns hovedperson" |
| `local_insight` | Insider-kunnskap | "Spør om 'hidden shelf' for sjeldne førsteutgaver" |
| `story_priority` | Viktighet | must_have / nice_to_have / filler |
| `editorial_sources` | Kildehenvisninger | Tripadvisor, lokale blogger, etc. |

#### Transport-integrasjoner (per POI):
| Felt | Tjeneste | Data som vises |
|------|----------|----------------|
| `entur_stopplace_id` | Entur | Sanntids avganger |
| `bysykkel_station_id` | Trondheim Bysykkel | Ledige sykler/låser |
| `hyre_station_id` | Hyre | Ledige biler |

---

### 3.3 Story
**Definisjon:** En narrativ presentasjon av et område, bygget opp av seksjoner og POI-er.

| Attributt | Beskrivelse |
|-----------|-------------|
| `title` | Story-tittel |
| `project` | Tilhørende prosjekt |
| `sections` | Ordnet liste av innholdsseksjoner |

**Innholdstyper i en Story:**
- Tekst-seksjoner
- Bilde-gallerier
- POI-lister
- Theme Story CTAs (lenker til dypdykk)
- Kart-seksjoner

---

### 3.4 Theme Story
**Definisjon:** Et tematisk dypdykk som åpnes i en fullskjerms-modal.

| Attributt | Beskrivelse |
|-----------|-------------|
| `title` | Tema-tittel (f.eks. "Mat & Drikke") |
| `parent_story` | Hvilken Story den tilhører |
| `poi_list` | Kuratert liste av relevante POI-er |
| `bridge_text` | Kort intro-tekst |

**Layout:** 50/50 split
- Venstre: Scrollbar liste med POI-kort og tekst
- Høyre: Interaktivt kart med markers

---

### 3.5 Category (Kategori)
**Definisjon:** Klassifisering av POI-er.

| Attributt | Beskrivelse |
|-----------|-------------|
| `name` | Kategorinavn |
| `icon` | FontAwesome-ikon |
| `color` | Hex-farge for marker |

**Eksempel-kategorier:**
- Restaurant, Kafé, Bar, Bakeri
- Treningssenter, Svømmehall
- Busstopp, Bysykkelstasjon
- Hotell, Museum, Park

---

## 4. Brukeropplevelser (UX)

### 4.1 Story Page - Hovedvisning

**Struktur:**
```
┌─────────────────────────────────────┐
│  Hero Section                       │
│  - Tittel, intro, bakgrunnsbilde    │
├─────────────────────────────────────┤
│  Section 1: Tekst + media           │
├─────────────────────────────────────┤
│  Section 2: POI-liste               │
│  - POI-kort med "Vis på kart" CTA   │
├─────────────────────────────────────┤
│  Theme Story CTA                    │
│  → Åpner mega-modal ved klikk       │
├─────────────────────────────────────┤
│  Section 3: Mer innhold...          │
├─────────────────────────────────────┤
│  Master Map CTA                     │
│  → Åpner oversiktskart              │
└─────────────────────────────────────┘
```

**Brukerreise:**
1. Bruker scroller ned gjennom seksjoner
2. Klikker på POI-kort → Theme Story modal åpnes
3. I modal: Utforsker kart og liste synkronisert
4. Lukker modal → Tilbake til story

---

### 4.2 Theme Story Modal (Mega-Modal)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [X Lukk]                              Topbar        │
├───────────────────────┬─────────────────────────────┤
│                       │                             │
│  Venstre kolonne      │  Høyre kolonne              │
│  (scrollbar)          │  (fast kart)                │
│                       │                             │
│  ┌─────────────────┐  │  ┌───────────────────────┐  │
│  │ Travel Controls │  │  │                       │  │
│  │ [Gå][Sykle][Bil]│  │  │      MAPBOX KART      │  │
│  │ [5][10][15] min │  │  │                       │  │
│  └─────────────────┘  │  │   • Marker 1          │  │
│                       │  │        • Marker 2     │  │
│  POI Kort 1           │  │   • Marker 3          │  │
│  ├─ Bilde/ikon        │  │                       │  │
│  ├─ Navn + kategori   │  │   [Aktiv rute vises]  │  │
│  ├─ Rating ★ 4.5      │  │                       │  │
│  ├─ Reisetid: 5 min   │  └───────────────────────┘  │
│  └─ [Vis på kart]     │                             │
│                       │                             │
│  POI Kort 2...        │                             │
│                       │                             │
└───────────────────────┴─────────────────────────────┘
```

**Kritiske interaksjoner:**

1. **Klikk på POI-kort:**
   - Kart panorerer til markøren
   - Markør blir aktiv (forstørres, endrer farge)
   - Rute tegnes fra prosjekt-sentrum til POI

2. **Klikk på kart-markør:**
   - Venstre kolonne scroller til tilhørende POI-kort
   - POI-kort highlightes visuelt
   - Markør aktiveres

3. **Endre reisemodus (Gå/Sykle/Bil):**
   - Alle reisetider oppdateres
   - POI-er filtreres/dimmes basert på tidsbudsjett
   - Rute tegnes på nytt med ny modus

4. **Endre tidsbudsjett (5/10/15 min):**
   - POI-er innenfor budsjett highlightes
   - POI-er utenfor budsjett dimmes
   - Teller oppdateres ("8 av 12 innen 10 min")

---

### 4.3 POI-kort (Komponent)

**Visuell struktur:**
```
┌──────────────────────────────────────────────┐
│ ┌────────┐  Stedsnavn                        │
│ │  Bilde │  Kategori-badge                   │
│ │  eller │  ★ 4.5 (123) Google    5 min 🚶  │
│ │  Ikon  │                                   │
│ └────────┘  🌐 Nettside  📞 +47 123 45 678  │
│                                              │
│ Editorial hook eller beskrivelse her...      │
│                                              │
│ [== Sanntidsdata (hvis aktivert) ==]         │
│ 🚌 Linje 5 → Sentrum         3 min          │
│ 🚲 Bysykkel: 4 ledige sykler                │
│                                              │
│                        [Vis på kart]         │
└──────────────────────────────────────────────┘
```

**Datakilder i kortet:**
| Element | Kilde |
|---------|-------|
| Bilde | Featured image ELLER Google Photos API |
| Navn | Native: ACF-felt / Google: Google Places |
| Rating | Google Places API |
| Reisetid | Mapbox Directions API (kalkulert) |
| Kontaktinfo | Google Places API |
| Editorial hook | Manuelt kuratert |
| Sanntidsdata | Entur/Bysykkel/Hyre API |

---

### 4.4 Master Map (Oversiktskart)

**Formål:** Vise ALLE POI-er i et prosjekt på ett kart.

**Funksjoner:**
- Kategori-filtrering (toggle kategorier av/på)
- Marker-clustering ved utzoom
- Popup ved klikk på marker
- Lenke til POI-detaljer

---

## 5. API-integrasjoner

### 5.1 Mapbox (Kritisk)

| Funksjon | API | Bruk |
|----------|-----|------|
| Kartvisning | Mapbox GL JS | Alle kart-komponenter |
| Ruting | Directions API | Reisetider og rutevisning |
| Geokoding | Geocoding API | Adresse til koordinater |

**Mapbox-konfigurasjon:**
- Access Token (server-side, aldri eksponert)
- Stil: `mapbox://styles/mapbox/streets-v12`
- Standard senter: Prosjektets koordinater
- POI-labels fra Mapbox skjules (egne markers vises)
- Mapbox token : pk.eyJ1IjoiYW5kcmVhc2hhcnN0YWQiLCJhIjoiY21keXQ3Y3EwMDVlejJucjF0dzhuc24zNSJ9.73a_RLe-4_6O3-6ubAS94g

---

### 5.2 Google Places

| Funksjon | Bruk |
|----------|------|
| Place Search | Bulk-import av POI-er |
| Place Details | Rating, anmeldelser, kontaktinfo, åpningstider |
| Photos | Bilder av steder (via proxy for caching) |

**Caching-strategi:**
- Place details: 24 timers cache
- Bilder: 30 dagers cache
- Daglig cron-jobb oppdaterer featured POI-er

---

### 5.3 Entur (Kollektivtransport)

| Endpoint | Data |
|----------|------|
| Journey Planner GraphQL | Sanntids avganger |

**Input:**
- StopPlace ID (format: `NSR:StopPlace:xxxxx`)
- Valgfritt: Quay ID (spesifikk plattform)
- Valgfritt: Transport mode filter
- Valgfritt: Linje-filter

**Output:**
- Liste over avganger med:
  - Linjenummer og destinasjon
  - Planlagt og forventet avgangstid
  - Sanntidsstatus

---

### 5.4 Trondheim Bysykkel

| Endpoint | Data |
|----------|------|
| GBFS API | Stasjonstilgjengelighet |

**Output:**
- Antall ledige sykler
- Antall ledige låser
- Stasjonsstatus (åpen/stengt)

---

### 5.5 Hyre (Bildeling)

| Endpoint | Data |
|----------|------|
| Stations API | Stasjonsliste og tilgjengelighet |

**Output:**
- Antall ledige biler
- Antall ladere
- Stasjonsstatus

---

## 6. Admin-verktøy

### 6.1 Bulk Import
**Formål:** Importere mange Google-steder på én gang.

**Workflow:**
1. Velg prosjekt
2. Velg stedskategori (120+ typer)
3. Definer søkeradius
4. Importer → Oppretter Google Points

**Kategori-eksempler:**
- Mat & Drikke: restaurant, cafe, bar, bakery
- Overnatting: hotel, hostel, bed_and_breakfast
- Shopping: shopping_center, store, supermarket
- Tjenester: bank, pharmacy, post_office

---

### 6.2 Editorial Hook Generator
**Formål:** AI-assistert generering av redaksjonelt innhold.

**Workflow:**
1. Velg POI-er som mangler hooks
2. Generer prompt for Claude
3. Claude søker på nettet etter kilder
4. Genererer hooks basert på verifisert informasjon
5. Lagrer med kildehenvisninger

**Output per POI:**
- `editorial_hook` - Én setning
- `local_insight` - Insider-tips
- `story_priority` - Viktighet
- `editorial_sources` - Kilder brukt

---

### 6.3 Story Generator
**Formål:** Automatisk generere kapittelstruktur.

**Input:**
- Koordinater (senterpunkt)
- Radius
- Språk (norsk/engelsk)
- Målgruppe (valgfritt)

**Output:**
- Kapitler gruppert etter kategori:
  - Transport & Mobilitet
  - Mat & Drikke
  - Daglige Ærender
  - Trening & Helse
  - Kultur & Fritid
  - etc.
- Bridge-tekst per kapittel
- Fremhevede POI-er per kapittel

---

## 7. URL-struktur

```
placy.no/
├── {kunde}/
│   └── {prosjekt}/
│       ├── (Story page - default)
│       └── ?theme={theme-story-slug} (Deep link til Theme Story)
```

**Eksempel:**
- `placy.no/klp-eiendom/ferjemannsveien-10/`
- `placy.no/klp-eiendom/ferjemannsveien-10/?theme=mat-og-drikke`

---

## 8. Distribusjon

### Primær
- **Standalone:** `placy.no/{kunde}/{prosjekt}/`

### Sekundær (fremtidig)
- **Iframe embed:** Kunders nettsider
- **API:** Headless tilgang til data
- **Widget:** Kompakt kartvisning

---

## 9. Global State Management

### Delt tilstand på tvers av komponenter:

| State | Verdier | Persistering |
|-------|---------|--------------|
| `travelMode` | walk, bike, car | localStorage |
| `timeBudget` | 5, 10, 15, 20, 30 min | localStorage |
| `activeModal` | Theme Story ID eller null | Kun session |

### Event-system:
- `placy:travelModeChange` - Når reisemodus endres
- `placy:timeBudgetChange` - Når tidsbudsjett endres

Alle komponenter (sidebar, modaler, kart) lytter og synkroniserer.

---

## 10. Ytelse og Caching

### API-caching
| Data | TTL | Strategi |
|------|-----|----------|
| Google Place Details | 24 timer | Transient cache |
| Google Photos | 30 dager | Proxy med disk-cache |
| Entur avganger | Ingen | Sanntid |
| Bysykkel/Hyre | Ingen | Sanntid (1 min polling) |
| Mapbox tiles | Browser | Standard cache headers |
- NOTE: sjeldent at punkter endrer seg, så vi kan være svært konservative med oppdatering av api fetching, minst mulig ressursbruk

### Kart-optimalisering
- Lazy loading av kart (desktop: inline, mobil: on-demand)
- Marker clustering ved mange POI-er
- Skjul Mapbox standard POI-labels

---

## 11. Fremtidige behov

### Bekreftet
- [ ] Mobil-UX redesign (ikke prioritert hittil)
- [ ] Flerspråklighet (norsk + engelsk minimum)
- [ ] Flere geografiske områder (skalerbart utover Trondheim)

### Potensielt
- [ ] Bruker-personalisering basert på segment
- [ ] API-first arkitektur for tredjepartsintegrasjoner
- [ ] Offline-støtte (PWA)

---

## 12. Oppsummering - Kjerneprinsippene

1. **POI-er er gullet** - Kombinasjonen av Native (lokalkunnskap) + Google (data) er unik
2. **Kart og liste er synkronisert** - Klikk ett sted, oppdater begge
3. **Reisetid er kontekstuelt** - Alt vurderes i forhold til prosjektets sentrum
4. **Sanntidsdata gir ekstra verdi** - Transport-info er live
5. **Editorial hooks differensierer** - Det Google ikke vet, vet Placy
6. **Stories er fleksible** - Kapitler og Theme Stories kan struktureres fritt

---

## 13. Visuell Referanse (Bekreftet via Live Demo)

### Story Page Layout
```
┌──────────────────────────────────────────────────────────────┐
│ ┌─────────────┐                                              │
│ │  SIDEBAR    │  MAIN CONTENT                                │
│ │             │                                              │
│ │ Story Index │  ┌────────────────────────────────────────┐  │
│ │             │  │  Hero Images (2-up grid)               │  │
│ │ CHAPTERS    │  └────────────────────────────────────────┘  │
│ │ • Menypunkt1│                                              │
│ │ • Menypunkt2│  Tittel + Intro-tekst                        │
│ │             │                                              │
│ │ ─────────── │  ┌─────────────────────────────────────────┐ │
│ │ GLOBAL      │  │ KATEGORI-LABEL                          │ │
│ │ SETTINGS    │  │ Kapitteltittel                          │ │
│ │             │  │ Bridge-tekst som forklarer kategorien   │ │
│ │ Travel Mode │  │                                         │ │
│ │ [Gå][Sy][Bi]│  │ ┌────┐ ┌────┐ ┌────┐ ┌──────────────┐  │ │
│ │             │  │ │POI │ │POI │ │POI │ │ Se alle      │  │ │
│ │ Time Budget │  │ │Card│ │Card│ │Card│ │ punkter →    │  │ │
│ │ [5][10][15] │  │ └────┘ └────┘ └────┘ └──────────────┘  │ │
│ │             │  └─────────────────────────────────────────┘ │
│ │ [Open Map]  │                                              │
│ └─────────────┘  Neste seksjon...                            │
└──────────────────────────────────────────────────────────────┘
```

### Theme Story Modal (Mega-Modal)
```
┌────────────────────────────────────────────────────────────────────┐
│ NEIGHBORHOOD STORY                                          [X]    │
├────────────────────────────────┬───────────────────────────────────┤
│                                │                                   │
│  Kapitteltittel                │         MAPBOX KART               │
│  10 places found               │                                   │
│  10 highlighted within ≤15 min │    ┌─┐ Ferjemannsveien 10        │
│                                │    └─┘ (prosjekt-sentrum)        │
│  Travel Mode  Time Budget      │         │                        │
│  [Gå][Sy][Bi] [5][10][15]      │         │ Rute                   │
│                                │         │ ┌─────┐                │
│  🔍 Search places...           │         └─┤2 min├──●             │
│                                │           └─────┘  POI           │
│  ══════════════════════════    │                                   │
│  Seksjon: Sykkel               │      ● Andre markers              │
│  [Illustrasjon]                │           ●                       │
│                                │        ●     ●                    │
│  ┌────────────────────────┐    │                                   │
│  │ 🚲 Bysykkel: Bakke bru │    │                                   │
│  │    2 min  [Se på kart] │    │                                   │
│  └────────────────────────┘    │                                   │
│                                │                                   │
│  ┌────────────────────────┐    │                                   │
│  │ 🚲 Bysykkel: Dokkparken│    │                                   │
│  │    4 min  [Se på kart] │    │                                   │
│  └────────────────────────┘    │                                   │
│                                │                                   │
│  Seksjon: Buss og kollektivt   │                                   │
│  ▶ Bakkegata bussholdeplass    │                                   │
│                                │                                   │
└────────────────────────────────┴───────────────────────────────────┘
```

### Kritiske UI-detaljer (Bekreftet)

| Element | Oppførsel |
|---------|-----------|
| **Rute på kart** | Blå linje fra prosjekt-sentrum til aktiv POI |
| **Reisetid-badge** | Vises på selve ruten, f.eks. "2 min" |
| **Aktiv marker** | Forstørres + viser label med POI-navn |
| **Travel mode sync** | Endring i modal oppdaterer sidebar OG POI-kort |
| **Tid-labels** | Endres fra "min walk" til "min bike" ved modus-bytte |
| **Persistering** | Travel mode huskes etter modal lukkes (localStorage) |

### POI-kort i Preview-grid
```
┌─────────────────────────────┐
│         ⏱ 1 min bike       │  ← Reisetid + modus
│     ┌─────────────────┐     │
│     │    (ikon)       │     │  ← Kategori-ikon som fallback
│     └─────────────────┘     │
│  PLACE              ★ 4.5   │  ← Type + Google rating
│  Stedsnavn som kan være...  │  ← Truncated navn
└─────────────────────────────┘
```

---

*Dokumentet oppdatert: 2026-01-24*
*Kilde: Analyse av eksisterende Placy-kodebase + produkteier-intervju + live demo*
