# QA-sjekk for rapport-tekster

Kjør denne sjekklista på alle tekster før lagring. Hvis noe feiler → korriger → sjekk på nytt.

## Sjekk 1: Stedsnavn-verifisering

For hvert navngitt sted i teksten:
- [ ] Finnes som POI i prosjektets POI-liste? **ELLER**
- [ ] Er et verifisert referansepunkt (bydel, fjord, kjent landemerke, gate)?

**Verifiserte referansepunkter i Trondheim:**
- Fjorder/vann: Trondheimsfjorden, Nidelva, Skansenfjæra
- Bydeler: Midtbyen, Bakklandet, Brattøra, Møllenberg, Rosenborg, Solsiden, Nedre Elvehavn
- Landemerker: Nidarosdomen, Gamle Bybro, Munkholmen, Tyholttårnet
- Gater: Kjøpmannsgata, Munkegata, Dronningens gate, Jomfrugata, Fjordgata, Søndre gate

**Hvis nei på begge → FJERN fra teksten eller spesifiser.**

## Sjekk 2: Avstand-verifisering

For hver avstandspåstand:
- [ ] Matcher `round(distanceMeters / 80)` innen ±1 min?
- [ ] Riktig formulering brukt:
  - 1-5 min: "like ved", "X minutter unna"
  - 6-10 min: "i gangavstand", "X minutter unna"
  - 11-15 min: "en kort spasertur", "et kvarter"
  - 16-25 min: "kort sykkeltur", "i nærheten"
  - >25 min: ikke omtal som "nær"; kan nevne med "med buss"

**Hvis feil → KORRIGER med riktig avstand.**

## Sjekk 3: Relevans-filter mot persona (LLM-skjønn)

For hvert navngitt POI, evaluer:
*"Passer dette POI-et for {persona-liste} i kategori {kategori} på prosjekt {venue_context}?"*

**Eksempler på fallgruver:**
- ❌ Backstube (kjede, ultraprosessert) i "Mat & Drikke" med målgruppe inkl. etablerer → deprioriter
- ❌ Pirbadet (premium) fremstilt som "fast del av hverdagen" → korriger eller fjern
- ❌ Vinbarer for barnefamilie-persona → drop
- ✅ Spontan Wine Bar for forstegangskjoper+femtiefem-pluss → keep

**Hvis feil match → FJERN POI eller REKATEGORISER kontekst.**

## Sjekk 4: S&J-regler (mekanisk)

### 4a. Trivia-fakta-blokkering
Regex-sjekk per tekst:
- `/åpnet (i|den) \d{4}/i` → blokker med mindre historisk forankring er *relevant nå* (f.eks. "grunnlagt 1152")
- `/tar imot .{0,20}(besøkende|gjester|deltakere)/i` → blokker alltid
- `/\d{3,} (besøkende|gjester)/i` → blokker alltid
- `/(bølgebasseng|sklie|stupebrett).{0,30}(fast del av hverdagen|hverdag|familier)/i` → marketing-spin, blokker

### 4b. Banned-ord
Søk etter:
```
fantastisk, utrolig, du vil elske, noe for enhver smak, hidden gem, must-visit, skjult perle, duftende oase, koselig, hyggelig, sjarmerende, magisk, drømmeaktig, fenomenal
```

Hvis funnet → SKRIV OM.

**Unntak:** "sjarmerende" OK hvis umiddelbart etterfulgt av konkret grunn: *"sjarmerende trehus fra 1870-tallet"* ✓ vs. *"sjarmerende nabolag"* ✗.

### 4c. Utropstegn
Ingen `!` i brødtekst. Blokker.

### 4d. Superlativer
`best|beste|flotteste|peneste|største` → krever verifisert kilde (Michelin, offisiell rangering, Guinness). Hvis ingen kilde → SKRIV OM.

## Sjekk 5: Konkret navngiving

Per kategori-tekst:
- [ ] H-kategori: minst **3-4 POI-navn**
- [ ] M-kategori: minst **2-3 POI-navn**
- [ ] L-kategori: minst **2 POI-navn**

Hvis under minimum → legg til POI eller øk vekting.

## Sjekk 6: Motiv-coverage

- [ ] Hver kategori-tekst refererer minst **1 motiv** (direkte eller variant)
- [ ] Hver av de 2-3 motivene brukes i **minst 2 kategori-tekster**

Hvis motiv ikke brukes → legg til referanse i minst en ekstra kategori.

## Sjekk 7: Bevegelse

- [ ] Minst **1 kategori-tekst** har eksplisitt bevegelse (*langs*, *fra...til*, *vestover*, *innover*)

Hvis ingen → legg til i mest naturlig kategori (ofte Natur eller Transport).

## Sjekk 8: Repetisjon

- [ ] Ingen POI navngis i **mer enn 2 kategori-tekster**

Unntak: POIs som er dobbelrelevant (f.eks. Pirbadet kan være i Barn+Trening hvis begge seksjoner rettferdiggjør det).

Hvis over → fjern fra svakeste kategori.

## Sjekk 9: Første-setning-test

For hver kategori-tekst:
- [ ] Første setning fungerer **alene** hvis teksten avkortes (responsive design-hensyn)
- [ ] Første setning inneholder minst 1 konkret POI-navn

## Sjekk 10: heroIntro-spesifikt

- [ ] Minimum **3 setninger**
- [ ] Maksimum **4 setninger**
- [ ] Etablerer minst **2 av 3 motiver** eksplisitt
- [ ] Ingen POI-navn (motivene er tematiske, ikke spesifikke steder)
- [ ] Minst 1 kontrast (urban+fjord, sentralt+rolig, etc.)

## Sjekk 11: Meter-blokker

Regex-sjekk per tekst (inkl. heroIntro):
- `/\b\d+\s*(meter|m)\b.*?(fra|til|unna)/i` → blokker alltid

For hver match:
- `< 80 m` → erstatt med "rett utenfor døren" / "ved inngangen"
- `80–400 m` → erstatt med "X minutter til fots" (80m/min)
- `> 400 m` → erstatt med "X minutter til fots"

**Unntak som SKAL passere (ikke-avstand):**
- Areal: "1400 kvadratmeter"
- Dimensjon: "tolvmetersbasseng", "74 meter over bakken"
- Løype-lengde: "28 kilometer", "40 kilometer merkede stier"
- Bygningshøyde: "124 meter"

Hvis mønster matcher men konteksten er ikke-avstand → pass. Ellers → KORRIGER.

## Sjekk 12: Tidssensitive fakta (triangulering-gate)

For hver fakta som kan endres (åpningsdatoer, byggestatus, skolekretser, nye tilbud, bemanning):

**Regex for framtids-fakta:**
- `/åpner.{0,20}(\d{4}|sommeren|høsten|vinteren|våren)/i`
- `/ferdig.{0,20}(\d{4}|sommeren|høsten|vinteren|våren)/i`
- `/(stå klar|står klar|ferdigstilles|kommer).{0,30}\d{4}/i`
- `/(skole|barnehage|senter|bygg|prosjekt).{0,20}(åpner|åpning)/i`

For hver match:
- [ ] Trianguleringsbevis i research-logg (2+ kilder fra siste 6 mnd)? **ELLER**
- [ ] Hedge-ord i samme setning: *planlagt, etter plan, ventet, under planlegging, ikke endelig fastsatt, foreløpig*? **ELLER**
- [ ] Google AI-sjekk bekrefter fakta?

**Hvis ingen av disse → STRYK eller HEDGE.**

**Eksempel-brudd:**
- ❌ "ny 1-7 skole åpner sommeren 2026, samtidig med innflytting" (ingen hedge, Brøset skole er i reguleringsfase)
- ✅ "ny 1-7 skole er planlagt på Brøset, men byggestart er ikke endelig fastsatt"
- ✅ Alternativ: stryk helt, bruk eksisterende skolekrets (Eberg) som anker

**Prioritet:** Hvis fakta er et byggestein i salgsargument (f.eks. "flytt inn samtidig som skolen åpner"), ikke bare hedge — vurder om argumentet må bygges på noe annet verifiserbart.

## Sjekk 13: Prosjekt-blindhet

For hver tekst (inkl. heroIntro):

**Regex-sjekk:**
- `/\d+\s*(leiligheter|boliger)/i` → blokker
- `/(første|andre|tredje|fjerde)\s+byggetrinn/i` → blokker
- `/\d+\s*prosent\s*grøntareal/i` → blokker
- `/klimanøytral/i` + `/hageby|prosjekt|byggetrinn/i` → blokker (gir "klimanøytral hageby" som prosjekt-label)
- `/tegnet av|designet av/i` → blokker (arkitekt-navn)

**Skjønns-sjekk:** Ville påstanden vært sann om adressen var en annen blokk i samme nabolag? Hvis *nei* → drop.

**Eksempel:**
- ❌ "122 leiligheter i en klimanøytral hageby med 53 prosent grøntareal"
- ✅ "Et hageby-nabolag med grønne gater og gangavstand som bærende prinsipp"

## Sjekk 14: Alders-referanser

**Regex-sjekk:**
- `/(åpnet|etablert|grunnlagt|stiftet)\s+(i\s+|den\s+)?\d{4}/i` → blokker
- `/siden\s+\d{4}/i` → blokker
- `/fra\s+(\d{4}|\d{2}-tallet)/i` → blokker (unntatt stedsnavn-kontekst)
- `/(ett av|en av|blant)\s+(Norges|byens)\s+(eldste|første)/i` → blokker
- `/har\s+(bakt|drevet|servert|holdt)\s+siden/i` → blokker

**Unntak (skjønn):**
- Toponymer som Bakklandet, Brattøra, Nedre Elvehavn — historiske stedsnavn, ikke alders-påstander
- "Norges eldste X i drift" — kun hvis drift-statusen er den avgjørende delen, og selv da: vurder om du kan droppe helt

**Hvis match og ingen unntak gjelder → STRYK.**

## Sjekk 15: Tall-disiplin

**Regex-sjekk:**
- Bemanning: `/\d+\s*(studenter|ansatte|kokker|personer)/i` → skjønn: kan byttes med generalisering
- Anlegg-telling: `/\d+\s*(sentre|haller|badstuer|stasjoner|seter)/i` → skjønn: behold kun hvis funksjonelt
- Kvadratmeter: `/\d+\s*(kvm|kvadratmeter|m²)/i` → drop med mindre funksjonelt
- Absolutt-tall: `/over\s+\d+|rundt\s+\d+|omtrent\s+\d+/i` → drop

**OK (funksjonelle tall):**
- Avstand i minutter
- Åpningstider
- Verifiserte kilde-kvalifiseringer (Michelin, SXSW, osv.)
- Dimensjoner der størrelsen er funksjonelt avgjørende (tolvmetersbasseng for svømme-regel)

**Hvis match og ikke funksjonelt → SKRIV OM (bytt til "flere", "omfattende", eller drop).**

## Sjekk 16: 2.grads detaljer (skalerings-sjekk)

For hver POI-navngiving:

**Regex-sjekk:**
- Adresse: `/\b[A-ZÆØÅ][a-zæøå]+gat(e|a|en)\s+\d+/i` → blokker
- Eiendomsnavn: `/(Mercur|Solsiden|Brattørkaia)-bygget/i` → drop eiendomsnavn (men: merkevare-bygninger som "Britannia-hotellet" OK)
- Etasje: `/(første|andre|tredje|øverste)\s*etasje/i` → skjønn
- Bemanning: `/(drevet av|kokk|coach|daglig leder)\s+[A-Z]/i` → blokker
- Spesifikke retter: `/med\s+(torsketunge|bouillabaisse|ossobuco|etc\.)/i` → skjønn

**Test:** Blir påstanden usann hvis stedet flytter, bytter eier eller endrer meny? Hvis *ja* → drop 2.grads-delen.

## Sjekk 17: Rating-volum

For hver POI som navngis basert på Google-rating:

- [ ] `google_review_count >= 30`? **ELLER**
- [ ] Har WebSearch-verifisering (anbefalt i anerkjent guide, offisiell anerkjennelse)?
- [ ] Har kategori-relevans som annen støtte?

**Under 30 ratings og ingen ekstra signaler → ikke navngi, generaliser istedenfor:**
- ❌ "Enten Eller frisør" (14 ratings, ingen kvalitetsguide)
- ✅ "Flere frisørsalonger innen fem minutter"

## Sjekk 18: Påståelig tone

**Regex-sjekk:**
- `/uten at du .{0,30}(forlater|må)/i` → blokker
- `/(det perfekte|det beste|det eneste).{0,30}(for|til)/i` → blokker
- `/er bygget for/i` → blokker (skjønn: OK hvis kommuneplan-anker)
- `/alltid|aldri/i` → kun OK hvis faktuelt (åpningstider, status)

**Skjønns-test:** Kan påstanden falsifiseres av én leser med spesielle behov? Hvis ja → skriv om til beskrivende form.

## Sjekk 19: Tilbuds-miks-triangulering (Regel W)

For hver påstand om hva et senter/institusjon *inneholder*:

- [ ] Triangulert mot offisiell kilde (byhaven.no, solsidensenter.no, valentinlyst.no, trondheim.kommune.no) fra siste 6 mnd? **ELLER**
- [ ] Kun generisk kategori-beskrivelse ("mote, delikatesse, service") uten merkenavn?

**Regex-sjekk:**
- `/(har|samler|dekker).{0,30}(Kiwi|Rema|Coop|Meny|Extra|Vinmonopol|Vitus|Boots)/i` — merkenavn i senter-kontekst
- `/(finnes|ligger).{0,30}(Kiwi|Rema|Coop|Meny)/i` — dagligvarekjede som "finnes"

**Unntak:** Hvis triangulert mot offisiell kilde fra siste 6 mnd → OK å nevne (helst uten merkenavn uansett).

**Brudd → fjern merkenavn, beskriv kategorisk. Se anti-pattern 1 (Byhaven) og 10 (Valentinlyst).**

## Sjekk 20: Preskriptive anbefalinger (Regel X)

**Regex-sjekk per tekst:**
- `/(passer|egnet|best).{0,15}(for|til|brukt)/i` — "passer best for / egnet for"
- `/er ikke.{0,15}(nødvendig|en nødvendighet)/i` — "bilen er ikke nødvendig"
- `/det (naturlige|perfekte|beste|eneste).{0,15}valget/i` — "det naturlige valget"
- `/fungerer (som|best)/i` — "fungerer best som"
- `/best brukt som/i` — "best brukt som"
- `/det eneste du/i` — "det eneste du trenger"

**Brudd → skriv om til beskrivelse. Se anti-pattern 5.**

## Sjekk 21: Udokumenterte superlativer (Regel Y)

**Regex-sjekk:**
- `/det (store|største|beste|største|flotteste)/i` → bestemt form superlativ
- `/Norges (største|eldste|første|beste)/i` → uten ekstern kilde (markedsføring fra egen nettside teller ikke)
- `/byens (beste|største|mest)/i`
- `/mest (kjente|populære)/i`

**Hedge-bytter:**
- "det største" → "ett av de største"
- "Norges største" → bare droppe hvis egen markedsføring; behold med kilde hvis triangulert
- "byens beste" → drop eller "blant de bedre"

**Unntak:** Triangulert mot offisiell kilde/offisiell rangering (Michelin, offisiell anerkjennelse).

**Brudd → hedge med "ett av de" eller drop. Se anti-pattern 6 og 7.**

## Sjekk 22: Kvantitativ generalisering (Regel Z)

Ved lister av flyktige tilbud (frisør, apotek, kafé, velvære):

- [ ] Brukes kvantitativ form ("titalls", "flere", "innen X min")?
- [ ] Unngår spesifikke navn med lav ratings-volum?

**Regex-sjekk (utdaterte kategorier):**
- `/(bank|post|legekontor|fastlege)/i` — disse kategoriene bør droppe fra Hverdagsliv-kontekst

**Kategorier som er relevante:** dagligvare, Vinmonopol, apotek, tannlege, frisør, velvære/spa, bakeri/kafé
**Utdaterte (drop):** bank, post, fastlege, juridiske tjenester

**Brudd → erstatt med kvantitativ form. Se anti-pattern 3 og 12.**

## Sjekk 23: Bransje-sjargong (Regel Æ)

**Banned ord (uten forklaring):**
- `/third-wave/i` — bytt til "egne brennerier" eller "spesialistkaffe"
- `/fine-dining/i` — bytt til "smaksmenyer" eller "flerretters"
- `/boutique-preget/i` — bytt til "mindre og mer spesialisert"
- `/curated/i` — bytt til "utvalgte" eller "spesialutvalg"
- `/artisan/i` (som adjektiv) — bytt til "håndverks-"
- `/eco-friendly/i` — bytt til "miljøvennlig"

**Test:** Hvis leseren må slå opp ordet eller halv-kjenner det, bytt ut.

**Brudd → bytt til vanlig norsk. Se anti-pattern 4.**

## Rapport-format

Når sjekk kjøres, produser:
```
QA-sjekk for {prosjekt-id}:
- Sjekk 1 (Stedsnavn): X/X verifisert
- Sjekk 2 (Avstand): X/X korrekt
- Sjekk 3 (Relevans): X/X personmatch
- Sjekk 4 (S&J-regler): 0 brudd
- Sjekk 5 (Navngiving): 7/7 over minimum
- Sjekk 6 (Motiv-coverage): 3 motiver × minst 2 seksjoner = coverage OK
- Sjekk 7 (Bevegelse): X seksjoner har bevegelse
- Sjekk 8 (Repetisjon): 0 POI i >2 seksjoner
- Sjekk 9 (Første-setning): 7/7 bestått
- Sjekk 10 (heroIntro): BESTATT
Status: BESTATT / IKKE BESTATT
```

## Hvis IKKE BESTATT

Korriger de spesifikke problemene (ikke full regenerering). Kjør sjekken på nytt til BESTATT.

Hvis samme problem kommer igjen 3x → eskalér: *"Dette ser ut til å være en systematisk feil i research/relevans-filter. Stopper, rapporterer til bruker."*
