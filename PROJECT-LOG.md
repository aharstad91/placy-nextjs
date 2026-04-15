# PROJECT-LOG.md — Prosjektdagbok

> Kronologisk logg over beslutninger, retning og åpne spørsmål.
> Oppdateres som siste steg i /full, eller etter meningsfulle sesjoner.
> Aldri slett — bare legg til.

---

## 2026-04-15 — Google Maps 3D gjeninnført for rapport (Wesselsløkka-pilot)

### Beslutninger
- **Akvarell-pipelinen forkastet pga. ToS-brudd.** Screenshot → Gemini stil-transfer → lagret som PNG er deriverte verk etter Google Map Tiles API Policies, og repo-caching bryter 30-dagers caching-grense. Ingen "fair use" i kommersielt produkt.
- **Report3DMap-blokk via `@vis.gl/react-google-maps@^1.8.3`.** Mars 2026-utgivelsen la til deklarative `<Map3D>` + `<Marker3D>` — erstatter all imperativ DOM-kode fra feb 2026-forsøket. Enkere kode enn forrige iterasjon.
- **Gate for pilot:** Kun render 3D-blokken når `projectName` eller `areaSlug` inneholder "wessel". Hardkodet POI-config matcher ikke andre områder.
- **Kostnadsprotokoll utsatt til etter validert salg.** Ingen quota-cap eller budget alert foreløpig — bruker prioriterte demo-launch over beskyttelse. Dokumentert i plan under "Out of Scope".

### Teknisk
- **Seks fellesfeller** ved Map3D-integrasjon dokumentert i `docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md`. Kritiske: `useMap3D()` returnerer element direkte (ikke context), `Marker3D` kan ikke rendre HTML-children (kun SVG/Pin/img), `minAltitude=maxAltitude=0` gir svart skjerm, tilt=0 er rett ned (ikke 90).
- **Kameralås:** declarative props + imperativ snap-back via `gmp-rangechange`/`gmp-centerchange` listeners. Heading uncontrolled for fri 360° rotasjon.
- **SSR-gate:** `dynamic(() => import("./blocks/Report3DMap"), { ssr: false })` — samme pattern som eksisterende `ReportThemeMap`.

### Scope
- Én blokk på rapport-siden ("Alt rundt [område]") — erstatter planlagt akvarell-TabbedAerialMap
- Kun Wesselsløkka-pilot — utvidelse krever nye config-filer per område
- AnnotatedMap-seksjoner (Natur, Hverdagsliv, etc.) bruker fortsatt Mapbox 2D — 7x 3D-kart per side er for tungt

### Åpne spørsmål
- Snap-back-jitter ved aggressiv drag — ikke testet empirisk ennå, bruker tester i demo
- Når flytter vi POI-data fra hardkodet config til DB-backed queries?
- Bør 3D-blokken auto-rotere litt ved innlasting for å kommunisere "dette er 3D"?
- Mobil touch-gestures — hvordan oppfører snap-back seg under pinch/zoom på iOS?

### Leveranse
- 4 nye filer: `components/map/Marker3DPin.tsx`, `components/map/map-view-3d.tsx`, `components/variants/report/blocks/Report3DMap.tsx`, `components/variants/report/blocks/wesselslokka-3d-config.ts`
- 1 slettet: `components/map/poi-marker-3d.tsx` (brokket for 3D, brukte HTML-portal)
- `@vis.gl/react-google-maps@^1.8.3` lagt til
- Verifisert på `/eiendom/broset-utvikling-as/wesselslokka/rapport` — 15 markers rendrer, drawer åpner på klikk

### Referanser
- Brainstorm: `docs/brainstorms/2026-04-15-report-3d-map-brainstorm.md`
- Plan: `docs/plans/2026-04-15-feat-report-3d-map-plan.md`
- Læring: `docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md`

---

## 2026-04-09 (sesjon 2) — Area-hierarki, generate-bolig sync, nabolagets sjel

### Beslutninger
- **Area-hierarki implementert:** `areas`-tabellen utvidet med `parent_id`, `level`, `boundary`, `postal_codes`. Seedet 4 bydeler + 31 strøk for Trondheim. Migrasjon 050. Eiendomsmarkedet bruker strøk-nivå (~25 navngitte nabolag) — det er riktig granularitet for Placy.
- **Kaskaderende kunnskap:** place_knowledge kan nå peke til strøk → bydel → by. Rapport for Brøset henter fakta fra alle tre nivåer.
- **`/generate-bolig` oppdatert:** 9 endringer — 7 temaer (Opplevelser lagt til), kanoniske theme IDs (barn-oppvekst, trening-aktivitet), nytt steg 1.5 for strøk-matching, area_id på strøk-nivå, Tier 1/2/3-awareness i tekster, nye QA-sjekker, 7 nye gotchas.

### Utforsket: "Nabolagets sjel"
- Inspirert av Stasjonskvartalet som viser 13 signatursteder (badstu, sjøbad, promenade, galleri) — ingen typiske Google POIs
- Testet Overpass + WebSearch mot Brøset og sentrum
- **Resultat:** Automatisering gir ~70% av stedene. 30% (de mest interessante) krever lokal kunnskap
- **Megler-intervju som kilde** er nøkkelen — "hva er de 5 stedene du alltid nevner?"
- **Parkert** — konseptet validert men krever hybrid tilnærming, ikke ren automatikk

### Åpne spørsmål
- Hvordan designer vi megler-onboarding som fanger lokal kunnskap?
- Bør "nabolagets sjel" være en fast seksjon i rapport, eller kun for prosjekter der vi har kuratert innhold?
- Boundary-polygoner per strøk — trenger vi det for auto-matching, eller holder postnummer + nearest-center?

### Referanser
- `supabase/migrations/050_areas_hierarchy_strok.sql`
- `docs/brainstorms/2026-04-09-nabolagets-sjel-brainstorm.md`
- `docs/solutions/architecture-patterns/area-hierarki-strok-eiendom-20260409.md`
- `.claude/commands/generate-bolig.md` (oppdatert)

---

## 2026-04-09 — Report + Story merge: storytelling erstatter POI-grid

### Beslutninger
- **Report og Story merges** — for like produkter til å eksistere side om side. Story sin storytelling er det som manglet i Report.
- **Report er basen** — beholder sin infrastruktur (sticky kart med marker-pooling, floating nav, spørsmålsbokser, scroll-tracking). Story sin innholdsopplevelse merges inn.
- **POI-grid fjernet** — erstattet av narrativ tekst med inline-POI-lenker (fra story-text-linker). Klikk på POI-navn i teksten åpner 5-variant dialog OG synker med kartet.
- **Stats-rad fjernet** — "12 steder | Snitt ★ 4.2 | 2733 anmeldelser" per tema borte. Ratings hører til på de individuelle kortene.
- **60/40 layout** — tekst 60%, kart 40% (ned fra 50/50). Teksten er nå hovedinnholdet.
- **Story-fane deaktivert** — fjernet fra nav, koden beholdes inntil vi er sikre.
- **story-text-linker.ts** — flyttet fra Story til `lib/utils/` (delt mellom Report og Story).
- **ReportThemeSection** — fra ~530 linjer med grid/load-more/sub-sections til ~180 linjer med narrativ tekst + inline-POI.

### Parkert / Åpne spørsmål
- **Temaer uten inline-POI:** Mat & Drikke og Natur & Friluftsliv har narrativ tekst men ingen klikkbare POI-lenker. Tekst-linkeren matcher bare POI-navn som finnes verbatim i teksten. Curator-skapte extendedBridgeText for disse temaene bør nevne spesifikke POI-er.
- **Mobil kart:** Mobil har bare storytelling uten kart. Vurder å legge inn per-tema kart som Story hadde (StoryMap) for mobil.
- **ReportPOICard dead code:** Filen er fortsatt i repo men brukes ikke lenger av ReportThemeSection. Slettes sammen med annen opprydding.
- **ReportInteractiveMapSection:** Brukes av mobil-fallback men er nå bypassed — kan slettes.
- **Engelsk bridgeText:** Auto-generert bridgeText er på engelsk mens extendedBridgeText (fra Curator) er norsk. Bør harmoniseres.

### Retning
- **Unified Report er riktig.** Storytelling med inline-POI-lenker er en mye sterkere opplevelse enn POI-kort i grid. Meglere kjenner igjen formatet — det ligner hvordan de selv presenterer et område.
- **Neste steg:** Fylle inn extendedBridgeText for alle temaer via Curator (spesielt Mat & Drikke, Natur & Friluftsliv). Deretter mobil-kart per tema.
- **Story-koden kan slettes** når vi er sikre på at unified Report dekker alt. Bør vente minst én demo-runde.

### Observasjoner
- **Netto -112 linjer kode** (383 lagt til, 495 fjernet). Merge forenklet kodebasen.
- **Kart-synken fungerte umiddelbart** — ReportPage sin handlePOIClick() trengte ingen endring, bare å wire onPOIClick fra inline-POI til eksisterende callback.
- **HoverCard + Dialog-mønsteret** fra Story er direkte gjenbrukbart i Report uten tilpasning. God komponentdesign betaler seg.
- **Produktforenkling > produktekspansjon.** Å fjerne én fane (Story) og styrke en annen (Report) gir bedre brukeropplevelse enn to halvgode produkter.

---

## 2026-04-08 (sesjon 2) — Inline POI-kortsystem med 5 varianter

### Beslutninger
- **Modal dialog beholdes** — ikke inline fold-ut. Passer editorial leseflyt bedre.
- **Felles ramme + variabelt innhold** — alle kort deler header (ikon, navn, kategori, lukk). Innhold varierer: standard, transit, bysykkel, Hyre, skole.
- **Lazy datahenting** — transport-data hentes ved dialog-åpning, ikke sidelast.
- **Skoledata fra poiMetadata** — ikke nye felter på POI-interface, bruk type guard.
- **useRealtimeData fikset** — AbortController, Promise.allSettled, stabile deps. Latent bug som berørte hele plattformen, ikke bare Story.
- **Hyre API** — eget /api/hyre endepunkt (Entur Mobility v2 GraphQL). Fungerer, men hardkodet Trondheim-sentrum som scope.
- **Alt i én omgang** — bruker eksplisitt. Simplicity-reviewer anbefalte å vente med Hyre/skole (ingen demodata), men scope er hellig.

### Parkert / Åpne spørsmål
- **Hyre demodata:** Finnes det POI-er med `hyreStationId` i Brøset-prosjektet? Trenger manuell test.
- **Skole demodata:** Ingen skoler har `poiMetadata.schoolLevel` enda. Trenger Curator-arbeid.
- **Hyre API hardkodet Trondheim:** `lat: 63.43, lon: 10.4, range: 15000` — må parameteriseres for andre byer.
- **ExplorerPOICard Hyre-rendering:** Hooken returnerer nå Hyre-data, men Explorer har ingen renderer. Deferred bevisst.
- **Rate limiting på API-proxyer:** Entur, bysykkel, Hyre — alle mangler. OK for prototype, trenger fix før prod.

### Retning
- **Story er produktfokus.** Kortene er nøkkelen til brukerinnsikt. Neste naturlige steg: teste på mobil, fylle inn demodata for Hyre + skoler, og vurdere om variant-systemet bør eksponeres i Explorer også.
- **useRealtimeData-fiksen** (AbortController) er den viktigste tekniske leveransen. Den påvirker hele plattformen, ikke bare Story.
- **Rike kort > mange kort.** 5 varianter med kontekstuelt innhold er mye mer verdifullt enn 50 standard-kort. Retningen er riktig.

### Observasjoner
- **/full-workflow med deepen + 5 review-agenter** ga konkrete, handlingsbare forbedringer. AbortController-buggen ble flagget av alle 5 reviewere — klar signal om alvor.
- **Komposisjons-mønsteret** (én komponent med switch, ikke separate filer) holdt koden på ~250 linjer. Readable og maintainable.
- **Promise.allSettled** er underkjent mønster for multiple uavhengige datakilder. Bør brukes konsistent i hele prosjektet.
- **Brainstorming som gate fungerte godt.** 5 kortvarianter med prioritering var besluttet på under 5 minutter.

---

## 2026-04-08 — Story-visning: S&J-inspirert editorial storytelling

**Beslutning:** Story er nå produktfokus, ikke Report. Report er "kjedelig" (grid av POI-kort). Story = premium editorial article à la Sem & Johnsen nabolagsartikler.

**Hva vi bygde:**
- Research: 160 beliggenhetstekster fra 8 meglerkjeder analysert. S&J-dybdeanalyse med 7-stegs struktur, signaturkvaliteter, ordliste.
- `bridge-text-generator.ts` — auto-genererer S&J-kalibrert bridgeText per tema fra POI-data (template-basert, ingen LLM)
- Story-visning (`/story`-rute) med: heroIntro, 6 temakapitler, inline klikkbare POI-navn i prosa, POI-dialog, interaktivt Mapbox-kart per tema
- `story-text-linker.ts` — matcher POI-navn i narrativ tekst → klikkbare elementer

**Nøkkelinnsikt:** Interaktivitet i selve teksten (klikkbare stedsnavn → popup med detaljer) er mye sterkere enn separate POI-kort under teksten. Narrativ og data sydd sammen.

**Demo:** Brøset med komplett Curator-data (heroIntro + bridgeText + extendedBridgeText for alle 6 temaer)

**Neste steg:**
- Kart-overlay: "Utforsk kartet"-knapp som aktiverer interaktivitet (har bug med hydration/ssr — overlay rendres ikke, trenger fix)
- Megler-attribusjon i hero
- Livsstil-avslutning per tema ("Ideelt for barnefamilier som...")
- Tema-rekkefølge etter S&J-prioritet (karakter først, praktisk etterpå)
- Test på mobil

---

## 2026-02-10

### Beslutninger
- Opprettet PROJECT-LOG.md som steg 7 i /full-workflow
- Formål: strategisk prosjektminne på tvers av sesjoner — ikke teknisk logg, men beslutningsdagbok
- Trips-samleside redesignet med Apple Store-inspirert layout (feat/trips-samleside-redesign)
- Report: auto-splitting av store kategorier i subseksjoner implementert

### Parkert / Åpne spørsmål
- Skal Report ha egen landingsside eller leve under Guide?
- Rekkefølge på produktlansering: Explorer → Guide → Report, eller alle samtidig?

### Retning
- Aktivt arbeid på trips-samleside redesign
- Report-produktet nærmer seg ferdig (typografi, sticky map, subcategory splitting)

### Observasjoner
- Prosjektet drives av vibe coding — retning formes underveis, ikke i forhåndsdefinerte sprints
- Behov for sparringspartner-rolle, ikke bare utvikler-rolle — PROJECT-LOG er verktøyet for dette

---

## 2026-02-10 (sesjon 2) — POI Tier System Fase 1

### Beslutninger
- **Hybrid POI Tier System besluttet:** Claude-evaluering (Tier 1/2/3) + formel-score for sortering innenfor tiers
- **Formel-score:** `rating × log2(1 + reviews)` — balanserer kvalitet og popularitet. Testet mot Scandic Lerkendal (297 POIs), gir fornuftige resultater
- **Kjeder tagges, ikke straffes:** `is_chain` og `is_local_gem` booleans (Fase 2)
- **Maksimal metadata-innhøsting:** JSONB-felt for cuisine_type, vibe, best_for, third_party_recognition etc. — intern bruk, ikke front-end
- **To faser:** Fase 1 (bug fix + formel-score, levert i denne sesjonen) og Fase 2 (DB-migrasjon, Claude tier-evaluering, metadata)

### Levert (PR #25)
- Bug: Bakeri-seksjoner fikset — alle kategorier renderes som sub-sections når temaet er i sub-section-modus
- Formel-basert scoring erstatter ren rating-sort i Report sub-sections
- `calculateReportScore()` i `poi-score.ts` — følger `calculate*Score`-mønsteret
- 6 unit-tester for scoring-funksjonen (første tester i prosjektet!)
- Compound-dokumentasjon oppdatert med 4 gotchas

### Parkert / Åpne spørsmål
- **Discovery-prompt design:** Nøyaktig prompt for Claude tier-evaluering — krever iterasjon (Fase 2)
- **Re-generering:** Strategi for å oppdatere eksisterende prosjekter med tier-data
- **Kart-markører:** Bør Tier 1 POIs ha visuelt distinkte markører?
- **Front-end badges:** Når/om lokale perler skal fremheves visuelt i UI

### Retning
- Fase 2 av POI Tier System er neste store oppgave: DB-migrasjon, Claude som redaktør, bred nettsøk per POI
- Report-produktet har nå bedre kuratering — formelen gjør at highlights viser de "riktige" stedene
- Placy sin differensiering = redaksjonell kvalitet, ikke datamengde

### Observasjoner
- Vitest er nå satt opp og fungerer — bør vurdere å legge til tester for andre scoring-funksjoner
- /full-workflow fungerte godt: brainstorm → plan → tech-audit → work → code-review → compound → project-log
- Brainstorming-fasen var lang og strategisk viktig — ga retning for hele tier-systemet

---

## 2026-02-10 (sesjon 3) — POI Tier System Fase 2

### Beslutninger
- **Global tiers på `pois`-tabellen**, ikke per-produkt. Tier reflekterer intrinsisk POI-kvalitet. `featured` forblir per-produkt via `product_pois`
- **NULL_TIER_VALUE = 2.5** for partial rollout: unevaluerte POIs sorteres mellom Tier 2 og 3. Zero behavioral change uten tier-data — ren backward compatibility
- **Strikt null-check policy for editorial preservation:** `=== null` / `!== undefined`, aldri truthiness. Oppdaget i code review at `if (data.editorial_hook)` feiler for tomme strenger
- **Forenklet pickHighlights:** Kollapset 3-stegs cascade til 2 steg — prematur optimering fjernet
- **Tier-evaluering gjort manuelt i denne sesjonen:** 1000 POIs evaluert via web-søk + auto-assign. Ikke via Claude-prompt som opprinnelig planlagt — viste seg raskere å gjøre det i batch-script med manuelle tier-lister

### Levert (PR #26)
- DB-migrasjon 017: 6 kolonner + 4 partial indexes + navngitte CHECK constraints
- `byTierThenScore()` sort-komparator i Report og Explorer
- `updatePOITier()` mutation med editorial preservation
- `pickHighlights()` tier-aware: featured → Tier 1 → formula score
- Upsert-preservation oppdatert for 6 nye kolonner
- 4 unit-tester for `byTierThenScore`
- Compound-learnings med 7 gotchas
- **Alle 1000 POIs evaluert:** 33 Tier 1, 371 Tier 2, 596 Tier 3, 0 unevaluerte

### Parkert / Åpne spørsmål
- ~~Discovery-prompt design~~ → Løst pragmatisk med batch-script + manuelle tier-lister i denne sesjonen
- ~~Re-generering~~ → Upsert-preservation er implementert, nye kolonner bevares
- **Kart-markører:** Bør Tier 1 POIs ha visuelt distinkte markører? (fortsatt åpent)
- **Front-end badges:** Når/om lokale perler skal fremheves visuelt i UI (fortsatt åpent)
- **Hotel-kategori er full av feilklassifiserte POIs:** kontorer, stadioner, butikker. Google Places-import trenger bedre kategori-filtrering
- **Null-kategori POIs:** 15 POIs med `category_id = null` — dataimport-artefakter som bør ryddes opp

### Retning
- POI Tier System er **ferdig og operativt**. Sortering i Report og Explorer er nå tier-aware. Differensieringen mellom lokale perler og kjeder er synlig i data
- Neste naturlige steg er **visuell differensiering**: kart-markører, badges, "Anbefalt"-tags i UI
- Alternativt: gå videre til andre produktforbedringer (Guide, Explorer) nå som data-laget er solid
- Report-produktet er nå i god form: subcategory splitting + tier-sortering + formula scoring

### Observasjoner
- **Tier-evaluering var overraskende effektivt som batch-prosess:** 1000 POIs evaluert på ~20 minutter med web-søk for kvalitetskategorier og auto-assign for infrastruktur. Opprinnelig plan var Claude-prompt per POI — batch var 10x raskere
- **Code review fant reelle bugs:** Truthiness-bug i editorial guard og type safety-hull i TierFields. 3 parallelle review-agenter (TypeScript, data integrity, simplicity) ga god dekning
- **Misklassifiserte POIs er et datakvalitetsproblem:** Hotel-kategorien har ~25 ikke-hoteller (kontorer, butikker, stadioner). Dette er en Google Places-import-svakhet som bør adresseres systematisk
- **Scope ble holdt:** Fristelsen til å legge til front-end badges og kart-markører var der, men vi holdt oss til data+sortering. Visuell differensiering er neste feature, ikke del av denne
- **Prosjektet nærmer seg et punkt der data-kvalitet > ny funksjonalitet.** Tier-systemet, editorial hooks, trust scores — alt handler om å gjøre eksisterende data bedre. Det er riktig prioritering for Placy sin differensiering

---

## 2026-02-10 (sesjon 4) — Report bug fixes + layout

### Beslutninger
- **60/40 layout split** for desktop Report: innholdspanel trenger mer plass enn kartet. 50/50 klippet kompakte kort ved 1280px viewport
- **12 kompakte kort** før "Vis meg mer" (opp fra 6). Gir bedre inntrykk av dybde i hver kategori
- **IntersectionObserver sub-section preference**: Når forelderen (tema) vinner piksel-konkurransen, sjekk om en sub-section er den egentlige "aktive". Uten dette ble aldri sub-sections valgt

### Levert (PR #27)
- Fix: IntersectionObserver velger nå sub-sections korrekt (ikke bare parent-tema)
- Fix: Marker pool i ReportStickyMap inkluderer sub-section POIs (ikke bare tema-level)
- Fix: Layout 50/50 → 60/40 — kompakte kort klippes ikke lenger av kartet
- INITIAL_VISIBLE_COUNT 6 → 12
- Compound-dokumentasjon: `docs/solutions/ui-bugs/report-subsection-markers-layout-overlap-20260210.md`

### Parkert / Åpne spørsmål
- **Kart-markører:** Bør Tier 1 POIs ha visuelt distinkte markører? (fortsatt åpent)
- **Front-end badges:** Når/om lokale perler skal fremheves visuelt i UI (fortsatt åpent)
- **Hotel-kategori misklassifisering:** kontorer, stadioner, butikker (fortsatt åpent)
- **Responsiv grenseverdi:** 60/40 fungerer på 1280px+, men er ikke testet på nøyaktig 1024px (lg breakpoint). Kan trenge justering

### Retning
- Report-produktet er nå **funksjonelt komplett**: sticky map, sub-sections, tier-sortering, korrekt scroll-tracking, respons layout
- Neste steg bør være **visuell polering** eller gå videre til andre produkter (Explorer, Guide)
- Datakvalitet-arbeid (misklassifiserte POIs, null-kategorier) er fortsatt relevant men ikke blokkerende

### Observasjoner
- **Bugs kom fra sub-section splitting (PR #25/26):** Tre uavhengige bugs oppsto fordi sub-section-konseptet ble lagt til uten å oppdatere alle consumers. IntersectionObserver, marker pool, og layout ble alle designet for flat tema-struktur. Lærdom: når du legger til et nytt nesting-nivå, sjekk ALLE steder som itererer over det gamle nivået
- **Chrome DevTools MCP var nyttig for debugging:** Kunne scrolle til Kafé-seksjonen, ta screenshot, og verifisere 60/40-fiksen direkte — uten å bytte vindu
- **TypeScript narrowing-quirk:** `let` i `.forEach()`-closure narrowes til `never`. Bruk indexed `for`-loops eller `Array.from()` + `.entries()` i stedet
- **Prosjektet er i "polering"-fase:** De store arkitekturbeslutningene er tatt. Nå handler det om å gjøre ting riktig, ikke nytt

---

## 2026-02-11 — Strategisk: Placy som POI-database / IP

### Kontekst
Observasjon fra Redfin sin "Neighborhood"-fane: de bruker **Foursquare** som POI-dataleverandør. Redfin eier null POI-data selv — alt er innkjøpt. Dette er standarden i bransjen: konsument-lag kjøper data fra dataleverandør-lag.

### Strategisk innsikt
Placy bygger potensielt **verdifull IP** gjennom sin POI-database. To typer punkter:

1. **Google-sourcede POIs:** Hentet via Places API. Rådataene (koordinater, navn, adresse, kategori) er fakta og ikke opphavsrettslig beskyttet. Men Google sine proprietære felter (anmeldelser, bilder, place_id) kan ikke beholdes/videreselges. Over tid bør avhengigheten til Google reduseres.

2. **Native Points:** 100% egne POI-er, skapt redaksjonelt. Dette er ren IP — editorial hooks, local insights, kuratering, tier-klassifisering, relasjoner til Guides/Reports.

### Hva som er IP vs. commodity

| Data | Eierskap | IP-verdi |
|------|----------|----------|
| Koordinater, navn, adresse, kategori | Fakta — ingen eier | Lav (commodity) |
| Google-anmeldelser, bilder, place_id | Google eier | Null (kan ikke beholdes) |
| Editorial hooks, local insights | **Placy eier** | **Høy** |
| Kuratering (hvilke POIs, rekkefølge, tier) | **Placy eier** | **Høy** |
| Relasjoner (POI→Guide, POI→Report) | **Placy eier** | **Høy** |
| Metadata (vibe, best_for, cuisine_type) | **Placy eier** | **Høy** |

### Retning — ha i bakhodet hele veien
- **Bygg native points bevisst.** Hver Guide og Report som lages beriker POI-databasen med kuratert, kontekstuell data som Google/Foursquare ikke har.
- **Gradvis løsrivelse fra Google:** Google som hull-fyller, ikke primærkilde. Egne data først, Google for det vi mangler.
- **Foursquare-modellen er inspirasjonen:** De pivoterte fra consumer-app til B2B dataleverandør. Placy kan potensielt selge nabolagsanalyse / POI-data til eiendom, kommune, reiseliv.
- **Differensieringen er kontekst, ikke volum.** Google vinner alltid på antall. Placy sin styrke er kuratert, redaksjonell, norsk/nordisk kontekstuell POI-data.
- **Alle tre produktene produserer data:** Explorer, Guide, og Report er ikke bare konsumenter av POI-data — de er produsenter. Nettverkseffekten er reell.

### Beslutning
- Dette er en **bakgrunnsstrategisk retning**, ikke en umiddelbar feature. Men den skal påvirke alle designvalg fremover: prioriter native points, berik eksisterende data, reduser Google-avhengighet gradvis.

---

## 2026-02-13 — Map Popup Card + Layout 50/50

### Beslutninger
- **Accordion expand fjernet fra Report-kortlista.** All detaljert POI-info (bilde, editorial, åpningstider, action-knapper) flyttes til en popup-card som rendres over markøren i kartet. Inspirert av pilegrimsleden.no/kart sitt mønster.
- **Layout 50/50** (tilbake fra 60/40 i sesjon 4). Med accordion borte trenger kompakte kort-rader mindre plass. 50/50 gir kartet nok rom til popup-kortet.
- **Popup som Marker child** i react-map-gl — ingen manuell koordinat→piksel-konvertering. Mapbox håndterer posisjonering automatisk.
- **On-demand data-fetching** for åpningstider — hentes kun når popup åpnes, ikke for alle kort i lista.
- **Transit/sanntidsdata droppet fra Report.** Realtime bysykkel/buss var i accordion-viewet. Ikke inkludert i popup — akseptabelt fordi transit er mest relevant i Explorer, ikke i en redaksjonell artikkel.

### Levert
- `MapPopupCard.tsx` — ny komponent med bilde, editorial hook, local insight, åpningstider, action buttons
- Bidireksjonell interaksjon: kort→markør (flyTo + popup) og markør→kort (scroll + popup)
- Code review: fikset race condition i dual useEffects, CSS.escape for sikker querySelector, O(1) poiById lookup
- Compound-dokumentasjon: `docs/solutions/feature-implementations/report-map-popup-card-20260213.md`

### Parkert / Åpne spørsmål
- ~~Kart-markører visuell differensiering~~ → Levert i forrige sesjon (tier badges, sizing, tooltips)
- **Popup nær kartkant:** Kan bli klippet av. Ikke løst — Mapbox flyTo sentrerer markøren, men edge cases finnes. Akseptabelt risiko.
- **Hotel-kategori misklassifisering:** kontorer, stadioner, butikker (fortsatt åpent)
- **Null-kategori POIs:** 15 POIs med `category_id = null` (fortsatt åpent)

### Retning
- Report-produktet har nå en **klar interaksjonsmodell**: kompakt liste + detaljert popup på kart. Mye renere enn accordion + kart side ved side.
- Neste naturlige steg for Report: polering av popup (edge-cases, animasjon) eller gå videre til andre produkter.
- **Tre uløste datakvalitetsproblemer** (hotel-misklassifisering, null-kategorier, Google-avhengighet) akkumulerer. Ingen er blokkerende, men de eroderer kvaliteten gradvis.

### Observasjoner
- **Fjerne ting er ofte bedre enn å legge til.** Å fjerne 278 linjer accordion-kode og erstatte med et fokusert popup-kort ga en renere opplevelse. Report-visningen er nå enklere å forstå.
- **Code review fant reelle bugs igjen:** Race condition i useEffect var subtil — to effects med ulike deps som delte en ref. Ville trolig manifestert seg som "åpningstider forsvinner" i produksjon.
- **MapBox `Map` import-konflikt med JS `Map`** — gotcha som bør huskes. Bruk `Record<K,V>` i filer som importerer react-map-gl.
- **Prosjektet er i "raffinering"-modus.** Arkitekturen er stabil. Endringene handler om å forbedre interaksjonsdesign innenfor eksisterende rammeverk.

---

## 2026-02-13 (sesjon 2) — Brainstorm: Urbex / Abandoned Places som trafikk-magnet

### Kontekst
Inspirert av viral Facebook-post fra "DelloS - Urbex": forlatt KFC bucket-restaurant utenfor Dayton, Ohio. 19K reaksjoner, 1.8K kommentarer, 6.1K delinger. Urbex/abandoned places-innhold er ekstremt engasjerende på sosiale medier — folk elsker å oppdage merkelige, forlatte, glemte steder.

### Idé
**Placy Explorer som worldwide kart over "triggerende" POIs** — forlatte bygninger, urban exploration-steder, kuriøse arkitektoniske relikter, ghost towns, abandoned theme parks, osv. Et Atlas Obscura møter Google Maps.

### Hvorfor dette passer Placy
- **Explorer er allerede et kartnativt grensesnitt.** POIs på et kart er core UX. Å vise "abandoned KFC bucket" som en markør på kartet er nøyaktig det Explorer gjør.
- **Innholdet er self-amplifying.** Hvert sted er en potensiell viral post. Brukere deler steder → trafikk → flere brukere. Sosiale medier som gratis distribusjon.
- **Data er knapp og verdifull.** Det finnes ingen god, kuratert, kartbasert database over slike steder. Google Maps viser dem ikke. Atlas Obscura har tekst, men dårlig kartopplevelse. **Placy kan eie denne nisjen.**
- **Passer IP-strategien** (jf. 2026-02-11): Hvert sted med editorial hook + local insight + bilder = native point med høy IP-verdi.
- **Lavt krav til lokal kunnskap.** I motsetning til nabolagsguider (som krever norsk/nordisk kontekst), er urbex et globalt fenomen. En forlatt fabrikk i Detroit og en ghost town i Namibia er like interessante.

### Trafikkpotensial
- Urbex-communities er massive: r/AbandonedPorn (3M+ members), r/urbanexploration, Facebook-grupper med millioner
- Hvert enkelt sted har viral potensial (som KFC-bucketen: 6.1K shares fra én post)
- SEO-potensial: "abandoned places near me", "urban exploration map", "abandoned buildings [city]" — alle er high-intent, low-competition søk
- Kartformatet gir en grunn til å komme TILBAKE (vs. én artikkel = one-time visit)

### Utfordringer / Åpne spørsmål
- **Innholdsinnhøsting i skala:** Hvor kommer dataene fra? Manuell kuratering skalerer ikke til worldwide. Crowdsourcing? Scraping av urbex-communities? Partnerskap?
- **Juridiske gråsoner:** Noen urbex-steder er ulovlig å besøke. Placy kan ikke promotere ulovlig trespass. Trenger policy/disclaimer.
- **Kvalitetskontroll:** Mange steder er revet, renovert, eller ikke-eksisterende lenger. Dataene foreldes raskt.
- **Monetisering:** Trafikk er fint, men hva er business-modellen? Ads? Premium-features? Guidede turer?
- **Kannibaliseringsrisiko:** Utvanner dette Placy sin nordiske nabolags-identitet? Eller er det en separat vertikal?

### Mulige tilnærminger
1. **Dedikert vertikal under Explorer:** "Abandoned & Curious" som egen kategori, worldwide
2. **Separat produkt/subdomain:** abandoned.placy.no — rendyrket for denne nisjen, lenker tilbake til Placy-økosystemet
3. **Community-drevet:** La brukere legge til steder (wiki-modell), Placy kuraterer og beriker
4. **Innholds-partnerskap:** Samarbeid med urbex-fotografer/influencere som DelloS — de får eksponering, Placy får innhold

### Beslutning
- **Droppet.** Research viste at datakilder finnes (OSM har 300K+ abandoned/ruins POIs, plus dedikerte urbex-databaser), men det finnes allerede flere leverandører som eier denne nisjen: UrbexVault (7K+ steder), Urbex-Map, EasyUrbex, UER.ca (10K+), Forbidden Places. Placy sin differensiering ligger i kuratert norsk/nordisk kontekstuell data — ikke i å konkurrere med etablerte urbex-plattformer.

### Observasjoner
- **Viralitet ≠ business.** 6.1K shares er imponerende, men konvertering til gjentatte brukere krever produktverdi utover wow-faktoren.
- **Timing er god.** Urbex har blitt mainstream (Netflix-dokumentarer, YouTube-kanaler med millioner subs). Markedet er modent, men ingen eier kartopplevelsen.
- **Placy sin kartteknologi er overførbar.** Explorer-kodebasen kan vise ethvert POI-dataset. Å legge til en ny kategori er teknisk trivielt — utfordringen er data, ikke kode.

---

## 2026-02-13 (sesjon 3) — Riksantikvaren-import: Fredede bygninger Explorer

### Kontekst
Byantikvaren i Trondheim sitter i samme etat som Byarkitekten (allerede kontakt via prisbelønnet arkitektur-prosjektet). Riksantikvaren har åpent ArcGIS REST API med daglig oppdaterte kulturminner — 200 fredede bygninger i Trondheim med rike beskrivelser, datering, materialer, vernestatus. Idéen: vis Byantikvaren deres egne data i en Placy Explorer, som inngang til Trondheim kommune.

### Beslutninger
- **Ny Explorer under eksisterende kunde:** `trondheim-kommune/fredede-bygninger/explore` — ved siden av `prisbellonnet-arkitektur`, ikke erstatning
- **Riksantikvaren ArcGIS API som datakilde:** Layer 1 (FredaBygninger), GeoJSON med outSR=4326. Åpen data, NLOD 2.0-lisens, ingen API-nøkkel
- **Kategorisering basert på opprinnelig funksjon:** 6 kategorier — Kirker og kapell, Bolighus, Forsvar og militært, Helse og pleie, Næring og handel, Utdanning og kultur, Øvrige kulturminner
- **`informasjon`-feltet som editorial_hook:** Fagspråk fra Riksantikvaren, ikke bearbeidet ennå. Rikt nok til å vise verdi, kan forbedres med Claude-omskriving senere
- **Full metadata i poi_metadata JSONB:** datering, materiale, vernetype, vernedato, SEFRAK-ID, Kulturminnesøk-lenke, Askeladden-lenke, matrikkelnummer. Alt bevart for fremtidig bruk
- **Stabile POI-IDer:** `ra-{lokalId}` — basert på Riksantikvarens egen ID, overlever re-import

### Levert
- `scripts/import-riksantikvaren.ts` — importscript med paginering, kategorisering, dual table-linking (project_pois + product_pois)
- 200 fredede bygninger importert med editorial hooks og full metadata
- Explorer live på `/for/trondheim-kommune/fredede-bygninger/explore`
- Branch: `feat/riksantikvaren-import` (worktree)

### Parkert / Åpne spørsmål
- **Editorial bearbeiding:** `informasjon`-feltet er fagspråk ("grovpusset murhus", "saltak med skifer av type fasett"). Bør omskrives til engasjerende tekst med Claude — men fungerer som demo ubearbeidet
- **Kirker mangler:** Nidarosdomen og andre middelalderkirker er ikke i FredaBygninger-laget (de er i Enkeltminner, layer 4). Vurder å legge til utvalgte fra layer 4
- **100 "Øvrige kulturminner":** Kategorien er for bred — mange av disse kunne fått mer spesifikke kategorier (gårdsbygninger, brygger, etc.) med bedre keyword-matching
- **Bilder mangler:** API-et har ingen bilder. Kulturminnesøk-websiden har noen, men krever scraping. Egne foto eller SEFRAK-arkivbilder er bedre langsiktig
- **Chrome MCP var låst:** Kunne ikke ta visuell screenshot — en annen sesjon hadde Chrome-profilen. Visuell validering gjenstår

### Retning
- **Demoen er klar for Byantikvaren.** 200 fredede bygninger på kart med kategorier, beskrivelser, og metadata. Kan vises som-det-er.
- **Korridoreffekten er strategien:** Byarkitekt → Byantikvaren → Kulturavdelingen → Næringsavdelingen. Placy som "kommunens kartverktøy"
- **Neste berikelse:** Claude-omskriving av editorial hooks (fagspråk → engasjerende), bilder, og eventuelt layer 4-data (middelalderkirker, ruiner)

### Observasjoner
- **Åpne data er en gullgruve for Placy.** 200 POIs importert på ~20 minutter. Ingen API-nøkkel, ingen avtale, ingen kostnad. Og dataen er rikere enn Google Places for kulturminner.
- **Dual table-linking var en gotcha.** `project_pois` (container-pool) og `product_pois` (produkt-filter) må begge populeres. Import-kml bruker bare project_pois, men det fungerer fordi admin-UI lager product_pois etterpå. For scripts som lager hele stacken trenger man begge.
- **ArcGIS REST API er overraskende robust.** GeoJSON-output, paginering, spatial queries, WGS84-projeksjon. Mye bedre enn forventet for en offentlig norsk tjeneste.
- **Placy sin kartteknologi er overførbar (bekreftet).** Fra idé til fungerende Explorer med 200 POIs: ~45 minutter. Kodebasen håndterer nye datasett uten endringer — bare importscript + data.

---

## 2026-02-13 (sesjon 4) — PageSpeed: Statisk kart + quick wins

### Kontekst
PageSpeed Insights for `/trondheim/bakerier` viste **6.9s hovedtråd-arbeid** på desktop. Årsak: `mapbox-gl.js` (4.3 MB) parses + evalueres + WebGL-init uansett defer-strategi. Performance trace bekreftet: Mapbox stod for 575 kB transfer og hele Script Evaluation-kostnaden.

### Beslutninger
- **Statisk kartbilde som placeholder:** Mapbox Static Images API (server-side URL) rendres som `<img>` — null JavaScript. Interaktivt kart lastes først ved hover/klikk på kartområdet
- **`next/font` for Inter:** Self-hosted via Google Fonts subsetting, `display: swap`, CSS-variable `--font-inter`. Eliminerer FOIT og gir Lighthouse-signal for font-optimering
- **Plausible analytics → `lazyOnload`:** Fra `afterInteractive` (hydration-tid) til browser-idle. Plausible dukker ikke lenger opp i Third Party-insight
- **Preconnect til Mapbox API:** `<link rel="preconnect">` + `dns-prefetch` for statisk kartbilde
- **CategoryHighlights LCP-prioritet:** Første 2 bilder i "Redaksjonens favoritter" får `priority` i stedet for `loading="lazy"` — disse er above-the-fold
- **Fjernet død dark mode CSS:** Placy har ikke dark mode, men `globals.css` hadde `prefers-color-scheme: dark` overrides og `.dark` skeleton-stiler

### Levert
- Statisk kart med "Hold over for interaktivt kart" overlay → hover trigger → fade-in overgang (500ms opacity)
- `GuideStickyMap` fikk ny `onLoad` prop for å signalisere når Mapbox er ferdig
- Mobil-flow uendret (allerede bak toggle-knapp)
- Inter font self-hosted med fallback-chain: `__Inter_f367f3, __Inter_Fallback_f367f3, Inter, system-ui, sans-serif`

### Verifisert (Performance Trace)
- **LCP: 166ms** (localhost), **CLS: 0.00** — ingen layout shift fra font
- **Mapbox: 575 kB transfer, 0ms main thread** — statisk placeholder fungerer
- **Plausible: ikke synlig** i third party insight (lazyOnload)
- **Render-blocking:** Kun CSS (27ms) — minimalt

### Parkert / Åpne spørsmål
- **Mapbox chunk i bundle:** 575 kB lastes ned men parses ikke. Ideelt sett skulle den ikke lastes i det hele tatt før hover. Men dynamic import + ssr:false betyr at webpack likevel inkluderer chunken som prefetch. Potensielt løsbart med `next/dynamic` loading-funksjon, men lav prioritet siden main thread ikke blokkeres
- **ReportHighlightCard bruker `<img>` i stedet for `<Image>`:** Påvirker Report-varianten, ikke public SEO-sider. Lav prioritet
- **Admin/Public bundle split:** Potensielt 6-8 Lighthouse-poeng å hente ved å separere admin-ruter i egen layout-gruppe. Høy effort, medium gevinst

### Retning
- **PageSpeed-optimeringene er levert.** De gjenværende gevinstene (bundle splitting, admin-separering) er høy-effort med avtagende utbytte
- **Neste steg bør måles i produksjon:** Deploy til Vercel og kjør PageSpeed Insights på placy.no/trondheim/bakerier for reelle tall
- **Mapbox-kostnad er nå bruker-initiert:** Ingen JS-kostnad i Lighthouse — kartet laster kun ved interaksjon

### Observasjoner
- **Statisk kartbilde var en elegant løsning.** Null JS, instant render, smidig overgang. Brukeren merker ikke byttet — kartet "blir interaktivt" plutselig
- **`next/font` er en gratis seier.** Self-hosting + subsetting + swap = bedre font-loading enn manuell `@font-face`. Bør alltid brukes
- **Performance trace på localhost er misvisende for absolutte tall** (LCP 166ms er urealistisk rask). Men relative forskjeller og third-party-analyse er nyttige. Produksjonstall fra PageSpeed Insights er den endelige sannheten

---

## 2026-02-14 — Mobil LCP-optimalisering: Google CDN-URLer

### Beslutninger
- **Resolve Google photo redirect-URLer ved ISR-tid.** Kategorisiden resolver nå de 2 første editorial highlight-bildenes Google Places photo-referanser til direkte `lh3.googleusercontent.com`-URLer. Eliminerer 2 nettverkshopp (serverless proxy + Google API 302 redirect)
- **Beholdt proxy for øvrige bilder.** Kun LCP-bildene (de 2 første highlight-kortene) resolves — resten bruker fortsatt `/api/places/photo`-proxyen. Balanserer Google API-kall vs brukeropplevelse
- **Forbedret CDN-caching.** `s-maxage` + `stale-while-revalidate` på foto-proxy + `minimumCacheTTL: 2592000` i next.config for `/_next/image`

### Resultater — Produksjon (placy.no/trondheim/bakerier)
| Metrikk | Desktop | Mobil (før) | Mobil (etter) |
|---------|---------|-------------|---------------|
| Performance | 99 | 85 | **97** |
| LCP | 0.8s | 4.4s | **2.6s** |
| TBT | 0ms | 0ms | 0ms |
| CLS | 0 | 0 | 0 |

### Parkert / Åpne spørsmål
- **`photo_reference` er NULL i databasen** for mange POI-er — referansen er bakt inn i `featured_image`-URL-en som proxy-sti. Ideelt bør `featured_image` inneholde direkte CDN-URLer (ikke proxy-stier), og `photo_reference` bør synces periodisk fra Google for å unngå utløpte referanser
- **Mobil LCP 2.6s er gul, ikke grønn.** De gjenstående ~1.7s skyldes render-blocking CSS (uunngåelig med Next.js) og bildestørrelse på Slow 4G. Å komme under 2.5s krever enten inlining av kritisk CSS eller vesentlig mindre bilder
- **Google photo-referanser utløper.** Resolve-funksjonen feiler gracefully (faller tilbake til proxy-URL), men bilder vil til slutt bli 404 uten periodisk refresh fra Google Places API

### Retning
- **PageSpeed er nå god nok.** 97 mobil, 99 desktop. Videre forbedring krever dyptgående arkitekturendringer (kritisk CSS, bildepipeline) med avtagende utbytte
- **Neste naturlige steg:** Refresh `photo_reference`/`featured_image` til direkte CDN-URLer for alle POI-er via batch-jobb — fjerner proxy-avhengigheten helt

### Observasjoner
- **`featured_image` i DB inneholder proxy-URLer**, ikke direkte bilde-URLer. Dette var en overraskelse. Det betyr at all bildelasting alltid gikk gjennom serverless-funksjonen, selv når `featuredImage` var satt
- **Google Places Photo API redirecter konsistent** til `lh3.googleusercontent.com/places/...` eller `/place-photos/...`. URL-ene er stabile og offentlige (ingen API-nøkkel). Trygt å cache og eksponere

---

## 2026-02-14 (sesjon 2) — Placy Editorial Voice & Style Guide Skill

### Beslutninger
- **Claude Code skill** (`.claude/skills/placy-editorial/`) — prosjektnivå, versjonskontrollert, delt med alle som jobber i repoet
- **Destillert fra 72 inspirasjoonstekster:** 35 Sem & Johnsen beliggenhetsbeskrivelser, 11 Anders Husa restaurantanmeldelser, 13 Monocle/Kinfolk stedsbeskrivelser, 13 Lonely Planet/Visit Norway/Culture Trip korte beskrivelser
- **Én stemme, fem registre:** Michelin/finedining, håndverksbakeri/kafé, hverdagssted, nabolag/område, opplevelse/museum — hver med ulik vektlegging og tone
- **6 prinsipper med kildehenvisning:** Navngi (Sem & Johnsen), Bevegelse (Sem & Johnsen + Kinfolk), Kontraster (Sem & Johnsen + LP), Saklig entusiasme (Anders Husa + Monocle), Mennesker (Anders Husa + Monocle), Sensorisk presisjon (Monocle + Kinfolk + LP)
- **4 strukturmønstre fra reiseguidene:** Location+Feature+Get, Historical Hook+Current, Sensory Opening+Practical, Declarative Claim+Evidence
- **Viktig lærdom: Skills trenger kildemateriale, ikke bare oppsummeringer.** Første versjon var basert på brainstorm-sammendraget — for tynn til at Claude kunne kalibrere tonen. Omskrevet med faktiske sitater fra kildene per prinsipp.

### Levert
- `.claude/skills/placy-editorial/SKILL.md` — hovedfil med stemme, sjekkliste, hurtigreferanse (113 linjer)
- `references/voice-principles.md` — 6 prinsipper med faktiske sitater fra de 72 kildene (194 linjer)
- `references/text-type-specs.md` — strukturmønstre, stil-DNA per kilde, register-maler (207 linjer)
- `references/before-after-examples.md` — 5 reelle sammenligninger fra 021→025 + destilleringsteknikk (154 linjer)
- `docs/solutions/best-practices/editorial-voice-skill-from-inspiration-texts.md`

### Parkert / Åpne spørsmål
- **Kafé 021-migrasjonen bør skrives om.** Nå har vi skillen som definerer kvalitetsnivået — de 16 kafé-hookene fra 021 er under standard. Kan gjøres som neste editorial-migrasjon
- **Persontillatelser:** Når vi navngir grunnleggere/kokker — trenger vi samtykke? Sannsynligvis ikke for offentlig info (allerede publisert i Anders Husa, Google, etc.), men verdt å sjekke
- **Nye kategorier:** Opplevelse/museum-registeret er definert men ikke testet med reelle data ennå. Bør valideres mot faktisk innhold (f.eks. Riksantikvaren-dataen)

### Retning
- **Skillen er klar for bruk.** Neste gang vi skriver editorial innhold (ny kategori, ny by, omskriving av svake hooks) trigges den automatisk
- **Kafé-omskrivning er lavthengende frukt.** 16 hooks som vi vet er under standard + ferdig skill som definerer standard = rask kvalitetsheving
- **Visit Trondheim-pakkene kan bruke skillen.** Guide-hooks og landing page-tekster bør følge same voice

### Observasjoner
- **Skills trenger kildemateriale, ikke oppsummeringer.** Den viktigste lærdommen fra denne sesjonen. En skill som sier "bruk sensorisk presisjon" er mye svakere enn en som viser "bright blue chairs, brass details, raw wood" (Monocle) og "pastel-hued wooden buildings on the car-free, cobbled streets" (Lonely Planet). Claude trenger eksempler for å kalibrere, ikke regler for å følge.
- **Register-differensiering var det brukeren trengte.** Brainstormen landet på "én stemme, tilpasset register" — men første implementering hadde bare én mal per teksttype. Uten maler per register er prinsippet verdiløst i praksis.
- **Destillering > kopiering.** Spontan-eksemplet i before-after viser teknikken: ta Anders Husas 200-ords anmeldelse og komprimer til 2 setninger med høyere presisjon enn originalen. Placy er mer presist enn kildene fordi vi komprimerer mer.
- **72 tekster er nok til å definere en stemme.** Man trenger ikke hundrevis — man trenger diversitet (4 ulike sjangre) og grundig analyse. Sem & Johnsen ga bevegelse, Anders Husa ga mennesker, Monocle ga materialitet, LP ga struktur. Sammen dekker de hele spekteret.

---

## 2026-02-14 (sesjon 3) — Visit Trondheim Demo-pakke

### Kontekst
cityguide.no leverer brosjyrer via Visit Trondheim, men er en tynn katalogside uten redaksjonelt innhold, kart, eller kuratering. Placy har 1853 POIs med tier-rangering, editorial hooks, og kartopplevelse. Mål: bygge en dedikert demo som viser Visit Trondheim hva Placy kan tilby som partner.

### Beslutninger
- **Standalone `/visit-trondheim`-rute** (ikke under `[area]`) — unngår kollisjon med dynamisk area-routing, gir dedikert URL å dele med Visit Trondheim
- **Multi-kategori-filter (`categoryIds`)** i `getCuratedPOIs` — Supabase `.in()` for å hente flere kategorier i én query. Bakoverkompatibelt med eksisterende `categoryId`
- **7 tematiske guider** (3 eksisterende + 4 nye): beste-restauranter, badeplasser, bakklandet, historisk-byvandring, smak-trondheim, familievennlig, uteservering-og-uteliv
- **Engelsk guide-rute** (`/en/[area]/guide/[slug]`) — manglet helt, nå speiler norsk versjon med `titleEn`, `slugEn`, engelske labels
- **`slugEn` på CuratedList** — gjør at engelske URLer kan ha egne slugs (`taste-trondheim` i stedet for `smak-trondheim`)
- **`locale` prop i GuideMapLayout** — for korrekt lenke-generering (`/en/{area}/places/` vs `/{area}/steder/`)

### Levert
- `/visit-trondheim` + `/en/visit-trondheim` — landingssider med hero-kart, 7 guider, turistkategorier, redaksjonens favoritter, partnerskaps-CTA
- `/trondheim/guide/historisk-byvandring` — sightseeing + museum, 19 steder
- `/trondheim/guide/smak-trondheim` — restaurant + cafe + bakery + bar, Tier 1, 28 steder
- `/trondheim/guide/familievennlig` — lekeplass + museum + park + badeplass
- `/trondheim/guide/uteservering-og-uteliv` — bar + restaurant, Tier 1
- Alle 7 guider på engelsk (`/en/trondheim/guide/...`)
- Sitemap med 16 nye guide-URLer + 2 visit-trondheim-URLer
- Header-nav: "Besøk Trondheim" / "Visit Trondheim"
- Migrasjon 026: editorial hooks + local insights for 12 museer (Nidarosdomen, Rockheim, Ringve, Erkebispegården, Vitenskapsmuseet, Rustkammeret, Kunstmuseum, Nordenfjeldske, Stiftsgården, Sverresborg, Sjøfartsmuseum, Jødisk Museum)

### Verifisert
- Alle sider 200 OK, TypeScript null feil
- Screenshots av landingsside, guider (NO+EN), museum POI-side med editorial hooks
- Sitemap inkluderer alle nye URLer
- Migrasjon 026 kjørt mot produksjon

### Parkert / Åpne spørsmål
- **Engelsk layout bruker norsk header/footer:** `(public)/layout.tsx` passer `locale="no"` til alle sider. EN-sider under `/en/` arver dette. Bør fikses med layout-gruppe eller middleware, men er et pre-eksisterende problem
- **Guide-kort på landingssiden mangler POI-count:** Planen sa "antall steder" per guide-kort, men å hente counts for 7 guider server-side er 7 ekstra queries. Droppet for å holde ISR-ytelsen god
- **Kafé 021-hooks under standard:** Nå som editorial voice skill er definert, bør de 16 kafé-hookene fra migrasjon 021 skrives om

### Retning
- **Demo-pakken er klar til å vises frem.** URL-er kan deles direkte med Visit Trondheim-kontakter
- **Neste steg for partnerskap:** Eventuelt tilpasse CTA-seksjonen med mer konkret value proposition, legge til kontaktskjema
- **Museum-editorial kan utvides:** 12 museer har hooks nå — sightseeing-kategorien (severdigheter) mangler fortsatt editorial. Kristiansten festning, Gamle Bybro, etc.

### Observasjoner
- **Multi-kategori-filteret var en minimal endring med stor effekt.** Én linje Supabase (`.in()`) åpnet for 4 nye tematiske guider som krysser kategorier. Smak Trondheim med 28 steder fra 4 kategorier er mye rikere enn én enkelt kategori
- **Landingssiden gjenbruker 100% eksisterende komponenter.** Ingen nye UI-komponenter ble laget — alt er kategori-grid, guide-kort, highlight-kort, SaveButton fra `[area]/page.tsx`. God arkitektur betaler seg
- **Museum-research med background agent var effektivt.** 12 museer researched og verifisert via web-søk mens hovedarbeidet fortsatte. Parallelisering fungerte godt
- **10 filer, 1044 linjer — men strukturen er enkel.** Mye av koden er ren markup (landingssider) og data (guide-definisjoner + SQL). Logikk-endringene er minimale (3 linjer i public-queries, 15 linjer i GuideMapLayout)

---

## 2026-02-14 (sesjon 4) — Admin: Offentlige sider — inventaroversikt

### Beslutninger
- **Read-only inventar, ikke CMS.** Formålet er å se hva som er produsert, med tellere og lenker. Redigering er ikke i scope
- **Både Dashboard-sammendrag + dedikert `/admin/public`-side.** Dashboard gir nøkkeltall på ett blikk, detaljsiden gir full oversikt per område
- **`createPublicClient()` (untyped), ikke `createServerClient()`.** `areas` og `category_slugs` er ikke i Database-typene (migrering 018). Følger mønsteret fra `lib/public-queries.ts`
- **Paginering for POI-queries.** Supabase sin 1000-rads default-grense ville kuttet data stille. Bruker `.range()`-loop fra `app/admin/pois/page.tsx`-mønsteret

### Levert
- `app/admin/public/page.tsx` — full oversiktsside: summary cards, per-område kategoritabeller med SEO/intro-statusbadges, kuraterte guider med filter-info, landingssider, editorial coverage stats
- `app/admin/page.tsx` — ny "Offentlige sider"-seksjon mellom Data og Verktøy med nøkkeltall
- `components/admin/admin-sidebar.tsx` — ny nav-item "Offentlige sider" med Globe-ikon
- `docs/solutions/feature-implementations/admin-public-pages-inventory-20260214.md`
- Branch: `feat/public-pages-admin`

### Parkert / Åpne spørsmål
- **EN-versjoner vises ikke separat.** Kategorisider og guider har NO+EN, men admin viser kun NO-slugs. Akseptabelt for nå — oversikt er viktigere enn completeness
- **Guide POI-count mangler.** Kuraterte guider viser filter-info (Tier 1, Bbox, kategori) men ikke faktisk POI-antall. Ville kreve separate queries per guide

### Retning
- **Admin-inventaret gir kontroll tilbake.** Brukeren kan nå se alt offentlig innhold fra én side — samme mønster som `/admin/projects` for kunder
- **Neste naturlige admin-utvidelse:** Redigering av SEO-titler og intro-tekster direkte fra admin. Men det er CMS-funksjonalitet som bør vurderes separat

### Observasjoner
- **Lucide `Map`-ikon shadower global `Map` constructor.** Importert `Map` fra lucide-react → `new Map<string, string>()` feiler med "Expected 0 type arguments". Må aliase til `MapIcon`. Dokumentert i compound-learnings
- **`force-dynamic` er lett å glemme på admin-sider.** Uten den cacher Next.js ISR resultater fra build-tid, som gir utdaterte tall. Bør vurdere å gjøre dette til mønster for alle admin-sider
- **Compound-kunnskapen betaler seg.** Supabase-pagineringsmønsteret, trust-score-filteret, og public client-bruken var alle dokumentert fra tidligere sesjoner. Implementasjonen gikk raskere fordi mønstrene var kjente

---

## 2026-02-14 (sesjon 5) — Restaurant-kurator + intern linking

### Beslutninger
- **Kuratert alle 93 aktive restaurant-POIs i én sesjon.** 4 parallelle agents, ~24 POIs per batch, alle med WebSearch-verifisert research. Første gang vi kuraterer en hel kategori systematisk
- **Tidsregel håndhevet strengt.** Fjernet alle "X leder kjøkkenet"-formuleringer til fordel for "Grunnlagt av X" eller historisk form. 6 faktafeil korrigert (Top Chef-år, feil kjøkkentype, feil beliggenhet)
- **Intern linking: "Les mer" CTA på MapPopupCard.** Report-kortene linker nå til offentlige POI-sider (`/trondheim/steder/[slug]`). Gir SEO-juice til de offentlige sidene fra Placy sine klientrapporter
- **`getAreaSlugForProject()` i public-queries.ts.** Ny query som henter area slug fra project_pois → pois.area_id → areas.slug_no. Bruker untyped public client (areas-tabellen er ikke i Database-typene)

### Levert
- `supabase/migrations/029_restaurant_editorial_v2.sql` — 686 linjer, 93 POIs kuratert
- `docs/solutions/best-practices/restaurant-curator-batch-pattern-20260214.md` — compound-doc for batch-mønsteret
- MapPopupCard "Les mer" CTA med amber-styling, BookOpen-ikon
- Prop chain: report page → ReportPage → ReportStickyMap → MapPopupCard (areaSlug)

### Parkert / Åpne spørsmål
- **Guide-produktet bruker også MapPopupCard, men sender ikke areaSlug.** GuideStickyMap importerer MapPopupCard men passerer ikke areaSlug ennå. CTA-en vises bare i Report foreløpig — Guide bør få samme linking etter hvert
- **Neste kategori-kurator?** Attraction, shopping, nightlife står for tur. Batch-mønsteret er dokumentert og repeterbart
- **Trenger vi en visuell sjekk av CTA-plassering?** Chrome DevTools MCP var utilgjengelig — ikke visuelt verifisert ennå. Bør testes manuelt

### Retning
- **Kuratorarbeidet bygger real IP.** 112 restauranter med research-verifiserte hooks er et genuint innholdskvalitets-fortrinn. Ingen konkurrent har dette manuelt verifisert nivået av lokalkunnskap
- **Intern linking er en strategisk SEO-beslutning.** Klientrapportene (som har høy lesertid) sender nå trafikk til de offentlige sidene. Dette er riktig retning for organisk vekst
- **Neste naturlige steg:** Systematisk kurator-pass for resterende kategorier (attraction, shopping, nightlife), og utvidelse av "Les mer"-linken til Guide-produktet

### Observasjoner
- **4 parallelle agents er sweet spot.** Respekterer CLAUDE.md-grensen, gir nok parallellitet, og krever bare én reconciliation-runde. Batch-størrelse 20-25 POIs fungerte godt — agentene fullførte alle uten timeout
- **Reconciliation er nødvendig.** Batch 1 fant Top Chef 2015, Batch 3 brukte 2016 for samme person. Uten manuell sjekk hadde vi hatt inkonsistent data. **Alltid søk etter overlappende entiteter på tvers av batches**
- **Migrasjonsnummer-konflikter er en real risiko med parallelle sesjoner.** Session A hadde pushet 028 mens vi jobbet — måtte renames til 029. Bør alltid sjekke `supabase migration list` før man velger nummer
- **Redaksjonelt innhold gjør produktet levende.** Brukerens kommentar "det oppleves spennende å lese for en som er lokalkjent" er den beste valideringen. Hookene treffer riktig register — informative uten å være Wikipedia-tørre

---

## 2026-02-14 (sesjon 6) — "Les mer" CTA i Explorer + bugfix product_pois

### Beslutninger
- **"Les mer" CTA utvidet til Explorer.** Samme mønster som Report — BookOpen-ikon, emerald-styling (vs amber i Report). Linker til `/{area}/steder/{slug}` for intern SEO-linking
- **`product_pois` vs `project_pois` bug fikset.** `getAreaSlugForProject()` brukte feil tabell. `projectData.id` er alltid en product UUID, men `project_pois` bruker container-IDer. Endret til `product_pois` som bruker product UUIDs

### Levert
- Bugfix: `getAreaSlugForProject()` bruker nå `product_pois.product_id` (UUID) i stedet for `project_pois.project_id` (container ID)
- "Les mer" CTA i Explorer: prop chain `explore/page.tsx → ExplorerPage → ExplorerPOIList/ExplorerPanel → ExplorerPOICard`
- Visuelt verifisert via Chrome DevTools MCP — knappen vises korrekt med riktig URL

### Parkert / Åpne spørsmål
- **Guide mangler fortsatt areaSlug.** GuideStickyMap passerer ikke areaSlug til MapPopupCard — "Les mer" CTA vises ikke i Guide ennå
- **Fargekonsistens:** Report bruker amber-styling for "Les mer", Explorer bruker emerald. Bevisst valg for å differensiere produktene, men kan revurderes

### Retning
- Intern linking er nå live i to av tre produkter (Report + Explorer). Guide er neste
- SEO-strategien tar form: klientprodukter → offentlige sider → søkemotorer

### Observasjoner
- **To tabeller for POI-linking er en vedvarende feilkilde.** `project_pois` (container ID) og `product_pois` (UUID) har overlappende formål men ulike nøkkeltyper. Bør dokumenteres tydelig eller konsolideres
- **Prop threading gjennom 5 nivåer er en code smell.** `areaSlug` passeres fra server page → page component → list/panel → card. Context eller en shared hook ville vært renere, men overkill for én prop

---

## 2026-02-14 (sesjon 7) — Curator writing levels: kontekst bestemmer skrivestil

### Kontekst
Curator-skillen (sesjon 2) definerte stemme og prinsipper for POI-tekster. Da vi brukte den til å skrive kategori-bridgeText (som oppsummerer 90 steder), feilet tilnærmingen: å cherry-picke 3 av 90 steder uten kontekst føltes tilfeldig og snevert. Brukeren: "det ble for snevert på noen få steder, som 3 av 90 plasser blir nevnt, uten at en egentlig helt ser sammenhengen hvorfor disse blir nevnt."

### Beslutninger
- **Skrivestil differensieres etter kontekst.** POI-hooks navngir mennesker, datoer, spesifikke detaljer. Kategori-bridgeText beskriver nabolagskarakter og bruker steder som endepunkter i en bevegelse, ikke som anbefalinger
- **"Nabolag + 1-2 ankere"-tilnærming for bridgeText.** Ankerpunktene (f.eks. "fra Britannia-kvartalet til Bakklandets trehuskaféer") definerer ytterpunktene i et spekter — de er navigasjonspunkter, ikke favoritter
- **Ingen statistikk i tekst.** UI-et viser antall/rating/anmeldelser separat — teksten gjentar ikke tallene
- **categoryDescriptions som ny datastruktur.** `reportConfig.themes[].categoryDescriptions` — Record<string, string> som gir hver sub-kategori (restaurant, kafé, bakeri, etc.) sin egen nabolagsbeskrivelse
- **Doblet tekstlengde** på tema-bridgeText etter feedback — originalt for kompakt til å gi reell nabolagsfølelse

### Levert
- Brainstorm: `docs/brainstorms/2026-02-14-curator-writing-levels-brainstorm.md`
- Migrasjon 030: 5 tema-bridgeText omskrevet med nabolagskarakter-tilnærming
- Migrasjon 031: 22 sub-kategori-beskrivelser + dobbel bridgeText-lengde
- Kode: `categoryDescriptions` i types.ts, report-data.ts, report-themes.ts, ReportThemeSection.tsx
- TypeScript kompilerer rent, migrasjoner pushet til produksjon

### Parkert / Åpne spørsmål
- **Curator-nivåer for ALLE teksttyper mangler.** Brainstormen definerte bare bridgeText-nivået. heroIntro, intro_text, editorial_hook, local_insight, seo_description — alle trenger sin egen kontekstbeskrivelse i Curator-skillen. Dokumentert som TODO i brainstormen
- **Guide mangler fortsatt areaSlug/"Les mer" CTA** (fra sesjon 6)
- **Kafé 021-hooks under standard** — 16 hooks som bør skrives om med Curator-skillen (fra sesjon 2)

### Retning
- **Curator-skillen er nå operasjonell på to nivåer:** POI-hooks (spesifikt, mennesker, datoer) og kategori-bridgeText (nabolagskarakter, ankerpunkter). Resten av nivåene bør defineres før neste store editorial-pass
- **Scandic Nidelven-rapporten er den mest komplette demoen.** 93 kuraterte restauranter, 22 sub-kategori-beskrivelser, 5 tema-bridgeText-er, alle med nabolagskarakter-tilnærming. Kan brukes som referanse for fremtidige rapporter
- **Neste editorial-arbeid bør starte med å fullføre Curator-nivåene** i skillen — slik at alle teksttyper har tydelig skriveoppskrift før vi kuraterer neste kategori

### Observasjoner
- **Kontekst trumfer prinsipper.** De 6 Curator-prinsippene (navngi, bevegelse, kontraster, etc.) er riktige, men vektleggingen endres dramatisk basert på hva teksten beskriver. "Navngi" er essensielt for POI-hooks men kontraproduktivt for kategori-oppsummeringer. En skill uten kontekst-differensiering gir feil output
- **Brukerens magefølelse var riktig.** Første bridgeText-versjon fulgte alle prinsippene teknisk, men føltes feil. "Det ble for snevert" er et presist problem — skrivestilen matchet ikke tekstens funksjon. Lærdom: test alltid ny skrivestil mot brukerens leseopplevelse, ikke bare mot en sjekkliste
- **22 sub-kategori-beskrivelser er mye tekst.** Kvaliteten varierer — transport-kategoriene (buss, tog, bysykkel) er mer faktabaserte og mindre "nabolags"-pregede enn mat-kategoriene. Det er kanskje riktig — ikke alle kategorier har like sterk nabolagskarakter
- **Migrasjonsnummer-konflikter fortsetter.** 028 og 029 kolliderte med andre sesjoner, måtte bruke 030 og 031. Med 6-7 parallelle sesjoner på én dag er dette uunngåelig. Sjekk alltid `supabase migration list` først

---

## 2026-02-14 (sesjon 8) — Strategisk: Hurtigruten & Havila som kundesegment

### Kontekst
Brainstorm rundt Hurtigruten og Havila Kystruten som potensielle Placy-kunder. Begge opererer Bergen–Kirkenes-ruten med 34 havner, 11 skip totalt (7 Hurtigruten + 4 Havila), ~400 000 passasjerer årlig. Hurtigruten hadde EUR 571M i forhåndssolgt billett-revenue (2024), bookinger for 2025 opp 22,7%.

### Strategisk innsikt — to posisjoner

**1. Standalone (QR-kode-modell, lik hoteller)**
QR i lugarer og fellesarealer → passasjeren lander på placy.no/hurtigruten/tromsø. Rask å lansere, ingen integrasjon nødvendig.

**2. API/dataleverandør inne i cruiselinjens app**
Hurtigruten har allerede en app (booking, dagsprogram, excursions). Placy leverer POI-data, kuraterte turer og kartlag som API — rendret i cruiselinjens eget design. Større lock-in, mer enterprise.

**Kombinasjonen er sterkest:** Data engine inne i appen + QR-fallback for de uten appen.

### Hvorfor det passer

| Placy-produkt | Use case | Eksempel |
|---------------|----------|----------|
| **Explorer** | Korte landganger (15-45 min) — "hva rekker jeg?" | Ålesund: kafeer, museer, utsiktspunkt innenfor 15 min fra kaien |
| **Guide** | Selvguidede 1-2t byvandringer i større havner | "Historisk byvandring i Tromsø", "Art Nouveau i Ålesund" |
| **Report** | Destinasjonsmarkedsføring per by/region | "Hammerfest — verdens nordligste by" |

**Kjernepoenget:** Cruiselinjene er eksperter på sjøen, ikke på land. De vet ikke hva som finnes 10 min fra kaien i Sandnessjøen. Placy vet.

**Guide er spesielt godt egnet:**
- 1-2 timer = typisk landgangstid
- Selvguidet = ingen operasjonell overhead, skalerer til 34 byer
- Komplementerer betalte excursions (som krever booking, leverandører, minimum antall)
- Alltid tilgjengelig, ingen booking nødvendig

### Skalerbarhet
- 34 byer × 3 produkter = opptil **102 Placy-oppsett** per operatør
- Time budget (5/10/15 min) er skreddersydd for korte landganger
- Sesongvariasjon: nordlys-turer om vinteren, midnattssol-vandringer om sommeren
- To operatører som deler infrastruktur men er separate kunder

### Utfordringer
- **Mange små havner:** Florø, Nesna, Risøyhamn — kanskje 3-5 POI-er. Nok verdi?
- **Konkurranse med excursions:** 130+ betalte excursions er revenue stream. Placy må posisjoneres som komplementært
- **To konkurrerende kunder:** Hurtigruten og Havila deler rute men er rivaler. Eksklusivitet?
- **Offline-behov:** Nord-Norge har dårlig dekning — trenger Placy offline-modus?
- **API-integrasjon:** Krever dokumentasjon, SLA, enterprise-salg. Større terskel enn QR-kode

### Inntektsmuligheter — basert på eksisterende prismodell

#### Modell A: Hotell-analog (QR-kode per skip)
Behandler hvert skip som et "hotell" med QR-koder i lugarer/fellesarealer.

| Produkt | Pris per skip/mnd | 11 skip totalt |
|---------|-------------------|----------------|
| Explorer (alle 34 havner) | 4 990 kr | 54 890 kr/mnd |
| Guide Unlimited (alle guider, alle havner) | 9 990 kr | 109 890 kr/mnd |
| Report (per by, engang) | 15 000 kr × 10 store byer | 150 000 kr engang |

**ARR:** ~2,0M kr (Explorer + Guide) + 150k engang = **~2,15M kr første år**

Logikk: Skipene har 300-500 lugarer — større enn et typisk hotell. Premium-pris per skip er rettferdig. Explorer-prisen er ~3,3× hotellprisen fordi den dekker 34 byer, ikke 1.

#### Modell B: Per-havn-lisens
Cruiselinjen betaler per by de vil ha dekket, uavhengig av antall skip.

| Produkt | Pris per havn/mnd | 34 havner |
|---------|-------------------|-----------|
| Explorer | 990 kr | 33 660 kr/mnd |
| Guide (3 guider per havn) | 1 490 kr | 50 660 kr/mnd |
| Totalt | 2 480 kr/havn | **84 320 kr/mnd** |

**ARR per operatør:** ~1,0M kr
**ARR begge operatører:** ~2,0M kr

Logikk: Kunden betaler for innholdsdekning, ikke distribusjon. Mer transparent. Kan starte med 10 store havner og utvide.

#### Modell C: Enterprise API-lisens (dataleverandør)
Placy leverer POI-data + guider + kartlag via API. Cruiselinjen rendrer i sin egen app.

| Komponent | Pris |
|-----------|------|
| API-tilgang (flat) | 15 000 kr/mnd |
| Per havn aktivert | 500 kr/havn/mnd |
| Per guide produsert | 5 000 kr engang |
| Support & SLA | 5 000 kr/mnd |
| **Totalt (34 havner, 50 guider)** | **37 000 kr/mnd + 250k engang** |

**ARR:** ~444k kr/år + 250k setup = **~694k kr første år, ~444k vedvarende**

Logikk: Lavere topplinje enn B2C-modellene, men: lavere churn, høyere lock-in, og cruiselinjen gjør distribusjon selv. Placy eier ingen brukerflate — ren dataleverandør (Foursquare-modellen fra 2026-02-11).

#### Modell D: Hybrid (anbefalt)
Kombinerer QR-standalone + API-feed. Cruiselinjen får både:
- Placy-hostede sider (QR i lugarer) for passasjerer uten appen
- API-feed inn i egen app for den integrerte opplevelsen

| Komponent | Pris |
|-----------|------|
| Standalone (10 store havner, Explorer + Guide) | 24 800 kr/mnd |
| API-tilgang for resterende 24 havner | 12 000 kr/mnd |
| 20 produserte guider (engang) | 100 000 kr |
| **Totalt** | **36 800 kr/mnd + 100k engang** |

**ARR per operatør:** ~442k + 100k = **~542k kr første år, ~442k vedvarende**
**ARR begge operatører:** ~1,1M kr

### Sammenligning med hotellmarkedet

| Segment | Enhetspris | Volum | ARR-potensial |
|---------|-----------|-------|---------------|
| Hoteller (50 stk tidlig fase) | 2 480 kr/mnd | 50 | ~1,5M kr |
| Scandic-avtale (82 hoteller) | ~2 260 kr/mnd | 82 | ~2,2M kr |
| Hurtigruten + Havila (hybrid) | ~37 000 kr/mnd | 2 | ~1,1M kr |
| Destinasjonsselskaper (10 stk) | 3 999 kr/mnd | 10 | ~480k kr |

**Cruiselinjene er high-value/low-volume kunder** — 2 kunder som gir nesten like mye som 50 hoteller. Drømmescenario for en startup: færre salgssamtaler, større kontrakter.

### IP-strategi (kobling til 2026-02-11)
Cruiseline-arbeidet produserer **enorm IP:** 34 norske kystbyer med kuraterte POI-er, guider og redaksjonelt innhold. Denne databasen er verdifull langt utover cruisemarkedet:
- Samme data kan selges til hoteller i havnebyene
- Destinasjonsselskapene langs kysten får ferdig innhold
- Visit Norway / Innovasjon Norge kan være interessert i kystdata
- **Nettverkseffekten:** Bygge for cruiseline → selge til hoteller i samme byer → selge til destinasjonsselskap

### Beslutning
- **Strategisk prioritering, ikke umiddelbar implementering.** Krever enterprise-salg, API-utvikling, og innholdsproduksjon for 34 byer. Men potensialet er reelt og kompatibelt med eksisterende strategi.
- **Neste konkrete steg:** Utforske kontaktpunkter hos Hurtigruten (commercial/partnerships) og Havila. Eventuelt demo med 3-5 av de største havnene (Bergen, Ålesund, Trondheim, Tromsø, Bodø) som proof of concept.
- **Modell D (hybrid) er anbefalt startpunkt** — gir verdi raskt via QR, bygger mot API-integrasjon over tid.

### Observasjoner
- **Cruiseline-segmentet validerer Placy som dataleverandør.** Foursquare-analogien (2026-02-11) blir enda tydeligere: Placy eier kuratert norsk kystby-data som ingen andre har. Google har volum, Placy har kontekst.
- **"Spre turistene"-narrativet (2026-02-01 brainstorm) treffer cruiseline enda hardere.** 400 000 passasjerer som alle går i land på samme kai, i korte intervaller. Explorer med time budget er bokstavelig talt designet for dette.
- **Guide > Explorer for dette segmentet.** Hoteller: Explorer er primærproduktet (gjesten er der lenge). Cruiseline: Guide er primærproduktet (passasjeren har 1-2 timer, trenger struktur, ikke fri utforskning).
- **Offline-modus er en reell blocker for Nord-Norge-havnene.** Mehamn, Berlevåg, Båtsfjord — dårlig dekning. Kan ikke ignoreres for en cruiseline-kunde. Bør planlegges tidlig.

### TODO — Kystruten-demo
- [ ] Bygg `/kystruten/trondheim` med kai-origin (Brattøra). Bruk eksisterende data, ny inngang med cruiseline-perspektiv
- [ ] Lag 2-3 landgangs-guider: "Bakklandet på 45 min", "2 timer i Trondheim", evt. "Smak Trondheim fra kaien"
- [ ] Skriv kort pitch (5 linjer) med demo-link — la demoen fortelle historien
- [ ] Research kontaktpersoner Havila (Commercial Director, Head of Guest Experience)
- [ ] Pilot: gratis / symbolsk pris. Gevinsten er 5 nye byer med data + referansekunde + bruksdata fra 400k passasjerer

---

## 2026-02-15 — Trip Library: fra dummy til ekte data

### Beslutninger
- **Seed script fremfor manuelt admin-UI.** Reproducerbart, versjonskontrollert, og mye raskere enn å klikke gjennom admin for 5 turer × 4-5 stopp. `scripts/seed-trips.ts` med `--dry-run` og `--publish` flagg
- **Ekskluderer transport-kategorier fra POI-søk.** bike, taxi, bus-kategorier filtreres ut i `findPoi()`. Uten dette matcher "Gamle Bybro" en bysykkel-stasjon, "Nidarosdomen" en taxiholdeplass, "Torvet" enda en bysykkel. Supabase ILIKE uten kategorifilter er ubrukelig for landmark-søk
- **Substitusjon fremfor tomme stopp.** POI-er som ikke eksisterer i databasen (Ravnkloa, Vitensenteret, Kristiansten festning, Sverresborg museum) ble erstattet med nærliggende alternativer + `nameOverride` for å beholde intensjonen. Bedre å ha 4 gode stopp enn 6 med hull
- **Fjernet DUMMY_TRIPS helt.** Ingen "Kommer snart"-badges, ingen dummy-data-blanding. Klienten viser kun reelle turer fra Supabase
- **Ryddet bort ubrukte server-props.** `groupedTrips`, `categoriesWithTrips`, `categoryLabels` ble passert fra server til klient men aldri brukt — klienten grupperer selv

### Levert
- 5 turer seedet og publisert: Bakklandet & Bryggene, Historisk Trondheim, Smak av Trondheim, Kaffebar-ruten, Barnas Trondheim
- 22 stopp totalt, alle koblet til verifiserte POI-er
- Hvert stopp med redaksjonell transition_text og local_insight
- TripLibraryClient.tsx forenklet fra 597 til 462 linjer
- `docs/solutions/feature-implementations/trip-seed-data-poi-matching-20260215.md`

### Parkert / Åpne spørsmål
- **Manglende landmark-POI-er i databasen.** Ravnkloa (fiskemarked), Vitensenteret (NTNU), Kristiansten festning, Sverresborg Trøndelag Folkemuseum, Stiftsgården (som bygning, ikke park) — alle viktige Trondheim-landemerker som mangler som POI-er. Bør opprettes manuelt eller via import
- **Guide mangler fortsatt "Les mer" CTA** (fra sesjon 6 og 7)
- **Kafé 021-hooks under standard** (gjentatt fra sesjon 2/7)
- **Trips er ikke koblet til noen project_trips ennå.** Turene er publisert og tilgjengelig via SEO-rute (`/trips/[slug]`), men ingen B2B-prosjekt linker til dem via `project_trips`. Scandic Nidelven bør kobles

### Retning
- **Trip-produktet er nå funksjonelt.** Database, queries, adapter, UI, admin — alt var bygget. Nå har det også innhold. Neste steg er å koble trips til kunder via `project_trips`
- **SEO-rutene (`/trips/[slug]`) er live** med 5+1 turer (inkludert "Art and Vintage" fra før). Disse kan indekseres
- **Kystruten-demoen (sesjon 8) bør bygge på dette.** En "Trondheim fra kaien"-tur med kai-origin er den naturlige neste tripen å seede
- **POI-gap bør tettes.** Flere av Trondheims mest kjente landemerker mangler i databasen. Uten dem er guidene ufullstendige

### Observasjoner
- **Alt var bygget bortsett fra dataen.** PRD-en viste WP1/WP2/WP3 som "ikke startet", men alt var kodet. Den egentlige blokkeringen var én ting: ingen turer i databasen. Lærdom: sjekk alltid koden før du planlegger arbeid — PRD-status kan være utdatert
- **POI-databasen har en transport-forurensning.** Bysykkel-stasjoner, taxiholdeplasser og bussholdeplasser dukker opp overalt i ILIKE-søk. De deler navn med landemerker (Gamle Bybro, Nidarosdomen, Torvet). Enhver POI-søk-funksjon bør ekskludere disse kategoriene som default
- **`--dry-run` forhindret feil data i prod.** Første kjøring avslørte 6 feil-matcher og 3 manglende POI-er. Uten dry-run hadde vi fått turer med bysykkel-stasjoner som stopp. Alltid ha preview-modus på seed-scripts
- **nameOverride er et kraftig mønster.** Lar oss bruke "Stiftsgårdsparken" (som eksisterer i DB) men vise "Stiftsgården" til brukeren. Separerer datamodell fra presentasjon uten å kreve nye POI-er

---

## 2026-02-15 — Google API-kostnad: fra 339 kr/halvmåned til ~0

### Beslutninger
- **Cache alle Google-data i Supabase.** Åpningstider, telefon og bilder hentes nå ved import/refresh, ikke ved sidevisning. Tre runtime-lekkasjer eliminert: useOpeningHours-hooket, foto-proxyen, og MapPopupCard fetch
- **Beregn isOpen klient-side.** Lagrer `weekday_text`-arrayen, ikke `open_now`-snapshot som ville blitt stale. Klienten beregner om stedet er åpent/stengt fra tidsparsing
- **CDN-URLer direkte i DB.** Google Photo API gir 302 → `lh3.googleusercontent.com`. Den URLen er offentlig, trenger ingen API-nøkkel, og lever lenge. Batch-migrert alle 443 bilder
- **Kurator-flyter uendret.** Import-time CDN-resolve betyr at nye POI-er automatisk får riktig URL. Koster 2 API-kall per POI ved import — neglisjerbart vs tusenvis per måned

### Levert
- Migration 032: `opening_hours_json`, `google_phone`, `opening_hours_updated_at`
- `scripts/resolve-photo-urls.ts` — 443/443 bilder migrert, 0 feil
- `scripts/refresh-opening-hours.ts` — 553 POI-er oppdatert med timer+telefon
- `useOpeningHours` fullstendig omskrevet — fra fetch-per-viewport til pure useMemo
- `MapPopupCard` og `poi-card-expanded` bruker cached data
- Code review fikset: duplisert `computeIsOpen` (multi-range bug), manglende felt i `getPOIsWithinRadius`, type-cast precedence
- `docs/solutions/performance-issues/google-api-runtime-cost-leakage-20260215.md`

### Parkert / Åpne spørsmål
- **~15 filer har fortsatt photoReference-fallback.** Proxy-URLer som dead code etter batch-migrering. Lav prioritet — de fungerer, men bør fjernes i en oppryddingsrunde for å lukke kostnadslekasje helt (nye POI-er mellom script-kjøring og deploy kan utløse fallback)
- **Supabase-genererte typer ikke oppdatert.** `google_phone`, `opening_hours_json` bruker `Record<string, unknown>` cast. Bør regenerere med `supabase gen types` for ærlige typer
- **Guide mangler "Les mer" CTA** (gjentatt fra sesjon 6/7/8)
- **Kafé 021-hooks under standard** (gjentatt fra sesjon 2/7/8)

### Retning
- **Kostnad under kontroll.** Neste Google-faktura bør vise dramatisk reduksjon. Verifiser etter 1 mars
- **Refresh-script bør kjøres månedlig.** Åpningstider endres, nye steder legger seg til. Vurder cron-job (GitHub Action?) eller manuelt
- **foto-proxyen (`/api/places/photo`) kan pensjoneres.** Etter at alle proxy-URLer er migrert og nye imports resolver direkte, er endepunktet dead code. Slett den når du er trygg

### Observasjoner
- **In-memory cache på Vercel er verdiløs.** `Map()` i API-route resettes ved cold start. Med serverless-arkitektur er persistent lagring (Supabase) eneste reelle cache. Lærdom verdt å huske for alle fremtidige caching-behov
- **Google Photo 302-redirect er den egentlige CDN-URLen.** Hele proxy-laget var unødvendig — API-kall med `redirect: "manual"` gir direkte CDN-link som fungerer uten nøkkel. Elegant og kostnadsfritt
- **`featured_image` lagret proxy-URLer som var kilden til mesteparten av forbruket.** En enkel seed-beslutning tidlig (lagre `/api/places/photo?photoReference=...` i stedet for CDN-URL) skapte 7000+ unødvendige API-kall per måned. Data-design ved import-tid er kritisk

---

## 2026-02-15 (sesjon 2) — Facebook URL på POI-kort (Fase 1)

### Beslutninger
- **Facebook URL som dedikert kolonne, ikke JSONB.** `facebook_url TEXT` med HTTPS-only CHECK constraint. Enkelt, querybart, konsistent med eksisterende `google_maps_url`-mønster
- **Shared `isSafeUrl` utility.** Duplisert i to SEO-sider — ekstrahert til `lib/utils/url.ts`. Brukes nå av 4 filer (2 SEO-sider + 2 POI-kort-komponenter)
- **Ren lenke-stil, ikke dedikert ikon.** Plan diskuterte Facebook-ikon vs ExternalLink — valgte ExternalLink + "Facebook" tekst i ExplorerPOICard og icon-only ExternalLink i POIBottomSheet. Matcher eksisterende Google Maps-mønster
- **flex-wrap på action-raden.** Forebygger overflow på smale skjermer nå som det er 4+ action-elementer

### Levert (PR #32)
- Migration 033: `facebook_url TEXT CHECK (https only)` på pois-tabellen
- `lib/utils/url.ts` — shared isSafeUrl
- Facebook-lenke i ExplorerPOICard (text link) og POIBottomSheet (icon-only button)
- TypeScript-typer og queries oppdatert
- Testdata: Café Løkka satt med facebook_url

### Parkert / Åpne spørsmål
- **Fase 2: OG-metadata scraping.** `og:image` som bilde-fallback, rikere preview-widget. Ikke i scope for denne PRen
- **Høyt & Lavt POI mangler i databasen.** Planlagt som testdata-POI, men eksisterer ikke. Brukte Café Løkka i stedet
- **Guide mangler fortsatt "Les mer" CTA** (gjentatt)
- **Kafé 021-hooks under standard** (gjentatt)

### Retning
- **Facebook-lenken er et første steg mot sosial kontekst.** Fase 2 (OG-scraping) gir bildene og metadata som gjør det til en rikere widget
- **Kurator-rollen bekreftet.** Placy peker brukeren til riktig sted (Facebook-appen, Google Maps) i stedet for å reprodusere alt selv. Det er kuratorrollen

### Observasjoner
- **Minimal endring, 9 filer.** +54/-19 linjer. Tight scope holdt — ingen gold-plating
- **`/full-auto` kjørt for første gang.** Brainstorm+plan allerede ferdig → direkte til Work. Alt levert i én commit, TS+build verifisert, migration pushet, PR opprettet

---

## 2026-02-15 (sesjon 3) — Trips Sprint 1: POI-grunnlag + innhold

### Beslutninger
- **Sightseeing som ny trip-kategori.** Fullstack-endring: DB CHECK constraint (migration 034) + `categories`-tabell (migration 035) + TypeScript types + UI mappings (gradient, ikon, grouped state). Fire lag som alle må stemme
- **Tre landmark-POI-er opprettet via migration.** Gamle Bybro (bro, ikke park), Ravnkloa (fiskemarked), Stiftsgården (bygning, ikke park). Koordinater web-verifisert. Bruker `gen_random_uuid()::TEXT`-mønsteret fra 016
- **Seed script upsert med `--force`.** Delete old stops → update trip metadata → re-insert stops. Bevarer trip ID for `project_trips` FK-referanser. Viktig for iterasjon uten å bryte relasjoner
- **Ny tur: Midtbyen på 30 minutter.** Sightseeing-kategori, 4 stopp, 1.2 km. Fyller "rask oversikt"-nisjen — kortest tur i biblioteket
- **Teaser chain-teknikk for transition_text.** Hvert stopp slutter med en hook til neste ("På den andre siden venter Bakklandet"). Bygger framdrift og nysgjerrighet
- **Smak av Trondheim omstrukturert.** Starter nå ved Ravnkloa (fjord/sjømat) og ender ved Credo (gård-til-bord). Narrativ bue fra sjø til jord — sterkere enn å starte midt i sentrum
- **3 demo-turer featured, 3 non-demo.** Bakklandet & Bryggene, Smak av Trondheim, Midtbyen på 30 min = featured:true. Historisk Trondheim, Kaffebar-ruten, Barnas Trondheim = featured:false

### Levert (PR #33)
- Migration 034: sightseeing i trips.category CHECK constraint
- Migration 035: sightseeing i categories-tabell + 3 landmark-POI-er (Gamle Bybro, Ravnkloa, Stiftsgården)
- `lib/types.ts`: TRIP_CATEGORIES + TRIP_CATEGORY_LABELS utvidet
- `TripLibraryClient.tsx`: gradient, ikon, grouped state for sightseeing
- `scripts/seed-trips.ts`: --force upsert, 6 turer med teaser chain-innhold
- `docs/solutions/feature-implementations/trips-sprint1-poi-content-seeding-20260215.md`
- Branch: `feat/trips-sprint1-poi-content`, 4 commits

### Parkert / Åpne spørsmål
- **Guide mangler "Les mer" CTA** (gjentatt fra sesjon 6/7/8 + forrige sesjon)
- **Kafé 021-hooks under standard** (gjentatt — Curator-skillen definerer standard nå)
- **Visuell verifisering gjenstår.** Turene er seedet og databasen er oppdatert, men vi har ikke kjørt dev server og tatt screenshot. Bør sjekkes manuelt
- **Historisk Trondheim har 5 stopp vs. de andre 4-5.** Lengste turen (90 min) med mest ambisiøst scope — passer det, eller er det for mye?

### Retning
- **Sprint 1 er ferdig.** Alle checkboxes i planen er markert. POI-grunnlaget er på plass, innholdet er oppgradert, seed-scriptet støtter iterasjon
- **Sprint 2 naturlig neste steg:** Guided Mode (trinn-for-trinn navigasjon), kart-integrasjon (rute mellom stopp), mer avansert UI for turfølging
- **Koble trips til project_trips** bør prioriteres — Scandic Nidelven-demoen viser turene best i kontekst
- **POI-databasen for Trondheim blir rikere.** 3 nye landmark-POI-er + detaljert editorial for 6 turer. Bygger IP

### Observasjoner
- **`categories`-tabellen er FK-target for `pois.category_id`.** Ikke åpenbart fra planen. Migration 035 feilet første gang fordi vi la til POI-er med `category_id='sightseeing'` uten å opprette kategorien først. Gotcha dokumentert i compound-docs
- **Teaser chain er en redaksjonell teknikk som fungerer.** Bakklandet-turen føles som en historie du leser — hvert stopp bygger på forrige. Kontrast med Historisk Trondheim som har mer guide-book-stil. Begge fungerer, men teaser chain er mer engasjerende
- **`/full-auto` kjørte gjennom alle 7 faser autonomt.** Brainstorm+plan var ferdig fra forrige sesjon → direkte til tech audit → work → code review → compound → project log. Én kontekst-reset underveis (stor sesjon), men recovery var smidig
- **Supabase `.temp`-katalogen er en worktree-gotcha.** Gitignored, så den eksisterer ikke i nye worktrees. Må kopieres manuelt fra hovedrepoet. Bør dokumenteres i setup-worktree.sh

---

## 2026-02-15 (sesjon 4) — Trips Sprint 2: Preview-modus

### Beslutninger
- **Query param for mode-switching, ikke separate ruter.** `?mode=active` aktiverer TripPage, default viser TripPreview. Holder URL-strukturen ren og unngår nye route-segmenter
- **TripPreview mottar Trip-typen direkte.** Ingen `tripToProject()`-adapter — bare aktiv modus trenger legacy Project-shapen. Ny kode bør bruke Supabase-typer direkte
- **Statisk kart uten scroll zoom.** TripPreviewMap disabler scroll zoom for å unngå at brukeren zoomer ved accident under scrolling. Pan/touch fungerer fortsatt
- **Sticky CTA med gradient fade.** "Start turen"-knappen er sticky bottom med gradient fra bakgrunn — synlig uansett scroll-posisjon uten å blokkere innhold

### Levert (PR #34)
- `TripPreview.tsx` — hero, metadata-stripe, beskrivelse, stopp-liste med timeline connector, rewards-teaser, sticky CTA
- `TripPreviewMap.tsx` — statisk Mapbox med nummererte markører + rute-polyline
- Routing oppdatert for begge ruter (project + SEO) med query param branching
- TripLibraryClient href fikset fra `/{customer}/...` til `/for/{customer}/...`
- `docs/solutions/feature-implementations/trips-sprint2-preview-mode-20260215.md`

### Parkert / Åpne spørsmål
- **Cover images mangler.** Alle 3 demo-turer har gradient-fallback. Sprint 5 (polish) skal legge til kuraterte bilder
- **Guide mangler "Les mer" CTA** (gjentatt)
- **Kafé 021-hooks under standard** (gjentatt)
- **Sprint 3 (Guided/Free toggle) kan starte nå.** Preview viser allerede anbefalt rute — Free mode trenger kart uten polyline + stopp sortert etter avstand

### Retning
- **Preview → Active flyten fungerer end-to-end.** Guest kan nå browse Trip Library → vurdere tur → starte. Dette var den viktigste manglende biten for Scandic-demoen
- **Sprint 3 og 4 kan kjøres parallelt.** Guided/Free toggle og Rewards/progress er uavhengige
- **Sprint 5 (polish + demo-klargjøring) er siste steg.** Cover images, responsiv polering, end-to-end test på mobil

### Observasjoner
- **Rask implementasjon (567 linjer, 6 filer).** Klar PRD + eksisterende patterns (TripMap, RouteLayer, types) = 1 commit for hele featuren. Ingen overraskelser
- **Trip Library href manglet `/for/`-prefix.** Fungerte via middleware redirect, men direkte URL er riktigere og raskere (unngår 308-redirect). Liten fix, men viktig for SEO og ytelse
- **TripPreview bruker Trip-typen direkte.** Første komponent som ikke går gjennom `tripToProject()`-adapteren. Viser at ny kode bør bygges direkte på Supabase-typer — adapteren er legacy-bro, ikke permanent mønster

---

## 2026-02-15 (sesjon 6) — Trips Sprint 4: Rewards/progress demo data

### Beslutninger
- **Data, ikke kode.** Sprint 4 var en ren data-og-adapter-oppgave. All kode (completion screen, GPS verification, confetti, voucher, intro overlay, progress indicators) var allerede bygget i Sprint 1-3. Eneste kodeendring: én linje i `buildRewardConfig()`.
- **`override.startName` som `hotelName`.** Naturlig kobling — `project_trips.start_name` er hotellet/venue-navnet, og det er det som skal vises på voucher og intro overlay. Ingen ny kolonne nødvendig.
- **Supabase JS client for seeding, ikke CLI.** CLI-passordet var utgått. Seed-script via JS client med `SUPABASE_SERVICE_ROLE_KEY` fungerte uten problemer — raskere enn å debugge CLI.

### Levert (PR #36)
- Migration 037: `project_trips` rows for Scandic Nidelven → 3 featured trips
- `trip-adapter.ts:133` — `hotelName: override?.startName ?? ""`
- Seed-script satte `start_poi_id`, `reward_title/description/code`, `welcome_text` for alle linker

### Verifisert
- TypeScript: 0 feil
- Produksjonsbuild: OK
- Visuelt (Chrome DevTools MCP):
  - Trip Library: 3 featured trips med kategori-badges
  - Preview: amber reward teaser "15% på Scandic Bar"
  - Intro overlay: "Fullfør og få belønning!" + "fra Scandic Nidelven"
  - Aktiv modus: progress 0/6, mode toggle, Scandic Nidelven som start POI

### Parkert / Åpne spørsmål
- **Completion flow ikke E2E-testet i browser.** Intro overlay og preview verifisert, men å markere alle 6 stopp manuelt tar tid — confetti/voucher er verifisert via kode-review
- **Supabase CLI password trenger reset.** `supabase db push` feiler med SASL auth — trolig endret passord. Workaround: JS client-scripts
- **Mobil-responsivitet ikke testet** (gjentatt fra Sprint 3)

### Retning
- **4 av 5 sprints levert.** Sprint 1 (POI), Sprint 2 (Preview), Sprint 3 (Guided/Free), Sprint 4 (Rewards). Kun Sprint 5 (Polish) gjenstår.
- **Scandic-demoen er funksjonell.** Full flow fra Library → Preview → Start → Mark stops → Complete → Voucher eksisterer. Sprint 5 er kosmetisk polish.
- **Trips v2 MVP er nesten komplett.** Det som mangler er visuell polish og edge cases — ikke grunnleggende funksjonalitet.

### Observasjoner
- **Inkrementell Sprint-tilnærming har fungert usedvanlig godt.** Hver sprint bygget naturlig på forrige, og Sprint 4 var nesten "gratis" fordi all kode var klar. Dette er en god modell for fremtidige features: bygg kode i tidlige sprints, aktiver med data i senere.
- **`project_trips` som override-lag er en sterk arkitektur.** B2B-kunder (Scandic) får skreddersydd innhold (rewards, start point, welcome text) uten å endre base-trip-data. Andre kunder kan bruke samme trips med andre overrides.
- **3 filer, 165 linjer endret.** Laveste Sprint-endring så langt — bevis på at forberedelsene i Sprint 1-3 var solide.

---

## 2026-02-15 (sesjon 5) — Trips Sprint 3: Guided/Free mode toggle

### Beslutninger
- **`TripMode` = "guided" | "free" som fullstack-type.** Flyter fra DB (`trips.default_mode`) gjennom `transformTrip()` → `tripToProject()` → komponent-props. Alle lag kjenner modusen
- **localStorage per trip, ikke global.** `trip-mode-${tripId}` — brukeren kan velge ulik modus per tur. Initialiseres fra `trip.defaultMode`, overskrives av brukervalg
- **Haversine-avstand, ikke walking distance.** Free mode sorterer stopp etter luftlinje fra brukerens GPS (eller trip center uten GPS). Unngår API-kall for ruting, godt nok for sortering
- **Rute skjules helt i Free mode.** `routeCoordinates` og `routeSegments` settes til `undefined` — TripMap rendrer kun markører. Rent visuelt skille mellom modusene
- **Pill-toggle med Route/Compass-ikoner.** "Anbefalt rute" (Route) / "Utforsk fritt" (Compass). Plassert i både mobil-header og desktop-sidebar

### Levert (PR #35)
- Migration 036: `trips.default_mode TEXT CHECK ('guided'|'free')` default 'guided'
- `TripModeToggle.tsx` — pill-style segmented control
- `TripPage.tsx` — mode state, distance beregning, sorted indices, localStorage persist
- `TripStopPanel.tsx` — free mode: alle stopp i scrollbar liste med avstand-badges
- `TripStopList.tsx` — accordion-modus med distance-sorting for free mode
- `TripStopDetail.tsx` — skjuler prev/next og transition_text i free mode
- `TripPreview.tsx` — "Du kan også utforske stoppene i din egen rekkefølge" hint
- 13 filer, +457/-56 linjer

### Verifisert
- TypeScript: 0 feil
- Produksjonsbuild: OK
- Visuelt (Chrome DevTools MCP):
  - Guided mode: rute-polyline på kart, sekvensiell stoppvisning, prev/next fungerer
  - Free mode: ingen polyline, stopp sortert etter avstand (5.5→6.2 km), avstand-badges, "Merk som besøkt" uten navigasjonsknapper
  - Toggle bytter riktig mellom modusene

### Parkert / Åpne spørsmål
- **Mobil-responsivitet ikke testet.** Desktop fungerer perfekt, men mobil bottom sheet med free mode trenger testing
- **Guide mangler "Les mer" CTA** (gjentatt)
- **Kafé 021-hooks under standard** (gjentatt)
- **Sprint 4 (Rewards + progress) er neste.** Uavhengig av Guided/Free — belønningssystem fungerer for begge moduser

### Retning
- **3 av 5 sprints levert på én dag.** Sprint 1 (POI-innhold), Sprint 2 (Preview), Sprint 3 (Guided/Free). Tempo er høyt, men kvaliteten holder (alle verifisert visuelt + TypeScript + build)
- **Sprint 4 og 5 gjenstår.** Rewards (Sprint 4) og Polish (Sprint 5) er de siste stegene for Trips v2 MVP
- **Scandic-demoen nærmer seg.** Med Preview + Guided/Free + innhold er det nesten komplett for å vise Scandic Nidelven

### Observasjoner
- **Haversine vs walking distance var riktig avveining.** Walking distance ville krevd Mapbox Matrix API (N stopp × N API-kall) for å sortere. Haversine gir ~90% riktig sortering for bynære stopp — og er gratis og instant
- **localStorage-strategi eliminerer auth-avhengighet.** Ingen brukerregistrering nødvendig for å huske modus-preferanse. Perfekt for hotellgjester som ikke logger inn
- **Pill-toggle vs dropdown var bevisst.** To moduser = toggle er riktig UX. Ville ikke trengt pill-toggle hvis det var 3+ moduser
- **Free mode avslører at trip center er viktig.** Uten GPS sorteres stopp fra trip center — og den verdien brukes nå aktivt, ikke bare for kartvisning. God at vi la det inn i Sprint 1

---

## 2026-02-15 (sesjon 6) — Trips Sprint 5: Visual polish + demo readiness

### Beslutninger
- **Wikimedia Commons for cover images.** Forsøkte Unsplash (SPA, kan ikke scrape), Pexels (403), Pixabay (redirect). Wikimedia Commons API gir stabile, CC-lisensierte bilder med thumbnail-generering
- **Lokale bilder i `public/trips/`.** Lettere å kontrollere enn eksterne URL-er, ingen CORS-problemer, ingen avhengighet av tredjeparter. 200-350KB per bilde — akseptabel størrelse
- **Fjernet `welcomeText` fra Trip Library.** Var trip-spesifikk tekst ("Velkommen til Art and Vintage...") som dukket opp i bibliotek-oversikten. Feil scope — welcome text hører til enkelt-tur, ikke bibliotek-nivå
- **Kategori-accent-farger i stedet for plain hvit.** Gir visuell differensiering mellom mat/kultur/natur etc. uten å overdesigne. Subtle bg-amber-50 / bg-emerald-50 etc.
- **Transition text som navigasjonskort.** Endret fra kursiv tekst til kort med blå bakgrunn, border og ikon — mye lettere å lese mens man går

### Levert (PR #38)
- Cover images: 3 Wikimedia Commons-bilder for demo-turene
- Trip Library: fargede kategorikort, "Trondheim" lokasjonslabel, betinget søkefelt
- Preview: lettere hero-gradient, CTA med press-animasjon, lazy-loadede thumbnails
- Active mode: forbedret tittel-overlay med backdrop blur, progresbar-animasjon
- Stop detail: transition text som navigasjonskort med ikon
- Dead code cleanup: fjernet ubrukt welcomeText-prop
- 5 kodefiler, 149 innsettinger, 62 slettinger

### Verifisert
- TypeScript: 0 feil
- Produksjonsbuild: OK
- Visuelt (Chrome DevTools MCP, mobil 390×844):
  - Trip Library: cover images vises, kategorikort har farger
  - Preview: hero-bilde synlig gjennom lettere gradient, CTA tydelig
  - Active mode: tittel-overlay med blur, progresbar animerer
  - Guided mode: transition text vises som blått kort med navigasjonsikon

### Parkert / Åpne spørsmål
- **Completion flow fortsatt ikke E2E-testet i browser** (gjentatt). Confetti og voucher verifisert via kode, men full 6-stopp gjennomgang er manuelt arbeid
- **Supabase CLI password trenger fortsatt reset** (gjentatt)
- **Bilder er CC-lisensiert men attribusjon mangler.** Wikimedia Commons-bilder krever attribusjon — for demo er dette OK, men for produksjon bør det legges til

### Retning
- **Alle 5 sprints er nå levert.** Trips v2 MVP er komplett: POI-innhold → Preview → Guided/Free → Rewards → Polish
- **Demoen er klar for Scandic-kontakten.** Full flow: Library → Preview → Start → Walk → Mark stops → Complete → Voucher. Visuelt polert med cover images
- **Neste steg for Trips:** Ekte brukerdata, analytics, flere turer, bedre bilder (profesjonelle), og mer innhold per by

### Observasjoner
- **5 sprints på 2 sesjoner er rekordtempo.** Fra ingenting til en komplett turopplevelse med gamification. `/full-auto`-workflowen fjerner all friksjon mellom fasene
- **Image sourcing er fortsatt et pain point.** Gratis, pålitelige, kvalitetsbilder for norske byer er vanskelig å finne programmatisk. Wikimedia Commons er best-in-class, men bildekvaliteten varierer. For produksjon bør vi vurdere egne bilder eller en betalt tjeneste
- **Dead code fra refactoring er lett å glemme.** `welcomeText`-proppen overlevde etter at page.tsx sluttet å sende den. Self-review fanget det — viktig å alltid sjekke at props som fjernes fra parent også fjernes fra child
- **Trips v2 er en sterk demo-case.** Scandic Nidelven-demoen viser Placy som mer enn en Explorer/Report-plattform — kuraterte turopplevelser med gamification er et differensiert produkt

---

## 2026-02-15 (sesjon 7) — Trip Preview: Desktop Layout

### Beslutninger
- **Desktop-layout for TripPreview** lagt til med 50/50 split (innhold + sticky map). Følger ReportPage-mønsteret — bevisst valg for konsistens
- **Gjenbruk fremfor nytt design:** Brukte eksisterende sticky map-mønster (`top-20 h-[calc(100vh-5rem-4rem)]`) og dual-render pattern (`lg:hidden` + `hidden lg:block`) fra Report/Explorer/TripPage
- **Delte sub-komponenter:** Ekstraherte HeroImage og HeroOverlay for gjenbruk mellom mobil og desktop — reduserer duplisering uten å legge til kompleksitet
- **CTA ikke sticky på desktop** — bevisst UX-valg: brukere bør se alle stopp før de starter turen

### Parkert / Åpne spørsmål
- **Completion flow fortsatt ikke E2E-testet i browser** (gjentatt fra forrige sesjon)
- **Bilder er CC-lisensiert men attribusjon mangler** (gjentatt)
- **Desktop preview for trips/samleside (TripLibraryClient):** Bør den også få en desktop-variant? Akkurat nå er den mer responsiv enn preview-siden var, men kartet mangler

### Retning
- **Trips-produktet nærmer seg "desktop-klar" tilstand.** TripPage hadde allerede desktop. TripPreview har det nå. TripLibrary er neste kandidat
- **Placy.no er live og desktop-trafikk er sannsynlig.** Etter at vi fikser desktop for alle sider, bør vi vurdere en soft launch mot kontakter
- **Mønsterbiblioteket konsolideres:** Tre produkter (Explorer, Report, Trip) bruker nå alle samme dual-render + sticky map-mønster. Dette er blitt en de facto standard

### Observasjoner
- **Gjenbruk av mønstre sparert mye tid.** Hele desktop-layouten tok én komponent og én commit. Fordi ReportPage allerede hadde løst sticky map + scrollbar innhold, var det bare å kopiere mønsteret
- **Tech audit fant reelle avvik:** Planen hadde feil sticky-verdier og et 55/45 split som avvek fra standarden. Auditen fanget dette før implementering — verdifullt
- **Sub-komponent-ekstraksjon er god teknikk for dual-render.** HeroImage og HeroOverlay som delte komponenter gjør at endringer i hero-designet bare trenger å gjøres ett sted

---

## 2026-02-15 (sesjon 8) — City Knowledge Base Phase 2: Research Pipeline Execution

### Beslutninger
- **WebSearch i Claude Code som eneste research-kilde.** Ingen Anthropic API-nøkkel — all research kjøres som Task-agenter med WebSearch. Fungerte overraskende bra: 132 research-fakta med 97% verified (kun 4 av 132 hadde enkeltkilde)
- **Editorial backfill som separat fase, ikke mikset med research.** Holdt editorial parsing manuelt i Claude Code fremfor script. Grunn: krever vurdering av hva som er "verifiserbart" vs "subjektivt" — ikke godt egnet for automatisering
- **display_ready=false for alt.** Alle 186 nye fakta krever manuell kurator-gjennomgang. Selv om mange er korrekte, vil vi ha menneskelig kvalitetskontroll før publisering
- **UI-dedup via source_name filter, ikke DB-constraint.** `PlaceKnowledgeSection` skjuler backfill-038 fakta når editorial_hook finnes. Enklere enn DB-level dedup, og kurator kan override ved å sette display_ready=true

### Parkert / Åpne spørsmål
- **186 fakta venter på kurator-review.** display_ready=false. Trenger en effektiv gjennomgang-workflow — admin-siden fungerer, men er ikke optimalisert for bulk-gjennomgang
- **Korreksjon av editorial hooks?** Research avdekket 5 faktafeil i eksisterende hooks (Britannia-renovering 1.4B→1.2B, Top Chef-årstall, Credo grønne stjerne). Hookene er i `pois`-tabellen — bør de oppdateres?
- **Completion flow fortsatt ikke E2E-testet** (gjentatt)
- **Nature-topic er underrepresentert** (7 av 231 fakta). Urbane POI-er har lite naturrelevans. Bør vi droppe nature for barer/restauranter og heller la det være for parker/utsiktspunkter?

### Retning
- **Data-fylling gjør produktet mye mer verdifullt.** Med 231 fakta ser POI-detaljsidene ut som ekte redaksjonelt innhold. Forskjellen fra "Google Maps med norske navn" til "kuratert bykunnskap" er merkbar
- **Neste steg: kurator-review + display_ready.** Når 186 fakta er gjennomgått og publisert, vil offentlige sider vise rik kunnskap. Prioriter dette over nye features
- **Skalerbarhet er bevist.** Pipeline-mønsteret (manifest → research → JSON → backfill) fungerer og kan gjenbrukes for nye byer. Neste by: Bergen eller Oslo
- **Placy nærmer seg soft launch.** Med Trips MVP (5 sprints), desktop layout, SEO-forbedringer, og nå kunnskapsbase — produktet begynner å henge sammen

### Observasjoner
- **Research-kvaliteten overrasket positivt.** WebSearch i Claude Code Task-agenter fant relevante, verifiserbare fakta for nesten alle 20 POI-er. Tier 1-kilder (SNL, Wikipedia) var pålitelige. Tier 3 (blogger) krevde kryssverifisering
- **Editorial hooks er rikere enn forventet.** Plan estimerte 1.2-1.5 fakta per hook, men vi fikk 2.8 per POI. Hookene inneholder mer verifiserbar info enn antatt
- **Faktafeil i våre egne hooks er viktig funn.** 5 av 20 hooks hadde unøyaktigheter. Dette er en påminnelse om at redaksjonelt innhold også trenger fakta-sjekk
- **SHA-256 dedup er robust men blindt.** Fungerer perfekt for eksakte duplikater, men fanger ikke semantiske duplikater (to fakta som sier det samme med ulike ord). Kurator-review er siste linje

---

## 2026-02-15 — Dagoppsummering: Innholdsmodellen som AI kan jobbe med

### Hva skjedde

Dagen startet med trips og kostnadsreduksjon, men den røde tråden ble **å bygge et komplett system der AI kan produsere, strukturere, lagre og vise kuratert innhold**. Åtte sesjoner, 18 planer/brainstorms, 6 PR-er — alt konvergerte mot én ting: en innholdsmodell som gjør Placy-data til IP.

### De fire byggesteinene

**1. City Knowledge Base — strukturert kunnskapslagring**
`place_knowledge`-tabell med 9 topics, confidence-nivåer, dual-format (fact_text for mennesker + structured_data JSONB for maskiner), XOR-constraint (POI eller område), RLS, tospråklig. Ikke bare en database-tabell — en fullstendig arkitektur for kuratert bykunnskap.

**2. Research Pipeline — AI som innhøster**
Tre-stegs pipeline: manifest-script → Claude Code Task-agenter med WebSearch (4 parallelt) → backfill-script med SHA-256 dedup. Resultat: 186 nye fakta, 97% fra multiple kilder. Alt `display_ready=false` — kurator er siste ledd.

**3. Editorial Parsing — eksisterende innhold → strukturerte fakta**
200+ editorial hooks parset til knowledge-fakta med kvalitetsfiltre (kun verifiserbare, tidløse fakta), topic-klassifisering via decision tree, og batch-prosess med checkpoints. Konverterer ustrukturert tekst til querybar kunnskap.

**4. Curator Writing Levels — differensiert stemme per kontekst**
Modell for ulike registre: `editorial_hook` (museumsskilt), `bridgeText` (plakett ved inngangen), `fact_text` (encyklopedi), `transition_text` (teaser chain). AI vet nå hvilket register den skal bruke basert på konteksten.

### Strategisk betydning

**Før i dag:** AI produserte tekst-blobs bakt inn i hardkodede felter. Ingen gjenbruk, ingen maskinlesbarhet, ingen kvalitetssikring.

**Etter i dag:** Komplett innholdsmodell der:
- Research → strukturerte fakta med kilde og confidence
- Lagring → querybar, indeksert, tospråklig, RLS-beskyttet
- Visning → POI-detaljsider, MapPopupCard, admin-dashboard
- Kvalitet → `display_ready` separerer AI-output fra publisert innhold
- Skalering → pipeline gjenbrukes for nye byer (Bergen, Oslo)

### Også levert i dag (ikke innholdsmodell)

- **Trips v2 MVP komplett:** 5 sprints på én dag — POI-innhold, Preview, Guided/Free toggle, Rewards/progress, Visual polish. Scandic-demoen er klar
- **Google API-kostnad redusert fra 339 kr/halvmåned til ~0:** Cache alle Google-data i Supabase, CDN-URLer direkte i DB
- **Facebook URL på POI-kort:** Dedikert kolonne, shared `isSafeUrl` utility
- **Desktop layout for TripPreview:** 50/50 split med sticky map
- **POI gallery grid:** 3-bilde layout på POI-detaljsider
- **SEO-forbedringer:** JSON-LD, cache tags, Supabase Data Cache alignment

### Nøkkelinnsikt

> "Alle har tilgang til Claude. Men ingen har en strukturert, verifisert, kuratert kunnskapsbase om norske byer optimalisert for opplevelsesprodukter. Dataen er IP-en, ikke AI-modellen."

Innholdsmodellen er det som gjør Placy til mer enn en kartapp. Den gjør AI-compute om til kumulativ, proprietær data-IP som ikke kan kopieres over natten.

### Neste steg

- **Kurator-review av 186 fakta** — sette `display_ready=true` for verifiserte fakta
- **Definere alle tekstnivåer i Curator-skillen** — heroIntro, intro_text mangler register-beskrivelse
- **Pipeline for neste by** — Bergen eller Oslo med samme manifest → research → backfill-mønster
- **Koble trips til project_trips** — Scandic Nidelven-demoen trenger linkene

---

## 2026-02-15 — Sesjon 9: Kurator-review av 190 knowledge-fakta

### Beslutninger
- **185 fakta godkjent** (display_ready=true) etter systematisk gjennomgang av alle 190 display_ready=false fakta
- **6 Britannia-fakta fikset** for encoding-feil — alle å/ø/æ var borte fra WebSearch-agentenes output. Rettet manuelt med korrekt norsk
- **3 uverifiserte fakta oppgradert til verified** — Blomster og Vin (trd.by-kilde), Erkebispegården (Aftenposten-kilde), Antikvariatet (verifiserbar geografi)
- **5 fakta holdt tilbake** (display_ready=false):
  - 4 uten kilde: Den Gode Nabo livemusikk, Awake kaffesubjektiv, Britannia Spa åpent for ikke-gjester, Baklandet mikroklima
  - 1 for kort: "Ligger i Fjordgata ved havna." (29 tegn, for tynn som standalone)

### Parkert / Åpne spørsmål
- ~~Kurator-review av 186 fakta~~ **Løst** — 185 godkjent, 5 holdt tilbake
- **Korreksjon av editorial hooks?** Research avdekket 5 faktafeil i hooks — fortsatt uløst, nå mer relevant enn noen gang siden fakta er publisert
- **Nature-topic underrepresentert** (7 av 231) — bør vi droppe nature for barer/restauranter?
- **Encoding-problemet i WebSearch-agenter** — Britannia-faktaene mistet alle norske tegn. Trenger vi en post-processing-steg i research-pipeline for fremtidige byer?

### Retning
- **226 fakta er nå live på offentlige sider.** POI-detaljsidene har rik, kuratert kunnskap for 20 Trondheim-steder. Placy har gått fra "kartapp" til "bykunnskap-plattform"
- **Innholdsmodellen er fullstendig.** Pipeline → research → backfill → kurator-review → publish fungerer E2E
- **Neste prioritet: Bergen/Oslo-pipeline** eller Scandic-demo polish. Kunnskapsbasen er bevist — nå er det skalering

### Observasjoner
- **Encoding-feil var begrenset til Britannia.** Kun 6 av 190 fakta hadde problemet. Trolig fordi Britannia-agenten fikk mye innhold og WebSearch hadde encoding-tap i en spesifikk kilde. Andre POI-er var upåvirket
- **97% godkjenningsrate** (185/190) tyder på god research-kvalitet. De 5 som ble holdt tilbake var enten uten kilde eller for tynne — ikke feil, bare ikke verifiserbare
- **Kurator-review tok ca. 15 min med script-støtte.** review-issues.mjs identifiserte encoding, unverified, og korte fakta automatisk. For neste by kan dette bakes inn i pipeline
- **display_ready-mønsteret fungerer.** Separasjon mellom AI-output og publisert innhold er essensiell kvalitetssikring. Aldri skip dette steget

### Idéer parkert for senere
- **Instagram/sosiale medier på POI-sider:** Researche Instagram-handles og hashtags (#antikvariatet, #bakklandettrondheim) per POI. Vise som "Se på Instagram"-seksjon. oEmbed for visuelle embeds. Kan utvides til TikTok/YouTube. Krever ikke API — bare kuraterte lenker og hashtags lagret som knowledge-fakta. Potensielt sub-topic `visual` eller `social` i knowledge-taksonomien

---

## 2026-02-16 — Sesjon 10: SEO-audit av POI-detaljsider

### Beslutninger
- **Full SEO-audit av Britannia Hotel-siden** — 13 konkrete forbedringspunkter identifisert og prioritert
- **Dokumentert som compound-doc** i ny kategori `docs/solutions/seo-optimization/`
- **TODO-er lagt i PRD.md** — parkert for systematisk arbeid når de offentlige sidene er mer modne
- **Ikke implementert noe ennå** — bevisst valg. De offentlige sidene er fortsatt i utvikling, det gir ikke mening å optimalisere før strukturen er stabil

### Funn (topp 4 — høy impact)
1. **openingHours feil format** — bruker Google Places weekday_text, ikke schema.org OpeningHoursSpecification. Google ignorerer det
2. **PostalAddress ufullstendig** — mangler addressLocality (bynavn) og postalCode. Svekker local SEO
3. **JSON-LD image er én string, ikke array** — vi har allerede galleryImages, bare ikke sendt til schema
4. **Ingen generateStaticParams** — POI-sider bygges on-demand, gir tregere TTFB for crawlere

### Parkert / Åpne spørsmål
- **Alle 13 SEO-funn parkert som TODO** — se `docs/solutions/seo-optimization/poi-detail-structured-data-audit-20260216.md`
- **Favicon mangler** — bør lages når vi har endelig visuell identitet
- **Organization schema** — krever avklaring av sosiale profiler (@placy_no etc.)
- **robots.txt blokkerer /api/places/photo** — mest irrelevant nå at vi bruker featuredImage, men bør ryddes opp

### Retning
- **SEO er ikke blocker nå, men blir det snart.** Når sidene er indeksert og vi vil ranke, er structured data og generateStaticParams de viktigste grepene
- **De offentlige sidene trenger mer innhold først** — flere byer, kuratert tekst på kategorisider, long-tail-sider. Teknisk SEO uten innhold gir ikke ranking
- **Prioriter innhold → deretter teknisk SEO-sweep** som en samlet sprint

### Observasjoner
- **Grunnlaget er solid.** JSON-LD, sitemap, hreflang, ISR, canonical — alt er på plass. Det som mangler er polish og fullstendighet, ikke fundament
- **Schema-type-mapping er for enkel.** Én category.id → én schema-type funker ikke når Britannia Hotel er "restaurant" men egentlig hotell. Trenger override-mekanisme eller smartere mapping
- **Sitemap-lastmod er meningsløs.** Alle 1100+ URLer har identisk timestamp. Google ignorerer dette. Må bruke ekte updated_at fra DB

---

## 2026-02-16 (sesjon 11) — Knowledge Base Taxonomy v0.2: 5 kategorier, 19 sub-topics

### Beslutninger
- **Utvidet fra 9 flat topics til 5 kategorier med 19 sub-topics + 1 legacy.** Kuratorgjennomgang av 226 fakta viste "blødning" mellom topics — atmosphere-fakta i architecture, drinks i food, insider-tips i local_knowledge. Trengte mer granularitet OG logisk gruppering.
- **Kategorier kun i TypeScript, ikke i DB.** Kategorier er et presentasjonsanliggende. DB lagrer atomære fakta med topic-klassifisering. Hvordan topics grupperes for visning er en UI-beslutning som kan utvikle seg uavhengig av databaseskjemaet.
- **CHECK constraint over ENUM.** `ALTER TYPE ... ADD VALUE` kan ikke kjøres inne i en transaksjon. CHECK constraints kan erstattes atomisk med `BEGIN/COMMIT`. Bedre for evolverende taksonomier.
- **`as const satisfies`-mønsteret** for compile-time validering av kategori-topic-mapping. TypeScript fanger typoer i topic-arrays ved byggetidspunkt.
- **Beholdt `local_knowledge` som legacy-verdi** i DB og typer, mappet til 'inside'-kategorien. Ingen datamigrasjon nødvendig — alle 226 fakta forblir gyldige.

### Parkert / Åpne spørsmål
- **Re-kategorisering av 226 eksisterende fakta** — gradvis, manuelt i admin. Nye topics (atmosphere, signature, drinks, etc.) er tilgjengelige men ikke tatt i bruk ennå.
- **Instagram/sosiale medier-topics** (`photo`, `visual`, `social`) — parkert for v0.3
- **AI-basert tekst-syntese** — slå sammen flere fakta til sammenhengende prosa per kategori. Parkert.
- ~~Encoding-feil i knowledge-data~~ — fikset i forrige sesjon (226 fakta renset)

### Retning
- **Neste steg er innholdsproduksjon med utvidede topics.** Nå som taxonomy støtter drinks, atmosphere, signature etc., kan neste research-runde produsere mer presist kategoriserte fakta.
- **Admin-UI er klart for kurasjon.** Grupperte filtre gjør det mye enklere å jobbe med 19 topics enn 9 i flat liste.
- **PlaceKnowledgeSection viser nå kategorier automatisk.** Bare topics med fakta rendres — tomme kategorier skjules. Sub-topic-overskrifter vises kun når en kategori har 2+ aktive topics.

### Observasjoner
- **MapPopupCard-oppdagelsen viser verdien av systematisk filsøk.** Deepen-plan-fasen fant at `MapPopupCard.tsx:41` hadde hardkodet `local_knowledge`/`history`-prioritet som ville blitt oversett uten codebase-utforsking. Alltid søk etter alle imports av modifiserte typer.
- **7 filer importerer KNOWLEDGE_TOPICS** — 4 trengte manuell oppdatering, 6 auto-adapterer. `Record<KnowledgeTopic, string>` for label-maps tvinger compile-time fullstendighet.
- **Supabase worktree-gotcha:** `supabase db push` feiler i worktrees fordi `.supabase/`-mappen med prosjektreferanse ikke kopieres. Løsning: kopier migrasjonsfilen til hovedrepoet, kjør push der.
- **PR #44 shipped.** 5 filer endret, 211 innsettinger, 70 slettinger. Rent, fokusert diff.

---

## 2026-02-16 (sesjon 12) — Google API-kostnad Fase 2: Freshness-tracking

### Beslutninger
- **photo_resolved_at-kolonne for URL-friskhet.** Sesjon 2026-02-15 migrerte alle CDN-URLer, men hadde ingen mekanisme for å oppdage når de blir stale. Ny kolonne tracker siste resolve-tidspunkt.
- **Bi-ukentlig refresh-script.** `refresh-photo-urls.ts --days 14` re-resolver CDN-URLer eldre enn 14 dager. Estimert kost: ~$1.50 per kjøring (~500 Photo API-kall).
- **Null ut utgåtte referanser.** Tidligere ble expired photo_reference stående i DB — som betyr at neste script-kjøring prøvde igjen og igjen. Nå nulles både `photo_reference`, `photo_resolved_at` og `featured_image` ut.
- **minimumCacheTTL 30d → 7d.** Strammere feedback-loop for lh3-friskhet. Merk: global setting som påvirker alle remote-bilder, ikke bare Google.
- **Skippet code duplication-refactoring.** resolve + refresh scripts deler ~80% kode. Bevisst valgt å la dem stå som separate scripts — 2 filer er håndterbart, og en shared module-abstraksjon gir lite nok verdi.

### Levert (PR #45)
- Migration 041: `photo_resolved_at TIMESTAMPTZ` + backfill for eksisterende CDN-URLer
- `scripts/refresh-photo-urls.ts` — nytt script for periodisk URL-refresh
- `scripts/resolve-photo-urls.ts` — oppdatert med `photo_resolved_at` + expired-nulling
- `lib/utils/fetch-poi-photos.ts` — setter `photo_resolved_at` ved nye imports
- `next.config.mjs` — minimumCacheTTL 30d → 7d
- `COMMANDS.md` — vedlikeholdsplan dokumentert
- Code review: 2 P1 fikset (unchecked PATCH + NaN-guard), 1 P2 fikset (stale featured_image)

### Parkert / Åpne spørsmål
- **Places API (New) migrering** — neste prioritet. Photo-only kall er GRATIS på Essentials IDs Only-tier. `skipHttpRedirect=true` returnerer `photoUri` direkte. Vil eliminere 302-redirect-hacket helt.
- **Gallery images refreshes ikke.** Refresh-scriptet oppdaterer kun `featured_image`, ikke `gallery_images`. Lav prioritet — galleri brukes kun på POI-detaljsider.
- **~15 filer med proxy-fallback** — gjentatt fra forrige sesjon. Dead code som bør fjernes.
- **Supabase TypeScript-typer** — `photo_resolved_at` og `gallery_images` mangler i genererte typer.

### Retning
- **Google API-kostnad er nå under kontroll.** Fase 1 (2026-02-15) eliminerte runtime-kall. Fase 2 (denne) sikrer at CDN-URLer holdes ferske. Neste steg er Places API (New) for å gjøre photo-kall gratis.
- **Vedlikeholdsrutine etablert.** Refresh-script annenhver uke, opening hours månedlig. Bør vurdere GitHub Action for automatisering.

### Observasjoner
- **$200/month Google Maps credit er borte siden mars 2025.** Erstattet med per-SKU free thresholds (10K Essentials, 5K Pro, 1K Enterprise). Placy's volum (~6K calls/halvmåned) treffer allerede betalbar sone. Places API (New) migrering er ikke nice-to-have — det er nødvendig for bærekraftig drift.
- **lh3 CDN-URLer er IKKE permanente.** Google-dokumentasjon sier "short-lived" (~60 min). I praksis lever de uker/måneder. Men refresh-mekanismen er essensielt forsikring mot plutselig utløp.
- **Fire code review-agenter fanget reelle bugs.** Unchecked PATCH på expired refs ville medført at stale data aldri ble ryddet opp — direkte motstrid med kostnadsmålet. Systematisk review betaler seg.

---

## 2026-02-16 (sesjon 13) — Google API-kostnad Fase 3: Places API (New)

### Beslutninger
- **Migrerte alle photo-operasjoner til Places API (New).** Essentials (IDs Only) tier med `photos` field mask = $0/ubegrenset. `skipHttpRedirect=true` returnerer `photoUri` direkte som JSON — ingen 302-redirect-hack.
- **Delt helper-modul: `lib/google-places/photo-api.ts`.** To funksjoner (`fetchPhotoNames`, `resolvePhotoUri`) erstatter all legacy photo-kode. Konsistent `X-Goog-Api-Key` header (ikke URL query param).
- **Beholdt photo proxy-route.** Plan sa "slett den" — men grep avslørte ~15 komponenter som fortsatt fallbacker til `/api/places/photo?photoReference=...`. Dead code-vurderingen var feil. Beholdt med legacy-kommentar.
- **Slettet `lib/resolve-photo-url.ts`.** ISR-utility med null importere — ren dead code. Ingen komponenter bruker den etter forrige sesjon.
- **fetchPhotoNames kaster på API-feil (403/429/500).** Kritisk review-finding: legacy-versjonen returnerte tom array for alle feil-statuser, som fikk scripts til å tolke API-nedetid som "ingen bilder" og slette data. Nå: 404 = tom array, alt annet = throw.

### Levert (PR #46)
- `lib/google-places/photo-api.ts` — ny shared helper
- `lib/utils/fetch-poi-photos.ts` — import pipeline bruker New API
- `scripts/resolve-photo-urls.ts` — batch resolve med legacy-migrering
- `scripts/refresh-photo-urls.ts` — refresh med dual-format + auto-migrering
- `scripts/backfill-gallery-images.ts` — gallery backfill bruker New API
- `lib/resolve-photo-url.ts` — slettet (dead code)
- Code review: 4 P1 fikset (API key i URL, silent data deletion, input validation, placeId sanitering)

### Parkert / Åpne spørsmål
- ~~Places API (New) migrering~~ — ferdig!
- **~15 komponenter med proxy-fallback.** Disse bruker fortsatt `photoReference` direkte via `/api/places/photo`. Bør migreres til å bruke `featuredImage` som primær kilde. Når alle bruker CDN-URL direkte, kan proxy-routen slettes.
- **Gallery images refreshes ikke.** Videreført fra sesjon 12. refresh-scriptet oppdaterer kun `featured_image`.
- **Supabase TypeScript-typer.** Videreført — `photo_resolved_at` og `gallery_images` mangler i genererte typer.
- **Security-funn utenfor scope:** /api/places/route.ts eksponerer API-nøkkel i JSON-respons, /api/places POST mangler input-validering, admin-ruter mangler autentisering. Separate oppgaver.

### Retning
- **Google API photo-kostnad er nå $0.** Tre faser fullført på én dag: runtime-eliminering → freshness-tracking → Places API (New). Import av nye POI-er er nå kostnadsfritt for bilder.
- **Neste kostnadsfokus bør være Places Details (mixed fields).** `fetch-place-details.ts` bruker fortsatt Legacy for rating/website/opening_hours — dette er ikke Essentials tier og koster fortsatt.
- **Komponent-opprydning er teknisk gjeld.** 15 filer med proxy-fallback er en luktet men ikke kritisk — proxy-routen fungerer, den koster bare et ekstra hop.

### Observasjoner
- **Tre code review-agenter fant kritisk data-destruksjon.** `fetchPhotoNames` returnerte `[]` på 403/429/500. Scripts tolket dette som "ingen bilder" og slettet `photo_reference` + `featured_image`. Én Google API-nedetid ville slettet alle foto-data. Systematic review reddet oss.
- **Planer kan ta feil.** Plan sa "slett photo proxy" — grep viste 15+ referanser. Alltid verifiser antagelser med faktisk kodebase-søk.
- **Format-kompatibilitet via regex er robust nok.** `places/{id}/photos/{ref}` detekteres pålitelig. Legacy opake strenger matcher aldri. Refresh-scriptet migrerer automatisk — over tid forsvinner legacy-format fra DB.

---

## 2026-02-16 (sesjon 14) — Knowledge Reclassification: 3-pass gjennomgang

### Beslutninger
- **Kvalitetsstandard innført i CLAUDE.md: "Ferdig betyr ferdig."** Etter at pass 1 (50 av 231 fakta) ble levert som "ferdig", avdekket bruker at dette var utilstrekkelig. Standardiserte nå: full dekning, multi-pass for dataarbeid, rapporter fullstendighet (X av Y).
- **3-pass metodikk for reklassifisering:**
  - Pass 1: Beslutningsmodus — identifiser åpenbare flyttinger (50 endret)
  - Pass 2: Verifiseringsmodus — les ALLE 231 fakta med full tekst, bekreft eller flytt (9 endret, 222 bekreftet)
  - Pass 3: Stikkprøve — verifiser 6 tilfeldig valgte pass 1-beslutninger (alle korrekte)
- **3 fakta beholdt i `local_knowledge`:** Bevisst valg etter grundig vurdering — genuint lokal kunnskap som ikke passer bedre i andre topics.

### Levert
- `scripts/reclassify-knowledge-v02.ts` — pass 1: 50 reklassifiseringer (committed)
- `scripts/reclassify-knowledge-v02-pass2.ts` — pass 2: 9 reklassifiseringer (committed)
- `CLAUDE.md` — kvalitetsstandard lagt til
- `PROJECT-LOG.md` — sesjon 11 + denne oppføringen
- **231/231 fakta gjennomgått, 59 endret, 172 bekreftet riktig**

### Parkert / Åpne spørsmål
- **`seasonal` og `media` topics har null fakta.** Korrekt — disse er nye topics for fremtidig innhold fra neste research-runde.
- **`nature` har kun 1 faktum** (Bakklandet mikroklima). Trondheim by-POIs er ikke natur-fokuserte — dette endres om vi utvider til turområder.
- **Research-pipeline for v0.2 topics** — neste steg er å researche fakta for de nye topic-kategoriene (atmosphere, signature, insider, etc.) systematisk.
- **UI-visning av 5 kategorier** — PlaceKnowledgeSection viser fortsatt flat topic-liste. Plan for sammenhengende tekst per kategori er skrevet men ikke implementert.

### Retning
- **Data-kvaliteten i knowledge base er nå solid.** 231 fakta fordelt over 17 aktive topics med gjennomtenkt plassering. Grunnlaget er klart for UI-forbedring og nye research-runder.
- **Kvalitetsstandarden er viktigere enn reklassifiseringen.** Den prinsipielle endringen — at ALL jobb skal gjøres 100% komplett — påvirker alt fremtidig arbeid. Bruker er vibe coder som ikke kan QA i etterkant.

### Observasjoner
- **Pass 1 vs pass 2 avdekket forskjellen mellom "lett" og "grundig".** 50 åpenbare moves er raskt å finne. De 9 ekstra krevde å lese full tekst på alle 231 fakta og tenke nøye gjennom grensetilfeller. Forskjellen er 90% vs 100% — men de siste 10% er der kvaliteten sitter.
- **Brukerens meta-spørsmål var viktigst.** "Hva gjør at du ikke jobber i 10 min?" avdekket en systemisk svakhet. Svaret — "jeg stopper når det føles ferdig" — er uakseptabelt for en vibe coder som stoler på at jobben er gjort. Kvalitetsstandarden fikser dette.

---

## 2026-02-16 (sesjon 14) — Google API-kostnad Fase 3b: Migrasjon + Security

### Kontekst
Fortsettelse av sesjon 13 (Places API New migration). PR #46 var merget, men migrasjonsscriptet hadde kjørt uten effekt pga `--days 0`-bug, og code review hadde avdekket security-hull i API-rutene.

### Beslutninger
- **`--days 0` betyr "alle":** Fikset guard fra `> 0` til `>= 0`. Null dager = null cooldown = migrer alt.
- **API-nøkkel fjernet fra JSON-respons:** Photo-URLs i `/api/places` GET bruker nå intern proxy-path (`/api/places/photo?photoReference=...`) i stedet for Google-URL med `&key=`. Kritisk fix — nøkkelen lå synlig i DevTools for enhver besøkende.
- **Input-validering på alle API-ruter:** Regex for placeId/photoRef, bounds for lat/lng/radius, allowlist for type og fields. Aldri stol på klientdata i URL-interpolasjon.
- **Cache-størrelse capped:** `[placeId]`-ruten hadde ubegrenset in-memory Map — nå maks 2000 entries med eviction av eldste.
- **Sibling-rute hardnet:** `/api/places/[placeId]/route.ts` hadde samme manglende validering — fikset i review-runde.

### Levert
- 327/327 POIs migrert fra legacy til new photo_reference format (0 feil)
- PR #47 — security hardening (3 API-ruter + script fix)
- `docs/solutions/best-practices/api-route-security-hardening-20260216.md`

### Parkert / Åpne spørsmål
- **Rate limiting mangler på alle API-ruter.** POST nearby-search er mest utsatt — kan bruke opp Google-kvote via flooding. Upstash/ratelimit er enklest, men lav prioritet gitt lite trafikk
- **CORS ikke konfigurert.** API-ene er offentlig tilgjengelige fra enhver origin. Bør begrenses til placy.no i produksjon
- **15+ komponenter bruker fortsatt photo proxy.** Legacy fallback til `/api/places/photo` lever — bør fjernes når alle POIs har `featured_image` (som de nå har etter migrasjonen)

### Retning
- **Google API-kostnad er nå kontrollert.** Photo-ops: $0 (Places API New). Gjenværende legacy-kostnad: ~kr 100-150/mnd fra Place Details (opening hours, reviews) — dette kan elimineres ved å importere alt ved import-tid i stedet for runtime
- **Security-baseline er satt.** De mest kritiske API-rutene er nå hardnet. Rate limiting og CORS er neste steg, men lav prioritet med nåværende trafikkvolum
- **Neste kostnadsfase:** Eliminer runtime Place Details-kall helt — hent opening_hours/reviews ved import og lagre i DB

### Observasjoner
- **`--days 0` var en klassisk off-by-one.** `rawDays > 0` forkaster 0, men 0 er den mest nyttige verdien for "migrer alt". Lærdom: grenseverdier i CLI-args bør alltid testes
- **Security-review var verdt pengene.** Code review fant API-nøkkel i JSON-respons — dette hadde ligget i produksjon siden dag 1. Nøkkelen er nå rotert og fjernet fra responses
- **Tre faser av kostnadskutt er nå komplett:** (1) freshness tracking med photo_resolved_at, (2) Places API New migration for $0 photo-ops, (3) security hardening. Total estimert besparelse: kr 250-350/mnd → kr 0-50/mnd for photo-operasjoner

---

## 2026-02-16 (sesjon 15) — Photo proxy fjernet

### Beslutninger
- **Legacy photo proxy slettet.** `app/api/places/photo/route.ts` er borte. Alle 327 POIs har `featured_image` CDN-URLs, proxy-fallbacken var dead code.
- **photoReference fjernet fra public queries.** `lib/public-queries.ts` eksponerer ikke lenger `photo_reference` til komponenter. Scripts/admin beholder tilgang.
- **15 komponenter forenklet.** `featuredImage ?? (photoReference ? proxy : null)` → `featuredImage ?? null`. -122 linjer netto.

### Levert
- PR #48 — 19 filer endret, 1 API-route slettet

### Retning
- **Google API-proxy-laget er nå minimalt.** Kun `/api/places` (details) og `/api/places/[placeId]` (cached details) gjenstår. Begge brukes av admin/internal, ikke av offentlige sider.
- **Neste kostnadsfase:** Eliminer runtime Place Details-kall helt — hent opening_hours/reviews ved import-tid og lagre i DB. Da kan `/api/places` route.ts også slettes.

### Observasjoner
- **Ren opprydding er undervurdert.** -122 linjer dead code i 19 filer. Koden er enklere å forstå, færre API-ruter å vedlikeholde, null runtime-kostnad. Denne typen jobb lønner seg selv om den ikke legger til features.

---

## 2026-02-16 (sesjon 16) — Dead code audit + build-fix

### Beslutninger
- **`/api/places/route.ts` slettet** (187 linjer). Grep-audit viste null kallere fra frontend — GET (place details) og POST (nearby search) var dead code fra utviklingstiden.
- **3D-kart-komponenter slettet** (1019 linjer). `MapView3D`, `TripMap3D`, `ExplorerMap3D`, `useMap3DCamera` — ingen importerte dem. Fjerner Google Maps JS API-avhengigheten helt.
- **Google API-kostnad er nå effektivt kr 0/mnd.** Null runtime-kall fra offentlige sider. Import/admin-kall (50-200/mnd) dekkes av Google sin gratis-kvote (1000 Place Details + 1000 Nearby Search gratis/mnd).

### Levert
- Dead code slettet: 1206 linjer (4 komponenter + 1 API-route + 1 hook)
- Build-fix: `_tmp-top-pois.ts` slettet + `Array.from()` i reclassify-scripts
- Compound doc: `docs/solutions/best-practices/dead-code-api-route-audit-20260216.md`
- Vercel deploy grønn igjen etter ~10+ påfølgende failures

### Parkert / Åpne spørsmål
- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** kan fjernes fra env — ingen kode bruker den lenger. Lav prioritet.
- **`refresh-opening-hours.ts` bruker fortsatt Legacy API.** Kunne migreres til Places API (New) for konsistens, men koster allerede ~kr 0 pga lavt volum.
- **Trust-validate + import bruker Legacy API.** Samme vurdering — fungerer, koster ingenting, men er teknisk gjeld.

### Retning
- **Google-kostnadskuttet er fullført.** Fra estimert kr 250-350/mnd → kr 0/mnd. Ingen flere faser trengs med mindre volumet vokser dramatisk.
- **Neste naturlige fokus** bør være produkt/UX, ikke mer infrastruktur-opprydding. Kostnadsjobben har gitt trygghet til å skalere uten overraskende regninger.

### Observasjoner
- **Temp-scripts er build-bomber.** Next.js inkluderer ALLE `.ts`-filer i typecheck under build — også scripts som aldri kjøres i prod. `_tmp-top-pois.ts` brøt Vercel-deploy i ~10 commits uten at noen la merke til det. Lærdom: slett temp-filer umiddelbart, eller legg scripts i en mappe ekskludert fra tsconfig.
- **Grep-audit er undervurdert som verktøy.** To grep-kommandoer (finn alle Google API-kallere → sjekk hvem som importerer dem) avslørte at 1200+ linjer var dead code. Burde kjøres jevnlig etter store migrasjoner.
- **Sesjon 15 sin retning var feil.** Loggen sa "neste kostnadsfase: eliminer runtime Place Details-kall helt". Men audit viste at det allerede var null runtime-kall fra offentlige sider — "neste fase" var allerede løst uten at vi visste det. Viktig å verifisere antakelser med data før man planlegger arbeid.

---

## 2026-02-18 — Strategisk pivot: Fra turisme til eiendom

### Kontekst
Pitch deck vist til forretningsutvikler Markus. Ærlig, kritisk tilbakemelding som endrer retningen for Placy.

### Markus sin feedback
- **"Fantastisk prototype, men dette er ikke et produkt ennå."** Ingen bevist betalingsvilje.
- **"Luksusproblem"** — løsningen er god, men hvem betaler?
- **Hoteller er skeptisk:** Gjesten har allerede betalt for rommet. Placy sender gjester *ut* av hotellet — potensielt kannibaliserer bar/restaurant. Hvorfor betale?
- **Cruise samme logikk:** Passasjeren har betalt for lugaren. Hva de gjør i land er sekundært.

### Nøkkelinnsikt: Incentiv-alignment
Placy leverer verdi **etter** transaksjonen for hotell/cruise. Spørsmålet som avgjør segment: *Hvor leverer stedsinnsikt verdi **før** en kjøpsbeslutning?*

Svar: **Eiendom.** Nabolagskvalitet påvirker direkte om noen kjøper leilighet for 6M eller signerer kontorleie.

### Beslutninger
- **100% fokus på eiendom** — både privat eiendomsutvikling og næringseiendom
- **Hotell/cruise er Phase 2** — ikke dødt, men krever bevist kundecase først
- **Report er primærproduktet** for eiendom — erstatter generisk prospekttekst
- **Explorer kan komme som tillegg**, men Report er det som selges

### To sub-segmenter

**Næringseiendom (prioritet 1):**
- Kontakt: Kine @ KLP Eiendom (eiendomsforvalter)
- Modell: Porteføljebasert, recurring. Én avtale = mange eiendommer.
- Ferjemannsveien 10 var opprinnelig demo — kan gjenopplives

**Privat eiendomsutvikling (prioritet 2):**
- Kontakt: Kristian @ Eiendomsmegler 1
- Modell: Engangs per prosjekt (15-50k)

### Teknisk vurdering
Report og Explorer er allerede bygd for eiendom — minimal tech-endring:
1. Rekkefølge/vinkling på themes (Transport, Hverdagsbehov viktigere enn Kultur for kontor)
2. Noen manglende kategorier (barnehage, skole, coworking)
3. Språk/tone-tilpasning per prosjekt (allerede mulig via reportConfig)
4. Nytt prosjekt i databasen for KLP-demo

### Neste steg
1. **Ring Kine** — still spørsmål, ikke pitch. "Hvordan markedsfører dere nærområdet til leietakere?"
2. **Vis Ferjemannsveien-demo** bare hvis hun beskriver en smerte
3. **Kristian etterpå** — for boligmarkedet
4. **Ikke bygg mer** før betalingsvilje er validert

### Observasjoner
- **Scandic har en elendig "Nearby"-løsning** på sine hotellsider (Copenhagen Airport 97km, golfklubber 22km). Placy gjør dette 100x bedre. Men at noe er dårlig betyr ikke at de vil betale for å fikse det — de har *valgt* dette.
- **Scandic sin "Nearby" sitter på hotellsiden** (før booking), ikke bare for gjester. Så det *er* et before-transaction use case for hotell også. Men: Phase 2.
- **Bygde for egen frustrasjon som turist** — klassisk grunnfeil. "Jeg savnet dette i Barcelona" ≠ noen betaler for det.
- **Pitch deck hoppet fra demo til prisliste** uten å vise at noen har problemet. Neste pitch: spørsmål først, demo hvis smerte, pris aldri i første møte.

### Retning
Placy har gått fra "vi har tre produkter for seks bransjer" til **"Report for eiendom — validér med Kine."** Mye smalere. Mye sterkere. Alt annet er Phase 2+.

---

## 2026-02-18

### Pitch deck — 100% eiendom
- Skrevet om hele pitch-decken fra "hotell/cruise/turisme/eiendom" til **100% eiendom**
- Fjernet Trips helt, fjernet cruise-prising, fjernet 6-segment-oversikten
- Report er nå primærprodukt, Explorer er tillegg
- Ny headline: "Nabolaget som selger eiendommen"
- To delsegmenter: Næringseiendom (recurring, portefølje) vs Boligutvikling (per-prosjekt, engangs)
- Hero-bilde byttet fra Explorer til Report-screenshot

### Voice of Norway — full konkurranseanalyse

Gjennomførte dyp research på Voice of Norway / Guide To Go AS med 4 parallelle agenter. Full rapport: `klienter/placy/pitch/research-voice-of-norway-cruise.md`

**Selskapet:**
- **Guide To Go AS** (org. 932 608 952, Ålesund). Tidl. Experio AS (2017), tidl. Hopperguide AS (2010). Konsept fra 2009.
- ~7 ansatte. Utvikling outsourcet til Kroatia.
- **241 000 NOK i omsetning, -30% profitabilitet** (siste rapporterte, Experio AS). 15 år uten lønnsomhet.
- Aksjekapital: 36 144 kr. Lån fra Innovasjon Norge. Inkubert ved AKP/ProtoMore.
- Restrukturert 2023-24: Experio slettet, Guide To Go opprettet. Mulig finansiell opprydding.
- App: 20 ratings på iOS, ~50k downloads Android. Svak traction etter 7+ år.

**80+ betalende kunder — markedsvalidering:**
- Transport: VY (Bergensbanen), SJ, Arctic Train, FRAM
- ~18 kommuner: Molde, Kristiansund, Larvik, Ålesund, Kongsberg m.fl.
- Museer: Nobelsenteret, Teknisk Museum, Romsdalsmuseet, Hanseatisk Museum m.fl.
- Hotell: Classic Norway Hotels, Hotel Ullensvang, Reine Rorbuer
- Nasjonale: Nasjonale turistveger, Sametinget, Nordkapp
- ~15 campingplasser
- Partnere: Innovasjon Norge, Sparebanken Møre
- **Merk: Hurtigruten og Havila er IKKE på listen**

**Prismodell — hva markedet betaler:**
- Intro: 5 990 kr/år (10 POIs, 1 rute, 1 språk) + 9 900 setup
- Basic: 24 990 kr/år (50 POIs, 5 ruter, 5 språk) — eller 249 990 kr engangskjøp
- Pro: 35 990 kr/år (100 POIs, 10 ruter, 10 språk) — eller 359 990 kr engangskjøp
- Innholdsproduksjon (manus, oversettelse, voice-over) kommer PÅ TOPPEN — ikke inkludert
- AR-hologram: 90k-505k NOK i produksjon per oppsett
- Reell totalkostnad for et Pro-oppsett med innhold: sannsynligvis 200-500k+

**Hvorfor det ikke skalerte:**
- Studio-innspilt voice-over i mange språk = høy produksjonskostnad per by
- Kunder må skrive eget manus eller betale tillegg — høy friksjon
- Max 100 POIs i Pro-tier — Placy har 1000+ bare i Trondheim
- Ingen interaktivt kart, ingen nabolagsrapport — kun audioguide

### Hurtigruten-gapet — vid åpen mulighet

**Passasjertall:**
- Hurtigruten: ~200 000/år, 7→10 skip, +24% booking 2025 vs 2024
- Havila: ~70-90 000/år, 4 skip, 73% belegg
- **Totalt: ~270 000+ passasjerer/år, voksende**

**Hva passasjerene har i dag: Nesten ingenting.**
- Hurtigruten-appen: booking + dagsprogram. **Null destinasjonsinnhold.** 3.7/5, 17 ratings.
- Havila: MyVoyage web-portal, ingen app.
- Tredjeparts: "Kystruten" av en tysk utvikler (skipposisjon, vær, nordlys). Basic.
- Audioguide: AOYO-Guide — se detaljer under.

**AOYO-Guide — den eneste audioguiden for kystruten:**
- **Selskap:** AOYO-Guide GbR, Diespeck, Tyskland. Grunnlagt av Dietmar Schäffer og Thilo Kirsch — tyske turguider.
- **Hovedfokus er roadtrips** (Island, Namibia, California). Norge-guiden er et sideprosjekt.
- **Dekker kun 7 av 34 havner:** Ålesund (8 stopp), Trondheim (19), Bodø (5), Svolvær (3), Tromsø (14), Hammerfest (5), Kirkenes (8). Totalt 72 GPS-stopp, 80 min audio.
- **Kun engelsk og tysk.** Ingen norsk.
- **Pris:** $36 USD / €29,99 per nedlasting. Distribuert via GetYourGuide, Musement, guidemate.
- **Traction:** 39 likes på guidemate. Nesten null.
- **Portefølje:** 21 guider totalt, mest selvkjøringsguider. Island mest populær (62 likes).
- **Perspektiv:** To tyske roadtrip-guider har laget den *eneste* digitale destinasjonsguiden for 270 000 kystrutepassasjerer — som sideprosjekt. Placy har 1000+ POIs bare i Trondheim. De har 19.
- Ekskursjoner: 130+ turer, 65 lokale leverandører. 100% analogt.

**27 av 34 havner har null digital dekning.** Inkl. Honningsvåg (Nordkapp, 3,5t stopp).

**Hurtigrutens situasjon:**
- Gjeld redusert fra ~26 mrd til ~4,6 mrd NOK (feb 2025). Nye eiere (kreditorer tok over).
- Splittet fra HX Expeditions — nå rent kystselskap.
- **Ny CDO ansatt 2025** (Lisa Warner) — digital er på agendaen.
- Stabiliseringsfase, ikke innovasjonsfase. Partnerskap > bygge selv.

**Konkurranselandskapet:**
- Voice of Norway: dominerer kommune/museum-segmentet, men ikke cruise
- StoryHunt (København): nærmeste konkurrent, $746k funding, Tivoli som case. Har Oslo/Bergen/Tromsø.
- izi.TRAVEL: gratis plattform, 25 000 turer globalt. Variabel kvalitet.
- **Ingen eier cruise/kystrute-segmentet.** Null profesjonelle aktører.

### Placy vs Voice of Norway — head to head

| | Voice of Norway | Placy |
|---|---|---|
| Innhold | Manuelt: manus → studio → oversettelse | AI-pipeline: crawl → kuratere → generere |
| Kostnad/språk | Studioinnspilling (dyrt) | AI TTS (nesten gratis) |
| Oppdatering | Ny innspilling = ny kostnad | Regenerer lydfil = sekunder |
| POIs | Max 100 (Pro) | 1000+ i Trondheim |
| Produkter | Kun audioguide | Report + Explorer + Trips |
| Interaktivt kart | Nei | Ja |
| Ny by | Måneder (studio) | Dager (AI) |

### Åpne spørsmål for Markus
1. Er cruise-gapet stort nok til å prioritere nå, eller Phase 2 etter eiendom?
2. Hvem er beslutningstaker hos Hurtigruten? Lisa Warner (CDO)? Ekskursjonsteam?
3. B2B (selge til Hurtigruten) eller B2B2C (direkte til passasjerer)?
4. Voice of Norway som oppkjøpsmål? 80 kunder, lav omsetning, sannsynligvis billig. Eller utkonkurrere?
5. Innovasjon Norge støttet Voice of Norway — relevant for Placy?

### Retning
- **Eiendom er primær** — all pitch-energi dit
- **Cruise/Hurtigruten er Phase 2** — men researchen viser at muligheten er mye større enn antatt
- Voice of Norway beviser betalingsvilje (80+ kunder, 360k engangskjøp). Hurtigruten-gapet beviser udekket behov (270k passasjerer, null innhold). Placy løser kostnadsproblemet med AI.
- Referanse til Voice of Norway lagt inn i pitch-decken (differensierings-sliden) som markedsvalidering

### Plyo-research og konkurransestrategi (sent 18. feb)

**Plyo (plyo.com)** — Norges dominerende proptech for boligsalg:
- 250+ kunder, 56 MNOK omsetning, 40 ansatte, 70%+ markedsandel i enterprise
- Produkter: Site Project (prosjektnettside), Explore (3D boligvelger), Visuals (renderings), Plyo Work (CRM)
- Fusjonert med 3D Estate (Skandinavias ledende 3D for eiendom)
- Leangen Bolig bruker Plyo Cloud for boligvelger (`leangen.plyo.cloud`), resten er WordPress

**Leangen Bolig som case:**
- Nabolagssiden (`leangenbolig.no/sentral-beliggenhet/`) er bokstavelig talt: "IKEA 2 min. Treningssenter 7 min. Togstasjon 13 min."
- Perfekt eksempel på problemet Placy løser — lagt til i pitch-decket som navngitt eksempel (slide 2)

**Plyo-risiko — kan de bygge det Placy gjør?**
- "Vis nærmeste steder på kart" = trivielt, 2-4 uker dev. Kan godt stå på tavla allerede.
- MEN: kuratert innhold, editorial depth, native points, tier-system, verifiserte fakta = 6-12 mnd + ongoing manuelt arbeid
- Plyo er tech platform, ikke content company. De bygger verktøy, ikke redaksjonelt innhold.
- Risikoen er at vi *viser dem idéen* og de bygger en light-versjon med 250 kunder dag 1

**Strategisk beslutning: IKKE pitch til Plyo nå.**
- Land kunder direkte først (3-5 betalende)
- Bygg case studies og bevist etterspørsel
- Først snakk med Plyo fra en posisjon med traction: "Kundene deres spør allerede etter dette"

**Placy sine moats vs Plyo:**
1. **Koststruktur** — én person + AI-agenter vs 40 ansatte. Kan prise lavt med god margin.
2. **Fokus** — nabolagsinnhold er alt vi gjør. For Plyo er det feature #47.
3. **Speed** — ny by på dager. Plyo bruker 6 mnd å prioritere det internt.
4. **Data compound** — hver rapport gjør datasettet rikere. Plyo starter med null kuratert innhold.

**Næringseiendom > bolig som førstesegment:**
- Plyo er nesten utelukkende rettet mot boligutvikling/nybygg — ikke næring
- Ingen Plyo-overlapp i næringssegmentet
- Recurring revenue (forvaltere med porteføljer) vs engangsprosjekter
- Nabolaget er *mer* relevant for næring: lunsj, transport, ansattrekruttering
- Leiekontrakter fornyes hvert 3-5 år — nabolaget selger hver gang
- Færre, større kunder: én forvalter kan ha 10-50 bygg

### Kundeprospekter — research på de tre største i Trondheim

**1. EC Dahls Eiendom (Reitan Eiendom)**
- ~100 eiendommer i Trondheim sentrum, alle med dedikerte sider på ecde.no
- Kjøpte Entras portefølje (13 eiendommer, 187 000 m², 6,45 mrd NOK) i Q2 2024
- Drift-omsetning 74,7 MNOK (2023), 50+ ansatte
- Kontor, handel, restaurant, hotell, bolig
- Fokus: bærekraft, byutvikling (BREEAM Outstanding, FutureBuilt, Kulturkvartalet)
- Sjekket Nordre gate 12 og Søndre gate 12: **null nabolagsinformasjon** på eiendomssidene
- Kald start — ingen eksisterende kontakt
- Potensial: 500k–1M/år

**2. KLP Eiendom**
- Norges største eiendomsselskap: 2,4M m², verdi 105 mrd NOK, 190 ansatte
- Trondheim: **29 eiendommer**, ~290 000 m², leieinntekter 135 MNOK/år
- Inkl. Teknostallen (47,2k m² — flaggskip), Solsiden, **Ferjemannsveien 10 (eksisterende Placy-demo!)**
- 6 byer: Oslo, Trondheim, Stavanger, Bergen, Stockholm, København
- Sjekket Ranheimsveien 10: **null nabolagsinformasjon**, bare "like utenfor Trondheim sentrum"
- Varm start — eksisterende kontakt (Kine) + ferdig demo
- Potensial Trondheim: 300–500k/år. Hele konsernet: 1–2M/år

**3. Koteng Eiendom (Koteng-familien)**
- ~60 næringseiendommer, 270 000 m², leieinntekter **340 MNOK/år**
- Holding-omsetning 455 MNOK (2024), 58 ansatte, 34 selskaper i konsern
- Under utvikling: 70 000 m² nye næringslokaler (~1,75 mrd NOK)
- 35 ledige lokaler akkurat nå
- **Boligdelen (Koteng Jenssen, 50/50 med Jenssen Holding):**
  - Leangen Bolig (~2 000 boliger) — bruker Plyo for boligvelger, "IKEA 2 min" som nabolagsinfo
  - Leangenbukta (~500 boliger), Grilstad Marina (~1 000 boliger)
  - ~3 500 boliger under aktiv utvikling
- Sjekket Skonnertvegen 7: minimal nabolagsinfo, bare "10 min med bil til sentrum"
- Unik: **eneste med både næring OG bolig** — dobbel inngang
- Potensial: 500k–900k/år

**Sammenligning:**

| | EC Dahls | KLP Eiendom | Koteng |
|---|---|---|---|
| Eiendommer Trondheim | ~100 | 29 | ~60 |
| Boligprosjekter | Nei | Nei | 3 500+ boliger |
| Leieinntekter | Ukjent | 135 MNOK | 340 MNOK |
| Eier | Reitan (privat) | KLP (offentlig) | Koteng-familien |
| Eksisterende kontakt | Nei | Ja (Kine) | Nei |
| Placy-data klar | Nei | Ja (Ferjemannsveien) | Delvis (Leangen) |
| Beslutningshastighet | Rask | Treg | Rask |
| Skaleringsverdi | Kun Trondheim | 6 byer | Kun Trondheim |
| Totalpotensial/år | 500k–1M | 300k–2M | 500k–900k |

**Anbefalt rekkefølge:** KLP (varm, demo klar) → Koteng (dobbel inngang) → EC Dahls (volum)

Tre selskaper, ~190 eiendommer i Trondheim, null nabolagsinnhold. Samlet potensial: **1,5–3M/år.**

### Oppdatert retning
- **Næringseiendom er primærsegment** — recurring, ingen Plyo-overlapp, høyere relevans
- **Boligutvikling er sekundær** — per-prosjekt, Plyo-risiko, men Leangen Bolig viser behovet
- **Plyo er fremtidig distribusjonspartner, ikke nå** — land kunder først, pitch til Plyo fra styrke
- **Vinduet er ikke evig** — rask implementering i større kjeder er kritisk
- **Tre konkrete prospekter identifisert** — KLP, Koteng, EC Dahls. Alle researched med portefølje, økonomi, og eiendomssider sjekket for nabolagsinnhold (null hos alle tre)

---

## 2026-02-18 (sesjon 2) — /generate-bolig: Fra hotell til eiendom i koden

### Beslutninger
- Bygde `/generate-bolig` som **fork av `/generate-hotel`** — eget kommandofil, ikke profil-basert. Nok forskjeller til å rettferdiggjøre separasjonen.
- 3 nye kategorier (skole, barnehage, idrett) med offisielle norske API-er: NSR/Udir, Barnehagefakta, Overpass. Ingen web-scraping.
- 6 bolig-temaer erstatter 5 hotell-temaer. Viktigste endring: "Barn & Oppvekst" som nytt tema + "Natur & Friluftsliv" skilt ut fra "Kultur & Opplevelser".
- `park`/`outdoor` flyttet fra kultur-opplevelser til natur-friluftsliv i DEFAULT_THEMES. Påvirker hotell-Explorer (forbedring, ikke regresjon — temaer uten POIs auto-skjules).
- External-ID-basert dedup (nsr-{OrgNr}, bhf-{id}, osm-{nodeId}) — ikke navne-basert. Viktig lærdom fra tech audit.
- Institusjonell baseline-score (rating=4.0, reviews=10) for skoler/barnehager/idrett, ellers scorer de ~0 og kan ikke features.

### Parkert / Åpne spørsmål
- ~~Næringseiendom er primærsegment~~ — dette gjelder fortsatt strategisk, men Overvik ble bygget som første salgsmateriell
- Kommunenummer-mapping er hardkodet i kommandoen (Trondheim=5001, Oslo=0301, Bergen=4601). Trenger automatisk lookup for nye byer.
- NSR API returnerer *alle* skoler i kommunen (kan være 100+). Filtreringen på avstand er kritisk — trenger god GeoKvalitet-sjekk.
- Skal vi sette opp `/generate-naering` også? Eller holder bolig + hotell?
- Overvik-pilot er klar til kjøring. Trenger `npm run dev` + internett for API-kall.

### Retning
- **Koden er klar, piloten gjenstår.** Selve `/generate-bolig` er implementert og committed. Neste steg er å kjøre den for Overvik.
- **Eiendom-pivoten er nå materialisert i kode.** Strategien fra pitch-decken (100% eiendom) har nå en konkret pipeline. `/generate-hotel` er intakt for tilbakefall.
- **Tema-system er nå 7 temaer globalt** (var 5). Barnefamilier og Natur & Friluftsliv er synlige for alle prosjekter der POIs finnes. Hoteller påvirkes minimalt (ingen skoler/barnehager → tema skjules).

### Observasjoner
- Tech audit fanget 7 reelle feil i planen som ville bitt under implementering (manglende filer, feil API-antakelser, scoring-formel som nullet ut institusjonelle POIs). Investering i audit betalte seg.
- 16-stegs pipeline er ambisiøst. Risikoen er at den første kjøringen avslører problemer med de 3 nye API-ene (NSR, Barnehagefakta, Overpass) som krever real-time debugging.
- Boligrapport er et *mye* bredere produkt enn hotellrapport — 6 temaer vs 5, 2500m vs 800m, 3 ekstra API-er. Skaleringsutfordringen er at hvert nye boligprosjekt krever god data i suburban strøk der Google Places er tynt.
---

## 2026-02-27 — Konkurransevalidering: Brøset har kjøpt Explorer-konseptet

### Funn

Oppdaget at [broset.no](https://broset.no/#destinasjonen) har en kartløsning som er funksjonelt identisk med Placy Explorer — bestilt og betalt av fire av Trondheims største utbyggere.

**Utbygger:** Brøset Utvikling AS — eid 25% av Trym Bolig, Heimdal Bolig, Fredensborg Bolig, og Byggteknikk Prosjekt. ~1 735 boliger, 300 000 m², Trondheims største boligutvikling.

**Nettside laget av:** [Headspin](https://www.headspin.no/) — kommunikasjonsbyrå i Trondheim, 30 ansatte, WordPress-byrå. Kontaktperson web: Andreas Wivestad.

**Kartløsningen:** Google Maps satellitt med 17 POI-markører. Popup-kort per POI med navn, beskrivelse, bilde, og fire reisetids-badges (buss/bil/sykkel/gange). Statisk data, ingen filtrering, ingen kategorier. Bygd som custom WordPress-modul.

**Estimert kostnad kartløsning:** 50–90 000 kr (40–60 timer × 1 200–1 500 kr/t). Hele nettsiden: 350–550 000 kr.

### Placy vs. Brøset — head-to-head

| | Brøset (Headspin) | Placy Explorer |
|---|---|---|
| Reisetider | Hardkodet, statisk | Live via Mapbox Directions/Matrix |
| Time budget-filter | Nei | 5/10/15 min med visuell dimming |
| Kategorisering | Ingen | Tematisk med ikoner |
| Kuratert innhold | Én setning per POI | Editorial hooks, local insights |
| Skalerbarhet | Custom one-off | Generisk for alle prosjekter |
| Vedlikehold | Manuelt per POI | Database-drevet |
| Ekstra produkter | Nei | Guide + Report |

### Strategisk betydning

- **Markedsvalidering:** Fire store utbyggere har gått til et byrå og *betalt* for nøyaktig denne funksjonaliteten. Behovet er reelt og betalingsviljen dokumentert.
- **Prisanker:** 50–90k for en statisk engangsløsning. Placy kan levere mer for samme eller lavere pris — og skalere på tvers av prosjekter.
- **Salgsingangen:** Brøset er et fellesprosjekt mellom Trym, Heimdal, Fredensborg og Byggteknikk. Alle fire er potensielle Placy-kunder — og de har allerede bevist at de verdsetter konseptet.
- **"10-minuttersbyen":** Brøset bruker dette som bærende konsept. Vår time budget-funksjon (5/10/15 min) er den interaktive versjonen av nøyaktig dette.

### Salgsvinkel — "Hva betalte dere for kartet?"

Konkret pitch-tilnærming: Gå inn i møte med en av de fire utbyggerne og si:

> "Vi ser at dere har en kartløsning på broset.no som viser nærområdet med reisetider. Det er nøyaktig det vi gjør — men dynamisk, interaktivt, og skalerbart. Kan jeg spørre hva dere betalte for den? For vi kan levere dette på samtlige prosjekter til en hyggelig pris."

Dette er en sterk åpner fordi:
1. Det viser at du kjenner dem og har gjort research
2. Det anerkjenner at de allerede har validert behovet
3. Prisspørsmålet avslører hva de har betalt — og setter ankeret for vår prising
4. "Samtlige prosjekter" viser skaleringsverdien vs. one-off byrå-jobb

### Retning
- Brøset-casen bør inn i pitch-deck som konkret markedsvalidering
- Trym, Heimdal, Fredensborg, Byggteknikk — fire nye prospekter i tillegg til KLP/Koteng/EC Dahls
- Vurdere å bygge en quick Brøset-demo i Explorer som "slik kunne det sett ut"

---

## 2026-02-27 (sesjon 2) — POI Quality Pipeline for Bolig

### Beslutninger
- **Hybrid kvalitetspipeline:** Grovfiltre (TypeScript, import-tid) + Finfiltre (LLM, Claude Code command-steg). Grovfiltrene fanger de billige casene, LLM tar de som krever resonnering.
- **Fire grovfiltre i billigste-først rekkefølge:** business_status → distance → quality → name_mismatch. Pipeline stopper ved første treff — sparrer unødvendig prosessering.
- **Per-kategori gangavstandstak:** Restaurant 15 min, bus 10 min, hospital 45 min. Konstant: 80m/min. Differensiert fordi folk kjører til kjøpesenter men går til bakeri.
- **Word-boundary name matching med single-word exemption:** "Transport Service AS" avvises som restaurant, men "Transport" (kjent Oslo-restaurant) slipper gjennom. Single-word navn er for tvetydige for regelbasert filter — overlates til LLM.
- **LLM-filtre som Claude Code command-steg, ikke SDK:** Prosjektet har ingen `@anthropic-ai/sdk`-avhengighet. All LLM-reasoning følger editorial hooks-mønsteret: Claude Code leser, vurderer, oppdaterer via Supabase REST.
- **Steg 5a og 5b er uavhengige:** Feil i kategori-validering blokkerer ikke duplikat-clustering. Robusthet gjennom isolasjon.
- **Slett aldri fra `pois`-tabellen:** Kvalitetsfiltre fjerner kun koblinger (`project_pois`/`product_pois`). POI-er deles på tvers av prosjekter.

### Levert (feat/poi-quality-pipeline)
- `lib/generators/poi-quality.ts` — 6 funksjoner, 5 konfigurasjonstabeller, komplett typesystem
- `lib/generators/poi-quality.test.ts` — 50 tester med Overvik regression-data
- Integrert i `poi-discovery.ts` for Google, Entur, og Bysykkel
- Steg 5a + 5b lagt til i `generate-hotel.md` pipeline (13 → 15 steg)
- Compound-dokumentasjon: `docs/solutions/feature-implementations/poi-quality-pipeline-bolig-20260227.md`

### Parkert / Åpne spørsmål
- ~~Hotel-kategori misklassifisering~~ → Grovfiltrene + Steg 5a løser dette systematisk
- **Overvik-demoen:** Bør regenerere med kvalitetsfiltrene og verifisere visuelt at resultatet er salgbart
- **generate-bolig.md:** Eksisterer ikke ennå — generate-hotel.md med bolig-profil er neste steg. Kvalitetsfiltrene er klare, men bolig-spesifikke kategorier (skole, barnehage, lekeplass, idrett, badeplass) må inn i discovery + kategorimapping
- **Safety valve:** Plan nevner "minimum 2 POI-er per kategori" safety valve som siste resort. Ikke implementert — venter på erfaring med faktiske bolig-generering

### Retning
- **Kvalitetsinfrastrukturen er på plass.** Neste steg er å faktisk generere en bolig-demo (Overvik eller annet) og verifisere at output er salgbart.
- **Brøset-casen er den ultimate testen:** Kan vi generere en Explorer for Brøset som slår broset.no sin statiske kartløsning? Med kvalitetsfiltrene bør svaret være ja.
- **Salgspipelinen venter på demoer:** Trym, Heimdal, Fredensborg, Byggteknikk, KLP, Koteng, EC Dahls — alle trenger en overbevisende demo. Kvalitetsfiltrene var blokkeren.

### Observasjoner
- **Tech audit fant reelle designfeil:** LLM-filtre var opprinnelig planlagt som Anthropic SDK-kall. Audit avdekket at prosjektet har null SDK-avhengighet — alt LLM-arbeid følger editorial hooks-mønsteret. Ville blitt en arkitekturfeil.
- **Brainstorm → Plan → Deepen → Audit → Work-pipelinen ga solid resultat.** Deepening grunnla planen med best practices, audit korrigerte 12 designfeil, og work-fasen hadde kun 1 failing test (word-boundary edge case) som var raskt fikset.
- **50 tester med ekte Overvik-data er verdifullt.** Brilliance Cleaning, Crispy Fried Chicken, Oasen Yoga, H2 Frisør — alle er regression-tester. Neste gang noen endrer filtrene, brekker testene hvis de utelater reelle cases.
- **Prosjektet skifter gir:** Fra "bygg produkt" til "selg produkt". Kvalitetsfiltrene var den siste tekniske blokkeren for salgbare bolig-demoer. Nå er det pipeline, demo, pitch.

---

## 2026-02-27 (sesjon 3) — Generate Bolig Infrastructure (PR #52)

### Beslutninger
- **Gjenbruk av eksisterende plan (2026-02-18):** Planen fra 18. februar var allerede brainstormet, planlagt, deepened, og tech-audited. Delta-audit bekreftet at alle filer fortsatt eksisterer og at infrastrukturen er klar for implementering. Spart ~45 min planlegging.
- **7 radius-steder, ikke 6:** Delta-audit avdekket at `app/api/admin/projects/[id]/route.ts` linje 16 også hadde `.max(2000)` — dette manglet i den originale planen. Oppdaterte planen.
- **barnefamilier theme:** Ny theme med skole, barnehage, lekeplass, idrett. Farve #f59e0b (amber). badeplass lagt til kultur-opplevelser.
- **External ID dedup-mønster:** `nsr_id`, `barnehagefakta_id`, `osm_id` med partial unique indexes. Upsert via external ID, ikke navn-basert dedup.
- **generate-bolig.md som lokal command:** Gitignored (`.claude/*`), men dokumentert i compound. 16-stegs pipeline med NSR/Barnehagefakta/Overpass API-steg.

### Levert (PR #52, merget)
- `supabase/migrations/042_bolig_categories.sql` — 3 nye kategorier + source tracking + external ID-kolonner
- Max radius 2000→3000 i 7 steder, 6 filer (Zod + UI-sliders)
- barnefamilier theme + explorer-cap + badeplass i kultur-opplevelser
- DiscoveredPOI.source utvidet med nsr/barnehagefakta/osm
- determineSource(), DbPoi, POIImportData oppdatert
- queries.ts mapping oppdatert (Record<string, unknown>-pattern)
- `.claude/commands/generate-bolig.md` — 16-stegs bolig-pipeline (lokal)
- Compound: `docs/solutions/feature-implementations/generate-bolig-infrastructure-20260227.md`

### Parkert / Åpne spørsmål
- **Selve Brøset-demoen er ikke generert ennå.** Infrastrukturen er på plass, men `/generate-bolig "Brøset" "Brøsetvegen 176, Trondheim"` er ikke kjørt. Dette er det faktiske salgsverktøyet.
- **NSR/Barnehagefakta/Overpass API-er er ikke testet live.** Steg 5.5-5.7 i generate-bolig.md bruker disse API-ene — første kjøring vil avdekke eventuelle endringer i API-format eller autentisering.
- **Safety valve (minimum 2 POI-er per kategori):** Fortsatt ikke implementert — venter på erfaring med faktisk bolig-generering.
- **Overvik bør regenereres:** Med både kvalitetsfiltre (PR #51) og bolig-infrastruktur (PR #52) bør Overvik-demoen regenereres for å verifisere at output er salgbart.

### Retning
- **Neste steg er å kjøre `/generate-bolig` for Brøset.** Alt infrastruktur er klart. Kommandoen eksisterer. Det som mangler er å faktisk generere demoen og verifisere visuelt.
- **Etter Brøset: salgsmøter.** Trym, Heimdal, Fredensborg, Byggteknikk — alle har betalt 50-90k for broset.no sin statiske kartløsning. En dynamisk Explorer-demo bør vinne dem over.
- **Retningen er riktig.** To sesjoner i dag: kvalitetsfiltre (PR #51) + bolig-infrastruktur (PR #52). Begge var blokkere for salgbare demoer. Nå gjenstår kun generering og pitch.

### Observasjoner
- **Delta-audit av gammel plan fungerte godt.** I stedet for å re-planlegge fra scratch, kjørte vi en Explore-agent for å verifisere at planen fortsatt var gyldig. Fant den 7. radius-lokasjonen som ville blitt en bug.
- **3 sesjoner i dag, alle produktive.** Sesjon 1: POI quality pipeline (50 tester, 6 filtre). Sesjon 2: Project log. Sesjon 3: Bolig-infrastruktur (14 filer, 1 migrasjon). God flyt.
- **generate-bolig.md er gitignored — dette er en bevisst trade-off.** Kommandoen er lokal fordi den inneholder spesifikke API-kall og prosedyrer som ikke bør deles. Men det betyr at den forsvinner med worktree-rydding. Compound-doc kompenserer.

---

## 2026-02-28 — Brøset Demo Generert + generate-bolig Rewrite

### Beslutninger
- **Brøset-demoen er generert og visuelt verifisert.** Hele 18-stegs pipelinen kjørt: geocoding → kunde → prosjekt → Google Places → NSR skoler → Barnehagefakta → Overpass idrett → linkede lekeplasser → kvalitetsfiltrering → editorial hooks → translations → visual QA. Resultatet er salgbart.
- **generate-bolig.md fullstendig omskrevet (477→833 linjer, 16→18 steg).** Basert på alt som ble lært under Brøset-genereringen. Kommandoen er nå selvstående — ingen "identisk med generate-hotel"-referanser igjen.
- **Multi-pass kvalitetspipeline som eksplisitt arkitektur:** Import-grovfiltre → LLM-review (suburban-spesifikke kriterier) → duplikat-clustering → featured re-marking → categories refresh. Rekkefølgen er ufravikelig — featured ETTER filtrering.
- **10 gotchas dokumentert fra faktiske feil:** heroIntro DB constraint, theme translation scoping, NSR manglende felt, Barnehagefakta null IDs, featured som forsvinner — alt fanget i kommandoen.
- **Studentrelaterte POI-er fjernet som egen kategori:** I universitetsbyer (Trondheim) er studentbarer/-kantiner irrelevante for boligkjøpere. Lagt inn som eksplisitt filterkriterium.
- **Internasjonal fast food fjernet for premium-følelse:** Burger King, Subway etc. senker inntrykket. Lokale kjeder (Peppes, Egon) beholdes — de ER nabolaget.

### Levert
- Brøset-demo: `http://localhost:3000/broset-utvikling-as/broset/explore` + `/report`
- ~111 POI-er etter kvalitetsfiltrering (fra ~200 rå)
- 33 featured POI-er, alle med editorial hooks (NO+EN)
- 6/6 temaer med bridgeText (NO+EN)
- `.claude/commands/generate-bolig.md` — 833 linjer, 18 steg, 10 gotchas
- `docs/solutions/feature-implementations/generate-bolig-quality-pipeline-rewrite-20260228.md`

### Parkert / Åpne spørsmål
- ~~Selve Brøset-demoen er ikke generert ennå~~ → Generert og verifisert
- ~~NSR/Barnehagefakta/Overpass API-er er ikke testet live~~ → Testet, gotchas fanget
- **Theme translation scoping er global:** entity_id "hverdagsliv" deles på tvers av prosjekter. Neste boligprosjekt overskriver Brøsets engelske bridgeTexts. Akseptabelt nå, men trenger løsning ved 2+ samtidige boligprosjekter.
- **heroIntro kun norsk:** DB check constraint tillater ikke entity_type "product" i translations. Akseptabelt fordi kjøperen er norsk, men bør vurderes om engelskspråklige markeder blir aktuelle.
- **Overvik bør regenereres** med den nye kommandoen for å sammenligne kvalitet.
- **Deploy til Vercel:** Brøset-demoen lever kun lokalt. Må deployes for salgsmøter.

### Retning
- **Demoen er klar. Neste steg er salg.** Trym, Heimdal, Fredensborg, Byggteknikk — alle har betalt 50-90k for broset.no. En dynamisk Explorer + Report-demo bør overbevise.
- **generate-bolig er nå på nivå med generate-hotel.** Begge kommandoene produserer salgbare resultater uten manuell opprydding. Bolig-versjonen er mer detaljert fordi forstadsdata krever hardere kvalitetsfiltrering.
- **Produktet skifter fra "bygg" til "selg".** Infrastruktur (PR #51, #52) + demo (Brøset) + kvalitetskommando (rewrite) = salgsklar. Neste fase er pitch-deck, møtebooking, og prising.

### Observasjoner
- **Første kjøring avdekker alltid gotchas.** 10 av 10 gotchas i den nye kommandoen ble oppdaget under Brøset-genereringen, ikke under planlegging. Planer er hypoteser — kjøring er validering.
- **"Identisk med X" er en antipattern i kommandoer.** Den originale kommandoen sa "identisk med generate-hotel" for 4 steg. Under kjøring viste det seg at bolig-konteksten krever helt andre regler. Eksplisitt > referanse.
- **Editorial hooks med WebSearch gir genuint god kvalitet.** Tier 3-hooks med faktisk research (etableringsår, spesialiteter, nabolagskontekst) løfter demoen fra "generert" til "kuratert". Dette er Placys differensiator vs. statiske kartløsninger.
- **Kvalitetsfiltrering er viktigere for forstadsdata enn for bykjerner.** Byhoteller med 800m radius og minRating 3.5 filtrerer naturlig. Bolig med 2500m radius og minRating 0 slipper gjennom alt — dermed trenger du LLM-pass for å luke ut støy.
- **Kommando-som-institusjonell-hukommelse fungerer.** 833 linjer med eksplisitte regler, gotchas, og eksempler = neste generering kan kjøre uten å gjenta de samme feilene. Compound-effekten er reell.

---

## Sesjon 2026-02-28b — Onboarding velkomstskjerm + smart rapportfiltrering

### Beslutninger
- **Velkomstskjerm med tema-valg.** Besøkende lander på en dedikert velkomstside i stedet for å dumpes rett inn i Explorer/Report. Hero-bilde, prosjektnavn, og avkryssingskort for temaer. Valgte temaer sendes som query-param til Report.
- **Navigasjonspills skjult på velkomst, animert inn på produktsider.** Explore/Report-togglen gir ikke mening før brukeren har valgt et produkt. Pill-animasjonen (scale+fade) gir en naturlig overgang.
- **Per-kategori filterregler i rapporten.** Gikk fra én global `INITIAL_VISIBLE_COUNT = 12` til differensierte regler per kategori. Buss: maks 5. Idrett: maks 3. Barnehage: 6 synlige + "Hent flere". Frisør: ingen begrensning.
- **Skolekrets-filtrering via Trondheim kommunes GeoServer.** I stedet for å vise 19 tilfeldige skoler, viser vi kun de som prosjektet faktisk sogner til. Videregående/NTNU vises alltid uavhengig av krets.
- **Statisk GeoJSON > runtime API-kall.** Skolekretsdata (700KB) lagres lokalt. Endres maks årlig, null runtime-avhengighet. Point-in-polygon med WGS84→UTM32N konvertering.

### Parkert / Åpne spørsmål
- **Skolekrets kun Trondheim.** Systemet fungerer perfekt for Trondheim (43 barneskretser, 18 ungdomsskretser). Andre kommuner trenger tilsvarende GeoServer-data — de fleste har det via geoinnsyn.no, men hvert datasett må hentes separat.
- **VGS/høyskole-matching er keyword-basert.** Sjekker om navnet inneholder "vgs", "videregående", "ntnu" osv. Funker for Trondheim, men kan trenge utvidelse for andre byer.
- **Theme translation scoping er global** (fra forrige sesjon, fortsatt åpen).
- **Deploy til Vercel** (fra forrige sesjon, fortsatt åpen).
- **Overvik bør regenereres** med den nye kommandoen (fra forrige sesjon).

### Retning
- **Rapporten er nå kontekstuell, ikke bare geografisk.** "Her er det som er relevant for deg" i stedet for "her er alt innen 2km". Skolekrets-logikken er det klareste eksempelet — en barnefamilie bryr seg om hvilken skole de sogner til, ikke de 19 nærmeste skolene.
- **Velkomstskjermen er første steg mot personalisering.** Tema-valgene lar brukeren forme sin egen rapport. Neste naturlige steg er at valgte temaer også påvirker rekkefølge og dybde i rapporten.
- **Infrastrukturen for geodata er på plass.** `data/geo/trondheim/` + `getSchoolZone()` er gjenbrukbart. Samme mønster kan utvides med barnehagekretser, grunnkretser, eller andre kommunale data.

### Levert
- PR #50 oppdatert med 3 nye commits
- `components/shared/WelcomeScreen.tsx` — velkomstskjerm med tema-kort
- `components/shared/ProductNav.tsx` — skjulte pills på velkomst, animasjon på produktsider
- `data/geo/trondheim/barneskolekrets.json` + `ungskolekrets.json` — offisielle skolekretspolygoner
- `lib/utils/school-zones.ts` — skolekrets-lookup med WGS84→UTM32N + point-in-polygon
- `components/variants/report/report-data.ts` — per-kategori `CATEGORY_FILTER_RULES` + `applyCategoryFilter()`
- 34 tester, alle grønne

### Observasjoner
- **Offentlige geodata er tilgjengelige, men gjemt.** Trondheim kommunes GeoServer har full WFS med alle skolekretsene — men det tok 30 minutter å finne riktig endpoint fordi GeoInnsyn er en SPA som skjuler backend-URL-ene. Nøkkelen var å inspisere WMS legend-URL-en i DOM-en.
- **"Hent flere"-knappen løser mye.** Brukerens innsikt om at den eksisterende expand-knappen allerede håndterer overflow var viktig. Vi trengte ikke et helt nytt UI — bare smartere initialverdier per kategori.
- **Filtering er mer verdifullt enn mer data.** Å gå fra 19 skoler til 4 relevante skoler er en sterkere forbedring enn å legge til 10 nye skoler. Kurering > kvantitet.

---

## Sesjon 2026-02-28c — Skolekrets-filtrering i generate-bolig pipeline

### Beslutninger
- **WebSearch for skolekrets, ikke lokal GeoJSON.** Sesjon 2028-02-28b planla statisk GeoJSON + point-in-polygon. Under faktisk utførelse viste det seg at GeoInnsyn-API-et ikke er åpent tilgjengelig via standard WFS — skolekretslaget finnes ikke blant de 400+ lagene på `kart5.nois.no`. WebSearch + LLM-vurdering gir korrekt skolekrets uten API-avhengighet og fungerer for alle norske byer.
- **Brøset-demo fikset: 19 → 5 skoler.** Fjernet 14 skoler som ikke tilhører Brøsets skolekrets. Beholdt: Eberg (nærskole), Blussuvoll (ungdomsskole), Strinda vgs, Montessori, International School.
- **Skolekretsbevisste editorial hooks.** "Nærskolen for Brøset" er langt mer verdifullt for en boligkjøper enn "Grunnskole i nabolaget." Hooks kommuniserer at dette er DERES skole — en kjøpsfaktor.
- **generate-bolig kommandoen oppdatert (833 → 908 linjer).** Steg 5.5 omstrukturert til 4 understeg: 5.5a (hent NSR), 5.5b (WebSearch skolekrets), 5.5c (filtrer), 5.5d (hooks med maler).

### Parkert / Åpne spørsmål
- **Velkomstskjerm + rapportfiltrering** (fra sesjon 28b) — planlagt men ikke implementert enda
- **Deploy til Vercel** — fortsatt åpen
- **Overvik bør regenereres** med den oppdaterte kommandoen
- **Skolekrets-søk kan feile for nye utbyggingsområder.** Brøset er et stort nok prosjekt til at skolekretsen er dokumentert. Mindre, nyere felt kan mangle tydelig kretsinformasjon på nett — da faller vi tilbake på "nærmeste barneskole."

### Retning
- **Kommandoen modnes med hver kjøring.** 477 → 833 → 908 linjer. Hver reell demo avdekker hull som lukkes. Neste demo (ny by? nytt prosjekt?) vil teste WebSearch-tilnærmingen for skolekrets i en annen kontekst.
- **"Salgbar uten manuell opprydding" er stadig nærmere.** Skoler var det siste store kvalitetshullet. Med skolekrets-filtrering, LLM-kvalitetspass, og skolekretsbevisste hooks er Brøset-demoen nå på nivå med hotel-demoene.
- **Kurering er produktet.** Placy skiller seg fra statiske kartløsninger (broset.no) ved å vise det relevante, ikke alt. 5 riktige skoler > 19 tilfeldige skoler. Denne filosofien gjelder hele pipelinen.

### Levert
- Brøset-demo: 14 skoler fjernet, Eberg som featured, skolekretsbevisste hooks (NO + EN)
- `.claude/commands/generate-bolig.md` — Steg 5.5a-d, gotcha #11, QA-sjekk med skolekrets
- `docs/solutions/feature-implementations/skolekrets-filtering-bolig-pipeline-20260228.md`

### Observasjoner
- **GeoInnsyn ser åpent ut, men er lukket.** "GeoJson"-knappen og kartlaget antyder åpen data, men selve API-et er en Angular SPA uten REST-endepunkt for skolekretser. 30+ minutter brukt på å prøve WFS, API-stier, og JS-parsing — uten resultat.
- **WebSearch er overraskende pålitelig for skolekretser.** Kommune-nettsider, skolenes egne sider, og WikiStrinda gir konsistent informasjon om hvilken barneskole som sogner til hvilken ungdomsskole. To søk er nok.
- **Featured-markering er skjør.** Åsvang var featured. Fjerne Åsvang fjernet featured. Gotcha #1 ("featured forsvinner etter kvalitetsfiltrering") gjelder også manuell fjerning — alltid sjekk og erstatt.

---

## 2026-03-02 — Innovasjon Norge & Markedsavklaring

### Research

**Markedsavklaring (nå Oppstartstilskudd 1):**
- Inntil 100-200k NOK for å avklare om betalingsvillig marked finnes
- Skal IKKE bygge ferdig — teste, validere, dokumentere
- Forventet leveranse: bevis på markedsaksept (pilotavtaler, LOIs, betalende kunder, partnerinvolvering)
- Selskap < 3 år, AS, vesentlig nytt, vekstambisjoner

**Kundeintervju-rammeverk (The Mom Test):**
- Snakk om DERES hverdag, ikke vår idé
- Spør om fortid og spesifikke hendelser, aldri hypotetisk fremtid
- Lytt etter workarounds (manuelt arbeid, Excel, Google Maps-screenshots) — det er ekte smerte
- Komplimenter og "kult konsept!" er verdiløse — forpliktelser (tid, penger, intro til kollega) er ekte signal
- Filtrer bort "fluff": generelle påstander, hypotetiske kanskje, fremtidsløfter

**Nøkkelspørsmål for boligaktører:**
1. Hvordan jobber dere med nærområdeinformasjon i salgsprosessen i dag?
2. Kan du ta meg gjennom sist dere presenterte et prosjekt — hva viste dere?
3. Hva er mest tidkrevende i den prosessen?
4. Har dere prøvd noe for å løse dette? Hva fungerte/ikke?
5. Hvem bestemmer innkjøp av denne typen verktøy?
6. Har dere noen gang tapt et salg der nærområdet var en faktor?

### Parkert / Åpne spørsmål
- **Skal vi søke Oppstartstilskudd 1?** Krever AS, < 3 år, vesentlig nytt. Sjekk om Placy kvalifiserer.
- **Kundeintervju-mal:** Lag en konkret intervjuguide basert på rammeverket over, tilpasset ulike segmenter (utbygger, megler, eiendomsforvaltning)
- **Dokumenteringsmal for møter:** Hvem, rolle, nøkkelfunn, forpliktelse — for IN-rapportering
- **Pilotavtale-mal:** Hva innebærer en pilot? Gratis demo → feedback → LOI?

### Retning
- Markedsavklaring handler om å dokumentere at smerten er reell og betalingsviljen finnes — ikke om å bygge mer produkt
- Demoene vi allerede lager (Brøset, Overvik) er perfekte verktøy for kundemøter — vis, ikke fortell
- Neste steg: lage intervjuguide, booke møter, dokumentere systematisk

---

## 2026-03-03 — Spørsmålskort + Bransjeprofil

### Beslutninger
- **Bransjeprofil-systemet** implementert og merget (PR #53): Tag-drevet tema-resolving, BOLIG_THEMES (7 temaer), NAERING_THEMES (5), `getBransjeprofil()`, alias-mapping
- **Report hero redesignet** (PR #54): Fjernet metrics-bar, scorecard, store tema-kort. Erstattet med emosjonell intro + kompakte spørsmålschips (ThemeChip scroll-variant)
- **ThemeChip** som delt komponent: scroll-variant (Report) og select-variant (WelcomeScreen). Duck-typed interface fungerer med både ThemeDefinition og ReportTheme
- **i18n for tema-spørsmål**: Statiske strenger i `lib/i18n/strings.ts`, ikke database. 7 bolig-spørsmål + 5 næring-spørsmål, tospråklig (NO/EN)
- **White-label grunnlag**: ProjectTheme type, migration 045 (theme JSONB med CHECK constraint), CSS-var injection i server component
- **FloatingNav**: Pills viser nå spørsmål ("Er det bra for barna") i stedet for temanavn ("Barn & Oppvekst")

### Teknisk
- Dynamiske farger bruker inline `style` (ikke Tailwind arbitrary values — de krever statisk analyse)
- Hero intro beregnes i datalaget (`transformToReportData()`), ikke i komponenten
- WelcomeScreen har ingen LocaleProvider — bruker alltid "no"
- `prefers-reduced-motion` respektert i scroll og animasjoner

### Parkert / Åpne spørsmål
- **Spørsmålskort-CTA**: Brukeren spør om CTAer koblet til hvert kort — dagens implementering har scroll-to-section, men kanskje mer eksplisitt CTA-tekst trengs?
- **Story.introText vs heroIntro**: Gammel redaksjonell intro ("Nærhet til marka, gode skoler...") er mer innholdsrik enn bransjeprofil-template ("Lurer du på..."). Bør story.introText prioriteres som hoved-intro med template som fallback?
- **Lokal dev-server 404**: Alle `/for/`-ruter gir 404 lokalt men fungerer i produksjon — pre-eksisterende problem, trenger debugging

### Retning
- Spørsmålskort-konseptet er kjernen i bolig-produktet: emosjonelle spørsmål > statistikk
- Neste naturlige steg: Visuell polish av kortene, bedre intro-tekster, og koble til Analytics-segmentering
- White-label er klart for admin-UI — trenger bare et skjema for å sette theme per prosjekt

### Compound
- `docs/solutions/ui-patterns/spoersmaalskort-report-hero-redesign-20260303.md`

---

## 2026-03-03 (sesjon 2) — Unified POI Card Grid + FloatingNav Fix

### Beslutninger
- **Fjernet kompakte POI-rader** i Report. Alle POI-er bruker nå store kort (ReportPOICard) i responsive grid: 3 kolonner desktop, 2 kolonner mobil
- **6 kort initialt** per seksjon/sub-section, "Hent flere (N)" for resten. Balanserer informasjon vs scrolllengde
- **Slettet editorial/functional-distinksjonen** (CATEGORY_DISPLAY_MODE, ThemeDisplayMode). Alle temaer bruker samme kort — sorteringen (tier → score) gjør jobben
- **Subtil markering** beholdt: Tier-badge på Tier 1/Local Gem, men ingen annen visuell forskjell mellom kort
- **FloatingNav-bug fikset**: PageTransition sin `transform: translateY(0)` brøt `position: fixed` via CSS containing block. Løst med `transitionend` cleanup

### Teknisk
- Datamodellen forenklet: `highlightPOIs` + `listPOIs` → `pois` (sortert, første 6 synlige)
- `pickHighlights()`, `CompactPOIList`, `ReportPOIRow` slettet — 264 linjer fjernet, 93 lagt til
- Mobil bruker separat rendering (ReportInteractiveMapSection → ReportHighlightCard), oppdatert til 2-kol grid
- `INITIAL_VISIBLE_COUNT` endret fra 12 → 6 (store kort tar ~3x mer plass)

### Parkert / Åpne spørsmål
- **Spørsmålskort-CTA**: Fortsatt åpent — trenger kanskje mer eksplisitt CTA-tekst
- **Story.introText vs heroIntro**: Fortsatt åpent — redaksjonell intro er rikere enn template
- **Lokal dev-server 404**: Fortsatt åpent — `/for/`-ruter gir 404 lokalt
- **Mobil kortformat**: `ReportHighlightCard` (mobil) og `ReportPOICard` (desktop) er to ulike kort-komponenter. Bør de slås sammen?

### Retning
- Report-produktet er nå visuelt konsistent: store kort hele veien ned
- Neste steg for Report: kort-polish (hover-effekter, bedre fallback-ikoner for POIs uten foto), intro-tekster
- Produktet er salgbart for demo: hero med emosjonelle spørsmål + store kort + kart

### Observasjoner
- **CSS containing block-gotchaen** med `transform` og `position: fixed` er et klassisk problem. Verdt å huske for fremtidige animasjoner: alltid rydd opp `transform` etter transisjon hvis fixed-posisjonerte barn finnes
- **Kodeforenkling betaler seg**: Ved å fjerne editorial/functional-distinksjonen ble koden mye enklere. Distinksjonen var basert på en antakelse om at noen temaer "fortjener" foto-kort mens andre ikke gjør det — men i praksis ser alle kategorier bra ut med samme kort

### Compound
- `docs/solutions/ui-patterns/report-unified-poi-card-grid-20260303.md`

---

## 2026-03-05

### Beslutninger
- **Første outreach til Trondheim kommune** — e-post sendt til byarkitekt Nadja Sahbegovic (CC: byarkitekten@trondheim.kommune.no, Trond Åm)
- Vinkling: "bi-produkt av Open House-artikkelen" — ikke salgspitch, men genuint resultat av å teste plattformen med kommunens data
- Tre demoer vedlagt: Prisbelønnet arkitektur i Trondheim, Fredede bygninger i Trondheim, Open House Oslo 2025
- Emne: "Open House Trondheim — en idé etter Adressa-artikkelen"
- Bevisst valg å IKKE lansere placy.no først — demoene er beviset, og eiendomsnettsiden kan forvirre budskapet mot kommune

### Kontekst
- Artikkelen "Vil åpne private hjem i Trondheim" (Adressa, 2. feb 2026) — Sahbegovic og Åm planlegger Open House Trondheim
- Artikkelen "Planlegger enorme endringer" (Adressa, 5. mars 2026) — Tempe-Sorgenfri områdeplan, Åm er sentral
- Kommunens kart over prisbelønnet arkitektur (Trondheimskartet) ble brukt som datakilde — Placy viser samme data på en mer brukervennlig måte
- Sahbegovic: nadja.sahbegovic@trondheim.kommune.no / tlf 94 43 84 13

### Retning
- Kommune/offentlig sektor er nytt potensielt kundesegment — kulturarv, arkitektur, byutvikling
- Plattformen viser seg å håndtere mer enn eiendom/turisme — stedsdata generelt
- Mobilopplevelsen er ikke klar enda — ærlig om dette i e-posten ("optimalisert for desktop")

### Åpne spørsmål
- Får vi svar fra Sahbegovic/Åm? Oppfølging om 1-2 uker om ikke
- Bør vi lage en dedikert "kommune/offentlig sektor"-vinkling på placy.no?
- Kan Open House Trondheim bli en pilotcase?

### Observasjoner
- "Warm outreach via verdi" — gi noe nyttig først, spør om samtale etterpå — mye sterkere enn kald pitch
- Å la demoene snakke for seg selv er viktigere enn å forklare features
- Ærlig om begrensninger (mobil) bygger troverdighet

---

## 2026-03-05 (del 2) — Trondheim Management / Kulturnatt

### Beslutninger
- **Kulturnatt Trondheim 2025 importert som demo** — 132 events via trdevents.no GraphQL API
- Import-script: `scripts/import-kulturnatt.ts` — henter direkte fra trdevents.no, kategoriserer, pusher til Supabase
- 10 kategorier: Utstilling & Galleri (28), Musikk & Konsert (26), Teater & Show (22), Museum (19), Verksted & Kurs (11), Familie (9), Annet (7), Foredrag & Samtale (5), Mat & Drikke (3), Film & Teknologi (2)
- Explorer live: `/for/kulturnatt-trondheim/kulturnatt-2025/explore`
- Økt fallback `explorerTotalCap` fra 100 → 300 i `lib/themes/bransjeprofiler.ts` — prosjekter uten bransjeprofil ble kuttet til 100 POIs

### Prospekt: Trondheim Management AS

**Organisasjonen eier fire brands/events som alle trenger kartbaserte nettsider:**

| Brand | Type | Placy-match | Status |
|-------|------|-------------|--------|
| **Kulturnatt Trondheim** | Endagsfestival, 132+ events | Explorer med favoritter | Demo klar |
| **Martnan** (julemarked) | Årlig event, steder på kart | Explorer | Neste demo? |
| **Visit Trondheim** | Destinasjonsselskap, turisme | Explorer/Guide/Report | **Storkunde-potensial** |
| **Midtbyen** | Bysentrum, butikker, restauranter | Explorer | Naturlig utvidelse |

**Kontaktinfo:**
- Prosjektleder Kulturnatt: nanna@midtbyen.no / 934 30 011
- Produsent: isabel@midtbyen.no / 411 96 020
- Produsent: stig@midtbyen.no

**Nøkkelargumenter:**
- Deres nåværende løsning: WordPress + trdevents-widget + Google Maps embed. Dårlig UX, spesielt mobil
- Deres "Mine favoritter"-system er en tom side med hjerte-ikon. Vår "Min samling" er live kart med lagrede steder, delbar via lenke
- Placy erstatter hele stacken: program, kart, favoritter — i én sammenhengende opplevelse
- Samme import-pipeline kan kjøres for Kulturnatt 2026, Martnan, og andre events — skalerbart

**Strategi:**
- Kulturnatt er inngangsdøren — konkret demo med deres egne data
- Visit Trondheim er den store premien — turisme er allerede Placys kjertevertical
- Trondheim Management som organisasjon kan kjøpe **flere prosjekter**, ikke bare ett

### Retning
- To parallelle salgsspor nå: (1) Trondheim kommune/byarkitekten, (2) Trondheim Management
- Begge bruker "warm outreach via verdi" — demo først, samtale etterpå
- Kulturnatt-demo må deployes til placy.no før outreach
- Samme playbook som byarkitekten: e-post med lenker, ingen pitch

### Åpne spørsmål
- Hvem er riktig kontaktperson hos Trondheim Management for pitch? Nanna (prosjektleder Kulturnatt) eller noen på Visit Trondheim-nivå?
- Bør vi scrape Martnan-data også for å vise bredden?
- Kulturnatt 2026 er 11. september — kan vi tilby å levere Explorer som pilot til årets festival?
- Visit Trondheim bruker visittrondheim.no — hva slags tech-stack har de, og kan Placy erstatte deler av den?

### Observasjoner
- trdevents.no GraphQL API er åpent og veldokumentert — import tok under en time fra scraping til ferdig Explorer
- Plattformens fleksibilitet bekreftet igjen: eiendom → kulturarv → events, uten kodeendringer
- "Min samling" vs "Mine favoritter" er det sterkeste UX-argumentet — visuelt bevis på generasjonsgap

---

## 2026-03-06 — Selvbetjent megler-pipeline

### Beslutninger
- **Bygget full selvbetjeningsflyt for eiendomsmeglere:** `/generer` (bestillingsskjema) → `/kart/{slug}` (statusside → Explorer)
- **KartExplorer som fork av ExplorerPage** (~444 vs ~712 linjer) — fjernet collection/admin/GeoWidget, erstattet med localStorage-bokmerker. Fork > abstraksjon når state-håndtering er fundamentalt ulik.
- **NFC (ikke NFD) for norsk adresse-normalisering** — NFD + strip diacritics fjerner æ/ø/å, gjør norske adresser ugjenkjennelige
- **ON DELETE SET NULL** som standard for audit-trail-tabeller — bevarer forespørsler selv om prosjektet slettes
- **Eksplisitt service role key-sjekk** i API-rute — bedre enn å stole på at `createServerClient` velger riktig nøkkel stille
- **Tre boligprofiler:** family (7 temaer, standard), young (5 temaer, uteliv-fokus), senior (4 temaer, helse-fokus)
- **Pipeline som Claude Code slash-command** (`.claude/commands/generate-adresse.md`) — 12-stegs pipeline med atomic polling, fail-soft error handling
- PR #57 opprettet: 17 filer, ~1600 linjer

### Parkert / Apne sporsmaal
- **RLS "Public read by slug" eksponerer e-post (PII)** — bør strammes inn til kun ikke-sensitive kolonner, men alle reads går via server components med service role, så lav risiko nå
- **Ingen rate limiting** på generation endpoint — akseptabelt for prototype, men bør legges til før bred lansering
- **Mapbox token i HTML** — bør låses med referrer-restrictions i Mapbox-dashboard
- Pipeline slash-command er skrevet men ikke testet end-to-end — trenger reell kjøring for å verifisere alle 12 steg
- Hvem er riktig kontaktperson hos Trondheim Management? (fra forrige sesjon, fortsatt åpent)

### Retning
- **Selvbetjening er nå mulig** — meglere kan bestille nabolagskart uten at vi gjør noe manuelt
- Pipeline-steget (generere selve kartet) er neste implementering — slash-command er klar, trenger kjøring
- To parallelle spor: (1) megler-selvbetjening med EM1/Kristian som pilot, (2) Trondheim Management/Kulturnatt
- Plattformen utvider seg fra "vi lager demoer" til "brukerne lager selv" — viktig skift

### Observasjoner
- **Fork-strategi fungerte rent.** KartExplorer ble ~60% av ExplorerPage med tydelig separasjon. Risikoen er drift over tid — endringer i Explorer må vurderes for Kart også.
- **Zod + server component + service role er et sterkt mønster** for offentlige API-ruter med database-skriving. Gjenbrukbart for fremtidige selvbetjenings-endepunkter.
- **AddressAutocomplete ble genuint gjenbrukbar** — 300ms debounce, abort controller, keyboard nav. Kan erstatte ReportAddressInput der den brukes.
- Sikkerhetsherdingen (migration 047, retry-guard, crypto.randomUUID) tok 15 min men fanget reelle svakheter. Risikobasert agent-review betaler seg.

---

## 2026-03-11 — Placy Kompass: Personal Event Recommendations

### Beslutninger
- **Bygget Kompass-prototypen** — personaliserte anbefalinger for festival-events via 3-stegs onboarding (tema/dag/tid)
- **Separat Zustand store** (`lib/kompass-store.ts`) — ikke i hovedstore. Ephemeral per besøk, ingen localStorage. Ren isolasjon.
- **Feature flag via bransjeprofil** — `kompass: true` på Event-profilen. Andre bransjeprofiler påvirkes ikke.
- **Map dimming, ikke hiding** — ikke-anbefalte markører får `opacity: 0.35` i stedet for å forsvinne. Brukere beholder romlig oversikt.
- **Tab-basert visning** — "Kompass" (timeline) vs "Alle events" (standard liste). Synkronisert med dagfilter.
- **Olavsfest som pilotdata** — 210 events importert fra olavsfest.no med 6 kategorier

### Levert
- 5 nye komponenter: KompassOnboarding, KompassTabs, KompassTimeline, kompass-store, useKompassFilter
- 5 modifiserte filer: ExplorerPage, ExplorerPanel, ExplorerPOIList, ExplorerMap, adaptive-marker
- Bransjeprofil-feature flag + plan med 21 test cases
- Branch: `feat/kompass-event-prototype`

### Parkert / Apne sporsmaal
- **Onboarding-design:** Nåværende bottom sheet er funksjonell men ikke visuelt polert. Bør testes med brukere.
- **Anbefaling uten AI:** Nåværende filtrering er regelbasert (match theme + day + time). Mer sofistikert scoring (popularitet, avstand, variasjon) er naturlig neste steg.
- **Persistering av preferanser:** Bevisst valg å IKKE persistere nå. Men for repeat-brukere kan det gi bedre UX.
- **Venue-cluster interaksjon:** Kompass-timeline viser enkelthendelser, men mange deler venue. Bør timeline gruppere per venue?
- Hvem er riktig kontaktperson hos Trondheim Management? (fortsatt åpent)

### Retning
- Kompass er et nytt produktkonsept — "personal concierge" for events. Olavsfest er piloten.
- Demonstrerer at Placy kan levere verdi utover kartvisning — fra "se alt" til "se det som passer deg"
- Neste steg: deploy, demo for Olavsfestdagene som potensiell samarbeidspartner
- Event-plattformen har nå 4 importpipelines (Kulturnatt, Arendalsuka, Oslo Open, Olavsfest) + Kompass

### Observasjoner
- **Beads + /full-workflow fungerer end-to-end.** Første reelle test med beads som task tracker. 9 beads i 4 bølger, alle lukket. Plan → test cases → beads → sub-agent execution → verify. Raskere enn TodoWrite for komplekse features.
- **Zustand er riktig for ephemeral UI state.** Kompass-store har ingen server-interaksjon, ingen caching-behov, ingen persistence. Zustand + useShallow er minimalt og performant.
- **Feature flags i bransjeprofil er elegant.** Ingen compile-time flags, ingen environment vars — bare data. Nye features kan aktiveres per bransje uten kodeendringer.
- **Event-plattformen er i ferd med å bli et selvstendig produkt.** Fra eiendoms-explorer til events-plattform med import, filtrering, anbefalinger — uten store kodeendringer. Plattformens fleksibilitet er reell.

---

## 2026-03-06 (sesjon 2) — Strategisk sparring: Placy som megler-leverandør

### Kontekst
Sparring-sesjon om forretningsmodell, prising og produktstrategi for selvbetjent megler-pipeline. Ikke kode — ren strategi.

### Analyse: Prisresearch

Deep research på proptech-prising, norske megler-markedsføringskostnader og per-transaksjon SaaS-modeller. Nøkkelfunn:

**Megler-markedsføring per bolig:**
- Total markedspakke: 16 000–48 000 kr (uten/med styling)
- Foto: 4 000–7 000 kr, FINN-annonse: 1 489–9 960 kr
- Selger betaler totalt 70 000–150 000 kr for hele boligsalget

**Sammenlignbare verktøy:**
- NeighborhoodScout: ~300 NOK/rapport, HouseCanary: 250–900 NOK/rapport
- FINN Nabolagsprofil: bundlet i Medium/Stor pakke (ikke separat)
- Matterport 3D: 3 000–8 000 NOK/scan

**Markedsgap:** Det finnes ingen standalone interaktivt nabolagskart-produkt for norske meglere. FINNs Nabolagsprofil er statisk data i annonsepakken. Placy er en ny kategori.

### Beslutninger

1. **Én generering, to moduser.** Explorer og Report er ikke to produkter — de er to views på samme datagrunnlag. Én pipeline kjører, megleren får begge. Ingen grunn til å splitte.

2. **Prispunkt: 999 kr per bolig.** Inkluderer Explorer + Report. Under 5% av markedspakken, billigere enn ett sett boligfoto. "Easy yes" for megleren. Marginen er ~100%.

3. **Beliggenhetstekst-generator som nytt produkt/funksjon.** Megler gir adresse + målgruppe, får ferdig tekst å lime inn i FINN/prospekt. Null friksjon, løser et konkret daglig problem.

### Volumestimat: Megler1 Trøndelag

| Scenario | Meglere | Maps/mnd | MRR | ARR |
|----------|---------|----------|-----|-----|
| Pilot | 5–10 | 15 | 15 000 kr | 180 000 kr |
| Traction | 20–30 | 50 | 50 000 kr | 600 000 kr |
| Full utrulling | 40–60 | 100 | 100 000 kr | 1 200 000 kr |

### Skaleringsestimat @ 999 kr

| Scope | Penetrasjon | Volum/år | ARR |
|-------|-------------|----------|-----|
| Trondheim | 50% | 2 250 | 2.25 MNOK |
| Trøndelag | 50% | 4 000 | 4.0 MNOK |
| Norges 5 største byer | 30% | 20 000 | 20 MNOK |
| Hele Norge | 20% | 15 000 | 15 MNOK |

### Ny idé: Beliggenhetstekst-generator

**Observasjon fra Kristians FINN-annonser:** 4 annonser gjennomgått (Angelltrøa, Strindheim, Ranheim, Charlottenlund). Alle har 1–2 generiske setninger om beliggenhet. Copy-paste-aktig, ingen spesifikke POI-er, ingen avstander, ingen tilpasning til målgruppe.

**Produktidé:** Megler skriver inn adresse + velger målgruppe (Familie/Ung/Senior) → får ferdig beliggenhetstekst med konkrete stedsnavn og avstander → limer inn i FINN/salgsoppgave.

**Strategisk rolle:** Gratis funnel til 999 kr-pakken. Null friksjon, beviser datakvaliteten, sprer seg viralt mellom meglere. Tre produkter, én pipeline:

| Produkt | Output | Friksjon | Pris |
|---------|--------|----------|------|
| Beliggenhetstekst | Tekst å lime inn | Null | Gratis (lead-gen) |
| Explorer | Interaktivt kart | Link | Del av 999-pakke |
| Report | Redaksjonell artikkel | Link i prospekt | Del av 999-pakke |

### Retning
- **Placy beveger seg fra "vi lager demoer" til "leverandør til meglerbransjen"** — dette er det viktigste strategiske skiftet hittil
- Tre produktnivåer (tekst → Explorer → Report) fra samme datagrunnlag gir en naturlig trakt
- Beliggenhetstekst-generatoren bør bygges som neste feature — lav innsats, høy spredningseffekt
- Megler1 Trøndelag via Kristian er piloten, men produktet er bransje-agnostisk

### Parkert / Åpne spørsmål
- Beliggenhetstekst: bygges som del av /generer-siden eller som eget verktøy?
- Prismodell for volum: klippekort (10-pakk, 25-pakk) eller kontorabo?
- Go-to-market: demo for Kristian med hans egne adresser som proof of concept?
- Skal tekst-generatoren kreve epost eller være helt anonym?
- Enterprise/API-prising for kjeder som vil embedde det?

### Observasjoner
- **FINNs prisøkning (706% i 2025) har gjort bransjen prissensitiv** — men også vant til å betale for digitale verktøy. Placy @ 999 kr er en brøkdel av FINN-kostnaden.
- **67% av meglere sier de får all tech fra kontoret** (NAR) — salget bør rettes mot meglerkontoret/kjedeledelsen, ikke individuell megler
- **Kristians annonser beviser problemet konkret** — 1-2 generiske setninger vs. hva Placy kan levere. Forskjellen er dramatisk og lett å demonstrere.
- **Sem & Johnsen som kvalitetsbenchmark.** Deres beliggenhetstekster har fast struktur: 3-4 avsnitt (intro → bomiljø → nærområde → hook). Selv de navngir ikke spesifikke steder/avstander — det er gapet Placy fyller.
- **Tone-of-voice-tilpasning per meglerkontor.** Onboarding: kontoret gir 10-20 beste tekster → LLM lærer stilen → genererte tekster matcher kontorets stemme. Gjør Placy til leverandør, ikke bare verktøy. Trainees kan aldri skrive dårligere enn kontorets snitt.

### Utvidet produktvisjon: Før, på og etter visning

Nøkkelinnsikt: **Visningen er eneste ansikt-til-ansikt med kjøperen.** Megleren som svarer konkret bygger troverdighet. QR-kode til Explorer på visning = kjøper utforsker nabolaget i sofaen etterpå = boligen holder seg top-of-mind til budgivning.

**Fire verktøy fra én pipeline, dekker hele salgsprosessen:**

| Fase | Verktøy | Hva det løser |
|------|---------|---------------|
| FØR | Beliggenhetstekst-generator | FINN-annonse, prospekt (gratis lead-gen) |
| FØR | Report | Redaksjonell nabolagsartikkel i salgsoppgaven |
| PÅ | Visningsassistent (mobil) | Kompakt liste-view — megler svarer på 3 sek |
| ETTER | Explorer + QR-kode | Kjøper utforsker nabolaget hjemme, deler med partner |

**Visningsassistenten:** Mobiloptimert side (ikke PDF, ikke app). Skole (navn, avstand, gåtid), barnehage, dagligvare, kollektiv (inkl. reisetid til sentrum), trening, mat & drikke. Tredje view på samme data — Explorer (kart), Report (artikkel), Visningsassistent (liste).

**Revidert pakke:** 999 kr per bolig — beliggenhetstekst + visningsassistent + Explorer + Report.

**Produkttrakt:**
```
GRATIS — Beliggenhetstekst-generator, Placy Score (fase 2)
999 KR — Beliggenhetstekst (med ToV) + Visningsassistent + Explorer + Report
ENTERPRISE — Tone-of-voice per kontor, Vitec/FINN-integrasjon, Placy Score i FINN
```

**Parkerte idéer:** Nabolagssammenligning (2-3 adresser side-by-side), sesongvariant-tekst, tilflytterguide, automatisk FINN-levering via Vitec API.

---

## 2026-03-06 (sesjon 3) — Konkurrentanalyse: Beligenhetsbeskrivelser i praksis

### Kontekst
Deep research på 15 aktive boligannonser fra de største meglerkjedene i Trondheim. Formål: dokumentere eksakt hva meglere skriver om beliggenhet i dag, og hvor stort gapet til Placy er.

### Markedsandeler Trondheim (estimert)

| Kjede | Andel | Merknad |
|-------|-------|---------|
| EiendomsMegler 1 Midt-Norge | ~35-40% | Markedsleder, SpareBank 1-eid |
| Heimdal Eiendomsmegling | ~13-15% | Sterk på nybygg (~49% nybolig) |
| DNB Eiendom | ~10-12% | Nr. 3, 3 kontorer |
| Proaktiv | ~8-10% | Vokser, 17+ meglere sentrum |
| Nylander & Partners | ~10% | Midt-norsk, sterk i Stjørdal |
| Privatmegleren | ~5-8% | 25 meglere |
| Nordvik / Krogsveen / EIE / Aktiv | 3-5% hver | Mindre aktører |

### Funn: 15 annonser analysert

**14 av 15 annonser bruker identisk mønster:**
- "Kort vei til" / "gangavstand til" / "i nærheten av" — uten faktisk avstand
- Oppramsing: "barnehage, skole, butikk, buss" — samme sjekkliste, copy-paste mellom annonser
- Generiske adjektiver: "populær", "attraktiv", "sentral", "barnevennlig"

**Kun 1 av 15** (Berg/Moholt nybygg) oppgir faktiske gangminutter.

**Ingen av 15 har:**
- Interaktivt kart over nærområdet
- Verifiserte avstander (beregnet, ikke gjettet)
- Bilder av steder i nærområdet
- Kategorisert oversikt over fasiliteter
- Ratings/anmeldelser av stedene
- Skolekretsinformasjon

### Eksempler per kjede

**EM1** — best case (Øvre Allé 4, 22.5 MNOK): *"Bakklandet med populære turstier langs Nidelven, hyggelige kafeer og restauranter. Midtbyen bare en kort spasertur unna. Kun 500 m til NTNU Gløshaugen."* — Noe spesifikt, men fortsatt prosa uten struktur.

**EM1** — worst case (Bakkehellet 7): Ingen beligenhetsbeskrivelse i det hele tatt. Bare "Nærhet til NTNU og St. Olavs."

**DNB** — typisk (Elgeseter gate 26A): *"Her bor du med umiddelbar nærhet til alt du trenger, enten du studerer på NTNU Gløshaugen eller jobber på St. Olavs."* — Én setning. Ferdig.

**Heimdal** — typisk (Saupstadringen 39A): *"Gangavstand til bl.a. skoler, butikk, lege, tannlege, plass til ballspill og Husebybadet"* — Oppramsing uten avstand.

**Proaktiv** — typisk (Gammel-lina 72): *"Kort avstand til barnehage, skoler, fotballbane, nærbutikk og bussholdeplass."* — Identisk struktur som alle andre.

**Aktiv** — typisk (Tampereveien 2A): *"Attraktivt, med nærhet til Bymarka, dagligvarebutikk, offentlig kommunikasjon samt skole og barnehage."* — Generisk.

### Implikasjon for Placy

Gapet er **dramatisk og konsistent på tvers av alle kjeder**. Selv den dyreste boligen i datasettet (Øvre Allé 4, 22.5 MNOK via EM1) har en beligenhetsbeskrivelse som Placy automatisk overgår med verifiserte data, interaktivt kart og kategorisert oversikt.

Dette er ikke et problem med dårlige meglere — det er et **strukturelt problem med verktøyene**. Meglere har ikke et verktøy som gjør det enkelt å produsere gode beligenhetsbeskrivelser. De skriver fritekst under tidspress, og resultatet blir generisk.

### Beslutninger
- **Nearby guarantee implementert** i `applyExplorerCaps`: de 5 nærmeste POI-ene per tema (innenfor 8 min gange) garanteres plass. Løser problemet med at nærområdet ble "nakent" når score-basert utvelgelse favoriserte fjernere, høyere ratede steder.
- Endringen er isolert til `/kart/`-ruten (selvbetjent Explorer). Vanlig Explorer er upåvirket.

### Retning
- **Denne analysen er salgsmateriell.** "14 av 15 annonser har generisk beliggenhet" er en konkret pitch til meglerkontoret.
- **Øvre Allé 4 er perfekt demo-case:** EM1 selger den akkurat nå for 22.5 MNOK med en generisk beligenhetsbeskrivelse. Vi har allerede generert Placy-kartet for samme adresse. Side-by-side sammenligning er overbevisende.
- Beliggenhetstekst-generatoren (fra sesjon 2) styrkes av denne innsikten — den løser et problem som er dokumentert kvantitativt.

---

## 2026-03-06 (sesjon 4) — Konkurranseanalyse: FINN, Hjem.no og Nabolag.no

### Kontekst
Gjennomgang av konkurrerende nabolags-produkter i norsk eiendom. Sett på FINNs Nabolagsprofil (gammel + ny), Sem & Johnsens integrasjon, Hjem.no "Explore the area", og nabolag.no (dataleverandør). Formål: forstå konkurransebildet og Placys posisjonering.

### Funn: Tre lag i Schibsteds nabolags-stack

**1. profil.nabolag.no (backend)**
- Levert av Finn.no AS (support@eiendomsprofil.no)
- Kilder: SSB demografi (via Geodata AS), Matrikkelen/Statens Kartverk, Entur + Google (reisetider), nabolag.no crowdsourcing (ratings/sitater, min 10 besvarelser), Geodata AS (solforhold), Jacilla/skisporet.no
- Ren data-aggregering fra offentlige registre + crowdsourcing

**2. FINN Nabolagsprofil (i annonsen)**
- Gammel versjon (Sem & Johnsen-integrert): Crowdsourced scores, demografi-grafer, anonyme fargede prikker på kart. Statistikk ingen bruker til beslutninger.
- Ny versjon (direkte i FINN-annonsen): Interaktivt kart med kategori-chips (Transport, Handel, Skoler, Barnehager, Sport). Navngitte POI-er med gangavstand. "Coop Extra Charlottenlund — Gå i 4 min, 321m". Vesentlig forbedring.

**3. Hjem.no "Explore the area" (sterkeste konkurrent)**
- 7 kategorier: Transport, Education, Shopping, Food, Sport, Charging, People
- Isochron-kart (fargede 5/10/20/30 min soner) — visuelt sterkt
- Walk / Bike / Drive toggle (= Placys travel mode)
- Navngitte POI-er med avstand og gåtid
- Transport-detaljer med alle busslinjer per holdeplass
- **Dette er den reelle Explorer-konkurrenten**

### Hva konkurrentene IKKE har (Placys moat)

| Feature | FINN | Hjem.no | Placy |
|---------|------|---------|-------|
| Interaktivt kart med POI-er | Ja (ny) | Ja | Ja |
| Isochron (tidssoner) | Nei | Ja | Nei (bør vurderes) |
| Travel mode (walk/bike/drive) | Nei | Ja | Ja |
| Google Places-data (ratings, bilder, åpningstider) | Nei | Nei | Ja |
| Redaksjonell kuratering (tiers, featured) | Nei | Nei | Ja |
| Report (nabolagsartikkel) | Nei | Nei | Ja |
| Beliggenhetstekst-generator | Nei | Nei | Ja |
| Visningsassistent (mobil) | Nei | Nei | Ja |
| Tone-of-voice per meglerkontor | Nei | Nei | Ja |
| Uavhengig av plattform | Nei (FINN-låst) | Nei (Schibsted) | Ja |
| Bygget for megleren (ikke kjøperen) | Nei | Nei | Ja |

### Strategisk konklusjon

**Explorer alene er sårbar.** Hjem.no har allerede en sterk Explorer-konkurrent med isochron-kart. FINN forbedrer sin versjon raskt. Begge er gratis for kjøperen (bundlet i FINN-pakken).

**Pakken er moaten.** Beliggenhetstekst + Visningsassistent + Report + Explorer = noe verken FINN eller Hjem.no bygger. De bygger for kjøperen. Placy bygger for megleren.

**Placy og FINN/Hjem er komplementære, ikke konkurrerende:**
- FINN/Hjem svarer: "Hvem bor her?" (demografi, crowdsourcing, statistikk)
- Placy svarer: "Hva finnes her?" (konkrete steder, redaksjonell kontekst, megler-verktøy)
- Placy-link i FINN-annonsen = megleren bruker begge

**FINN kommer aldri til å:**
- Generere prosa/beliggenhetstekster for meglere
- Bygge megler-verktøy for visninger
- Tilpasse tone-of-voice per meglerkontor
- La meglere bruke det utenfor FINN-plattformen

Det er Placys rom.

### Parkert / Åpne spørsmål
- Bør Placy bygge isochron-kart (tidssoner)? Hjem.no har det og det er visuelt sterkt
- Kan Placy integreres med Vitec (meglerverktøy) slik at nabolagsdata flyter rett inn?
- Hjem.no har "Charging" som kategori — bør Placy legge til ladestasjon i boligprofilen?

### Observasjoner
- **Schibsted investerer tungt i nabolagsdata.** Tre separate produkter (FINN nabolagsprofil, FINN nærområdet-kart, Hjem.no explore) viser at dette er en prioritert satsning. Markedet er validert.
- **Baren FINN setter er middels.** Ny versjon er bedre, men fortsatt bare datapunkter på et kart. Ingen redaksjon, ingen fortelling, ingen megler-verktøy. Placy trenger ikke være 10x bedre på kart — den trenger å være 10x bedre som megler-leverandør.
- **Sem & Johnsen har embeddet den GAMLE nabolagsprofilen.** De har ikke oppgradert til den nye kart-widgeten ennå. Det betyr at meglerintegrasjoner henger etter FINNs egen utvikling — et vindu for Placy.

---

## 2026-03-07 — Strategisk beslutning: Eiendom som vertikal + URL-arkitektur

### Kontekst
Placy har vokst organisk i mange retninger — turisme (Guide/Trips), eiendom (bolig + næring + selvbetjent megler), hotell-demoer, kultur (Kulturnatt), SEO-sider, admin. For en vibe-coded codebase med én utvikler er det for spredt. Etter to sesjoner med prisresearch, konkurranseanalyse og produktstrategi er det tydelig at eiendom er vertikalen med klarest vei til inntekt.

### Beslutninger

**1. Placy er nå et eiendomsprodukt.**
Guide/turisme, hotell-demoer og kultur legges i fryseren. All energi går til megler-vertikalen. Begrunnelse:
- Betalingsvilje dokumentert (meglere betaler 16-48k per bolig i markedsføring)
- Problemet er konkret (14/15 annonser har generisk beliggenhet)
- Pipeline eksisterer (generate-bolig, generate-adresse)
- Konkurrenter validerer markedet (FINN/Hjem.no investerer tungt)
- Pilot finnes (Kristian/EM1)
- Produktpakke klar (tekst + visning + Explorer + Report @ 999 kr)

**2. URL-struktur: `/eiendom/{kunde}/{slug}`**

Alltid med kunde — ingen unntak. Selvbetjente meglere tilhører meglerkontoret sitt, prosjekter tilhører utbyggeren.

```
placy.no/eiendom/
├── /generer                                    — Selvbetjent inngang for meglere
├── /tekst                                      — Gratis beliggenhetstekst-generator (lead-gen)
│
│   Selvbetjent megler (enkeltboliger):
├── /eiendom/em1-trondelag/sildrapevegen-35c
├── /eiendom/em1-trondelag/fernanda-nissens-veg-16
├── /eiendom/privatmegleren/eksempel-adresse
│
│   Boligprosjekter:
├── /eiendom/klp/ferjemannsveien-10
├── /eiendom/overvik/b2-tiller
│
│   Næringseiendom:
├── /eiendom/klp/dyre-halses-gate-1
│
│   Moduser (undermapper):
│   /eiendom/{kunde}/{slug}             — Explorer (default)
│   /eiendom/{kunde}/{slug}/rapport     — Report
│   /eiendom/{kunde}/{slug}/visning     — Visningsassistent
```

**3. Alltid kunde-slug, aldri "Selvbetjent"-bøtte.**
Når megler bestiller via /generer knyttes prosjektet til meglerkontoret (EM1 Trøndelag, Privatmegleren, etc.), ikke en generisk "Selvbetjent"-kunde. Gir:
- Megler-dashboard per kunde (`/eiendom/em1-trondelag/` = oversikt)
- Tone-of-voice-tilpasning per meglerkontor
- Branding-mulighet (logo, farger) per kunde
- Enkel fakturering (tell genereringer per kunde)

### Migrasjon fra nåværende struktur

| Nåværende | Ny | Status |
|-----------|-----|--------|
| `/for/{kunde}/{prosjekt}` | `/eiendom/{kunde}/{slug}` | Migreres |
| `/kart/{slug}` | `/eiendom/{kunde}/{slug}` | Migreres (krever kunde-tilknytning) |
| `/generer` | `/eiendom/generer` | Flyttes |
| `/trips/...` | Fryses | Ikke prioritert |
| `/admin/...` | Beholdes | Uendret |

Gamle URL-er bør redirecte (301) til nye for å bevare eventuelle lenker.

### Implikasjon for Supabase

Ingen ny datamodell — `projects.customer_id` peker allerede på riktig kunde. Endringen er:
- "Selvbetjent"-kunden i `generation_requests` erstattes med faktisk meglerkjede
- `/generer`-skjemaet trenger et felt for "Hvilket meglerkontor?" (autocomplete eller dropdown)
- Nye kunder opprettes i `customers`-tabellen ved onboarding av nytt meglerkontor

### Retning
- **Neste implementeringsoppgave:** Flytte eiendomsprosjekter til `/eiendom/`-ruter med riktig kunde-slug
- **Beliggenhetstekst-generator** (`/eiendom/tekst`) som første nye feature — lav innsats, høy spredning, gratis lead-gen
- **Demo for Kristian:** Generer Report + Explorer for én av hans fire annonser, vis side-by-side mot FINN-annonsen
- Guide/turisme/hotell er ikke slettet — bare deprioritert. Kan reaktiveres som `/turisme/`-vertikal senere

### Observasjoner
- **Vertikal-fokus er riktig for et vibe-coded prosjekt.** Én utvikler kan ikke betjene fire bransjer. Eiendom har sterkest signal — dokumentert problem, dokumentert betalingsvilje, dokumentert konkurransegap.
- **Kunde-slug fra dag 1 er viktig.** Å migrere fra flat `/kart/{slug}` til `/eiendom/{kunde}/{slug}` senere er smertefullt. Bedre å gjøre det riktig nå.
- **Hele dagens sparring (sesjon 2+3+4+denne) henger sammen:** Prisresearch → produktpakke → konkurranseanalyse → vertikal-beslutning → URL-arkitektur. Strategien er nå sammenhengende fra marked til kode.

### Krogsveen som kvalitetsbenchmark

**Krogsveen Steinanvegen 76H** — best-in-class beliggenhetstekst i norsk eiendom:
- Spesifikke skolekretser: Åsvang skole, Hoeggen ungdomsskole, Strinda VGS
- Datakilde oppgitt: **Prognosesenteret** som leverandør (= betaler for data-tjeneste)
- Konkrete avstander: "ca. sju km til sentrum", "ca. to km til E6", "ca. to km til NTNU Dragvoll"
- Navngitte steder: Estenstadmarka, Steinan Skitrekk, Othilienborg Diskgolfpark, butikkene på Moholt
- Kategorisert: friluftsliv, skolekrets, transport/handel — ikke generisk oppramsing

**Likevel manuelt og upresist:**
- "Ca. sju kilometer" — omtrentlig, ikke beregnet
- "Butikkene på Moholt" — ingen spesifikke butikknavn
- Ingen gangminutter — bare "ca. to kilometer"
- Ingen kart, ingen interaktivitet

**Implikasjon:** Krogsveen er unntaket (1 av 15 med god beliggenhetstekst) og setter baren. Placy beliggenhetstekst-generator ville produsert Krogsveen-kvalitet automatisk, med eksakte avstander og gangminutter, på 30 sekunder i stedet for 30 minutter. Krogsveen betaler allerede Prognosesenteret for skolekrets-data — de er en kjede som investerer i nabolags-informasjon og dermed en naturlig Placy-kunde.

---

## 2026-03-07 (sesjon 2) — Eiendom URL-arkitektur: Implementert

### Kontekst
Forrige sesjon (sesjon 1 i dag) planla URL-arkitekturen. Denne sesjonen implementerte alt — fra plan til produksjonsklar kode i 6 faser.

### Beslutninger
- **Route group `(tools)/`** for `/eiendom/generer` og `/eiendom/tekst` — forhindrer slug-kollisjon med `[customer]` uten middleware-hack. Samme mønster som `(public)/`
- **ProductNav `exact` property** for root-path Explorer-tab — fikser double-highlight bug der Explorer-path (`/eiendom/X/Y`) matcher alt via `.startsWith()`
- **Middleware: fjernet `/for/` passthrough** — erstattet med eksplisitt redirect-logikk som excluder frozen trips sub-paths
- **Thin server component for `/kart/` redirect** — `permanentRedirect()` med DB-lookup, bedre enn middleware DB-hit på alle requests
- **Customer upsert med reserved slug denied-list** — `["generer", "tekst", "admin", "api"]` valideres ved opprettelse
- **IP-basert rate limiting** på `/api/eiendom/tekst` — 5 req/time per IP, in-memory Map med TTL
- **`@anthropic-ai/sdk`** lagt til som ny dependency for runtime LLM-kall i tekst-generator
- **`maxDuration = 30`** på tekst API route — Anthropic API tar 5-15s

### Levert
1. **`lib/urls.ts`** — sentralisert `eiendomUrl()`, aldri hardkod paths
2. **`/eiendom/{kunde}/{slug}`** — Explorer (default), med generation status (pending/failed)
3. **`/eiendom/{kunde}/{slug}/rapport`** — Report med oppdaterte canonical URLs
4. **`/eiendom/{kunde}/{slug}/visning`** — NY: mobiloptimert POI-liste med QR-kode
5. **`/eiendom/generer`** — bestillingsskjema med meglerkontor-felt (upsert-creates customer)
6. **`/eiendom/tekst`** — NY: beliggenhetstekst-generator med Google Places + Claude
7. **301 redirects** fra alle gamle URL-er (`/for/`, `/kart/`, `/generer`)
8. **Migrasjon** `048_generation_requests_customer.sql` kjørt mot prod
9. **Dead code slettet:** KartExplorer, kart-bookmarks-store, explore/report/landing pages
10. **Compound doc:** `docs/solutions/architecture-patterns/eiendom-url-arkitektur-migration-20260307.md`

Branch: `feat/eiendom-url-arkitektur` (worktree: `placy-ralph-eiendom`)

### Parkert / Åpne spørsmål
- **Tekst-generator kvalitet:** Prompten bruker Curator-prinsipper, men output er ikke validert mot Krogsveen-benchmark. Trenger manuell review av 5-10 genereringer
- **Rate limiting er in-memory:** Fungerer per serverless instance, men resetter ved cold start. Vercel KV er bedre langsiktig, men overkill for nå
- **Visningsassistent design:** Funksjonell MVP, men ikke visuelt polert. Trenger design-iterasjon etter brukertest
- **Eksisterende selvbetjent-prosjekter:** Har `customer_id = NULL` i generation_requests. Trenger manuell migrasjon til riktig meglerkjede
- **Google Places API-kall i tekst-generator:** Koster penger per request. Bør monitoreres
- **Plausible analytics:** Lagt til i eiendom layout, men ikke verifisert i prod ennå

### Retning
- **Klar for deploy.** Branch er grønn: tsc, lint, test, build. Alle 6 eiendom-ruter rendrer riktig.
- **Neste steg etter merge:** Generer 3-4 demoer for reelle adresser via `/eiendom/generer`, test at hele flyten fungerer E2E
- **Tekst-generator er lead-gen:** Gratis verktøy → megler prøver → ser CTA for 999 kr-pakken → bestiller. Kvaliteten på generert tekst er make-or-break
- **Visningsassistent er differensiator:** Ingen konkurrent har mobiloptimert POI-liste for visninger. QR-kode på visning = kjøper utforsker nabolaget selv

### Observasjoner
- **Tung feature, men kodebasen håndterte det.** 6 faser, 5 commits, ~1700 linjer ny kode, ~1450 linjer slettet. Arkitekturen (route groups, generisk ProductNav, server components, bransjeprofiler) skalerte uten strukturelle endringer
- **Tech audit sparte tid.** 10 funn som ellers hadde blitt bugs i prod: ProductNav double-highlight, middleware passthrough blocking, rate limiting, reserved slugs. Alle fikset i planen før implementering
- **Kill dead code aggressivt.** KartExplorer og kart-bookmarks-store hadde 0 referanser etter migrering. Slettet umiddelbart. Kodebasen er renere enn før migreringen startet
- **`permanentRedirect()` vs `redirect()`** er en vanlig feil i Next.js. Førstnevnte gir 308 (permanent), sistnevnte gir 307 (temporary). For SEO-riktige 301-redirects i middleware: `NextResponse.redirect(url, 301)`

---

## 2026-03-09 — Event Explorer Fase 1 + Events-vertikal

### Hva skjedde
Samtale med Nadja Sahbegovic (Trondheim Kommune) om Open House Trondheim utløste oppdagelsen av en ny vertikal: **events og festivaler**. Undersøkelse avdekket 60+ potensielle kunder i Norge — fra Open House Oslo/Bergen til Kulturnatt, kunsthelger, matfestivaler og idrettsarrangementer.

**Forretningslogikk:** Arrangører mangler interaktivt kart med navigasjon mellom events. De har innholdssider, men ikke "hva er nærmest meg"-funksjonalitet. Anyone AS har fakturert ~100k for Oslo Opens kart. Placy kan levere bedre til lavere pris, og det er gjentakende (årlige arrangementer).

**Teknisk implementering (PR #58, merged):**
1. `BransjeprofilFeatures` interface med `dayFilter`, `agendaView`, `eventUrl` flags
2. Event-bransjeprofil med auto-theme fallback (Kulturnatt-mønsteret)
3. `useEventDayFilter` hook + `ExplorerDayFilter` chip-komponent
4. Event-tid badge og eventUrl-lenke på POI-kort
5. 6 nye flate kolonner på `pois` + GIN-indeks + Kulturnatt data-migrasjon (132 POIs)
6. Import-script oppdatert til å skrive nye event-felter direkte

**Arkitekturbeslutning:** Navigasjonslag, ikke innholdsplattform. Placy eier navigasjon mellom events; arrangør eier innhold per event. `eventUrl` på hvert POI lenker til arrangørens eksisterende side.

**Viktig:** Ingen ny rute-tre. Bransjeprofil feature flags på eksisterende `/for/[customer]/[project]/explore`. Vanity-URLer via middleware rewrite (fase 2).

### Beslutninger
- **Events er en vertikal vi satser på.** Gjentakende, løser reelt problem, bygger traction
- **Navigasjonslag-posisjon:** Ikke truende for arrangør, lavere pris å forsvare, raskere onboarding
- **Bransjeprofil > ny rute:** Feature flags skalerer uten dobbelt vedlikehold
- **Flat POI-kolonner > JSONB nesting:** Følger eksisterende mønster (facebook_url, gallery_images)
- **Kulturnatt er single-day:** Dagsfilteret skjules (by design) når bare én dag. Trenger multi-day testdata

### Parkert / Åpne spørsmål
- **Frida Rusnak (Open House Oslo):** Skal kontaktes med demo. Avventer at vi har multi-day testdata som viser dagsfilteret
- **Agenda-visning:** Fase 2 — kronologisk listevisning basert på lagrede POIs
- **CSV-import script:** Fase 2 — generisk import for nye events (ikke bare trdevents API)
- **Vanity-URL middleware:** Fase 2 — `/events/kulturnatt` → `/for/kulturnatt-trondheim/kulturnatt-2025/explore`
- **placy.no/events landingsside:** Fase 3 — salgsside for events-vertikalen
- **Multi-day testdata:** Kulturnatt er 1-dags. Trenger Open House-lignende data (2-3 dager) for å demonstrere dagsfilteret
- **Tekst-generator kvalitet** (fra forrige sesjon): Fortsatt ikke validert
- **Eksisterende selvbetjent-prosjekter** (fra forrige sesjon): Fortsatt `customer_id = NULL`

### Retning
- **Events-vertikalen er den mest lovende nye aksen.** Den løser et reelt problem (navigasjon), er gjentakende (årlig), har mange potensielle kunder (60+), og bygger på eksisterende Explorer-infrastruktur
- **Neste steg:** Lag multi-day testdata → ta screenshot med dagsfilter synlig → send mail til Frida Rusnak (Open House Oslo) og Nadja (Open House Trondheim)
- **Eiendom og events parallelt.** Eiendom er B2B-inntekt nå, events er traction-building. Begge bruker same Explorer med ulik bransjeprofil
- **Ikke bygg mer feature uten kunde.** Fase 1 er nok til å pitche. Agenda-visning og CSV-import bygges først når noen sier ja

### Observasjoner
- **Bransjeprofil-arkitekturen skalerer.** Tredje profil (etter Bolig og Næring) lagt til uten strukturelle endringer. Feature flags gjør at event-spesifikk UI bare aktiveres for Event-prosjekter
- **+330 linjer, 0 regresjoner.** Eksisterende eiendom-Explorer er helt uberørt. Bygger, linter, type-checker alt grønt
- **Kulturnatt-data var allerede der.** Import fra forrige sesjon ga oss testdata umiddelbart. `poi_metadata.time` migrert til nye kolonner med SQL
- **Single-day events skjuler dagsfilteret.** Riktig UX-beslutning, men gjør det vanskelig å demonstrere features uten multi-day data

---

## 2026-03-10

### Hva skjedde
- **Oslo Open 2026 importert** — 441 kunstnere fra osloopen.no JSON API. Koordinater i kilden, men micro-variasjon per kunstner krevde normalisering per adresse (173 adresser → 53 venue clusters). 8 kategorier mappet fra fritekst-teknikk.
- **Arendalsuka 2026 importert** — 134 events (foreløpig, vokser til 2300+ mot august) fra Typesense search API. 30 venues geocodet via Mapbox. 13 temaer mappet 1:1. Script er re-kjørbar.
- **Compound doc oppdatert** med coordinate normalization pattern (gotcha #9), Typesense som ny API-type, og begge nye data sources

### Markedsobservasjon — Events-vertikalen

**Kunder investerer tungt i kart, men feiler på UX.**

Arendalsuka har brukt betydelig tid og penger på sitt kart: egne SVG-ikoner for toaletter, taxi, medic-telt, veisperringer, til og med custom SVG-canvas for skip i havna. Imponerende produksjonsverdi på fasilitetslaget.

Men selve programmet — det besøkende faktisk trenger — er bare røde prikker uten navn, filtrering eller navigasjon. Ingen kategori-filtre, ingen tidslinje, ingen venue-gruppering. Og på mobil (der 90% av festivalbrukerne er) er det helt ubrukelig.

**Mønsteret:** Arrangører tenker "vi trenger et kart" og bygger et fasilitets-kart (hvor er do, parkering, scene). Men det reelle brukerproblemet er program-navigasjon (hva skjer nå, hvor, om hva, og hvordan kommer jeg dit).

**To helt forskjellige produkter:**
1. Fasilitets-kart — "hvor er nærmeste do?" — statisk, manuelt, tegnes én gang
2. Program-kart — "hva skal jeg gå på kl 14 om klima?" — dynamisk, filtrert, personalisert

Placy løser #2. Og #2 er det som er vanskelig å bygge selv — fordi det krever venue clustering, adaptive zoom, kategorifiltre, tidslinje, mobil-first UX, og ruting mellom venues.

**Salgsargument:** "Dere har allerede investert i kart. Vi gir dere program-laget oppå — det som faktisk hjelper besøkende navigere mellom 2300 arrangementer."

### Status — Event-demoer

| Arrangement | Events | Dager | URL |
|------------|--------|-------|-----|
| Kulturnatt Trondheim 2025 | ~130 | 1 dag | `/for/kulturnatt-trondheim/kulturnatt-2025/explore` |
| Festspillene Bergen 2026 | ~56 | 14 dager | `/for/festspillene/festspillene-2026/explore` |
| Oslo Kulturnatt 2025 | 257 | 1 dag | `/for/oslo-kulturnatt/kulturnatt-2025/explore` |
| Oslo Open 2026 | 441 | 2 dager | `/for/oslo-open/oslo-open-2026/explore` |
| Arendalsuka 2026 | 134+ | 5 dager | `/for/arendalsuka/arendalsuka-2026/explore` |

5 live demoer med reell data. Dekker ulike vertikaler: kunst, musikk, politikk, arkitektur. Viser multi-dag, venue clustering, kategorifiltrering.

### Parkert / Åpne spørsmål
- **Open House Bergen** — Squarespace, bare ~21 bygninger, ingen API. Lav prioritet — manuell innsats for lite data
- **Arendalsuka re-import** — Re-kjør scriptet nærmere august når programmet er fullt (2300+ events)
- **Kontakt Arendalsuka** — De investerer tydelig i kart-UX. Placy løser eksakt gapet de har (program-navigasjon)
- **Research-listen har 60 arrangementer** — prioriter de med API/strukturert data og størst navigasjonsbehov

### Produkt-idé — Fasilitets-POIs som USP

Arrangører som Arendalsuka har allerede bygget et fasilitets-lag (toaletter, taxi, parkering, medic, sperringer). De har brukt enormt med tid på det. Men det lever i et separat statisk kart, disconnected fra programmet.

**Placy kan tilby begge i ett:** Program-navigasjon (debatter, konserter, events) + fasilitets-POIs (toalett, parkering, førstehjelp, info-punkt, vannstasjon) — alt i samme kart med smart filtrering og zoom-avhengig synlighet.

**Konkret feature:** Arrangør kan tagge "viktige POIs" — fasiliteter som vises som egne ikoner på kartet. Disse er ikke events, men permanente punkter som besøkende trenger. Synlige i alle zoom-nivåer, med egne ikoner (WC, P, medic-kors, info-i).

**Salgsargument for landingsside:** "Ett kart for alt — program OG fasiliteter. Ikke to separate systemer som besøkende må bytte mellom."

Dette gjør Placy til en komplett erstatning for det arrangøren allerede prøver å bygge selv — ikke bare et tillegg.

**B2B-vinkel — Internt planleggingsverktøy:**

Samme kart kan brukes internt av arrangøren FØR og UNDER festivalen:
- **Sjekkliste per POI** — status på rigging, strøm, bemanning, godkjenning. "Er Samfunnsteltet klart? Har Bakgården fått strøm?"
- **Facility management** — hvem eier hvert venue, kontaktperson, kapasitet, tilgjengelighet
- **Live status under festival** — "Toalett ved Ferjekaia er ute av drift", "Bystyresalen er fullt"
- **Planlegging av logistikk** — sperringer, taxiholdeplasser, medic-telt, vannstasjoner — alt plottet i kartet med ansvarlig person og status

For Arendalsuka med 2300 arrangementer på 30+ venues over 5 dager er dette et reelt koordineringsproblem. De trenger et kart internt like mye som besøkende trenger det eksternt.

**To produkter, ett kart:**
1. Eksternt (besøkende): Program-navigasjon + fasiliteter
2. Internt (arrangør): Planlegging, sjekkliste, live status per venue/POI

### TODO
- [ ] **Brainstorm videre: Internt planleggingsverktøy for festivalarrangører** — kart-basert sjekkliste, status per venue/POI, fasilitets-POIs med custom ikoner, live ops under festival. Bruk `/brainstorming` for å utforske scope, bruker, MVP. Sterk B2B-pitch mot Arendalsuka.

### Retning
- **Event-demoporteføljen er sterk nok til å pitche.** 5 live demoer med reelle data, ulike vertikaler og størrelser
- **Arendalsuka er den sterkeste salgscasen** — 2300 events, de har allerede investert tungt i kart, og UX-en deres feiler på mobil
- **Neste steg bør være outreach, ikke flere importer.** Vi har nok demoer. Nå trenger vi samtaler med arrangører
- **Fasilitets-POIs som feature** — noter til landingsside og pitch. Viser at vi forstår hele behovet, ikke bare program-delen

---

## 2026-03-11 — AI Concierge: On-Site Personalisering for Events og Hotell

### Observasjon

Claude.ai har gjenskapt "trips"-konseptet — en bruker ber om en dagstur i Trondheim, Claude stiller 4-5 spørsmål (hvor, hva, hvem, når), og genererer en kuratert dagsplan med kart, tidspunkter og beskrivelser. Imponerende utførelse, men: hallusinert data, statisk kart, ingen delebar URL, ingen analytics, ingen embedding.

**Konklusjon:** Dette er ikke en trussel mot Placy — det er en validering av konseptet. Og det viser en UX-pattern vi kan bygge bedre.

### Produkt-idé — AI Concierge (on-site personalisering)

**Konsept:** En besøkende (turist, festivalgjenger, konferansedeltager) åpner Placy på stedet og får 3-4 spørsmål. Basert på svarene genereres en personlig Guide med ekte, verifiserte data.

**For events (Arendalsuka, Oslo Open, Kulturnatt):**
- Hvilke temaer interesserer deg? (klima, tech, kultur, demokrati...)
- Når er du ledig? (nå, i ettermiddag, i morgen)
- Hvor er du nå? (GPS)
- Tempo? (få utvalgte ting vs. pakket program)
- → Personlig dagsplan med **ekte events som faktisk skjer akkurat nå**

**For hotell:**
- Hva er du i humør for? (mat, kultur, natur, shopping...)
- Hvor lenge har du? (2 timer, halvdag, heldag)
- Hvem er du med? (alene, partner, familie m/barn)
- → Personlig dagstur med verifiserte POI-er og ekte reisetider

### Hvorfor Placy kan gjøre dette bedre enn Claude.ai

| | Claude.ai | Placy AI Concierge |
|---|---|---|
| Data | Hallusinert/utdatert | Verifiserte POI-er og events i databasen |
| Tidsdimensjon | Vet ikke hva som skjer kl. 14 | Ekte eventtider, åpningstider, sanntid |
| Reisetider | AI-gjetning | Mapbox Matrix, faktiske gangavstander |
| Output | Tekst i en chat | Interaktiv Guide med kart, delebar URL |
| Analytics | Ingen | Arrangør ser hva besøkende er interessert i |
| Kost for bruker | Claude-abonnement | Gratis — arrangør/hotell betaler |

### Strategisk vinkel

**Tidsdimensjonen er nøkkelen.** Vanlige POI-er er statiske — en kafé er der i morgen også. Men events har en tidsdimensjon som gjør AI-conciergen langt mer verdifull: "Hva bør jeg gjøre DE NESTE 3 TIMENE?" er et spørsmål bare Placy kan svare på med ekte data.

**Event-caset er sterkere enn hotell-caset** fordi:
1. Dataen allerede er importert (Arendalsuka, Oslo Open, Kulturnatt)
2. Behovet er akutt (hundrevis av events, besøkende er overveldet)
3. Arrangøren er allerede kunden (B2B)
4. Analytics-verdien er høy ("hvilke temaer trender?")

**For eiendomsmegler (on-site visning):**
- Har du barn? (alder?)
- Hva er viktig i hverdagen? (trening, mat, natur, kollektiv...)
- Hvordan reiser du? (bil, sykkel, gange, buss)
- → Personalisert Explorer med kun de POI-ene som er relevante for DENNE kjøperen

**Megler-caset er det sterkeste fordi:**
1. Dataen er allerede generert (bolig-prosjektene)
2. Kjøperen er fysisk på stedet — høyest mulig intent
3. Megleren får analytics-gull: "Hvem er kjøperne mine og hva prioriterer de?"
4. Differensierer Placy fra statiske nabolagsbrosjyrer til en interaktiv, personlig opplevelse
5. Direkte koblet til eksisterende betalende kundesegment (eiendomsmeglere)

### TODO
- [ ] **Brainstorm videre: AI Concierge** — tre vertikaler (event, hotell, eiendom). Spørsmålsflyt, teknisk arkitektur, MVP-scope. Eiendom er nærmest eksisterende produkt. Bruk `/brainstorming`.

### Retning
- Ikke en prioritet nå — fokus er fortsatt outreach og salg av eksisterende demoer
- Men AI Concierge bør inn i pitch-materialet som visjon / roadmap
- Kan bli en killer-feature som differensierer Placy fra statiske event-apper

---

## 2026-04-07 — Automatisk generer-pipeline + Brevo e-post

### Hva skjedde
Etter 26 dagers pause. Satt opp Brevo e-postutsending fra `hei@placy.no` (domene-autentisering + DNS-opprydding — fjernet duplikat DMARC-record). Deretter bygget den automatiske generer-pipelinen som har vært planlagt siden 6. mars.

**Flyten nå:** Megler fyller ut `/eiendom/generer` → venter 15-30 sek → får e-post "Nabolagskartet er klart" → klikker link → ser Explorer med 116 ekte POI-er.

Hele pipelinen kjører synkront i API-ruten — ingen background jobs, cron, eller manuell intervensjon. Testet med Innherredsveien 7 i Trondheim: 116 POI-er, alle 6 bransjeprofil-temaer, ratings, gangavstander, åpningstider.

### Beslutninger
- **Synkron pipeline i API-ruten** — enkleste tilnærming. 15-30 sek er greit for demo. Timeout-grense på Vercel kan bli et problem i prod, men vi er i prototype-modus
- **Prototype-fokus bekreftet:** Brukeren sa eksplisitt at dette bare skal fungere lokalt for å vise meglere. Ingen grunn til å bygge for prod-skala ennå
- **Brevo over Resend:** Brukeren hadde allerede Brevo-konto med `aharstad.no` autentisert. La til `placy.no` i stedet for å sette opp ny tjeneste
- **Gjenbruk admin-import-logikk:** Ekstraherte `importPOIsToProject()` fra `/api/admin/import` i stedet for å skrive ny. Samme dedup, editorial preservation, og project-linking

### Parkert / Åpne spørsmål
- **Vercel timeout i prod:** Synkron pipeline tar 15-30 sek lokalt. Vercel Hobby har 60s grense. Kan bli tight med mange kategorier eller treg Google API. Trenger async-variant for prod
- **Kvalitetsfiltrering:** Pipelinen bruker kun Google Places grovfiltre. Ingen LLM-kvalitetsfilter (steg 5a/5b fra generate-bolig). For demo er det OK, men suburbs-data vil ha støy
- **Skoler/barnehager mangler:** Pipelinen importerer kun Google Places + Entur + Bysykkel. NSR-skoler, Barnehagefakta, og Overpass-idrettsanlegg er ikke inkludert. Tema "Barn & Oppvekst" vil mangle skole-POI-er
- **Eksisterende selvbetjente prosjekter:** `customer_id = NULL` i generation_requests fra før URL-migreringen. Fortsatt uløst
- **Boligtype-effekt på UX:** `young` og `senior` profilerne endrer hvilke kategorier som importeres, men temaene i Explorer er alltid de 7 Eiendom-Bolig-temaene. Bør temaene tilpasses boligtype?

### Retning
- **Demo-pipeline er klar.** Vi kan nå generere nabolagskart for enhver norsk adresse via skjemaet. Neste steg er å vise dette til meglere
- **Kristian (EM1) bør se det.** Generer hans aktive annonser og send link. "Se hva Placy kan gjøre for dine boliger — 30 sekunder fra adresse til interaktivt kart"
- **Ikke bygg mer pipeline-feature ennå.** Kvalitetsfiltre, skoler, og async kan vente til etter første megler-feedback

### Observasjoner
- **26 dager pause, 1 time tilbake til produktivt arbeid.** PROJECT-LOG + MEMORY.md ga full kontekst. Brainstorm + plan fra 6. mars var direkte gjenbrukbar — bare scopet ble forenklet (prototype vs prod)
- **Eksisterende infrastruktur bar hele vekten.** Bransjeprofiler, explorer caps, admin import-logikk, Supabase-queries — alt fungerte uten endringer. De 4 nye filene (3 pipeline + 1 endret route) var alt som trengtes
- **Supabase schema-drift er en gjenganger.** `story_title` migrert fra projects til products, `short_id` lagt til uten type-oppdatering. TS-types og DB-schema er ute av sync. Bør regenerere typer

---

## 2026-04-07

### Hva skjedde
Bygget **profil-filter** for Eiendom-Bolig Explorer — en livsfase-velger som bottom sheet over kartet. Samme UX-mønster som Kompass (Event), men tilpasset eiendom: barnefamilie/par/singel/pensjonist → pre-filtrerer 4 av 7 temaer.

### Beslutninger
- **Bottom sheet over kartet, ikke fullskjerm onboarding** — brukeren forsto umiddelbart at Explorer er "bak" modalen og at de kan klikke bort. Samme mønster som Kompass — konsistent UX
- **Kun pre-velge temaer, ikke justere caps** — YAGNI. Enkel livsfase→tema mapping er nok. Caps kan legges til senere hvis data viser behov
- **Ett steg, rett inn** — ingen mellomsteg med tema-justering. Tema-chips i Explorer er der for finjustering
- **Ingen egen Zustand store** — Kompass trengte egen store (multi-steg, tabs). Profil-filter er ett steg med én callback — `useState` holder
- **Parchment-palett (#faf9f7)** — konsistent med WelcomeScreen, ikke bg-white som Kompass. Lettere backdrop (25% vs 30%) for at kart-markørene synes bedre

### Parkert / Åpne spørsmål
- **Persistering:** Modalen vises hver gang brukeren besøker. Bør vi lagre valget i sessionStorage/localStorage så den bare vises én gang? Avventer bruker-feedback
- **Skoler/barnehager mangler fortsatt i pipeline:** Profil-filter for "Barnefamilie" fremhever Barn & Oppvekst, men tema har fortsatt mangelfulle data (se forrige logg). NSR-importer trengs
- **Boligtype-effekt:** `young`/`senior` i generer-pipeline → bør disse kobles til profil-filter automatisk? Altså: "denne boligen er tagget for unge, start med Aktiv singel pre-valgt"

### Retning
- **Explorer for eiendom begynner å bli et reelt produkt.** Profil-filter + bransjeprofiler + generer-pipeline = salgbart. Neste steg er å vise dette til meglere med ekte data
- **Fokus: demo-kvalitet, ikke feature-bredde.** Vi har nok features. Det som mangler er data-kvalitet (skoler, barnehager) og polert UX for de funksjonene som finnes

### Observasjoner
- **Kompass-mønsteret var direkte gjenbrukbart.** Bottom sheet, feature flag, dismissal — alt kopiert med minimal tilpasning. Investering i Kompass betalte seg
- **4 filer, ~150 linjer ny kode, 10 linjer endret.** Liten feature, stor effekt. Boligkjøpere slipper å se 200+ POI-er og kan fokusere umiddelbart
- **Bransjeprofil-systemet skalerer godt.** Feature flags per bransje-tag gjør det trivielt å legge til nye UX-features uten å påvirke andre produkter

---

## Sesjon: 2026-04-09 — Hero Insight-kort + kunnskapsbase-kobling

### Hva vi bygde
- **Hero insight-kort per kategori** — 7 unike visuelle oppsummeringer (skolekrets-tabell, nærmeste-per-behov, rating-liste, holdeplasser, etc.) plassert over teksten i hver rapport-seksjon
- **Kureringsmodell med tre tier**: Kort (Tier 1 fakta) → Tekst (Tier 2 kontekst) → Kart (Tier 3 alt)
- **Bridge-text-generator oppdatert** — mottar Tier 1-ekskludering, tekst komplementerer kortet
- **Brøset Curator-tekster regenerert** (migrasjon 049) — tilpasset ny struktur
- **Gangavstand-estimering** — haversine × 1.3 road factor når travelTime mangler fra DB
- **Ungdomsskole fuzzy matching** — fikset Blussuvold↔Blussuvoll mismatch i skolekrets

### Nøkkelbeslutninger
- **Unik form per kategori, ikke felles mal.** Skolekrets er en tabell, Mat & Drikke er en rating-liste, Natur har primær+sekundær-behandling. Hver kategori har sin "killer insight"
- **Tekst komplementerer kort.** Kortet sier "hva og hvor langt", teksten sier "hvorfor det er bra". Aldri gjentagelse
- **Gammel ThemeInsight slettet.** Erstattet fullstendig av hero insight + kart-CTA-oppsummering
- **resolveThemeId** løser legacy-aliaser (barnefamilier→barn-oppvekst, trening-velvare→trening-aktivitet)

### Viktig funn: Jonsvatnet-feilen
Google AI verifiserte Natur-teksten og fanget at "Jonsvatnet er en populære badespot" er feil — det er drikkevann med badeforbud. **Curator-tekster uten validering mot kunnskapsbasen er en risiko.** Fikset umiddelbart, men systemisk løsning trengs.

### Retning: Kunnskapsbase → Rapport
`place_knowledge`-tabellen (migrasjon 038, 226 fakta) er live men brukes ikke i rapporten. Neste steg er å koble den:
1. **Generering trekker fra basen** — verifiserte fakta som input, ikke fri WebSearch
2. **Begrensninger-lag** — negative fakta (badeforbud, restriksjoner) som forhindrer feil
3. **Kilde-lenker i rapport** — ut.no, atb.no, kommune.no synlige for leseren
4. **Forretningsverdi**: "Placy vet mer om nabolaget enn megleren" — kumulativ moat

Se brainstorm: `docs/brainstorms/2026-04-09-kunnskapsbase-rapport-kobling-brainstorm.md`

### Åpne spørsmål
- Hvordan designer vi begrensninger-laget i `place_knowledge`? Ny topic, nytt felt, eller egen tabell?
- Hvor vises kilde-lenker i rapporten? Per seksjon, per inline-POI, eller som fotnoter?
- Skal vi bygge ut Trondheim-basen bydel-for-bydel (Brøset, Moholt, Lade...) som pilot?

---

## 2026-04-10 — Trail overlay: Natur & Friluftsliv får ekte OSM-ruter

### Beslutninger
- **Overpass API som datakilde** — OSM route relations for bicycle/hiking/foot. Alternativ (mapbox-roads, manuell) vurdert og forkastet. OSM har navngitte ruter (Nidelvstien, Jonsvannsruta) som er meningsfulle for bruker.
- **Data seedes, ikke hentes live** — ingen runtime Overpass-kall. Data lagres i `products.config.reportConfig.trails` (JSONB). Koster ~100KB per prosjekt, seedes én gang per prosjekt.
- **TrailLayer som eget komponent** — `Source` + 2 `Layer`-komponenter (lines + labels) i `components/map/trail-layer.tsx`. Holder ReportThemeMap ren.
- **Fargekoding etter routeType** — bicycle=grønn (#22C55E), hiking/foot=amber (#D97706). network-felt lagres men brukes ikke til fargekoding ennå (rcn/lcn er for lite kjent).
- **Dormant↔activated state** — opacity 0.3→0.8, labels vises kun i aktivert tilstand. Jevne overganger med `line-opacity-transition`.
- **mapLoaded gate** — kritisk: TrailLayer renderes kun etter `onLoad` callback. Uten denne gate krasjer Mapbox med "Style is not done loading".

### Parkert / Åpne spørsmål
- **Overpass nede 2026-04-10** — begge endpoints (overpass-api.de + overpass.kumi.systems) utilgjengelige under testing. Testdata er et syntetisk fixture med fiktive koordinater — gir meningsløse trails som går gjennom hus. **Neste steg:** seed ekte Overpass-data for Wesselslokka når servere er oppe: `npx tsx scripts/seed-trails.ts 63.422074 10.450617 3 > /tmp/wesselslokka-trails.json && npx tsx scripts/seed-trails-to-project.ts wesselslokka /tmp/wesselslokka-trails.json`
- **Pipeline-integrasjon uverifisert** — `scripts/generate-story.ts` har step 2.5 for trail-fetching, men er ikke testet end-to-end fordi Overpass var nede.
- **Datastorl på produksjon** — 3km radius kan gi store JSONB-blobs for tette byområder. Test med ekte data før man bestemmer radius-default.
- **network-fargekoding** — rcn (regional) vs lcn (lokal) kan brukes til linje-tykkelse eller dash-mønster i fremtiden.

### Retning
- **Riktig beslutning** å bruke OSM. Navngitte ruter (Nidelvstien, Jonsvannsruta, Moholtruta) er meglerfaglig relevante og gjenkjennbare for boligkjøpere i Trondheim.
- **Blokkert av data, ikke kode.** Implementasjonen er komplett og korrekt — vi venter bare på at Overpass-serverne kommer tilbake. Ikke bruk tid på å forbedre noe som ikke kan verifiseres.
- **Neste naturlige steg etter data-seeding:** Vurder om trail-navn bør vises på dormant-kartet (lavere opacity) som en teaser, eller kun i aktivert tilstand.

### Observasjoner
- **Overpass API er upålitelig som runtime-tjeneste.** Begge kjente mirrors gikk ned samme dag. Beslutningen om å cache i Supabase (ikke hente live) var riktig.
- **Fake testdata er verre enn ingen data.** Fiktive koordinater som tegner stier gjennom hus skaper mer forvirring enn de fjerner. Leksjon: for geo-features, enten ekte data eller ingenting.
- **mapLoaded-gaten var ikke dokumentert noe sted.** En rimelig fallgruve — Mapbox krasjer stille uten god feilmelding. Nå dokumentert i docs/solutions/.

---

## 2026-04-10 — Hverdagsliv redesign: kjøpesenter-anker, tre-tier hierarki

### Beslutninger

- **Hverdagsliv er tema nr. 2 i megler-dekning** (~95% av annonser) men var implementert som sekundært tema. Nå løftet til riktig vektnivå.
- **Kjøpesenter som Tier 1-anker**: `shopping`-kategorien lagt til hverdagsliv-temaet. KjøpesenterCard vises øverst med grønn bakgrunn, gangetid, nettstedslenke og `data-google-ai-target`-hook for fremtidig Google AI-mode.
- **Tre-tier hierarki innført**: Tier 1 (kjøpesenter) → Tier 2 (dagligvare, apotek, lege, standard størrelse) → Tier 3 (vinmonopol, post, bank, frisør, kompakt med separator). Frisør nedprioritert visuelt.
- **`liquor_store` ny kategori**: Lagt til i hele pipelinen (poi-discovery, bransjeprofiler, rating-categories). 0 rader i prod per i dag — data kommer ved neste Google Places import-kjøring.
- **Pre-eksisterende bug fikset**: `"post_office"` i bransjeprofiler var feil — Placy category id er `"post"`. Post-POI-er var usynlige i hverdagsliv-temaet.
- **Bridge text ny logikk**: Løfter kjøpesenteret som narrativt knutepunkt. "I tillegg til Valentinlyst kjøpesenter finnes Rema 1000 3 min unna for daglig handel." — S&J-nivå.
- **TIER1_EXTRACTORS oppdatert atomisk**: Bridge text ekskluderer nå kjøpesenter + primærtjenester. Kritisk regel: TIER1_EXTRACTORS og HVERDAGS-konstantene MÅ alltid landes i samme commit.

### Åpne spørsmål

- **Vinmonopol-data**: `liquor_store` = 0 rader i prod. Trenger re-import av Google Places for Wesselsløkka og Brøset for å se Vinmonopol i UI.
- **Explorer-cap**: Hverdagsliv-cap er 25. Med 2 nye kategorier bør man sjekke om cap bør justeres til 30 for store byer.
- **Kjøpesenter-POI-data**: Wesselsløkka mangler `shopping_mall` POI i DB. Valentinlyst kjøpesenter er sannsynligvis der — vil dukke opp ved neste import.

### Retning

- **Riktig prioritering.** Hverdagsliv var det svakeste temaet til tross for at det er det viktigste. Nå matcher implementasjonen viktigheten.
- **Neste naturlig steg**: Trigg re-import for Wesselsløkka og Brøset for å fylle inn shopping_mall og liquor_store POI-er. Deretter: PR til main.
- **Google AI-mode slot er klar**: `data-google-ai-target`-attributtet er på plass i kjøpesenter-kortet. Selve funksjonen bygges i separat worktree.

### Observasjoner

- **`shopping_mall` vs `"shopping"`**: Google-type og Placy category id er ikke alltid like. For shopping_mall er Google-typen `shopping_mall` men Placy ID er `"shopping"`. Bransjeprofiler bruker alltid Placy IDs. Dette er et viktig mønster å huske.
- **Flat liste med feil vekting**: Den forrige implementasjonen hadde frisør på lik linje med dagligvare. Tre-tier hierarki løser dette elegant — ingen spesialcasing, bare strukturell prioritering.
- **hverdagstjenester (Næring) deler komponent**: Endringer i HverdagslivInsight berører Næring-prosjekter. Guard-logikken er bevisst satt til `< 1` (ikke `< 2`) for å ikke bryte eksisterende Næring-visning.

---

## 2026-04-10 — Kjøpesenter-anker med parent-child POI-hierarki

### Beslutninger

- **Senteret blir en POI med egen markør** — ikke en konfigobjekt eller et spesialfelt. Gir markør, drawer, walkTime, og redaksjonelt innhold gratis via eksisterende infrastruktur.
- **`parent_poi_id` på pois-tabellen** — self-referencing FK med `ON DELETE SET NULL`. Barn-POI-er (butikker) peker til parent (senter). Filtreres fra kart-markører og hero-rader, vises innfoldet i anker-raden + drawer.
- **Single filter point i `report-data.ts`** — all filtrering skjer i `transformToReportData`. Ingen downstream-filtrering. Én kilde, alle konsumenter arver.
- **Cross-theme guard** — barn filtreres KUN når parent er i samme tema. Uten dette ville et barn i feil tema forsvinne helt (tech audit-mitigasjon).
- **`anchor_summary` som kort beskrivelse** — "Dagligvare, apotek, frisør, vinmonopol, bakeri og mer". Vises under senter-navnet i både hero og drawer.
- **Valentinlyst Senter som første implementasjon** — 4 barn (Coop Mega, Boots, Valentinlyst Vinmonopol, Studio Sax). Mønsteret er generisk og fungerer for alle sentre.

### Retning

Rapporten er nå "senter-aware". Brukeren ser at Valentinlyst Senter samler hele hverdagen, og kan klikke seg videre til senterets nettside eller Google AI-søk for dypere utforskning. S&J-stil oppnådd — teaser + videresending, ikke komplett oversikt.

Neste steg: vurder om andre prosjekter (City Lade, Sirkus Shopping, Moholt) skal få samme parent-child-struktur. Dette er generisk datamodell — ingen kodeendringer nødvendig, bare migrasjoner som setter parent_poi_id.

### Observasjoner

- **Filtrering flytter sekundær-rader**: Når Boots Apotek filtreres som barn, blir Apotek 1 Strindheim (16 min) den nærmeste pharmacy-POI-en i primary-raden. Dette ser rart ut — nærmeste apotek er jo 8 min inne i senteret. Men det er bevisst design: anker-raden ER senteret, primary/secondary viser ALTERNATIVER utenfor. Vurder om dette trenger en fotnote eller bedre UX på sikt.
- **Supabase types regenereres ikke automatisk**: Etter migrasjon 056 er parent_poi_id og anchor_summary ukjent for generert `DbPoi`. Cast-mønsteret `(dbPoi as Record<string, unknown>).parent_poi_id` fungerer, men det er nå minst 10 kolonner med dette mønsteret. På sikt: kjør `supabase gen types` eller manuelt oppdater `lib/supabase/types.ts`.
- **Upsert bevarer ikke-nevnte kolonner**: Testet og bekreftet — Supabase PostgREST upsert oppdaterer kun kolonner som er i payload-objektet. Dette betyr at parent_poi_id/anchor_summary ikke overskrives under import, selv uten eksplisitt preservation-logikk.
- **Tech audit fant to kritiske edge cases**: (1) cross-theme guard og (2) single filter point. Begge var lette å overse, men ville ha forårsaket bugs i prod. Audit betaler seg.

---

## 2026-04-15 — Apple-style map-modal

### Beslutninger

- **Gjenskape Apple's modal-UX for map-modal** — slide opp fra bunn, kraftig backdrop-blur, rounded corners, identisk på desktop og mobil. Brukeren ville matche Apple's "Utforsk M5-chipene"-modal fra apple.com/no/macbook-pro presist.
- **Endre defaults i `DialogOverlay` (ikke variant)** — den sterkere backdrop-blur affecterer også `CookiesModal`, men er en forbedring der. Unngår kompleksitet med variant prop eller duplisert komponent.
- **Override `DialogContent` via className i `ReportThemeSection.tsx`** — ikke endre shadcn-grunnkomponent. `!max-w-none` + `fixed inset-x-0 bottom-0 top-[8vh]` overstyrer default sentrert layout rent.
- **Apple's easing `cubic-bezier(0.32, 0.72, 0, 1)`** valgt framfor generisk `ease-out` for autentisk Apple-preg.
- **Unike keyframe-navn** (`map-modal-slide-up`/`-down`) fordi kodebasen allerede har `@keyframes slide-up` — prior art (2026-02-15) viser at duplikater silently overrider.

### Bonusfunn

- **`supports-backdrop-filter:backdrop-blur-sm` var en no-op.** Tailwind genererte `@supports (backdrop-filter: var(--tw))` som ikke er en gyldig feature query. Backdrop-blur har aldri fungert i noen shadcn-dialog hos oss. Fikset implisitt ved å bytte til `supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl`.

### Parkert / Åpne spørsmål

- **Swipe-to-dismiss på mobil** — ikke i scope, men en naturlig videre-utvikling. Vurder på sikt om brukere forventer swipe-ned-gesten.
- **Variant-prop på DialogContent?** — hvis vi senere vil ha BÅDE sentrert klassisk og Apple-style, må vi refaktorere. I dag er det greit å la alle dialoger arve den sterkere backdrop-blur.

### Retning

Designet på rapport-kartet føles mer profesjonelt. Siden vi nå har verifisert at `supports-[backdrop-filter:blur(1px)]` er riktig Tailwind-syntaks, kan vi bruke det andre steder der backdrop-blur er ønsket (f.eks. overlay på Explorer-modus).

Neste fokusområder (per tidligere logger): 
- Hverdagsliv/Trening illustrasjoner ferdigstilles (jfr. nye `hverdagsliv-humor-*.jpg`, `trening-aktivitet-humor-*.jpg` i public/illustrations)
- Vurdere senter-aware-mønsteret for flere prosjekter (City Lade, Sirkus, Moholt)

### Observasjoner

- **Tech audit fanget en subtil Tailwind-bug** som var invisibly brutt i månedsvis. Uten `/tech-audit` hadde vi bare byttet fra `backdrop-blur-sm` til `backdrop-blur-xl` og antatt at det fungerte — i virkeligheten ville ingen av dem rendret fordi `@supports`-queryen var invalid. Audit betaler seg.
- **Flere Dialog-brukere, få regresjoner.** Bare to Dialog-instanser i kodebase: map-modal og CookiesModal. Lav risiko-profil — kunne trygt endre defaults.
- **Visuell verifisering via Chrome DevTools MCP er rask og effektiv.** Screenshots på desktop (1400×900) og mobil (390×844) ga umiddelbar visuell bekreftelse. Apple's design translerte direkte til Placys rapport-kontekst.
- **Prior art-søk i QMD er første-steg**. Søket på "modal backdrop blur animation" ga oss ui-bugs/modal-backdrop-half-viewport-css-animation-collision rett i fanget — kritisk lærdom om duplikate keyframe-navn. Uten det hadde vi sannsynligvis valgt `slide-up` som navn og fått samme bug på nytt.

---

## 2026-04-15 (sesjon 2) — Apple-modal: fix lukke-animasjon via Sheet

### Beslutninger
- **Dialog → Sheet for map-modal.** Rotårsak funnet for manglende close-animasjon: `DialogContent` er nestet **inne** i `DialogOverlay` i vår `dialog.tsx`. Overlay umountes etter 200ms fade-out og river med seg Content som nestet element — før slide-down rekker å starte. Sheet-komponenten har sibling-struktur og uavhengige Presence-livssykluser. Ingen endring i animasjonslogikk — kun komponent-bytte.
- **`[animation-name:*]` for Apple-timing.** Sheet's `animate-in` setter `animation: enter ...` via shorthand. Arbitrære sub-egenskaper (`[animation-name:map-modal-slide-up]`, `[animation-duration:400ms]`, `[animation-timing-function:...]`) overrider enkeltfelter etter shorthand i CSS-kaskaden. Rent og kollisjons-fritt.
- **Animasjoner verifisert med JS-events.** `animationstart` + `animationend` på `data-slot="sheet-content"` for begge tilstander — ikke bare visuell sjekk.

### Levert
- `map-modal-slide-up/-down` keyframes i globals.css (full height, Apple easing)
- `SheetOverlay` backdrop-blur fikset (samme `supports-[backdrop-filter:blur(1px)]`-fix som dialog.tsx)
- Map-modal i `ReportThemeSection` byttet fra Dialog → Sheet
- Compound-dokument oppdatert med rotårsak-diagnosen

### Parkert / Åpne spørsmål
- **Swipe-to-dismiss på mobil** — naturlig neste steg, ikke i scope nå
- **`DialogContent`-nesting er fortsatt feil** i `dialog.tsx` — Content inni Overlay. Fungerer for CookiesModal fordi den ikke bruker slide-animasjoner, men er en latent bug for enhver fremtidig Dialog med close-animasjon. Bør fikses på sikt.
