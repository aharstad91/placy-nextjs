---
name: generate-rapport
description: Generer nabolagsrapport for rapport-produktet. Tekst i Sem & Johnsen-kvalitet, motivert av målgruppe-personas og med rød tråd mellom 7 kategorier. Er MVP-versjon fokusert på tekst-pipelinen; utvides gradvis med illustrasjon, 3D og publisering.
triggers:
  - generate-rapport
  - generer rapport
  - skriv rapport
  - rapport-tekst
---

# Generate Rapport — Nabolagsrapport i S&J-kvalitet

**Modell:** Tekst-pipelinen krever skjønn og WebSearch. Bruk Opus. Ikke bytt til Sonnet.

Produserer rapport-produktet fra scratch: heroIntro + 7 kategori-tekster, motivstyrt, persona-tilpasset, S&J-kvalitet. POI-innsamling er ikke i scope — skillen forutsetter at POIs allerede er i Supabase.

## Scope

### MVP (denne iterasjonen) — robust > elegant

Vi prioriterer **robust og skalerbar** over S&J-kvalitet. Vi har ikke skrive-evne eller research-kapasitet til å automatisk produsere S&J-nivå tekster uten manuelt kvalitetssjekk. MVP-valg:

- **Template-struktur** per kategori (4-5 setninger: 1 bridge + 3-4 extended — fast struktur, ikke adaptiv per persona)
- **Web-research før skriving** — WebFetch offisiell kilde per navngitt senter/institusjon før tekst-generering. Påstander uten triangulering → hedges eller dropes.
- **Navngivings-hierarki** — aldri navngi i generiske kategorier (dagligvare, apotek, frisør)
- **Lokasjon stabilt, innhold flyktig** — navngi sentre/skoler/museer; beskriv tilbud kategorisk, ikke per merke
- **Beskriv tilbudet, ikke valget** — ingen preskriptive anbefalinger ("passer best for", "det naturlige valget")
- **Kvantitativ generalisering** — "titalls frisører" fremfor navnelister; drop utdaterte kategorier (bank, post, fastlege)
- **Vanlig norsk** — ingen bransje-sjargong (third-wave, fine-dining, boutique)
- **Data-drevet hero** — tre avstands-ankre, ingen manuell nabolag-research
- **Ingen bro-setninger** mellom kategorier — motiv nevnes i hero, ikke i bro
- **Google AI-lenke per tema** (`readMoreQuery`) — generisk skill-tekst, dybde overlates til Google AI Mode

Senere iter kan bevege mot S&J-kvalitet etter hvert som research/skrive-evne modnes.

**Output:**
- heroIntro (3 setninger, template-basert)
- Kategori-tekster (3 setninger hver, template-basert)
- Motiver auto-generert fra data (ikke WebSearch-avhengig)
- Lagring i reportConfig

### Ikke-scope (senere iterasjoner)
- POI-innsamling (gjøres av legacy `/generate-bolig`, `/generate-adresse` osv.)
- Hero-illustrasjon (iter 2 — vil kalle `placy-illustrations` internt)
- 3D-kart-konfigurasjon (iter 3)
- Full publisering-workflow (iter 3)

### Eksplisitt ikke-rørt
- Explorer-produktet
- Trips-produktet
- `editorial_hook` per POI (Steg 10 i legacy `/generate-bolig`)

## Input-kontrakt

```
/generate-rapport <prosjekt-id> --persona <liste> [--pendler] [--motiver <liste>]
```

**Påkrevd:**
- `<prosjekt-id>`: f.eks. `banenor-eiendom_stasjonskvartalet`. POIs må være i Supabase.
- `--persona`: 1-3 komma-separerte verdier fra: `forstegangskjoper`, `etablerer`, `barnefamilie`, `femtiefem-pluss`

**Valgfri:**
- `--pendler`: Modifikator-flagg. Bumper Transport til minimum Høy.
- `--motiver "motiv1,motiv2,motiv3"`: Overstyrer automatisk motiv-generering.

**Eksempel:**
```
/generate-rapport banenor-eiendom_stasjonskvartalet --persona forstegangskjoper,femtiefem-pluss
```

## Output

Patches `products` tabellen (product_type=report):
```json
{
  "config": {
    "reportConfig": {
      "heroIntro": "3-4 setninger som etablerer 2-3 motiver",
      "motiver": ["motiv1", "motiv2", "motiv3"],
      "themes": [
        {
          "id": "hverdagsliv",
          "bridgeText": "Broingssetning + 1 innledende setning (vises alltid)",
          "leadText": "Hovedinnhold, 3-5 setninger (adaptiv lengde)"
        }
        // ... 6 flere temaer
      ]
    }
  }
}
```

Pluss oppdatering av `translations` for engelsk bridgeText per tema (ikke leadText — den er kun norsk).

## Personas og vektmatrise

Se `references/personas.md` for persona-definisjoner.
Se `references/vektmatrise.md` for kategori-vekting per persona.

**Kort:** 4 personas + Pendler-flagg:

| Persona | Alder | Fokus |
|---------|-------|-------|
| `forstegangskjoper` | 20-30 | Sentrum, transport, urbant liv |
| `etablerer` | 25-40 | Livsstil, kultur, mat/drikke |
| `barnefamilie` | 30-45 | Skole, barnehage, natur, trygt nabolag |
| `femtiefem-pluss` | 55-75 | Tilgjengelighet, tjenester, mindre vedlikehold |

Kombinasjonsregel: Ved flere personas, **union vektingen** — høyeste nivå per kategori vinner.

Lengde per kategori (adaptiv):
- **Høy** = 6-7 setn (kjernetema for minst én valgt persona)
- **Medium** = 5 setn (relevant)
- **Lav** = 4 setn (minimum, alltid inkludert)

heroIntro = 3-4 setn (minimum 3).

## Kvalitetsaksler per POI

Se `references/kvalitetsaksler.md` for full definisjon.

**Kort:** Per POI som vurderes til tekst, hent 5 aksler:
1. **Kjede-status** (uavhengig / nasjonal kjede / lokal kjede)
2. **Priskategori** (budget / middel / premium)
3. **Målgruppe-appell** (familie / voksen / ungdom / universell)
4. **Spesialitet** (fri tekst, 3-10 ord — hva er stedet kjent for)
5. **Kvalitetsnivå** (topp / solid / blandet)

Aksler hentes via: Google Places data + WebSearch. Lagres i `poi_metadata` på POI-raden (ved behov — ikke alle POIs trenger full research).

**Viktig gotcha:** `is_chain`-feltet i Supabase er ofte `false` for kjeder (metadata er ufullstendig). **Stol på WebSearch**, ikke isChain-feltet alene.

## Motiv-generering

Se `references/motiver.md` for detaljer.

**Tre motiv-typer:**
1. **Geografisk anker** (kaifronten, elva, torget)
2. **Avstands/tempo** (10-minutters-livet til sentrum)
3. **Karakter-motiv** (stasjonsnabolaget, familie-stedet)

**Mekanisme C (fast med fallback):** Prøv ett av hver type. Hvis én type er svak i research, bytt til tilleggsmotiv av sterkere type.

**Kilder:**
- Kartdata (landemerker, parker, vann innen 500m) → geografisk
- Travel-times-matrise → avstand/tempo
- WebSearch "`{bydel} {by}` nabolag" → karakter

## Pipeline — Stegene

### Steg 0: Les input + hent prosjekt-data
- Hent projects-rad (center_lat/lng, venue_type, venue_context).
- Hent alle project_pois + pois.
- Hent eksisterende reportConfig (for bakoverkompatibilitet; vi overskriver).

### Steg 1: Persona-konfigurasjon
- Les `--persona` flag.
- Bygg vektmatrise per kategori ved å *union* personas (høyeste vekting vinner).
- Hvis `--pendler` er satt: Transport += bump til minimum Høy.
- Resultat: `weights: { hverdagsliv: "H", barn-oppvekst: "L", ... }` (H/M/L).

### Steg 2: POI-shortlist per kategori
For hver av de 7 kategoriene:
- Filtrer POIs som matcher kategoriens `categories`-liste.
- Beregn gangavstand (distanceMeters / 80).
- Rank etter: T1+local_gem først, deretter rating × review_count, så avstand.
- Ta de 10 kandidatene for videre research.

### Steg 2.5: Grounding via Gemini (erstatter manuell WebFetch)

**Hvorfor:** LLM-intuisjon om hva sentre/institusjoner inneholder er OFTE feil. "Byhaven samler dagligvarekjedene" er et ekte eksempel fra iter 7 — Byhaven har ingen lavpris-dagligvare. Se `references/anti-patterns.md` for flere. Løsningen er Google Search-grounding per kategori.

**Før tekst-generering:** Kjør scriptet én gang per prosjekt. Det gjør ett parallellt Gemini-kall per kategori (7 totalt, ~10-15s) med `google_search`-tool, lagrer fact-sheet + narrativ + kilder + `searchEntryPointHtml` i `products.config.reportConfig.themes[].grounding`.

```bash
# Dry-run først (ingen write)
!npx tsx scripts/gemini-grounding.ts <project_id>

# Apply etter sanity-check av output
!npx tsx scripts/gemini-grounding.ts <project_id> --apply

# Overskriv eksisterende grounding (ellers skippes temaer som allerede har det)
!npx tsx scripts/gemini-grounding.ts <project_id> --apply --force
```

**Scriptet garanterer:**
- Backup av full config-rad til `backups/` før write
- Whitelist-guard på `reportConfig`-nøkler (aborter ved ukjent nøkkel)
- Optimistic concurrency lock (`updated_at`-match)
- Deep-merge per tema matched på `id` — eksisterende `bridgeText`, `motiver`, `summary` etc. klobberes aldri
- Totalfeil-abort hvis ≥5/7 kategorier feiler
- Omit (ikke null) per tema ved per-kategori-feil
- Post-write deep-equal på preserved keys + `revalidateTag`

**Forbruk:** ~$0.02-0.10 per prosjekt (7 Gemini-kall). Rerun trygt — `--force` trengs for å overskrive eksisterende.

**Output per kategori (lagres):**
```typescript
grounding: {
  narrative: "Stasjonskvartalet har planlagt...",  // 5+ setninger norsk prosa
  sources: [{ title, url, domain }, ...],          // 6-17 autoritative kilder
  searchEntryPointHtml: "<style>...</style><div>...", // Google ToS-påkrevd
  fetchedAt: "2026-04-18T19:00:00Z",
  groundingVersion: 1,
}
```

**Skill-siden bruker `grounding.narrative` som fact-feed i Steg 7** — se hvordan der. UI-siden viser `searchEntryPointHtml` i sheet-drawer (Phase 3).

### Steg 2.7: Curate grounded narrative (v2)

**Hensikt:** Erstatt to-tekst-mønsteret (Placy `leadText` + raw Gemini `narrative`) med én unified kuratert tekst per tema. Claude tar Gemini-fakta + prosjektets POI-set + Placy-kontekst, skriver sammenhengende markdown med POI-inline-lenker `[Navn](poi:uuid)`. Rød tråd + POI-chips i hele teksten.

**Script-kommandoer:**
```bash
# 1. Prepare: genererer .curation-staging/<pid>/<theme>.context.json per tema
npx tsx scripts/curate-narrative.ts prepare <project_id>

# 2. (Claude/skill leser context, skriver .curated.md per tema)

# 3. Apply: validerer .curated.md, kjører POI-linker, PATCHer DB
npx tsx scripts/curate-narrative.ts apply <project_id>
```

**Flyt per tema (etter `prepare`):**

1. Les `.curation-staging/<pid>/<theme_id>.context.json`:
   - `gemini_narrative_sanitized`: Gemini-tekst (markdown-lenker strippet, kontroll-chars fjernet)
   - `gemini_source_domains`: ["trondheim.kommune.no", "visittrondheim.no", ...]
   - `poi_set`: [{uuid, name, category}] — POIs i temaets kategorier
   - `target_length_min` / `max`: 600–800 tegn
2. Skriv curated markdown til `.curation-staging/<pid>/<theme_id>.curated.md`:
   - Bruk KUN fakta fra `gemini_narrative_sanitized` + `poi_set.name`
   - Legg inn `[POI-navn](poi:uuid)` for POIs fra `poi_set` som naturlig hører hjemme (max én per POI, første forekomst)
   - Behold Placy's redaksjonelle tone: rolig, informativ, uten superlativer
   - 600–800 tegn (hard cap 1200)
   - IKKE legg til navn, årstall, eller egenskaper utenfor inputen
3. Etter alle temaer er skrevet: kjør `apply`

**Sikkerhet (håndhevet av scriptet):**

- **Prompt-injection:** `gemini_narrative` er allerede strippet for markdown-lenker og kontroll-chars
- **NER-sjekk:** proper nouns i curated output må matche `gemini_narrative ∪ poi_set.name` (med fuzzy-match for bøyningsformer). >3 ukjente → reject (sannsynlig hallusinering)
- **POI-UUID whitelist:** `poi:uuid`-lenker valideres mot `poi_set` (ikke bare UUID-format — cross-tenant-beskyttelse)
- **Character-class filter:** zero-width chars, RTL-overrides rejectes
- **Length-cap:** >1200 tegn → reject, retry med trimming

**Atomicity:**

- `apply` gjør single PATCH for alle temaer (in-memory validering først)
- Per-tema `groundingVersion` → v1 og v2 coexisting OK
- Temaer som feiler validering beholder v1-grounding (partial success)
- Backup FØR PATCH
- Optimistisk lock via `updated_at`
- Idempotens: `prepare` hopper over temaer hvor `curatedAt > fetchedAt` (med mindre `--force`)

**Audit-log:** Hver curation logges til `backups/curation-audit-<product>-<theme>-<ts>.jsonl` (Claude's raw output + validation-warnings + POI-lenker brukt).

**Output:** `grounding.curatedNarrative` + `curatedAt` + `poiLinksUsed` + `groundingVersion: 2` per tema.

**UI:** Temaer med `groundingVersion === 2` rendrer `curatedNarrative` med POI-chips. V1-temaer beholder eksisterende flyt (graceful fallback).

### Steg 3: Kvalitativ research per POI-kandidat
For hver kandidat (prioriter T1 / local_gem / høy rating):

1. **Data-først:** Hent `google_price_level`, `google_rating`, `google_review_count`, `is_chain`, `is_local_gem` fra POI-raden.
2. **WebSearch:** `"{POI-navn} {by} anmeldelse"` og `"{POI-navn} {by} om"` — verifiser kjede-status, spesialitet, målgruppe-appell.
3. **Lagre aksler:** Fyll inn 5 aksler for hver POI som skal navngis.

**Cost-kontroll:** Ikke research alle 10 POIs per kategori. Bare de 3-5 sterkeste basert på initial ranking. Skip research for POIs med åpenbare signaler (f.eks. bysykkel-stasjoner, busslinjer).

### Steg 3.5: Triangulering-fallback (kun ved grounding-feil)

**Hovedregel:** Gemini-grounding i Steg 2.5 triangulerer automatisk via Google Search. Dette steget brukes **kun** hvis scriptet rapporterte en kategori som `error`/`skipped` og den skal inneholde tidssensitive fakta (åpningsdato, byggestatus, skolekretser).

**Eksempel hedging som fungerer:**
- Brøset skole 2026: Gemini hedget korrekt i Wesselsløkka-grounding ("detaljregulering pågår, ingen bekreftet åpning"). Tekst → **stryk fra hero**, nevn kun i historisk/framtid-kontekst.

**Hvis fallback trengs (Gemini feilet):**
1. To separate WebSearch-kall per fakta: bekreftelse + negativ-sjekk
2. Beslutningstre: 2+ ferske kilder → bruk; 1 kilde → hedge; negativ treff → stryk
3. Dokumenter i research-logg

### Steg 4: Relevans-filter mot persona (LLM-skjønn)
For hver kategori:
- Input: POI-shortlist med aksler + persona-liste.
- Claude evaluerer per POI: *"Passer dette for {persona-liste} i kategori {kategori} på prosjekt {venue_context}?"*
- Output: Rangert liste *for navngiving i tekst* (typisk 2-5 POIs per kategori).

**Kritisk regel:** En POI kan være på kartet uten å navngis i tekst. Ikke include-alt-fordi-de-finnes.

### Steg 5: Motiv-generering
- Hent landemerker/vannflater/parker innen 500m (kartdata).
- Travel-times-profil (hvor tett er sentrum, hvor rask er stasjonen).
- WebSearch `"{nabolag} {by} nabolag"` for karakter-motiv.
- Generer 3 kandidater — én av hver type.
- Hvis en type er svak (f.eks. ingen tydelig landemerke): byt ut med tilleggsmotiv av sterkere type.

### Steg 6: Skriv heroIntro
Format: 3-4 setninger som:
1. Etablerer posisjonering (hvor i byen, mellom hva).
2. Nevner minst 2 av de 3 motivene eksplisitt.
3. Setter tonen (urban/suburban, hva nabolaget "er").
4. Ingen POI-navn på dette nivået — motivene er tema, ikke spesifikke steder.

### Steg 7: Skriv kategori-tekster
Per kategori:

**Kontekst-input (read-only):**
- `grounding.narrative` fra `products.config.reportConfig.themes[].grounding` — Gemini-kuratert fact-sheet med autoritative kilder. Bruk som sanne fakta (erstatter WebFetch-research). **Ikke kopier narrativet direkte** — skill-reglene (W/X/Y/Z/Æ, navngivings-hierarki, kvantitativ generalisering) gjelder fortsatt. Gemini er fact-feed, ikke final tekst.
- Hvis `grounding` mangler for en kategori (scriptet skippet eller feilet): fall tilbake til Steg 3/3.5-research.

**Struktur:**
- [broingssetning fra forrige kategori ELLER motiv-referanse] → åpning
- [2-4 navngitte POIs med avstand + spesialitet]
- [optional: kontrast eller bevegelse mellom steder]
- [broingssetning til neste kategori]

**Bakoverkompatibel deling:**
- `bridgeText` = åpning + første hoveinnhold-setning (1-2 setn)
- `leadText` = resten (3-5 setn)

**Lengde per vekting:**
- H = 6-7 setn (1-2 i bridgeText + 5 i leadText)
- M = 5 setn (1-2 + 4)
- L = 4 setn (1-2 + 3)

**Engelsk:** Oversett bridgeText til engelsk og lagre i translations. **Ikke oversett leadText** (kun NO).

### Steg 8: QA-sjekk
Kjør `references/qa-checklist.md` på alle tekstene. Hvis noe feiler: korriger og kjør på nytt.

### Steg 9: Lagre
- PATCH `products.config.reportConfig` med ny heroIntro + motiver + themes (med oppdaterte bridgeText/leadText).
- POST/upsert `translations` for engelsk bridgeText per theme.
- Kall `/api/revalidate?tag=product:{id}&secret=...` for cache-refresh.

**Ikke rør `themes[].grounding`** — den eies av `scripts/gemini-grounding.ts` og oppdateres separat. Bruk deep-merge-mønster fra `scripts/seed-wesselslokka-summary.ts` (match på theme `id`, preservér alle felt du ikke skriver).

### Steg 10: Verifiseringsrapport
```
Rapport generert for {prosjekt-id}:
- Personas: {persona-liste}
- Motiver: {motiv1} | {motiv2} | {motiv3}
- heroIntro: {X} setn
- Kategori-tekster: 7/7 (Hverdag=H, Barn=L, ..., Transport=H)
- POI navngitt i tekst: {N} unike
- WebSearch-kall: {M}
- QA-sjekk: BESTATT
```

## S&J-prinsipper (maskinelt håndhevet)

Se `references/sj-prinsipper.md` for full liste.

**Hard-kodede regler (sjekkes i QA-steget):**
1. **Navngi, aldri generaliser** — minst 2 POI-navn per kategori-tekst
2. **Ingen trivia-fakta** — regex-sjekk: "åpnet i \d{4}", "tar imot .* besøkende", "X antall" — disse blokkeres med mindre de er historisk forankret på skjønnsnivå (f.eks. "grunnlagt 1152" for Katedralskolen OK)
3. **Ingen generiske superlativer** — banned-liste: *fantastisk, utrolig, du vil elske, noe for enhver smak, hidden gem, must-visit, skjult perle, duftende oase, koselig, hyggelig (uten konkret grunn)*
4. **Bevegelse mellom steder** — minst 1 kategori-tekst skal inneholde en bevegelse/retning (langs, fra...til, vestover, osv.)
5. **Motiv-referering** — hver kategori-tekst må inneholde minst 1 motiv-referanse (ikke nødvendigvis ordrett; variant OK)

## QA-sjekk (ny 11c)

Se `references/qa-checklist.md` for full sjekkliste.

**Nivåer:**
1. **Stedsnavn-verifisering:** Hvert navngitt sted må finnes i prosjektets POI-liste ELLER være et verifisert referansepunkt (bydel, fjord, kjent landemerke).
2. **Avstand-verifisering:** Hver avstandspåstand = distanceMeters / 80. Toleranse ±1 minutt.
3. **Relevans-sjekk:** LLM-eval per POI-navngiving: *"Er dette POI-et verdig navngiving for persona X?"* Fanger Backstube-type-feil.
4. **S&J-regler:** Mekanisk regex-sjekk av trivia-fakta, superlativer, banned-ord.
5. **Repetisjonssjekk:** Ingen POI navngis i mer enn 2 kategori-tekster (med mindre dobbelrelevant).
6. **Motiv-coverage:** Hver motiv brukes i minst 2 kategori-tekster (verifiserer rød tråd-virker).

## Gotchas

**1. `is_chain` i Supabase er ofte feil.** Bruk WebSearch for å verifisere kjede-status. Backstube Trondheim Jomfrugata er markert `is_chain: false` men er fortsatt en kjede. Stol på research, ikke felt.

**2. Flere POIs med samme navn.** Det finnes ofte duplikater (f.eks. to "Backstube" i forskjellige gater). Sjekk `address`-feltet før du navngir i tekst.

**3. `google_rating` og `google_review_count` er NULL for mange offentlige POIs** (skoler, barnehager, busslinjer, sykkelstasjoner). Det betyr ikke lav kvalitet — bare at Google ikke har data. Bruk andre signaler (NSR/Udir for skoler).

**4. `distance_meters` kan mangle.** Hvis null, beregn fra POI-lat/lng mot prosjekt-senter med Haversine.

**5. Motiver må formuleres slik at de tåler varianter.** Ikke "kaifronten" hvis du vil si "langs kaien" senere — bruk motiv som *stedsnavn-agnostisk*: *"fronten"* variant som kaifronten, kaien, på TMV-siden.

**6. Google AI Mode har triangulering innebygd — vår WebSearch gjør det ikke.** Framtids-fakta (åpningsdatoer, byggestatus, nye tilbud) krever TO separate queries: én bekreftelse, én negativ-sjekk. Hvis negativ gir treff → hedge eller stryk. Se Steg 3.5.

**7. Meter er no-go. 80 m/min = konverteringsrate.** "85 m" = "rett utenfor døren". "120 m" = "2 min til fots". Gjelder også i leadText og POI-avstander fra Supabase. Se regel F i `sj-prinsipper.md`.

**8. Senter-type-disambiguering — ikke alle `shopping_mall` er nærsentre.** Google Places klassifiserer bredt. Før et senter navngis i Hverdagsliv-kategorien, sjekk type:

- **Nærsenter** (Hverdagsliv): har dagligvare + apotek/frisør + ofte Vinmonopol. Eksempler: Valentinlyst, Byhaven kjøpesenter, Trondheim Torg.
- **Storsenter** (Hverdagsliv hvis < 15 min, ellers nevn som alternativ): Moholt Storsenter, Sirkus Shopping.
- **Kulturkvartal** (Opplevelser, IKKE Hverdagsliv): arrangementer, konsertsal, kino, food court. Eksempel: Olavskvartalet (Trondheim) er kulturkvartal med Olavshallen + Cinemateket, ikke nærsenter.
- **Kontor-/business-tower** med butikker som tillegg: drop.

**Klassifiserings-test:** Har senteret dagligvare-anker (Coop/Kiwi/Rema/MENY/Extra) innenfor egen bygning eller ved samme inngang? Hvis ja → nærsenter. Hvis senteret primært markedsfører events eller kultur → kulturkvartal.

**VIKTIG — ikke forveksle butikk-navn med senter-navn.** Et navn som "MENY Solsiden", "Kiwi Lerkendal", "Coop Mega Moholt" er *butikken* på stedet, ikke et senter. Disse er dagligvare-kjeder (regel N: ALDRI navngis). Solsiden er en bydel; Moholt er et område; navnet etter kjeden er plassering. Hvis du vil referere til selve senteret, bruk senter-navnet (Moholt Storsenter, ikke "Coop Mega Moholt").

**Konsekvens for Stasjonskvartalet:** Byhaven kjøpesenter er nærmeste ekte nærsenter med dagligvare-anker. Olavskvartalet er kulturkvartal (→ Opplevelser). Dagligvarebutikker rundt Solsiden eller Rosenborg nevnes kun som mengde ("flere dagligvare-alternativer innen ti minutter"), ikke ved navn.

## Fremtidige iterasjoner (ikke nå)

**Iter 2: Hero-illustrasjon + tema-illustrasjoner**
- Kall `placy-illustrations` internt etter tekst-generering
- Bruk motivene som prompt-input (samstemthet mellom tekst og bilde)
- Lagre som `heroImage` i reportConfig + per-kategori-bilder

**Iter 3: 3D-konfig + publisering**
- Automatisk `has_3d_addon` toggle basert på venue_context
- Default heading-beregning fra sentrum-retning
- Full audit-log + approval workflow
- Integrasjon med `/api/revalidate` (allerede i MVP, men utvidet)

**Iter 4: POI-innsamling integrert (optional)**
- `/generate-rapport <adresse>` uten forutsatt prosjekt — kaller `/generate-adresse` eller egen logikk for POI-innsamling først
- Ikke breaking for MVP-brukere — bare nytt entry-point

## Migrasjon fra legacy

Eksisterende rapporter generert via `/generate-bolig` (Stasjonskvartalet, Wesselsløkka, Brøset):
- Kan regenereres med `/generate-rapport <prosjekt-id> --persona <..>` uten å røre POI-data
- Legacy Steg 10+11 gir ikke lenger mening etter migrasjon
- Slett bridgeText/leadText gamle verdier før ny generering (ikke strengt nødvendig, men ryddig)
