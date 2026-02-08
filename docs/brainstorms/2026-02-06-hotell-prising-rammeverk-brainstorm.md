# Hotell-prising: Systematisk rammeverk for Explorer og Report

**Dato:** 2026-02-06
**Status:** Brainstorm complete
**Neste steg:** Bruk rammeverket i salgspitcher; juster basert på faktiske kundemøter

---

## Hva vi har landet på

En **hybrid prismodell** som kombinerer:
1. **Value-based anchoring** som salgsmetodikk (hvordan du forsvarer prisen)
2. **Tiered per-rom-prising** som prisstruktur (hva du faktisk tar betalt)
3. **Pilotstrategi** for å senke inngangsterskelen (3 mnd til 50%)

Kjernefilosofi: **Lav pris, bevis verdi, øk etterhvert.** Få mange kunder raskt, bygg bevis, så løft prisene for nye kunder.

---

## Prisstruktur

### Explorer (SaaS, månedlig)

| Tier | Romstørrelse | Pris/mnd | Per rom/mnd | Setup (engang) |
|------|-------------|----------|-------------|----------------|
| Starter | 1-50 rom | 990 kr | ~20 kr | 2.500 kr |
| Standard | 51-150 rom | 1.490 kr | ~10-30 kr | 3.500 kr |
| Premium | 150+ rom | 1.990 kr | ~10-13 kr | 5.000 kr |

**Setup inkluderer:**
- Kuratering og godkjenning av POI-er med hotellet
- Korrespondanse og tilpasning
- QA og publisering
- QR-kode-materiell

Teknisk setup er automatisert via `/generate-hotel` (5-10 min), men kunden betaler for kurateringsprosessen.

### Report (engangsproduksjon)

| Variant | Pris | Innhold |
|---------|------|---------|
| Standard Report | 15.000 kr | Temabasert artikkel, interaktivt kart, 40-60 POI-er |
| Premium Report | 25.000-35.000 kr | + dypere redaksjonelt, fotografering, utvidet kuratering |

Report fungerer som inngang til Explorer-abonnement (trojan horse).

---

## Pilotstrategi: "Bli med tidlig"

**Pilotperiode:** 3 måneder til **50% av ordinær pris**

| | Ordinær | Pilot (3 mnd) |
|---|---------|---------------|
| Explorer Standard (51-150 rom) | 1.490 kr/mnd | **745 kr/mnd** |
| Setup | 3.500 kr | **1.750 kr** |
| **Total pilot-kostnad** | — | **3.985 kr** (setup + 3 mnd) |

**Vilkår:**
- Etter 3 mnd: Overgang til ordinær pris, eller si opp uten kostnad
- Hotellet risikerer under 4.000 kr totalt
- 50% rabatt føles som en deal, ikke desperat
- 3 mnd er nok til å generere bruksdata og bevise verdi

### Kontraktsmodeller etter pilot

| Modell | Rabatt | Binding |
|--------|--------|---------|
| Måned-til-måned | 0% | Ingen binding |
| 12 mnd avtale | -10% | Kvartalsvis fakturering |
| 24 mnd avtale | -15% | Kvartalsvis fakturering |

---

## Kjederabatt

| Antall hoteller | Rabatt |
|----------------|--------|
| 1-10 | Fullpris |
| 11-30 | -15% |
| 31-60 | -25% |
| 60+ | -30% |

---

## Salgsrammeverk: Value-Based Anchoring

### De fire ankerpunktene

Bruk disse i ethvert kundemøte for å forsvare prisen:

**1. Schibsted-ankeret (Report)**
> "En Partnerstudio-artikkel koster fra 52.500 kr for én publisering. Vår Report er en levende, interaktiv artikkel som oppdateres automatisk — til under halvparten av prisen."

**2. PMS-ankeret (kjent prismodell)**
> "PMS-systemet deres koster €5-6 per rom per måned. Vi koster under halvparten av det — og vi er det gjestene faktisk ser og bruker."

**3. Omsetnings-ankeret (perspektiv)**
> "Med 2,4 millioner i månedlig romsinntekt er dette 0,04-0,08% av omsetningen. Mindre enn én time resepsjonisttid per dag."

**4. Konkurrent-ankeret (differensiering)**
> "Scandic bygde sin egen versjon — den ble fire Google Maps-kategorier uten kuratering. Vi gir noe fundamentalt bedre, billigere enn å bygge selv."

### Verdipitch (én setning)
> "Gjestene dine får en lokal guide som gjør at de husker hotellet ditt."

---

## Markedsbenchmarks (research)

### Hva hoteller betaler for digitale verktøy

| Kategori | Typisk pris |
|----------|-------------|
| PMS (Opera, Mews) | €5-6/rom/mnd |
| Gjestekomm (Akia) | $20/bruker/mnd |
| Digital guidebook (Touch Stay) | Per eiendom, ukjent |
| Reputation mgmt (TrustYou) | Fra $100/bruker/mnd |
| Content marketing byrå | 3.000-6.000 USD/mnd |
| Schibsted Partnerstudio | Fra 52.500 kr/artikkel |

### Norsk hotell-kontekst

- ~1.200 hoteller i Norge (~80.000 rom)
- RevPAR Norge: ~800 NOK (høyere i storby)
- 100-roms hotell: ~2,4 MNOK/mnd romsinntekt
- Markedsføringsbudsjett: Anbefalt 8-15%, faktisk under 2,5%
- Digital andel av markedsføring: ~75%

### Placy i kontekst

| | Placy Explorer | Typisk PMS | Digital concierge |
|---|----------------|-----------|------------------|
| Per rom/mnd | 10-20 kr | 40-50 kr | 50-100 kr |
| Andel av omsetning | 0,04-0,08% | 0,2-0,3% | 0,3-0,5% |
| Setup | 2.500-5.000 kr | 20-100k kr | Varierer |

**Konklusjon:** Placy er priset i bunnsjiktet av hotell-SaaS — bevisst strategi for rask adopsjon.

---

## Prisøkningsstrategi (land-and-expand)

### Fase 1: Bevis (0-20 hoteller)
- Nåværende priser med pilot-tilbud
- Fokus: Få referansekunder og bruksdata
- Mål: Bevise at gjester faktisk bruker det

### Fase 2: Analytics (20-50 hoteller)
- Introduser analytics-dashboard ("se hvor mange gjester som bruker Placy")
- Nye kunder: +20% prisøkning
- Eksisterende kunder beholder gammel pris i 12 mnd

### Fase 3: Expand (50+ hoteller)
- Introduser Guide-produkt og pakkepriser
- Explorer + Guide + Report bundles
- Eksisterende kunder får "early adopter"-pris på nye produkter
- Nye kunder betaler full pakkepris

---

## Åpne spørsmål

1. **Analytics:** Trenger bruksdata for å bevise ROI — hva tracker vi? (sidevisninger, QR-skanninger, tid brukt)
2. **Report som trojan horse:** Funker det å selge Report først, så Explorer? Eller omvendt?
3. **Destinasjonsselskaper:** Kan de co-finansiere POI-databaser, slik at hotellprisen kan være enda lavere?
4. **Fakturering:** Stripe? Vipps? Manuell faktura i starten?
5. **Guide-prising:** Ikke dekket her — parkert til Guide-produktet er mer modent

---

## Kilder

- Colliers Nordic Hotel Market 2025
- Hotelia Market Report 4Q24
- Cloudbeds Hotel Marketing Budget Guide
- HotelFriend PMS Cost Benchmark
- Mementor Marketing Agency Prices Norway
- Placy brainstorm 2026-02-01 (forrige prisrunde)
