# POI Quality Pipeline for Bolig — Brainstorm

**Dato:** 2026-02-27
**Trigger:** Overvik-demoen er ikke salgbar pga søppeldata. Brøset-utbyggerne er potensielle kunder.

---

## Hva vi bygger

Et flerlagsfilter i POI-pipelinen som sikrer at bolig-prosjekter i forstadsområder produserer salgbar kvalitet uten manuell opprydding.

## Hvorfor dette haster

Brøset Utvikling (Trym, Heimdal, Fredensborg, Byggteknikk) har betalt 50-90k for en statisk kartløsning. Vi vil pitche dem Explorer — men Overvik-demoen har:
- **Brilliance Cleaning** tagget som Restaurant
- **MT Byggteknikk** tagget som Park
- **Parkering IKEA Leangen** tagget som Kjøpesenter
- **H2 Frisør** og **H2 Grilstad Marina** som duplikater
- **Oasen Yoga** på privat adresse uten ratings
- **Crispy Fried Chicken** 22 min unna — ikke relevant

Hotell-generatoren slipper unna fordi 800m radius i sentrum + minRating 3.5 filtrerer søppelet naturlig. Bolig i suburbia har dårligere Google-data og større radius.

## Hvorfor denne tilnærmingen

**Hybrid: grovfilter ved import + finfilter etter.**

- Grovfilter blokkerer det åpenbart gale FØR det skrives til DB
- Finfilter (trust score + LLM) scorer resten og skjuler tvilstilfeller
- Gir ren database + audit trail for grensetilfeller

## Nøkkelbeslutninger

### 1. Kategori-validering: Tre lag

| Lag | Hva | Når | Eksempel |
|-----|-----|-----|----------|
| Regelbasert | Navn-mønstre som åpenbart ikke matcher kategori | Import-tid | "Brilliance Cleaning" + category=restaurant → AVVIS |
| Google-type krysssjekk | Vår kategori vs Google primary_type/types[] | Import-tid | Google sier "moving_company" men vi sier "park" → AVVIS |
| LLM-validering | Claude vurderer tvilstilfeller | Post-import | "MT Byggteknikk" — Google sier park, men navnet sier bygg → AVVIS |

### 2. Duplikat-deteksjon: LLM-basert cluster

Send grupper av nærliggende POI-er (< 300m) til Claude: "Er noen av disse samme virksomhet?"

Fordeler: Fanger "H2 Frisør" / "H2 Grilstad Marina" som fuzzy match kanskje misser. Håndterer også "Extra Charlottenlund" vs "EXTRA Charlottenlund".

### 3. Hjemmekontor-filtrering

Kombinasjon av signaler:
- Ingen Google-rating ELLER < 5 reviews
- Ingen website
- Adresse matcher boligområde-mønster (vei-suffiks uten nummer-range)
- Trust score allerede dekker mye av dette (0.5-terskel)

### 4. Avstandsrelevans

For bolig-prosjekter: POI-er > 15 min gange bør ikke vises i Explorer med mindre de er spesielt viktige (togstasjon, sykehus, kjøpesenter). Kategori-basert avstandstak:

| Kategori | Maks gangavstand |
|----------|-----------------|
| restaurant, cafe, bakery, supermarket | 15 min |
| gym, haircare, pharmacy | 20 min |
| train, hospital, shopping_center | 30 min |
| bus | 10 min |
| skole, barnehage | 20 min |

### 5. Scope: Kun pipeline (nye prosjekter)

Filtrene bygges inn i generate-kommandoen. Overvik må re-genereres for å dra nytte av dem. Ikke standalone cleanup-script — holder det enkelt.

## Åpne spørsmål

- Skal LLM-valideringen bruke en billig modell (Haiku) for kostnad, eller Sonnet for presisjon?
- Hvor mange POI-er kan vi sende i én LLM-batch uten å miste kvalitet?
- Bør vi logge filtrerte POI-er til en "rejected" tabell for audit?

## Suksesskriterier

1. Re-generert Overvik har 0 åpenbart feilkategoriserte POI-er
2. Ingen duplikater innenfor 300m
3. Ingen hjemmekontor-POI-er uten kvalitetssignaler
4. Alle POI-er har relevant gangavstand for sin kategori
5. Prosessen er automatisk — ingen manuell QA nødvendig for salgbar demo
