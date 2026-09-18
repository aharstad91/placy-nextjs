# Valideringsrapport — Leangenbukta U5/U6

Kjørt: 18.09.2026. Resultat: **kuratert research, mekanisk runtime-validering og nettleserprøve bestått**. Faktisk lydprøve føres separat i U7.

## Dekning

| Kontroll | Resultat | Detalj |
|---|---|---|
| Prosjektpåstander | bestått | 565 av 565 vurdert: 78 godkjent, 46 godkjent tidsfølsom, 397 uavklart, 33 avvist, 11 historisk |
| Godkjente prosjektpåstander i runtime | bestått | 124 av 124 representert i `topics.json` |
| Nabolagskandidater | bestått | 145 av 145 har eksplisitt beslutning |
| Kandidatbeslutninger | bestått | 25 startsteder, 30 medlemmer, 43 tema, 6 eksterne referanser, 33 utsatt, 8 utelatt |
| Kjøperspørsmål | bestått | 35 av 35 ligger separat i `conversations.json`; 28 faktiske kategorisvar og 6 prosjektspørsmål ligger i FAQ |

## Runtime

| Kontroll | Resultat | Detalj |
|---|---|---|
| Valgte steder | bestått | Alle 55 valgte kandidater importert, pluss LadeTorget som ett dokumentert strukturanker |
| Ankerhierarki | bestått | 26 synlige ankre og 30 medlemmer; medlemmer lager ikke doble markører |
| Kilder | bestått | 58 runtime-kilder; hvert sted har minst én kilde |
| Koordinater | bestått | 56 av 56 har kontrollkvittering; omtrentlig plassering har synlig inngangsforbehold |
| Reisetider | bestått | Mapbox Matrix har målt gange, sykkel og bil fra boardets startpunkt til alle 26 synlige ankre |
| Rårapportgrense | bestått | `_build_runtime.py` leser ikke rårapportene |
| Uavklart/avvist prosjektinnhold | bestått | Ingen ikke-godkjent `approved_copy` finnes, og bare de 124 godkjente kopiene importeres |
| Samtalegrense | bestått | `loadDataset` laster ikke `conversations.json`; avbruddsscenarier er ikke FAQ eller faktakunnskap |
| Kjente korreksjoner | bestått | Fresh Fitness og naboplanens torg er ikke aktive steder; SFO- og Leo-tider kommer fra revidert materiale |

Kontrollene kjøres i `lib/demo/local-board/leangenbukta-content.test.ts`. Struktur, referanser og ankeratferd dekkes i tillegg av `leangenbukta.test.ts`, `shopping-centres.test.ts` og `anchor-poi.test.ts`.

## Nettleser

Desktop og responsiv mobil er kontrollert i Chrome mot den lokale utviklingsserveren. Nettside-CTA åpner `/demo/leangenbukta-lokal`; velkomst, åtte temaer, 26 kartankre, prosjekt-FAQ, kategori-FAQ, kartpunkt, anker med medlemmer, detaljkilde, inngangsforbehold og målt reisetid for gange, sykkel og bil er prøvd. Mobilvisningen bruker bunnark og skjuler tom `Steder (0)`-fane for den faktabaserte prosjektkategorien. Live-inspeksjonen er dokumentert i `validation.md`.

## Gjenstående sluttgater

- Faktisk lydprøve mot Anja for prosjektstatus, uavklart skolekrets, et konkret sted, spørsmål uten dekning og avbrudd/fortsettelse.
- Tidsfølsomme åpningstider, priser, program og byggefremdrift må oppfriskes dersom demoen brukes etter kontrolldatoen.
