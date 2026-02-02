# Hotell Explorer — Konkurransevalidering & Gap-analyse

**Dato:** 2026-02-02
**Trigger:** Scandic Hotels har lansert "Opplevelser i nærheten" på sine hotellsider
**Status:** Brainstorm
**Neste steg:** Lage Scandic Nidelven-demo, deretter salgspitch

---

## Hva vi oppdaget

Scandic Hotels har bygget en **"Opplevelser i nærheten"**-seksjon inn i sine hotellsider. Dette er i praksis en **Explorer Mega Lite** — en forenklet nabolagsoversikt med kart.

**URL:** `scandichotels.com/no/hotell/scandic-nidelven?view=map#overview`

### Hva Scandic har bygget

- Venstre sidebar med POI-er gruppert i kategorier:
  - **Sted** (Trondheim 0 km, Værnes 31 km)
  - **Attraksjoner** (Olavshallen 0.2 km, Rockheim 0.8 km, Nidarosdomen 2.2 km, etc.)
  - **Shopping & spisesteder** (Solsiden 0.2 km)
  - **Offentlig transport**
- Google Maps til høyre med hotellmarkør + kategori-ikoner
- "Lukk kartet"-knapp (toggle-bart)
- Kun navn + avstand i km per POI
- Ingen filtrering, ingen ruting, ingen editorial, ingen interaktivitet utover kart-pan/zoom

---

## Konkurranseanalyse: Norske hotellkjeder

| Kjede | Nabolags-feature | Detaljnivå |
|-------|-----------------|------------|
| **Scandic** | Kategorisert POI-liste + Google Maps | Middels — kategorier, avstand, kart. Men statisk og basic. |
| **Strawberry** (tidl. Nordic Choice) | Ingenting | Bare generell destinasjonsbeskrivelse i fritekst. |
| **Thon Hotels** | Minimal | "300m til togstasjonen"-type tekst. Enkel "Vis på kart"-lenke. |
| **Radisson** | Ingenting eget | Stoler helt på TripAdvisor/Hotels.com for nabolagsinfo. |

**Konklusjon:** Scandic er den eneste som har investert i dette. De andre har ingenting. Selv Scandic sin løsning er ekstremt basic.

---

## Gap-analyse: Scandic vs Placy Explorer

| Feature | Scandic | Placy Explorer | Gap |
|---------|---------|---------------|-----|
| **POI-kategorier** | 4 faste kategorier | Dynamiske kategorier, pakke-presets, brukervalg | Placy vinner |
| **Avstandsinfo** | Km (fugleveien) | Faktisk gangtid/sykkeltid/kjøretid via Mapbox Directions | Placy vinner stort |
| **Transportmodus** | Ingen | Walk/bike/car med rutebregning | Placy vinner |
| **Tidsbudsjett** | Ingen | 5/10/15 min — filtrer/dimm POI-er etter avstand | Placy vinner |
| **Kartløsning** | Google Maps (basic) | Mapbox GL JS (interaktivt, stilbart, performant) | Placy vinner |
| **Redaksjonelt innhold** | Ingen — bare navn + avstand | editorialHook, localInsight per POI | Placy vinner stort |
| **Geolokasjon** | Nei | GPS med sanntidsoppdatering | Placy vinner |
| **Samlinger** | Nei | Lagre og del POI-samlinger | Placy vinner |
| **Mobil UX** | Responsiv tabell | Native bottom sheet, optimert touch | Placy vinner |
| **Google-data** | Nei (ironisk nok) | Rating, antall anmeldelser, åpningstider | Placy vinner |
| **Kollektivtransport** | Statisk liste | Sanntid via Entur API | Placy vinner |
| **Bysykkel** | Nei | Sanntid ledige sykler via GBFS | Placy vinner |
| **Design** | Standard Scandic-styling | Glassmorphism sidebar, branded, stilbart | Placy vinner |

**Placy Explorer vinner på 13/13 kategorier.** Scandic har i praksis bygget det vi ville kalt en MVP fra 2018.

---

## Salgspitch-argumenter

### 1. "Dere har allerede bestemt at dette er viktig"
Scandic har brukt utviklerressurser på å bygge dette inn i sine sider. Det betyr at de ser verdi i å vise nabolaget. Men løsningen deres er statisk, utdatert, og gir gjestene minimal verdi.

### 2. "Gjestene deres fortjener bedre"
En gjest på Scandic Nidelven som lurer på "hva er innen 10 minutters gange?" kan ikke få svar. De ser bare en liste med km-avstander. Placy Explorer svarer på dette spørsmålet direkte — med faktiske gangtider, kategorier, og redaksjonelt innhold.

### 3. "Placy er plug-and-play"
Ingen intern utvikling nødvendig. Placy leverer en ferdig Explorer-instans per hotell, med kurert innhold og oppdaterte data. Enkel URL-integrasjon eller iframe-embed.

### 4. "Bedre enn Google Maps"
Scandic bruker Google Maps som er generisk for alle. Placy er kurert og redaksjonelt — kun relevante POI-er for hotellets gjester, med lokale tips og innsikt.

### 5. "Data dere ikke har"
Sanntid kollektivtransport (Entur), ledige bysykler (GBFS), faktiske reisetider — dette er data Scandic sin statiske liste aldri kan tilby.

---

## Demo-plan: Scandic Nidelven

### Mål
Lage en Placy Explorer-instans for Scandic Nidelven-lokasjonen for å vise direkte sammenligning.

### Innhold
- **Senterpunkt:** Scandic Nidelven (Havnegata 1-3, Trondheim)
- **POI-er:** Samme steder som Scandic viser + flere relevante
  - Olavshallen, Rockheim, Pirbadet, Munkholmen, Nidarosdomen, Kristiansten Festning, Lerkendal, Tyholttårnet
  - Solsiden (shopping/mat)
  - Trondheim S (tog), Værnes-buss
  - Utvidelse: Bakklandet, Ravnkloa, Torvet, Baklandet Skydsstation, etc.
- **Redaksjonelt:** editorialHook og localInsight per POI
- **Kategori-pakke:** "Hotellgjest"-preset med relevante kategorier

### Leveranse
- Ferdig URL: `placy.no/scandic/nidelven` (eller lignende)
- Screenshots for pitch-deck: side-by-side Scandic vs Placy
- Evt. kort video-walkthrough

---

## Nøkkelbeslutninger

1. **Konkurransevalidering bekreftet** — Scandic har bygget dette, men basic. Andre kjeder har ingenting.
2. **Demo-hotell valgt** — Scandic Nidelven for direkte sammenligning
3. **Fokus er gap-analyse + salgspitch** — ikke ny produktvariant, men bevis på at Explorer allerede er overlegen
4. **Placy vinner på alle 13 sammenlignede features**

---

## Åpne spørsmål

- Hva er riktig prispunkt for hotellkjeder? Per hotell, per kjede, per region?
- Bør vi tilby en "lite"-variant (lavere pris, færre features) eller alltid full Explorer?
- Hvem er beslutningstaker hos hotellkjedene? Digital-avdeling, markedssjef, hotelldirektør?
- Skal demoen være et faktisk prosjekt i Placy-appen eller en standalone presentasjon?
