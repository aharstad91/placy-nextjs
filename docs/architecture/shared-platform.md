# Placy: systemer, ansvar og felles drift

Dette er driftskartet for arbeidet med felles plattform. Den interaktive oversikten ligger i `placy-systemkart.html`. Status kontrolleres mot faktisk publisering; en planlagt kobling er ikke en aktiv kobling.

## Publisert — kontrollert 17. september 2026

| System | Oppgave | Hva er felles? |
|---|---|---|
| www.placy.no | Eksisterende hovednettsted, Vercel-prosjekt `placy` | Egen, eldre publisering. Prosjekter deles på placy.no. |
| Felles Placy-app | Prosjektsider, kartstyring og stemmens kontrollforbindelse | `placy.no/<slug>`, med Nyhavna på `placy.no/nyhavna`. Adressen beholdes i nettleseren. Vercel-prosjektets interne navn er fortsatt `placy-nyhavna`. Samme runtime for nye prosjekter. |
| Supabase | Kunder, prosjekter, steder og varig samtaleregnskap | Samme database. Nye samtaler får eksisterende kunde/prosjekt og eget formål. Historiske demoer beholdes uendret. |
| OpenAI | Talesamtale og modellarbeid som velger/verifiserer verktøy | Felles leverandørintegrasjon. Nettleseren sender lyd direkte over WebRTC. |
| Google / Mapbox | Kart, bilder og kartdata avhengig av visning | Integrasjoner brukes på tvers; bruk er en separat kostnad. |
| Repo og kuraterte datafiler | Programvare, Nyhavna-fakta og versjonert innhold | Ny publisering inkluderer de valgte filene. Ikke alt innhold ligger i Supabase. |
| PRO ISP / DNS | Kobler domenenavn til hosting | `placy.no` bruker fortsatt PRO ISP-navneservere. Domenet pekte allerede på Vercel; flyttingen til felles app krevde ingen DNS-endring. |

Hovedsiden kjører produksjonscommit `bef9ae2`. Stemmeappen bygger på en nyere kodebase. Å erstatte hovedsiden med hele denne grenen ville også publisert uvedkommende endringer. Den felles appen eier nå placy.no, mens hovedsiden beholder www.placy.no. Forsiden og gamle nettsider videresendes til www; prosjektsider, ressurser, API og stemme betjenes direkte av plattformen.

## Plattformens skille mellom felles og eget

**Felles:** én publisering av stemmeappen, kartkomponenter, stemmemotor, leverandørintegrasjoner, database, regnskap og driftsrutiner. En feilretting i den felles appen gjelder alle prosjekter på den.

**Per kunde:** avtale, kundens prosjektliste og samlet operasjonell grense. Én kunde kan eie flere prosjekter.

**Per prosjekt:** offentlig adresse, kundeidentitet, innholdskilde, innstillinger, aktiv/inaktiv-status og egne grenser. Nyhavna bruker den eksisterende kunden `nyhavna-utvikling` og prosjektet `nyhavna-utvikling_nyhavna`. Leangenbukta står fortsatt under `placy-demo`; dette er ikke automatisk en aktivert Koteng-kunde.

**Per samtale:** serveren bestemmer prosjekt, kunde og formål, og lagrer disse sammen med modell, prisgrunnlag, bruk og avslutningsstatus. Nettleseren får velge offentlig prosjektslug, aldri hvilken kunde som belastes eller hvilket budsjett som gjelder. Testformål og kundeidentitet er forskjellige felt.

## Hva forbrukstallene betyr

Besøk er ikke det samme som talesamtaler. Et besøk kan bruke sidelevering, kart og bilder uten å starte stemmen. Stemmens variable bruk består av lyd og modellarbeid. Samtaletid alene gir derfor ikke hele leverandørkostnaden.

Anja bruker fortsatt GPT-Live-1 med GPT-5.6-Terra som svarmodell. GPT-Live koster 0,05 USD per tilkoblet minutt, avregnet per sekund; modellarbeid og verktøy kommer i tillegg. Ingen egen Live Light/Mini er dokumentert ved kontroll 17. september 2026. Realtime Mini er en annen integrasjon og er ikke en direkte modellinnstilling for dagens app. [OpenAIs Live-priser](https://developers.openai.com/api/docs/models/gpt-live-1), [Realtime Mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini).

Regnskapet skiller mellom:

- **Komplett beregnet leverandørkostnad:** mottatt forbruk med kjent prisgrunnlag og bekreftet avslutning.
- **Kjent nedre grense:** det vi kan dokumentere når sluttrapportering mangler. Dette er ikke et komplett totalbeløp.
- **Reservasjon:** kapasitet/budsjett holdt av før en samtale starter. Uavklart bruk beholder minst reservasjonen selv om den er eldre enn døgnvinduet.
- **Kundepris:** avtalen Placy inngår med kunden. Denne bestemmes ikke automatisk av leverandørregnskapet.

Plattform-, kunde- og prosjektgrenser beskytter drift og forbruk. Offentlig bruk, interne tester og benchmark teller alle mot disse grensene. Rapporter kan skille formålene, slik at testing ikke presenteres som kundebruk. Historiske demoer endrer ikke eier ved overgangen.

Vercel, Supabase og kartkostnader er ennå ikke fordelt per prosjekt i stemmeregnskapet. Besøksmåling og en kommersiell prismodell må baseres på egne målinger og avtaler. 100 000 årsbesøk sier heller ikke hvor mange samtidige besøk eller samtaler vi må håndtere. De utførte stemmetestene er funksjons- og regnskapsbevis, ikke sertifisering for høy last.

## Publisering og drift

En lokal kodeendring er ikke automatisk live. Arbeidet utvikles og testes i en isolert Git-worktree, lagres i lokale commits og publiseres kontrollert til Vercel. Git-push krever Andreas' beskjed. Produksjonsadressen peker på en bestemt Vercel-publisering; det er den publiseringen som bestemmer hva besøkende ser.

Databasemigrasjoner er et eget steg. En Vercel-publisering oppgraderer ikke automatisk databasen. Nye tabeller og regler må være kjørt og verifisert før appen tas i bruk. Ikke reverser regnskapshistorikk ved tilbakeføring av en app.

## Slik tas neste prosjekt inn

Registeret, opptaksreglene og appen er publisert. Nyhavna er første aktiverte prosjekt; neste prosjekt krever kontrollert klargjøring og eierskapskontroll.

1. Velg en globalt unik slug for `https://placy.no/<slug>`. Kontroller den med `isPublicProjectSlug` i `lib/project-paths.ts`; reserverte app- og ressursnavn kan ikke brukes. Ingen ny domeneregel eller Vercel-app skal opprettes. Finn eller opprett kunden, prosjektet og report-produktet gjennom eksisterende provisjoneringsløp. Kontroller hvem som eier prosjektet; ikke flytt en demokunde til en reell kunde ved gjetning.
2. Klargjør prosjektets fakta, steder, profil og støttede innholdskilde. Dagens kuraterte filkilder følger en kodepublisering. Nytt innhold kan kreve en slik publisering, men aldri en kopi av appen eller et nytt Vercel-prosjekt per kunde.
3. Sett kundens og prosjektets operasjonelle grenser. Velg bruksformål for offentlig tilgang og autoriserte interne tester. Registrer prosjektet som deaktivert mens det klargjøres.
4. Kontroller at side, stemme og regnskap bruker samme prosjekt, og at ukjente eller deaktiverte prosjekter ikke kan starte betalt bruk.
5. Aktiver prosjektet, prøv den offentlige lenken uten innlogging, og bekreft en avgrenset samtale i regnskapet. Kontroller noindex, kart og bilder.

Teknisk bruker dette `v2.voice_projects` (offentlig slug → eksisterende kunde/prosjekt, støttet innholdskilde og formålstilganger), `v2.voice_tenants` (offentlig/test/intern tilgang) og `v2.voice_admission_policies` (plattform/kunde/prosjekt). Nye koblinger skrives av server eller operatør med service-tilgang. Nettleseren har ikke skrivetilgang. Slug, kunde og prosjektidentitet kan ikke endres på eksisterende koblinger eller historiske samtaler; opprett en ny korrekt kobling ved et faktisk eierskifte.

Operatøren henter prosjektbruk med `npx tsx scripts/voice-costs.ts --project nyhavna-utvikling_nyhavna --purpose public`. Rapporten skiller valgte samtaler fra plattformens samlede driftsbelastning. Interne tester kan filtreres separat, men slipper ikke unna de felles grensene.

Et prosjekt kan stenges for nye samtaler uten å slette innhold eller regnskap. Eksisterende samtaler må fortsatt få avslutte og rapportere sluttforbruk; recovery må bli stående på.

Ved tilbakeføring etter overgangen må appversjonen fortsatt bruke prosjektregisteret og de samlede grensene. Ikke gjenåpne gamle demo-tilganger for å få en eldre app til å starte betalte samtaler. Hvis det ikke finnes en tidligere kompatibel versjon, behold stemmen stengt mens feilen rettes; kartet og regnskapet kan bevares.

Detaljert driftsoppskrift og dokumenterte prøver: [stemmeoperasjon](../research/voice-infrastructure/operations.md), [kostnadsrapport](../research/voice-infrastructure/cost-report.md) og [migreringsplan](../plans/2026-09-17-1212-feat-shared-placy-platform-plan.md).

## Publiseringsbevis og gjenstående avgrensninger

**Oppdatering 24.09.2026:** `placy.no` kjører nå `dpl_9kwaneHgZxaCbNbZ7gJ1qWD8DNjS` fra Nyhavnas chatrelease. Den samme publiseringen serverer `placy.no/nyhavna` og `placy.no/demo/nyhavna-nettside` med tekst og tale på én origin. Det tidligere publiseringsbeviset nedenfor er historisk.

Nyhavna kjører på `dpl_3o3VM6GjRr2u2rxwCH67Eyvps8Ar`, fra kodetreet lagret i `c0a0b19`. Felles lenke: https://placy.no/nyhavna. Siden svarer direkte på dette domenet; `/p/<slug>` er kun en kompatibilitetsadresse. Alle nye prosjekter følger samme rot-slug-standard. Se [domene- og URL-verifisering](../research/voice-infrastructure/project-url-validation.md). Ingen kode eller innlogging kreves; noindex beholdes. De to gamle demo-tilgangene er deaktivert for nye samtaler, mens historikk og recovery beholdes.

Den første fellesplattform-prøven før domeneflyttingen ga 73 stemmesekunder, normalt stopp, kartoppdateringer og komplett regnskap på Nyhavna: 0,060833 USD stemme + 0,119898 USD svarmodell = 0,180731 USD beregnet leverandørkostnad. Dette er en dokumentert syntetisk test, ikke et kundegjennomsnitt eller en faktura. Alle 60 historiske rader beholdes. Se [sluttverifisering](../research/voice-infrastructure/shared-platform-validation.md).

- `placy.no/<slug>` er førstepartsstandarden. `app.placy.no` er ikke lenger målbildet. Tekniske Vercel-aliaser finnes for kompatibilitet og drift; del prosjekter med placy.no-adressen. Ukjente rot-slugs kan utløse et registeroppslag før 404; følg request-/databasebruk uten å publisere en liste over kundeslugs.
- Endelig kundepris, automatisk fakturering og full kostnadsfordeling for øvrige leverandører er ikke besluttet i denne migreringen.
