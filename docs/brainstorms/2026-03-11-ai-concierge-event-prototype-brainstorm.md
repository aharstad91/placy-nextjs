# Placy Kompass — Event Prototype (Olavsfest)

**Dato:** 2026-03-11
**Status:** Brainstorm ferdig, klar for plan
**Trigger:** Claude.ai gjenskapte "trips"-konseptet med spørsmål → kuratert dagsplan. Placy kan gjøre det bedre med ekte data.

---

## Hva vi bygger

**Kompass** — Placys fjerde produkt, på lik linje med Explorer, Guide og Report.

En besøkende åpner Placy på stedet, svarer på 3 spørsmål i en bottom sheet, og får en personlig tidslinje med anbefalte events. Alt basert på ekte, verifisert data — ikke AI-gjetning.

Prototypen bygges for **Olavsfest** i Trondheim (28. juli – 3. august, ~222 events).

---

## Hvorfor denne tilnærmingen

- **Ekte data > hallusinasjon.** Claude.ai kan lage en pen dagsplan, men vet ikke hva som faktisk skjer kl. 14. Placy vet.
- **Strukturerte spørsmål > fri chat.** Raskere, billigere (ingen LLM-kall per bruker), forutsigbar UX.
- **Anbefaling, ikke filtrering.** Kompass fjerner ingenting — den løfter frem det relevante. Alt er fortsatt tilgjengelig.
- **Tab-mønster.** Kompass lever som en ekstra tab i sidebar, ikke som en erstatning.

---

## Nøkkelbeslutninger

### 1. Produktnavn: Kompass
"Placy Kompass — din personlige guide til festivalen." Kort, intuitivt, norsk. (Olavsfest har allerede en serie kalt "Kompass" — konseptet resonerer.)

### 2. Scope: Kun event (Olavsfest 2025-data)
Prototypen bruker fjorårets program (222 events, fullt komplett). Eiendom og hotell er fremtidige vertikaler.

### 3. UX-pattern: Strukturerte spørsmål (steg-for-steg)
Ingen AI-chat. Forhåndsdefinerte spørsmål med multiple choice. Tre steg:

**Steg 1 — Tema (multi-select):**
Hva vil du oppleve?
- 🎵 Konserter
- 💬 Samtaleprogram
- 👨‍👩‍👧 Familie
- 🎪 Folkeliv
- ⛪ Kirke
- 🎨 Utstillinger

**Steg 2 — Dag:**
Hvilken dag?
- Man 28. jul – Søn 3. aug (+ "Hele festivalen")

**Steg 3 — Tid på dagen (multi-select):**
Når er du ledig?
- ☀️ Formiddag (før 12:00)
- 🌤️ Ettermiddag (12:00–17:00)
- 🌙 Kveld (etter 17:00)
- 📅 Hele dagen

### 4. Inngang: Bottom sheet (mobil-først)
- Glir opp fra bunnen ved første besøk
- Kartet er synlig bak — brukeren ser venues i Trondheim
- Steg-for-steg med progresjon (1 av 3, 2 av 3, 3 av 3)
- Skip-CTA: "Utforsk fritt →"
- Etter svar → bottom sheet animerer ned, Kompass-tab er aktiv

### 5. Output: To-tab sidebar med tidslinje

**Tabs** (over POI-lista):

| Tab | Innhold | Når aktiv |
|-----|---------|-----------|
| **🧭 Kompass** | Anbefalte events i tidslinje, kronologisk | Default etter Kompass-flyt |
| **Alle events** | Vanlig Explorer-liste med alle events | Default hvis bruker skipper |

**Kompass-tab: Tidslinje-visning**
```
● 14:00
│ Vestfrontmøtet: KAMPEN FOR TILVÆRELSEN
│ Vestfrontplassen · Samtale · Gratis
│
● 15:00
│ THE HERDS – THE OLD WAYS
│ Vestfrontplassen · Konsert · Gratis
│
● 17:00
│ Første Olsokvesper
│ Nidarosdomen · Kirke · Gratis
│
● 19:00
│ FLUKT – Nidaros Vokal
│ Nidarosdomen · Konsert · 520,-
```

- Vertikal tidslinje med event-kort langs linjen
- Viser tid, tittel, venue, kategori, pris
- Anbefalte events fremhevet også på kartet (glow/annen farge)

### 6. Tab-veksling
- **Skipper Kompass →** Begge tabs synlige, "Alle events" aktiv, Kompass-tab inviterer til spørsmål
- **Svarer på Kompass →** Begge tabs synlige, Kompass aktiv med tidslinje
- Kan alltid bytte fritt mellom tabs

### 7. Anbefaling, ikke filtrering
Kompass-svarene påvirker:
- **Utvalg i Kompass-tab:** Kun relevante events (matching tema + dag + tid)
- **Kronologisk plan:** Sortert etter starttid
- **Visuell vekting på kart:** Anbefalte events fremhevet

Men: **alle events er alltid tilgjengelige** i "Alle events"-tab.

---

## Olavsfest — Festivaldata (2025, brukes som prototype)

**Nettside:** https://olavsfest.no/program/?aar=2025
**Datoer:** 28. juli – 3. august 2025 (+ noen forevents i april/desember)
**Totalt:** 222 events
**Tema 2025:** "Flukt"

### Kategorier (fra nettsiden)
| Kategori | Antall (ca.) | Eksempler |
|----------|-------------|-----------|
| Forestilling/Konsert | ~40 | Astrid S, Thåström, Sivert Høyem, Lisa Tønne, Nils Bech |
| Snakk/Samtale | ~35 | Vestfrontmøtet, Kompass-serien, Adressa-samtalen, seminarer |
| Folkeliv | ~50 | Byvandringer (6 ulike ruter), Olavsmarkedet, Bifrons-fester |
| Kirke | ~30 | Høymesser, pilegrimsmesser, vesper, Olavsvaka, drop-in-dåp |
| Familiearrangement | ~20 | Kongsgården, Skip O'Hoi!, Blåmåka, Oh Snap!, Street Art |
| Utstilling | ~15 | Harald Henden foto, Gopher Wood, It's Good To Have Friends |

### Venues (geokodes)
| Venue | Type | Antall events |
|-------|------|--------------|
| Nidarosdomen | Katedral | ~30 |
| Vestfrontplassen | Utescene | ~15 |
| Ytre Kongsgård | Uteareal | ~40 |
| Borggården | Konsertarena | ~5 |
| Vår Frue kirke | Kirke | ~8 |
| Nye Hjorten Teater | Teater | ~5 |
| Britannia Hotel | Hotell | ~7 |
| Kirkehagen | Hage | ~10 |
| Prinsen kino | Kino | ~10 |
| Domkirkeparken | Park | ~7 |
| Trondhjems Kunstforening | Galleri | ~8 |
| Bifrons | Bar | ~6 |
| KFUK-KFUM | Lokale | ~3 |
| Erkebispegården | Museum | ~2 |

### Priser
- **Gratis:** ~60% av events
- **150-220 kr:** Kino, byvandringer, kunstterapi
- **350-585 kr:** Konserter i kirker
- **695 kr:** Borggården-konserter (hovedkonserter)

### Datakvalitet
- Alle events har dato og starttid
- De fleste har sluttid
- Venue er konsistent navngitt
- Kategorier matcher nettsidens filter (6 kategorier)
- Billettpris tilgjengelig for de fleste

---

## Pitch: Tre lag med verdi for Olavsfest

### 1. Erstatter informasjonsbehovet
> "Dere har 222 events over 7 dager. Besøkende er overveldet. I dag løser dere det med frivillige i infotelt, et PDF-program, og en filtrerbar nettside. Hva om hver besøkende fikk sitt eget personlige program — basert på hva de liker og når de er ledige?"

### 2. Økt oppdagelse
> "De fleste går på konsertene de kjenner. Men dere har 222 events. Kompass matcher besøkende med byvandringer, samtaler og utstillinger de IKKE visste om. Jevnere fordeling, mer engasjement, færre tomme saler."

### 3. Data og innsikt
> "I dag vet dere hvem som kjøper billett. Men ikke hvorfor. Kompass gir dere: hvilke temaer som trender, når besøkende er mest aktive, hva familier vs par velger, hvilke events som 'oppdages' vs allerede er kjent. Denne innsikten gjør 2027-programmet bedre."

---

## Teknisk: Hva finnes allerede

| Komponent | Status | Gjenbruk |
|-----------|--------|----------|
| Event-data i POI-er (dato, tid, tags) | ✅ Ferdig | Direkte |
| Day filter (useEventDayFilter) | ✅ Ferdig | Gjenbruk for dag-steg |
| WelcomeScreen med tema-selector | ✅ Ferdig | Inspirasjon for bottom sheet |
| Explorer POI-kort med event-visning | ✅ Ferdig | Gjenbruk i begge tabs |
| Mapbox kart med markører | ✅ Ferdig | Legg til highlight-styling |
| Bransjeprofil med features-flagg | ✅ Ferdig | Legg til `kompass: true` |
| Arendalsuka-importer | ✅ Ferdig | Mønster for Olavsfest-importer |

**Nytt som må bygges:**
1. **Olavsfest-importer** — scrape WordPress-programsiden, lag POI-er
2. **Kompass bottom sheet** — 3 steg, steg-for-steg, skip-CTA
3. **Tab-komponent** — "🧭 Kompass" / "Alle events" over POI-liste
4. **Tidslinje-visning** — kronologisk event-liste med vertikal linje
5. **Filtreringslogikk** — tema + dag + tid → utvalgte events
6. **Kart-highlight** — visuell differensiering av anbefalte events
7. **Kompass-state** — Zustand: svar, aktiv tab, anbefalte POI-er

---

## Åpne spørsmål

- "Del din plan"-funksjon? (URL med Kompass-filtre bakt inn)
- Gangavstand mellom venues i anbefalingene?
- Analytics på Kompass-svar fra dag 1, eller fase 2?
- Skal bottom sheet-designet være generisk (gjenbrukbart for eiendom) eller event-spesifikt?
- Hva vises i Kompass hvis ingen events matcher?
- Skal Kompass vise pris-info? (gratis-badge vs. betalte events)

---

## Fremtidige vertikaler (ikke i scope nå)

**Eiendom (on-site visning):**
- Har du barn? Hva er viktig? Hvordan reiser du?
- → Personalisert Explorer for boligkjøpere

**Hotell (turist):**
- Hva er du i humør for? Hvor lenge? Hvem er du med?
- → Personlig dagstur med verifiserte POI-er

---

## Neste steg

Kjør `/workflows:plan` for implementeringsplan.
