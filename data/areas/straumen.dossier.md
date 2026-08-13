# Straumen (Inderøy) — romlig dossier

> Scout-materiale for Moat 1-kuratering. Kilde per observasjon. IKKE publiseringstekst —
> kurator-input. Generert fra Mapbox Static-utsnitt (outdoors + satellitt, lest 2026-08-11),
> Overpass/OSM-sveip (2026-08-11), Google Places-import (2026-08-11), Kartverket adresse-API.

## Stedets logikk

Straumen er kommunesenteret i Inderøy og ligger ved det trange sundet mellom
Borgenfjorden (innenfor) og Trondheimsfjorden (utenfor). Tidevannsstrømmen i sundet har
gitt stedet navn; OSM har til og med et punkt «tide watermill» ved sundet sør for brua
(historisk tidevannsmølle — verifiser før bruk). Straumbrua (fv. 755) binder sentrum
(nordsiden) til Sundsneset/Sundsøya (sørsiden). [Mapbox outdoors + satellitt, 2026-08-11]

**Prosjekttomta:** Sundsøya er i dag et industriområde — satellitt/kartet viser ett stort
sammenhengende industribygg-kompleks på neset («Nye Sundsøya» er altså en transformasjon
av industritomt til boliger, ikke jomfruelig mark). SAGA – Center of Photography ligger
i/ved samme kompleks (Google-kategori «spa» er FEIL — galleri/fotosenter).
Avstand Sundsøya 2 → Straumbrua ≈ 300 m, → sentrumskjernen ≈ 800–900 m gange.
[Mapbox satellitt + Google Places, 2026-08-11]

## Sentrums-anatomien (nordsiden av brua)

Kompakt sentrum i tre lag fra sjøen og opp: (1) sjøkanten med Rødbrygga Pub og Restaurant
nederst i Nergata, (2) gamle gateløp Øvergata/Nergata/Meieribakken, (3) handelsflaten ved
rundkjøringen fv. 755×Inderøyvegen: Rema 1000 Inderøy (Nessjordet), Coop-butikk + St1
Inderøy + NTE vest for rundkjøringen, Inderøy Legesenter og FRISK Treningsenter oppover
fv. 761. Muustrøparken ligger midt i sentrum med elva gjennom — OSM viser navnløse
gapahuker/piknikplass i/ved parken (way/504458818, way/504463165, node/2367324765).
Inderøy Kultursenter (teater/kulturhus, OSM) + Inderøy bibliotek i sentrum.
[Mapbox outdoors z15 + OSM, 2026-08-11]

**Kilde-konflikt å verifisere:** Mapbox/OSM-kartet viser «Coop Prix kundeparkering» vest
for rundkjøringen; Google har «Extra Inderøy» (63.87382, 11.29012) på samme punkt.
Trolig konvertert butikkformat. Google er ferskest — men verifiser mot coop.no. OSM-noden
«Extra Inderøy» 400 m unna (node/6028555870) var utdatert plassering — slettet fra poolen.

## Sjø og friluft

- **Sundsand Friluftsområde**: sandstrand synlig på satellitt, sør på Sundsneset,
  ≈ 900 m fra prosjektet. I OSM som `leisure=park` (IKKE `natural=beach` — derfor bommet
  beach-sveipet først). [OSM way + satellitt, 2026-08-11]
- **Sandvågen småbåthavn**: NE for sentrum, bryggeanlegg tydelig på satellitt
  (anslagsvis 80–100 plasser — telles/verifiseres). ≈ 1 km fra prosjektet. [OSM node/12296520661 + satellitt]
- **Kyststi-nettverk**: stiplede stier på kartet langs Vangslivegen-stranda (sørvest),
  rundt hele Sundsneset, og oppover Nessåkeren/Røset-ryggen NE. Sammenhengende
  strandsone-sti fra sentrum. [Mapbox outdoors z15, 2026-08-11]
- **Vikaleiret fuglefredningsområde** + ornitologisk observasjonspost i bukta sør for
  Sundsøya; **Rolsøya naturreservat** i nærheten. [Google + OSM, 2026-08-11]
- **Einhaugen**: parkhøyde ved brufestet på sentrumssiden, Herman Löchens plass ved foten.

## Barn/skole-aksen

Alle skoleslag innen tettstedet: Sakshaug skole (barneskole, OSM), Inderøy ungdomsskole
(NSR), Inderøy videregående skole (NSR), Sund Folkehøyskole (OSM, på Sund sør for
prosjektet), + 3 barnehager (Barnehagefakta: Sakshaug, Kribelin, Inderøy familiebarnehage).
Inderøy idrettspark + Sakshaug skole idrettshall + Inderøy kulturhus idrettshall (OSM).
Fotballbane/idrettsanlegg synlig nord i sentrum ved skoleområdet på satellitt.
[NSR + Barnehagefakta + OSM, 2026-08-11]

## Region og pendling

- Fv. 755 østover → **E6 ved Røra ≈ 6–7 km** (Røra stasjon på Trønderbanen — verifiser
  togstopp/frekvens i tema-research).
- E6-korridoren: Verdalsøra ≈ 15–17 km sør, Steinkjer ≈ 20 km nord, Levanger ≈ 30 km
  (sykehus). Trondheim ≈ 100 km.
- Vestover: fv. 755 over Skarnsundbrua mot Mosvik; **Skarnsundet marine verneområde**.
- Hyttefelt på andre siden av fjorden (Hoven, Lorvika) — fritids-geografi, ikke pendling.
[Mapbox outdoors z10, 2026-08-11]

## Negativ kunnskap (hva som IKKE finnes — like viktig)

- **Ingen kino, ingen kjøpesenter, ingen bowling** innen tettstedet (0 treff Google+OSM).
- **Ingen badeplass i OSM som `natural=beach`** — Sundsand er eneste tilrettelagte
  friluftsområde med strand, og den er tagget som park.
- **Gapahukene/piknikplassen i Muustrøparken er navnløse i OSM** — usynlige for
  navnebasert POI-import; må ev. inn som manuelle POI-er med kuratornavn.
- **Bare 25 POI-er fra Google-sveipet** (mot hundrevis i by-strøk) — Google-tyngdekraften
  er svak her; OSM + kuratering bærer mer av bildet (+18 netto fra OSM-sveipet).
- 1 bussholdeplass i poolen (Sundsnesvegen) — kollektivbildet må researches (AtB
  regionbuss + ev. Røra stasjon), Entur-importen ga tynt resultat.

## Åpne verifiseringspunkter til tema-research (unit 5)

1. Coop Prix vs Extra Inderøy — hvilket format er butikken i dag?
2. Røra stasjon: togstopp, linje, frekvens, kjøretid Trondheim/Steinkjer.
3. Bussruter Straumen–Steinkjer/Verdal/Røra (AtB).
4. «tide watermill» — historisk/eksisterende? (presens-regelen: bare hvis den ER der)
5. Sandvågen: antall båtplasser, venteliste, gjestebrygge?
6. Den Gyldne Omvei-medlemmene nær Straumen (Øyna, Husfrua, Sundnes gård, Gulburet …)
   — hvilke ligger innen/nær strøket vs. lenger ut på halvøya?
7. Rema 1000 + Extra åpningstider.
8. Sundsand: tilrettelegging (toalett, brygge, grillplass?).

---

## Tema-research (unit 5) — verifiserte fakta med kilde + dato (alle lest 2026-08-11)

### hverdagsliv
- Extra Inderøy, Sundfærvegen 2 — man–lør 07–23, søndag stengt. [coop.no/butikker/extra/extra-inderoy-1606 + tiendeo.no]
- Coop la ned gamle Prix-butikken på Straumen og takket nei til Nessjordet — Extra er Coops format i dag. [t-a.no via søk; OSM-labelen «Coop Prix» er UTDATERT]
- Nessjordet-senteret (Straumsentret): Rema 1000, Boots apotek, Vinmonopolet, Nille. [facebook.com/Nessjordet + POI-pool]
- Sentrum ellers: Primstaven bokhandel, Husby Optikk, Elon, Magiske Inderøy + Ystgård (blomster), Inderøy Legesenter, St1. [inderoyutvikling.no/bedrifter]

### barn-oppvekst
- Hele skoleløpet i tettstedet: Sakshaug skole (barneskole), Inderøy ungdomsskole, Inderøy videregående. [NSR + OSM]
- Sund Folkehøyskole på Sund, sør for prosjektet. [OSM]
- 3 barnehager: Sakshaug, Kribelin, Inderøy familiebarnehage. [Barnehagefakta]
- Inderøy idrettspark, Sakshaug skole idrettshall, Inderøy kulturhus idrettshall. [OSM]

### mat-drikke
- Rødbrygga Pub og Restaurant på bryggekanten (Nergata), lokalmat-profil. [inderoyutvikling.no + Google]
- Marens Bakeri (Triv AS, som også driver Jostu & Lehnhaugen). [inderoyutvikling.no]
- Den Gyldne Omvei = fv. 761 fra Røra gjennom Straumen mot Sandvollan, 20+ medlemmer med strenge opptakskrav: Øyna (restaurant/utsikt over Straumen), Gulburet, Husfrua Gårdshotell, Gangstad Gårdsysteri, Inderøy Gårdsbryggeri, Berg Gård, Nils Aas Kunstverksted, Inderøy Slakteri m.fl. [dgo.no + visitinnherred.com + visitnorway.com]
- UTHUSET The Caribbean Pub + E@ Internettkafé i sentrum. [Google]

### natur-friluftsliv
- Sundsand: Inderøys STØRSTE badeplass — langgrunn, fin sand; kiosk, HC-toalett, lekeplass, grillplasser, turstier, 3 sandvolleyballbaner; tur-/sykkelsti fra sentrum og rundt hele Sundsand-området. [visitnorway.com/listings/210857 + visitinnherred.com]
- Muustrøparken: 11 Nils Aas-skulpturer (8 donert av kunstneren selv), amfi med 500 plasser, scene, lekeplass, skotthyllbane, kvernhus med mikrokraftverk, Granaelva gjennom parken; Inderøys tusenårssted (2000); grusganger, store deler rullestoltilgjengelig. Motto «møtet mellom gammel og ny tid»; Muusbrua fra 1816 og Ringstu i parken. [nilsaas.no/muustroparken + visitnorway.com + dgo.no] — OBS presens-regelen: bruk hva som ER (skulpturer, amfi, elva), ikke årstall.
- SAGA på Sundsøya: boutique badehotell, 5 rom, sauna, badebrygge + Senter for Fotografi. [kayak.com-listing + Google] — nærmeste nabo til prosjektet.
- Vikaleiret fuglefredningsområde + observasjonspost; Rolsøya naturreservat; Skarnsundet marine verneområde vest. [Google + OSM + Mapbox]

### transport
- Røra stasjon (Trønderbanen, Steinkjer–Trondheim–Melhus): timesavganger hele dagen; mål om 2 avganger/time innen 2028 og at ALLE avganger skal stoppe på Røra. [banenor.no + en.wikipedia.org/wiki/Røra_Station + inderoyningen.no «Røra er regionalt knutepunkt»]
- Avstand Straumen→Røra/E6 ≈ 6–7 km via fv. 755. [Mapbox]
- Buss (AtB linje 722/723 Mosvik–Inderøy–Steinkjer): ~25 min til Steinkjer, MEN tynn frekvens etter skoletid (én avgang etter 16:10 iflg. lokalavis-oppslag). [atb.no/inderoy + rome2rio + inderoyningen.no] — vær ærlig i editorial: tog fra Røra er pendleraksen.

### trening-aktivitet
- FRESK Treningssenter AS (riktig stavemåte — OSM «FRISK» er feil), ved Inderøy Legesenter på fv. 761. [inderoyutvikling.no/bedrifter]
- Inderøy idrettspark + 2 idrettshaller + Sund grasbane. [OSM]
- 3 sandvolleyballbaner + opparbeidet tur-/joggesti på Sundsand. [visitinnherred.com]

### Ikke kuraterbart (bolig-6-begrensning) men viktig for boardet
- Inderøy Kultursenter (kulturhus/teater), Inderøy bibliotek, Nils Aas Kunstverksted, Galeri Mistel, SAGA → ligger som POI-er under opplevelser-ekvivalente kategorier.
