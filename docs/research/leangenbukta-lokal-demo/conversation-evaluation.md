# Samtaleevaluering — Leangenbukta U6

Kontrolldato: 2026-09-18.

Dette er innholds- og testgrunnlaget for de godkjente svarene. U4-runtime finnes nå, og alle 35 scenarioene valideres strukturelt i `leangenbukta-content.test.ts`. Klikkflyten er kontrollert på desktop og mobil. Faktisk lydprøve mot Anja og avbrudd/fortsettelse må fortsatt dokumenteres separat.

## Resultat

| Kategori | Bredt | Sted | Oppfølging | Uten dekning | Avbrudd/fortsettelse | Innhold | Runtime |
|---|---|---|---|---|---|---|---|
| Natur | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |
| Transport | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |
| Hverdag | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |
| Oppvekst | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |
| Servering | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |
| Trening | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |
| Opplevelser | bestått | bestått | bestått | bestått med kunnskapshull | spesifisert | **5/5** | mekanisk bestått |

## Kontrollerte egenskaper

- Svarene bruker ikke beregnet avstand, reisetid eller rangering.
- Spørsmål uten dekning gir et konkret kunnskapshull og neste kontrollhandling.
- Medlemmer under kjøpesentre og idrettsanlegg lager ikke doble kartmarkører.
- Steder som går igjen på tvers av kategorier bruker samme kanoniske ID.
- Feil plan, utløpte arrangementer og varslet nedlagt virksomhet blir ikke presentert som aktive tilbud.
- Tidsfølsomme tider og priser er merket for oppfriskning.

## Gjenstående lydprøve

Et representativt utvalg av de 35 scenarioene skal kjøres mot Anja. Prøven må dokumentere muntlig svar, valgt handling, kartresultat, kildegrunnlag og om avbrudd kan fortsette fra riktig sted. Mekanisk runtime-validering er bestått; lyd er en egen sluttgate.
