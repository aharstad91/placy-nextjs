# docs/strategy/

Forretnings- og produktstrategi for Placy. Lever på tvers av sesjoner — i motsetning til `docs/brainstorms/` som er for tekniske feature-brainstorms.

## Hva som hører hjemme her

- **Sporvalg**: Hvilke spor vi forfølger (eiendom/Propr, events, hotell), hvordan de prioriteres mot hverandre, og når et spor parkeres eller pivoteres.
- **Forretningsmodell**: Prismodell, distribusjonsmodell, hvem betaler hva.
- **Go-to-market**: Hvilke kunder vi pitcher, i hvilken rekkefølge, og med hvilket tilbud.
- **Aktørrelasjoner**: Hvem er bekjente, hva er deres rolle, hva har de sett av Placy.
- **Strategiske beslutninger**: Pivots, nye spor, parkering av spor — datert og begrunnet.

## Hva som *ikke* hører hjemme her

- Tekniske feature-brainstorms → `docs/brainstorms/`
- Implementeringsplaner → `docs/plans/`
- Dokumenterte løsninger på problemer → `docs/solutions/`
- Salgs-pipeline med stages → Trello "Demo Pipeline" / "Utvikling"

## Filstruktur

| Fil | Type | Oppdateres når |
|---|---|---|
| `LOG.md` | Kronologisk strategi-loggbok | Etter strategi-sesjoner, salgs-/kunde-møter, sporvalg, prising-endringer, eller validering/falsifisering av strategisk hypotese. Korte entries med peker til detalj. Speiler `PROJECT-LOG.md`-mønsteret. |
| `YYYY-MM-DD-<topic>-spor.md` | Datert sesjons-dokument | Mens og rett etter en strategisk diskusjon. Beslutninger føres inn dato-stemplet — gamle beslutninger slettes ikke. |
| `aktor-map.md` | Levende kontaktoversikt | Hver gang en relasjon endrer status (ny kontakt, nytt møte, ny rolle, parkert). |

## Forholdet til PROJECT-LOG.md

`PROJECT-LOG.md` er teknisk/operasjonell loggbok (kode-iterasjoner, plan-leveranser, bug-fix, refactor-beslutninger). `docs/strategy/LOG.md` er strategi-loggbok (sporvalg, kundeprospekter, forretningsmodell, distribusjonsavtaler). De skal ikke overlappe — hvis en entry er begge deler, før den der den er mest relevant og kryss-referer den andre.

## Konvensjon

- **Datoer**: ISO-format (YYYY-MM-DD) i filnavn og overskrifter.
- **Beslutninger**: Dato-stemples. Eldre beslutninger får ikke slettes — de markeres som "supersedert av <ny dato>" hvis de ikke lenger gjelder.
- **Aktørnavn**: Fullt navn første gang, deretter fornavn. Roll-bytte noteres dato-stemplet.
- **Eksterne ressurser** (artikkelhenvisninger, opptak): pekes til med relativ sti hvis i repo, ellers med absolutt sti til Desktop og notert som "lokal-ressurs (ikke i repo)".
