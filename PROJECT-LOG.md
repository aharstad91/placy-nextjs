# PROJECT-LOG.md — Prosjektdagbok

> Kronologisk logg over beslutninger, retning og åpne spørsmål.
> Oppdateres som siste steg i /full, eller etter meningsfulle sesjoner.
> Aldri slett — bare legg til.

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
