# Research Workflow: POI Fact-Finding for Trondheim

**Date:** 2026-02-15
**Context:** Placy's City Knowledge Base project requires a systematic, multi-agent research pipeline to fill `place_knowledge` table with verified facts across 9 topics for Trondheim POIs.

**Goal:** Define optimal search strategies, source preferences, verification logic, and hallucination traps specific to Norwegian urban POIs.

---

## 1. Search Query Templates Per Topic

Each topic gets multiple query patterns to maximize coverage and cross-verification. Queries are iterative — start with broad, narrow if results are poor.

### 1.1 HISTORY

**Primary queries (most likely to yield results):**
- `{POI_NAME} Trondheim grunnlagt år` (founded/established)
- `{POI_NAME} historie Trondheim`
- `{POI_NAME} historikk`
- `{POI_NAME} åpnet etablert dato`
- `historisk begivenhet {POI_NAME}`

**Secondary queries (if primary yields nothing):**
- `{POI_NAME} Wikipedia`
- `{POI_NAME} snl.no` (Store Norske Leksikon)
- `Trondheim historie {POI_CATEGORY}` (e.g., "Trondheim historie kirke")
- `{POI_NAME} 1800-tallet 1900-tallet`

**Fallback queries (cast wider net):**
- `{POI_ADDRESS} Trondheim`
- `{POI_CATEGORY} Trondheim liste historie`

**Example for Nidarosdomen:**
- "Nidarosdomen grunnlagt år" → expect 1066/1090 founding
- "Nidarosdomen historie" → broad history
- "Nidarosdomen Wikipedia" → cross-check facts
- "Nidarosdomen snl.no" → Norwegian encyclopedia

---

### 1.2 ARCHITECTURE

**Primary queries:**
- `{POI_NAME} arkitektur stil` (baroque, rococo, neoclassical)
- `{POI_NAME} arkitekt designer`
- `{POI_NAME} byggematerialer steintype`
- `{POI_NAME} byggeår periode`
- `{POI_NAME} fasade ornamentikk`

**Secondary queries:**
- `{POI_NAME} byggestil Norge`
- `{POI_NAME} restaurering oppussing`
- `norsk arkitektur {POI_NAME}`
- `Trondheim bygninger arkitektur`

**Topic-specific fallback:**
- `{POI_CATEGORY} arkitektur Trondheim`

**Example for Stiftsgården:**
- "Stiftsgården arkitektur stil" → expect baroque/rococo
- "Stiftsgården arkitekt" → expect "Cecilie Christine Schøller" as patron, possibly architect name
- "Stiftsgården byggeår 1774 1778"

---

### 1.3 FOOD

**Primary queries:**
- `{POI_NAME} restaurant kokk sjef`
- `{POI_NAME} Michelin stjerne`
- `{POI_NAME} spesialitet rett meny`
- `{POI_NAME} ingredienser håndverk`
- `{POI_NAME} grunnlagt år etablert`

**Secondary queries:**
- `{POI_NAME} matfilosofi nordisk cuisine`
- `{POI_NAME} anmeldelse review`
- `{POI_NAME} award pris`
- `kok {POI_NAME} Trondheim`

**Category-specific fallback:**
- `best restaurants Trondheim`
- `Trondheim mat restauranter guide`

**Example for Credo:**
- "Credo Trondheim Michelin" → expect 1 star
- "Credo kokk sjef Heidi Bjerkan"
- "Credo mat ingredienser lokalt"

---

### 1.4 CULTURE

**Primary queries:**
- `{POI_NAME} kunst kunstner utstilling`
- `{POI_NAME} musikk konsert festival`
- `{POI_NAME} teater forestilling`
- `{POI_NAME} kultur historie`
- `{POI_NAME} samling samlet`

**Secondary queries:**
- `{POI_NAME} curator kurator`
- `Trondheim kultur {POI_NAME}`
- `{POI_NAME} arrangement program`
- `kulturell betydning {POI_NAME}`

**Category-specific fallback:**
- `Trondheim museer kunstgallerier liste`

**Example for Rockheim:**
- "Rockheim Trondheim musikk museum"
- "Rockheim årgang grunnlagt"
- "Rockheim samling rock musikk Trondheim"

---

### 1.5 PEOPLE

**Primary queries:**
- `{POI_NAME} grunnlegger stifter`
- `{POI_NAME} eier gründer`
- `{POI_NAME} historisk person figur`
- `{POI_NAME} kokk kunstner arkitekt person`
- `{PERSON_NAME} {POI_NAME}`

**Secondary queries:**
- `Trondheim historiske personer {POI_NAME}`
- `{POI_NAME} biografi`
- `norsk personlighet {POI_NAME}`

**Category-specific fallback:**
- `Trondheim grunnleggere berømt personer`

**Example for Stiftsgården:**
- "Stiftsgården Cecilie Christine Schøller"
- "Stiftsgården grunnlegger eier patron"

---

### 1.6 NATURE

**Primary queries:**
- `{POI_NAME} naturlig omgivelser landskap`
- `{POI_NAME} park hage vegetation`
- `{POI_NAME} dyr fugler fauna`
- `{POI_NAME} klima værbeskrivelse`
- `{POI_NAME} geografisk beliggenhet`

**Secondary queries:**
- `Trondheim natur {POI_CATEGORY}`
- `{POI_NAME} friluftsliv aktivitet`
- `{POI_NAME} sesong vær påvirkning`

**Category-specific fallback:**
- `Trondheim parker grøntarealer liste`

**Example for badeplasser (Korsvika, etc):**
- "Korsvika strand Trondheim natur" → water quality, sandy beach
- "Korsvika dybde vann"
- "Korsvika sesong badesesong April Oktober"

---

### 1.7 PRACTICAL

**Primary queries:**
- `{POI_NAME} åpningstider åpent lukket`
- `{POI_NAME} billett pris entré`
- `{POI_NAME} adresse telefon kontakt`
- `{POI_NAME} parkering tilgjengelighet`
- `{POI_NAME} rullestoltoalett handicap tilgang`

**Secondary queries:**
- `{POI_NAME} guidet tur visning`
- `{POI_NAME} arrangementer bookingsystem`
- `{POI_NAME} cafe kafeteria spising`

**Note:** Many practical facts are in Google Places API — use WebSearch to **verify** or **supplement** when Google data is outdated.

**Example for Nidarosdomen:**
- "Nidarosdomen åpningstider" → verify against site
- "Nidarosdomen billett pris entré"
- "Nidarosdomen guidet tur"

---

### 1.8 LOCAL_KNOWLEDGE

**Primary queries (requires local context — hardest topic):**
- `{POI_NAME} tips hemmelighet lokalt`
- `visste du {POI_NAME}`
- `{POI_NAME} best time visit tidspunkt`
- `{POI_NAME} insider tips local secret`
- `{POI_NAME} anbefaling uteliv kultur`

**Secondary queries:**
- `Trondheim blogger {POI_NAME}`
- `TripadVisor {POI_NAME} tips gjester`
- `{POI_NAME} reddit Trondheim`
- `Bakklandet hemmeligheter tips`

**Category-specific fallback:**
- `Trondheim hidden gems`
- `Trondheim lokaltips Tripadvisor`

**Challenge:** Local knowledge often comes from blogs, Reddit, Instagram, not encyclopedic sources. Verification is harder — may need to cross-reference multiple bloggers.

**Example for Bakklandet neighborhood:**
- "Bakklandet hemmelighet tips" → expect cobblestones, vintage shops, cozy cafes
- "Bakklandet best time besøk" → expect "early morning/weekday less crowded"
- "Bakklandet anbefaling insider"

---

### 1.9 SPATIAL

**Primary queries (relationship to surroundings):**
- `{POI_NAME} nær ved {}` (e.g., "Gamle Bybro nær Bakklandet")
- `{POI_NAME} avstand meter gangavstand`
- `{POI_NAME} nabolag område`
- `{POI_NAME} rute gang trase`
- `{POI_NAME} utsikt utblikkspunkt`

**Secondary queries:**
- `Trondheim sentrum {POI_NAME} distanse`
- `gangavstand {POI_NAME}`
- `{POI_NAME} fra hotellet tur`

**Note:** Spatial facts are **computable** via Mapbox Directions API — use WebSearch to supplement with local narrative ("the walk follows the river", "uphill from center").

**Example:**
- "Gamle Bybro avstand Nidarosdomen" → expect ~500m, 8 min walk
- "Gamle Bybro fra Scandic Nidelven" → route narrative
- "Bakklandet nabolag Trondheim" → spatial character

---

## 2. Best Source Websites for Norwegian POI Knowledge

### Tier 1: Primary Sources (High Authority, Norwegian-Specific)

| Source | URL | Strength | Weakness | POI Types |
|--------|-----|----------|----------|-----------|
| **Store Norske Leksikon (SNL)** | snl.no | Encyclopedic, Norwegian expert review, historical accuracy | May not cover minor POIs; slow to update | History, Architecture, People, Culture |
| **Wikipedia NO** | no.wikipedia.org | Comprehensive, historical references, links to sources | May have gaps for small Trondheim venues; crowdsourced edits | History, Architecture, Culture, People |
| **Wikipedia EN** | en.wikipedia.org | More detailed for major sites (Nidarosdomen, Stiftsgården); better references | English bias toward tourists; may miss local detail | Landmarks, major museums, historical sites |
| **Riksantikvaren** | kulturminnesok.no | Official Norwegian cultural heritage registry; verified by state | Sparse text; focus on listed buildings; no practical info | Architecture, History (for registered sites) |
| **Visit Trondheim (official DMO)** | visittrondheim.no | Curated local knowledge, events, contact info | Marketing tone (less critical); limited history depth | Practical, Food, Culture |
| **Trondheim Kommune** | trondheim.kommune.no | Official municipal data, cultural sites, parks, services | Bureaucratic tone; sparse descriptions | Practical, Spatial, Nature (parks/facilities) |

### Tier 2: Secondary Sources (Good for Specific Topics)

| Source | URL | Best For | Notes |
|--------|-----|----------|-------|
| **Adressa (regional newspaper)** | adressa.no | Local news, restaurant reviews, events, People | Paywalled articles; search may require registration |
| **The Hidden North (blog)** | thehiddennorth.com | Local insights, tips, spatial narrative | English, blogger style; verify facts against Tier 1 |
| **Tripadvisor** | tripadvisor.com | Practical (hours, prices), user tips, recent reviews | Contradictory user opinions; verify against official sources |
| **Google Business Profile** | google.com/business | Practical (hours, phone, address), recent photos | May be outdated; primary for data but supplement with web search |
| **Michelin Guide** | guide.michelin.com | Food ratings (Michelin stars) | Only covers restaurants; limited to major cities |
| **Blomst.no / Norwegian travel blogs** | blomst.no | Food, culture, insider tips | Blog quality variable; cross-verify |
| **YouTube city guides** | youtube.com | Spatial narrative, atmosphere, walkthroughs | Visual but anecdotal; use for inspiration, verify facts |

### Tier 3: Supplementary Sources (Use for Verification Only)

| Source | Best For | Caveat |
|--------|----------|--------|
| Reddit (r/Trondheim, r/Norway) | Local tips, current info | Opinions, not facts; cross-verify |
| Instagram (location tags) | Atmosphere, current photos | Marketing-heavy; not factual |
| Historical archives (riksarkivet.no) | Deep history | Slow, specialized; for major sites only |
| Academic papers (DUCT, UiTN) | Culture, history | Narrow audience; requires library access |

### Source Selection by Topic

| Topic | Primary Tier 1 | Secondary Tier 2 | Why |
|-------|---|---|---|
| **history** | SNL, Wiki NO/EN, Riksantikvaren | Adressa archive, academic | Facts must be verifiable, dated |
| **architecture** | SNL, Riksantikvaren, Wiki | Hidden North (narrative) | Style/materials are factual; narrative adds value |
| **food** | Visit Trondheim, Google, Michelin | Adressa reviews, blogs | Menus change; Michelin is gold standard |
| **culture** | SNL, Wiki, Visit Trondheim | Museums' own sites, Adressa | Organization/exhibitions are verifiable |
| **people** | SNL, Wiki, Adressa | Hidden North | Biographies require sources |
| **nature** | Trondheim Kommune, Wiki | Hidden North | Parks/climate are facts; blog adds narrative |
| **practical** | Google Business, Visit Trondheim, Trondheim Kommune | Adressa, Tripadvisor | Hours/prices change; multiple sources reduce error |
| **local_knowledge** | Hidden North, Adressa, Visit Trondheim | Travel blogs, Reddit, Instagram | Subjective; aggregate multiple bloggers |
| **spatial** | Trondheim Kommune (map data), Mapbox | Hidden North, Visit Trondheim | Distances are computable; narrative from blogs |

---

## 3. Verification Strategy: What Counts as "2 Independent Sources"?

### 3.1 Verification Rules

**Rule 1: Editorial Hook Source**

If fact already exists in POI's `editorial_hook`:
- Fact is **automatically unverified** (editorial hooks are curator-written, not researched)
- Need **2 independent web sources** to mark as **verified**

**Rule 2: Two Sources = One Tier 1 + One Tier 2+**

Acceptable combinations:

✅ **Good:**
- SNL + Wikipedia NO
- Riksantikvaren + Visit Trondheim
- Wikipedia EN + Adressa article
- Google Business + Tripadvisor (for practical info)

❌ **Insufficient:**
- Two blog posts (Tier 3 only)
- One Wikipedia + one Reddit comment
- One blog + one Instagram caption

**Rule 3: Conflicting Sources**

If sources disagree (e.g., "founded 1074" vs "1090"):
- Confidence = **disputed** (even if from Tier 1 + Tier 2)
- Require manual curator review
- Include both dates in `structured_data`: `{ "year_start": [1066, 1074, 1090], "sources": [...] }`
- Add note in `fact_text`: "Historical records suggest 1066, 1074, or 1090"

**Rule 4: Recent Events (Last 2 Years)**

For recent openings, closures, ownership changes:
- Adressa + Visit Trondheim = **verified**
- Google Business + blogger = **unverified** (Google can be outdated)
- Newspaper + official city website = **verified**

**Rule 5: Permanent Facts (History, Architecture)**

For stable facts (founding date, architectural style, architect name):
- SNL = **verified** (if sources cited)
- SNL + Wikipedia = **verified**
- Wikipedia NO + Wikipedia EN = **unverified** (both can share common bias) — need third source
- But: Wikipedia EN + SNL = **verified** (different editorial boards)

**Rule 6: Subjective Info (Local Knowledge, Tips)**

Opinions cannot be verified. Instead:

"Hidden North blog + Tripadvisor review + Adressa column" = **consensus on local preference** (still `unverified`, but high confidence that locals say this).

Example: "Best time to visit Bakklandet is early morning" → 3 bloggers say same thing → Mark `unverified`, note `consensus: 3 sources`.

---

### 3.2 Decision Tree: When to Mark as Verified

```
START: Fact needs verification

1. Is it in editorial_hook already?
   YES → Source must be cited in hook?
         YES → Trust editorial_hook as source, still need 1 more
         NO → Need 2 independent sources
   NO → Need 2 independent sources

2. Is it from Tier 1 (SNL, Riksantikvaren, Wiki)?
   YES → Do we have 1 more Tier 1 or Tier 2?
         YES → VERIFIED ✓
         NO → Check if Wiki has references (if refs are to official sources) → VERIFIED
   NO → Is it from Tier 2 (Visit Trondheim, Google, blog)?
        YES → Need another Tier 1 or Tier 2
              YES → Check if they align
                    ALIGN → VERIFIED ✓
                    CONFLICT → DISPUTED
              NO → UNVERIFIED

3. Is it from Tier 3 only?
   YES → UNVERIFIED (even if 3 sources)
   NO → Apply rules above

4. Do sources agree?
   YES → Mark VERIFIED (if rule 2+ met)
   NO → Mark DISPUTED + curator review

END: Confidence assigned
```

---

### 3.3 Verification Examples

**Example 1: Nidarosdomen founding**
- SNL says: "Building began 1090"
- Wikipedia NO says: "1066 (shrine), 1090 (cathedral building)"
- Wikipedia EN says: "1090"
- Riksantikvaren: "1090"
- **Verdict:** VERIFIED (SNL + Wiki + Riksantikvaren agree on 1090; shrine predates cathedral)
- **Structured data:** `{ "year_start": 1090, "shrine_year": 1066 }`

**Example 2: Credo restaurant Michelin star**
- Google Business: "1 Michelin star ⭐"
- Visit Trondheim: "1 Michelin star"
- Michelin guide: "1 star 2024"
- Adressa article (2023): "1 Michelin star"
- **Verdict:** VERIFIED (multiple sources consistent)
- **Confidence:** high, recent verification

**Example 3: Bakklandet "best time to visit"**
- Hidden North blog: "Early morning, fewer tourists"
- Adressa culture column: "Weekday mornings are peaceful"
- Tripadvisor review: "Go early, it gets busy afternoon"
- Reddit r/Trondheim: "Morning = best vibe"
- **Verdict:** UNVERIFIED (all sources agree, but all are subjective)
- **Note:** Mark with `consensus: 4 sources` in metadata, display as `local_knowledge`

**Example 4: Stiftsgården room count**
- Editorial_hook: "140 rooms"
- Wikipedia NO: "140 rooms"
- Wikipedia EN: "140 rooms"
- SNL: (not found)
- Riksantikvaren: (not found)
- **Verdict:** UNVERIFIED (Wikipedia sources shared; need official museum source)
- **Action:** Contact Stiftsgården directly or use Tierärare museum guides

**Example 5: Rockheim founding year**
- Visit Trondheim: "Opened 2010"
- Google Business: "2010"
- Hidden North: "2010"
- Official Rockheim site: (no year stated)
- Wikipedia: (no Rockheim article)
- **Verdict:** VERIFIED (3 sources, 2022-2024, practical venue)
- **Note:** Practical info (opening) from multiple tourism sources = reliable

---

## 4. Topic Relevance by POI Category

Not all topics apply to all POI types. This table guides which topics agents should research.

### POI Category → Topic Mapping

| POI Category | Relevant Topics | Why | Skip Topics |
|---|---|---|---|
| **Landmark** (Nidarosdomen, Gamle Bybro, Kristiansten) | history, architecture, people, spatial | Identity based on historical/structural significance | food, practical (maybe), local_knowledge (secondary) |
| **Historic Building** (Stiftsgården, Erkebispegården) | history, architecture, people, culture, spatial | Deep background expected | food (unless now a museum cafe), local_knowledge (secondary) |
| **Museum/Gallery** | history, culture, people, architecture, practical | Collections + context + visiting info | food (unless on-site cafe), nature |
| **Restaurant/Cafe** | food, people, culture, local_knowledge, practical | Menu, chef, hours, vibe | architecture (secondary), spatial (secondary) |
| **Park/Green Space** | nature, spatial, local_knowledge, practical | Landscape, facilities, activities | history (unless historic park), architecture |
| **Neighborhood/Area** | history, culture, nature, spatial, local_knowledge, people | Character + context | practical (covered separately), architecture (secondary) |
| **Bike Station / Transit Stop** | practical, spatial | Hours, count, location | history, culture, food, people |
| **Sports Venue** (gym, sports hall) | practical, culture, spatial | Facilities, activities, hours | history (unless historic), architecture (unless notable), food |
| **Market/Shopping** | food (if market), practical, local_knowledge, culture | Operating info, vendors, vibe | people (unless famous vendor), architecture (secondary) |
| **Hotel** | practical, spatial, people, food | Rooms, amenities, restaurant, history | culture (unless culturally significant building) |
| **Historical Site** (fortress, burial mound) | history, architecture, nature, people, spatial | Deep historical context | food, practical (secondary) |

### Concrete Examples

**Nidarosdomen (landmark):**
- ✅ history: 1090 founding, Olav's shrine
- ✅ architecture: Gothic style, restoration
- ✅ people: Olav the Saint
- ✅ spatial: From Scandic Nidelven = 2.5km
- ❓ culture: Pilgrim destination, modern services
- ❌ food: Not a restaurant
- ❓ practical: Hours, admission (yes, include)
- ❌ local_knowledge: Not really applicable

**Credo (restaurant):**
- ✅ food: Michelin ⭐, ingredients, Nordic cuisine
- ✅ people: Chef Heidi Bjerkan, founded 2019
- ✅ practical: Hours, booking, location
- ✅ local_knowledge: "Hardest reservation in Trondheim"
- ✅ culture: Culinary philosophy, design
- ❌ history: Not historically significant (recent)
- ❌ architecture: Generic modern interior
- ❌ spatial: Only 1 venue, not a district

**Bakklandet (neighborhood):**
- ✅ history: 1600s–1800s working-class district
- ✅ spatial: Cobblestones, narrow streets, river-side
- ✅ culture: Arts scene, galleries, cafes
- ✅ local_knowledge: "Bohemian vibe", vintage shops
- ✅ nature: Riverside location, greenery
- ✅ people: Historic residents (optional deep dive)
- ❌ architecture: Covered under history
- ❓ practical: Where to eat (secondary—covered via nearby restaurants)

**Korsvika (swimming beach):**
- ✅ nature: Sandy beach, water temp, depth
- ✅ practical: Hours, parking, facilities
- ✅ local_knowledge: "Best beach in Trondheim", "Full in summer"
- ✅ spatial: Distance from Scandic, accessible by bike
- ❌ history: Modern beach resort
- ❌ architecture: Public facility
- ❌ food: No restaurants
- ❌ culture: Recreational, not cultural

---

## 5. Common Hallucination Traps for Norwegian POIs

AI models (including Claude) make predictable errors when researching Norwegian city facts. Know the traps.

### 5.1 Category-Specific Traps

**Historical Dates**

Trap: Model confuses founding dates.
- Nidarosdomen: Model may say "1066" (Olav's death) instead of "1090" (building start). Or conflate shrine + cathedral.
- Stiftsgården: May say "1778" (end) instead of "1774" (start), or state it was built in one year.

Mitigation:
- Always ask "When was construction completed vs started?"
- Cross-check with 2+ sources
- Mark ambiguous dates as `{ "year_start": X, "year_end": Y }` in structured_data

**Architect/Designer Names**

Trap: Model invents architect names or confuses patron with architect.
- Stiftsgården: Model may invent an architect name (there may not be one recorded). Cecilie Christine Schøller was the **patron**, not architect.
- Claim "designed by [person]" when actually "built under patronage of [person]".

Mitigation:
- Ask "Who designed it? Who built it? Who commissioned it?" separately
- If source doesn't provide architect name, leave blank (don't hallucinate)
- Tag as `unverified` if architect name cannot be confirmed in 2 sources

**Recent Openings / Closures**

Trap: Model uses outdated info (training cutoff) for recently opened/closed venues.
- "Credo opened in 2019" — model may say 2018 or 2020
- "Restaurant X closed 2024" — model doesn't know

Mitigation:
- Verify recent events (last 3 years) with Adressa or Google only
- Check Google Business listing for opening year and current status
- If Google says "Open" and Adressa says "Closed Jan 2024", mark as DISPUTED and escalate to curator

**Michelin Stars**

Trap: Model guesses or uses outdated Michelin ratings.
- "Credo has 1 Michelin star" may be wrong if guide updated this year
- "Britannia has X stars" — Michelin updates annually; model may have old info

Mitigation:
- Always cross-check Michelin Guide directly (michelin.com)
- Require 2 sources including official Michelin (2024 guide)
- Verify publication year of sources

### 5.2 Regional/Norwegian-Specific Traps

**Norwegian Place Names**

Trap: Model confuses Trondheim with other Norwegian cities or Scandinavian cities.
- "Bakklandet is in Oslo" (it's in Trondheim)
- "Solsiden is in Stavanger" (it's in Trondheim)
- Confuse "Trondheim" (1 city) with "Trøndelag" (regional county)

Mitigation:
- Always include "Trondheim" in query: `{POI_NAME} Trondheim`
- Verify coordinates: Is POI inside Trondheim bounds (63.41°N, 10.40°E center)?
- Cross-check area_id in query: e.g., `{POI_NAME} Trondheim sentrum` vs Trondheim suburbs

**Norwegian vs English Place Names**

Trap: Model returns English Wikipedia when Norwegian sources are needed (or vice versa).
- Norwegian: "Gamle Bybro" | English: "Old Town Bridge" — model may translate incorrectly
- "Bakklandet" has no direct English translation; model may improvise

Mitigation:
- Always verify Norwegian name matches POI database
- If using EN Wikipedia, cross-check with NO Wikipedia for local specificity

**Norwegian Language Nuances**

Trap: Model mistranslates or misinterprets Norwegian terms.
- "grunnlagt" = founded, but "etablert" = established (different contexts)
- "bydel" = neighborhood, but "område" = area (not always interchangeable)
- "visste du" = "did you know" (colloquial), model may over-formalize

Mitigation:
- Use Norwegian sources first, then verify EN if needed
- Preserve Norwegian phrasing in editorial hooks (curator tone)
- Don't force English translations for untranslatable concepts

### 5.3 Fact-Checking Traps

**Wikipedia Circularity**

Trap: Multiple Wikipedia articles cite each other, but original source is unknown or wrong.
- Nidarosdomen: EN Wiki → NO Wiki → EN Wiki → no original source = circular
- All say "1090", but none cite official Riksantikvaren

Mitigation:
- Require **3 independent sources** if using only Wikipedia
- Prefer Tier 1 sources (SNL, Riksantikvaren) even if less detailed
- If Wikipedia is only source, mark as `unverified`

**Blog Consensus ≠ Fact**

Trap: Multiple blogs repeat same claim, but none have verified source.
- 10 travel blogs say "Bakklandet best visited early morning" — but none cite data
- This is consensus on preference, not fact

Mitigation:
- Blog consensus → `local_knowledge` topic, `unverified` confidence
- Use language: "Local guides recommend..." (not "is best")
- Tag in `structured_data`: `{ "consensus": 10, "source_type": "blogs" }`

**Google Business Profile Staleness**

Trap: Google lists outdated hours, prices, or status.
- Restaurant marked "Open" but closed 6 months ago
- Phone number is 5 years old
- Hours incorrect (not updated since 2020)

Mitigation:
- Always cross-check Google with Tier 2 sources (Adressa, Visit Trondheim, Google Business reviews)
- For practical info < 2 years old, require 2 sources
- If Google and Adressa conflict → mark DISPUTED

**Video/Blog Photos Misdated**

Trap: Model sees recent YouTube video or Instagram photo, assumes info is current.
- Video title: "Bakklandet 2024" but video shot in 2020
- Blogger photo caption: "Visit Nidarosdomen today!" but post is from 2015

Mitigation:
- Check video/blog publication date, not just assumed recency
- Video/photo content ≠ current info
- For practical facts, require text-based sources with explicit dates

### 5.4 Structured Data Traps

**Invented "Structured Data"**

Trap: Model creates plausible but incorrect structured fields.
- `{ "architect": "Magnus the Great", "year": 1050 }` — sounds authoritative but unverified
- `{ "room_count": 140, "floor_area_m2": 8500 }` — invented precision

Mitigation:
- Structured data must map to explicit fact_text sentence
- Example: "140 rooms" in fact_text → `{ "room_count": 140 }` ✅
- No field should exist in structured_data without source

**Type Confusion**

Trap: Model assigns wrong types to values.
- `{ "year_built": "1770s" }` (string, ambiguous) instead of `{ "year_start": 1770, "year_end": 1779 }`
- `{ "distance_km": "10 minute walk" }` (wrong unit)

Mitigation:
- Define rigid schema for each topic's structured_data (see Section 6)
- Validate types in script before INSERT

---

## 6. Structured Data Extraction Schema Per Topic

Each topic gets standardized `structured_data` JSONB fields. Schema is strict; hallucinated fields are rejected in script validation.

### 6.1 HISTORY

```typescript
// fact_text: "Stiftsgården was built between 1774 and 1778 for widow Cecilie Christine Schøller."
{
  "topic": "history",
  "fact_text": "...",
  "structured_data": {
    "event_type": "construction|founding|opening|closing|renovation|disaster",
    "year_start"?: number,           // e.g., 1774
    "year_end"?: number,              // e.g., 1778
    "year_exact"?: number,            // if single year
    "person"?: string,                // e.g., "Cecilie Christine Schøller"
    "person_role"?: "founder|patron|architect|resident|owner",
    "keywords": string[],             // ["building", "aristocracy", "18th century"]
    "historical_period"?: string,     // "Renaissance|Baroque|Victorian|Industrial"
  }
}
```

**Validation rules:**
- `event_type` must be from enum
- `year_*` must be 4-digit number between 800 and current year
- `year_start <= year_end`
- `person` non-empty string
- `keywords` array of 2–8 items, lowercase

---

### 6.2 ARCHITECTURE

```typescript
// fact_text: "The cathedral is Gothic, with a sandstone facade and a slate roof."
{
  "topic": "architecture",
  "fact_text": "...",
  "structured_data": {
    "style": string,                  // "Gothic|Baroque|Rococo|Neoclassical|Art Nouveau|Modernist"
    "materials": string[],            // ["sandstone", "slate", "wood", "marble"]
    "architect"?: string,             // If known
    "year_built"?: number,
    "notable_features": string[],     // ["flying buttresses", "rose window"]
    "restoration_year"?: number,
    "keywords": string[],
  }
}
```

**Validation:**
- `style` from pre-defined list
- `materials` lowercase, known materials only
- `notable_features` 1–5 items
- `architect` optional but if present, must be documented in sources

---

### 6.3 FOOD

```typescript
// fact_text: "Credo has one Michelin star and uses only local ingredients within 30km radius."
{
  "topic": "food",
  "fact_text": "...",
  "structured_data": {
    "cuisine_type": string[],         // ["Nordic|European|Vegetarian|Meat|Seafood"]
    "chef_name"?: string,
    "michelin_stars"?: 0|1|2|3,       // Exactly these values
    "signature_dishes": string[],     // e.g., ["reindeer", "mushroom risotto"]
    "sourcing"?: string,              // e.g., "Local, 30km radius"
    "established_year"?: number,
    "awards": string[],               // ["James Beard Award", "World's 50 Best"]
    "keywords": string[],
  }
}
```

**Validation:**
- `cuisine_type` max 3 items
- `michelin_stars` must be 0–3 (not string)
- `established_year` between 1800 and now
- `chef_name` must cross-check against sources

---

### 6.4 CULTURE

```typescript
{
  "topic": "culture",
  "fact_text": "Rockheim museum houses Trondheim's largest rock music archive with 10,000+ recordings.",
  "structured_data": {
    "institution_type": "museum|gallery|theatre|concert_hall|festival",
    "collection_focus": string[],     // ["rock music", "visual art", "theater"]
    "collection_size"?: string,       // "10,000+", "extensive", "diverse"
    "curator_or_founder"?: string,
    "year_founded"?: number,
    "events"?: string[],              // ["daily concerts", "exhibitions"]
    "keywords": string[],
  }
}
```

---

### 6.5 PEOPLE

```typescript
{
  "topic": "people",
  "fact_text": "Founded by chef Heidi Bjerkan in 2019.",
  "structured_data": {
    "person_name": string,
    "role": "founder|architect|chef|artist|historical_figure|owner",
    "birth_year"?: number,
    "death_year"?: number,
    "nationality"?: string,           // "Norwegian", "Danish", etc.
    "notable_for": string[],          // ["founding Credo", "Michelin innovations"]
    "keywords": string[],
  }
}
```

---

### 6.6 NATURE

```typescript
{
  "topic": "nature",
  "fact_text": "Korsvika is a sandy beach with a max depth of 4 meters and ideal water temperature May–August.",
  "structured_data": {
    "landscape_type": "beach|park|forest|mountain|river|lake",
    "vegetation"?: string[],          // ["pine", "birch", "moss"]
    "wildlife"?: string[],            // ["salmon", "white-tailed eagle"]
    "water_features"?: string[],      // ["sandy beach", "rocky shore"]
    "climate_notes"?: string,         // "Temperate maritime"
    "seasonal_best"?: "spring|summer|autumn|winter|year-round",
    "keywords": string[],
  }
}
```

---

### 6.7 PRACTICAL

```typescript
{
  "topic": "practical",
  "fact_text": "Open daily 9 AM–5 PM. Admission 150 NOK for adults, 75 NOK for children.",
  "structured_data": {
    "opening_hours"?: {
      "monday_to_friday": "09:00-17:00",
      "saturday": "10:00-16:00",
      "sunday": "12:00-16:00",
      "closed_days"?: ["Dec 24–26"]
    },
    "admission_price"?: {
      "adult": "150 NOK",
      "child": "75 NOK",
      "group"?: "100 NOK/person"
    },
    "parking": "Free|Paid|Limited|None",
    "wheelchair_accessible": boolean,
    "restaurant_on_site": boolean,
    "guide_available": boolean,
    "contact_phone"?: string,          // "+47 12 34 56 78"
    "website"?: string,                // "https://example.no"
    "keywords": string[],
  }
}
```

**Validation:**
- `opening_hours.monday_to_friday` must be "HH:MM-HH:MM" format
- `admission_price` keys from enum: adult|child|student|group|family
- `parking` from enum
- `wheelchair_accessible` must be boolean (not string)
- Phone format: "+47 XX XX XX XX"
- Website must pass `isSafeUrl()`

---

### 6.8 LOCAL_KNOWLEDGE

```typescript
{
  "topic": "local_knowledge",
  "fact_text": "Locals recommend visiting Bakklandet on weekday mornings to avoid crowds.",
  "structured_data": {
    "tip_category": "timing|crowds|dining|activities|shopping|photo|hidden|insider",
    "best_time"?: "morning|afternoon|evening|weekday|weekend|specific_month",
    "consensus_sources": number,      // How many independent sources mentioned this
    "consensus_phrase": string,       // e.g., "3+ travel blogs agree"
    "keywords": string[],
  }
}
```

**Note:** `local_knowledge` facts are inherently `unverified` but useful. Use `consensus_sources` to indicate strength of opinion.

---

### 6.9 SPATIAL

```typescript
{
  "topic": "spatial",
  "fact_text": "Gamle Bybro is 500 meters south of Nidarosdomen and overlooks the Nidelva river.",
  "structured_data": {
    "relationship_to": "nearby_poi",  // Name of nearby POI
    "distance_meters"?: number,       // e.g., 500
    "walk_time_minutes"?: number,     // e.g., 8
    "relative_direction": "north|south|east|west|northeast|nearby",
    "navigational_note"?: string,     // e.g., "Follow Munkegata southward"
    "view_or_landmark": boolean,      // Does it have a notable view/outlook?
    "keywords": string[],
  }
}
```

**Validation:**
- `distance_meters` must be <= 5000 (if > 5km from POI, reconsider relevance)
- `walk_time_minutes` = distance_meters / 1.4 (assuming 1.4 m/s walking pace) — validate ballpark
- `relative_direction` from enum
- `relationship_to` must match known POI name in same area

---

## 7. Research Prompt Architecture (Per Topic)

Each agent receives a specialized prompt tuned for its topic. Prompts are designed to:
1. Emphasize fact-checking + source-crossing
2. Prevent hallucination via examples
3. Output valid JSON
4. Handle "no data found" gracefully

### Prompt Template Structure

```
[ROLE]
You are a {TOPIC}-specialist research agent for Placy's knowledge base.

[INPUT]
POI Name: {poi.name}
Category: {poi.category}
Address: {poi.address}
Existing Editorial Hook: {poi.editorialHook}

[TASK]
Research {TOPIC} facts about this POI. Use WebSearch.

[RULES]
1. Verify facts against ≥2 independent sources before marking 'verified'
2. Write fact_text in Norwegian, journalist tone (Curator voice)
3. Provide English translation (fact_text_en)
4. Include specific years, names, numbers
5. Return structured_data matching the schema below
6. Skip subjective opinions (e.g., "cozy", "beautiful")
7. Skip facts < 50 characters (too short)
8. If no reliable sources found, output empty array []

[SOURCES]
Primary: snl.no, no.wikipedia.org, kulturminnesok.no, visittrondheim.no
Secondary: adressa.no, en.wikipedia.org, google.com/business
Tertiary: travel blogs, reddit, tripadvisor (verify against primary)

[OUTPUT FORMAT]
Return valid JSON array:
[
  {
    "topic": "{TOPIC}",
    "fact_text": "...",
    "fact_text_en": "...",
    "structured_data": { ... },
    "confidence": "verified|unverified",
    "source_url": "https://...",
    "source_name": "..."
  }
]

[TOPIC-SPECIFIC GUIDANCE]
...

[EXAMPLES]
Example 1: [successful research output]
Example 2: [handling conflict/ambiguity]
Example 3: [avoiding hallucination]
```

---

## 8. Topic-Specific Prompts (Full Examples)

### HISTORY Prompt

```
[ROLE]
You are a history specialist researching Norwegian city facts.

[INPUT]
POI: {poi.name}
Category: {poi.category}
Existing Hook: "{poi.editorialHook}"

[TASK]
Research founding, major events, renovations, or historical significance.

[TOPIC-SPECIFIC RULES]
- Dates must be specific: If "mid-1700s", find exact year
- People: Include first+last name, role (founder/patron/architect/resident)
- Events: Fires, wars, renovations — anything that changed the building
- Historical periods: Connect to broader Norwegian context (Renaissance, Industrial, etc.)

[HALLUCINATION TRAPS — AVOID THESE]
❌ "Founded 1090" without distinguishing shrine vs cathedral (Nidarosdomen)
❌ Inventing architect names (state "unknown" if not found)
❌ Confusing founder with resident or patron
❌ Assuming "built 1800s" means exact date — find it

[SEARCH QUERIES]
Primary: "{poi.name} grunnlagt år", "{poi.name} historie", "{poi.name} Wikipedia"
Secondary: "{poi.name} snl.no", "Trondheim historie {poi.category}"

[EXAMPLES]
Input: Stiftsgården
Output:
{
  "topic": "history",
  "fact_text": "Stiftsgården ble bygget i perioden 1774–1778 som residens for enken Cecilie Christine Schøller.",
  "fact_text_en": "Stiftsgården was built from 1774 to 1778 as a residence for widow Cecilie Christine Schøller.",
  "structured_data": {
    "event_type": "construction",
    "year_start": 1774,
    "year_end": 1778,
    "person": "Cecilie Christine Schøller",
    "person_role": "patron"
  },
  "confidence": "verified",
  "source_url": "https://snl.no/Stiftsgården",
  "source_name": "Store Norske Leksikon"
}

[OUTPUT]
Return array of 2–4 facts if available, else empty array.
```

---

### FOOD Prompt

```
[ROLE]
You are a food and culinary specialist.

[INPUT]
POI: {poi.name}
Category: {poi.category}
Existing Hook: "{poi.editorialHook}"

[TASK]
Research cuisine type, chef, Michelin rating, signature dishes, sourcing philosophy.

[TOPIC-SPECIFIC RULES]
- Chef/owner names: Verify capitalization and spelling against 2 sources
- Michelin stars: ONLY trust michelin.com; verify current year
- Opening year: Distinguish "opened 2019" from "under new ownership 2019"
- Sourcing: Prefer exact sourcing radius (e.g., "30 km") over vague ("local")
- Signature dishes: Skip if not confirmed by menu or review

[HALLUCINATION TRAPS — AVOID]
❌ Michelin stars without verifying official Michelin guide 2024
❌ Inventing chef names
❌ "Local ingredients" without specifying radius
❌ Calling restaurants "cozy" or "intimate" (subjective, skip)

[SEARCH QUERIES]
Primary: "{poi.name} Michelin", "{poi.name} kokk sjef", "{poi.name} åpnet grunnlagt"
Secondary: "michelin.com {poi.name}", "{poi.name} menu ingredienser"

[EXAMPLES]
Input: Credo
Output:
{
  "topic": "food",
  "fact_text": "Credo ble grunnlagt av kokk Heidi Bjerkan i 2019 og holder én Michelin-stjerne. Restauranten bruker utelukkende norske råvarer innenfor 30 mils radius.",
  "fact_text_en": "Credo was founded by chef Heidi Bjerkan in 2019 and holds one Michelin star. The restaurant exclusively uses Norwegian ingredients within a 30-km radius.",
  "structured_data": {
    "cuisine_type": ["Nordic"],
    "chef_name": "Heidi Bjerkan",
    "michelin_stars": 1,
    "established_year": 2019,
    "sourcing": "Norwegian ingredients within 30 km radius"
  },
  "confidence": "verified",
  "source_url": "https://guide.michelin.com/no/...",
  "source_name": "Michelin Guide 2024"
}

[OUTPUT]
Return 2–5 facts if available, else empty array.
```

---

### LOCAL_KNOWLEDGE Prompt

```
[ROLE]
You are an insider/local knowledge specialist.

[INPUT]
POI: {poi.name}
Category: {poi.category}
Existing Hook: "{poi.editorialHook}"

[TASK]
Research local tips, best times to visit, insider recommendations, things tourists often miss.

[TOPIC-SPECIFIC RULES]
- Local knowledge is CONSENSUS, not fact. Require 3+ sources saying the same tip
- Mark confidence "unverified" even if multiple bloggers agree
- Use phrasing: "Locals recommend...", "Insiders suggest...", "Best visited..."
- Skip opinions ("it's beautiful") — include recommendations ("bring a camera for sunrise")
- Timing tips: Verify with 2+ sources

[HALLUCINATION TRAPS — AVOID]
❌ Single blog saying something → treat as anecdote, need 2+ more
❌ Inventing secrets ("Hidden room only locals know" without source)
❌ Subjective praise ("Perfect for couples")
❌ Outdated tips (e.g., "avoid summer crowds" may be false now)

[SEARCH QUERIES]
Primary: "{poi.name} tips hemmelighet", "visste du {poi.name}"
Secondary: "{poi.name} best time", "{poi.name} insider", "Tripadvisor {poi.name} tips", "hidden gems Trondheim"
Tertiary: Reddit r/Trondheim, Instagram location tags, travel blogs

[EXAMPLES]
Input: Bakklandet
Output (requires 3+ source consensus):
{
  "topic": "local_knowledge",
  "fact_text": "Lokale anbefaler å besøke Bakklandet tidlig på formiddagen på hverdager for å unngå folkemengder. Området er mest fredelig før klokka 11.",
  "fact_text_en": "Locals recommend visiting Bakklandet in early morning on weekdays to avoid crowds. The area is quietest before 11 AM.",
  "structured_data": {
    "tip_category": "timing",
    "best_time": "morning",
    "consensus_sources": 3,
    "consensus_phrase": "3 travel guides and local blogs recommend early mornings"
  },
  "confidence": "unverified",
  "source_url": "https://thehiddennorth.com/...",
  "source_name": "The Hidden North blog (consensus: 3 sources)"
}

[OUTPUT]
Return 1–3 tips if 3+ sources agree, else empty array.
```

---

## 9. Research Script Execution Plan

### 9.1 Script Signature

```typescript
/**
 * Research place knowledge for POIs using web search.
 *
 * Usage:
 *   npx tsx scripts/research-place-knowledge.ts --poi-id <id>
 *   npx tsx scripts/research-place-knowledge.ts --batch --area trondheim
 *   npx tsx scripts/research-place-knowledge.ts --dry-run --topic history
 *   npx tsx scripts/research-place-knowledge.ts --poi-id <id> --topic food
 *
 * Output: data/research/{poi_id}__{topic}.json (pre-review, not inserted)
 */
```

### 9.2 Execution Modes

**Mode 1: Single POI, all topics**
```bash
npx tsx scripts/research-place-knowledge.ts --poi-id nidarosdomen
# Output: data/research/nidarosdomen__*.json (9 files)
```

**Mode 2: Batch, all topics**
```bash
npx tsx scripts/research-place-knowledge.ts --batch --area trondheim --limit 5
# Researches 5 tier-1 POIs, all 9 topics
```

**Mode 3: Topic only**
```bash
npx tsx scripts/research-place-knowledge.ts --topic history --batch --area trondheim
# Only history research, all POIs
```

**Mode 4: Dry run (no web search, just schema validation)**
```bash
npx tsx scripts/research-place-knowledge.ts --dry-run --poi-id nidarosdomen
# Returns empty output, validates prompt construction
```

### 9.3 Parallel Agent Batching

Script respects CLAUDE.md's **4-agent max**:

```typescript
// Batch 1: topics 1-4 in parallel
const batch1 = await Promise.all([
  researchTopic(poi, "history"),
  researchTopic(poi, "architecture"),
  researchTopic(poi, "food"),
  researchTopic(poi, "culture"),
]);

// Wait for batch 1 to complete

// Batch 2: topics 5-9 in parallel
const batch2 = await Promise.all([
  researchTopic(poi, "people"),
  researchTopic(poi, "nature"),
  researchTopic(poi, "practical"),
  researchTopic(poi, "local_knowledge"),
  // spatial can be computed from Mapbox, not WebSearch
]);
```

Spatial topic is **computed** (Mapbox Distance API) + enriched with narrative from WebSearch (once per POI, not per batch).

### 9.4 Error Handling & Retry Logic

```typescript
// Per-topic retry: 3 attempts, exponential backoff
const researchWithRetry = async (
  poi: POI,
  topic: KnowledgeTopic,
  maxRetries = 3
): Promise<PlaceKnowledge[]> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await researchTopic(poi, topic);
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          `[${poi.id}][${topic}] Failed after ${maxRetries} attempts: ${error.message}`
        );
        // Log to stderr, return empty array
        return [];
      }
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(`[${poi.id}][${topic}] Retry ${attempt}/${maxRetries} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};
```

---

## 10. Pilot Execution Checklist (20 Landmark POIs)

### Phase 1: Setup (2–3 hours)

- [ ] Create `data/research/` directory (add `.gitignore` entry)
- [ ] Implement `scripts/research-place-knowledge.ts` with all 9 topic prompts
- [ ] Test with `--dry-run --poi-id nidarosdomen`
- [ ] Verify JSON schema validation works
- [ ] Create `scripts/validate-knowledge-json.ts` (optional, but helpful)

### Phase 2: Batch 1 Research (5 POIs × ~30 min each = 2.5 hours)

**POIs:** Nidarosdomen, Stiftsgården, Gamle Bybro, Erkebispegården, Bakklandet

```bash
npx tsx scripts/research-place-knowledge.ts --poi-id nidarosdomen
npx tsx scripts/research-place-knowledge.ts --poi-id stiftsgarden
# ... (3 more)
```

**Outputs:**
- `data/research/nidarosdomen__history.json`
- `data/research/nidarosdomen__architecture.json`
- ... (9 files per POI)

### Phase 3: Review & Feedback (1–2 hours)

**Manual review by curator:**
1. Read each `*.json` file
2. Spot-check sources (click links, verify facts)
3. Identify hallucinations or quality issues
4. Note: "history prompts are too verbose", "food needs more specificity", etc.
5. Document feedback in `data/research/FEEDBACK.md`

### Phase 4: Prompt Adjustment (1 hour)

Update prompts in `scripts/research-place-knowledge.ts` based on feedback:
- Shorten verbose outputs
- Add more specific examples
- Clarify hallucination traps
- Adjust structured_data schema if needed

### Phase 5: Batch 2-4 Research (15 POIs × ~25 min each = 6–8 hours)

**POIs:**
- Landmarks: Kristiansten festning, Torvet
- Museums: Rockheim, Ringve musikmuseum, Vitenskapsmuseet, Sverresborg
- Food: Britannia Hotel, Sellanraa, Bakklandet Skydsstation, Ravnkloa, Credo
- Areas: Solsiden, Midtbyen, Ila, Brattøra

Run in batches of 5:
```bash
npx tsx scripts/research-place-knowledge.ts --batch --area trondheim --limit 5 --start-index 5
```

### Phase 6: Bulk Review & Curation (2–3 hours)

- [ ] Curator reviews all 20 × 9 = 180 output files
- [ ] Sorts by confidence: verified, unverified, disputed
- [ ] Marks which facts are ready for `display_ready = true`
- [ ] Creates curation spreadsheet (optional)

### Phase 7: Backfill from Editorial Hooks (1 hour)

```bash
npx tsx scripts/backfill-knowledge-from-editorial.ts --dry-run
# Review output
npx tsx scripts/backfill-knowledge-from-editorial.ts --commit
```

This adds ~50–100 additional facts from existing editorial_hook text.

### Phase 8: INSERT to Supabase (30 min)

```bash
npx tsx scripts/insert-knowledge-facts.ts --review-first
# Read facts, prompt "Insert Y/N?"
# If Y: INSERT to place_knowledge table
```

### Phase 9: QA on Website (1 hour)

- [ ] Visit `/trondheim/steder/nidarosdomen` — verify knowledge sections appear
- [ ] Check English fallback on `/en/trondheim/places/nidarosdomen`
- [ ] MapPopupCard shows 1-line snippet for all 20 POIs
- [ ] Admin `/admin/knowledge` shows 180+ facts, filters work
- [ ] No duplicate hooks + knowledge (dedup logic working)

---

## 11. Rollout & Maintenance

### Phase 10: Public Launch

Once 20 POIs × 9 topics are verified + display_ready:

1. **SEO impact:** 20 Norwegian + 20 English detail pages now have deep knowledge sections
2. **Monitor:** Track which topics get most visitor engagement via analytics
3. **Iterate:** Adjust topics/structure based on traffic patterns

### Phase 11: Scale to 200+ POIs

After validating on 20 POIs, scale the pipeline:

```bash
# Monthly refresh: re-research Tier-1 POIs (Nidarosdomen, restaurants, etc)
npx tsx scripts/research-place-knowledge.ts --batch --area trondheim --tier 1 --refresh

# Quarterly: new POIs in trondheim or expand to next city
npx tsx scripts/research-place-knowledge.ts --batch --area trondheim --limit 50
```

---

## 12. Summary & Quick Reference

### Optimal Search Strategy by Topic

| Topic | Primary Source | Query Pattern | Confidence Threshold |
|-------|---|---|---|
| history | SNL, Wiki NO | "{name} grunnlagt år" | 2 sources (Wiki + 1 other) |
| architecture | Riksantikvaren, SNL | "{name} arkitektur stil" | 2 sources (Tier 1 + 1) |
| food | Michelin, Visit TRD | "{name} Michelin" | 2 sources (Michelin + site) |
| culture | SNL, wiki | "{name} kunst musikk" | 2 sources |
| people | SNL, wiki | "{name} grunnlegger" | 2 sources + name verification |
| nature | Kommune, wiki | "{name} naturlig" | 2 sources |
| practical | Google, Visit TRD | "{name} åpningstider" | 2 sources (Google + Adressa) |
| local_knowledge | Blogs, Tripadvisor | "{name} tips hemmelighet" | 3+ consensus sources |
| spatial | Mapbox + blogs | "{name} avstand" | Computed + narrative |

### Verification Quick Checklist

- [ ] 2+ independent sources agree?
- [ ] Are they different editorial boards (not Wikipedia→Wikipedia)?
- [ ] Do they cite original source (not circular)?
- [ ] Published date within 2 years (for practical info)?
- [ ] No hallucinated names/numbers?
- [ ] No invented precision (avoid "1770s" → "1773")?

### Common Hallucinations & Mitigation

| Trap | Fix |
|------|-----|
| Confused founding dates | Ask 2+ sources separately, distinguish events |
| Invented architect names | Say "unknown" if not in 2 sources |
| Outdated hours/prices | Require Google + Tier 2 source |
| Michelin stars wrong | Always verify michelin.com |
| Blog consensus as fact | Mark unverified, tag consensus count |
| Circulate Wikipedia | Require 3 sources if all Wikipedia |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-15
**Next Review:** After Batch 1 research feedback (2026-02-22)
