# Placy — brief til AI-webdesigner (placy.no, eiendom)

> Lim hele dokumentet inn som første melding. Be designeren lese alt, stille inntil fem spørsmål, og først deretter designe.

## 1. Hva Placy er (én setning)

Placy lager et interaktivt nabolagskart for boligprosjekter: kjøperen ser hva som finnes rundt boligen, hvor lang tid det tar å komme dit, og hvorfor det betyr noe. Utbyggeren får tall på hva kjøperne faktisk sjekker.

Vi kaller produktet et **nabolagsboard**. Ett board per boligprosjekt. Det ligger på prosjektets egen nettside (embed), lenkes fra FINN-annonsen og deles via QR på visning.

## 2. Hvem nettsiden skal overbevise

Primær: **markedsansvarlig hos meglerkjede eller utbygger som selger nybyggprosjekter** (20–250 boliger). Norsk. Har alt en prosjektnettside med boligvelger. Kjøper design og digital markedsføring fra byråer. Har fått budsjettet kuttet og skal omfordele, ikke finne friske penger.

Sekundær: daglig leder hos utbygger som skal godkjenne.

Nettsiden er en **støtte til salgsmøtet**, ikke selvbetjent kjøp. Målet er at besøkende (a) åpner et eksempel-board og (b) booker et møte.

## 3. Problemet vi løser (dette er hovedbudskapet)

Alle boligprosjekter i dag lager nabolagsseksjonen på nytt, for hånd, som et stillbilde:

- Et stilisert kart som bilde, med håndplasserte pins. Kan ikke klikkes, søkes i eller oppdateres.
- Reisetider tastet inn manuelt i en tabell. Én står tom, ingen har oppdaget det.
- 16 steder på samme side med nøyaktig samme beskrivelse.
- Fire prosjekter fra samme utbygger, fire ulike løsninger, null gjenbruk.

Konkurrenten er ikke et annet produkt. Det er en JPEG fra egen designer.

## 4. Hva kjøperen av boligen får

- Interaktivt kart med **60–80 steder** rundt prosjektet, hvert med egen tekst og beregnet reisetid.
- Sortert i **sju temaer**: hverdag, barn, mat, natur, transport, trening, opplevelser.
- **Tre reisemåter** (gange, sykkel, bil) med faktisk beregnet tid.
- En redaksjonell tekst per tema som forklarer *hvorfor* stedene betyr noe for den som skal bo der. Skrevet i presens, fra beboerens perspektiv. Ingen historikk, ingen turist-vinkel.
- Fungerer på mobil først. 3D-kart.

## 5. Hva utbyggeren får

- **Ett board, alle flater**: embed på prosjektsiden, lenke i FINN-annonsens «Nyttige lenker», QR på visning og i salgsoppgaven, karusellbilde.
- **Bygget én gang, delt av alle boligene i prosjektet.** Oppdaterer seg selv når nabolaget endres.
- **Innsiktsrapport**: hvilke temaer, steder og spørsmål kjøperne faktisk sjekker, og hvilken kanal som sender interesserte kjøpere. Leveres måned 3 og 6.
- **Innholdsworkshop**: ett møte der utbyggeren peker ut det som må med.

## 6. Tone og språkregler (viktig)

- Norsk bokmål. Korte setninger. Vanlige ord.
- **Fakta, ikke poesi.** «Butikk, skole og trikk innen fem minutter» — aldri «lukten av nybakt brød».
- Ingen svada-ord: «sømløs», «innovativ», «neste generasjon», «AI-drevet». Ordet AI skal ikke stå på siden.
- Aldri score eller karakter på et nabolag (ingen «walkability 87»).
- Ikke nevn konkurrenter ved navn.
- Ingen priser på nettsiden. Pris tas i møtet.
- Ikke lov ting som ikke finnes: ingen 3D-modell av selve bygget, ingen selvbetjent bestilling.
- Ikke nevn hotell, turister, guidede turer eller andre bransjer. Nettsiden er kun eiendom.

## 7. Visuell retning

- Varmt og rolig, redaksjonelt, ikke SaaS-blått. Referanse-palett fra eksisterende materiell: bakgrunn `#f2efe9`, kant `#eae6e1`, tekst `#57534e`, sekundær tekst `#78716c`, hvite kort med `rounded-2xl`.
- Illustrasjoner i akvarell (vi har eget bibliotek i denne stilen). Ingen stock-foto av smilende par.
- Kartet er helten. Hero skal vise et **ekte board innebygd** (iframe), ikke et skjermbilde.
- Mobil først. Boardet brukes av kjøpere på telefon.

## 8. Sidestruktur (anbefalt)

1. **Hero**: én setning + innebygd eksempel-board + knapp «Book et møte».
2. **Problemet**: fire skjermbilder av dagens løsninger side ved side, med én setning under hver (se §3).
3. **Slik ser det ut**: boardet forklart i tre punkter med tallene fra §4.
4. **For første gang: tall på hva kjøperen lurer på**: innsiktsrapporten, tre spørsmål den svarer på.
5. **Ett board, alle flater**: embed, FINN, QR, karusell.
6. **Om oss / kontakt**: Trondheim-basert, én person + agenter, kort. E-post og møtebooking.

Ikke flere sider enn nødvendig. Én landingsside med ankere holder i første versjon.

## 9. Eksempel å hente fra

Live board: https://placy.no/eiendom/broset-utvikling-as/wesselslokka/rapport-board

## 10. Til deg som designer

Still inntil fem spørsmål før du tegner. Lever først en skisse av struktur og tekst, deretter design. Alt innhold på norsk. Hold deg til det som står her; finn ikke opp funksjoner.
