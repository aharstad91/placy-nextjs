# Produksjonskontrakt for boardinnhold

Dato: 19.09.2026  
Status: U1-baseline for konvergens mellom ordinært board, research og Anja.

## Formål

Denne kontrakten fryser dagens ordinære boardprojeksjon før researchledger og
produksjons-Anja kobles inn. Den lokale Leangenbukta-demoen er evidens og
migreringsfasit. Den skal ikke bli en alternativ produksjonskilde.

Produksjonsflyten forblir:

`Project → getCachedReportProduct → transformToReportData → adaptBoardData → ReportReelsPage`

## Frosset atferd

- Et ordinært board uten assistentkonfigurasjon har ingen demoidentitet og skal
  rendres som før.
- Tema uten POI filtreres bort fra kartkategoriene. Prosjekt- og temapåstander
  uten kartpunkt trenger derfor en separat kunnskapsflate; de skal ikke bli
  falske POI-er for å overleve adapteren.
- En register-POI kan finnes i den kanoniske poolen uten `editorialHook`,
  `localInsight` eller reviderte kilder. Fravær av tekst skal ikke fylles med en
  kvalitetsvurdering.
- `developmentStatus: planned` og strukturert utviklingsinformasjon skal
  overleve til boardet. Regulert eller planlagt betyr ikke åpent eller i drift.
- `locationPrecision: approximate` og `locationNote` skal overleve som
  kartmetadata. En omtrentlig koordinat skal ikke oppgraderes ved rendering.
- Nyhavna og Leangenbukta beholder forskjellige datasettnøkler og
  innholdsversjoner så lenge de lokale oraklene finnes.

Den kjørbare karakteriseringen ligger i
`components/variants/report/board/__fixtures__/production-content-contract.ts`
og `board-data.test.ts`.

## Felter som skal over i felles produksjonsmodell

| Lokal demo i dag | Produksjonsansvar | Migreringsregel |
| --- | --- | --- |
| `knowledgeLevel` | Publisert kunnskapsprojeksjon | `audited` og `register` er ulike nivåer; register får bare sikre grunndata. |
| `facts[].verification` | Researchledger/påstand | Bare godkjent og gyldig tidsfølsom kunnskap publiseres. |
| `facts[].sourceId`, `sourceIds` | Proveniens | Kilden følger påstanden og kan vises uten at rå rapporttekst kopieres til runtime. |
| `checkedAt`, `validFrom`, `validTo` | Tidsbetydning | Tidsfølsom kunnskap uten `valid_until` er ikke publiserbar. |
| `status`, `development` | Sted- eller prosjektpåstand | Nåtid, planlagt, regulert, under bygging, historisk og uavklart skal ikke blandes. |
| `locationPrecision`, `locationNote` | POI-geometri | Beholdes på kanonisk POI og i alle kartprojeksjoner. |
| `topics` uten `mapAnchor` | Prosjekt-/temakunnskap | Vis i tema-/prosjektflaten, aldri som oppdiktet pin. |
| `demoSnapshotId` | Generell innholdsversjon | Erstattes av serveroppløselig boardidentitet og versjon; demo-ID skal ikke styre produksjon. |
| `demoFeatures`, `demoGreeting` | Assistentkonfigurasjon | Aktiveres eksplisitt per board og må ikke avledes fra slug. |

## Identitet og versjon

En produksjonslesning må senere bære:

1. stabil boardnøkkel som serveren kan slå opp uten å stole på klientdata,
2. én innholdsversjon over POI-medlemskap, publisert kunnskap og
   assistentkonfigurasjon,
3. prosjekt- og pakkescope for hver påstand,
4. eksplisitt avvisning når klientversjonen og serverversjonen er ulike.

U1 innfører ikke disse feltene i runtime. Den måler fraværet og låser dagens
atferd, slik at U2–U4 kan innføre dem uten å endre boards som ikke har Anja.

## Orakler som beholdes under migreringen

- Leangenbukta: komplett auditpakke, 35 samtalescenarioer og delt
  audited/register-datasett.
- Nyhavna: eksisterende kart-, stemme- og datasettgoldens.
- Ordinær fixture: revidert sted, registersted, omtrentlig punkt, planlagt
  tilbud, tema uten pin og tom kategori.

De lokale runtimefilene fjernes først etter at Leangenbukta er migrert,
Nyhavna består regresjonen og Lillebytunet har gjennomført samme prosess uten
prosjektspesifikk runtimekode.
