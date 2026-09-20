# Demoprøve — Leangenbukta lokalboard

Kjørt 18.09.2026 mot lokal utviklingsserver i Chrome. Kontrolldatoen for faginnholdet er 18.09.2026.

## Resultat

| Flate | Kontroll | Resultat |
|---|---|---|
| Nettside | CTA fra `/demo/leangenbukta-nettside` åpner `/demo/leangenbukta-lokal` | Bestått |
| Velkomst | Leangenbukta-identitet, intro og inngang til boardet | Bestått |
| Desktop | Åtte temaer, 360 kartankre totalt, kategori, kartpunkt, detalj og FAQ | Bestått |
| Mobil | Responsivt bunnark, kategori, detalj, FAQ og reisemåter | Bestått |
| Prosjektfakta | Prosjektkategorien viser seks svar uten tom stedsoverskrift eller `Steder (0)` | Bestått etter retting |
| Anker/medlem | Lade Arena viser fire medlemmer uten doble kartmarkører | Bestått |
| Servering | Fyr på Lade, Franske Nytelser og Burger King Lade Arena vises som egne markører i Servering | Bestått etter retting |
| Proveniens | Detaljkort viser kilde, kontrolldato og omtrentlig inngang der det gjelder | Bestått |
| Reisetid | Gange, sykkel og bil viser målte Mapbox-tider for de 27 reviderte ankrene | Bestått |
| Tale | Faktisk mikrofon-/lydprøve mot Anja | Ikke kjørt |

Desktop ble prøvd i et faktisk Chrome-vindu på omtrent 1110 × 768. Mobiltilstanden ble fremprovosert ved å redusere samme vindu til responsiv smal bredde; skjermbildet var omtrent 677 piksler bredt. Inspeksjonen ble gjort direkte med Computer Use og bildene ligger i sesjonsbeviset, ikke som filer i repoet.

## Funn rettet under prøven

Prosjektkategorien har faktasvar, men ingen kartsteder. Den ble derfor feilaktig merket «Ingen steder ennå» og viste stedsnavigasjon uten innhold. `StoryThemeGrid` viser nå antall svar for en faktabasert kategori, og `StoryCard` skjuler tom stedsoverskrift og mobilfanen `Steder (0)`. En komponenttest låser oppførselen.

Fyr på Lade og Franske Nytelser var importert som medlemmer under handelsbygg, mens Burger King var medlem under Lade Arena. Alle tre var derfor søkbare, men navnene var ikke egne markører. Importen har nå en eksplisitt konfigurasjon for kilde-ID-er som skal fristilles eller kobles til et revidert sted. Etter full reload viste Chrome alle tre som egne markører i Servering, uten duplikat av Burger King.

## Mekaniske sjekker

- `npm test`: 283 testfiler og 4 496 tester bestått.
- `npm run lint`: 0 feil; 53 eksisterende advarsler.
- `npx tsc --noEmit`: bestått.
- `npm run build`: bestått. Bygget logget forventet dynamisk serverbruk for adminrutene, men fullførte og genererte rutene.
- `git diff --check`: bestått.

## Åpen sluttgate

En faktisk lyttesamtale skal dekke prosjektstatus, uavklart skolekrets, et konkret sted, et spørsmål uten dekning og avbrudd/fortsettelse. Mekaniske kunnskapstester og klikkflyt er allerede bestått; de erstatter ikke denne lydprøven.
