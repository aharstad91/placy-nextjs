# CityGuide.no som datakilde for Placy

**Dato:** 2026-02-03
**Status:** Utforsket

## Hovedinnsikt

CityGuide.no er Visit Trondheim sin offisielle "prioriteringsliste" over turistmål. Deres kategorier og utvalg gir oss en **cheat sheet** for hva destinasjonsselskapet fokuserer på - helt legitim markedsresearch.

Vi kopierer ikke innhold. Vi forstår prioriteringer og bygger et bedre produkt.

## Bakgrunn

CityGuide.no produserer trykte turistbrosjyrer for norske destinasjonsselskap (Visit Trondheim, etc.) og har en digital versjon med samme innhold. De har omfattende venue-databaser for mange norske byer.

## Hva vi fant ut

### CityGuide sin forretningsmodell
- **CityGuide DA** (org.nr 926 351 206), Oslo
- Print-partner for destinasjonsselskap (Visit Trondheim, Visit Bergen, etc.)
- Venues blir sannsynligvis registrert gjennom Visit-partnerskapet
- Brosjyrer distribueres på turistkontor

### Datastruktur per venue
| Felt | Tilgjengelig | Eksempel |
|------|--------------|----------|
| Navn | ✅ | MANA Restaurant |
| Kategori | ✅ | Food & Drink |
| Telefon | ✅ | +47 477 85 855 |
| Åpningstider | ✅ | Ons-Lør 16-22 |
| Beskrivelse | ✅ | ~50-150 ord |
| Bilder | ⚠️ | Venue-levert (copyright) |
| Adresse | Delvis | Ikke alltid synlig |

### Kategorier tilgjengelig
- Museums & Attractions
- Galleries
- Activities
- Shopping
- Interior
- Food & Drink
- Health & Beauty
- Accommodation
- Transport
- What's On

### Bildeeierskap - viktig
Bildene på CityGuide er **venue-levert**. CityGuide har tillatelse fra hver bedrift gjennom Visit-partnerskapet. Denne tillatelsen gjelder kun CityGuide, ikke tredjeparter som Placy.

## Valgt tilnærming: Discovery-liste

### Konsept
Bruk CityGuide som **discovery-kilde** for å finne relevante POI-er, deretter berik med Google Places API (som Placy allerede har integrert).

### Flyt
```
CityGuide.no → Scrape navn + kategori
      ↓
Google Places API → Søk etter navn
      ↓
Placy POI med:
- googlePlaceId
- googleRating
- photoReference (Google-bilder)
- Åpningstider fra Google
      ↓
AI-generert editorialHook/localInsight
```

### Fordeler
1. **Kuratert liste** - CityGuide har allerede filtrert kvalitetssteder
2. **Lovlig** - Vi bruker kun offentlig tilgjengelig info (navn, kategori)
3. **Skalerbar** - Fungerer for alle byer CityGuide dekker
4. **Bilder fra Google** - Ingen copyright-problemer

### Begrensninger
- Google-bilder er ofte brukerbilder (variabel kvalitet)
- Mister CityGuide sine redaksjonelle beskrivelser
- Må generere egne beskrivelser med AI

## Implementeringsidé

### Scraper-script
```typescript
// Pseudokode
interface CityGuideVenue {
  name: string;
  category: string;
  cityguideUrl: string;
}

// 1. Hent liste fra kategoriside
// 2. For hver venue: søk Google Places
// 3. Match og lagre som POI
```

### Kategorimapping
| CityGuide | Placy |
|-----------|-------|
| Food & Drink | restaurant, cafe, bar |
| Museums & Attractions | museum, attraction |
| Shopping | shopping |
| Activities | activity |

## Validert hypotese: 100% Google Match

Vi testet flere CityGuide-POI-er mot Google/TripAdvisor/Yelp:

| CityGuide POI | Google Match | Adresse |
|---------------|--------------|---------|
| MANA Restaurant | ✅ 4.8 rating | Sluppen |
| Cafe Løkka | ✅ 8.6/10 | Dokkgata 8 |
| Kommandanten | ✅ TripAdvisor | Kristianstensbakken 20 |
| Visit Bjørn | ✅ | Ilevollen 12 |
| Havet Arena | ✅ | Strandveien 104 |

**Konklusjon:** CityGuide = kuratert subset av Google Places + Visit Trondheim-partnerskap.

### CityGuide sin faktiske verdi
1. **Kurateringen** - Turistkontorets anbefalte steder
2. **Kategoriseringen** - Strukturert etter turisme-kategorier
3. **Kvalitetsfilter** - Kun steder verdt å besøke

### Implikasjoner for Placy
- Ingen unik data å hente - alt finnes på Google
- Verdien er LISTEN over anbefalte steder
- Bilder kan hentes fra Google Places API (allerede integrert)

## Åpne spørsmål

1. **Skal vi ta kontakt med Visit Trondheim?**
   De har allerede samlet alt - et partnerskap kunne gi tilgang til bilder og data direkte.

2. **Hvor mange byer skal vi dekke først?**
   CityGuide har: Trondheim, Oslo, Bergen, Stavanger, Tromsø, Bodø, Kristiansand, m.fl.

3. **AI-beskrivelser - hva slags tone?**
   CityGuide er turistvennlig og positivt. Placy kan være mer "local insider"?

## Implementeringsarkitektur

```
FASE 1: Kartlegg CityGuide-struktur
├── Scrape kategori-sider (food-drink, museums, activities, etc.)
├── Hent alle POI-URLer per kategori
└── Output: categories.json

FASE 2: Hent POI-detaljer
├── For hver URL: scrape navn, telefon, timer, beskrivelse
└── Output: cityguide-pois.json

FASE 3: Google Places matching
├── Text Search per POI: "{name} Trondheim"
├── Validering: navn-match, adresse, kategori
├── Match confidence score
└── Output: validated-pois.json

FASE 4: Placy POI-generering
├── Map CityGuide → Placy kategorier
├── Hent Google Photos
├── AI-generer editorialHook
└── Output: Supabase-kompatible POI-er
```

## Før implementering

**Må sjekkes:**
- [ ] Supabase POI-tabellstruktur
- [ ] Eksisterende kategori-system i Supabase
- [ ] Google Places API quota/kostnader
- [ ] Hvordan håndtere duplikater (POI finnes allerede)

## Verifisert Data (2026-02-03)

**Faktisk venue-telling fra CityGuide.no:**

| Kategori | Antall |
|----------|--------|
| Food & Drink | 109 |
| Shopping | 71 |
| Activities | 36 |
| Accommodation | 32 |
| Museums & Attractions | 25 |
| Galleries | 16 |
| Health & Beauty | 15 |
| Interior | 1 |
| **TOTAL** | **305** |

**Google Places API Kostnad:**
- Text Search (305×): $9.76
- Place Details (305×): $5.19
- Photos 3× (915×): $6.41
- **Total per kjøring: $21.35**

**Kjøretid:** ~9 minutter

## Neste steg

1. ~~**Ny session:** Gjennomgå Supabase-struktur for POI-er~~ ✅ Gjort
2. ~~**Plan:** Lag implementeringsplan med `/workflows:plan`~~ ✅ Gjort
3. **Bygg:** Implementer scraper + matcher
4. **Test:** Kjør mot Trondheim Food & Drink først
