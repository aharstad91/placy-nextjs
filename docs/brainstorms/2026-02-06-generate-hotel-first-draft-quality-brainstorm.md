---
title: "Best mulig 1.utkast fra /generate-hotel"
date: 2026-02-06
type: brainstorm
status: decided
---

# Best mulig 1.utkast fra /generate-hotel

## Hva vi utforsker

Hvordan gjøre det automatisk genererte hotelprosjektet så bra at QA-tiden er minimal. Alle tre dimensjoner teller: POI-utvalg, rapport-struktur, og redaksjonelt innhold.

## Kontekst

- **Målgruppe:** 10-20 byhoteller for 2-3 kjeder (Scandic, Thon, Radisson)
- **Bruk:** Intern QA før kunde ser det. QA-tid per prosjekt bør være under 15 min.
- **Status:** Bare 1 prosjekt generert så langt — vi vet ikke eksakt hva som feiler, men vi vet at defaults er generiske.

## Beslutning: Byhotell-profil med smarte defaults (Tilnærming A)

Én ferdig "byhotell"-profil som tuner alle knappene i generate-hotel. Ingen hotelltype-spørsmål — byhotell er default. Utvid med flere profiler senere hvis nødvendig.

### Hvorfor denne tilnærmingen

- YAGNI: Vi trenger bare byhotell nå. Å bygge et profilsystem for 3-4 hotelltyper er overdesign.
- Én profil er enkel å iterere på etter QA-erfaring.
- Infrastrukturen (`products.config`, `product_categories`, `reportConfig.themes`) eksisterer allerede — den brukes bare ikke.

### Avviste tilnærminger

- **B: Hotelltype-checkpoint** — Overdesign. Bare byhotell trengs nå. Kan legges til senere uten refaktorering.
- **C: Dynamisk profilering** — For komplekst for 10-20 hoteller. YAGNI.

## Hva profilen skal tune

### 1. POI-kategorier

**Nåværende (generisk):** restaurant, cafe, bar, bakery, supermarket, pharmacy, gym, park, museum, library

**Byhotell-profil:**
- **Beholde:** restaurant, cafe, bar, bakery, supermarket, pharmacy, gym, park, museum, library
- **Legge til:** shopping_mall, movie_theater, hair_care, spa
- **Transport:** Entur + Bysykkel (som nå)
- **Droppe:** hospital, doctor, dentist, hotel (irrelevant for hotellgjester)

### 2. Discovery-parametere

| Parameter | Nåværende | Byhotell-profil | Begrunnelse |
|-----------|-----------|-----------------|-------------|
| radiusMeters | 1000 | 800 | Gangavstand i by. 1000m fanger for mye støy. |
| minRating | 0 | 3.5 | Filtrer bort dårlige steder. Hotellgjester vil ha kvalitet. |
| maxResultsPerCategory | 20 | 15 | Færre, bedre treff. Reduserer QA-opprydding. |

### 2b. POI-prioritering og scoring

**Beslutning:** Automatisk scoring for å velge de beste stedene. Ikke manuell/editorial kuratering.

**Scoring-formel (konsept):**

```
score = (rating × reviewWeight) + proximityBonus
```

- **rating:** Google-rating (1-5). Normalisert.
- **reviewWeight:** Steder med mange anmeldelser er mer pålitelige. `min(reviewCount / 50, 1.0)` gir full vekt ved 50+ reviews.
- **proximityBonus:** Steder innen 5 min gange får bonus. Avtar lineært til 0 ved 15 min.

Sortert etter score innen hver kategori.

### 2c. Featured highlights (topp 5)

**Beslutning:** Automatisk. Topp 5 POI-er på tvers av alle kategorier (ekskl. transport) basert på score. Disse får ekstra synlighet i Report (f.eks. hero-seksjon eller "Våre anbefalinger").

Kriterier for featured:
- Høy score (rating × reviews × nærhet)
- Maks 2 fra samme kategori (diversitet)
- Ikke transport-POI-er

### 2d. Smart capping per kategori (Report)

**Beslutning:** Variabel capping basert på viktighet for hotellgjester.

| Kategori-gruppe | Maks i Report | Begrunnelse |
|-----------------|---------------|-------------|
| Mat & Drikke (restaurant, cafe, bar, bakery) | 5-8 totalt | Viktigst for gjester. Mer bredde. |
| Kultur (museum, library, cinema, park) | 3 | Supplement, ikke hovedfokus. |
| Hverdagsbehov (supermarket, pharmacy, shopping, haircare) | 3 | Convenience. Trenger ikke mange. |
| Transport (bus, tram, train, bike) | Alle | Alltid relevant. Kort liste uansett. |
| Trening (gym, spa) | 3 | Nisje. Få er nok. |

Explorer får alle importerte POI-er (ingen capping).

### 3. Report themes og rekkefølge

**Nåværende rekkefølge:** mat-drikke, transport, trening-helse, daglig-liv, kultur-fritid

**Byhotell-profil (prioritert for gjester):**

1. **Mat & Drikke** — Det første en gjest lurer på
2. **Kultur & Opplevelser** — Hva kan jeg gjøre her?
3. **Hverdagsbehov** — Dagligvare, apotek, shopping
4. **Transport** — Hvordan kommer jeg meg rundt?
5. **Trening & Velvære** — For lengre opphold

Hver theme bør ha byhotell-tilpasset bridgeText, f.eks.:
- Nå: "Fra verdensmesterkaffe til lokale favoritter – her er spisestedene i nabolaget."
- Byhotell: "Restauranter og kafeer du kan gå til fra hotellet."

### 4. Prompt-design for AI-tekster

#### Overordnet redaksjonell vinkel

**"Slik bruker lokalbefolkningen nabolaget."**

Ikke turistguide, ikke hotellreklame. Insider-perspektiv. Teksten skal føles som en venn som bor i bydelen og forteller deg hvor de faktisk går. Monocle/Kinfolk-inspirert: kort, opinionated, curated.

**Dobbelt publikum:** Hotellet kjøper produktet (må føle det er verdt å betale for), gjesten leser det (må føle det er nyttig og autentisk).

**Språk:** Både norsk og engelsk genereres samtidig.

#### Prompt-prinsipp: Fakta først, stil etterpå

Teksten MÅ forankres i verifiserbare fakta. Prompten får:
- Hotellnavn og adresse
- Bydel/nabolagsnavn (fra geocode)
- Bynavn
- Liste over faktiske POI-er med: navn, kategori, rating, antall reviews, gangtid
- Featured POI-er markert

Regel: **Aldri påstå noe som ikke kan verifiseres fra inputdata eller nettsøk.** "Fargerike trebygg" funker for Bakklandet men ikke Stjørdal — prompten må si "beskriv basert på søkeresultat, ikke gjett".

#### Tre teksttyper med eksempler

**1. Report-intro (1 per rapport)**

Stil: Kort og confident. Stedsspesifikk. Forankret i bydel.

```
Bakklandet, Trondheim. Fargerike trebygg langs Nidelva, kafeer ved
kanalbrua, og noen av byens beste restauranter — alt innen gangavstand
fra hotellet.
```

Prompt-kontekst: hotellnavn, bydel, bynavn, antall POI-er, topp featured-steder.
Krav: Maks 2 setninger. Nevn bydel. Beskriv kun ting som kan verifiseres.

**2. BridgeText (1 per theme)**

Stil: Kontekstuell. Kobler bydelen til kategorien. Insider-perspektiv.

```
Solsiden har blitt Trondheims matdestinasjon. Her er stedene
nærmest hotellet.
```

Prompt-kontekst: theme-navn, bydel, antall POI-er i themet, featured POI-er med navn.
Krav: Maks 2 setninger. Lokal vinkel — "slik bruker folk som bor her nabolaget".

**3. EditorialHook (1 per POI)**

Stil: Lokal kontekst. Historisk eller kulturell forankring. Ikke rating-info.

```
Har servert kaffe på Bakklandet siden 2004. Fast stopp for
lokale på vei til jobb.
```

Prompt-kontekst: POI-navn, adresse, kategori, rating, bydel. WebSearch-resultat for stedet.
Krav: 1 setning. Basert på faktisk info fra nettsøk. Lokal vinkel. Aldri generisk.

#### LocalInsight (tillegg til editorialHook)

Kort praktisk tips fra insider-perspektiv:

```
"Bestill bord etter kl 18 i helgene — populært blant lokale."
```

Krav: 1 setning. Praktisk, ikke beskrivende. Noe en lokal ville sagt.

### 5. Tospråklig generering

#### Brukeropplevelse

- **Primary:** Autodetect basert på nettleserens språk (Accept-Language header)
- **Fallback:** NO/EN toggle synlig i rapporten. Gjesten kan overstyre.
- Én URL. Ingen /report/en — språket styres client-side.

#### Datamodell: i18n-tabell

Alle genererte tekster lagres i en sentral translations-tabell. Ikke separate felter per språk.

```
translations
├── id (uuid, PK)
├── locale (text) — "no", "en", "de", etc.
├── entity_type (text) — "poi", "theme", "report"
├── entity_id (text) — POI-id, theme-id, eller rapport-id
├── field (text) — "editorial_hook", "local_insight", "bridge_text", "intro"
├── value (text) — selve teksten
├── created_at
└── updated_at
```

**Scope:** Alle gjest-synlige tekster:
- POI: editorial_hook, local_insight
- Theme: bridge_text, description
- Report: intro, closing

**Språk:** NO + EN nå. Tabellstrukturen støtter arbitrary locales uten skjemaendring.

#### Generering

/generate-hotel genererer NO + EN samtidig i samme steg:
- Prompten ber om begge språk i ett kall per tekst
- Lagres som to rader i translations-tabellen
- Eksisterende felter (editorial_hook, local_insight på POI-tabellen) beholdes som fallback for bakoverkompatibilitet

#### Frontend

- Report-komponenten leser locale fra nettleser eller toggle-state
- Henter tekster fra translations-tabellen med `locale` filter
- Fallback-kjede: translations[locale] → translations["no"] → POI.editorial_hook → null

### 5b. Report-tekster

Intro og avslutning:
- **Intro:** AI-generert per prosjekt (se seksjon 4). Lagres i translations.
- **Avslutning:** "Spør resepsjonen for flere tips — de kjenner nabolaget best." / "Ask the front desk for more tips — they know the neighbourhood best." Lagres i translations.

### 6. Report-kvalitet

Tre problemer med nåværende rapport: generisk tekst, manglende hierarki, visuell flathet.

#### 6a. Tekst: AI-generert per prosjekt

**Beslutning:** Claude genererer tilpasset tekst basert på bynavn, hotellnavn, og faktiske POI-er. Ikke håndskrevne maler.

Hva som skal genereres per prosjekt:
- **Intro:** Tilpasset til hotellnavn og bydel. Nevner konkrete steder.
- **BridgeText per theme:** Basert på faktiske POI-er i den kategorien. "3 restauranter innen 5 minutters gange — inkludert Michelin-anbefalte Credo."
- **EditorialHook per POI:** Hotellgjest-perspektiv (allerede dekket i seksjon 4).

Prompt-kontekst som trengs: hotellnavn, bydel/bynavn, liste over POI-er med rating og avstand.

#### 6b. Hierarki: Featured inni themes

**Beslutning:** Ikke en egen hero-seksjon øverst. I stedet: 1-2 featured POI-er per theme som får mer plass enn resten.

Slik det fungerer:
- Topp-scorede POI i hver theme markeres som `featured: true`
- Report-komponenten viser featured POI-er med større kort (navn, hook, rating, bilde)
- Øvrige POI-er vises kompakt (navn, rating, gangtid)

#### 6c. Visuelt: POI-bilder fra Google Places

**Beslutning:** Hent forsidebilde for featured POI-er via Google Places Photos API.

- Bare for featured POI-er (1-2 per theme = 5-10 bilder totalt)
- Lagre bilde-URL i POI-data (`imageUrl`-felt)
- Google Places Photos API gir bilder basert på `place_id`
- Fallback: Ikon/farge-kort uten bilde (som i dag)

Kostnad: Google Places Photos er gratis opp til et visst volum. For 10-20 hoteller med 5-10 bilder = 50-200 API-kall.

## Implementeringsstrategi

Profilen bør defineres som et config-objekt i generate-hotel.md, ikke som kode. Kommandoen bruker det til å:
1. Sende riktige parametere til import-API-et
2. Sette `reportConfig.themes` på prosjektet etter opprettelse
3. Populere `product_categories` for Explorer
4. Bruke tilpasset prompt for editorial hooks

## Avklarte spørsmål

1. **Bysykkel utenfor Trondheim:** Bare Trondheim nå. Legg til Oslo/Bergen når det trengs. (Alle bruker Urban Sharing / GBFS, så det er enkelt å utvide.)

2. **Radius per by:** Per-by defaults:
   - Trondheim: 800m
   - Oslo: 1000m
   - Bergen: 600m
   - Default for ukjent by: 800m

   Implementering: Geocode-resultatet gir bynavn. Skill-en slår opp i en by-tabell.

3. **Editorial hooks:** Alltid for alle (ikke-transport) POI-er. Ikke lenger valgfritt. ~2 min ekstra per prosjekt er akseptabelt for intern QA-flyt med 10-20 hoteller.

### 7. QA-workflow: Automatiske sjekker

**Beslutning:** Skill-en kjører automatiske sjekker etter generering, før den viser oppsummeringen.

Tre sjekk-kategorier:

#### POI-dekning
- Alle themes har minst 2 POI-er
- Ingen tomme seksjoner i rapporten
- Featured har minst 1 per theme

#### Bilde-dekning
- Alle featured POI-er har bilde-URL
- Verifiser at bildene faktisk laster (HTTP HEAD-sjekk)

#### Tekst-dekning
- Alle ikke-transport POI-er har `editorialHook`
- Ingen tomme/null-verdier i bridgeText

**Output-format:**
```
QA-sjekk:
✅ POI-dekning: 5/5 themes har POI-er (totalt 38)
✅ Bilder: 7/7 featured POI-er har bilde
⚠️  Tekst: 3 POI-er mangler editorialHook
   - park-bakklandet
   - supermarket-rema-1000-2
   - gym-sats-midtbyen
```

Skill-en tilbyr å fikse advarsler automatisk ("Vil du at jeg genererer hooks for de 3 manglende?").

## Neste steg

`/workflows:plan` for å lage implementeringsplan med konkrete kodeendringer i generate-hotel.md og eventuelt import-API-et.
