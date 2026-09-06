# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Steder og boards

### Poolen
Det delte lageret av alle steder systemet kjenner, på tvers av hvert board og hver kunde. Et sted ligger her én gang, uansett hvor mange boards som viser det.
*Avoid:* POI-tabellen, stedsbasen

Fordi lageret er delt, treffer en endring på et sted — et navn, en kategori, åpningstider — alle boards som viser det, også de som ikke ble rørt av arbeidet. Poolen er recall-begrenset: at et sted mangler her beviser ikke at det mangler i virkeligheten, og det er derfor svar bygget på poolen bare uttaler seg om hva som ER der, aldri om hva som ikke er det.

### Prosjekt
Adressen et board bygges for — boligprosjektet eller eiendommen, med koordinat og kunde. Ett prosjekt eier reisetidene fra sin egen adresse ut til stedene i poolen.

### Board
Nabolagsrapporten som rendres for ett prosjekt: kartet, temaene og svarene, satt sammen ved visning fra fakta som er lagret på forhånd. Et board er en visning av poolen fra én adresse, ikke en egen kopi av stedene.

### Anker
Et sted som rommer andre steder — et kjøpesenter, et idrettsanlegg — og som viser dem som medlemmer i stedet for som egne markører på kartet. Medlemmet beholder sitt eget navn og sin egen avstand; ankeret bærer hvor det ligger.

## Prosesser

### Provisjonering
Den ene veien et nytt board blir til: geokoding, import av steder, berikelse, reisetider, deterministiske fakta og redaksjonelt innhold, kjørt som en serie steg mot ett prosjekt. Fakta lagres, tekst monteres først ved visning — det er derfor formuleringer kan endres uten å provisjonere på nytt.

### Backfill
En kjøring som fyller inn et felt på steder som allerede finnes, utenom provisjoneringen. En backfill er avgrenset til et scope, går som tørrkjøring med mindre den bes om noe annet, og skal kunne kjøres på nytt uten å ødelegge det den alt har skrevet.

Tørrkjøringen sier hva som VILLE blitt skrevet. Den er ikke nødvendigvis gratis: er kilden en betalt tjeneste, kan hentefasen koste fullt selv når ingenting skrives. Skillet mellom «ikke hent» og «ikke skriv» er to separate brytere, ikke én.

### Strøk
Nabolaget et board arver kuratert innhold fra. Kurering er nøklet på strøket, ikke på adressen, så teksten skrives én gang og gjelder hver bolig som senere selges der. Det er denne delingen som gjør redaksjonelt innhold billig per bolig.

## Kostnadsvern

### Døgntak
Vår egen grense for hvor mange kall vi tillater mot en betalt tjeneste per døgn, ført i en lokal logg og håndhevet før kallet går ut. Taket er satt for å stoppe en løpsk løkke, ikke for å tillate en stor planlagt kjøring — trengs mer, heves det eksplisitt for den ene kjøringen, og det er da et valg framfor et uhell.

### SKU
Prisnivået et kall faktureres på. For stedstjenesten avgjøres nivået av hvilke felter kallet ber om, ikke av hvilket endepunkt det treffer: ett dyrt felt i forespørselen løfter hele kallet til det dyre nivået. Den eneste spaken som gjenstår er da antall kall.
