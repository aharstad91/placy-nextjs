# Brainstorm: POI Trust Validation Pipeline

**Dato:** 2026-02-08
**Status:** Besluttet — klar for plan

## Hva vi bygger

Tre-lags tillitsvalidering av Google Places-POIs integrert i Claude Code import-workflow. Hvert sted som importeres får en `trust_score` (0.0–1.0) basert på heuristikker, nettside-verifisering, og Claude Code-analyse med websøk. POIs med `trust_score < 0.5` vises ikke i Explorer.

## Hvorfor denne tilnærmingen

### Problemet
- Google Places returnerer POIs som ser legitime ut på data (god rating, mange reviews, bilder) men er fake/ubrukelige
- Eksempel: "Château de Sorgenfri" — 5.0 rating, 52 reviews, "Open 24 hours" — viser seg å være et studentprosjekt
- Nåværende filtre (rating, type, avstand) fanger ikke dette
- Spesielt kritisk i nye byer/områder der teamet ikke har lokal kunnskap
- Placy som innsiktskilde kan skades av å vise upålitelige steder

### Hvorfor tre lag
- **Lag 1** (Google-data) er billig og fanger åpenbare tilfeller (stengt, ingen nettside, mistenkelig profil)
- **Lag 2** (nettside-sjekk) er gratis og fanger studentprosjekter og parked domains
- **Lag 3** (Claude Code) er grundig og fanger alt som de to første ikke plukker opp
- Alle tre kjører for alle POIs — tid er akseptabelt, grundighet prioritert over hastighet

## Nøkkelbeslutninger

### 1. Claude Code er validatoren
- Ingen Anthropic API-nøkkel trengs — Claude Code bruker eksisterende Max-abonnement
- Validering kjøres som del av CLI-workflow (f.eks. `/hotell-new` eller `npm run validate-pois`)
- Claude Code gjør websøk, sjekker nettsider, vurderer legitimitet — nativt i verktøyet
- Import via admin-UI lagrer med `trust_score: null`, Claude Code validerer etterpå

### 2. Tre-lags validering

| Lag | Hva | Kostnad | Hva det fanger |
|-----|-----|---------|----------------|
| **1: Google-data** | Hent `website`, `business_status`, `price_level` fra Places Details | ~$0.017/POI | Stengte steder, manglende nettside, mistenkelig profil |
| **2: Nettside-sjekk** | HTTP HEAD til website-URL, domene-analyse | Gratis | Studentprosjekter (.ntnu.no), døde lenker, parkerte domener |
| **3: Claude full sjekk** | Websøk, TripAdvisor/Yelp-sjekk, helhetsvurdering | Inkludert i abonnement | Sofistikerte fakes, steder uten digital tilstedeværelse |

### 3. Trust score modell

**Lagring:** `trust_score DECIMAL` (0.0–1.0) + `trust_flags TEXT[]` på POI-tabellen

**Positive signaler (øker score):**
- Har fungerende nettside (+)
- Funnet på TripAdvisor / Yelp / Facebook (+++)
- Konsistent navn/brand på tvers av kilder (+)
- Har telefonnummer (+)
- Naturlig review-distribusjon (ikke perfekt 5.0) (+)
- `price_level` satt av Google (+)
- `business_status` = OPERATIONAL (+)

**Negative signaler (senker score):**
- Ingen nettside (-)
- Perfekt 5.0 med < 100 reviews (-)
- "Open 24 hours" for mat/kafé (-)
- Ikke funnet på noen annen plattform (---)
- Nettside er studentprosjekt-URL (.ntnu.no, .uio.no) (---)
- Adresse er bolig/institusjon (-)
- Reviews konsentrert i kort tidsperiode (-)

### 4. Terskel og synlighet
- `trust_score >= 0.5` → vises i Explorer
- `trust_score < 0.5` → lagres men vises ikke, kan godkjennes manuelt
- `trust_score = null` → ikke validert ennå, vises midlertidig (bakoverkompatibilitet)

### 5. Scope
- **Kun Google Places-POIs** — Transport fra Entur/Bysykkel er offentlig infrastruktur, trenger ikke validering
- Alle Google-kategorier valideres (restaurant, kafé, museum, gym, etc.)

### 6. Workflow-flyt
```
Bruker kjører /hotell-new (eller annen import-skill)
    ↓
1. Import-API henter POIs fra Google Places → lagres med trust_score=null
    ↓
2. Claude Code leser nye POIs fra database
    ↓
3. For hver POI:
   a) Lag 1: Hent website + business_status fra Google Details API
   b) Lag 2: HTTP HEAD til website, sjekk domene
   c) Lag 3: Websøk "{navn} {by}", sjekk TripAdvisor/Yelp, vurder
    ↓
4. Claude Code oppdaterer trust_score + trust_flags i database
    ↓
5. Explorer filtrerer: kun trust_score >= 0.5
```

## Åpne spørsmål

- **Batch-størrelse:** Hvor mange POIs bør Claude Code validere per iterasjon? 10? 50? Alle?
- **Re-validering:** Skal eksisterende POIs re-valideres ved re-import, eller kun nye?
- **Admin UI:** Bør admin-panelet vise flaggede POIs med "Godkjenn/Avvis"-knapper?
- **Trust score decay:** Bør score oppdateres over tid (steder kan stenge)?

## Parkerte ideer

1. **TripAdvisor API** — Betalt, men ville gitt strukturert data. Parkert for nå, Claude websøk gir tilsvarende signal.
2. **Google review-analyse** — Parse individuelle reviews for mønster (alle fra samme dato). Mulig oppfølging.
3. **Foto-analyse** — Claude vurderer om bildene ser ut som et ekte sted. Interessant men overkill nå.
4. **Crowd-sourced validering** — La brukere rapportere fakes. Langsiktig.

## Neste steg

Kjør `/workflows:plan` for å implementere trust_score-feltet, valideringslogikk (Lag 1+2 i TypeScript, Lag 3 som Claude Code skill-instruksjon), og Explorer-filtrering.
