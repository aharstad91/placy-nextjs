# Nyhavna – FAQ som inngang til samtale og kart

Demo: http://localhost:3103/demo/nyhavna-lokal

## Avgrensning

Demoen gir en enkel orientering om hverdagen rundt Nyhavna. FAQ-ene setter minimumet for samtalen. Stedskort og kart utdyper plasseringen. Menyer, priser og aldersspesifikke anbefalinger er tatt ut av det aktive datagrunnlaget; virksomhetenes egne sider er inngangen til aktuelle detaljer.

Det tidligere aktive grunnlaget er bevart i `2026-09-14-research-archive.json`: 67 FAQ-er, 56 notater og 65 kilder. Alle tre samlinger er sammenlignet med HEAD fra før arbeidet og er uendret i arkivet. Arkivet lastes ikke av stemmen.

## Innholdskontroll

12 av 12 nye FAQ-er gjennomgått og koblet til 12 korte kunnskapsnotater. 18 av 18 steder har kilde, kartpunkt og gang-/sykkeltid. Alle 36 av 36 reisetider er kontrollert mot lagrede rutesvar. 22 kilder brukes av det aktive datasettet. Skolekrets omtales som aktuell i planmaterialet, med nødvendig avklaring for den konkrete boligen.

| Tema | FAQ | Steder i egen kategori |
|---|---:|---:|
| Oppvekst | 3 | 4 |
| Servering | 3 | 4 |
| Hverdag | 1 | 2 |
| Transport | 4 | 5 |
| Opplevelser | 1 | 1 |
| Natur | 0 | 1 |
| Trening | 0 | 1 |

Familie-FAQ-en kobler bowling, padel og Ladestien på tvers av kategorier. Natur og trening har egne stedskort, uten ekstra FAQ-er i dette utvalget.

## Ruter

Felles utgangspunkt: 63.43980508893858, 10.41725655026434, merket «Demoens utgangspunkt». Dette er et demonstrasjonspunkt og ingen framtidig boliginngang. Mapbox-rutesvar er lagret i `2026-09-14-stedsruter.json`. Kartverket-adresser og Entur-punkter dokumenterer målpunktene; noen er adressepunkter, ikke innganger. Ladestien måles til Ormen Langes vei, ikke til hele stien.

Alle anslag er beregnet 14. september 2026. Bil- og bussreisetider er ikke beregnet. Busslinjer og holdeplasser er med, mens AtB brukes for konkrete avganger. Gangruter er ikke vurdert som trygge skoleveier.

## Samspill

- Åpne en FAQ uten aktiv samtale: les svaret, fremhev tilknyttede steder og vis «Utforsket».
- Åpne en FAQ med aktiv samtale: send spørsmålet gjennom eksisterende stemmeforbindelse. Klikket starter ikke mikrofonen.
- Stemmens bekreftede kartkommando kan knytte svaret til FAQ-ID-er. «Utforsket» venter på observert tale og etterfølgende ro.
- Trykk et stedsnavn for kort og rute. Kategorienes kuraterte steder blir værende i listen selv om kartet flyttes.
- «Nullstill haker» fjerner øktens markeringer. Ingen brukerprofil eller vedvarende lagring.

Live-klienten har ingen eksplisitt fullført-svar-hendelse; talemarkeringen er derfor en lokal indikasjon basert på lyd og transkript, ikke en garanti for at hele svaret er hørt. Hvis nettleseren ikke kan måle lyd, blir talesvaret ikke automatisk markert som utforsket.

## Verifisert i nettleser

Desktop og 390 × 844 mobil: kategoriliste, FAQ, utforsket-markering, nullstilling og klikk til skolekort. Skoleruten fra demopunktet er visuelt kontrollert. Oppvekst viser alle fire steder etter kartflytting. Ingen konsollfeil observert. Faktisk mikrofon/lydflyt er ikke lyttetestet i denne runden.

## Test av samtalen

Last siden på nytt, start en ny samtale og prøv «Hvilke skoler er aktuelle?», «Hvor langt er det dit?» og «Hvor handler vi dagligvarer?». Prøv også et FAQ-klikk mens samtalen er aktiv og et avbrudd midt i svaret. Kontroller at stemmen holder seg til oversikten, at riktige steder vises, og at den ikke fyller manglende detaljer med gjetting.

Endringen gjelder den lokale demoen. Ingen Supabase-skriving eller publisering.

## Mekaniske sjekker

79 målrettede tester består etter siste rettelse. Siste fullsuite før de siste avbrudds-/klikkrettelsene: 4 282 bestått, én eksisterende feil i den uendrede stemmeinstruksens ordgrense (319 mot 300). Lint har 0 feil og 54 eksisterende advarsler. TypeScript og produksjonsbygg består.

Ved lokal testing: start en ny samtale etter dataendringer. Feil sted, manglende klikkrespons eller uriktige haker er regresjonssignaler. Nettleserens konsoll og eksisterende Live-status er kontrollpunktene; stopp samtalen og last siden på nytt ved feil. Ingen produksjonsutrulling inngår.
