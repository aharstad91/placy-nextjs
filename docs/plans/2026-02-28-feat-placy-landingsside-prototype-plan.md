---
title: "feat: Placy landingsside HTML-prototype"
type: feat
date: 2026-02-28
brainstorm: docs/brainstorms/2026-02-28-placy-landingsside-brainstorm.md
---

# Placy Landingsside — HTML-prototype

Statisk HTML-prototype for placy.no, inspirert av luffu.com sitt premium design. Viser visuelt design OG innhold/budskap for Placy.

## Oversikt

**Leveranse:** `placy-website/` mappe med:
- `index.html` — komplett landingsside
- `styles.css` — alle stiler
- Placeholder-bilder via Unsplash URLs

**Målgruppe:** B2B-kunder (hoteller + eiendom)
**Språk:** Norsk
**CTA:** "Book en demo"
**Produktfokus:** Report først, deretter Explorer og Trip

## Designsystem (fra Luffu-analyse)

### Fargepalett
| Variabel | Verdi | Bruk |
|----------|-------|------|
| `--bg-primary` | `#e4e7da` | Hovedbakgrunn (varm sage) |
| `--bg-light` | `#f5f5ee` | Lyse seksjoner |
| `--bg-dark` | `#192830` | Dark sections, nav |
| `--text-primary` | `#192830` | Hovedtekst (dyp mørkeblå) |
| `--text-secondary` | `#2f3136` | Sekundærtekst |
| `--text-white` | `#ffffff` | Tekst på mørke flater |
| `--accent` | `#393e28` | Aksenter, knapper |
| `--gradient-start` | `#d4a0a0` | Rosa gradient |
| `--gradient-end` | `#d4a07a` | Oransje gradient |

### Typografi
| Element | Font | Størrelse | Weight | Letter-spacing |
|---------|------|-----------|--------|---------------|
| H1 display | DM Serif Display | 54px | 400 | -2.2px |
| H2 large | DM Serif Display | 72px | 400 | -2.2px |
| H1 section | DM Serif Display | 45px | 400 | -2.2px |
| H3 label | DM Sans | 18px | 400 | -0.4px |
| Body large | DM Sans | 22px | 400 | normal |
| Body | DM Sans | 18px | 400 | normal |

**Google Fonts:** `DM Serif Display` (nærmeste match for ABC Arizona Flare) + `DM Sans` (nærmeste match for ABC Arizona Sans)

### Layout
- Full-bredde seksjoner med `max-width: 800px` sentrert innhold
- Generøs padding: `120px 0` per seksjon (som Luffu)
- Tekst sentrert i de fleste seksjoner

## Seksjoner og innhold

### 1. Navigation
```html
<!-- Minimalistisk: Logo venstre, "Om" + "Book demo" høyre -->
<!-- Sticky, transparent over hero, solid på scroll -->
```
- Logo: "Placy" i DM Serif Display
- Lenker: "Om" (anchor til mission), "Book en demo" (mørk knapp)

### 2. Hero
- **Bakgrunn:** Fullbredde Trondheim-bilde (Unsplash: Bakken/Nidelva)
- **Overlay:** Mørk gradient nedenfra for lesbarhet
- **H1:** "Når stedet er historien, forteller vi den."
- **Sub (22px):** "Placy gjør nabolag og byer til levende opplevelser — med kart, kuraterte turer og redaksjonelt innhold."
- **CTA:** "Book en demo →" (hvit outline-knapp)
- **Logo stor:** "Placy" i stor serif nederst i hero (som Luffu)

### 3. Problem — "For de som eier stedene"
- **Bakgrunn:** `--bg-primary`
- **Layout:** Sirkulære bilder (6 stk) spredt organisk med spørsmål-bobler
  - Bilder: bygg, nabolag, hotell-resepsjon, leilighet, park, restaurant
  - Bobler: "Hvordan viser vi kjøperne hva som finnes rundt hjørnet?" osv.
- **H1 (54px):** "For de som vet at beliggenhet er alt"
- **Body (18px):** "Enten du selger boliger eller driver hotell — stedene rundt deg er din største verdi. Placy hjelper deg å vise dem frem."

### 4. Løsning
- **Bakgrunn:** `--bg-light`
- **H1 (54px):** "Tre produkter. Én plattform. Uendelige steder."
- **Body (22px):** "Placy samler stedsdata, kuratert innhold og interaktive kart i én plattform — tilpasset din bransje og dine behov."

### 5. Feature: Report (hero-produkt)
- **Layout:** Tekst venstre + mockup høyre (gradient bakgrunn bak mockup)
- **H1 (45px):** "Nabolaget som salgsargument"
- **Body (22px):** "Redaksjonelt innhold med interaktive kart. Vis boligkjøpere hva som gjør området unikt — kafeene, parkene, skolene, stemningen."
- **Mockup:** Rektangulær skjerm-mockup med gradient-bakgrunn (rosa→oransje)
- **3 mini-features** under mockup:
  - **Kuratert** — "Håndplukkede steder, ikke bare Google-data"
  - **Interaktivt** — "Kart med avstand og reisetid"
  - **Redaksjonelt** — "Byens beste croissant er 3 minutter unna"

### 6. Feature: Explorer
- **Layout:** Mockup venstre + tekst høyre (alternerer fra Report)
- **H1 (45px):** "La gjestene utforske selv"
- **Body (22px):** "Et interaktivt kart med alt i nærheten — restauranter, barer, museer, butikker. Filtrert, kategorisert, klart til bruk."
- **Mockup:** Telefon-mockup med kart-UI

### 7. Feature: Trip
- **Layout:** Tekst venstre + mockup høyre
- **H1 (45px):** "Kuraterte opplevelser ingen andre tilbyr"
- **Body (22px):** "Ferdige turer med et tema — historisk byvandring, mattur, kunstløype. Dine gjester får en unik opplevelse."
- **Mockup:** Telefon-mockup med tur-oversikt

### 8. Hvorfor Placy? ("Play-see")
- **Bakgrunn:** `--bg-primary`
- **H2 (72px):** "Hvorfor Placy? ("Play-see")" — italic uttale som Luffu
- **Sirkulære bilder** i bue (6 stk av steder/nabolag)
- **Body (22px):** "Placy er der 'playful' møter 'place'. Vi tror steder skal oppdages med nysgjerrighet og glede — ikke bare geotagges."

### 9. Mission
- **Bakgrunn:** Gradient (rosa → oransje, som Luffu)
- **H2 (54px):** "Steder har historier. Vi hjelper deg å fortelle dem."
- **Two-column tekst:**
  - Venstre: Problem-statement om at beliggenhet er undervurdert i markedsføring
  - Høyre: Placy-misjon om å gjøre steder synlige og meningsfylte
- **Signatur:** "Placy-teamet"

### 10. Closing CTA
- **Bakgrunn:** `--bg-light`
- **H1 (72px):** "Klar til å vise frem stedet ditt?"
- **Sub (18px):** "Book en demo og se hvordan Placy kan fungere for deg."
- **Sirkulære bilder** (overlappende, som Luffu)
- **CTA-felt:** Full-bredde boks med "Book en demo" tekst + pil-knapp

### 11. Footer
- **Bakgrunn:** `--bg-primary` (litt mørkere)
- **Logo:** Placy i serif
- **Lenker:** Instagram, LinkedIn
- **Copyright:** "2026 Placy. Alle rettigheter reservert."

## Implementasjonsplan

### Steg 1: Oppsett
- [ ] Opprett `placy-website/` mappe
- [ ] Opprett `index.html` med HTML5-boilerplate
- [ ] Opprett `styles.css` med CSS custom properties (fargepalett + typografi)
- [ ] Link Google Fonts: DM Serif Display + DM Sans

### Steg 2: CSS-fundament
- [ ] CSS reset + base styles
- [ ] Custom properties for alle farger og fonts
- [ ] Seksjon-layout (full-bredde + sentrert innhold)
- [ ] Typografi-klasser
- [ ] Sirkulær bilde-komponent
- [ ] Gradient-bakgrunner
- [ ] Knapp-stiler (solid + outline)

### Steg 3: Seksjoner (top-down)
- [ ] Navigation (sticky, minimalistisk)
- [ ] Hero (fullbredde bilde + overlay + tekst + stor logo)
- [ ] Problem (sirkulære bilder med spørsmål-bobler)
- [ ] Løsning (sentrert tekst)
- [ ] Report feature (tekst + mockup side-by-side)
- [ ] Explorer feature (mockup + tekst, alternerende)
- [ ] Trip feature (tekst + mockup)
- [ ] Hvorfor Placy? (stor heading + bue av bilder)
- [ ] Mission (gradient + two-column)
- [ ] Closing CTA (stort statement + demo-felt)
- [ ] Footer

### Steg 4: Bilder og placeholder
- [ ] Finn Unsplash-bilder for hero (Trondheim)
- [ ] Finn bilder for sirkulære composites (bygg, nabolag, steder)
- [ ] Lag CSS-baserte mockups for telefon/skjerm (ingen bildefiler)
- [ ] Gradient-sirkler bak bilder (CSS)

### Steg 5: Polish
- [ ] Sjekk at alle akseptansekriterier er oppfylt
- [ ] Test i Chrome desktop
- [ ] Ta screenshot med Chrome DevTools MCP og sammenlign med Luffu
- [ ] Juster spacing, farger, typografi til det matcher Luffu-kvaliteten

## Akseptansekriterier

### Design & Look/Feel
- [ ] Fargepalett matcher Luffu: varm sage/beige bg, mørkeblå tekst
- [ ] DM Serif Display for headings, DM Sans for body
- [ ] Tight letter-spacing (-2px+) på headings
- [ ] Generøs whitespace — seksjoner puster
- [ ] Sirkulære bildekomposisjoner i minst 2 seksjoner
- [ ] Gradient-overgang i minst 1 seksjon
- [ ] Minimalistisk navigasjon (logo + 2 lenker)
- [ ] Premium, rolig stemning

### Innhold/Budskap
- [ ] Alle seksjoner har meningsfylt norsk tekst
- [ ] Narrativ: problem → løsning → produkter → why → mission → CTA
- [ ] Report som hero-produkt
- [ ] Explorer og Trip tydelig men sekundært
- [ ] Emosjonell men profesjonell tone
- [ ] "Hvorfor Placy?" med navnehistorie
- [ ] CTA er "Book en demo"

## Referanser
- Luffu-analyse: `luffu-capture/` (screenshots + CSS-data)
- Placy-produkter: `context/products.md`
- Brainstorm: `docs/brainstorms/2026-02-28-placy-landingsside-brainstorm.md`
