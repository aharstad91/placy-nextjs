---
date: 2026-04-19
topic: Foto-kollasj i rapport
status: brainstorm
related:
  - docs/brainstorms/2026-03-06-selvbetjent-megler-pipeline-brainstorm.md
  - docs/brainstorms/2026-04-09-report-komposisjon-visuell-balanse-brainstorm.md
  - docs/brainstorms/2026-04-16-urban-illustration-anchors-brainstorm.md
---

# Foto-kollasj i rapport — brainstorm

## Bakgrunn

Brukeren sammenliknet Placy-rapport med Overvik-prospektet (Sem & Johnsen-stil,
~50 sider). Innholds-messig dekker Placy allerede det meste. Det som skiller
prospektet visuelt er **stedsverifiserte foto**, gjerne komponert i asymmetriske
kollasjer (s. 32–33 Ladestien/Hansbakkfjæra, s. 42–43 triptyk på fellesskap).

Akvarellene våre bærer *stemning*, men ikke *bevis*. Et ekte foto av
Hansbakkfjæra en junikveld sier "dette stedet finnes, slik ser det ut". Foto og
akvarell er komplementære, ikke konkurrerende.

## Hva vi bygger

En **foto-kollasj-block** for rapport-produktet, med støtte for å levere
prosjekt-bilder via **Dropbox-lenke** som input til `/generate-bolig` eller
kjørbar post-hoc.

Skopet er bevisst smalt — dette er for demoer, ikke en produksjons-pipeline.

## Hvorfor denne tilnærmingen

1. **YAGNI.** Ingen upload-UI, ingen megler-login, ingen Supabase Storage-migrering,
   ingen multi-tenant foto-bank. Bare: peker til mappe → bilder havner i rapporten.
2. **Bedriften eier bildene fra før.** Meglerkjeder og utbyggere har arkiv. De
   trenger ikke et nytt system — de trenger en innlevering-kanal som ligner det
   de allerede bruker (delte Dropbox-mapper).
3. **Gjenbruk på tvers av prosjekter.** Samme megler selger flere prosjekter i
   samme bydel. En foto-pool per bedrift kan i fremtiden gjenbrukes, men det
   løses ikke nå.
4. **Foto utelukker ikke akvarell.** Rapport-layouten beholder illustrasjoner
   som atmosfære-element. Foto brukes der det finnes, akvarell der det ikke gjør.

## Nøkkel-beslutninger

| Beslutning | Valg |
|---|---|
| Hvem leverer bildene | Bedriften (megler eller utbygger) som eier rapporten |
| Inngangsport | Dropbox-lenke som input til `/generate-bolig`, eller post-hoc kommando |
| Datamodell-scope | Felles prosjekt-pool (`project.photos[]`), ingen POI-kobling i første versjon |
| Kollasj-mapping | Atmosfærisk — bilder brukes ikke per POI, men som visuell rytme i tema-seksjoner |
| Foto vs akvarell | Begge. Foto der det finnes, akvarell som fallback/komplement |
| Sesong-dimensjon | Utsatt. Kurator velger bilder som passer demoens tidspunkt |
| Verifikasjon/lisens | Utsatt. Demoer bruker "lånte" bilder for å vise poenget |

## Åpne spørsmål (utsettes til plan / senere demoer)

- **Hvor lagres bildene?** Dropbox direct-link, Supabase Storage, eller
  `public/illustrations/<project>-photos/`? Prøv enkleste først.
- **Kollasj-layouts.** Hvor mange mønstre trenger vi? Prospektet bruker
  minst tre (stor+to små, diptyk, asymmetrisk triptyk). Starte med én, utvide.
- **Rekkefølge og valg.** Manuell kurator-rekkefølge eller random fra pool?
- **Når inntreffer POI-kobling?** Demoene vil raskt avsløre om "bare atmosfære"
  er nok, eller om rapporten trenger "foto av akkurat dette stedet".
- **Foto-bank per bedrift for gjenbruk.** Relevant når samme megler får demo #2
  i samme bydel. Ikke nå.
- **Integrasjon med `generate-rapport`-skillet** (eksisterende tekst-pipeline).
  Vurderes når plan-fasen starter.

## Suksesskriterium

Når vi kjører `/generate-bolig` på en ny kunde og peker til deres Dropbox-mappe,
får vi en rapport der foto-kollasjer øker troverdigheten visuelt — uten at vi
har bygget admin-UI, upload-flow, eller taxonomi for bildene.

En reviewer som blar gjennom rapporten skal få samme "dette er et ekte sted"-
følelse som Overvik-prospektet gir, uten at vi har bygget 80% av infrastrukturen
for en produksjons-foto-pipeline.
