---
date: 2026-04-09
topic: nabolagets-sjel
---

# Nabolagets Sjel — opplevelser og byrom i Report

## Hva vi bygger

En ny seksjon i Report — "Bli kjent med nabolaget" — plassert etter heroIntro og før temaene. Viser 5-8 kuraterte signatursteder som definerer nabolagets identitet og livsstil. Ikke praktiske tjenester (dagligvare, skole), men opplevelser og byrom som gir nabolaget sjel.

Inspirert av Stasjonskvartalet i Trondheim som viser 13 slike steder uten en eneste Google Places-typisk POI.

## Hva slags steder

**Opplevelser** — steder du gjør noe spesielt:
- Badstuer, sjøbad
- Gallerier, atelierer
- Teaterscener, uavhengige kinoer
- Matmarkeder, bondemarked
- Bryggerier med taproom
- Bokhandlere med kafé

**Byrom & landemerker** — steder som definerer nabolaget:
- Torg, plasser folk samles
- Promenader, turveier med karakter
- Historiske bygg, vernede strukturer
- Utsiktspunkter
- Bekkedrag, vannspeil, broer
- Skulpturer, street art, muraler

## Plassering i rapport

**Alternativ C (valgt):** Eget lag over temaene — en "Bli kjent med nabolaget"-seksjon etter heroIntro. Tversgående, ikke kategori-spesifikt. Setter tonen for resten av rapporten.

Forkastet: (A) eget 8. tema — for snevert; (B) vev inn i eksisterende temaer — mister samlet effekt.

## Kilder for innhenting

Nytt steg i `/generate-bolig`-pipelinen:

1. **OpenStreetMap/Overpass** — byrom, landemerker, historiske bygg, skulpturer, promenader. Tags: `tourism=artwork`, `historic=monument`, `leisure=sauna`, `amenity=marketplace`, `tourism=viewpoint`, `waterway=stream`, etc.
2. **WebSearch** — lokale opplevelser, skjulte perler, bloggomtaler. Søk: "{strøk} opplevelser", "{strøk} badstu galleri", "{bydel} street art skulptur".
3. **Kvalitetssikring** — alle funn research-verifiseres og kurateres manuelt. Maks 5-8 steder per prosjekt.

Fremtidige kilder (ikke nå): TripAdvisor (krever API-avtale), Facebook Places (vanskelig API).

## Forretningsverdi

Dette er innhold meglere ikke nødvendigvis vet om selv. Det er lokal innsikt som:
- Differensierer Placy fra konkurrenter
- Gir S&J-nivå fortelling (livsstil > serviceliste)
- Bygger på kunnskapsbasen (place_knowledge per strøk)
- Er vanskelig å kopiere — kumulativ, kuratert, lokal

## Nøkkelbeslutninger

- **Plassering:** Over temaene, egen seksjon
- **Innholdstype:** Opplevelser + byrom (ikke fremtidsprosjekter)
- **Kilder:** Overpass + WebSearch (pipeline-steg)
- **Antall:** 5-8 kuraterte steder per prosjekt
- **Kvalitet:** Alle steder WebSearch-verifisert før inkludering

## Test: Brøset-området (2026-04-09)

Testet Overpass + WebSearch mot Brøset. Resultat:
- **Overpass:** 144 treff, men mest sentrum-nære (skulpturer, gallerier, teater). Hyperlokal dekning svak.
- **WebSearch:** Fant 6-8 reelle signatursteder — Burmaklippen, Estenstadhytta, Kuhaugen Utkikkskiosk, Moholt Allmenning, Estenstaddammen, Brøsetrunden. Brøsets sjel = natur + grønn livsstil.
- **Innsikt:** Forstadsområder har færre slike perler enn sentrum. API-er alene gir ikke nok — WebSearch er nødvendig.

## Viktig innsikt: Megler-intervju som kilde

Lokalkunnskapen som virkelig differensierer (de små kafeene, den skjulte stien, samlingspunktet bare naboene kjenner) er ofte ikke googelbar. En mulig fremtidig kilde:
- **Intervju megleren** ved onboarding — "hva er de 5 stedene du alltid nevner for dette nabolaget?"
- Lagre i place_knowledge per strøk
- Validere og berike via WebSearch etterpå

Dette gjør kunnskapsbasen til en ekte moat — kumulativ, lokal, vanskelig å kopiere.

## Test: Stasjonskvartalet / Sentrum (2026-04-09)

Testet 13 steder fra Stasjonskvartalets markedsføring mot automatiske verktøy:
- **Fullt discoverable:** 6/13 (Sentralstasjon, Torget, Solsiden, Nye Hjorten, Tollbua, Sjøgangen)
- **Delvis (WebSearch):** 3/13 (Stu badstu, Sjøbadet, Midtbyen)
- **Ikke discoverable:** 4/13 (Raft spiseri, Blussuvollminden, Fjordstjernpromenaden, Lillealleriet)

**31% usynlig for alle verktøy — selv i sentrum.** Navnmismatch ("Tollboden" vs "Tollbua"), fremtidige steder, og hyperlokal kunnskap er hovedårsakene.

## Konklusjon

Automatisering (Overpass + WebSearch) gir ~70% av stedene. De siste 30% — som ofte er de mest interessante — krever lokal kunnskap. To veier videre:

1. **Pipeline-steg for grunnlaget:** Overpass + WebSearch finner 6-9 kandidater automatisk
2. **Megler-intervju for gullet:** "Hva er de 5 stedene du alltid nevner?" → lagres i place_knowledge per strøk

## Status

**Parkert.** Konseptet er validert med to tester (forstad + sentrum). Ikke klart for pipeline-automatisering ennå — krever hybrid tilnærming (automatikk + manuell kuratering). Ta opp igjen når megler-onboarding designes.
