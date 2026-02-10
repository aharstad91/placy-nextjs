# POI Tier System & Quality Curation

**Dato:** 2026-02-10
**Status:** Besluttet — klar for planlegging
**Tilnærming:** Hybrid Tier System — Claude-evaluering + formel-score

---

## Hva vi bygger

Et hybrid POI-rangerings- og kurasjonssystem som kombinerer:

1. **Claude-evaluering** (redaksjonell tier) — satt under POI-discovery med bred nettsøk
2. **Formel-basert score** — `rating × log2(1 + reviews)` for sortering innad i tiers
3. **Rik metadata-innhøsting** — Claude samler data fra Google, TripAdvisor, Yelp, lokale medier

Systemet driver UX på tvers av Report og Explorer med progressiv disclosure: færre, bedre POIs initialt — brukeren velger å se mer.

**Data er gullet** — metadata bygges for fremtidige produkter og iterasjoner. Selv data som ikke vises i dag (tredjepartsanerkjennelser, mediaomtaler) lagres for fremtidig bruk.

I tillegg fikses en **bug** der mindre kategorier (f.eks. Bakeri) mister sin seksjon-formatering i Report.

---

## Hvorfor denne tilnærmingen

### Problemet
- I sentrumsnære strøk vises for mange POIs — gir "data dump"-inntrykk
- Både kart og liste trenger bedre kuratering
- Ren formel-basert scoring favoriserer populære kjeder over lokale perler
- Placy sin differensiering er redaksjonell kvalitet, ikke datamengde

### Tilnærmingen
- **Hybrid** fordi ren formel mister nyansene (unikkhet, story-potensial, lokal forankring)
- **Claude som redaktør** fanger kvaliteter Google-data ikke kan måle
- **Bred nettsøk per POI** — TripAdvisor, Yelp, lokale medier, blogger
- **Formel som tiebreaker** gir objektiv sortering innad i tiers
- **Per-kategori capping** gjør mengden forutsigbar og håndterbar
- **Progressive disclosure** bevarer "kompetansesignalet" (vi VET om mange steder) uten å overbelaste
- **Kjeder respekteres** — tagges, ikke straffes. Lokale perler fremheves i UI

---

## Nøkkelbeslutninger

### 1. Tier-definisjon
| Tier | Beskrivelse | Synlighet | Hvem setter |
|------|-------------|-----------|-------------|
| **Tier 1** | Placy anbefaler aktivt. Unik + kvalitet + story-potensial. | Alltid synlig — highlight-kort med bilde | Claude under discovery |
| **Tier 2** | Solid kvalitet. God rating og anmeldelser. | Synlig i kompaktliste (initialt synlige) | Formel-score |
| **Tier 3** | Tilgjengelig. Passerer trust-filter. | Bak "Vis mer"-knappen | Alt annet |

### 2. Tier 1-kriterier (Claude-evaluering)

**Tre dimensjoner vurderes som en helhet:**
- **Lokalt unik** — har stedet noe særegent? (historie, konsept, lokal forankring)
- **Kvalitet** — god rating, pålitelige anmeldelser, godt drevet
- **Story-potensial** — kan man skrive noe interessant? ("Trondheims eldste bakeri", "drevet av tidl. Michelin-kokk")

**Maks 2-3 Tier 1 per kategori** (ikke per tema).

**Research-dybde:** Nettsøk per POI. Claude søker Google, TripAdvisor, Yelp, lokale medier, blogger for hvert POI. Max plan 20x gir kapasitet for dette.

**Ett steg:** Claude setter tier OG skriver editorialHook/localInsight i samme evaluering. Koherens mellom tier og hook.

### 3. Formel-score (Tier 2 sortering)
```
score = rating × log2(1 + reviewCount)
```
Testet mot ekte Scandic Lerkendal-data (297 POIs):

| POI | Rating | Reviews | Score |
|-----|--------|---------|-------|
| Britannia Hotel | 4.7 | 2051 | 51.7 |
| Antikvariatet (kafé) | 4.6 | 1231 | 47.2 |
| Den Gode Nabo (bar) | 4.6 | 1518 | 48.6 |
| Godt Brød (bakeri) | 4.4 | 427 | 38.5 |
| Bula Neobistro | 4.8 | 395 | 41.4 |
| Awake (kafé, ny) | 4.9 | 209 | 37.8 |

Formelen gir fornuftige resultater — høy rating med mange anmeldelser topper, men nye/nisjesteder med færre reviews (Awake: 37.8) er fortsatt konkurransedyktige.

### 4. Per-kategori caps (Report)
| Seksjon | Antall |
|---------|--------|
| Tier 1 (highlights) | 2-3 per kategori |
| Tier 2 (kompaktliste) | 6 per kategori (INITIAL_VISIBLE_COUNT) |
| Tier 3 (bak "Vis mer") | Resten |

Totalt initialt synlig per kategori: 2-3 + 6 = **8-9 POIs** (ned fra potensielt 30+).

### 5. Kjede vs. lokal tagging
- **Ikke straff kjeder i rangeringen** — de er populære for en grunn
- **Tagg dem:** `is_chain: boolean` og `is_local_gem: boolean`
- Fremtidig bruk: filter ("Vis bare lokale"), badges, differensiert UI
- Claude setter disse under tier-evaluering

### 6. Metadata-innhøsting (fullt omfang)

Claude samler **maksimal metadata** per POI under tier-evaluering:

**Strukturerte konklusjoner (intern bruk, ikke vist på front-end):**
```json
{
  "cuisine_type": "thai",
  "vibe": ["cozy", "date-night"],
  "best_for": ["lunch", "sunday-brunch"],
  "established_year": 2015,
  "award_winning": true,
  "third_party_recognition": ["TripAdvisor Travellers Choice 2025"],
  "media_mentions": ["Adresseavisen beste restaurant 2024"],
  "notable_details": "Drevet av tidl. Michelin-kokk",
  "evaluation_sources": ["tripadvisor.com/...", "adressa.no/..."]
}
```

**Juridisk trygt:** Lagrer analyserte konklusjoner, ikke rå scraped data. Kilder lagres for sporbarhet. Ingenting fra tredjeparter vises på front-end.

### 7. Database-skjema (Kjerne + JSONB)
```sql
ALTER TABLE pois
  ADD COLUMN poi_tier SMALLINT CHECK (poi_tier IN (1, 2, 3)),
  ADD COLUMN tier_reason TEXT,
  ADD COLUMN is_chain BOOLEAN DEFAULT false,
  ADD COLUMN is_local_gem BOOLEAN DEFAULT false,
  ADD COLUMN poi_metadata JSONB DEFAULT '{}',
  ADD COLUMN tier_evaluated_at TIMESTAMPTZ;

CREATE INDEX idx_pois_tier ON pois(poi_tier) WHERE poi_tier IS NOT NULL;
CREATE INDEX idx_pois_chain ON pois(is_chain) WHERE is_chain = true;
CREATE INDEX idx_pois_local_gem ON pois(is_local_gem) WHERE is_local_gem = true;
```

**Kjerne-kolonner** (typesikre, indekserte): `poi_tier`, `tier_reason`, `is_chain`, `is_local_gem`
**JSONB-felt** (fleksibelt, utvidbart): `poi_metadata` for alt annet — ingen migrasjon for nye felt
**Null `poi_tier`** = backward compatible, bruk formel-score

### 8. Explorer-impakt
- **Tier påvirker rekkefølge, ikke caps**
- Eksisterende caps forblir uendret (100 total, 60 mat-drikke, etc.)
- Innenfor caps: Tier 1 sorteres først, deretter Tier 2, deretter Tier 3
- Ingen override av caps-logikk

### 9. Implementering i to faser

**Fase 1 (denne sesjonen):**
- Bug fix: Bakeri-seksjoner i Report (alle kategorier som sub-sections)
- Per-kategori sortering med formel-score `rating × log2(1 + reviews)`
- Forbedret `pickHighlights()` som bruker formel-score
- Virker umiddelbart uten dataendringer

**Fase 2 (neste sesjon):**
- DB-migrasjon: nye kolonner + JSONB
- Claude tier-evaluering med bred nettsøk (ett steg: tier + editorial + metadata)
- UI-oppdatering: Tier 1 trumfer formel-score
- Explorer-sortering: tier-basert innenfor caps
- Re-generering av eksisterende prosjekter

---

## Åpne spørsmål (for plan-fasen)

1. **Discovery-prompt:** Nøyaktig prompt-design for Claude tier-evaluering — krever iterasjon
2. **Guide/Trip-impakt:** Manuelt kuraterte stopp — er tiers relevante der?
3. **Re-generering:** Strategi for å oppdatere eksisterende prosjekter med tier-data
4. **Kart-display:** Bør Tier 1 POIs ha visuelt distinkte markører? (parkert)
5. **Front-end badges:** Når/om lokale perler skal fremheves visuelt i UI (parkert)

---

## Datainnsikt: Scandic Lerkendal

| Kategori | Totalt | Rated | Hooks | Kommentar |
|----------|--------|-------|-------|-----------|
| Restaurant | 36 | 35 | 19 | Bred kategori, trenger god filtrering |
| Kafé | 35 | 32 | 19 | Samme |
| Bike | 32 | 0 | 0 | Transport |
| Haircare | 29 | 27 | 12 | Hverdagsbehov |
| Park | 21 | 19 | 13 | Kultur |
| Bar | 18 | 18 | 9 | Moderat størrelse |
| Gym | 18 | 16 | 12 | |
| Bus | 17 | 0 | 0 | Transport |
| **Bakery** | **15** | **13** | **13** | **Akkurat på terskelen (>15), derav bug** |
| Hotel | 14 | 14 | 0 | |
| Museum | 13 | 13 | 12 | |

**Totalt: 297 POIs, 0 featured** — ingen POIs er manuelt featured i dag.

---

## Bug: Bakeri-seksjoner

**Rotårsak:** `buildSubSections()` bruker `> SUB_SECTION_THRESHOLD` (strict greater than). Bakeri med 15 POIs treffer nøyaktig terskelen (15) men ekskluderes fordi `15 > 15 = false`.

**I tillegg:** Når et tema har sub-sections, renderes gjenværende kategorier som en flat `CompactPOIList` uten header, highlights, stats, eller "Vis mer".

**Fix:** Render ALLE kategorier som sub-sections når temaet er i sub-section-modus. Endre threshold til `>=` eller senk til 12.
