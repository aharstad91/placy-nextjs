# Brainstorm: Placy Analytics — Forretningskonsept

> Dato: 2026-02-28
> Status: Utforsket — klar for videre diskusjon med forretningsutviklere
> Kontekst: Sprunget ut av landingsside-arbeidet. Inspirert av passionfroot.me sin analytics-seksjon.

## Kjerneinsikt

Placy sin nåværende pitch er "vi lager en fin interaktiv nabolagspresentasjon." Det er et feature-argument. Analytics snur verdipropsisjonen:

**Før:** "Vi lager en fin presentasjon av nabolaget."
**Etter:** "Vi viser deg hva boligkjøperne dine faktisk bryr seg om — og beviser at markedsføringen din funker."

Det er ikke lenger en brosjyre. Det er et markedsføringsverktøy med innebygd måling.

## Tre lag med verdi

### Lag 1: Presentasjon (eksisterer i dag)
- Interaktivt kart, kuraterte steder, redaksjonelt innhold
- Verdi: "Penere enn en PDF"
- Problem: Vanskelig å prise høyt. Engangsleveranse. "Digital brosjyre."

### Lag 2: Engagement-data (selges først)
- Hvem besøker, hva klikker de på, hvor lenge
- Verdi: "Bevis at markedsføringen funker"
- Nøkkelmetrikker:
  - **Besøkende** — "326 har sett prosjektet"
  - **Utforskningsgrad** — "58% klikket seg videre" (ikke bare bounce)
  - **Temafordeling** — "Hverdagsliv er #1" (hva kjøperne prioriterer)
  - **Topp POI-er** — "Singsaker skole er mest besøkt" (konkret, handlingsbar)
  - **Tid** — "Snitt 3:42" (sammenlign med brosjyre: 5 sek i søpla)
- Business impact: Rettferdiggjør prisen. Gjør det målbart. Muliggjør recurring revenue.

### Lag 3: Kjøperinnsikt (vokser med volum)
- Aggregert atferdsdata på tvers av prosjekter
- Verdi: Markedsundersøkelse ingen andre har
- Eksempel: "Barnefamilier sjekker skole først, singelprofesjonelle sjekker kafé og trening"
- Eksempel: "Prosjekter som fremhever skoledata i annonsering har 34% høyere utforskningsgrad"
- Business impact: Informerer prospektdesign, prisstrategi, beliggenhetsbeslutninger
- **Moat:** Mer data = bedre innsikt = vanskeligere å kopiere. Ingen andre har denne dataen.

## Segmentering uten identifisering

### Du trenger IKKE vite hvem besøkeren er

**Prosjektkontekst = implisitt segmentering:**
Brøset er familieboliger. Sluppen er sentrumsleiligheter. Prosjekttypen definerer segmentet.

**Atferd = segmentering:**
- Sjekker skole + barnehage + lekeplass → barnefamilie
- Sjekker kafé + restaurant + trening → ung profesjonell
- Sjekker dagligvare + transport + helse → senior/praktisk
- Sjekker alt → tidlig i prosessen, orienterer seg

**Aggregert er nok:**
Lag 3 handler om "68% av Brøset-besøkerne sjekker skoleinformasjon. For Sluppen er det 12%." Anonyme aggregater — ingen personvernproblemer.

### Tilgjengelige datapunkter (uten cookies/login)

| Datapunkt | Hvordan | Personvern |
|-----------|---------|------------|
| Temavalg | WelcomeScreen-avkrysning | Helt anonymt |
| POI-klikk | Enkel event-tracking | Anonymt aggregat |
| Tid per tema | Scroll/viewport-tracking | Anonymt |
| Enhet | User-agent | Standard |
| Geolokasjon (by) | IP-basert, grov | Anonymt |
| Referer | Standard HTTP | Viser om annonser funker |
| Tidspunkt | Timestamp | Korrelerer med visningsdager |

Alt er cookieless, GDPR-vennlig, krever null identifisering.

## Go-to-Market

### Ikke selg analytics separat
Bundle med presentasjonen. Analytics uten innhold er verdiløst. Bundling gjør prisen lettere: "du får presentasjonen OG innsikten."

### Pitchrekkefølge i demomøtet

1. **Vis Brøset-demoen.** "Se hvordan nabolaget presenteres." La dem klikke.
2. **Snu samtalen.** "Ok, dere liker det. Men her er det virkelige spørsmålet: når 500 kjøpere har utforsket dette — vet dere hva de sjekket?"
3. **Vis dashboardet.** Mockupen med ekte(nok)-data. "847 besøkende. 50% utforsket. Singsaker skole mest besøkt."
4. **Differensiatoren.** "Finn.no viser annonser. Meglerne viser plantegninger. Vi viser hva folk faktisk bryr seg om i nabolaget."

### Overbevisende demo-triks
Del Brøset-lenken med potensielle kunder. Vent 1-2 uker. Vis dem dashboardet med *deres eget besøksmønster*: "12 besøkende fra dere de siste 2 ukene. 8 av dere sjekket skoleinformasjon. Tenk om dette var 500 boligkjøpere."

### Hva du sier

**Si:**
- "Vet dere hva boligkjøperne deres faktisk bryr seg om?"
- "For første gang kan dere måle om beliggenhet-argumentet funker"
- "Sist gang Brøset ble annonsert, sjekket 68% skoletilhørighet. Bruker dere det i markedsføringen?"

**Ikke si:**
- "Vi lager interaktive kart" (feature, ikke verdi)
- "Vi bruker AI til å kuratere steder" (teknologi, ingen bryr seg)
- "Vi har 47 POI-er i 8 kategorier" (tall som ikke betyr noe for dem)

### Kunderekkefølge

**Tier 1 — Allerede relasjoner:**
Trym, Heimdal, Fredensborg, Byggteknikk. Allerede betalt 50-90K for broset.no.
Pitch: "Vi oppgraderer det dere allerede kjøper — nå med innsikt."

**Tier 2 — Store aktører i Trondheim:**
KLP Eiendom (har hatt Ferjemannsveien-demo), OBOS, JM, Koteng.
Pitch: "Vi ser at X% av boligkjøpere sjekker skoleinformasjon. Vil dere vite hva *deres* kjøpere sjekker?"

**Tier 3 — Nasjonale (3-6 mnd):**
Selvaag, AF Gruppen, Veidekke. Krever referanser fra tier 1.

## Prismodell (uavklart — diskuter med forretningsutviklere)

Mulig retning:
- **Lag 1** (presentasjon): 15-25K per prosjekt (setup)
- **Lag 2** (analytics): 3-5K/mnd per prosjekt (løpende)
- **Lag 3** (markedsinnsikt): Premium-rapport, prissatt per kundesegment (fremtidig)

Recurring > engangspris. Analytics rettferdiggjør abonnement.

## Landingsside-seksjon (allerede designet)

Se `docs/brainstorms/2026-02-28-placy-landingsside-brainstorm.md` for den fullstendige analytics-seksjonen med:
- Dashboard-mockup med KPI-kort, grafer, prosjekttabell
- "Snart tilgjengelig"-badge
- Heading: "Vet du hva boligkjøperne lurer på?"
- Implementert i `placy-website/index.html`

## Åpne spørsmål

- Eksakt prismodell — diskuter med forretningsutviklere
- MVP for analytics-backend — hva er minste trackbare enhet?
- Integrasjon med kundens eksisterende markedsverktøy (Google Ads, Meta, etc.)
- Rapportformat — dashboard vs. PDF-rapport vs. e-post-oppsummering
- Hvitelabel-mulighet — analytics i kundens eget CRM/verktøy?
- Pilotavtale-struktur — gratis analytics i 3 mnd for å bevise verdi?
