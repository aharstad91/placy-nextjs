---
title: Placy Analytics — Dedikert salgsside
type: feat
date: 2026-02-28
---

# Placy Analytics — Dedikert salgsside

## Oversikt

Bygg en dedikert salgsside (`analytics.html`) for Placy Analytics-konseptet på placy.no-nettsiden. Siden skal kommunisere hele forretningskonseptet fra brainstormen — tre lag med verdi, segmentering uten identifisering, differensiator mot brosjyrer/Google Analytics, og en tydelig CTA for tidlig tilgang.

**Kilde:** `docs/brainstorms/2026-02-28-placy-analytics-forretningskonsept-brainstorm.md`

**Leveranse:** `/Users/andreasharstad/Documents/placy-ralph-website/placy-website/analytics.html` + oppdateringer i `styles.css` + nav-oppdatering i alle sider.

## Designprinsipper

- Følg eksisterende designsystem (Luffu-inspirert: DM Serif Display, DM Sans, sage/beige palett)
- Premium, rolig stemning — som resten av nettsiden
- Bruk `/frontend-design` skill for kreative, distinkte seksjoner
- Dashboard-mockupen fra index.html gjenbrukes og utvides
- Ingen "startup-hyper" — profesjonelt, varmt, ærlig

## Seksjonsstruktur

### 1. Hero — Verdipåstand
- **Label:** "Placy Analytics"
- **Heading:** "Vet du hva boligkjøperne dine faktisk bryr seg om?"
- **Sub:** Snu verdipropsisjonen: fra "vi lager en fin presentasjon" til "vi viser deg hva kjøperne sjekker — og beviser at markedsføringen funker"
- **CTA:** "Få tidlig tilgang" → mailto:hei@placy.no
- **Badge:** "Snart tilgjengelig" — ærlig, ambisiøst
- **Visuell:** Stor, floatende dashboard-mockup i bakgrunnen (tilt/perspektiv)

### 2. Problemet — "Du aner ikke om det funker"
- **Heading:** "80.000 kroner på en brosjyre. Null innsikt i om noen leste den."
- **3 smertepunkter** med visuelt skille:
  1. "Brosjyrer havner i søpla etter 5 sekunder"
  2. "Google Analytics viser sidevisninger — ikke hva folk utforsker"
  3. "Du rapporterer 'vi tror det funker' til ledelsen"
- **Tone:** Direkte, gjenkjennelig, ikke aggressiv

### 3. Tre lag med verdi — Kjernemodellen
- **Heading:** "Tre lag med innsikt"
- **Lag 1:** Presentasjon (eksisterer i dag)
  - Ikon + kort beskrivelse
  - "Interaktivt kart, kuraterte steder, redaksjonelt innhold"
  - Visuelt: aktiv/ferdig-status
- **Lag 2:** Engagement-data (selges først)
  - "Hvem besøker, hva klikker de på, hvor lenge"
  - 5 KPI-er: Besøkende, Utforskningsgrad, Temafordeling, Topp POI-er, Tid
  - Visuelt: fremhevet som "neste steg"
- **Lag 3:** Kjøperinnsikt (vokser med volum)
  - "Aggregert atferdsdata på tvers av prosjekter"
  - Eksempler: "Barnefamilier sjekker skole først, singelprofesjonelle sjekker kafé og trening"
  - Visuelt: fremtidig/visjon
- **Layout:** Vertikal progression med visuell indikator (1→2→3), eller horisontale kort

### 4. Dashboard-seksjon — "Se hva du får"
- **Gjenbruk og utvid** dashboard-mockupen fra index.html
- **KPI-kort:** 847 besøkende, 50% utforsket, 3m 42s snitt, Hverdagsliv populært
- **Donut chart:** Tema-interesse (Hverdagsliv 35%, Mat & Drikke 25%, etc.)
- **Bar chart:** Mest besøkte steder
- **Prosjekttabell:** Brøset, Overvik, Valentinlyst
- **Visuell twist:** Animert eller perspektiv-rotert for å skille fra index.html-versjonen
- **Undertekst:** "Reelle data fra boligkjøpere som utforsker prosjektpresentasjoner"

### 5. Segmentering uten identifisering — USP
- **Heading:** "Smart segmentering — uten cookies, uten login"
- **Nøkkelbudskap:** Du trenger IKKE vite hvem besøkeren er
- **To mekanismer:**
  1. **Prosjektkontekst = implisitt segment:** "Brøset er familieboliger. Sluppen er sentrumsleiligheter."
  2. **Atferd = segmentering:** Klikkmønster avslører kjøpertype
- **Visuell:** Tabell eller ikongrid med atferdsmønstre:
  - Skole + barnehage + lekeplass → Barnefamilie
  - Kafé + restaurant + trening → Ung profesjonell
  - Dagligvare + transport + helse → Senior/praktisk
- **GDPR-punkt:** "Alt er cookieless, GDPR-vennlig, krever null identifisering"
- **Datapunkt-tabell:** 7 datapunkter med metode og personvernnivå

### 6. Differensiator — "Ingen andre har dette"
- **Heading:** "Innsikt ingen andre gir deg"
- **Sammenligning:**
  - Finn.no → Viser annonser
  - Meglere → Viser plantegninger
  - Google Analytics → Viser sidevisninger
  - **Placy Analytics** → Viser hva folk *faktisk bryr seg om* i nabolaget
- **Visuell:** Sammenligningstabell eller "before/after"-kort
- **Moat-argument:** "Mer data = bedre innsikt = vanskeligere å kopiere"

### 7. Sosial proof / Eksempler
- **Heading:** "Konkrete innsikter som endrer markedsføringen"
- **Eksempel-kort:**
  - "68% av Brøset-besøkerne sjekket skoletilhørighet. Bruker dere det i annonseringen?"
  - "Prosjekter som fremhever skoledata i annonsering har 34% høyere utforskningsgrad"
  - "Besøkende bruker 3:42 i snitt. En brosjyre? 5 sekunder."
- **Visuelt:** Sitat-stil kort med tall fremhevet

### 8. CTA — "Vær blant de første"
- **Heading:** "Klar til å forstå kjøperne dine?"
- **Sub:** "Vi bygger Placy Analytics nå. Vær blant de første som får tilgang."
- **CTA:** "Få tidlig tilgang" → mailto:hei@placy.no
- **Badge:** "Snart tilgjengelig"

### 9. Footer
- Gjenbruk eksisterende footer fra index.html

## Navigasjon

- Legg til "Analytics" som nav-lenke i alle sider (index.html, hotell.html, events.html, analytics.html)
- Analytics-lenken plasseres mellom "Events" og "Om"
- På analytics.html: `nav-link-active` på Analytics-lenken
- analytics.html bruker `nav-solid` (som hotell.html/events.html)

## Akseptansekriterier

### Design & Visuelt
- [x] Følger eksisterende designsystem (farger, typografi, spacing)
- [x] DM Serif Display for headings, DM Sans for body
- [x] Generøs whitespace mellom seksjoner (min 120px padding)
- [x] Sage/beige bakgrunn med hvite kort
- [x] Premium, rolig stemning — ikke "startup-hyper" eller "SaaS-generisk"
- [x] Dashboard-mockup har visuell dybde (skygge, perspektiv, eller float-effekt)
- [x] Seksjonene har visuell variasjon (ulike bakgrunner, layouts)
- [x] Responsive nok til å ikke brekke på tablet (desktop-first er OK)

### Innhold & Budskap
- [x] Hero kommuniserer verdiendringen: fra "fin presentasjon" til "bevis at markedsføringen funker"
- [x] Tre-lags-modellen er tydelig og visuelt differensiert
- [x] Problemseksjonen er gjenkjennelig for eiendomsutviklere
- [x] Segmentering uten identifisering er forklart enkelt og overbevisende
- [x] GDPR/cookieless er eksplisitt nevnt
- [x] Datapunkttabell viser hva som trackes og personvernnivå
- [x] Differensiator mot Finn/Meglere/GA er tydelig
- [x] Konkrete eksempler med realistiske tall (68%, 3:42, etc.)
- [x] All tekst er på norsk
- [x] Tone er profesjonell men varm — ikke tørr SaaS-copy
- [x] "Snart tilgjengelig" badge er ærlig og synlig
- [x] CTA er "Få tidlig tilgang" med tydelig handling

### Funksjonelt
- [x] analytics.html er tilgjengelig via navigasjonen fra alle sider
- [x] Nav-lenke "Analytics" er lagt til i index.html, hotell.html, events.html
- [x] Analytics-lenken har `nav-link-active` på analytics.html
- [x] Alle lenker fungerer (intern nav, CTA mailto)
- [x] Scroll-script for nav-bakgrunn fungerer (nav.scrolled)
- [x] Siden er en selvstendig komplett side (head, nav, content, footer)
- [x] Deler `styles.css` med resten av nettsiden
- [x] Nye CSS-klasser har konsistente navngivningskonvensjoner (an- prefix)

### Kvalitet
- [x] Ingen broken images eller placeholder-tekst
- [x] Dashboard-mockup er visuelt troverdig (realistiske tall)
- [x] Atferdsmønster-segmentering har minst 3 segmenter med eksempler
- [x] Sammenligningstabell har minst 4 konkurrenter/alternativer (5: Finn, Meglere, GA, Brosjyre, Placy)
- [x] Minst 3 konkrete innsikt-eksempler med tall (4 stk: 68%, 34%, 3:42, 58%)
- [x] HTML er semantisk korrekt (sections, headings, etc.)
- [x] CSS er organisert med kommentarseksjoner

## Referansefiler

- Brainstorm: `docs/brainstorms/2026-02-28-placy-analytics-forretningskonsept-brainstorm.md`
- Landingsside-brainstorm: `docs/brainstorms/2026-02-28-placy-landingsside-brainstorm.md`
- Eksisterende nettside: `/Users/andreasharstad/Documents/placy-ralph-website/placy-website/`
- Design-inspirasjon: passionfroot.me (analytics-dashboard-stil)
- Eksisterende analytics-seksjon i index.html (linje 517-643)
- Eksisterende CSS for dashboard-mockup (styles.css linje 1437-1672)
