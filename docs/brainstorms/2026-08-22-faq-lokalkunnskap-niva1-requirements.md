---
date: 2026-08-22
topic: faq-lokalkunnskap-niva1
---

# FAQ-seksjon per kategori i nivå 1-boardet — «digitalisere megleren»

## Problem Frame

Nivå 2-boardets unike verdi er kuraterte tekster per kategori — «megleren forteller». Nivå 1 (default, automatisk) har i dag bare kort kategoritekst + kart, og klarer ikke å svare på spørsmålene en boligkjøper faktisk stiller på visning: *Hvilken skolekrets sogner boligen til? Hvor er nærmeste holdeplass? Hvilke barnehager finnes i nærheten?* En megler svarer på dette muntlig; Placy klarer det ikke i dag. Det er Moat 1 (Lokalkunnskap) som ikke kommer frem — vi er gode på visuell kommunikasjon i kart, men ikke i tekst.

Fundamentet finnes allerede: `lib/editorial/category-specs.ts` definerer per kategori hvilke spørsmål som skal besvares, fra beboer-perspektiv, med kilde per spørsmål (offentlig register / egne data / websøk) og et lag-skille — `tekst` (POI-tekst, deles av alle boards) vs `board` (adresseavhengig, f.eks. skolekrets, som er *riktig for én bolig og feil for naboen*). Board-laget har i dag **ingen render-flate**. FAQ-seksjonen er den flaten.

```
category-specs.ts (spørsmålsbank per kategori, fra beboer-perspektiv)
        │
        ├── lag: tekst  → POI-tekster (finnes i dag, deles av alle boards)
        └── lag: board  → FAQ-svar per adresse (NY flate — denne featuren)
                              │
              ┌───────────────┴───────────────┐
    deterministisk kjerne              kuratert lag
    (register + egne data +            (der strøket er kuratert
     POI-er + reisetider —              via /curate-area —
     ALLE adresser)                     rikere «megler-stemme»)
```

## Requirements

**FAQ per kategori (drill-in)**

- R1. Hver kategori i nivå 1-boardets drill-in får en FAQ-seksjon: spørsmål/svar formulert slik en megler ville svart på visning for akkurat denne adressen, fra beboer-perspektiv.
- R2. Spørsmålsbanken er `lib/editorial/category-specs.ts` — FAQ-en innfører ingen parallell spørsmålsstruktur. Spørsmål som egner seg for board-FAQ flagges i spec-en (planlegging avgjør mekanikken); adresseavhengige svar (`lag: "board"`, f.eks. skolekrets) regnes ut per board og vises her — dette er render-flaten det laget har manglet. Banken dekker i dag bare fire POI-kategorier (skole, barnehage, dagligvare, restaurant — ~3 av boardets 7 drill-in-temaer) og har nøyaktig ett board-lag-spørsmål; **utvidelse av banken (minst transport-spec) og en tema↔kategori-mapping (drill-in er per tema, spec-en per `category_id`) er en del av denne featuren** — det er utvidelse av banken, ikke en parallell struktur.
- R3. To-lags svarproduksjon: en deterministisk kjerne for **alle** adresser (Udir-register, kretspolygoner, POI-data, reisetider — data vi eier), pluss et rikere kuratert lag der strøket er kuratert. Et spørsmål uten svar i kildene **utelates** — FAQ-en dikter aldri (samme regel som tekstmalene).
- R4. Kategoriteksten i drill-in krympes til en kort intro (1–2 setninger som setter scenen); FAQ-en bærer substansen. Minimum-garantien for alle boards blir dermed: kort intro + deterministisk FAQ.

**Global nabolags-FAQ**

- R5. Når ingen kategori er valgt vises en slank global FAQ på strøksnivå: få spørsmål («hva kjennetegner området?», «hvordan kommer jeg meg til byen?»), bevisst holdt kort så den ikke spiser kategori-FAQ-ene.
- R6. Globale svar som berører et tema lenker inn i kategorien (svar om mat/servering lenker til Mat og drikke-kategorien) — synergien binder flatene sammen i stedet for å duplisere innhold.

**Kartkobling**

- R7. Steder nevnt i et FAQ-svar er klikkbare og flyr til/highlighter POI-et i kartet — visuell kommunikasjon i kart *og* tekst, koblet. Kun punkter i denne omgangen.
- R8. FAQ-svar kan omtale ikke-koblbare elementer (turstier, grøntdrag) i ren tekst uten kartkobling — manglende geometri skal ikke sensurere gode svar.

**Flater og arkitektur**

- R9. FAQ-en fungerer på både desktop (venstrepanelet) og mobil (sheet-flaten) i tråd med mobile-native-prinsippet — adaptive mønstre, ikke tvunget felles layout.
- R10. All svarproduksjon skjer build-time (deterministisk beregning og/eller lagret kuratert innhold) — ingen runtime-LLM-kall (arkitekturregel).

**Demo**

- R11. Konseptet bevises i en worktree-demo på **Strindfjordveien 10, Grilstad**. Strøket er kuratert (51 tekster finnes), så begge lag i R3 kan demonstreres på samme board.

## Success Criteria

- Barneoppvekst-FAQ-en på demo-boardet svarer korrekt på skolekrets-spørsmålet for adressen: Ranheim barneskole (1.–7.), Charlottenlund ungdomsskolekrets, Charlottenlund vgs. nærmest — med bussavstand til byens øvrige vgs.-tilbud. (Braindumpens egen lakmustest: «det ville en megler ha sagt».)
- Transport-FAQ-en svarer på «hvor er nærmeste transportmiddel?» med faktisk holdeplass/linje for adressen.
- Minst ett POI-referert svar er klikkbart og flyr kartet til punktet (R7).
- Den globale FAQ-en finnes, er kort, og minst ett svar lenker inn i en kategori (R6).
- Ingen FAQ-svar er diktet: hvert svar kan spores til register, egen beregning eller kuratert kilde; spørsmål uten kildesvar er utelatt, ikke fylt med svada.
- To-lags-modellen er synlig: det går an å peke på hvilke svar som er deterministiske (ville fungert på enhver adresse) og hvilke som er strøks-kuraterte.
- Den deterministiske kjernen er kjørt alene mot én adresse i et ukuratert strøk (ren output-inspeksjon, ingen board-UI) og vurdert mot minimum-garantien — pipeline-go skal ikke hvile på det gunstige tilfellet alene.
- FAQ-en er lesbar og navigerbar i mobil-sheeten på demo-boardet, inkludert minst ett klikkbart POI-svar (R7) utført fra mobil — målgruppen står med mobilen i hånda på visning.

## Scope Boundaries

- **«Verdt å merke seg»-presentasjonen endres ikke** — eksplisitt utsatt til egen sesjon i braindumpen.
- **Ingen linjer/områder i kartet** (turstier, grøntdrag) — svar kan omtale dem i tekst (R8), geometri-kobling er deferred.
- **Ingen runtime-LLM / «still et spørsmål»-felt** — FAQ-en er statisk per generering.
- **Kun Report-boardet** — Explorer og Guide berøres ikke.
- **Demo på én adresse** — pipeline-integrasjon (at alle nye boards får FAQ automatisk) besluttes etter demo-evaluering.

### Deferred to Separate Tasks

- Tursti-/grøntdrag-geometri i kart (trail-fetcher finnes som startpunkt) — tas opp når FAQ-konseptet er validert.
- «Verdt å merke seg»-presentasjon — egen sesjon, jf. braindump.
- Pipeline-integrasjon + backfill av eksisterende boards — etter demo-evaluering.
- VO-board-gapet (drill-in unåbar når reels-lyd finnes) må løses før FAQ-en kan inngå i minimum-garantien for alle boards — forutsetning for pipeline-integrasjon.

## Key Decisions

- **To-lags innholdskilde** (deterministisk + kuratert) fremfor kun-deterministisk eller kun-LLM: matcher eksisterende nivå-modell og minimum-garanti; skalerer til alle adresser uten å ofre «megler-stemmen» der strøket er kuratert. (Andreas, 2026-08-22)
- **Gjenbruk av `category-specs.ts` som spørsmålsbank** fremfor egen FAQ-spørsmålsliste: spørsmålene finnes allerede med kilde og lag-skille; en parallell struktur ville drifte. FAQ-en er render-flaten `lag: "board"` har manglet.
- **Slank global FAQ med kategori-lenker** fremfor full ambisjon eller utsettelse: beviser helheten fra braindumpen uten overlapp-risikoen Andreas selv advarte mot.
- **Klikkbare POI-referanser, geometri deferred**: beviser kart+tekst-koblingen uten å løse det vanskeligste (turstier) i første iterasjon.
- **Kort intro + FAQ** fremfor FAQ-i-tillegg eller FAQ-erstatter-alt: én flate, ingen dobbel fortelling — «dropp det med å skrive en tekst nødvendigvis» (braindump).
- **Demo på Strindfjordveien 10, Grilstad**: samme adresse som braindump-eksempelet; kuratert strøk gjør at begge lag demonstreres.

## Dependencies / Assumptions

- Skolekrets-oppslag per adresse finnes i `lib/pipeline/zoned-school-selection.ts` (mot `data/geo/trondheim/barneskolekrets.json` og `ungskolekrets.json`) og Udir-registeret er tilgjengelig (`lib/editorial/udir-register.ts`) — verifisert på branchen feat/scout-ranheim. (`lib/pipeline/krets-boundaries.ts` er strøk-polygoner, ikke adresseoppslag.)
- Strøket heter **ranheim** (Grilstad ligger innenfor ranheim-boundary). Primær-råstoff for det kuraterte FAQ-laget er strøkets `report_editorial`-bodyer per tema; de 51 POI-tekstene er per konstruksjon adresse-agnostiske (`lag: tekst` — sanne for enhver adresse i nærheten, og rendres allerede i POI-modalen) og er kun sekundær kilde for stedsdetaljer. Kuraterte FAQ-svar er ny forfatting, ikke gjenbruk.
- Reisetider precomputes i pipelinen (PRD 3), men **kun gange** — bussreisetid og linjenumre finnes ikke i dagens datagrunnlag (Mapbox Matrix har ingen kollektiv-profil; Entur-importen lagrer holdeplass uten linjer; `/api/entur` er runtime-sanntid, ikke en build-time-kilde). Transport-svarene og skole-kriteriets bussavstand krever derfor et **nytt build-time-oppslag mot Entur journey-planner** (endepunktet er allerede i bruk i `lib/pipeline/poi-discovery.ts`), med vgs.-listen fra Udir-registeret.
- `lib/editorial/` (category-specs, udir-register) og tilhørende scripts er per 2026-08-22 **untracked** — de må committes på feat/scout-ranheim før demo-worktree opprettes, og worktreen brancher fra denne branchen, ikke main.
- Demo-boardet provisjoneres **uten reels-lyd**: drill-in-flaten (der FAQ-en bor) er unåbar på VO-boards — kjent UX-gap, egen sak.

## Outstanding Questions

### Resolve Before Planning

*(ingen — alle produktbeslutninger er tatt)*

### Deferred to Planning

- [Affects R3][Technical] Hvordan deterministiske svar formuleres som naturlig norsk uten LLM — maler per spørsmål, med setningsmal-fella fra category-specs (41 like åpninger) som kjent anti-mønster.
- [Affects R2][Technical] Mekanikk for å flagge FAQ-egnede spørsmål i spec-en, og hvilke spørsmål per kategori som faktisk hører hjemme i board-FAQ vs. POI-tekst.
- [Affects R3][Technical] Lagringsformat for FAQ-svar per board/strøk (products.config vs. v2-skjema) og re-genereringsmekanikk.
- [Affects R7][Technical] Representasjon av POI-referanser i svar-tekst (id-markup) slik at render kan gjøre dem klikkbare.
- [Affects R5][Needs research] Innholdsflyt for global FAQ — Andreas var usikker på naturlig flyt; planlegging bør foreslå konkrete spørsmål for Grilstad som testcase.

## Next Steps

→ `/ce-plan` for strukturert implementeringsplan (demo i worktree, deretter evaluering).

## Deferred / Open Questions

### From 2026-08-22 review

- **FAQ-interaksjonsmønster (accordion vs. flat liste) er ikke besluttet** — Requirements R1/R9 (P1, design-lens, confidence 0.75)

  Dokumentet spesifiserer FAQ-ens innhold og datakilder i detalj, men sier ingenting om selve widget-interaksjonen: er spørsmålene skjult bak accordion-disclosure (ett om gangen? flere samtidig?), eller vises alle svar utfoldet som en flat liste? Placy har et etablert prinsipp om disclosure-animasjoner uten auto-scroll — det er nettopp denne typen komponent som trigger prinsippet. Beslutningen må også dekke om default-state er lik på desktop-panel og mobil-sheet.

  <!-- dedup-key: section="requirements r1r9" title="faqinteraksjonsmønster accordiondisclosure vs flat liste er ikke besluttet" evidence="R1. Hver kategori i nivå 1-boardets drill-in får en FAQ-seksjon: spørsmål/svar formulert slik en megler ville svart på" -->

- **Minimum-garantien kan degradere for ukuraterte adresser — degradasjonsregel/gulv mangler** — Requirements R3+R4 (P1, product-lens, confidence 0.73)

  På en adresse i et ukuratert strøk med tynn datadekning kan R3+R4 gi kort intro + 1–2 FAQ-punkter — *tynnere* enn dagens minimum (stedsspesifikk kategoritekst), akkurat der rural-asymmetri-pitchen trenger den mest. Valget: behold full kategoritekst som fallback når den deterministiske FAQ-en gir færre enn N svar, eller definér per kategori et garantert besvarbart spørsmålssett før teksten krympes.

  <!-- dedup-key: section="requirements r3 r4" title="minimumgarantien kan degradere for ukuraterte adresser kategoriteksten krympes før den deterministiske faqen har bevist at den bærer substansen" evidence="Et spørsmål uten svar i kildene **utelates** — FAQ-en dikter aldri" -->

- **Sheet-tilstand ved klikk på POI-referanse i FAQ-svar (mobil) er ikke besluttet** — Requirements R7/R9 (P1, design-lens, confidence 0.70)

  På mobil ligger FAQ-en i en bottom-sheet som kan dekke store deler av skjermen — hvis sheeten ikke snapper til peek-tilstand ved klikk på en POI-referanse, ser ikke brukeren kart-flyet R7 beskriver. Konkret tilstandsovergang (expanded → peek, eller alternativ løsning) må besluttes for at R7 skal være observerbar på mobil.

  <!-- dedup-key: section="requirements r7r9" title="sheettilstand ved klikk på poireferanse i faqsvar mobil er ikke besluttet" evidence="Steder nevnt i et FAQ-svar er klikkbare og flyr til/highlighter POI-et i kartet — visuell kommunikasjon i kart og tekst" -->

- **Forholdet mellom deterministisk og kuratert svar-lag i UI er ikke besluttet** — Requirements R3 / Success Criteria (P1, design-lens, confidence 0.65)

  Erstatter det kuraterte laget det deterministiske svaret på samme spørsmål, legger det til ekstra spørsmål, eller begge deler? Og skal skillet være synlig for sluttbrukeren (f.eks. en «meglerens tips»-markør), eller er «synlig» i suksesskriteriet kun ment for demo-evaluering? Påvirker om FAQ-listen har fast eller variabelt antall spørsmål per adresse.

  <!-- dedup-key: section="requirements r3 success criteria" title="forholdet mellom deterministisk og kuratert svarlag i ui er ikke besluttet" evidence="To-lags-modellen er synlig: det går an å peke på hvilke svar som er deterministiske (ville fungert på enhver adresse)" -->
