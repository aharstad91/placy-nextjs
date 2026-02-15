# Brainstorm: City Knowledge Base — Proprietær bykunnskap som IP

**Dato:** 2026-02-15
**Kontekst:** Placy har 1000+ POIs i Trondheim med editorial hooks, tiers, og kuratert innhold. Men kunnskapen er fragmentert — bakt inn i ferdige tekster (editorial_hook, transition_text), ikke lagret som strukturert, gjenbrukbar kunnskap. Med 20x Claude Pro-kapasitet kan vi bygge en systematisk research-pipeline som konverterer AI-compute til proprietær data-IP.

---

## Bakgrunn — Hva trigget dette

### Konkurrent-kartlegging: Selvguidede tur-plattformer
Research av GPSMyCity, VoiceMap, izi.travel, Questo, The Hidden North, Visit Norway viste:
- **Ingen** har strukturert, kuratert norsk bykunnskap i maskinlesbart format
- GPSMyCity: 6500+ turer, 1500 byer, men crowdsourcet bloggpost-kvalitet via Blog2App revenue share med reisebloggere. Trondheim: 2 turer, 17 stopp. Encyklopedisk fakta men null editorial voice
- The Hidden North: Beste enkeltkilde for Trondheim (20 stopp, presise fakta — Trampe: 130m, 24m høyde, 288 syklister/time). Men ren bloggpost-tekst
- VoiceMap: 2 audio-turer i Trondheim ("Inner Circle", "Regalia"), laget av The Arctic Storyteller. $4-6/tur, GPS-triggered audio. Høyere kvalitet enn GPSMyCity
- izi.travel: Verdens største gratis audio-guide (25 000+ turer, 2500 byer, 137 land). Trondheim finnes, ukjent omfang. Åpen plattform — hvem som helst kan lage guider
- Questo: Gamified treasure hunts, 1000+ byer. Trondheim finnes. Annet konsept (gåter), relevant for barneturer
- Visit Norway: 4 offisielle tematiske ruter for Trondheim, inkludert "Art and Vintage" som starter fra Scandic Nidelven

### Konkurrent-kartlegging: Rike stedsider (engelsk)
Utvidet research på engelskspråklige plattformer som gjør *individuelle stedsider* med dybde:

| Plattform | Hva de gjør bra | Hva de mangler | Trondheim-dekning |
|-----------|----------------|----------------|-------------------|
| **Atlas Obscura** | 20 000+ steder, redaksjonelt kuratert, rik historikk | Kun obskure/uvanlige steder. Har ikke vanlige restauranter, kaféer, eller mainstream sightseeing | Minimal — én artikkel om St. Olavs gravsted |
| **Spotted by Locals** | 80 byer, personlige tips med navn og ansikt | Bloggposter, ikke strukturert kunnskap | **Har ikke Trondheim** |
| **Time Out** | Rike byguider, sterk redaksjonell kvalitet | Kun store globale byer (London, NYC, Tokyo) | Ingen dekning |
| **Culture Trip** | Reiseartikler med lokal vinkling | Listeartikler ("10 ting å gjøre"), ikke individuelle stedsider | Overflate |
| **Google Maps** | Alle steder i verden | Null redaksjonell dybde, ingen historikk/arkitektur/lokal kunnskap | Volum uten dybde |
| **Wikipedia** | Dyptgående artikler for landemerker | Ikke stedsoptimalisert, ingen kart, ingen "i nærheten", ingen opplevelseskontekst | Encyklopedisk |

**Hovedfunn:** Gapet er reelt — også på engelsk. Atlas Obscura er det nærmeste konseptuelt (rike stedsider med editorial voice), men dekker bare det uvanlige. **Ingen gjør rike, strukturerte, kuraterte stedsider for *alle typer steder* i nordiske byer.** Krysset mellom Google Maps (bredde) × Atlas Obscura (dybde) × Wikipedia (fakta) eksisterer ikke.

### Strategisk innsikt fra PROJECT-LOG
- **2026-02-11:** "Placy bygger potensielt verdifull IP gjennom sin POI-database"
- **2026-02-14 (sesjon 8):** Cruiseline-segmentet (34 havner, 400K passasjerer) krever by-kunnskap i skala
- **Gjennomgående:** Hver editorial-sesjon (restaurant, museum, kafé) researcher de samme stedene, men lagrer resultatet som ferdig tekst — ikke som gjenbrukbar kunnskap

---

## Hva vi bygger

**En strukturert kunnskapsbase om norske byer** som:
1. Lagrer fakta, relasjoner, og kontekst per sted — ikke bare ferdige tekster
2. Fylles systematisk via multi-agent research swarms
3. Driver alle Placy-produkter (Explorer, Report, Trips) fra én kilde
4. Muliggjør fremtidige AI-produkter (conversational guide, personaliserte opplevelser)

### Kjerneinsikten
Alle har tilgang til Claude. Alle kan søke "Stiftsgården Trondheim". Men **ingen har en strukturert, verifisert, kuratert kunnskapsbase om norske byer optimalisert for opplevelsesprodukter.** Dataen er IP-en, ikke AI-modellen.

---

## Hvorfor dette er IP investorer verdsetter

Tre typer IP:
1. **Teknologi-IP** (patenter, algoritmer) — lett å kopiere, vanskelig å forsvare
2. **Nettverks-IP** (brukere tiltrekker brukere) — krever millioner
3. **Data-IP** (proprietær, strukturert, kumulativ) — **dette er Placy**

Eksempler: Zillow (Zestimate), Foursquare ($1.8B pivot fra app til data), Yelp (review-corpus).

**Moat:** Kumulativ. Hver dag med research og kuratering øker verdien. Kan ikke kopieres over natten.

---

## Designbeslutninger

### 1. Separat knowledge-tabell, ikke utvidelse av `pois`

**Valg:** Ny `place_knowledge`-tabell som refererer til `pois` men også kan eksistere uavhengig.

**Begrunnelse:**
- `pois`-tabellen er allerede tung (30+ kolonner etter 33 migrasjoner)
- Kunnskap er multi-dimensjonal — ett sted kan ha 10-20 fakta på tvers av topics
- Noen kunnskap er by-nivå, ikke sted-nivå ("Trondheim ble grunnlagt i 997")
- Kunnskap kan versjoneres og oppdateres uavhengig av POI-data
- `poi_metadata` JSONB er for ustrukturert — ingen schema, ingen indeksering

**Alternativ vurdert:** Utvide `poi_metadata` JSONB. Avvist fordi:
- Ingen type-safety, ingen indeksering, ingen relasjoner
- Umulig å spørre "finn alle steder knyttet til 1681-brannen"
- Blander operasjonell metadata med kunnskaps-data

### 2. Topic-basert kategorisering

**Valg:** Hvert kunnskapsfaktum har et `topic`:
- `history` — hendelser, branner, kriger, grunnlegging
- `architecture` — byggestil, materialer, arkitekt, årstall
- `food` — retter, kokker, tradisjoner, ingredienser
- `culture` — kunst, musikk, teater, festivaler
- `people` — grunnleggere, historiske figurer, nålevende
- `nature` — geografi, klima, fauna, sesong
- `practical` — åpningstider, priser, tilgjengelighet
- `local_knowledge` — "visste du at", hemmeligheter, lokaltips
- `spatial` — gangavstander, ruter, nabolagskarakter

**Begrunnelse:** Topicene matcher agent-spesialiseringene i research-pipelinen. Agent 1 = history, Agent 2 = food, osv.

### 3. Confidence-nivåer

**Valg:** Hvert faktum har `confidence`: `verified` | `unverified` | `disputed`

**Begrunnelse:**
- AI-research kan hallusinere — vi trenger å skille verifiserte fakta fra antagelser
- Curator-loopen: agent researches → lagrer som `unverified` → kurator verifiserer → `verified`
- Produkter kan filtrere: editorial hooks bruker bare `verified`, internt research-view viser alt

### 4. Source tracking

**Valg:** Hvert faktum har `source_url` og `source_name`.

**Begrunnelse:**
- Muliggjør re-verifisering
- Identifiserer hvilke kilder som er pålitelige
- Juridisk: kan dokumentere at fakta er fra åpne kilder
- Research-pipeline kan unngå duplikat-research

### 5. By-nivå vs sted-nivå kunnskap

**Valg:** `poi_id` er nullable. Fakta uten poi_id er by-nivå kunnskap.

**Eksempler:**
- Med poi_id: "Stiftsgården har 140 rom" → knyttet til Stiftsgården-POI
- Uten poi_id: "Trondheim ble grunnlagt av Olav Tryggvason i 997" → by-nivå
- Uten poi_id: "Bakklandet var arbeiderklasse-bydel på 1600-tallet" → nabolags-nivå (area_id)

### 6. Structured data som JSONB

**Valg:** `structured_data JSONB` for maskinlesbare fakta ved siden av `fact_text`.

**Eksempel:**
```json
{
  "fact_text": "Stiftsgården ble bygget mellom 1774 og 1778 for enken Cecilie Christine Schøller",
  "structured_data": {
    "year_start": 1774,
    "year_end": 1778,
    "person": "Cecilie Christine Schøller",
    "role": "byggherre",
    "building_type": "residens"
  }
}
```

**Begrunnelse:** `fact_text` er for mennesker og LLM-er (RAG). `structured_data` er for spørringer ("finn alle bygninger fra 1700-tallet").

### 7. Multi-agent research pipeline

**Valg:** 4 agenter parallelt, topic-spesialisert, JSON-output.

**Prosess:**
1. Definer research-scope (by, nabolag, eller enkelt-sted)
2. Spawn 4 agenter med ulike topics
3. Hver agent: WebSearch → verifisér → strukturér → lagre som JSON
4. Reconciliation: sjekk for duplikater og konflikter på tvers av agenter
5. Kurator godkjenner / markerer som verified

**Agenter per batch:**
- Batch 1: history, architecture, food, culture
- Batch 2: people, nature, practical, local_knowledge

**Kapasitet:** 4 agenter × 2 batches = 8 topic-spesialiserte research-passes per by.

### 8. Lagring i Supabase (ikke filer)

**Valg:** PostgreSQL-tabell med JSONB, ikke JSON-filer i repo.

**Begrunnelse:**
- Querybar: "finn alle fakta om arkitektur innenfor 500m fra hotellet"
- Skalerbar: tusenvis av fakta per by
- Relasjoner: foreign key til pois, areas
- RLS: service_role for skriving, public for lesing
- Backup: Supabase håndterer
- pgvector: kan legge til embeddings senere uten migrering av dataformat

---

## Visjonen: Fra tre produkter til én intelligens

### I dag
```
Explorer  →  "Her er et kart med steder"     (statisk POI-liste)
Report    →  "Her er en artikkel"              (statisk tekst)
Trips     →  "Her er en rute å gå"             (statisk sekvens)
```

### Med knowledge base + AI
```
Placy  →  "Hva vil du vite? Hva vil du gjøre? Hvor er du?"
       →  Genererer personalisert opplevelse basert på:
          - Kunnskapsbase (fakta, relasjoner, kontekst)
          - Kontekst (hotell, tid, vær, preferanser)
          - Curator voice (editorial tone)
```

**Explorer, Report og Trips er ikke bortkastet.** De er treningsdata:
- Explorer → grunndata (POI-er med kvalitetsvurdering)
- Report → kontekstuell kunnskap (editorial hooks, nabolagskarakter)
- Trips → bevegelseskunnskap (ruter, transitions, spatial relasjoner)
- Curator skill → personlighet (tone, stemme, registre)

### Teknologi som finnes i dag
- Supabase pgvector → semantisk søk over kunnskapsbasen
- Claude API med RAG → generer svar fra strukturerte fakta
- Streaming chat → samtale-grensesnitt
- Multi-agent research → systematisk datainnhøsting

---

## Umiddelbar verdi: Surface kunnskap i eksisterende produkter

AI-chatboten er visjonen. Men kunnskapsbasen gir verdi **fra dag 1** i produkter som allerede finnes.

### POI-detaljsiden (`/trondheim/steder/[slug]`)

I dag: tynn — navn, kategori, kanskje en editorial hook.
Med knowledge base: **komplett stedside** med tematiske seksjoner.

```
/trondheim/steder/stiftsgarden

Stiftsgården — Skandinavias største trebygning

[Historikk]
Bygget 1774–1778 for enken Cecilie Christine Schøller...

[Arkitektur]
Barokk, rokokko og nyklassisisme. Fasaden er original...

[Visste du?]
Kongesalongen har silketapeter fra Lyon. Parken ble skilt fra i 1906...

[I nærheten]
Torvet (2 min) · Nidarosdomen (5 min) · Vår Frue Kirke (3 min)
```

### MapPopupCard / markør-innsikt

Kort "Innsikt"-fane i popup-kortet: 2-3 fakta fra kunnskapsbasen. Nok til å gjøre markøren interessant. "Les mer" fører til stedsiden.

### SEO-effekt

Søk "Stiftsgården Trondheim" i dag gir Wikipedia (tørr), Visit Trondheim (marketing-blurb), SNL (encyklopedisk). **Ingen** treffer turisten som vil forstå stedet. En Placy-stedside med Curator-tone, strukturerte fakta, og "i nærheten" ville rankere godt — dyptgående, unikt innhold som matcher brukerintensjonen.

200 steder × NO + EN = **400 stedsider** som SEO-overflate. Hver en landingsside for long-tail-søk.

### Strategisk gevinst

| Gevinst | Forklaring |
|---------|-----------|
| SEO | 400 stedsider med unikt, dyptgående innhold |
| Validering | Ser om innholdet er godt før vi bygger AI-lag |
| Differensiering | Ingen konkurrent har dette — heller ikke på engelsk |
| Umiddelbar verdi | Forbedrer eksisterende produkter uten å bygge nye |
| Data-kvalitet | Tvinger oss til å verifisere fordi fakta vises til brukere |
| Investor-synlighet | "Se — vår kunnskapsbase driver allerede produkt" |

**Det elegante:** Kunnskapsbasen driver stedsidene i dag. Samme data driver AI-opplevelsene i morgen. Ingen re-arkitektering nødvendig.

---

## Hva vi IKKE bygger (ennå)

- **AI chat-grensesnitt** — det er fremtiden, ikke MVP
- **Vector embeddings** — legges til når kunnskapsbasen har nok data
- **Automatisk tur-generering** — krever chat + spatial reasoning
- **Personalisering** — krever brukerdata vi ikke har ennå
- **Flere byer** — Trondheim først, mønsteret skalerer etterpå

---

## Åpne spørsmål

### Granularitet
Hvor detaljert? "Stiftsgården har 140 rom" vs "Stiftsgården har 140 rom fordelt på 3 etasjer med barokk, rokokko og nyklassisistisk interiør, og Kongesalongen har silketapeter fra Lyon." Mer detalj = mer verdi, men mer research-tid.

**Foreslått:** Start med 3-5 fakta per sted i første pass. Dypdykk på Tier 1-steder.

### Overlap med editorial_hook/local_insight
Existing editorial data (hooks for 200+ POIs) er allerede en form for kunnskap. Skal vi backfill-importere den inn i knowledge-tabellen?

**Foreslått:** Ja, som del av pipeline — parse eksisterende hooks til strukturerte fakta. Gir umiddelbar verdi uten ny research.

### Vedlikehold
Fakta utdateres — restauranter stenger, åpningstider endres. Hvordan holder vi kunnskapsbasen oppdatert?

**Foreslått:** `verified_at TIMESTAMPTZ` + quarterly refresh-script. Men dette er Phase 2-problem.

### Research-prompt kvalitet
Agent-promptene er kritiske for datakvalitet. Trenger iterasjon.

**Foreslått:** Start med Trondheim sentrum (20-30 steder), evaluer output, juster prompts, deretter skaler.

---

## Beslutninger

| # | Beslutning | Begrunnelse |
|---|-----------|-------------|
| 1 | Separat `place_knowledge`-tabell | Multi-dimensjonal kunnskap passer ikke i `pois`-tabellens flate struktur |
| 2 | Topic-basert kategorisering (9 topics) | Matcher agent-spesialisering og muliggjør tematiske spørringer |
| 3 | Confidence-nivåer per faktum | Skiller AI-generert fra kurator-verifisert |
| 4 | Source tracking | Re-verifisering, juridisk, research-dedup |
| 5 | Nullable poi_id (by-nivå + sted-nivå) | Nabolagskarakter og byhistorikk er ikke knyttet til enkelt-POI |
| 6 | fact_text + structured_data JSONB | Mennesker/LLM leser tekst, maskiner spør JSON |
| 7 | 4 agenter parallelt, topic-spesialisert | Respekterer CLAUDE.md max 4-grense, 8 topics i 2 batches |
| 8 | Supabase PostgreSQL, ikke filer | Querybar, skalerbar, pgvector-ready |
| 9 | Trondheim sentrum først (20-30 steder) | Valider pipeline før skalering |
| 10 | Backfill fra eksisterende editorial data | Gir umiddelbar verdi, ingen ny research nødvendig |
| 11 | Surface i eksisterende produkter først | POI-detaljsider + MapPopupCard innsikt-fane — verdi fra dag 1, SEO-gevinst |
| 12 | NO + EN stedsider | 200 steder × 2 språk = 400 SEO-landingssider. Dobler overflaten |
| 13 | Gapet er reelt — også på engelsk | Atlas Obscura nærmest, men kun obskure steder. Ingen gjør dette for mainstream POIs |

---

## Neste steg

Kjør `/plan` med scope:
1. Supabase-migrasjon: `place_knowledge`-tabell med alle felter
2. TypeScript-typer for knowledge data
3. Research agent-prompt (én mal per topic)
4. Pilot: Trondheim sentrum, 20 nøkkelsteder, alle 9 topics
5. Backfill-script: parse eksisterende editorial_hook → knowledge-fakta
6. Berike POI-detaljsidene (`/[area]/steder/[slug]`) med knowledge-data
7. Innsikt-fane i MapPopupCard
8. Enkel admin-visning: "Hva vet Placy om [sted]?"
