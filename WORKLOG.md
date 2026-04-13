# Worklog

<!-- Each entry is a YAML block. Most recent first. -->

---
date: 2026-04-13
action: kategori-ikoner-og-sentrert-layout
files:
  - components/variants/report/ReportPage.tsx
  - components/variants/report/ReportThemeSection.tsx
  - components/variants/report/ReportHero.tsx
  - components/variants/report/report-data.ts
  - lib/utils/render-emphasized-text.tsx
  - public/illustrations/icons/*.png
  - supabase/migrations/064_wesselslokka_hero_intro_apple_emphasis.sql
summary: Hver kategori fikk egen håndtegnet akvarell-spot-ikon (handlepose, huske, kaffekopp, bok, benk, manual, sykkel) — samme stil som illustrasjonene, unik palett-aksent per kategori. Layout sentreres per seksjon (ikon → tittel → intro → illustrasjon). Sticky sidebar fjernet — rendyrket editorial-lesning. Alt visuelt språk er nå koherent fra hero til siste seksjon.
detail: |
  IKONER (7 stk, Gemini Nano Banana Pro, /tmp/gen_ikoner_batch.py):
  - Hverdagsliv: handlepose m/ brød og blad, salvie-wash
  - Barn & Aktivitet: huske m/ tau, salvie-wash
  - Mat & Drikke: kaffekopp m/ damp, terrakotta-wash
  - Opplevelser: åpen bok m/ bokmerke, oker-wash
  - Natur & Friluftsliv: parkbenk m/ gress, salvie-wash
  - Trening & Aktivitet: manual/dumbbell, grå-blå-wash
  - Transport & Mobilitet: sykkel side-view, salvie-wash

  Prompt-låst stil via STYLE_HEADER:
  - Håndtegnet blekkstrek, varmgrå ikke svart (~#3a3530)
  - ÉN muted watercolor wash per ikon (ikke dominerende)
  - Pure hvit bakgrunn, generøs safe-area
  - 1:1 square, subject 50-60% av canvas
  - Single focal object — ikke scene
  - Ingen tekst, ingen logoer

  KOMPOSISJON:
  - Spot-ikon (w-32 md:w-36, ~128-144px) ABOVE tittel
  - Ikon + tittel + intro sentreres (flex-col items-center text-center)
  - max-w-2xl på intro → naturlig linje-break
  - Banner-illustrasjon full bredde under
  - Apple-rytme bevart gjennom hele komposisjonen

  SIDEBAR FJERNET:
  - ReportSidebarNav-render + useActiveSection-hook fjernet
  - 3-kolonne grid → enkel sentrert max-w-[800px] container
  - registerRef-prop-passing ryddet bort
  - ReportSidebarNav.tsx-fila bevart (ubrukt, men kan gjenbrukes hvis ny nav
    trenger deler av den)

  HERO-SEKSJONEN:
  - Samme Apple-behandling: tracking-tight på h1, tekst-2xl ikke italic på intro
  - renderEmphasizedText delt ut til lib/utils/render-emphasized-text.tsx
  - Migration 064: "byens mest gjennomtenkte nabolag" nå emphasized i DB

  LÆRINGER:
  - Ikoner i denne stilen er generérbare og konsistente — samme pattern skalerer
    til nye kategorier (bare legge til entry i THEME_ICONS + batch-genererer)
  - Kompakt spot-illustrasjon fungerer når sentrert over tittel, ikke inline
  - Sidebar-fjerning forsterket editorial-lesningen merkbart
  - ReportSidebarNav kan trolig slettes — eller gjenbrukes for mobil-nav senere
status: done

---
date: 2026-04-13
action: apple-typografi-og-bildekomposisjon
files:
  - components/variants/report/ReportThemeSection.tsx
  - components/variants/report/report-data.ts
  - public/illustrations/*.jpg
  - supabase/migrations/062_wesselslokka_bridge_text_apple_emphasis.sql
  - supabase/migrations/063_wesselslokka_bridge_text_expanded.sql
summary: Kategori-seksjonene har fått Apple-inspirert typografi + komposisjon. Tittel er nå hero-størrelse med tracking-tight, intro-tekst er større og ikke kursiv. **Markdown-bold** i bridgeText renderer som mørkere/fremhevet span — to-tone rytme som Apple product pages. Illustrasjoner auto-croppet til motiv-bounds for strammere mobilvisning. Layout-flyt: tittel → stor intro med emphasis → illustrasjon → innhold.
detail: |
  ENDRINGER — typografi/komposisjon:
  - Tittel: text-2xl→text-5xl + tracking-tight + ikon oppgradert 24→32px
  - Intro: text-lg→text-2xl, fjernet italic, base-farge #6a6a6a, leading-snug
  - Emphasis-mekanisme: renderEmphasizedText() parser **markdown** og
    renderer som span med text-[#1a1a1a] font-medium
  - Illustrasjon flyttet under tittel+intro (fra over) med mb-12 luft under —
    oppfattes nå som én samlet intro-blokk

  ENDRINGER — illustrasjoner:
  - Alle 6 kategori-JPG auto-croppet via scripts/crop_illustrations.py
    (threshold=250, buffer=4px, quality=95 for idempotens)
  - Gjennomsnitt ~11% whitespace fjernet, Mat & Drikke -17%
  - ThemeIllustration-type med width+height per fil
    → next/image reserverer korrekt plass, ingen layout shift
  - Batch-generatoren (gen_kategori_batch.py) auto-cropper nå etter save
    → fremtidige kategorier er klare uten manuelt steg

  ENDRINGER — innhold (migrations 062 + 063):
  - Migration 062: alle 7 bridgeTexts wrapped med **emphasis** på
    innledende konfident claim
  - Migration 063: hver bridgeText utvidet med én ekstra setning for
    bedre tekst/bilde-balanse og Apple-rytme
  - Pattern overalt: **claim** → detail → extra context
  - Eksempel (transport):
      FØR: "Brøset er godt koblet — hverdagsmobilitet på gangavstand
            og regional tilgjengelighet innen kort rekkevidde."
      ETTER: "**Brøset er godt koblet.** Hverdagsmobilitet på gangavstand
             og regional tilgjengelighet innen kort rekkevidde. Buss,
             bysykkel og bildeling gjør bilen til et valg — ikke en
             nødvendighet."

  LÆRINGER VERDT Å HUSKE:
  - JPG quality=90 introduserer microskopisk off-white støy som gjør
    crop-scriptet non-idempotent (hver ny kjøring trimmer litt mer).
    quality=95 løser dette.
  - next/image cache (.next/cache/images/) må slettes ved iterasjon
    på samme URL — ellers serves gammel optimalisert versjon
  - Apple-rytme = emphasized claim + softer qualification. Italic
    hører IKKE hjemme her. Tracking-tight på heading er signatur.
  - Bridge text som "one-liner" gir for lite tyngde mot illustrasjon.
    3 linjer (claim + detail + context) gir bedre balanse.

  GJELDER FOR FREMTIDIG ARBEID:
  - Alle nye demoer bør bruke **markdown emphasis** i bridgeText
  - /generate-bolig bør oppdateres til å generere bridgeTexts med
    emphasis-struktur når skrevet automatisk
  - ThemeIllustration-mønsteret skalerer til nye kategorier — bare
    legge til entry i THEME_ILLUSTRATIONS
status: done

---
date: 2026-04-13
action: kategori-illustrasjoner-komplett
files:
  - public/illustrations/hverdagsliv.jpg
  - public/illustrations/barn-aktivitet.jpg
  - public/illustrations/mat-drikke.jpg
  - public/illustrations/natur-friluftsliv.jpg
  - public/illustrations/trening-aktivitet.jpg
  - public/illustrations/transport-mobilitet.jpg
  - components/variants/report/report-data.ts
  - components/variants/report/ReportThemeSection.tsx
summary: Alle 6 kategori-illustrasjoner for Wesselsløkka-rapport generert via Gemini Nano Banana Pro (gemini-3-pro-image-preview) med Wesselsløkka-hero som stil-referanse. Pure hvit bakgrunn, sømløs integrasjon i layout. Bildegeneratoren er spot on — fantastisk effekt på design og opplevelse. Visuell identitet koherent på tvers av hele rapporten.
detail: |
  Bildegenerator-vurdering: SPOT ON. Effekten på design og brukeropplevelse er
  fantastisk. Hver kategori har nå sin egen scene — nabolagssenter, lekeplass,
  kafé, skog med bru, treningsbygg, kollektivstopp — men samtlige deler samme
  akvarell-håndtegnede stil, nordiske palett, og atmosfære som hero-
  illustrasjonen. Ingen "AI-feeling", ingen stil-drift mellom kategoriene.
  Illustrasjonene føles kuratert, ikke maskin-generert.

  Pipeline bekreftet fungerer:
  1. Wesselsløkka-illustrasjon-v2.png som stil-referanse
  2. Kategori-spesifikk subject-prompt (nabolagsscene, ikke butikkspesifikt)
  3. CRITICAL BACKGROUND-overstyring av referansens cream-bakgrunn til pure #FFFFFF
  4. 3:2 landscape, generøs hvit margin rundt subjekt
  5. Ingen lesbare skilt, ingen merker, ingen dominant person

  Tekniske gjennombrudd:
  - Prompt-struktur med "CRITICAL BACKGROUND REQUIREMENT — overrides the reference"
    er nøkkelen — referansebildet påvirker ALT inkludert bakgrunn, må eksplisitt
    overstyres
  - Next.js Image cache (.next/cache/images/) må slettes mellom iterasjoner —
    ny fil på samme URL serves som gammel optimalisert versjon
  - Batch-scriptet (/tmp/gen_kategori_batch.py) genererte alle 4 siste på ~2 min

  Integrering i kodebase:
  - THEME_ILLUSTRATIONS-map i report-data.ts — keyed på theme.id
  - Banner-rendring i ReportThemeSection (next/image, aspect-[3/2], fill)
  - Ikke-invasivt: secondary-variant temaer får ingen illustrasjon
  - Skalerer til nye temaer ved å legge én entry i mappen

  Visuell gjennomgang:
  - Hverdagsliv: nabolagssenter med torg, sykkelstativ, folk på vei gjennom ✓
  - Barn & Aktivitet: barneskole + lekeplass, barn på sparkesykkel + balansesykkel ✓
  - Mat & Drikke: kafé med uteservering, treforeldrepar, syklist ✓
  - Natur & Friluftsliv v1→v2: FIRST pass var dyp furuskog — feil tone for nabolagsrapport.
    Regenerert som urban park i boligområde (gressplen, gangsti, benker, trær,
    faint residential skyline i bakgrunnen). Nær-natur, ikke marka. ✓
  - Trening & Aktivitet: svømmehall/gym + utendørs treningspark, løper ✓
  - Transport & Mobilitet: bussholdeplass + bysykkelrack + elsparkesykler ✓

  Læring fra Natur-iterasjonen: "Natur & Friluftsliv" i boligkontekst = urban park/
  nabolagsgrøntområde, ikke villmark. Oppdatert batch-scriptet til å reflektere dette
  som default for fremtidige demoer.

  Salgs-effekt: rapporten ser nå ut som et kuratert redaksjonelt produkt,
  ikke en databaserapport. Dette er visuell bekreftelse av Placy-shell-
  strategien (tokens + shell, ikke full whitelabel).

  Kostnad: ~$0.04 × 6 = ~$0.24 for hele Wesselsløkka-serien.

  Neste vurdering:
  - Lagre batch-scriptet permanent i scripts/generate-category-illustrations.py
  - Dokumentere prompt-strukturen som "style-bible" for fremtidige prosjekter
  - Vurdere automatisering i /generate-bolig når vi har 3-5 demoer som holder
    stil-konsistens
status: done

---
date: 2026-04-13
action: strategi-diskusjon
files: []
summary: Visuell retning for rapport-illustrasjoner landet — arkitektonisk akvarell-stil (a la Wesselsløkka-hero) blir standarden. Ambisjon utvides til serie: én illustrasjon per nabolagstema (7 kategorier × N demoer). Verktøy-valg: Gemini Nano Banana Pro via `compound-engineering:gemini-imagegen`-skillen, ikke Firefly. Automatisering i /generate-bolig er teknisk mulig men utsatt til stil-konsistens er bevist på 5+ demoer.
detail: |
  Kontekst: Wesselsløkka-hero (arkitektonisk akvarell, nordisk palett, tones ut i
  bakgrunnen) har landet som estetikk brukeren liker. Neste steg: utvide til per-
  kategori-illustrasjoner som serie — Hverdagsliv er pilot.

  Prompt-retning for Hverdagsliv landet: nabolagsankeret (lokalt senter i
  bakgrunn, torg foran med benker, sykkelstativ, få mennesker i bevegelse) —
  ikke enkeltbutikker med lesbare skilt. Løfter blikket fra butikk-kategoriene
  til nabolagsfølelsen. Prompt-tekst full-formulert i chat-historikk — bør
  committeres som style-bible-dokument når låst.

  Verktøy-vurdering (Firefly-abonnement oppbrukt):
  - Firefly bruker Gemini Nano Banana 2 under panseret → Gemini direkte er
    samme motor, ingen tap av kreativ kontroll
  - Bruker har `compound-engineering:gemini-imagegen`-skillen installert lokalt
  - Modell: gemini-3-pro-image-preview (Pro), støtter opp til 14 referansebilder,
    multi-turn refinement, 1K-4K oppløsning, aspect-ratio-kontroll
  - Kostnad: ~$0.04/bilde, gratis tier finnes i AI Studio
  - Alternativer vurdert (Recraft med style-reference for serier, Midjourney
    --sref, Krea/fal.ai) — ikke valgt for nå, men Recraft er side-kanal hvis
    Gemini drifter på serie-konsistens

  Strategisk spørsmål: automatisere bildegenerering i /generate-bolig?
  - Teknisk feasible: mate Wesselsløkka-illustrasjon som referanse + prompt →
    ny demo-hero auto-generert, skrevet til Supabase Storage, satt i
    reportConfig.heroImage
  - Per-kategori-serie (7 bilder × N demoer = 35-42 bilder) er mer ambisiøst
    enn per-demo hero
  - Men: Gemini mangler ekte style-lock — drift-risiko på serie-konsistens
  - Beslutning: IKKE automatisere før stilen er bevist konsistent på 5+ demoer.
    "Automatisert middelmådig" er verre enn "manuelt god".

  Neste konkrete steg:
  - [ ] Bruker henter GEMINI_API_KEY fra aistudio.google.com/apikey
  - [ ] Legger til i .env.local
  - [ ] Test-generer én Hverdagsliv-illustrasjon + én StasjonsKvartalet-hero via
    skillen, med wesselslokka-illustrasjon-v2.png som style-referanse
  - [ ] Sammenlign med Firefly-output — er kvaliteten på nivå?
  - [ ] Hvis ja → iterere gjennom 7 kategorier + StasjonsKvartalet manuelt
  - [ ] Hvis stilen holder over 5+ demoer → vurder automatisering i /generate-bolig
  - [ ] Hvis ikke → evaluer Recraft som side-kanal
status: ongoing

---
date: 2026-04-13
action: strategi-research
files: []
summary: Polaris Media / Adressa Studio-research gjennomført. Platform-via-byrå-hypotese styrket via pris-arbitrasje-argument (byrå kan prise høyere enn startup). Møte-rekkefølge avklart: Nanna (Midtbyen Management) først, Adressa Studio etter. Interessekonflikt mellom eiendom (DNB via Adressa) og events (Midtbyen via Adressa) omframet som bevis på Placys bredde.
detail: |
  Research-funn (research-agent, verifiserte kilder):
  - Polaris Media: børsnotert (OSE: POL), omsetning 3,59 mrd NOK (2024),
    78 mediehus i Norge+Sverige etter 100% oppkjøp av Stampen Media (2025)
  - 6 regionale datterselskap: Midt-Norge (Adresseavisen flaggskip),
    Nordvestlandet, Sør, Vest, Nord-Norge, Sverige
  - "PM Produkt" (nov 2025): ny intern produktorganisasjon, mandat:
    utvikle og skalere AI-løsninger og verktøy for redaksjonene på tvers
    av konsernet. CPO: Mari Brænd Hjelmeland.
  - Historisk mønster: adoptert Schibsted CMS, Cxense, SPiD — bevist
    "develop once, deploy many"-kultur

  Adressa Studio:
  - Avdeling i Adresseavisen (ikke separat selskap), fullservice byrå
    på kommersiell side
  - Bekreftede kunder: DNB Nybygg StasjonsKvartalet (sponset innhold
    + skjema), Content Marketing Norge samarbeidspartner
  - Midtbyen Management: mønster bekreftet (Adressa produserer Issuu-
    magasiner), direkte samarbeid ikke offentlig bekreftet
  - OI Matfestival-kobling USIKKER — ikke bekreftet i søk

  Nanna Berntsen: prosjektleder arrangement / kultur- og programansvarlig
  i Trondheim Management AS. IKKE daglig leder (Kirsten Schultz).
  Eier innholdet i Kulturnatt/Julemarkedet/Martnan, ikke strategien.

  Pris-arbitrasje-argument (strukturelt, ikke bare skala):
  - Solo-founder har innebygd "desperat-rabatt" — prospects forhandler
    fordi de kan (1 person, ingen procurement-friksjon, ingen ref-base)
  - Byrå med etablerte rates selger til sluttkunde i sitt vanlige spor
  - Pris Adressa Studio etablerer blir permanent anker i markedet
  - Referansebank-effekten compounds: første kunde dyrest, neste gratis

  Marginstruktur-modeller vurdert:
  - Rev share (anbefalt pilot: 60/40 til Adressa for StasjonsKvartalet)
  - Wholesale lisens
  - Partner-rate (etter 3-5 prosjekter når volum er kjent)

  Brand-visibilitet: whitelabel-risiko hvis Adressa bundler usynlig.
  Mitigert av nylig generalisert Placy-shell (nøytral footer = alltid
  "Placy"-brand synlig) — designet støtter allerede dette kravet.

  KILDEKORRIGERING: Tidligere påstand "PM Produkt ble etablert nettopp
  fordi de leter etter produkter å skalere" var overfortolkning.
  Pressemeldingen (NTB, nov 2025) sier INGENTING om ekstern produktsøk —
  kun intern konsolidering på tvers av Norge+Sverige. Korrigert pitch:
  ikke hevde at Polaris "leter etter deg"; spør dem i stedet hvordan
  deres apparat for tverr-konsern-utrulling fungerer.

  Møte-strategi:
  1. Svar Nanna raskt, book Nordre gate 10 neste uke. Lav innsats,
     bekreft/avkreft Adressa Studio-relasjon, få Kulturnatt-case friskt
  2. Send mail til Adressa Studio samme dag, foreslå møte ETTER Nanna
  3. Gå inn i Adressa Studio med 3 bevis i hånd: StasjonsKvartalet-demo,
     Kulturnatt-case, Midtbyen-samtale — pitch platform-/kanal-modell,
     ikke per-prosjekt-salg

  Anbefalt åpningssetning mot Adressa Studio: "Jeg tror faktisk dere kan
  prise dette høyere enn jeg kan selv. La oss bruke StasjonsKvartalet
  til å bevise både produktet og prisingen."
status: ongoing
related: [memory/project_demo_outreach_strategy.md, memory/reference_trello_demo_pipeline.md]

---
date: 2026-04-13
action: generalized
files: [components/variants/report/ReportPage.tsx, components/variants/report/ReportSummarySection.tsx, components/variants/report/report-data.ts, lib/types.ts, .claude/commands/generate-bolig.md]
summary: Rapport-layout konsolidert som template for alle nye report-produkter. Hero-bildet er nå et konfigurerbart `reportConfig.heroImage`-felt (ikke hardkodet Wesselsløkka-sti). Summary-seksjonen gjenbruker hero-layout (50/50 tekst+bilde) + egen seksjon for megler/CTA. `/generate-bolig` på StasjonsKvartalet vil automatisk bruke dette shellet.
detail: |
  Layout-endringer i sesjon (fra skjermbildene):
  - Fjernet "Utforsk på egenhånd"-CTA (ReportExplorerCTA) — seksjon + komponent slettet
  - Fjernet attribution-footer (ReportClosing) — komponent slettet
  - Summary flyttet ut av 3-kolonne-grid → full-bredde seksjon, sidebar avsluttes naturlig
  - Summary splittet i to: hero-stil topp (headline/insights + illustrasjon 50/50)
    + egen megler/CTA-seksjon under (luft, ikke cramped)

  Generalisering for template-bruk:
  - `heroImage?: string` lagt til i ReportConfig (lib/types.ts) + ReportData
  - ReportPage leser `reportData.heroImage` i stedet for hardkodet sti
  - ReportHero og ReportSummarySection degraderer graciøst (1-kolonne) hvis image mangler

  Wesselsløkka-migrering:
  - JSONB-merge via `||` operator (IKKE overwrite — bevarte heroIntro/summary/brokers/cta/7 themes)
  - Verifisert: heroImage="/wesselslokka-illustrasjon-v2.png" satt, alt annet intakt

  /generate-bolig dokumentert: heroImage er optional, pipeline genererer ikke automatisk,
  legges inn manuelt post-generering ved brand-illustrasjon.

  Neste steg (åpent spørsmål fra forrige entry): /generate-bolig på StasjonsKvartalet
  kan kjøres nå — layout er template-klart. Image-feltet forblir tomt inntil vi har
  en illustrasjon-kilde (AI / fotografi / manuell).
status: done

---
date: 2026-04-13
action: strategi-diskusjon
files: []
summary: Demo-outreach-strategi konkretisert — StasjonsKvartalet valgt som første fase-1-demo, via Adressa Studio som varm kanal. Pipeline-vurdering av /generate-bolig — ~90% autonomt for innhold, men demo-packaging-laget (story mode, megler-CTA, branding) er ikke generalisert.
detail: |
  Fase-1-pipeline (Trondheim-regionen) ligger i Trello "Demo Pipeline"
  (board 69dcb71daff7e8044a29680e). 5 flagskip-prosjekter:
  Gartnersletta, StasjonsKvartalet, TUN32, Ladebyhagen, Leangenbukta.
  17 søsken-prosjekter parkert (team-overlap + fase 2).

  StasjonsKvartalet valgt som første fordi Adressa Studio (bygger
  deres nettside) allerede er kontaktet og var gira på demo. Dobbel
  verdi: (1) varm intro-kanal til DNB Nybygg, (2) markedsinnsikt fra
  byrå som selger tilsvarende produkter.

  Strategisk anbefaling: bygg StasjonsKvartalet-demoen FØRST, så presenter
  ferdig produkt til Adressa Studio (ikke vag "hva synes dere"-samtale).
  3 spørsmål til dem: faglig tilbakemelding, prising/verdi, integrasjon
  vs. standalone.

  Pipeline-vurdering (/generate-bolig, 18 steg, 1145 linjer):
  - Alt. A "Demo = Placy-prosjekt med rapport + explorer": ~90% autonomt
  - Alt. B "Demo = det Wesselsløkka er" (story mode, megler-CTA, custom
    header/footer): ~60-70% autonomt — demo-packaging ikke generalisert

  Manuelle gates i dagens pipeline (6 stk): geocode-bekreft,
  strøk-match, kunde-input, POI-bekreft, visuell QA, bruker-review.
  Gates 1-3 kan besvares i input. Gate 16+17 er den korte manuelle QA-en.

  Åpent spørsmål for neste sesjon:
  - Kjøre /generate-bolig på StasjonsKvartalet nå (innhold på plass)?
  - Eller først generalisere demo-packaging-laget så TUN32/Ladebyhagen/
    Leangenbukta blir nesten helautonome?

  Minnefiler oppdatert:
  - memory/project_demo_outreach_strategy.md (cardinal-regel: én demo
    per team, flagskip-valg, fase-1-fokus Trondheim)
  - memory/reference_trello_demo_pipeline.md (board/liste/label IDer)
status: ongoing
related: [.claude/commands/generate-bolig.md, docs/solutions/feature-implementations/generate-bolig-quality-pipeline-rewrite-20260228.md]

---
date: 2026-04-13
action: shipped
pr: aharstad91/placy-nextjs#64
files: [components/public/PlacyReportHeader.tsx, components/public/PlacyReportFooter.tsx, components/public/ShareButton.tsx, components/public/CookiesModal.tsx, app/eiendom/[customer]/[project]/rapport/page.tsx, lib/theme-utils.ts, lib/types.ts, lib/supabase/queries.ts, components/variants/report/summary/hooks/useCopyShare.ts, supabase/migrations/061_projects_homepage_url.sql, scripts/seed-wesselslokka-shell.ts, next.config.mjs]
summary: Placy-standardisert shell for rapport-ruten. Header (kundens primary-farge, tilbake-link, prosjektnavn, del-knapp) + footer (nøytral Placy-branding). Erstatter ad-hoc whitelabel med skalerbar modell — neste demo ≤30 min branding.
detail: |
  Strategisk pivot fra forrige Wesselsløkka-demo-tilnærming: i stedet for
  per-kunde custom shell (442 CSS-linjer, mimicking av kundens nettside),
  eier Placy shellet og kunden bidrar med noen få design-tokens.

  Full pipeline kjørt: brainstorm → plan → deepen (4 research-agenter) →
  tech-audit (5 agenter, YELLOW→GREEN etter mitigasjoner) → implementering.
  Tech audit fant 2 high-severity risikoer som ble mitigert:
  1) JSONB-overwrite i seed-script (bruker `||`-merge, ikke naive UPDATE)
  2) XSS via homepage_url (DB CHECK + client displayDomain-guard)

  Nye komponenter i components/public/:
  - PlacyReportHeader (server): sticky, kundens --primary som bg,
    tilbake-link, prosjektnavn sentrert (desktop), del-knapp
  - ShareButton (client): Web Share API + clipboard + execCommand-fallback,
    inline ikon-swap, a11y role=status
  - PlacyReportFooter (server): nøytral cream-bg, ALDRI kundens farger
  - CookiesModal (client): shadcn Dialog, localStorage-persistering

  Infrastruktur:
  - Migration 061 m/CHECK-constraint (blokkerer javascript:/data:)
  - computeLuminance + pickContrastForeground med WCAG 2.1 sRGB-
    linearisering (ikke naiv weighted sum — feil-klassifiserer mid-tones)
  - Contrast-ratio-sammenligning mot SOFT_WHITE/SOFT_BLACK (ikke fast
    luminance-terskel) — mer robust for brand-farger i danger zone
  - displayDomain + safeHref for URL-validering (defense in depth)

  Wesselsløkka-migrering:
  - Seed-script med dry-run, backup, JSONB-merge, concurrency lock
  - Kjørt mot prod: homepage_url=wesselslokka.no, primary=#204c4c (teal)
  - Valg av teal over pink: sticky header med full pink blir for intenst

  Opprydding:
  - Slettet /app/demo/wesselslokka/ (custom shell) + /public/ws-demo/
  - 308 redirect fra gammel URL til ny kanonisk

  Verifisert mot Leangen (shadcn-blå fallback) + Wesselsløkka
  (teal 13:1 kontrast WCAG AAA). Typecheck clean, 0 lint errors.
status: done
related: docs/plans/2026-04-13-feat-placy-report-shell-plan.md
---
date: 2026-04-13
action: created
files: [app/demo/wesselslokka/layout.tsx, app/demo/wesselslokka/page.tsx, app/demo/wesselslokka/WesselsloekaHeader.tsx, app/demo/wesselslokka/WesselsloekaFooter.tsx, app/demo/wesselslokka/wesselslokka.css, public/ws-demo/wesselslokka-logo.png, public/ws-demo/wesselslokka-wordmark.png, public/ws-demo/wesselslokka-wordmark-neg.png, public/ws-demo/wesselslokka-script.webp]
summary: Whitelabel-demo for Wesselsløkka — full brand-wrap rundt delte rapport-komponenter. CSS-scoping-strategi (`.ws-theme` overstyrer Tailwind arbitrary-values) unngår kode-fork av ReportPage. Første mønster vi kan gjenbruke for flere kunde-demoer.
detail: |
  Mål: rapport som ser ut som en integrert del av wesselslokka.no,
  ikke som en Placy-side med "Wesselsløkka" skrevet på.

  Arkitektur:
  - /demo/wesselslokka-rute med eget layout som wrapper alt i `.ws-theme`
  - Custom header (wordmark, full nav, Facebook/Instagram, "Meld interesse"-CTA,
    mobil-burger) + custom footer — egne React-komponenter
  - Brand-palett hentet fra wesselslokka.no Squarespace:
    teal ink #204c4c, pink CTA #e32d7a, vårgrønn #a0e885, cream bg #f7f4ec
  - Fraunces variable font (SOFT + opsz axes) for display-følelse
  - Delt ReportPage uendret — wesselslokka.css scoper overrides via
    `.ws-theme [class*="text-[#1a1a1a]"] { color: var(--ws-ink) }` osv.
    Samme komponent, to forskjellige looks uten fork.

  Status: filer ble utviklet i worktree (placy-ralph-wesselslokka-demo,
  branch feat/wesselslokka-demo hadde 0 commits — kun untracked). Flyttet
  inn på main 2026-04-13 som c6397de da worktrees ble konsolidert.

  Implikasjon: dette er malen for ~mange kunde-demoer fremover. Trenger
  å diskuteres som eget spor (token-system? per-kunde theme-tabell?
  whitelabel-pipeline?).
status: done
---
date: 2026-04-13
action: created
files: [supabase/migrations/060_coachella_2026_demo.sql, app/event/[customer]/[project]/page.tsx, app/event/[customer]/[project]/layout.tsx, app/event/layout.tsx, lib/i18n/explorer-strings.ts, lib/themes/bransjeprofiler.ts, lib/hooks/useTravelTimes.ts, components/variants/explorer/ExplorerPage.tsx, components/variants/explorer/ExplorerPOIList.tsx, docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md]
summary: Coachella 2026 demo — full interaktiv festivalkart som proof-of-concept for Placy som event-plattform. Ny /event/-rute, engelsk UI, event-bransjeprofil med 6 tema-grupper, korrekte gangtider via luftlinje-beregning.
detail: |
  Bruker spurte om Placy kunne gjøres for events — analyserte coachella.com
  (statiske JPG-kart, lineup-browser uten kart-kobling) og identifiserte at
  Placy's eksisterende infrastruktur (POI-system, kategorier, Mapbox, event-felter)
  dekker 90% av behovet. Datamangel, ikke kodemangel.

  Bygget demo med 57 POI-er på Empire Polo Club: 9 scener, 14 mat/drikke,
  12 fasiliteter, 8 transport, 8 kunst/opplevelser, 6 camping. Koordinater
  estimert fra satellittbilder + venue map. Hentet komplett 2026-lineup med
  set times fra Wikipedia + Time Out.

  Etter første demo identifiserte 4 dealbreakers for å sende til Coachella admin:
  1) Alt på norsk → bygget `lib/i18n/explorer-strings.ts` med EN/NO strings,
     threaded locale-prop gjennom ExplorerPage + ExplorerPOIList.
  2) URL "/eiendom/" (real estate) → ny `/event/[customer]/[project]`-rute.
  3) 25 flate kategorier → aktiverte Event-bransjeprofil med 6 temaer
     (Scener, Mat & Drikke, Fasiliteter, Transport, Kunst, Camping).
  4) Feil gangtider (Mapbox ruter rundt venue, 29-43 min) → ny `useDirectDistance`
     prop med haversine × 1.2 faktor gir 1-9 min (korrekt for festivaler).

  Bug: Pins usynlige på /event/ — `.mapboxgl-marker` var 937px bred. Mangel på
  `mapbox-gl.css` i parent layout. Fikset med `app/event/layout.tsx`.
  Dokumentert i docs/solutions/ui-bugs/.

  Demo-URL: /event/goldenvoice/coachella-2026
status: done
---
date: 2026-04-13
action: created
files: [components/variants/report/ReportSummarySection.tsx, components/variants/report/summary/*, components/variants/report/ReportClosing.tsx, components/variants/report/ReportPage.tsx, components/variants/report/report-data.ts, lib/types.ts, lib/theme-utils.ts, lib/i18n/apply-translations.ts, types/plausible.d.ts, app/globals.css, app/eiendom/[customer]/[project]/rapport/page.tsx, scripts/seed-wesselslokka-summary.ts, scripts/restore-product-config.ts, data/wesselslokka-summary.ts]
summary: Ny oppsummeringsblokk nederst i rapporten — syntese-headline, 3-5 insights, varm broker-invite, megler-kort med direkte tel/mail, Meld interesse primær-CTA, share-ikon (tertiær)
detail: |
  Erstatter generisk "Oppsummert"-prosa med lead-genererende seksjon.
  Forskning via 4 agenter: norsk meglerkonvensjon (telefon direkte synlig, "Meld interesse" dominerer),
  shadcn CSS-token theming, Placy repo-kartlegging, clipboard+share API.
  Tech-audit avdekket kritisk bug: globals.css hadde dobbel :root-deklarasjon
  (HSL-kanaler + oklch) som gjorde shadcn semantic tokens dead. Fikset først.
  Theming-wrapper refaktorert fra <style dangerouslySetInnerHTML> til inline style-prop
  (SSR-safe, scoped, ingen lekkasje).
  ProjectTheme utvidet med semantiske felter (background/foreground/primary/card/muted/border).
  Plausible custom events lagt inn på CTA-klikk (cta_primary_click, cta_phone_click,
  cta_share_click, broker_phone_click, broker_email_click) — første custom events i repoet.
  Seed-script med full safeguards: dry-run default, pre-write backup, whitelist-sjekk,
  concurrency guard via updated_at, post-write data + HTTP verify.
  16 beads opprettet og lukket i rekkefølge (dependency-graph-drevet).
  Applied til prod-Supabase for Wesselsløkka — broker er DEMO-placeholder til ekte
  Heimdal-megler-data er hentet.
  Branch: feat/summary-megler-cta (worktree placy-ralph-summary-cta), 1 commit.
status: done
related: docs/plans/2026-04-10-feat-summary-megler-cta-plan.md
---
date: 2026-04-10
action: planned
files: [docs/brainstorms/2026-04-10-summary-megler-cta-brainstorm.md, docs/plans/2026-04-10-feat-summary-megler-cta-plan.md]
summary: Full spec-pipeline for oppsummeringsblokk — brainstorm, plan beriket med 4 research-agenter, 2 auditer (arch + data-integrity), 16 beads generert
detail: |
  Diskusjon om rapport-kvalitet før demo mot Heimdal Eiendomsmegling.
  Brukeren pekte på at "Oppsummert"-seksjonen var generisk og måtte bli salgsverktøy.
  Beslutninger: hybrid innhold (manuell først, pipeline senere), meglere som array
  i prosjekt-config, primær-CTA lenker til eksisterende wesselslokka.no/kontakt.
  Audit-verdict YELLOW → GREEN etter mitigasjoner (dobbel :root, Kort 1-scope,
  seed-safeguards).
status: done
---
date: 2026-04-07
action: deployed
files: [app/api/generation-requests/route.ts, scripts/import-olavsfest.ts]
summary: Pushet pipeline til prod, fikset tsc build-feil (Set spread → Array.from), lagt til BREVO_API_KEY i Vercel env vars
status: done
---
date: 2026-04-07
action: created
files: [lib/pipeline/import-pois.ts, lib/pipeline/create-project.ts, lib/pipeline/housing-categories.ts, app/api/generation-requests/route.ts]
summary: Automatisk generer-pipeline — megler fyller ut skjema, POI-er hentes fra Google Places + Entur + Bysykkel, lagres i Supabase, Explorer viser kart
detail: |
  Hele pipelinen kjører synkront i API-ruten (15-30 sek).
  Testet E2E: Innherredsveien 7 → 116 POI-er, alle 6 bransjeprofil-temaer.
  Gotchas: story_title lever på products (ikke projects), short_id er NOT NULL.
status: done
related: docs/plans/2026-04-07-feat-auto-generer-pipeline-plan.md
---
date: 2026-04-07
action: configured
files: [app/api/generation-requests/route.ts, .env.local]
summary: Brevo e-postutsending fra hei@placy.no — domene-autentisering, DKIM/DMARC opprydding, bekreftelsesmail ved generer-skjema
detail: |
  placy.no lagt til i Brevo. Fjernet duplikat DMARC-record i DNS.
  Mail sendes etter pipeline med "kartet er klart" eller fallback-tekst.
status: done
---
date: 2026-04-07
action: fixed
files: [package.json]
summary: Installert manglende @anthropic-ai/sdk dependency (build error på /eiendom/tekst)
status: done
---
