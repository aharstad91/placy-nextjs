# Koteng Jenssen / Leangenbukta — interne avklaringer før utsendelse

**Dato:** 23. september 2026

**Kundevendt utkast:** [Tilbudsramme](2026-09-23-koteng-jenssen-leangenbukta-tilbudsramme.html)
**Status:** Klart for Andreas' gjennomgang. Ikke sendt, publisert eller akseptert.

## Hva tilbudet priser

- **Board + Anja:** 60 000 kr ekskl. mva. i etablering. Forslag som bygger på Leangenbukta-demoen og researchen som allerede er gjort. Leveransen er avgrenset til inntil 25 kuraterte steder, prosjektinnhold, faktakontroll, mobil/desktop, forslag og innbyggingskode for innganger på forside, Beliggenhet og relevante bygg- og salgstrinnsider, samt to samlede godkjenningsrunder. Kundens tekniske team legger inngangene inn på leangenbukta.no. Det prosjektspesifikke kunnskapsgrunnlaget må fortsatt godkjennes og live-testes før kundepublisering; ferdigstilling inngår i leveransen.
- **Plattform:** 4 000 kr/mnd. inkl. inntil 500 Anja-minutter. Ekstra stemmebruk foreslås til 5 kr/minutt innenfor avtalt grense. Tre måneder koster 12 000 kr. Etablering + første tre måneder = 72 000 kr; etablering + tolv måneder = 108 000 kr, ekskl. mva. og ekstra bruk.
- **Innholdsarbeid:** 1 400 kr/time etter bestilling, uten fast timepott. Samme arbeidsmodell som Nyhavna-tilbudet, men ikke en automatisk avtale med Koteng.
- **Tekstchat på hele nettstedet:** Foreslått eget tilvalg: **40 000 kr i etablering + 1 500 kr/mnd.** når det bestilles sammen med Board og Anja. Én gjenbrukbar widget med sidekontekst på forside, Beliggenhet og bygg- og salgstrinnsider; inntil 1 000 besvarte tekstspørsmål per måned. Ved grensen pauses chatten med lenke til Board og kontakt, og høyere volum avtales før fakturering. Placy leverer chatmodul og innbyggingskode; kundens tekniske team legger den inn på leangenbukta.no. Samlet Board + Anja + tekstchat blir 100 000 kr i etablering og 5 500 kr/mnd.; etablering og tre måneder blir 116 500 kr, tolv måneder 166 000 kr, ekskl. mva. og annen bestilt bruk.

Nyhavnas 60 000 kr ble presentert uten tydelig innvending, men er ikke akseptert som kjøp. Koteng har ikke fått eller kommentert en konkret pris. Tallene over er et forslag til test hos en faktisk kjøper, ikke et validert markedsnivå.

## Videre oppfølging og leveranse

1. Presenter **Board + Anja** og tekstchat med hver sin pris, slik at Koteng kan velge tillegget. Finn ut hvem som eier budsjett og innholdsgodkjenning i salgsdialogen. Nora Reese er kontakt, men kjøpsmyndighet er ikke bekreftet.
2. Kontroller den omtalte «2008»-feilen, kilder og tidsfølsomme prosjektfakta i leveransen. Årsaken er ikke fastslått. Oppdaterte kartbilder/3D er ikke inkludert i prisen; tilgjengelig underlag og ønsket resultat må vurderes særskilt.
3. Kontroller antall steder og prosjektinnhold mot faktiske kundebehov. Det finnes en researchpakke, men Leangenbukta-spesifikk runtime og live-test er fortsatt åpne.
4. Lås prøveperiodens avslutning, oppsigelse, fakturering, kostnadsgrense og innholdsgodkjenning i avtalen. Tilbudsrammen alene er ikke en kontrakt.

**Under levering:** Koteng sa ifølge Andreas at de har egne tekniske folk som kan jobbe med nettsiden. Placy leverer innbyggingskode, og de to teamene finner plassering, tidspunkt og kvalitetssikrer publiseringen. Dette er vanlig gjennomføringsarbeid, ikke en forutsetning for å angi pris eller sende tilbud. Nyhavna-tilbudet ble også landet uten teknisk avklaring med nettsidepartner først. Den lokale Leangenbukta-replikaen er fortsatt bare en demo.

**Kilder:** [Koteng-møtenotat](../strategy/2026-09-22-koteng-jenssen-mote-og-nyhavna-oppfolging.md), [Nyhavna-tilbud](2026-09-23-nyhavna-tilbudsramme.html), [Leangenbukta-demoens status](../demos/leangenbukta-nettside.md), [kategoripakkens validering](../research/leangenbukta-lokal-demo/validation-report.md).

## Grunnlag for tekstchat-forslaget

Dette er en pris å teste hos kunden, ikke en akseptert pris eller ferdig funksjon. Chatten er avgrenset til én nettside, én godkjent kunnskapsbase, ett språk (norsk), enkel lenking videre og to samlede godkjenningsrunder. Ingen live bemanning, leadskjema, CRM, boligvelger eller automatisk innhenting av nye kilder. Ved bestilling må leveransens omfang og akseptansekriterier dokumenteres; teknisk innlegging planlegges sammen med kundens team under arbeidet.

**Teknisk løsning:** Bygg en Placy-hostet chatmodul som kan bygges inn på forsiden via kundens WordPress-ansvarlige. Et serverendepunkt bruker OpenAI Responses API med prosjektets godkjente faktagrunnlag og de relevante kunnskapsverktøyene Anja allerede har. Hold API-nøkkel og samtaletilstand på serveren, begrens antall meldinger per besøkende og samlet forbruk, og vis Board/kontakt ved feil eller nådd grense. Kontroller faktasvar, status for planlagte forhold, lenker og mobilbruk før lansering. Dagens `app/api/prototype/live/route.ts` støtter uttrykkelig ikke tekstmodus; dette er en ny produktflate, ikke et bytte av visningsmodus i GPT-Live. Avklar også unntaket fra `CLAUDE.md` sin eldre «ALDRI runtime LLM-kall»-regel før implementering, siden eksisterende Anja allerede bruker Live/Responses i runtime.

**Kostnadslogikk:** 40 000 kr tilsvarer ca. 28,6 timer ved 1 400 kr/time. Et foreløpig internt arbeidsanslag er 25–35 timer for chatmodul, serverflyt, begrensninger, integrasjonstest og QA når Leangenbukta-innholdet allerede er laget. Endelig innsats må valideres i teknisk plan. 1 500 kr/mnd. priser drift, overvåking og kvalitet, ikke bare modellens tokenkostnad. Med eksisterende `gpt-5.6-terra` som utgangspunkt er oppgitt API-pris $2 per million inputtokens og $12 per million outputtokens. Et illustrativt tekstspørsmål med 5 000 inputtokens og 1 000 outputtokens gir $0,022 i modellbruk før eventuelle ekstra verktøyrunder; 1 000 slike spørsmål gir ca. $22. Faktiske samtaler og kostnader må måles under piloten. Tekst belastes separat fra de 500 inkluderte stemmeminuttene. [Offisiell modellpris](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [GPT-Live-pris og separat backendfakturering](https://developers.openai.com/api/docs/pricing).
