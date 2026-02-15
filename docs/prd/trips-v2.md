# Trips V2 — PRD

> **Dato:** 2026-02-15
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Kontekst:** Brainstorm-sesjon 2026-02-15. Trips-produktet har fungerende backend, admin, og en aktiv tur-opplevelse. Mangler: Preview-modus, innholdskvalitet, polert demo.

---

## Produktvisjon

Placy Trips er kuraterte byopplevelser levert i riktig kontekst. Gjesten scanner QR på hotellet, ser 2-3 turer tilpasset sin situasjon, og velger én. Verdien er ikke informasjon — det er at noen med lokalkunnskap har gjort jobben for deg.

**Differensiering:** Placy vet *hvor* gjesten er (hotell, cruise), *hvor lenge* de har (time budget), og *hva som er verdt tiden* (kuratering). GPSmyCity har 6500 turer og en søkefunksjon. Placy har 3 perfekte turer og null friksjon.

**Tre pilarer:**
1. **Narrativ** — en tur er en historie, ikke en liste
2. **Kuratering** — verdien er hva du utelot, ikke hva du inkluderte
3. **Kontekst** — samme POI betyr ulike ting i ulike turer

---

## Produktdefinisjon

### To moduser: Preview og Aktiv

| | Preview | Aktiv |
|---|---|---|
| **Når** | Hotellet, kvelden før, i baren | Ute og går |
| **Formål** | Beslutte: "er denne turen verdt tiden min?" | Navigere og oppleve |
| **Kart** | Statisk med alle stopp + anbefalt rute | Dynamisk med brukerposisjon |
| **Innhold** | Oversikt, metadata, belønning | Stopp-detalj, transition-tekst |
| **Interaksjon** | Browse, lese, lagre | Navigere, sjekke av stopp |
| **Overgang** | → "Start turen"-knapp | ← Tilbake til Preview |

**Preview er den viktigste modusen for demo.** Det er her Scandic-kontakten bestemmer seg. Aktiv er fase 2, men må fungere for å vise helheten.

### Guided vs Free mode

| | Guided | Free |
|---|---|---|
| **Default for** | Turer med narrativ rekkefølge (historisk) | Turer der rekkefølge er irrelevant (mat) |
| **Kart** | Anbefalt path mellom stopp i rekkefølge | Alle stopp uten path, avstand fra din posisjon |
| **Transition-tekst** | Vises mellom stopp (retningsbestemt) | Skjult — kun arrival_text/local_insight |
| **Estimert tid** | Total + mellom hvert stopp | Total, ikke per segment |
| **Brukervalg** | Toggle tilgjengelig: "Utforsk fritt" | Toggle tilgjengelig: "Følg anbefalt rute" |

Turen har en `default_mode: "guided" | "free"` basert på kontekst. Brukeren kan alltid bytte.

### Tekst-lag per stopp

| Teksttype | Brukes i | Formål |
|---|---|---|
| `transition_text` | Kun Guided mode | Narrativt lim mellom stopp. Retningsbestemt. Teaser chain: avslutt med hook til neste stopp. |
| `local_insight` | Begge moduser | Retnings-uavhengig. "Du er her, visste du at..." Fungerer som arrival-tekst. |
| `description_override` | Begge moduser | Kort beskrivelse av stoppet i turens kontekst. |

**Teaser chain-teknikk** i `transition_text`: hvert stopp avsluttes med en hook til neste. "Rundt hjørnet ligger..." Dette er den sterkeste driveren for completion — sterkere enn rewards.

### Rewards / Progress

- **Set-basert, ikke sekvens-basert.** "3 av 5 stopp besøkt" — rekkefølgen spiller ingen rolle.
- **Synlig i Preview** som motivasjon: "Besøk alle 5 stopp og få en belønning fra hotellet."
- **Trackes i Aktiv** med visuell progress-indikator.
- **"Jeg er her"-knapp** for å markere stopp som besøkt. GPS-proximity som oppgradering senere.
- **For demo:** Dummy rewards. Konfigurerbart per hotell via admin (fritekst). Reelle vouchers håndteres manuelt via avtale.
- **Completion:** Confetti + belønnings-visning (allerede implementert).

### Metadata per tur (Preview-kort)

Basert på research av Airbnb Experiences, AllTrails, GPSmyCity, Komoot:

**Essensielt (vises på hvert kort):**

| Felt | DB-kolonne | Eksempel |
|---|---|---|
| Tittel | `title` | "Bakklandet & Bryggene" |
| Hero image | `cover_image_url` | Atmosfærisk bilde |
| Varighet | `duration_minutes` | "45 min" |
| Antall stopp | `stop_count` | "5 stopp" |
| Distanse | `distance_meters` | "1.8 km" |
| Kategori | `category` | "Kultur & Historie" |

**Viktig tillegg (vises på kort eller preview-side):**

| Felt | DB-kolonne | Eksempel |
|---|---|---|
| Vanskelighetsgrad | `difficulty` | "Enkel" |
| Badges/tags | `tags[]` | "Barnevennlig", "Gratis" |
| Belønning (teaser) | `default_reward_title` | "Belønning fra hotellet" |
| Default mode | `default_mode` (NY) | "guided" / "free" |

### Radius-regel

**Alle demo-turer innenfor 1.5 km radius fra startpunkt (hotellet/kaien).**

Research viser: under 1.5 km radius og under 60 minutter gangtid gir best completion rate. Selvvalgte turer har 123% høyere fullføringsrate enn påtvungne.

---

## Eksisterende kodebase (hva som allerede finnes)

### Fungerer fullt

- Database: `trips`, `trip_stops`, `project_trips` med overrides (migrasjon 016)
- Typer: `Trip`, `TripStop`, `ProjectTripOverride`, `TripCompletionState` etc.
- Admin: CRUD for turer, stopp-håndtering med drag-drop, prosjekt-linking
- Adapter: `tripToProject()` konverterer til legacy Project-shape
- Queries: `getTripBySlug`, `getTripsByProject`, `getTripsByCity`, `getTripsByPoiId`
- Public routes: `/trips/[slug]`, `/for/[customer]/[project]/trips/[tripSlug]`
- Trip Library: `/for/[customer]/[project]/trips` med kategori-gruppering
- Aktiv modus: TripPage med kart, geolocation, bottom sheet (mobil), sidebar (desktop)
- Completion: localStorage-tracking, GPS-verifisering, confetti-animation
- Gamification: TripIntroOverlay, TripCompletionScreen med rewards
- Seed script: 5 turer seedet med POI-matching
- API: `/api/poi-trips?poiId=` for kontekstuelle anbefalinger

### Mangler / må bygges

- **Preview-modus** (helt ny — det som finnes er Trip Library + Aktiv modus)
- **Guided vs Free toggle** (alt er i dag Guided)
- **`default_mode`-kolonne** i DB
- **`arrival_text`-felt** eller utvidet `local_insight` for Free mode
- **Polert Preview-kort** med all metadata synlig
- **Reelt innhold** for 3 demo-turer (transition_text, local_insight, cover images)
- **Manglende POI-er** (Gamle Bybro, Ravnkloa, etc.)
- **Midtbyen på 30 min** — ny tur som ikke eksisterer
- **Samlinger** — lagre trips i samlinger (som Explorer POI-er) — PARKERT, TODO for senere

---

## Demo-scope: 3 turer for Scandic Nidelven

### Tur 1: Bakklandet & Bryggene

| Felt | Verdi |
|---|---|
| Kategori | Kultur & Historie |
| Default mode | Guided |
| Varighet | ~45 min |
| Distanse | ~1.8 km |
| Stopp | 5-6 |
| Vanskelighetsgrad | Enkel |
| Radius | <1 km fra Scandic Nidelven |
| Narrativ | "300 år med Trondheims-historie på 45 minutter" |

**POI-gap:** Gamle Bybro som landemerke (ikke bysykkelstasjon). Må opprettes.

**Innholdskrav:**
- Transition-tekst med teaser chain mellom hvert stopp
- Local insight per stopp (retnings-uavhengig)
- Cover image (manuelt kuratert)
- Research-verifisert innhold via WebSearch

### Tur 2: Smak av Trondheim

| Felt | Verdi |
|---|---|
| Kategori | Mat & Drikke |
| Default mode | Free |
| Varighet | ~60 min (+ spisetid) |
| Distanse | ~1.5 km |
| Stopp | 5-6 |
| Vanskelighetsgrad | Enkel |
| Radius | <1 km fra Scandic Nidelven |
| Narrativ | "De stedene en lokal aldri ville fortalt deg om" |

**POI-gap:** Ravnkloa fiskemarked. Må opprettes.

**Innholdskrav:**
- Local insight per stopp med kulinarisk kontekst
- Description override som forklarer hvorfor dette stedet er valgt
- Cover image (manuelt kuratert)
- Transition-tekst kun for Guided-variant (valgfritt i Free)

### Tur 3: Midtbyen på 30 minutter

| Felt | Verdi |
|---|---|
| Kategori | Sightseeing |
| Default mode | Guided |
| Varighet | ~30 min |
| Distanse | ~1.2 km |
| Stopp | 4-5 |
| Vanskelighetsgrad | Enkel |
| Radius | <0.8 km fra Scandic Nidelven |
| Narrativ | "Trondheims høydepunkter rett utenfor hotelldøra" |

**POI-gap:** Stiftsgården (bygningen), mulig andre sightseeing-POI-er. Må sjekkes.

**Innholdskrav:**
- Kort, punchy transition-tekst (dette er en rask tur)
- Local insight fokusert på "visste du at"-fakta
- Cover image (manuelt kuratert)
- Perfekt for cruise-casen: passasjeren med 45 min på land

---

## Utviklingsløp

### Sprint 1: POI-grunnlag + innhold (kan kjøres autonomt)

**Mål:** Alle POI-er som trengs for 3 demo-turer eksisterer i databasen med kvalitetsinnhold.

**Oppgaver:**

1. **Identifiser manglende POI-er for alle 3 turer**
   - Sjekk DB mot planlagte stopp
   - Lag komplett liste over manglende POI-er
   - Inkluder: Gamle Bybro (landemerke), Ravnkloa, Stiftsgården, evt. andre

2. **Opprett manglende POI-er via Curator-workflow**
   - Research hvert sted med WebSearch (koordinater, åpningstider, historikk)
   - Skriv `editorial_hook` og `local_insight` med Curator-skill
   - Opprett i DB med korrekt area, kategori, koordinater
   - Verifiser at POI-er vises korrekt i Explorer

3. **Oppgrader innhold for eksisterende trip-stopp**
   - Skriv `transition_text` med teaser chain for Bakklandet & Bryggene (Guided)
   - Skriv `transition_text` for Midtbyen på 30 min (Guided)
   - Skriv/oppgrader `local_insight` for alle stopp i alle 3 turer
   - Skriv `description_override` for Smak av Trondheim (kontekst: kulinarisk tur)
   - Bruk Curator-skill for kvalitetsgaranti
   - Prøv 3 tone-varianter for transition-tekst (veibeskrivelse+teaser, ren storytelling, hybrid) — velg den beste

4. **Seed/oppdater turene i DB**
   - Oppdater seed-trips.ts eller lag migrasjon for de 3 demo-turene
   - Sett korrekte metadata: varighet, distanse, stop_count, difficulty, category
   - Sett `featured: true` for alle 3
   - Fjern eller deprioritér de 3 andre turene (Kaffebar-ruten, Historisk Trondheim, Barnas Trondheim)

**Leveranse:** 3 turer med komplett, research-verifisert innhold i databasen.

**Autonomi-nivå:** Høy. Claude kan kjøre dette med Curator-skill + WebSearch. Bruker reviewer visuelt i browser etterpå.

---

### Sprint 2: Preview-modus (kan kjøres autonomt)

**Mål:** En dedikert Preview-visning som gir gjesten alt de trenger for å beslutte "denne turen tar jeg."

**Oppgaver:**

1. **Design Preview-side layout**
   - Hero: cover image + tittel + kategori-badge
   - Metadata-stripe: varighet, distanse, antall stopp, vanskelighetsgrad
   - Kart: statisk visning med alle stopp markert + anbefalt rute mellom dem
   - Stopp-liste: kompakte kort med nummer, navn, thumbnail, kort beskrivelse
   - Rewards-teaser: "Besøk alle stopp og få en belønning fra hotellet"
   - CTA: "Start turen" (stor, tydelig knapp)

2. **Implementer Preview som ny komponent**
   - `TripPreview.tsx` — ny komponent, ikke gjenbruk av TripPage
   - Mottar `Trip` + optional `ProjectTripOverride`
   - Rendrer statisk kart (Mapbox med stopp-markører + polyline)
   - Ingen geolocation, ingen completion-tracking
   - Responsiv: fungerer på mobil og desktop

3. **Koble Preview til eksisterende ruter**
   - Trip Library-kortet klikker → Preview-side (ikke direkte til Aktiv)
   - Preview har "Start turen" → navigerer til Aktiv modus (eksisterende TripPage)
   - Direkte lenke til Preview fungerer (for QR/epost)
   - URL-struktur: `/for/[customer]/[project]/trips/[tripSlug]` viser Preview
   - "Start turen" setter state/query param som gjør at TripPage starter i aktiv modus

4. **Trip Library-kort oppgradering**
   - Vis all essensielt metadata på kortene (varighet, stopp, distanse, kategori)
   - Cover image som bakgrunn
   - Fjern dummy/placeholder-elementer
   - Sortering: featured først, deretter etter kategori

**Leveranse:** Gjesten kan browse Trip Library → se Preview med kart og stopp → trykke "Start turen."

**Autonomi-nivå:** Høy. Klare krav. Implementasjon er standard React/Next.js. Bruker (designer) reviewer visuelt.

---

### Sprint 3: Guided/Free toggle + DB-utvidelse (kan kjøres autonomt)

**Mål:** Brukeren kan velge mellom anbefalt rute og fri utforskning.

**Oppgaver:**

1. **DB-migrasjon: nye kolonner**
   - `trips.default_mode` — `TEXT CHECK (default_mode IN ('guided', 'free'))`, default `'guided'`
   - Oppdater Supabase-typer (`supabase gen types`)

2. **Guided mode (allerede delvis implementert)**
   - Verifiser at eksisterende TripPage viser rute i rekkefølge
   - Legg til transition_text mellom stopp (hvis ikke allerede synlig)
   - Teaser chain: transition_text avsluttes med hook til neste

3. **Free mode (nytt)**
   - Kart viser alle stopp uten polyline mellom dem
   - Hvert stopp viser avstand fra brukerens posisjon (dynamisk)
   - Stopp-liste sortert etter avstand fra bruker (nærmeste først)
   - Transition_text skjult — kun local_insight vises
   - Ingen "neste stopp" — alle stopp er likeverdige

4. **Toggle mellom moduser**
   - UI-element i TripPage header: "Anbefalt rute" / "Utforsk fritt"
   - Default basert på `trip.default_mode`
   - Brukervalg lagres i localStorage for denne turen
   - Kart animerer mellom visningene (polyline fade in/out)

5. **Preview viser begge**
   - Preview-kart viser anbefalt rute som default
   - Tekst nevner: "Du kan også utforske stoppene i din egen rekkefølge"

**Leveranse:** Guided og Free mode fungerer. Toggle synlig. Default per tur.

**Autonomi-nivå:** Høy. Klar spesifikasjon. Mapbox polyline toggle er standard.

---

### Sprint 4: Rewards/progress i demo (kan kjøres autonomt)

**Mål:** Visuell progress og belønningskonsept er synlig og fungerende.

**Oppgaver:**

1. **Progress-indikator i Aktiv modus**
   - Visuell: sirkler for hvert stopp (fylt = besøkt, åpen = gjenstår)
   - Plassering: header eller bottom bar
   - Oppdateres ved "Jeg er her"-klikk
   - Fungerer uavhengig av rekkefølge (set-basert)

2. **Rewards i Preview**
   - Seksjon nederst på Preview-siden: "Fullfør turen og få en belønning"
   - Viser reward_title fra project_trips override (eller default fra trip)
   - Visuell: ikon + tekst, ikke for prominent — supplement, ikke hovedmotivasjon

3. **"Jeg er her"-knapp per stopp**
   - Knapp synlig når stoppet er åpent/valgt
   - Trykk → markerer stoppet som besøkt → progress oppdateres
   - Enkel animation/feedback (checkmark, farge-endring)
   - GPS-radius-check som valgfri oppgradering (ikke for demo)

4. **Completion-flow verifisering**
   - Alle stopp besøkt → TripCompletionScreen vises (allerede implementert)
   - Confetti + reward-visning (allerede implementert)
   - Verifiser at flyten fungerer end-to-end med nye turer

5. **Demo rewards-data**
   - Sett opp dummy rewards for Scandic Nidelven via project_trips override
   - Eksempel: "Vis denne skjermen i resepsjonen — gratis kaffe på oss"
   - Konfigurerbart i admin (allerede støttet)

**Leveranse:** Gjesten ser progress under turen og belønning ved fullføring. Alt dummy men fungerende.

**Autonomi-nivå:** Medium-høy. Completion-systemet eksisterer. Hovedjobb er UI-polering og kobling.

---

### Sprint 5: Visuell polish + demo-klargjøring (krever designer-input)

**Mål:** Demoen er klar til å sendes til Scandic-kontakten.

**Oppgaver:**

1. **Cover images for alle 3 turer**
   - Manuelt kuratert (egne foto / Unsplash)
   - Atmosfæriske, Trondheim-spesifikke bilder
   - Riktig format/ratio for Preview-kort og Preview-hero
   - Last opp og sett i DB

2. **Trip Library polering**
   - Kort-design som trigger "denne vil jeg ta"
   - Metadata tydelig og skannbar
   - Responsiv — fungerer på mobil
   - Fjern eventuelle gamle placeholder-elementer

3. **Preview-side polering**
   - Kartvisning med riktige stopp-markører (numbered, ikke generic)
   - Stopp-liste med gode bilder og tekst
   - "Start turen"-knapp som føles inviterende
   - Rewards-teaser som gir motivasjon uten å overse
   - Scroll-opplevelse: hero → metadata → kart → stopp → reward → CTA

4. **Aktiv modus polering**
   - Transition-tekst synlig og lesbar under gange
   - Progress-indikator tydelig
   - "Jeg er her"-knapp intuitiv
   - Kart-interaksjon smidig

5. **End-to-end test av demo-flyten**
   - QR → Trip Library → Preview → Start → Aktiv → Completion
   - Test på mobil (ekte enhet)
   - Test med Chrome DevTools MCP for screenshots
   - Fiks eventuelle bugs eller UX-problemer

6. **Koble til Scandic Nidelven**
   - Opprett project_trips-linking for alle 3 turer
   - Sett opp overrides: welcome_text, reward, evt. start POI
   - Verifiser at `/for/scandic-nidelven/[project]/trips` viser riktig

**Leveranse:** Demo-link klar til å sende.

**Autonomi-nivå:** Lav-medium. Designvalg krever brukerens øyne. Claude implementerer, bruker reviewer.

---

## Parkerte oppgaver (TODO for senere)

| Oppgave | Prioritet | Kontekst |
|---|---|---|
| **Lagre trips i samlinger** (som Explorer POI-er) | Medium | Utvid collection-modal til å støtte both POIs og trips |
| **Cross-product synergier** (Explorer → Trip CTAs, POI-kort "Trips (x)") | Medium | Trip-markører i Explorer-kart, fane i POI-kort |
| **Audio-guide** (TTS fra transition-tekst) | Lav | Detour-inspirert, ElevenLabs/OpenAI TTS |
| **Trip Curator skill** (formalisert workflow) | Medium | Etter at 3 demo-turer er ferdigprodusert — lær av erfaring først |
| **Curator-nivåer for alle teksttyper** | Medium | heroIntro, intro_text, editorial_hook, transition_text, local_insight — alle trenger kontekstspesifikk skriveoppskrift |
| **Offline-modus** | Lav | Service worker for Nord-Norge/cruise. Ikke demo-kritisk |
| **GPS-proximity-check** | Lav | Auto-markering av stopp basert på GPS-radius. Oppgradering fra manuell knapp |
| **Trip-anbefalinger** | Lav | ML/regel-baserte forslag basert på kontekst |
| **Trip reviews/ratings** | Lav | Bruker-feedback. Krever autentisering |
| **Flere trip-kategorier** | Medium | Kunst & Arkitektur, Natur, Nattliv — etter at demo-kategoriene er validert |
| **Sightseeing som ny kategori** | Medium | `trips.category` trenger ny enum-verdi for Midtbyen-turen |
| **Kafé 021-hooks omskriving** | Medium | 16 hooks under Curator-standard (gjentatt fra flere sesjoner) |
| **Guide "Les mer" CTA** | Lav | GuideStickyMap mangler areaSlug for intern linking |

---

## Beslutninger fra brainstorm

| # | Beslutning | Begrunnelse |
|---|---|---|
| 1 | Preview og Aktiv er to separate moduser/visninger | Ulike behov: beslutning vs navigasjon |
| 2 | Guided vs Free som toggle, default per tur | Narrativ rekkefølge funker for historisk, ikke for mat |
| 3 | Transition-tekst kun i Guided; local_insight i begge | Retningsbestemt tekst kollapser i Free mode |
| 4 | Teaser chain i transition_text | Sterkeste driveren for completion (research-basert) |
| 5 | Rewards: milestone/progress, set-basert | Rekkefølge-uavhengig: "3 av 5 besøkt" |
| 6 | "Jeg er her"-knapp, ikke GPS-auto | Tryggere for demo, GPS som oppgradering |
| 7 | 3 demo-turer, ikke 6 | Kvalitet > kvantitet for demo |
| 8 | Under 1.5 km radius, under 60 min | Research: best completion rate |
| 9 | POI-oppretting som del av Curator-workflow | Beriker DB automatisk, følger IP-strategi |
| 10 | Cover images manuelt kuratert | Autentiske bilder > genererte |
| 11 | Rewards dummy for demo, manuell avtale for reelle | Ærlig — ingen falske løfter |
| 12 | Audio parkert | Utenfor scope |
| 13 | Cross-product synergier parkert | Idé notert, bygg etter demo |
| 14 | Scandic-kontakten opplever produktet direkte | Kontekst i epost, ingen pitch-side |
| 15 | Trip Curator skill formaliseres etter erfaring | Kjør Bakklandet uten skill, dokumenter, formaliser |

---

## Åpne spørsmål

1. **Aktiv modus layout (mobil):** Bruker (designer) definerer dette. Ikke spesifisert ennå.
2. **Tur 3 stopp-liste:** Midtbyen på 30 min — eksakte stopp ikke valgt. Avhenger av tilgjengelige POI-er innenfor radius.
3. **Sightseeing som kategori:** DB har `category CHECK` med faste verdier. Trenger migrasjon for å legge til `sightseeing`.
4. **Tone-valg for transition-tekst:** 3 varianter skrives for Bakklandet, bruker velger. Ikke forhåndsbestemt.
5. **Trip Library plassering:** Lever den som fane på hotellsiden, egen side, eller begge?

---

## Avhengigheter mellom sprints

```
Sprint 1 (POI + innhold)
    ↓
Sprint 2 (Preview-modus)  ←  kan starte parallelt med Sprint 1 (UI uten innhold)
    ↓
Sprint 3 (Guided/Free)    ←  avhenger av Sprint 2 (Preview viser begge)
    ↓
Sprint 4 (Rewards/progress) ← avhenger av Sprint 2 (Preview viser reward-teaser)
    ↓
Sprint 5 (Polish + demo)  ←  avhenger av alt over
```

Sprint 1 og 2 kan kjøres **parallelt** (innhold + UI er uavhengige).
Sprint 3 og 4 kan kjøres **parallelt** (toggle + rewards er uavhengige).
Sprint 5 er alltid sist.
