# Brainstorm: Placy Landingsside (placy.no)

> Dato: 2026-02-28 (oppdatert 2026-02-28 sesjon 2)
> Status: Besluttet — klar for plan
> Tilleggsinspirasjon: passionfroot.me (analytics-seksjon)

## Hva vi bygger

En statisk HTML-prototype for placy.no landingsside, inspirert av luffu.com sitt premium design. Prototypen viser både visuelt design (farger, typografi, layout) og innhold/budskap (Placy-tilpasset narrativ).

**Leveranse:** `placy-website/` mappe med index.html + styles.css + placeholder-bilder.

## Designinspirasjon: Luffu.com

Analysert grundig med Chrome DevTools MCP (11 screenshots + CSS-data i `luffu-capture/`).

### Luffu designsystem:
- **Fargepalett:** bg=#e4e7da (varm sage), tekst=#192830 (dyp mørkeblå), lys=#f5f5ee, aksent=#393e28
- **Fonter:** "ABC Arizona Flare" (serif display), "ABC Arizona Sans" (body sans)
- **Typografi:** H1=54px, H2=72px, body=18px, sub=22px. Letter-spacing: -2.2px. Weight 400
- **Layout:** Full-bredde seksjoner, sentrert innhold ~800px, generøs vertikal whitespace
- **Visuelt:** Sirkulære bilder, telefon-mockups, gradient-overganger (rosa/oransje), subtile farge-sirkler bak bilder
- **Stemning:** Varm, menneskelig, premium, organisk, rolig

### Luffu innholdsstruktur:
1. Hero — emosjonelt løfte + stort bilde + CTA
2. Problem — sirkulære portretter + spørsmål-bobler
3. Løsning — "An intelligent system"
4. Features (4 stk) — heading + tekst + mockup, alternerende layout
5. Why [brand]? — navnehistorie + sirkulære portretter i bue
6. Mission — gradient bg + grunnlegger-statement
7. Closing CTA — stort emosjonelt statement
8. Footer — logo + sosiale lenker

## Nøkkelbeslutninger

### 1. Målgruppe: Eiendomsutviklere (B2B)
Eiendomsutviklere som selger boliger. Profesjonelt men varmt. Sluttbrukere (boligkjøpere) er sekundære. Hotell er parkert — kun eiendom/bolig for nå.

### 2. Språk: Norsk
Kundene er norske. Luffu-tonen oversettes godt til norsk.

### 3. CTA: "Book en demo"
Samler leads. B2B-fokus. "Se hvordan Placy fungerer for din bedrift."

### 4. Produktfokus: Report først, kun eiendom
Eiendom/bolig er eneste fokus nå. Report som hero-produkt i feature-seksjonen. Explorer presenteres som tilleggsprodukt for boligkjøpere. Trip/Guide nevnes ikke i denne versjonen.

### 5. Tone: Varmt profesjonell
"Vi forstår steder" — som en dyktig arkitekt som snakker lidenskapelig om nabolag. Premium men tilgjengelig. Ikke så poetisk som Luffu, men langt fra tørt.

### 6. Bilder: Trondheim-bilder
Unsplash-bilder fra Trondheim/norske byer. Bakken, Nidelva, bryggerekken. Autentisk og gjenkjennelig.

### 7. Navnehistorie: "Playful + Place"
"Placy = playful places. Vi tror steder skal oppdages med nysgjerrighet og glede."

### 8. Analytics-seksjon: Verdibevis for kunden
Inspirert av passionfroot.me sin analytics-dashboard. Kommuniserer at Placy forstår at kunden trenger å bevise ROI — og at vi bygger verktøy for det. Presenteres med realistisk dashboard-mockup men ærlig "Snart tilgjengelig"-badge.

**Hvorfor dette er viktig:**
- Ingen eiendomsutvikler har innsikt i om brosjyrematerialet deres fungerer
- Google Analytics viser sidevisninger, men ikke *hva folk utforsker*
- Placy kan vise "23 besøkende sjekket Singsaker skole denne uken" — handlingsbar innsikt
- Differensiator: ingen andre stedsplattformer gir denne innsikten

**Mottaker:** Prosjektleder/markedssjef som rapporterer til ledelsen

**Tone:** "Vi bygger dette" — ærlig, ambisiøst, men ikke fake

## Designinspirasjon: Passionfroot.me (tillegg)

Passionfroot viser analytics-dashboard direkte på landingssiden som visuelt bevis:
- **KPI-kort øverst:** Creators, Posts, Reach, Engagement, Eng. Rate, Avg. CPM
- **Grafer i midten:** Platform breakdown (donut), Engagement Rate (bar), Creator Mix (area)
- **Detaljert tabell under:** Per-creator metrics med reach, engagement, eng. rate
- **Visuell stil:** Varm beige bakgrunn, oransje/lilla graffarger, ren typografi, floatende dashboard-mockup
- **Budskap:** "Track every post across every platform, automatically" — tydelig verdi

## Placy seksjonsstruktur (mapping fra Luffu)

### 1. Hero
- **Stort bilde:** Trondheim-panorama eller livlig gatescene
- **Heading:** "Når stedet er historien, forteller vi den."
- **Sub:** "Placy gjør nabolag og byer til levende opplevelser — med kart, kuraterte turer og redaksjonelt innhold."
- **CTA:** "Book en demo →"
- **Stor logo:** "Placy" i serif, som Luffu gjør nederst i hero

### 2. Problem — "For de som selger boliger"
- Sirkulære bilder av bygg/nabolag med spørsmål-bobler:
  - "Hvordan viser vi kjøperne hva som finnes rundt hjørnet?"
  - "Nabolaget er vårt beste salgsargument — men ingen ser det"
  - "Vi bruker 80.000 på brosjyrer uten å vite om noen leser dem"
- **Heading:** "For de som vet at beliggenhet er alt"
- **Sub:** "Du selger boliger. Nabolaget rundt er din største verdi — men ingen verktøy viser det frem skikkelig. Placy endrer det."

### 3. Løsning — "En stedsplattform som forstår"
- **Heading:** "Nabolaget — presentert som det fortjener"
- **Sub:** "Kuratert innhold, interaktive kart, og smart filtrering. Placy viser boligkjøpere akkurat det som er relevant for dem."

### 4. Feature: Report (hero-produkt)
- **Heading:** "Nabolaget som salgsargument"
- **Sub:** "Redaksjonelt innhold med interaktive kart. Vis boligkjøpere hva som gjør området unikt — kafeene, parkene, skolene, stemningen."
- **Visuell:** Mockup av Report-produkt (skjerm eller telefon)
- **Detaljer:** 3 mini-features (som Luffus Natural Language/Vision/Connect):
  - Kuraterte POI-er — håndplukket, ikke bare Google-data
  - Interaktive kart — vis avstand og reisetid
  - Redaksjonelle hooks — "Byens beste croissant er 3 minutter unna"

### 5. Feature: Explorer
- **Heading:** "La kjøperne utforske selv"
- **Sub:** "Et interaktivt kart med alt i nærheten — butikker, kafeer, parker, treningssentre. Filtrert, kategorisert, klart til bruk."
- **Visuell:** Mockup av Explorer-kart

### 6. Analytics — "Vet du hva boligkjøperne lurer på?" (NY — Passionfroot-inspirert)
- **Heading:** "Vet du hva boligkjøperne lurer på?"
- **Sub:** "Placy viser deg hva potensielle kjøpere utforsker — hvilke skoler de sjekker, hvilke butikker de ser etter, hvor lenge de bruker tid. Innsikt ingen brosjyre gir deg."
- **Badge:** "Snart tilgjengelig" — subtil, elegant, ærlig
- **Undertekst:** "Vi bygger et dashboard som gir deg full oversikt over hvordan boligkjøpere bruker prosjektpresentasjonen din. Vær blant de første som får tilgang."
- **Visuell:** Realistisk dashboard-mockup (floatende, som Passionfroot) med:

  **KPI-kort (øverst):**
  | KPI | Mock-verdi | Betydning for kunden |
  |-----|-----------|---------------------|
  | Besøkende | 847 | "Så mange har sett prosjektet ditt" |
  | Utforsket | 423 (50%) | "Halvparten klikket seg inn i nabolaget" |
  | Gj.snitt tid | 3m 42s | "De bruker nesten 4 min — genuint interessert" |
  | Populært tema | Hverdagsliv | "Kjøperne bryr seg om dagligvare, skole, park" |
  | Mest besøkt | Singsaker skole | "Barnefamilier sjekker skoletilhørighet" |

  **Grafer (midten):**
  - Besøk over tid — linjegraf, siste 30 dager, spiker etter annonsering/visninger
  - Tema-interesse — donut: Hverdagsliv 35%, Mat & Drikke 25%, Aktiv Fritid 20%, Kultur 15%, Annet 5%
  - Topp 5 steder — bar chart: Singsaker skole, Rema 1000, Bakklandet, Byåsen trimpark, Rosenborg ungdomsskole

  **Prosjekttabell (under):**
  | Prosjekt | Besøkende | Utforskningsgrad | Tid | Populært tema |
  |----------|-----------|-----------------|-----|---------------|
  | Brøset | 847 | 50% | 3:42 | Hverdagsliv |
  | Overvik | 1,204 | 58% | 4:11 | Aktiv Fritid |
  | Valentinlyst | 312 | 43% | 2:55 | Mat & Drikke |

  **Visuell stil:** Varm bakgrunn, grafer i oransje/sage, ren typografi. Matcher Luffu + Passionfroot-estetikk.

- **Differensiator-punch:** Ingen eiendomsutvikler har denne innsikten i dag. Brosjyrer = null tracking. Google Analytics = sidevisninger, ikke innholdsinteraksjon. Placy = "23 besøkende sjekket Singsaker skole denne uken."

### 7. Hvorfor Placy? ("Play-see")
- **Heading:** "Hvorfor Placy?" med uttale-guide som Luffu
- Sirkulære bilder av steder i en bue (som Luffu-portrettene)
- **Tekst:** "Placy er der 'playful' møter 'place'. Vi tror steder skal oppdages med nysgjerrighet og glede — ikke bare geotagges."

### 8. Mission
- **Gradient bakgrunn** (varm, Luffu-inspirert)
- **Heading:** "Steder har historier. Vi hjelper deg å fortelle dem."
- **Tekst:** Kort grunnlegger-statement om hvorfor Placy finnes
- **Signatur:** "Placy-teamet"

### 9. Closing CTA
- **Heading:** "Klar til å vise frem stedet ditt?"
- **Sub:** "Book en demo og se hvordan Placy kan fungere for deg."
- **CTA-felt:** E-post + "Book demo"-knapp (som Luffus waitlist)

### 10. Footer
- Placy-logo
- Lenker: Om oss, Kontakt, Personvern
- Sosiale medier

## Akseptansekriterier

### Aspekt 1: Design & Look/Feel
- [ ] Fargepalett matcher Luffu: varm sage/beige bg, mørkeblå tekst, lyse seksjoner
- [ ] Serif display-font for headings (Google Fonts: Playfair Display eller DM Serif)
- [ ] Sans-serif for body (Inter eller DM Sans)
- [ ] Tight letter-spacing (-2px+) på headings
- [ ] Generøs whitespace — seksjoner puster
- [ ] Sirkulære bildekomposisjoner i minst 2 seksjoner
- [ ] Gradient-overgang i minst 1 seksjon
- [ ] Minimalistisk navigasjon (logo + 2-3 lenker)
- [ ] Premium, rolig stemning — ikke "startup-hyper"

### Aspekt 2: Innhold/Budskap
- [ ] Alle seksjoner har meningsfylt norsk tekst (ikke lorem ipsum)
- [ ] Narrativ: problem → løsning → produkter → analytics → why → mission → CTA
- [ ] Report presentert som hero-produkt
- [ ] Explorer presentert som tilleggsprodukt
- [ ] Analytics-seksjon med realistisk dashboard-mockup + "Snart tilgjengelig"-badge
- [ ] Kun eiendom/bolig — hotell er ikke nevnt
- [ ] Emosjonell men profesjonell tone
- [ ] B2B-verdien kommunisert uten å være "salgsy"
- [ ] Navnehistorien inkludert i "Hvorfor Placy?"-seksjonen
- [ ] CTA er "Book en demo" med tydelig handling

## Åpne spørsmål (parkert for plan)
- Eksakt font-valg (Google Fonts-match for ABC Arizona)
- Responsive breakpoints (desktop-first, mobil er bonus)
- Animasjoner/scroll-effekter (nice-to-have, ikke MVP)
- Analytics dashboard-mockup: bygge som ren HTML/CSS eller bruke screenshot/bilde?
- Skal analytics-mockupen ha interaktive elementer (hover-states) eller være statisk?
