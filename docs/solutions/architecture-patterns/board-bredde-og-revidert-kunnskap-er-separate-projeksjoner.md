---
title: Boardbredde og revidert kunnskap er separate projeksjoner
date: 2026-09-19
category: architecture-patterns
module: board, researchledger og Anja
problem_type: architecture_pattern
component: data_model
severity: high
applies_when:
  - "Et lokalt boligprosjektboard skal flyttes til ordinær produksjonsruntime"
  - "Et board trenger både bred områdedekning og kildekontrollerte svar"
  - "Kartet og samtaleassistenten skal bruke samme produksjonsversjon"
tags: [board, poi, researchledger, anja, migrering, audit, kunnskapsgrense]
---

# Boardbredde og revidert kunnskap er separate projeksjoner

## Context

Leangenbukta startet som et lokalt board der et lite antall håndreviderte steder
bar både kartet og Anjas kunnskap. Det ga dype svar, men skjulte hvor mye som
faktisk finnes i området. Å legge hele produksjonspoolen inn i det lokale
datasettet løste bredden, men gjorde eierskapet uklart: kartimporten kunne
overskrive research, og et synlig POI kunne lett bli tolket som et
kildekontrollert faktagrunnlag.

Den verifiserte migreringen på `feat/leangenbukta-board` viste at ett board må
bygges som flere projeksjoner over autoritative data. Kartdekning,
publiseringsgodkjent kunnskap og redaksjonell prioritet er relaterte, men de er
ikke samme datasett.

## Guidance

Bruk fire tydelige lag:

1. **Poolen gir bredde.** Det ordinære prosjektboardet arver steder fra den
   delte POI-poolen. Registerfelter kan brukes til navn, type, plassering og
   eksplisitt adresseoppslag. De gir ikke dekning for åpningstid, pris,
   kapasitet, kvalitet eller anbefaling.
2. **Researchledgeren gir sporbar kunnskap.** Atomiske påstander importeres med
   kilde, observasjonstid, reviewstatus og eventuell utløpsdato. Hele auditsporet
   beholdes, mens bare godkjente og gyldige påstander inngår i
   `published_knowledge`.
3. **Boardkonfigurasjonen gir presentasjon.** Radius, tema, anker–medlem-relasjon
   og et lite sett eksplisitte `standalonePoiIds` bestemmer hva brukeren ser.
   Visuell promotering endrer aldri kunnskapsnivået til stedet.
4. **Anja leser samme produksjonsversjon som kartet.** Samtalekilden bygges fra
   det ordinære boardet og publisert kunnskap. Registersteder hentes ved behov;
   hundrevis av navn skal ikke kopieres inn i den faste prompten.

Påstander uten et sikkert kartpunkt skal være temaobjekter uten pin. En
naboeiendoms plan, en usikker inngang eller et omtrentelig punkt må ikke få en
markør bare fordi kartet krever koordinater.

En lokal demo er et migreringsorakel, ikke en varig produksjonsruntime. Behold
rå research, auditpakker, receipts, golden fixtures og samtalescenarioer. Slett
den parallelle ruta først når ordinært board har bestått:

- mekaniske schema-, import-, board-, Entur- og samtaletester
- visuell kontroll av relevante kartmoduser og representative skjermbredder
- scenarioer som dekker avvist, historisk, uavklart og tidsfølsom kunnskap
- regresjonsprøver for den gamle demoens kunde- og stemmeatferd
- repo-søk og produksjonsbygg uten direkte import av lokale runtime-data

## Why This Matters

Et kart med bare reviderte steder ser feilaktig tomt ut. Et kart der alle POI-er
behandles som reviderte gjør assistenten overmodig. Et separat lokalboard gir
god kontroll i starten, men dobler etter hvert runtime, adaptere og
regresjonsflate.

Lagdelingen gjør kvaliteten skalerbar: poolen kan oppfriskes uten å skrive om
research, research kan revideres uten å endre kartbredden, og redaksjonelle
valg kan justeres uten å oppgradere et steds faktastatus.

## When to Apply

- Når et nytt prosjekt allerede har et ordinært, provisjonert board.
- Når manuell research dekker færre steder enn produksjonspoolen.
- Når en assistent skal svare om både prosjektet og området.
- Når en prototyp eller lokal demo skal erstattes av felles produksjonskode.

## Examples

- En restaurant kan løftes ut av et kjøpesenteranker som egen markør fordi den
  er viktig for kartlesningen. Hvis den bare har registergrunnlag, får Anja
  fortsatt ikke oppgi åpningstider eller omtale kvaliteten.
- En vedtatt planendring kan publiseres som tema uten pin når fakta er
  dokumentert, men nøyaktig plassering ikke er det.
- En tidsfølsom byggeplassoppdatering publiseres med `validUntil` og faller ut
  av samtalekilden når den utløper; den eldre påstanden blir liggende i
  auditsporet.

## Related

- `docs/plans/2026-09-19-0736-feat-board-anja-research-convergence-plan.md`
- `docs/research/leangenbukta-lokal-demo/audited/OVERLEVERING.md`
- `docs/solutions/architecture-patterns/parent-child-poi-hierarchy-20260410.md`
- `PROJECT-LOG.md`, 18.–19. september 2026
