# Oppdal sentrum — romlig dossier (scout-pass, PRE-fasit)

> Scout-materiale for Moat 1-kuratering. Kilde per observasjon. IKKE publiseringstekst.
> Generert fra Mapbox Static-utsnitt (outdoors, lest 2026-08-12), Google Places-import
> (2026-08-12, 94 POI-er), Overpass/OSM-sveip (2026-08-12, +36 netto), Kartverket adresse-API.
> **Status: venter på Andreas' fasit-pass (han har lokalkunnskap).** Recall-test nr. 2
> etter Straumen — kjørt med recall-fiksene fra 08-12 (31 kategorier + searchText + migrasjon 083).

## Stedets logikk

Oppdal tettsted ligger i krysset E6 × rv. 70 (Sunndalsvegen), med Dovrebanen gjennom og
Oppdal stasjon i sentrum. Bebyggelsen strekker seg NV–SØ langs E6: Aungrenda/Sætersgrenda
øverst i NV, sentrumskjernen rundt stasjonen/Domus/Aunasenteret, Kåsa/Brennhaugen mot SV,
industriområdet (Nordre Industrivegen/Øverkåsa) og golfbanen mot SØ. Ålma-elva renner
gjennom østkanten av sentrum. Skianleggene (Vangslia, Stølen, Hovden) ligger i lia
NV/N for sentrum — Vangslia så vidt synlig i kartutsnittets øvre venstre hjørne.
[Mapbox outdoors z13, 2026-08-12]

**Anker:** «Oppdal sentrum, 7340 Oppdal», senter 62.5942, 9.6900 (sentrumskrysset mellom
stasjonen og kulturhuset; O. Skasliens veg 1 = 62.5937, 9.6936, Inge Krokanns veg 2
(kulturhuset) = 62.5951, 9.6876 — begge Kartverket). Boundary = 3 km-sirkel (24 punkter),
samme førstepass-mønster som Straumen. `areas.id='oppdal'` opprettet med tomme
editorial-templates (kurateres ETTER fasit).

## Seed-status (2026-08-12)

- **Pool: 128 POI-er** etter pin-audit (94 Google + 36 OSM + offentlige kilder − 7 dubletter).
  Board viser 115 (5 orphan-kategorier uten bolig-tema: museum ×2 [KRY, Oppdalsmuseet],
  hotel ×2 [Quality, Gjestetun], library ×1; + 8 gates av trust-filteret).
- **Google-tyngdekraften er STERK her** (94 vs. Straumens 25) — turistbygd. OSM-sveipet ga
  likevel +36: supermarkeder OSM kjente bedre, idrett ×6, fritidsklubb (Arbeidertun), kirke.
- Tema-fordeling: Hverdagsliv 52 · Mat & Drikke 27 · Transport 15 · Barn & Oppvekst 14 ·
  Trening & Aktivitet 4 · **Natur & Friluftsliv 3** (!).

## Pin-audit (programmatisk + visuelt, 2026-08-12)

**7 dubletter slettet** (samme mønster som Straumen — OBS: DELETE, ikke tombstone, så
re-seed gjenoppretter dem):
1. Tesla Oppdal Supercharger (OSM) = Tesla Supercharger (Google), 13 m
2. Sparebank 1 SMN Oppdal (OSM) = SpareBank 1 SMN (Google), 14 m
3. Opdals Sparebank Oppdal (OSM) = Oppdalsbanken avd. Oppdal (Google), 13 m — Oppdalsbanken
   er markedsnavnet til Opdals Sparebank
4. Samvirkelaget (OSM) = Samvirkelaget Café (Google), 58 m
5. Norli (OSM) = Norli Oppdal (Google), 59 m
6. Oppdal bibliotek (OSM) = Oppdal folkebibliotek (Google) — én institusjon
7. Oppdal ungdomsskole (Google, feilkategorisert `fritidsklubb`) = NSR-raden (kanonisk)

Visuelt pass (fullt board i Chrome): alle pins på land, ingen OSM-areal-centroider i
elva/vann. 144 nærhets-par i det programmatiske passet var i all hovedsak legitim
sentrums-tetthet (Domus-, Aunasenter- og Coop-kvartalene).

## Feilkategoriseringer funnet (Google-typing — samme klasse som Fysioterapeut-funnet på Straumen)

- **Oppdal Synsenter AS → `trafikkskole`** (optiker!)
- ALOHA MANA Hawaiisk Terapeutisk Massasje → `doctor`
- Blå Lagune Hudpleie → `doctor`
- KRY Visuell Kommunikasjon (designbyrå) → `museum`
- Oppdal kulturhus → `fritidsklubb` (Google-typen; huset rommer bibliotek/kino/kultursal)
- Quality Hotel Skifer → `restaurant` (hotellet selv; Skifer Terrassen finnes separat)
- «narrowly hairdresser» — navnekvalitet, verifiser reelt navn

## Verifiseringspunkter til fasit-passet (Andreas)

1. **Vitusapotek ×2** (Aunasenteret + «Vitusapotek Oppdal» ved Domus, 140 m fra hverandre)
   — finnes begge, eller er én utdatert flytting?
2. **Coop-trioen:** Domus (kjøpesenter) + Coop Mega (dagligvare i Domus?) + «Coop Oppdal SA»
   (samvirkelag-org) innen 50 m — skal org-oppføringen bort?
3. **Folkebibliotekets koordinat:** Google-pinnen står ved ungdomsskolen (SV), men
   biblioteket ligger i kulturhuset (Inge Krokanns veg 2)? Pin-posisjon trolig feil.
4. Oppdal Turisthotell — driftsstatus? (Google-kategori `restaurant`.)

## Negativ kunnskap / gap-hypoteser FØR fasit (min bestilling til fasit-passet)

- **Oppdal Skisenter mangler HELT** (Vangslia/Stølen/Hovden — heiser, alpinbakker).
  `ski_resort`/skianlegg er ikke i BOLIG_GOOGLE_CATEGORIES og ikke i OSM TAG_MAP →
  trolig klasse B (kategori mangler i skjemaet). For OPPDAL er dette identitetsbærende.
- **Oppdal Golfbane** synlig i OSM-kartbildet (øst for sentrum) — ikke i poolen.
- **Langrennsløyper/turstier**: OSM `outdoor` ga bare Kåsrandin + Landlaupe;
  seed-trails.ts ikke kjørt. Natur & Friluftsliv = 3 steder er absurd tynt for Oppdal —
  samme rurale mønster som Straumen (Google har ikke natur), men her er det SPORT-naturen
  som mangler, ikke badeplassen.
- **Ingen kino i poolen** — kulturhuset har kino? (verifiser)
- Tågvollan/Slettvollen-pins i ytterkant — sjekk at de hører til strøket.

## Regionsenter-observasjon (regel 8-perspektivet)

Oppdal er **selv regionsenteret** — motsatt asymmetri av Straumen (som lener seg på
Verdal/Levanger). Nærmeste større by er Trondheim ~120 km / Sunndalsøra ~70 km. Det
svekker behovet for nivå 3-laget her (avventes uansett, jf. fasit-regel 8-status) og
styrker hverdagsring-fortellingen: alt finnes i bygda. Til gjengjeld er **fjellet**
omlandet — to-rings-tanken her er tettsted + fjell/anlegg, ikke tettsted + regionby.

## Strukturelt funn under verifiseringen (delt kode/data, fikset 2026-08-12)

**Globale tema-oversettelser lekket Overvik-prosa inn i alle boards (en-locale).**
`v2.translations` hadde 18 rader med `entity_type='theme'` på BARE tema-id
(`theme:hverdagsliv:bridge_text` osv.) fra rapport-æraen — Overvik/Ranheim-, Tiller-,
Rosenborg-, Midtbyen- og Asker-prosa uten prosjekt-dimensjon. `applyTranslations`
faller tilbake fra prosjekt-skopet nøkkel til bar nøkkel, og `LocaleProvider`
auto-detekterer browser-språk → **alle engelskspråklige browsere så «fifteen-minute
walk from Overvik» på Oppdal-boardet** (og alle andre ukuraterte boards). Overvik-
prosjektet finnes ikke lenger i DB. Fikset: 18 rader slettet (angre-dump:
`data/areas/oppdal-funn-slettede-theme-translations.backup.json`); prosjekt-skopede
rader (Wesselsløkka-formatet `<productId>_<themeId>`) er urørt. Verifisert i Chrome
(en-browser): norsk generert bridgeText rendrer, 0 «Overvik» i DOM.
Stedsnøytralitets-klassen: **globale nøkler kan aldri bære stedsbundet prosa.**

## Småfunn

- Generert hverdagsliv-lead dobler «i gangavstand … i gangavstand» (template-skjønnhetsfeil
  i generateBridgeText).
- `seed-osm-pois.ts --radius 3000` (mellomrom) parses IKKE — kun `--radius=3000`.
  Første kjøring gikk stille på default 2000 m.
