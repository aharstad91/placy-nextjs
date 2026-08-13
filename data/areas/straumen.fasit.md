# Straumen — fasit (ground truth) fra Andreas' manuelle Google Maps-sveip

> Recall-måling for scout-løypa. Samlet 2026-08-12. Diffes mot POI-poolen for
> placy-demo_sundsoya. Klasser: **POOL** = finnes i poolen · **A** = kategori
> finnes, sveipet bommet · **B** = kategori mangler i skjemaet · **C** = utenfor
> 3 km-boundary (omlands-problemet) · **D** = rolle-uavklart, må researches.
> Rolle: pin (primær/sekundær) / innhold (fakta på pin eller i editorial) / utelatt.

| # | Punkt | Klasse | Rolle-vurdering | Notat |
|---|-------|--------|-----------------|-------|
| 1 | Sundsand StrandKiosk | A | innhold | Komponent av Sundsand — allerede omtalt i editorial («kiosk») |
| 2 | SommerParkering | A | innhold | Komponent av Sundsand, sesongbasert |
| 3 | Sandvolleyballbane | A | innhold | Komponent av Sundsand («tre sandvolleyballbaner» i editorial) |
| 4 | Sundsøya Ungdomsklubb | B | pin sekundær | Ingen fritidsklubb-kategori; barn-oppvekst-relevant («13-åringen har et sted») |
| 5 | SAGA Inderøy | POOL | pin | I poolen som spa («SAGA - Center of Photography») — svigermor-svar nr. 1 |
| 6 | Herman Löchens plass | A | pin sekundær | park-kategori finnes; plass ved brufestet |
| 7 | SpareBank 1 SMN Inderøy | POOL | pin | «Sparebank 1 SMN Sakshaug» |
| 8 | Galleri Mitsel | POOL | pin | «Galeri Mistel» (staving avviker Google/OSM) |
| 9 | Straumen båtforening | D | — | Samme anlegg som Sandvågen småbåthavn? Verifiser før evt. egen POI |
| 10 | Nille Inderøy | A | pin | Nevnt i editorial-tekst, mangler som POI (shopping) |
| 11 | Inderøy Dyreklinikk AS | B | pin | Ingen veterinær-kategori |
| 12 | Elon Inderøy | A | pin | shopping-kategori finnes, 0 i poolen |
| 13 | St1 Inderøy | B | pin | Ingen drivstoff-kategori (kun charging_station) |
| 14 | Inderøy dental clinic | A | pin | dentist-kategori + TAG_MAP finnes — ren recall-svikt |
| 15 | Inderøy spillklubb | B | pin sekundær / innhold | Ingen klubb/fritid-kategori |
| 16 | Inderøy ungdomsskole | POOL | pin | ALDRI slettet — stables visuelt med vgs (AKSET, samme bygg). UX-funn: pin-stabling |
| 17 | Viking Wraps AS | D | — | Uklart hva det er (mat? bilfoliering?) — research |
| 18 | Sakshaug Barneskole | POOL | pin | «Sakshaug skole» |
| 19 | Prestlia skitrekk | C | pin (omland) | Utenfor boundary; vinter-hverdag; outdoor-kategori kan bære den |
| 20 | Inderøy bygdemuseum | POOL | pin | I poolen (museum) |
| 21 | Sakshaug gamle kirke | B | pin | Ingen kirke-kategori; middelalderkirke = landemerke + hverdagssted |
| 22 | Inderøy Mosteri | C | pin (omland) | DGO-medlem, utenfor boundary |
| 23 | Husfrua gårdshotell | C | pin (omland) | DGO; svigermor-kandidat i omlandet |
| 24 | SUNDNES GÅRD KAFÉ KUNST | C | pin (omland) | Sundnes, ved/utenfor grensa |
| 25 | HOFF SA Sundnes | C/D | innhold | Arbeidsplass-meta («at det finnes»), ikke destinasjon |
| 26 | JF Stranda | D | — | Uklart — research |
| 27 | Talgøra | D | — | Uklart (friluft?) — research |
| 28 | Jegtvolden Fjordhotell | A | pin | hotel-kategori finnes — svigermor-svar nr. 2 |
| 29 | Inderøy Catering | — | utelatt/innhold | Består ikke destinasjonstesten (de kommer til deg) |
| 30 | Inderøy bobilcamp | A | pin | campground-kategori la vi inn selv i TAG_MAP-runden |
| 31 | Ystgård gartneri og blomster AS | A | pin / innhold | Grensetilfelle eierskapstesten; nevnt i editorial-tekst |
| 32 | Venna vegdele (buss-knutepunkt) | A | pin primær | 10+ linjer (455/640/722/72xx) = HOVEDknutepunktet; linjene = innhold på pinnen. Poolen har kun Sundsnesvegen (1 linje-stopp) |
| 33 | Førerkortsenteret Inderøy | B | pin sekundær | Ingen trafikkskole-kategori; hverdagsrelevant for familier med tenåringer |
| 34 | Coop Charging Station | A | innhold / pin sekundær | charging_station finnes; egenskap ved Coop/Extra-punktet? |
| 35 | St1 Charging Station | A | innhold / pin sekundær | Dobbeltrolle med #13 — én pin St1 med lading som attributt? |
| 36 | Primstaven Inderøy AS | A | pin | Bokhandel; nevnt i editorial-tekst, mangler som POI |
| 37 | Nils Aas kunstverksted | POOL | pin | I poolen (museum) |
| 38 | Kjerringa me' Straumen AS | D | — | AS-suffiks = virksomhet (kafé/butikk ved brua?); ikke forveksle med Nils Aas-skulpturen — research |

## Status FØR recall-fiksene (2026-08-12 morgen)

- **38 fasit-punkter, 7 i poolen → recall ≈ 18 %**
- Klasse A (kategori finnes, sveipet bommet): 14 — fiksen er tekstsøk/grid-scan + obligatoriske kategori-søk i seed-steget
- Klasse B (kategori mangler): 6 — kirke, veterinær, drivstoff, fritidsklubb, trafikkskole
- Klasse C (utenfor boundary): 5 — to-rings-boundary for rurale strøk (tettsted + omland)
- Klasse D (research): 6 — Viking Wraps, JF Stranda, Talgøra, Kjerringa me' Straumen, båtforeningen, HOFF

## Status ETTER recall-fiksene (2026-08-12, samme dag)

Fiksene (migrasjon 083 + utvidet BOLIG_GOOGLE_CATEGORIES 14→31 + searchText-pass +
bus-avstandstak 10→15 min + OSM TAG_MAP-utvidelse + place=square): **25 av 38 i poolen.**

- **Pin-forventede innen boundary: 25 av 26 = 96 %.** Eneste gjenstående A-miss:
  Ystgård gartneri (florist-søket ga 0 — mangler trolig Google-type/oppføring).
- Bevisst IKKE pin (innhold/utelatt-rolle, 5): StrandKiosk, SommerParkering,
  Sandvolleyballbane (komponenter av Sundsand), Inderøy Catering (ikke destinasjon),
  HOFF (arbeidsplass-meta).
- Omland utenfor boundary (3): Prestlia skitrekk, Inderøy Mosteri, Sundnes gård —
  venter på to-rings-boundary.
- Research-hale D (4): Inderøy spillklubb, Viking Wraps, JF Stranda, Talgøra.
- Sannsynlig-treff å verifisere: «Wohnmobilstellplatz Inderöy-Öynavegen» (OSM) ≈
  Inderøy bobilcamp? Kjerringa me' Straumen AS kom inn som butikk — rolle uavklart.
- Bonus utover fasiten: Inderøy legesenter AS (tekstsøk «legesenter»), Øvergata
  Tannklinikk, Øyna Kulturlandskapshotell, Sund sommerhotell, Sakshaug Church (den
  nye kirka — to ekte kirker, ikke dublett), Straumen + Sund folkehøgskole
  bussholdeplasser, 4 ladestasjoner, 5 torg/plasser via place=square.
- **Boardet: 29 → 64 steder.** Transport-temaet rendrer nå (9 steder — var usynlig).
- OBS: «Fysioterapeut Runar Støa» ligger som doctor (Google-typing) — feilkategori,
  men hverdagsrelevant; lav prioritet.

### Strukturelt funn: sletting ≠ suppresjon (tombstone-behovet)

Re-seed GJENOPPRETTET 6 manuelt slettede dubletter (Vikaleiret-vannpinnene, FRISK,
Coop Extra Straumen, Uthuset-osm, stale Extra) — sletting fjerner raden dedupen
trengte for å blokkere re-import. Slettet på nytt + 3 nye dubletter (Euronics=Elon
rebrandet, St1 Lading, Coop-lader-osm). Neste strukturelle fiks: suppresjonsflagg
(tombstone) i stedet for DELETE, så kuratorbeslutninger overlever re-seed.

### Skolekrets-bugen (2026-08-12, funnet av Andreas på kartet)

Sakshaug skole + Inderøy ungdomsskole manglet på boardet TROSS treff i poolen:
`CATEGORY_FILTER_RULES.skole = school-zone` antok Trondheim — utenfor krets-
polygonene returnerer getSchoolZone `{barneskole: null, ungdomsskole: null}`,
som filteret tolket som «krets uten match» og kastet alt unntatt høyere utdanning
(vgs + «Folkehøyskole» overlevde på keyword). Fikset i applyCategoryFilter:
begge nulls = utenfor dekning = ingen filtrering. Barn & Oppvekst 9→11 steder.
Tredje «urbane antakelse» avslørt av Straumen (buss-tak, skolekrets, dedup-radier).
FIKSET samme dag (UX): pin-spredning for samlokaliserte POI-er —
`lib/board/spread-co-located.ts` (deterministisk sirkel-spredning, threshold 12 m,
radius 12 m, kun visningskoordinater — raw/DB røres ikke), anvendt i
adaptBoardData så markører/labels/popups/liste deler samme punkt. Verifisert
i DOM: 0 av 68 markører deler posisjon. I tillegg: `maxZoom={17}` på boardkartet
(labels kommer på 16 — ett hakk til, så stopp; uendelig innzooming ga tomme
bygningsflater). Stedsnøytralitets-PRINSIPP etablert: alle regler må ha definert
oppførsel for «ingen data her» (skolekrets, bysykkel, discovery-radius er
Trondheim/by-kalibrert — revider ved neste rurale strøk).

### Cache-læring (2026-08-12)

`touch cached-board-reads.ts`-trikset virker IKKE lenger pålitelig (Next 16 dev
holder unstable_cache uavhengig av recompile). Løst permanent: REVALIDATE_SECRET
satt i .env.local + dev-server restartet → `/api/revalidate?tag=...` virker nå lokalt.

## Regler avledet av øvelsen (til scout-løypa)

1. **Dekningsport i seed:** typefiltrert nearby-søk alene gir ~20 % recall ruralt — legg til tekstsøk/grid-scan + eksplisitte søk per obligatorisk kategori (lege, tannlege, kirke, holdeplass-knutepunkt, overnatting)
2. **Punkt vs. innhold — tre tester:** destinasjonstesten (går man DIT?), hvor-testen (er verdien hvor eller at?), eierskapstesten (gir det mening alene?)
3. **Komponent-absorpsjon:** kiosk/parkering/baner er fakta på forelder-POI-en, ikke egne pins
4. **Entity resolution:** klynge (navn+nærhet) → klassifiser (dublett vs. forelder+komponent) → kanoniser (riktig type > datarikdom > reviews), behold kilde-referanser
5. **Kollektiv-rangering:** holdeplasser rangeres etter linjeantall — knutepunkt = primær pin med linjene som innhold, resten sekundær
6. **To-rings-boundary ruralt:** hverdagsring (gange/tettsted) + omlandsring (5–15 min kjøring — skitrekk, gårdshotell, mosteri). Ringene defineres i **reisetid med dominant reisemodus**, ikke meter — ruralt er bil default og 25 min normalt, urbant er gange default. En meter-radius er ikke stedsnøytral; en reisetids-definisjon er.
7. **Pin-stabling:** samlokaliserte POI-er (AKSET) trenger spredning eller stabling-indikator i UI
8. **Dekningskrav per kategori + regionsenter-lag (2026-08-12, Verdal-diskusjonen):**
   - IKKE en urban/rural-bryter med to faste radius-verdier — det bryter stedsnøytralitets-prinsippet (klassifiserings-terskelen vil bomme et sted: Stjørdal? Levanger? Brekstad?).
   - I stedet: **hver hverdagskategori ekspanderer søkeringen til dekningskravet er møtt** («hvor langt må jeg for dagligvare/skole/lege/kjøpesenter/kino/sykehus?»). Urbane strøk saturerer innen 1–2 km → liten ring automatisk; rurale strøk ekspanderer til regionsenteret → stor ring automatisk. Geografien kalibrerer seg selv, ingen klassifiseringsregel trengs.
   - **Regionsenteret er et tredje representasjonsnivå**, ikke pin-suppe: hvor-testen sier at verdien er «at Verdal finnes, 25 min unna, og dekker restbehovene» — ikke enkeltbutikkene der. Én aggregert regionsenter-markør med innhold på seg (kjøretid + hva den dekker: Amfi, kino, jernbane, større handel; Sykehuset Levanger i samme retning). Å seede hele Verdalsøra ville druknet de kuraterte Straumen-punktene.
   - Tetthets-signalet finnes gratis: 78 POI-er innen 3 km (vs. ~800 urbant) forteller pipelinen at strøket er ruralt — trengs en pragmatisk v1 med to profiler, avledes klassifiseringen av seed-tettheten, aldri av manuelt flagg.
   - Rural-kobling til salgsargumentet: «regionen innen rekkevidde»-laget er redaksjonelt *viktigere* ruralt (jf. rural-asymmetrien mot FINNs Nærområdet-kart). Røra stasjon (~7 min, Trønderbanen mot Verdal/Levanger/Trondheim) hører hjemme i dette laget.
   - **Status (2026-08-12, Andreas):** regionsenter-laget (nivå 3) AVVENTES til vi ser at fraværet faktisk er en utfordring på et konkret board — dokumentert retning, ikke byggekø. Dekningskrav-tankegangen står som designprinsipp for scout-løypa.
