---
date: 2026-02-02
topic: local-logic-analyse
---

# Local Logic — Dypdykk og Placy-inspirasjon

## Selskapet

**Grunnlagt:** 2015, Montreal, Canada
**Grunnleggere:** Vincent-Charles Hodder (CEO), Gabriel Damant-Sirois (CPO), Colin Stewart
**Bakgrunn:** Møttes på McGill University's School of Urban Planning

### Opprinnelseshistorie

Grunnleggerne så at eiendomsbransjen fortsatt baserte seg på magefølelse for store beslutninger. De ville fylle gapet med objektiv, kvantifiserbar data.

> "We strongly believe a consumer or investor will be able to consider those things if we're able to quantify them and tell that story through data." — Vincent-Charles Hodder

### Nøkkeltall

| Metrikk | Verdi |
|---------|-------|
| Månedlige brukere | 22 millioner |
| Nettsider | 8,000+ |
| Datapunkter | 100+ milliarder |
| Adresser dekket | 250 millioner |
| Marked | USA + Canada |

### Finansiering

| Runde | År | Beløp | Investorer |
|-------|-----|-------|------------|
| Seed | Pre-2020 | ~$2M CAD | - |
| Series A | Nov 2020 | $8M CAD | Inovia Capital, m.fl. |
| Series B | Aug 2023 | $17.5M CAD | GroundBreak Ventures, Investissement Québec |
| **Total** | | **$25M CAD** | |

---

## Produktportefølje

### 1. Widgets (SDK)

#### Local Content
Hovedproduktet — embed-widget for boligannonser.

**Innhold:**
- 18 location scores
- 21 POI-kategorier
- Skoler med grenser
- Pendlekalkulator
- Interaktivt kart

**Teknisk:**
- Min 700px høyde
- Responsiv (640px breakpoint)
- Støtter MapTiler, Mapbox, Google Maps
- Tilpassbar: farger, logo, språk (EN/FR)

**Pris:** Fra $100/mnd (basert på antall agenter)

#### Local Search
Livsstil-basert eiendomssøk.

**Hvordan det fungerer:**
1. Bruker velger preferanser (gangvennlighet, nærhet til kafeer, stillhet, etc.)
2. Hver bolig får en "match score" (0-100)
3. Resultater sorteres etter livsstil-match

**Teknisk:**
- Max 35 boliger per side
- Krever lat/lng per bolig
- Grid eller liste-visning

**Pris:** Fra $250/mnd (portaler/franchises)

#### Local Maps
Kartsøk med livsstil-filter.

**Funksjon:** Visuell sammenligning av nabolag basert på brukerens kriterier.

#### NeighborhoodWrap
Community pages / nabolagssider.

**Innhold:**
- Skoler i nærheten
- Demografisk data
- Verdidrivere
- Markedsstatistikk
- Områdeoversikt

**SEO-fokus:** Bygget for organisk trafikk og "local expert"-posisjonering.

**Pris:** Fra $500/mnd

---

### 2. API-er

| API | Beskrivelse | Pris |
|-----|-------------|------|
| Location Scores | 18 scores per adresse | Fra $1,500/mnd |
| Demographics | Inntekt, utdanning, befolkning | " |
| Points of Interest | 28 kategorier | " |
| School Data | Skoler + grenser | " |
| Climate Risk | Flom, brann, storm-risiko | " |
| Neighborhood Profiles | Tekstbeskrivelser av nabolag | " |
| Market Stats | Salg, priser, inventory | " |

---

### 3. Rapporter

#### Neighborhood Reports
PDF-rapporter for agenter å dele med kunder.

**To typer:**
1. **Lifestyle Reports** — walkability, kollektiv, skoler, fasiliteter, demografi
2. **Market Reports** (kun USA) — medianpris, trender, inventory, salgsaktivitet

**Distribusjon:**
- Print
- E-post
- Delbar link
- Genereres instant for enhver adresse

**Pris:** $20/mnd for agenter (ubegrenset rapporter)

---

### 4. Solutions (pakker)

| Løsning | Beskrivelse |
|---------|-------------|
| **Community Pages** | SEO-optimerte nabolagssider |
| **Lifestyle Search** | Søk basert på livsstil, ikke bare pris/størrelse |
| **Listing Experience** | Berik annonser med lokasjonsdata |
| **Lead Capture** | Rapporter som lead magnet |

---

## De 18 Location Scores

Scores fra 1-10, beregnet på adressenivå.

### Transport (4)
| Score | Beskrivelse |
|-------|-------------|
| Pedestrian-friendly | Gangbarhet til daglige gjøremål |
| Transit-friendly | Kollektivtilgang og frekvens |
| Car-friendly | Parkering, veiadgang |
| Cycling | Sykkelinfrastruktur |

### Services (8)
| Score | Beskrivelse |
|-------|-------------|
| Groceries | Matbutikker |
| Restaurants | Spisesteder |
| Cafés | Kafeer |
| Shopping | Butikker |
| Primary schools | Barneskoler |
| High schools | Videregående |
| Daycares | Barnehager |
| Wellness | Treningssentre, spa |

### Character (6)
| Score | Beskrivelse |
|-------|-------------|
| Quiet | Støynivå |
| Vibrant | Aktivitet, liv |
| Greenery | Grøntområder generelt |
| Parks | Parker spesifikt |
| Nightlife | Uteliv |
| Historic | Historisk karakter |

---

## Forretningsmodell

### Prising

| Segment | Produkt | Pris |
|---------|---------|------|
| **Agenter** | Rapporter | $20/mnd |
| **Teams/Brokerages** | Local SDKs | Fra $100/mnd |
| | Neighborhood SDKs | Fra $500/mnd |
| | APIs | Fra $1,500/mnd |
| **Franchises/Portaler** | Local SDKs | Fra $250/mnd |
| | APIs | Fra $1,500/mnd |
| **MLS** | Custom | Kontakt |

### Salgsmodell

**B2B2C:**
1. Selger til MLS-organisasjoner → når tusenvis av agenter
2. Selger til meglerkjeder → bulk-avtaler
3. Selger til proptech-plattformer → API-integrasjon

**Ikke B2C** — sluttbrukere får aldri en faktura, det er alltid via en mellomledd.

---

## Go-to-Market Strategi

### Fase 1: MLS-partnerskap (skalering)

MLS (Multiple Listing Service) er sentrale databaser som samler alle boliger til salgs i en region. Ved å signere én MLS-avtale når Local Logic tusenvis av agenter.

**Nøkkelpartnerskap:**
| MLS | Agenter | Region |
|-----|---------|--------|
| CRMLS | 100,000+ | California |
| Stellar MLS | 84,000+ | Florida |
| Georgia MLS | - | Georgia |
| Miami SEFMLS | - | Florida |
| MLS PIN | - | New England |
| NorthstarMLS | - | Midwest |

> "These partnerships will equip over 160,000 real estate professionals with the industry's most advanced location dataset."

### Fase 2: Meglerkjeder

Store nasjonale kjeder:
- RE/MAX
- Century 21
- Sotheby's International Realty
- Royal LePage
- Engel & Völkers
- Baird & Warner

### Fase 3: Proptech & Portaler

- Realtor.com
- Rocket Homes
- CoreLogic
- Rently

### Hvorfor det fungerer

1. **MLS = distributør** — én avtale, tusenvis av brukere
2. **Hvitmerking** — kundens merkevare, Local Logic's data
3. **Sticky** — når det er integrert, vanskelig å bytte
4. **Network effects** — jo flere bruker det, jo mer standardisert blir det

---

## UX/Design-prinsipper

### Brukeropplevelse

**Filosofi:** "What is it like to live here?"

De løser problemet at tradisjonelle boligsøk fokuserer på pris og kvadratmeter, ikke livsstil.

**UX-prinsipper observert:**

1. **Scores > rå data** — 1-10 skala er lettere å forstå enn "342 meter til nærmeste butikk"
2. **Visuell først** — kart og heatmaps, ikke tabeller
3. **Personalisering** — bruker velger hva som er viktig for dem
4. **Embedded, ikke standalone** — produktene lever i kundens kontekst
5. **Minimal friksjon** — widgets dropper inn med én script-tag

### Widget-design

**Local Content:**
- Vertikal layout (sidebar-vennlig)
- Tabs for kategorier (Transport, Services, Character)
- Scores med fargekodet indikator
- Utfellbare POI-lister
- Interaktivt kart

**Responsive:**
- Desktop: full widget
- Mobile (< 640px): komprimert visning

---

## Hva Placy kan lære

### 1. Score-systemet

**Local Logic:** 18 scores, 1-10 skala

**Placy-mulighet:**
- Utvikle norske scores med lokale datakilder
- Entur-data gir bedre kollektivscore enn US-baserte løsninger
- Bysykkel er unik for norske byer
- Vurdér "Vinterscore" (skiløyper, preparerte stier)

| Local Logic Score | Placy-ekvivalent | Datakilde |
|-------------------|------------------|-----------|
| Transit-friendly | Kollektivscore | Entur (sanntid!) |
| Pedestrian-friendly | Gangvennlighet | Mapbox + POIs |
| Cycling | Sykkelscore | Bysykkel + infra |
| Groceries | Dagligvare | Google Places |
| Primary/High schools | Skoler | Google Places |
| Parks | Grøntareal | Google Places + OSM |
| Quiet | Stillhet | Trafikk-data? |

**Differensiering:** Placy kan tilby **sanntidsdata** (Entur avganger) vs. Local Logic's statiske scores.

### 2. Widget-arkitektur

**Local Logic:** SDK via npm/CDN, config-objekt, render i container

**Placy bør bygge:**

```typescript
// Fase 1: iFrame (enklest)
<iframe src="https://placy.no/embed?lat=59.9&lng=10.7&mode=walk&budget=10"></iframe>

// Fase 2: JavaScript SDK
<script src="https://placy.no/sdk.js"></script>
<script>
  Placy.createExplorer({
    container: '#placy-widget',
    lat: 59.9139,
    lng: 10.7522,
    locale: 'no',
    travelMode: 'walk',
    timeBudget: 10,
    theme: {
      primaryColor: '#007bff',
      logo: 'https://kunde.no/logo.png'
    }
  });
</script>

// Fase 3: React-komponent
<PlacyExplorer
  lat={59.9139}
  lng={10.7522}
  travelMode="walk"
  timeBudget={10}
/>
```

### 3. Produktstrategi

**Local Logic's rekkefølge:**
1. Widget (Local Content) — synlig verdi, lav friksjon
2. Rapporter — lead capture
3. Søk-widget — dypere integrasjon
4. API-er — enterprise

**Anbefalt for Placy:**

```
Fase 1: Placy Embed (iFrame)
├── Kun adresse som input
├── Automatisk POI-generering
├── Reisetid-filter (5/10/15 min)
└── Travel mode (gå/sykle/bil)

Fase 2: Placy Scores
├── 6-8 norske location scores
├── Badge-visning i widget
└── Score-API

Fase 3: Placy SDK
├── JavaScript/React bibliotek
├── Tilpasning (farger, logo)
└── Events og callbacks

Fase 4: Placy Nabolagssider
├── SEO-optimerte community pages
├── Automatisk generert innhold
└── Hvitmerking
```

### 4. Go-to-market

**Local Logic:** MLS først → meglerkjeder → portaler

**Norge er annerledes:**
- Ingen MLS-struktur
- FINN.no er den dominerende portalen
- Meglerkjeder har egne nettsider

**Placy GTM-alternativer:**

| Strategi | Fordel | Ulempe |
|----------|--------|--------|
| **FINN-partnerskap** | Umiddelbar skala | Vanskelig å få til |
| **Meglerkjeder direkte** | Høyere pris/margin | Salgssyklus |
| **Utbyggere/nybygg** | Høyt behov | Nisjemarked |
| **Proptech-plattformer** | API-salg | Avhengig av andres vekst |

**Anbefaling:** Start med 2-3 meglerkjeder som pilotkunder, bygg case studies, deretter tilnærm FINN.

### 5. Prising

**Local Logic:** Abonnement basert på bruk (agenter, visninger, API-kall)

**Placy-alternativ:**

| Modell | Beskrivelse | Anbefalt? |
|--------|-------------|-----------|
| Per objekt/mnd | 150-300 kr per aktiv annonse | ✅ Enkelt å forstå |
| Per visning | 2-5 kr per widget-load | Uforutsigbar kostnad |
| Abonnement | Fast mnd-pris | Krever commitment |

**Start enklest:** Per objekt/måned, enkel fakturering.

---

## Strategisk posisjonering: Placy vs. Local Logic

| Dimensjon | Local Logic | Placy (mulighet) |
|-----------|-------------|------------------|
| **Marked** | USA/Canada | Norge (+ Norden) |
| **Språk** | EN/FR | Norsk |
| **Datakilder** | US Census, aggregert | Entur, Bysykkel, Google Places |
| **Sanntid** | Nei (statiske scores) | Ja (kollektiv sanntid) |
| **UX** | Scores + POI-lister | Interaktiv utforskning |
| **Differensiering** | Skala, datamengde | Lokal kontekst, sanntid |

### Placy sin unike posisjon

> "Local Logic forteller deg *hva* som finnes. Placy lar deg *oppleve* hvordan det er å bo der."

**Konkrete differensiatorer:**

1. **Sanntid kollektiv** — se neste avgang, ikke bare "transit score 7"
2. **Interaktivt kart** — utforsk selv, ikke bare les scores
3. **Reisetid-radius** — "vis meg alt innen 10 min gange"
4. **Norsk kontekst** — lokale kategorier, norsk språk

---

## Åpne spørsmål

1. **Scores vs. interaktivitet?** — Bør Placy adoptere score-modellen, eller holde seg til interaktiv utforskning?
2. **Hvitmerking fra start?** — Hvor viktig er det for første kunde?
3. **Prispunkt?** — 150 kr vs. 300 kr per objekt/mnd
4. **API vs. ferdig produkt?** — Starter vi som widget eller API?

---

## Kilder

- [Local Logic](https://locallogic.co/)
- [Local Logic Documentation](https://docs.locallogic.co/)
- [Local Logic Pricing](https://locallogic.co/pricing/)
- [Series B Funding Announcement](https://locallogic.co/blog/series-b-funding/)
- [GeekEstate Interview with Vincent-Charles Hodder](https://geekestateblog.com/meet-the-real-estate-tech-entrepreneur-vincent-charles-hodder-from-local-logic/)
- [BetaKit Series B Coverage](https://betakit.com/local-logic-raises-17-5-million-cad-to-develop-ai-decision-making-for-location-based-risks-and-opportunities-in-real-estate/)
- [MLS Partnership Announcements](https://locallogic.co/blog/local-logic-forms-new-partnerships-with-georgia-mls-miami-realtors-sefmls-mls-pin-and-northstarmls/)
