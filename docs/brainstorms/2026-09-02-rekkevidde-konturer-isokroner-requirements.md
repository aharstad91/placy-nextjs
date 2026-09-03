# Rekkevidde-konturer på boardet (isokroner) — requirements

**Dato:** 2026-09-02
**Kilde:** Andreas, sparring med skjermbilde fra hjem.no («Områdeprofil», 5/10/20/30 min
fargelag) mot Wesselsløkka-boardet i satellittmodus.
**Status:** Brainstorm landet. Klar for `/ce-plan`. Scope ratifisert her.

---

## Hva vi vil ha

Boardet skal kunne vise **hvor langt man kommer fra boligen på 5, 10 og 15 minutter**
med den valgte reisemåten (til fots / sykkel / bil), som prikkede konturer på kartet.
Det er et **visningsvalg** brukeren slår på, ikke et permanent lag.

Andreas: «Jeg ser klart et behov for å kunne definere noe lignende som det i bildet.
Jeg ser ikke helt problemet med å visualisere det greit nok heller — jeg synes hjem.no
tar helt av.»

## Hvorfor

- Boardet svarer i dag «hva ligger 7 min unna» per sted (liste + minutt-kolonne), men
  ikke «hvor stort er nabolaget mitt til fots». Konturen er det romlige svaret på det
  spørsmålet, og det er spørsmålet en boligkjøper faktisk stiller seg.
- FINNs Nabolagsprofil har ikke dette. hjem.no har det, men som fire fargelag som
  dekker hele kartet og skjuler stedene. Vi kan gjøre det bedre ved å gjøre mindre.
- Det er billig: dataene finnes hos samme leverandør som allerede gir oss reisetidene.

## Hva som finnes i dag

- `lib/pipeline/travel-times.ts` beregner gangtid/sykkel/bil per POI fra prosjekt-origo
  via Mapbox Matrix ved provisjonering. Lagres i `v2.project_pois.travel_times`.
- Boardet har reisemåte-veksler (`travelMode` i `board-state.tsx`, bæres på tvers av
  kategorier) og motorveksler Kart / Satellitt / 3D nederst.
- `TimeBudget = 5 | 10 | 15 | 20 | 30` finnes i `lib/types.ts` men er **ikke i bruk på
  boardet** i dag. Konseptet er der, flaten mangler.
- Brainstorm 2026-08-03 (mobil nabolagsflate) noterte eksplisitt «isokron finnes ikke»
  som en begrensning for kamera-ramming av «~10 min gange». Dette dokumentet løser den.

## Requirements

### R1 — Beregning skjer i pipelinen, aldri ved render
Mapbox Isochrone API kalles i et nytt provisjonssteg ved siden av reisetid-steget.
Ett kall per profil (walking / cycling / driving) med `contours_minutes=5,10,15`.
Tre kall per prosjekt. Resultatet (GeoJSON-polygoner) lagres per prosjekt og leses
ved render. Ingen runtime-kall (CLAUDE.md-regelen). Fail-soft som reisetid-steget:
mangler konturene, skjules visningsvalget.

### R2 — Én kilde for reisetid og kontur
Konturene og POI-reisetidene kommer fra samme Mapbox-veinett. Det gir konsistens:
et sted med `travelTime.walk = 7` skal ligge innenfor 10-minutt-konturen. Dette er et
akseptansekriterium som skal testes på minst ett provisjonert board, ikke antas.

### R3 — Visningsvalg, ikke default
Konturene er av som standard. Brukeren slår dem på i kartkontrollen nederst (samme
familie som Kart / Satellitt / 3D). Valget huskes innenfor sesjonen, på tvers av
kategorier, som `travelMode` gjør i dag.

### R4 — Følger reisemåten
Bytter brukeren fra til fots til sykkel, bytter konturene til sykkel-polygonene.
Ingen ekstra valg for brukeren. Reisemåte-veksleren er allerede kontrakten.

### R5 — Prikkede konturer, ikke fyll
Tre prikkede linjer (5 / 10 / 15), ingen fargeflater. Stedene under skal være like
lesbare med konturene på som av. Den innerste kan være tydeligst og de ytre svakere,
men ingen skal konkurrere med pinnene. hjem.no-varianten (fire fargelag) er eksplisitt
forkastet.

### R6 — Fungerer i begge motorer
- Mapbox 2D (Kart / Satellitt): line-lag med `line-dasharray`.
- Google 3D: `gmp-polygon-3d` drapes på terrenget. Prikket kant støttes ikke der, så
  det aksepteres tynn heltrukket kant eller svakt fyll uten kant. Samme av/på-valg og
  samme reisemåte-kobling gjelder i begge motorer.

### R7 — Etikett per kontur
Hver kontur får en liten etikett («5 min», «10 min», «15 min») på ett punkt langs
linjen, så leseren ikke må gjette hvilken som er hvilken. Etiketten skjules ved lav
zoom hvis den kolliderer med pinner.

### R8 — Måles
Av/på og reisemåte-bytte med konturer på logges som hendelse (Innsikt / Moat 2), på
linje med `faq_opened`. Vi vil vite om folk faktisk bruker det før vi bygger videre
på det.

## Deferred to Separate Tasks

- **Kamera-ramming etter kontur** («vis meg 10 min til fots» som kamerabounds). Løses
  naturlig når konturen finnes, men er et eget kamera-arbeid på 3D-motoren, som i dag
  har kjente hull. Tas opp i omvisning/kamera-sporet.
- **Kontur-filtrering av listen** (skjul steder utenfor valgt kontur). Boardet
  filtrerer alt på reisetid per sted; konturen tilfører ikke ny informasjon der.
  Vurderes hvis R8 viser bruk.
- **Kollektiv-kontur.** Mapbox Isochrone støtter ikke kollektiv. Entur har ingen
  isokron-API. Krever egen motor (OpenTripPlanner/Valhalla) og er ikke verdt det nå.
- **20/30 min.** `TimeBudget` har dem, men for til fots er 15 min nabolagets grense.
  Bil-konturen på 15 min dekker mer enn nok. Legges til bare hvis en kunde spør.

## Åpne spørsmål til plan-fasen

- Lagringssted: egen kolonne på prosjektet i v2, eller inn i `products.config` ved
  siden av grounding? Plan avgjør; polygonene er små (tre profiler × tre konturer).
- Re-provisjonering: konturene må bustes på samme flate som reisetidene, jf.
  memory-notatet om cache-bust ved re-provisjonering.
- Hvordan visningsvalget ser ut i kartkontrollen på mobil, der plassen nederst alt er
  brukt av reisemåte + motor.
