# Placy: systemer, ansvar og felles drift

Dette er driftskartet for arbeidet med felles plattform. Den interaktive oversikten ligger i `placy-systemkart.html`. Status kontrolleres mot faktisk publisering; en planlagt kobling er ikke en aktiv kobling.

## Før overgangen — kontrollert 17. september 2026

| System | Oppgave | Hva er felles? |
|---|---|---|
| placy.no / www.placy.no | Eksisterende nettsted, Vercel-prosjekt `placy` | Egen, eldre publisering. `/nyhavna` videresender til stemmeappen. |
| Nyhavna-appen | Side, kartstyring og stemmens kontrollforbindelse | Vercel-prosjekt `placy-nyhavna`; skal bli runtime for flere prosjekter. |
| Supabase | Kunder, prosjekter, steder og varig samtaleregnskap | Samme database. Stemmen bruker foreløpig interne demoidentiteter. |
| OpenAI | Talesamtale og modellarbeid som velger/verifiserer verktøy | Felles leverandørintegrasjon. Nettleseren sender lyd direkte over WebRTC. |
| Google / Mapbox | Kart, bilder og kartdata avhengig av visning | Integrasjoner brukes på tvers; bruk er en separat kostnad. |
| Repo og kuraterte datafiler | Programvare, Nyhavna-fakta og versjonert innhold | Ny publisering inkluderer de valgte filene. Ikke alt innhold ligger i Supabase. |
| PRO ISP / DNS | Kobler domenenavn til hosting | `placy.no` bruker eksterne navneservere; Vercel-tilgang alene gir ikke DNS-skrivetilgang. |

Hovedsiden kjører produksjonscommit `bef9ae2`. Stemmeappen bygger på en nyere kodebase. Å erstatte hovedsiden med hele denne grenen ville også publisert uvedkommende endringer. Overgangen bruker derfor den kjørende stemmeappen som felles tjeneste og beholder hovedsiden inntil en egen, kontrollert sammenslåing.

## Plattformens skille mellom felles og eget

**Felles:** én publisering av stemmeappen, kartkomponenter, stemmemotor, leverandørintegrasjoner, database, regnskap og driftsrutiner. En feilretting i den felles appen gjelder alle prosjekter på den.

**Per kunde:** avtale, kundens prosjektliste og samlet operasjonell grense. Én kunde kan eie flere prosjekter.

**Per prosjekt:** offentlig adresse, kundeidentitet, innholdskilde, innstillinger, aktiv/inaktiv-status og egne grenser. Nyhavna bruker den eksisterende kunden `nyhavna-utvikling` og prosjektet `nyhavna-utvikling_nyhavna`. Leangenbukta står fortsatt under `placy-demo`; dette er ikke automatisk en aktivert Koteng-kunde.

**Per samtale:** serveren bestemmer prosjekt, kunde og formål, og lagrer disse sammen med modell, prisgrunnlag, bruk og avslutningsstatus. Nettleseren får velge offentlig prosjektslug, aldri hvilken kunde som belastes eller hvilket budsjett som gjelder. Testformål og kundeidentitet er forskjellige felt.

## Hva forbrukstallene betyr

Besøk er ikke det samme som talesamtaler. Et besøk kan bruke sidelevering, kart og bilder uten å starte stemmen. Stemmens variable bruk består av lyd og modellarbeid. Samtaletid alene gir derfor ikke hele leverandørkostnaden.

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

Denne fremgangsmåten er målet for migreringen; de konkrete registerfeltene og kommandoene må kontrolleres mot sluttverifiseringen før bruk.

1. Finn eller opprett kunden og prosjektet gjennom eksisterende provisjoneringsløp. Kontroller hvem som eier prosjektet; ikke flytt en demokunde til en reell kunde ved gjetning.
2. Klargjør prosjektets fakta, steder, profil og støttede innholdskilde. Dagens kuraterte filkilder følger en kodepublisering. Nytt innhold kan kreve en slik publisering, men aldri en kopi av appen eller et nytt Vercel-prosjekt per kunde.
3. Sett kundens og prosjektets operasjonelle grenser. Velg bruksformål for offentlig tilgang og autoriserte interne tester. Registrer prosjektet som deaktivert mens det klargjøres.
4. Kontroller at side, stemme og regnskap bruker samme prosjekt, og at ukjente eller deaktiverte prosjekter ikke kan starte betalt bruk.
5. Aktiver prosjektet, prøv den offentlige lenken uten innlogging, og bekreft en avgrenset samtale i regnskapet. Kontroller noindex, kart og bilder.

Et prosjekt kan stenges for nye samtaler uten å slette innhold eller regnskap. Eksisterende samtaler må fortsatt få avslutte og rapportere sluttforbruk; recovery må bli stående på.

Ved tilbakeføring etter overgangen må appversjonen fortsatt bruke prosjektregisteret og de samlede grensene. Ikke gjenåpne gamle demo-tilganger for å få en eldre app til å starte betalte samtaler. Hvis det ikke finnes en tidligere kompatibel versjon, behold stemmen stengt mens feilen rettes; kartet og regnskapet kan bevares.

Detaljert driftsoppskrift og dokumenterte prøver: [stemmeoperasjon](../research/voice-infrastructure/operations.md), [kostnadsrapport](../research/voice-infrastructure/cost-report.md) og [migreringsplan](../plans/2026-09-17-1212-feat-shared-placy-platform-plan.md).

## Åpent under gjennomføring

- Felles prosjektregister, samlede opptaksgrenser og kundekoblet rapportering implementeres og verifiseres før produksjonsovergangen.
- Eksakt felles adresse, aktive grenser og tilbakeføringsprosedyre fylles inn etter verifisert publisering.
- Førstepartsadressen `app.placy.no` krever en egen DNS-post hos eksisterende leverandør. Ingen flytting av navneservere er nødvendig. [Vercels veiledning](https://vercel.com/docs/domains/set-up-custom-domain).
- Endelig kundepris, automatisk fakturering og full kostnadsfordeling for øvrige leverandører er ikke besluttet i denne migreringen.
