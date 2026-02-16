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
