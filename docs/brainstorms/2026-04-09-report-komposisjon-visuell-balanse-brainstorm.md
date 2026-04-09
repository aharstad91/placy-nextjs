---
title: Report komposisjon og visuell balanse
date: 2026-04-09
type: brainstorm
---

# Report komposisjon og visuell balanse

## Hva vi bygger

Visuell balanse mellom innholdsseksjonene og kartet i Report. Kartet er for hoyt i forhold til de korte tekstseksjonene. Vi trenger mer innhold, luft og visuelle elementer for a skape en god komposisjon.

## Hvorfor

Etter merge av Story-tekst inn i Report er hver kategoriseksjon bare narrativ tekst — kortere enn for (da POI-grid tok mye plass). Kartet dominerer og det mangler visuell tilhorighet mellom hva du leser og hva kartet viser.

## Nokkelbesluninger

### 1. Kart-hoyde: reduseres til ~60vh
- Start med 60vh, juster visuelt
- Gir plass til metadata-panel under kartet
- Kartet supplementerer, ikke dominerer

### 2. Kart-metadata panel
- Vises under (eller over) kartet
- Innhold: aktivt tema-navn, antall markorer, avstandsindikator
- Gir kontekst til hva brukeren ser pa kartet

### 3. Tema-separator med ikon
- Visuell separator mellom seksjoner (som Story hadde)
- Horisontal linje med tema-ikon i sirkel i midten
- Gir luft og visuell rytme

### 4. Data-drevet oppsummering per kategori
- Generiske stats-bokser fungerte ikke for (bruker testet tidligere)
- Losning: auto-generert oppsummering fra POI-data, spesifikk per tema
- Format: 2-3 konkrete datapunkter i en kompakt boks
- Eksempler:
  - Hverdagsliv: "3 dagligvarer innen 5 min | Naermest: Coop Mega (3 min) | 12 steder totalt"
  - Barn: "Skolekrets: Eberg (1-7) | Ungdomsskole: Blussuvoll | 23 barnehager"
  - Transport: "Buss hvert 10. min | 2 km til NTNU | Bysykkel pa Moholt"
- Datapunktene er kategori-spesifikke, ikke generiske (ulik logikk per tema)
- Genereres automatisk fra POI-data (antall, avstand, navn pa naermeste)

### 5. Okt spacing mellom seksjoner
- Mer padding/margin mellom tema-seksjoner
- Kombinert med separator gir dette bedre visuell rytme

### 6. Bilder planlegges separat
- Stasjonskvartalet (Adressa Studio) har bildemateriale og video
- Bilde-pipeline (upload, lagring, kobling til tema) er storre scope
- Gjores som egen oppgave etter layout-fix

## Apne sporsmal
- Skal kart-metadata panelet vare over eller under kartet?
- Skal kategori-innsikten genereres automatisk fra data, eller skrives manuelt i reportConfig?
- Skal reisetid-sjekker-komponenten gjores storre i transport-seksjonen?
