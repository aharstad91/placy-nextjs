# Worklog

<!-- Each entry is a YAML block. Most recent first. -->

---
date: 2026-04-19
action: Bunn-carousel i UnifiedMapModal — toveis kart↔kort-kobling (desktop)
files:
  - lib/map/use-interaction-controller.ts (NY — flyToken/scrollToken/cancelAll)
  - lib/map/use-interaction-controller.test.ts (NY — 7 tester)
  - components/variants/report/ReportMapBottomCard.tsx (NY — text-only kort)
  - components/variants/report/blocks/ReportMapBottomCarousel.tsx (NY — scroll-snap + roving tabindex)
  - components/map/UnifiedMapModal.tsx (activePOI→{id,source}, hook, aria-live, ESC, 100vh)
  - components/variants/report/ReportThemeSection.tsx (bottomSlot render-prop)
  - components/variants/report/blocks/ReportOverviewMap.tsx (bottomSlot function)
  - app/globals.css (@keyframes map-modal-card-activate + .map-modal-card--active)
  - docs/brainstorms/2026-04-19-kart-modal-bunn-carousel-brainstorm.md
  - docs/plans/2026-04-19-feat-map-modal-bunn-carousel-plan.md
branch: feat/map-modal-bunn-carousel (worktree placy-ralph-map-carousel)
summary: >
  Kjørt /full autonomt på Trello-kort ryuIdgVU. Bunn-carousel i UnifiedMapModal
  (desktop, 100vh) med toveis kobling: klikk marker → kort scroller instant,
  klikk kort → flyTo 400ms. Mobil beholder eksisterende ReportMapDrawer. 5
  commits på feat-branch — grunnimplementasjon, 100vh/overflow/z-index-fix,
  text-only-redesign (fjernet upålitelige Google-bilder), overlay-carousel
  (ingen hvit footer-stripe — kortene sitter på kartet), font-sizing ≥14px
  med 16px tittel.
detail: |
  FASE 1-5 (autonomt):
  - useInteractionController (hook, matcher camera-map.ts-stil, ingen klasse)
  - flyToken/scrollToken + rAF-guard avbryter superseded operasjoner
  - Handler-drevne side-effekter (IKKE useEffect) — unngår React-batching-race
  - source-discriminator {"card" | "marker"}: card→flyTo (ingen scroll),
    marker→scroll instant (ingen flyTo)
  - Én ReportMapBottomCard med isActive-prop (matcher ReportPOICard-mønster)
  - cancelAll() på modal-close, mode-switch 2D→3D, unmount
  - 3D-modus: carousel-interaksjon deaktivert (bottomSlot returnerer null)
  - ESC: første preventDefault + deaktiverer, andre lukker modal
  - aria-live polite + debouncet 150ms announce "[n] av [N], [navn]"
  - Roving tabindex, arrow keys, Home/End

  ITERASJONER PÅ DESIGN:
  1. Første pass (med bilder, 90vh modal, footer-stripe) — cards truncated
  2. 100vh modal + z-index fix for aktivt kort + overflow-fix for morph
  3. Droppet bilder (Google Places upålitelig, mer problemer enn verdi) →
     kun tekst: kategori-ikon, rating, tittel, walk-tid, editorialHook
  4. Morph: dropped translateY, kun scale(1.04) med transform-origin:bottom
     så aktivt kort vokser kun oppover, bunn forankret
  5. items-end + min-h-[260px] på scroll container → ingen layout-shift ved
     aktivering, aktivt kort får alltid plass
  6. Overlay: fjernet hvit footer-stripe, carousel rendres absolute bottom
     inne i map body (pointer-events-none wrapper + auto på inner) — føles
     som en del av kartet
  7. Font sizing ≥ 14px (text-sm) overalt, tittel 16px (text-base)
  8. Kategori-ikon 36x36 m/20x20 ikon (større skannbarhet)

  MEKANISKE SJEKKER:
  - Vitest: 7 nye controller-tester passerer (180/183 totalt grønt; 3 failing
    er pre-existing i lib/curation/validator.test.ts, ikke relatert)
  - npx tsc --noEmit: 0 feil
  - npm run lint: 0 errors (0 nye warnings på endrede filer)
  - npm run build: clean build etter rm -rf .next
  - Chrome DevTools MCP-verifisert: desktop 1440x900 (carousel synlig, 10 POIs,
    marker-klikk scroller kort, kort-klikk flyTo + morph), mobile 390x844
    (carousel skjult, drawer beholdt).

  TODO NESTE SESJON:
  - Evt. polish på aktivt kort (tekst-lengde, knappe-layout)
  - Verifiser på tvers av alle 7 temaer (Transport har sin egen layout)
  - Vurder PR/merge til main

---
date: 2026-04-19
action: Unified grounded narrative — Claude-kuratert Gemini-data med POI-inline + fade-mønster
files:
  - lib/types.ts (schema v2 + discriminated union + v1 passthrough)
  - lib/curation/poi-linker.ts (NY — two-pass + uuid-whitelist)
  - lib/curation/poi-linker.test.ts (NY — 18 tester)
  - lib/curation/sanitize-input.ts (NY — strip markdown + kontroll-chars)
  - lib/curation/sanitize-input.test.ts (NY — 6 tester)
  - lib/curation/validator.ts (NY — NER-sjekk + char-class filter)
  - lib/curation/validator.test.ts (NY — 12 tester)
  - lib/gemini/types.test.ts (oppdatert — +4 v2-tester)
  - scripts/curate-narrative.ts (NY — prepare/apply-orkestrering)
  - .claude/skills/generate-rapport/SKILL.md (NY Steg 2.7)
  - components/variants/report/ReportCuratedGrounded.tsx (NY — fade+les-mer+PoiChip)
  - components/variants/report/ReportThemeSection.tsx (v2-branch + poisById)
  - components/variants/report/ReportPage.tsx (pass allProjectPOIs prop)
  - components/variants/report/report-data.ts (ReportData.allProjectPOIs)
  - docs/brainstorms/2026-04-19-unified-grounded-narrative-brainstorm.md (NY)
  - docs/plans/2026-04-19-feat-unified-grounded-narrative-plan.md (NY, auditert)
  - DB — v2 grounding for banenor-eiendom_stasjonskvartalet + broset-utvikling-as_wesselslokka (7/7 hver)
branch: main
summary: >
  Erstattet to-tekst-mønsteret (Placy extendedBridgeText + raw Gemini narrative)
  med unified curated tekst: Claude kuraterer Gemini-fakta + POI-set til én
  sammenhengende markdown med POI-inline-chips. Placy-tekst beholdes på toppen
  som summary, curated-tekst kommer under med fade-out og "Les hele utdypingen"-
  knapp. Full pipeline: brainstorm → plan → deepen → tech-audit (GREEN etter
  mitigasjoner) → implementering → rollout. Schema bumpet til v2 med
  discriminated union og v1 .passthrough() for rollout-tolerance. 176 tester
  grønne (36 nye).
detail: |
  ARKITEKTUR — Steg 2.7 i /generate-rapport:
  - Nytt prepare/apply-script (scripts/curate-narrative.ts) orkestrerer
    curation. `prepare` lager .context.json per tema (sanitized gemini + poi_set
    + target_length). `apply` leser .curated.md, validerer, kjører POI-linker,
    deep-merge PATCH. Claude fyller inn tekstene i skill-context mellom.
  - POI-linker (lib/curation/poi-linker.ts): two-pass mønster. Pass 1
    validerer [text](poi:uuid)-lenker mot whitelist (ikke bare format —
    cross-tenant-beskyttelse). Pass 2 legger til backup-lenker for uomtalte
    POI-navn. Kategori-prioritet ved navn-kollisjon.
  - Validator (lib/curation/validator.ts): NER-basert fakta-sjekk. Proper
    nouns i curated må matche gemini_narrative ∪ poi_set.name. >3 ukjente →
    reject (hallusinering). Sentence-start capitalization skippes (unngår
    false positives på "Tilbudet", "Bussnettet" etc.). Levenshtein edit-
    distance 1 for bøyningsformer.
  - Sanitize-input: strip markdown-lenker + zero-width chars + RTL-
    overrides fra gemini_narrative før Claude ser den.

  SCHEMA v2 (lib/types.ts):
  - z.discriminatedUnion på groundingVersion
  - v1-skjema markert .passthrough() → tolerer v2-felter under rollout
  - v2 krever curatedNarrative + curatedAt + poiLinksUsed
  - Per-tema version → v1/v2 coexisting OK

  UI (ReportCuratedGrounded.tsx):
  - Placy-tekst øverst (uendret), stat-kort, "Utdyping fra Google AI"
    attribution, curated-preview med fade-out (max-h-[200px]), "Les hele
    utdypingen"-knapp, expand → full tekst + sources + searchEntryPointHtml
  - POI-chips via ReactMarkdown custom `a`-renderer
  - urlTransform override: tillat poi:+http(s)+mailto (v10 strippet poi:
    default — var root cause på tidlig chip-render-bug)
  - rehype-sanitize schema med poi:-protokoll på allowlist
  - POI-lookup via allProjectPOIs (ikke theme.allPOIs som er filtrert)

  GOOGLE ToS:
  - searchEntryPointHtml verbatim, sources + attribution beholdes
  - Claude omskriver stil, ikke fakta — Perplexity-mønster

  SIKKERHETSMITIGASJONER (fra tech-audit):
  - Prompt-injection: gemini_narrative sanitized pre-Claude
  - POI-uuid whitelist + render-time re-validering
  - Character-class filter (zero-width, RTL, non-printable)
  - Hard length-cap 1200 tegn
  - Audit-log av Claude's raw output per curation

  ATOMICITY:
  - Single PATCH for alle temaer etter in-memory validering
  - Per-tema version-bump → partial rollout tillatt
  - Backup FØR final PATCH
  - Optimistic lock via updated_at
  - Idempotens: skip hvis curatedAt > fetchedAt

  TEKST-LENGDE:
  - Første rollout: 500-700 tegn — bruker flagget for lite
  - Andre rollout: 900-1100 tegn med rikere detaljer
  - 3 temaer feilet første apply pga NER-false-positives på sentence-
    start common-nouns. Fikset validator, alle 14 apply'd OK.

  REVIEW-AGENTER KJØRT (3x parallelt, alle mitigasjoner adoptert):
  - security-sentinel: HIGH prompt-injection + POI-uuid + Claude-output
  - architecture-strategist: per-tema version + idempotens + script-ekstrakt
  - data-integrity-guardian: single-transaction + .passthrough() + pre-PATCH backup

  PIPELINE RESULT:
  - Stasjonskvartalet: 7/7 temaer v2, 926-1103 tegn, 4 POI-chips
  - Wesselsløkka: 7/7 temaer v2, 946-1006 tegn, 7 POI-chips
  - 176/176 tester grønne, 0 TS-feil, 0 lint-warnings, build grønn

---
date: 2026-04-19
action: Full plan-workflow — bunn-carousel i UnifiedMapModal + Trello-kort + grounding-opprydding
files:
  - docs/brainstorms/2026-04-19-kart-modal-bunn-carousel-brainstorm.md (NY)
  - docs/plans/2026-04-19-feat-map-modal-bunn-carousel-plan.md (NY, deepened + auditert)
  - .claude/projects/.../memory/feedback_trello_cards_consolidate.md (NY)
  - .claude/projects/.../memory/MEMORY.md (oppdatert indeks)
branch: main
summary: >
  Kjørte /brainstorming → /plan → /deepen-plan → /tech-audit → Trello-kort på
  ny feature: bunn-carousel i UnifiedMapModal med toveis kart↔kort-kobling
  (desktop-only). 8 review-agenter kjørt (Kieran TS, Julik races, simplicity,
  performance, best-practices, architecture, security, patterns). Plan landet
  som GREEN etter YELLOW-mitigering. Også: oppdatert modal-høyde-kort (95vh)
  og opprettet grounding-UX-opprydding-kort (fjern "VI STILTE", _blank på
  chips, favicon+HoverCard for kilder).
detail: |
  BUNN-CAROUSEL — HOVEDFUNN FRA REVIEW:
  - Julik avdekket kritisk race: side-effekter via useEffect som leser
    activePOI.source brekker ved React-batching + rask klikking ("aktiv POI
    uten flyTo"-bug). Løsning: handler-drevet side-effekt, state kun for
    rendering. flyToken + scrollToken-pattern med rAF-scoped cancellering.
  - Pattern-recognition fikset filplassering: POI-kort hører hjemme i
    components/variants/report/ (editorial content), controller-hook i
    lib/map/. components/map/ er for kart-motor.
  - Kieran/pattern-konflikt: Kieran sa "splitt i to komponenter", pattern-
    audit sa "én med isActive-prop" (matcher ReportPOICard). Kodebase-
    konsistens vant.
  - Kieran/Julik-konflikt på flyTo: Kieran ville ha controlled prop,
    Julik handler-drevet. Julik vant (race-risiko trumfer deklarativt).
  - Architecture flyttet InteractionController fra klasse til hook
    (useInteractionController) — ingen klasse-presedens i app-kode.
  - Simplicity kuttet lib/poi-ranking.ts-extraction, 3D-scope, "Future
    considerations"-seksjon. Importer getMatDrikkeCarousel direkte.
  - Security: ?poi=-whitelist-validering mot POI-liste, ikke sanitize.
    Eksterne lenker rel="noopener noreferrer" target="_blank".
  - NN/g 2024: subtil morph (scale 1.05), ikke drastisk — stort morph
    mister spatial anchor. Airbnb/Google bruker 120-150ms.

  TRELLO-KORT-KONSOLIDERING:
  - Opprettet initialt 4 fase-kort → bruker: "samle alt i ett kort".
  - Arkiverte 4 fase-kort, opprettet ett master-kort med lenke til plan.
  - Ny memory-entry: feedback_trello_cards_consolidate.md — /plan Phase 5
    skal fra nå lage ETT kort per plan.

  PARALLELLE KORT:
  - Jp8pHzZX (kart-modal 95vh-kommentar + flyttet til Backlog)
  - WugZYeNg (grounding UX-opprydding: fjern "VI STILTE", _blank, favicon
    + HoverCard for kilder — ToS-verifisert at kun search-chips må være
    verbatim, target _blank OK)

  KONTEKST-NOTAT:
  - Sesjonen brukte ~35% av 1M context via 8 review-agenter i deepen+audit.
    Cap på 8 agenter per CLAUDE.md.

---
date: 2026-04-19
action: Brainstorm — foto-kollasj i rapport via Dropbox-lenke
files:
  - docs/brainstorms/2026-04-19-foto-kollasj-rapport-brainstorm.md (NY)
branch: main
summary: >
  Sammenligning med Sem & Johnsen-Overvik-prospektet (50 sider) viste at
  Placy allerede dekker innholdet, men mangler stedsverifiserte foto.
  Brainstorm fanget YAGNI-scope: Dropbox-lenke som input til /generate-bolig,
  prosjekt-generell foto-pool (ingen POI-kobling enda), kollasj-block som
  atmosfærisk element i tema-seksjoner. Foto komplementerer akvarell, ikke
  erstatter. Utsatt: per-POI-mapping, upload-UI, megler-portal, sesong,
  lisens, gjenbruk på tvers av prosjekter. Trello-kort opprettet i Backlog
  på Utvikling-boardet.
detail: |
  BESLUTNINGER:
  - Foto-kilde: bedriften som eier rapporten (megler eller utbygger)
  - Inngangsport: Dropbox-lenke som input til /generate-bolig eller post-hoc
  - Datamodell: project.photos[] (felles pool), ingen POI-kobling i V1
  - Kollasj-mapping: atmosfærisk rytme i tema-seksjoner, ikke per POI
  - Foto vs akvarell: begge eksisterer side om side

  KONTEKST:
  - Brukeren leste gjennom Overvik-prospektet s. 22-59 og identifiserte
    8 grep Placy kan adoptere: "Velkommen over"-format, sykkelminutter,
    stilisert kart, aktivitets-verb som seksjonstitler, sesong-dekning,
    navngitte mikrosteder, redaksjonelt intervju, målgruppe-bredde
  - Kollasjer (s. 32-33, 42-43) var det mest direkte Placy-gapet
  - Research-agent avdekket at dagens galleryImages er Google Places-URLer
    som TOS forbyr arkivering av — så "eide" bilder må ha annen kilde

  NESTE GANG:
  - Kjør /plan på brainstorm når demo-behov oppstår
  - Vurder forholdet til generate-rapport-skillet (eksisterende tekst-pipeline)
  - Første kollasj-demo kan bruke "lånte" bilder manuelt i public/

---
date: 2026-04-18
action: Gemini grounding UX-iter — drawer → inline, paragraf-splitting, Google-chip-styling
files:
  - components/variants/report/ReportGroundingInline.tsx (NY — erstatter drawer)
  - components/variants/report/GoogleAIGroundingSheet.tsx (SLETTET)
  - components/variants/report/ReportThemeSection.tsx (ny wiring)
  - lib/gemini/grounding.ts (prompt-endring: 3–4 avsnitt)
  - app/globals.css (CSS-overrides for .grounding-search-entry)
branch: main
summary: >
  Brukeren flagget at drawer var feil pattern — grounding-innhold skal bo
  inline i rapport-kroppen, ikke forlate lesetråden. Omarbeidet til inline-
  mønster med stegvis animasjon (idle → "henter" med spinner ~1s → expand +
  fade-in). Sletter drawer-komponent helt. Gemini-prompt strammet for å
  tvinge 3–4 avsnitt. CSS-overrides på Google's chip-carousel slik at chips
  matcher Placy-typografi (font-family inherit, muted pill-bakgrunn, gap
  mellom chips). Delte attribution-blokken tydelig: "Vi stilte spørsmålet"
  med vår readMoreQuery først, "Google foreslår også" med Google's chips
  etterpå — ToS-kompatibelt og mentalt ryddig for leseren.
detail: |
  PATTERN-ENDRING:
  - Drawer (Sheet fra radix) tok brukeren ut av rapport-flow'en
  - Bruker peker på Explorer's "hent flere POIs"-knapp-mønster:
    stegvis animasjon gir agens, teateret (~1s pause) bekrefter arbeid
  - Nytt: ReportGroundingInline med 3 states (idle/loading/expanded)
  - Fader inn fra bunn (slide-in-from-bottom-2), samme typografi som
    lowerNarrative (text-base md:text-lg, leading-[1.8], #4a4a4a)
  - "Skjul utdyping"-knapp lar brukeren kollapse tilbake

  TYPOGRAFI-FIKS:
  - Første iter brukte `prose prose-sm` som krympet teksten
  - Rapport bruker text-base md:text-lg → grounding matcher nå 1:1
  - [&>p]:mb-5 [&>p:last-child]:mb-0 gir eksplisitt avsnitt-spacing
    mellom react-markdown's <p>-elementer

  PARAGRAF-FIKS:
  - Gemini returnerte én kontinuerlig prosa-streng uten \n\n
  - Iter 1: "2–4 avsnitt" → Gemini valgte oftest 1-2
  - Iter 2 (endelig): eksplisitt "minst 3, helst 4" + "ÉN tydelig underdel
    per avsnitt" + "start hvert avsnitt på ny linje — ikke én lang blokk"
  - Resultat: alle 7 tema × 2 prosjekt får 3-4 avsnitt konsekvent

  GOOGLE-CHIP-STYLING:
  - Google leverer searchEntryPointHtml med inline <style> som bruker
    Google Sans + lys grå container + rounded chips
  - ToS krever verbatim rendering → vi kan ikke fjerne attribution,
    men kan override via CSS-specificity
  - Lagt til i app/globals.css: .grounding-search-entry * { font-family:
    inherit } + override av .container, .chip, .carousel, .gradient,
    .headline for å matche Placy's muted pill-stil
  - ToS-compliance: chips rendres fortsatt, lenker til Google Search
    intakt, attribution synlig via vår egen G-logo + disclaimer

  ATTRIBUTION-ARKITEKTUR:
  - "Vi stilte spørsmålet:" + [readMoreQuery som indigo-chip med G-logo]
  - "Google foreslår også:" + [Google's chip-carousel]
  - Disclaimer: "Generert med Google AI basert på offentlige kilder.
    Oppdatert {dato}."
  - Klar semantisk separasjon: vår query vs Google's tilleggsforslag

  RERUN:
  - Stasjonskvartalet --force: 7/7 ✓ (alle 3-4 avsnitt)
  - Wesselsløkka --force: 7/7 ✓

  KVALITETSSJEKKER:
  - 136/136 tests, 0 TS-errors, 0 nye lint-warnings
  - rapport-rute 200 OK for begge prosjekter
status: done

---
date: 2026-04-18
action: Gemini grounding i rapport — full pipeline (PR #1-#3) + migrering
files:
  - lib/gemini/{types,sanitize,url-resolver,grounding,index}.ts (NY)
  - lib/gemini/{url-resolver,sanitize,types}.test.ts (NY — 44 tester)
  - scripts/gemini-grounding.ts (NY — CLI med parallell Gemini + SSRF-safe resolve + deep-merge PATCH)
  - app/api/revalidate/route.ts (NY — tagged revalidation-hook)
  - components/variants/report/GoogleAIGroundingSheet.tsx (NY — dynamic-imported)
  - lib/types.ts (utvidet — ReportThemeGrounding + Zod view-schema)
  - components/variants/report/{report-themes,report-data}.ts (grounding propagering)
  - components/variants/report/ReportThemeSection.tsx (erstatter udm=50-lenke)
  - app/eiendom/[customer]/[project]/rapport/page.tsx (unstable_cache + revalidate)
  - .claude/skills/generate-rapport/SKILL.md (Steg 2.5/3.5/7/9 oppdatert)
  - CLAUDE.md (ny ### LLM-integrasjon-seksjon)
  - docs/solutions/api-integration/gemini-grounding-pattern-20260418.md (NY)
  - package.json (+ react-markdown rehype-sanitize isomorphic-dompurify p-limit ipaddr.js)
branch: main
summary: >
  Erstatter manuell WebFetch/WebSearch-basert Steg 2.5 i /generate-rapport
  med ett parallellt Gemini-kall per kategori (google_search-tool). Skill
  leser grounding.narrative som fact-feed; ny sheet-drawer viser narrativ
  + kilder + Google-attribution i stedet for å sende brukeren ut til
  google.com/search?udm=50. Stasjonskvartalet + Wesselsløkka begge 7/7
  populert, 5-16 kilder per kategori, 12-14s parallellt.
detail: |
  ARKITEKTUR:
  - Build-time only (Placy-regel: ingen runtime LLM)
  - Ett Gemini-kall per kategori parallellt via Promise.allSettled
  - URL-resolve av redirect-URLer med p-limit(5) og SSRF-guard (DNS pre-
    resolve + ipaddr.js range() === "unicast")
  - Deep-merge PATCH: whitelist-guard på reportConfig-nøkler, match themes
    på id, optimistic lock via updated_at, backup + post-write deep-equal.
    Følger scripts/seed-wesselslokka-summary.ts som golden pattern.
  - Totalfeil-abort (≥5/7 kategorier feiler → exit 2, ingen write)
  - Zod-parse ved render-boundary (silent skip + server-log ved invalid),
    groundingVersion: z.literal(1) for å tvinge regen ved schema-bump
  - Google ToS: searchEntryPointHtml verbatim via DOMPurify + dangerously-
    SetInnerHTML, Google-G-logo i drawer-header, disclaimer med fetchedAt
  - revalidateTag-tag matcher både script-side og page-side:
    product:${customer}_${slug}

  EMPIRISK VALIDERING:
  - Stasjonskvartalet: 7/7 ✓, 13.8s, kilder 6-12 per kategori
  - Wesselsløkka: 7/7 ✓, 12.1s, kilder 4-16 per kategori
  - Narrative-lengde 969-1928 tegn, stort sett 1000-1500 norsk prosa
  - Gemini hedget korrekt framtids-fakta (Brøset skole)
  - Post-write deep-equal verifiserte at summary/brokers/cta/trails/motiver/
    personas/heroIntro ikke ble klobret

  UI-VERIFISERING:
  - Dev-server ready 1.6s
  - rapport-ruten 200 OK for begge prosjekter
  - "Utdyp med Google AI"-knapp rendres 6/7 (Opplevelser-tema filtreres
    av pre-existing travelTime-bug — orthogonal til dette arbeidet)
  - Production build: 266kB first-load for rapport-rute
  - Dynamic import: react-markdown + dompurify holdt ute av main chunk

  KVALITETSSJEKKER:
  - 136/136 tests passing (44 nye i lib/gemini/)
  - 0 TS-errors, 0 nye lint-warnings
  - npm run build: OK

  TECH-AUDIT-FUNN INKORPORERT:
  - x-goog-api-key-header i stedet for URL-querystring (unngår leak i logs)
  - SSRF-guard på URL-resolver via DNS pre-resolve + range()-sjekk
  - DOMPurify-sanering av Google-HTML før lagring
  - Deep-merge i stedet for flat replace for å unngå å klobre co-located
    felter i reportConfig-JSONB
  - Omit (ikke null) ved per-kategori-feil matcher TS optional ?:
  - groundingVersion: z.literal(1) + server-log ved mismatch
  - SSRF-matrix testet: avviser 127/8, 10/8, 172.16/12, 192.168/16,
    169.254/16, ::1, fe80::/10, fc00::/7, direkte-IP-URLer

  BEADS LUKKET (4):
  - placy-ralph-tws (foundation)
  - placy-ralph-vja (skill + migrering)
  - placy-ralph-agr (UI + ToS)
  - placy-ralph-e05 (validation + dokumentasjon)

  OBSERVASJONER:
  - Kvalitetssprang vs manuell WebFetch: 6-17 kilder vs typisk 1-3.
    Gemini plukker opp hyperlokal kunnskap (km-fakta Estenstadmarka,
    busslinje-nummer) som Claude's WebSearch ikke finner.
  - Hverdagsliv-querien bommer på scope ("Stasjonskvartalet dagligvare"
    gir prosjekt-info, ikke omgivelses-tjenester). Må justeres i neste
    editorial-pass — ikke blocker for MVP.
  - Opplevelser-tema-filtrering i UI er pre-existing bug som ikke ble
    adressert her. Grounding er lagret i DB og UI-knapp vil dukke opp
    når travelTime-population fikses.

  NESTE STEG (ikke nå):
  - Query-disiplin-retningslinjer for readMoreQuery-endringer
  - EN-locale-støtte (grounding: { no, en }) ved locale-expansion
  - Opplevelser-tema UI-fix (orthogonal bug)
status: done

---
date: 2026-04-18
action: Supabase prod-schema audit — Report-only + observasjon om repo-strategi
files:
  - docs/audits/2026-04-18-supabase-prod-schema-audit.md (NY)
  - docs/audits/2026-04-18-prod-schema.sql (NY — konsolidert DDL, 10 tabeller)
branch: main
summary: >
  Strategisk audit av Supabase foran prod-migrering av Report-produktet.
  Tre parallelle Explore-agenter kartla (1) nåværende schema i sandbox
  (19 aktive tabeller + legacy), (2) hva Report-UI faktisk leser, og (3)
  hva /generate-rapport + /placy-illustrations + /generate-bolig faktisk
  skriver. Syntetisert til 10-tabellers prod-schema og produsert komplett
  DDL-fil. Parkert før implementering — viktig repo-observasjon fanget.
detail: |
  UTGANGSPUNKT:
  Bruker ønsker Report som standalone prod-produkt. Diskusjon om "rydde
  sandbox eller bygge nytt". Min initial anbefaling: greenfield nytt repo
  + ny Supabase. Bruker pushback: "vi har jo all kode vi trenger, agent
  jobber lørdagen uansett". Omvalueringen landet på at jobben ligger i
  datalaget (Supabase), ikke koden — og det er der vi skulle investere.

  AUDIT-METODIKK:
  Tre parallelle Explore-agenter:
  1. Schema-enumerering: alle 66 migrasjoner i supabase/migrations/ lest.
     Output: katalog over tabeller, kolonner, constraints, indexes, RLS.
  2. Report-lesing: hver Supabase-query i components/variants/report/,
     lib/supabase/queries.ts, app/eiendom/** spores fra .from() til UI.
     Output: kolonner faktisk rendret.
  3. Report-skriving: hver write i /generate-rapport, /placy-illustrations,
     /generate-bolig og API-er. Output: kolonner populert av pipeline.

  FUNN:
  - Sandbox: 19 aktive tabeller + projects_legacy + project_pois_legacy
    + ubrukt VIEW project_pois_with_resolved_category
  - 24 av 66 migrasjoner er rene seed-data (Scandic bridgeText, kafé-
    editorial, Wesselsløkka copy, Coachella demo) — ikke schema
  - Report bruker 10 tabeller; 9 tabeller er dead weight (trips/trip_stops/
    project_trips/Guide, collections/shopping, category_slugs/Explorer-SEO,
    generation_requests/selvbetjent demo, project_categories/obsolete,
    theme_stories + 4 relaterte/legacy tema-struktur)
  - ~22 kolonner på pois droppes: poi_tier + 4 tier-felter (system bygd
    for Explorer-turisme, ikke Report-bolig), story_priority, hyre_station_id,
    opening_hours_json, google_phone, event_* (6), gallery_images,
    editorial_sources, anchor_summary, photo_reference, photo_resolved_at
  - DOBBEL STRUKTUR for tema-tekster: legacy theme_stories (tom for nye
    prosjekter) vs. ny products.config.reportConfig (faktisk brukt).
    Prod standardiserer på config.reportConfig.

  BESLUTNINGER:
  1. product_pois.sort_order: BEHOLDT — pipeline populerer via formel-score
  2. trust_* felt: BEHOLDT — pipeline bruker for kvalitets-filtrering
  3. poi_tier-systemet: DROPPET — bygd for turisme-kontekst, ikke bolig
  4. place_knowledge: BEHOLDT — reell POI-IP, brukt av /generate-rapport
  5. translations: DROPPET fra MVP — legges til ved etterspørsel

  LEVERANSE:
  - Audit-dokument med dead-weight-analyse + migrasjonsstrategi
  - 001_prod_schema.sql: 10 tabeller, RLS + policies + triggers + indexes
    for greenfield Supabase-prosjekt

  VIKTIG OBSERVASJON (parkert, ikke handlet på):
  - Originalt plan: nytt repo for prod (placy-prod)
  - Pushback fra bruker: må vi egentlig lage nytt repo?
  - Erkjennelse: placy.no er allerede deployet fra dette repoet via Vercel.
    Nytt repo = omrigge Vercel + DNS + CI uten tilsvarende gevinst.
  - Alternativ: rydd dette repoet aggressivt (slett Explorer/Guide/Story/
    admin/trips/public/event) + pek til ny prod-Supabase + behold placy.no
    som deploy-target
  - Ikke besluttet — krever egen diskusjon når vi plukker opp prod-migrering

  STATUS: PARKERT
  Parkert før implementering. POI-IP-export-script, prod-Supabase-setup,
  kode-opprydding/nytt-repo-beslutning alle venter på ny /work-sesjon.
  Audit-dokumentet + DDL-filen er klar til bruk når prioritering tillater.
status: parkert

---
date: 2026-04-17
action: /generate-bolig konsolidert — 19 → 12 steg + Explorer fjernet
files:
  - .claude/commands/generate-bolig.md (full omskriving — 1312 → 1123 linjer)
branch: main
summary: >
  Effektiviserte /generate-bolig-pipelinen ved å merge relaterte steg og fjerne
  Explorer-produktgenerering (explore lever nå i Report-siden). Fikset en
  rekkefølge-bug: natur-berikelse kjørte etter tekstgenerering, så nye natur-POIs
  ble aldri med i "Natur & Friluftsliv"-bridgeText. Konsoliderte area_id-PATCH
  fra fem ulike sub-steg til én operasjon etter all POI-ingestion.
detail: |
  ENDRINGER (Steg-mapping):
  - 1 + 1.5 → Steg 1 (geocode + strøk-match)
  - 2 + 3 + 4 → Steg 2 (kunde + prosjekt + KUN Report-produkt)
  - 5 + 5.5-5.8 + 14 → Steg 3 (POI discovery, inkl. natur-berikelse flyttet hit)
  - Ny 3g: én area_id-PATCH for alle nye POIs
  - 5a + 5b → Steg 4 (kvalitetsfiltrering)
  - 6 + 7 + 8 → Steg 5 (hydrer Report — link + scoring + categories)
  - 9 → Steg 6 (Google Photos)
  - 10 → Steg 7 (editorial hooks)
  - 11 + 11.5 → Steg 8 (rapport-tekst + hero-illustrasjon, sekvensielt pga config-race)
  - 12 + 13 + 15 + 16 → Steg 9 (revalidate + mekanisk + visuell QA)
  - 17 + 18 → Steg 10 + 11

  EXPLORER FJERNET:
  - 2c oppretter kun Report-produkt
  - 5a/5b/5c writes kun til Report
  - 9c visuell QA har én visning (kart integrert i Report)
  - 10 POI-endringer oppdaterer kun Report
  - 11 oppsummering mister Explorer-URL

  REKKEFØLGE-BUG FIKSET:
  - Gammel pipeline: Steg 14 (Natur-berikelse) kjørte ETTER Steg 11 (tekstgenerering).
    Nye natur-POIs ble derfor aldri reflektert i bridgeText for "Natur & Friluftsliv".
  - Ny: Natur kommer i 3f, før kvalitetsfiltrering (4), scoring (5), tekst (8).

  NYE GOTCHAS (20-23):
  - 20: Natur må inn før kvalitetsfiltrering
  - 21: Kun Report-produkt — oppdater kode som antar explorerId
  - 22: area_id PATCH samles i 3g
  - 23: 8a og 8b kan ikke kjøres parallelt (samme config-felt)

  LEGACY FJERNET:
  - Gammelt Steg 11a/11b/11c (inne i <details>-blokk) — erstattet av /generate-rapport.

  ANDRE SIDEEFFEKTER:
  - generate-adresse.md, generate-naering.md, generate-hotel.md har fortsatt
    Explorer-referanser. Må konsolideres tilsvarende i senere sesjon hvis samme
    Explorer→Report-merge gjelder for de produktvariantene.

---
date: 2026-04-17
action: generate-rapport iter 7-12 — regler W/X/Y/Z/Æ + web-research + integrering med generate-bolig
files:
  - .claude/skills/generate-rapport/SKILL.md (Steg 2.5 Web-research lagt til; Scope oppdatert med nye MVP-prinsipper)
  - .claude/skills/generate-rapport/references/sj-prinsipper.md (regler W, X, Y, Z, Æ lagt til med pattern + test)
  - .claude/skills/generate-rapport/references/anti-patterns.md (NY — 13 konkrete feil fra iter 1-12 m/ rotsårsak + korreksjon)
  - .claude/skills/generate-rapport/references/qa-checklist.md (sjekk 19-23 for tilbuds-miks, preskripsjon, superlativ, kvantitativ, sjargong)
  - .claude/commands/generate-bolig.md (Steg 11 erstattet med delegering til /generate-rapport; legacy arkivert i <details>)
  - lib/types.ts (readMoreQuery?: string lagt til i ReportThemeConfig)
  - components/variants/report/report-themes.ts + report-data.ts (readMoreQuery propageres gjennom)
  - components/variants/report/ReportThemeSection.tsx ("Les mer på Google AI"-pill-knapp)
  - /tmp/rapport-tekster.html (iter 7-12 iterativt)
  - Supabase products (Stasjonskvartalet + Wesselsløkka config.reportConfig oppdatert med iter 12-tekster)
branch: main
summary: >
  Fortsatte iter 6 MVP-tekstene og oppdaget at reglene F-V ikke var nok.
  Brukeren fanget gjentatte feil: faktuell feil om Byhaven-dagligvare, preskriptive
  anbefalinger, udokumenterte superlativer, utdaterte kategorier (bank/post),
  bransje-sjargong (third-wave, fine-dining), og feil ankerverdier. Dette førte til
  fem nye regler (W/X/Y/Z/Æ) + et kritisk Steg 2.5 web-research-steg. Skillen
  ble deretter integrert i /generate-bolig slik at nye prosjekter automatisk får
  MVP-kvalitet. Stasjonskvartalet + Wesselsløkka pushet til Supabase og verifisert live.
detail: |
  KONTEKST: Fortsatte fra iter 6 som hadde etablert F-V men fortsatt produserte
  feil som brukeren fanget. 7 nye iterasjoner senere har skillen betydelig
  forbedrede regler, en anti-patterns-fil med konkrete eksempler, og integrering
  med generate-bolig. Meta-læringen: LLM-intuisjon UTEN web-research gir
  systematiske feil i tilbuds-miks og framtids-fakta.

  ITER 7 — dobling av tekstmengde (3→5 setninger per tema)
  - Bruker: "kun 3 setninger per kategori nå, føles ganske lite"
  - Utvidet til 1 bridge + 4 extended

  ITER 8 — Regel W: Lokasjon stabilt, innhold flyktig
  - Bruker fanget: "Byhaven samler dagligvarekjedene" er FALSK (byhaven.no har
    ingen lavpris-dagligvare — Meny lagt ned 2017)
  - Triangulerte mot byhaven.no/butikker + solsidensenter.no/butikker:
    * Solsiden = MENY, Vinmonopol, 3 apotek, ~60 butikker (stort)
    * Byhaven = 32 butikker, mote/delikatesse, Vinmonopolet, Vitusapotek (boutique)
  - Triangulerte også: Spontan Vinbar byttet navn til Restaurant Saga 2025
  - Triangulerte: Linje 12 går Dragvoll-Midtbyen via Strindheim (ikke Byåsen)
  - Ny regel: navngi sentre/skoler/museer; beskriv innhold KATEGORISK, ikke per merke

  ITER 9 — Regler X + Y: Beskriv, ikke råd + ingen udokumenterte superlativer
  - Bruker: "For daglig matkasse er Solsiden det naturlige valget... vi skal bare
    henvise til beliggenhet og hva en finner, ikke si hva en bør gjøre"
  - Regel X: Ingen preskriptive anbefalinger ("passer best for", "best brukt som",
    "bilen er ikke nødvendig", "det naturlige valget")
  - Regel Y: Hedge superlativer ("det største" → "ett av de større"); markedsføring
    fra egen nettside teller ikke som triangulering

  ITER 10 — Regel Z: Kvantitativ generalisering
  - Bruker: "bank, post, legekontor... utdatert. Bruk heller titalls frisører,
    velvære, dagligvare innen 10 min gang"
  - Kuttet utdaterte kategorier (bank, post, fastlege)
  - Kvantitativ form ("titalls frisører, apotek, velvære") fremfor navn
  - Skalerer robust fordi det er stabilt sant selv når individuelle tilbud skiftes

  ITER 11 — Regel Æ: Ingen bransje-sjargong
  - Bruker: "third-wave... ukjent begrep. vi må unngå slike, eller definere"
  - Bytter: third-wave→"egne brennerier", fine-dining→"smaksmenyer",
    boutique→"mer spesialisert"
  - Prinsipp: skriv for leseren, ikke for bransjen

  ITER 12 — Ankerverdi-disiplin (fix av Regel T)
  - Bruker: "Adressaparken ved Nidelva... noen få minutter unna? 10min, er vel
    ikke få min?"
  - Google AI: Adressaparken = 10 min fra Trondheim S
  - Brudd var å samle to steder i én setning med samme anker uten bucket-sjekk
  - Pass over alle "noen få minutter": korrigert Rockheim/Sjøbadet/Hurtigbåt til
    "rundt fem minutter"; Adressaparken til "rundt ti minutter"

  STRATEGISK INNSIKT — hvorfor skillen feilet gjentatte ganger:
  Bruker: "hvorfor klarer ikke skillen jobben? hva er det google gjør som ikke
  skillen gjør?" Svar: Google AI leser byhaven.no, solsidensenter.no, Visit
  Trondheim — triangulerer. Skillen brukte bare LLM-intuisjon.

  LØSNING — STEG 2.5 WEB-RESEARCH (lagt til SKILL.md):
  - Før tekst-generering: WebFetch offisiell kilde per navngitt ankersted
  - Bygg fact-sheet med triangulerte fakta
  - Påstander MÅ finnes i fact-sheet, ellers drop eller hedge
  - Demonstrert med 15 WebFetch-kall for Stasjonskvartalet+Wesselsløkka
  - Kostnad: ~5-10 kall per prosjekt (ikke per POI), helt innenfor abonnement

  ANTI-PATTERNS-FIL (NY):
  - 13 konkrete feil fra iter 1-12
  - Hver: tekst + rotsårsak + realitet + bruddregel + korreksjon
  - Meta-læringspunkter: 6 tilbakevendende rotsårsaker (LLM-intuisjon,
    superlativ-tendens, preskripsjon, tilbuds-miks-påstander, anker-feil,
    utdaterte kategorier)
  - Brukes som treningsmateriale før skillen kjøres

  INTEGRERING MED GENERATE-BOLIG:
  - Steg 11 i generate-bolig.md erstattet med delegering til /generate-rapport
  - Kommando: /generate-rapport {customer}_{urlSlug} --persona forstegangskjoper,etablerer,barnefamilie
  - Default-personas for bolig: forstegangskjoper,etablerer,barnefamilie
  - Legacy Steg 11a/11b/11c arkivert i <details>-blokk for referanse
  - Sjekk 7 i verifikasjon oppdatert med regel-referanser (W/X/Y/Z/Æ/T)

  SUPABASE — pushet iter 12-tekster:
  - Stasjonskvartalet (eb94072a-...): alle 7 temaer oppdatert + heroIntro + readMoreQuery
  - Wesselsløkka (c87b51f6-...): alle 7 temaer oppdatert (trails/brokers/summary bevart)
  - Verifisert live: 6 "Les mer på Google AI"-knapper rendrer per prosjekt

  READMOREQUERY-UI (tidligere samme dag):
  - readMoreQuery?: string lagt til i ReportThemeConfig (lib/types.ts)
  - Propagering gjennom report-themes.ts → report-data.ts → ReportTheme
  - "Les mer på Google AI"-pill-knapp i ReportThemeSection.tsx (lavender + Sparkles)
  - Plassert etter lower narrative, før map
  - Lenker til https://www.google.com/search?udm=50&q={encodeURIComponent(readMoreQuery)}

  REGEL-SETT NÅ (komplett):
  A-E  S&J-prinsipper (navngi, bevegelse, kontraster, saklig, historisk)
  F    Ingen meter, bruk minutter (80m/min)
  G    Tidssensitive fakta må trianguleres (+ negativ-sjekk)
  H    Ingen byggeprosjekt-tall (%, antall leiligheter)
  I    Ingen etableringsår
  J    Færrest mulig tall
  K    1.-grads spesifikk (ikke 2.-grads detaljer som bygg-navn)
  L    Rating-volum min 30 reviews
  M    Beskriv, ikke påstå
  N    Stabile stedsankre (aldri dagligvare/frisør/bank)
  O    Template-struktur (4-5 setn: 1 bridge + 3-4 extended)
  P    Input-filtrering før LLM
  R    Ingen oppfunnede sammensetninger (stasjonsnabolag, voksen-nabolag)
  S    Prosjektnavn, ikke "adressen"
  T    Ankerverdier for avstand (fem/ti/kvarter/tjue/kort sykkeltur)
  U    Ingen persona-nedvurdering
  V    Generisk + Google AI-lenker for dybde
  W    Lokasjon stabilt, innhold flyktig (NY)
  X    Beskriv tilbudet, ikke valget (NY)
  Y    Ingen udokumenterte superlativer (NY)
  Z    Kvantitativ generalisering for flyktige tilbud (NY)
  Æ    Ingen bransje-sjargong uten forklaring (NY)

  NESTE: Når nytt boligprosjekt skal testes, kjør /generate-bolig "Navn" "Adresse"
  som nå automatisk kaller /generate-rapport for tekstdelen. Test på tredje
  prosjekt (f.eks. Tyholt eller Lade) vil være empirisk validering.

---
date: 2026-04-17
action: generate-rapport MVP-pivot — fra S&J-aspirasjon til robust og skalerbar
files:
  - .claude/skills/generate-rapport/SKILL.md (MVP-modus som default; 2 nye Gotchas for senter-type + butikk-vs-senter)
  - .claude/skills/generate-rapport/references/sj-prinsipper.md (10 nye regler F-V; MVP-seksjon lagt til)
  - .claude/skills/generate-rapport/references/qa-checklist.md (sjekker 11-15 for meter/fakta/tall/2.grads/rating/påståelig)
  - /tmp/rapport-tekster.html (iterativ lesbar demo-fil, 6 iterasjoner)
  - /tmp/stasj-fixed.json, /tmp/wessel-fixed.json (lokale tekst-utkast, ikke pushet til Supabase ennå)
branch: main
summary: >
  Etter 6 iterasjoner på tekst-kvalitet (diagnostisert via HTML-demo) tok vi en
  strategisk MVP-sving: robust og skalerbar > S&J-kvalitet. 11 nye skill-regler
  (F-V) ble etablert, kulminerte i "generisk tekst + Google AI-lenke"-pattern
  for dybde. Tekstene i /tmp/ er klare for push til Supabase.
detail: |
  KONTEKST: Fortsatte fra iter 1 (S&J-aspirasjon) og oppdaget at tekstene
  hadde mange feilkategorier vi ikke kan skalere: faktuelle feil, utdaterte
  bygg-navn, påståelig tone, lav-rating POIs, minutt-presisjon, oppfunnede
  norske sammensetninger, persona-rangering.

  PROGRESJON GJENNOM 6 ITERASJONER (alle dokumentert i /tmp/rapport-tekster.html):

  ITER 2 (regel F, G, H) — meter + tidssensitive fakta + triangulering:
  - Regel F: Ingen meter-avstand, bruk minutter (80m/min)
  - Regel G: Tidssensitive fakta (åpningsdatoer, byggstatus) krever triangulering
    eller hedge. Oppdaget "Brøset skole åpner sommer 2026" var ubekreftet.
  - Nytt Steg 3.5 i pipelinen: triangulation-gate med to separate WebSearch-kall
    (bekreftelse + negativ-sjekk)

  ITER 3 (regel H, I, J) — prosjekt-blindhet + alders-referanser + tall:
  - Regel H: Skriv om beliggenhet, ikke prosjektet ("122 leiligheter",
    "klimanøytral hageby", "53% grøntareal" = banned)
  - Regel I: Ingen etableringsår som argument ("åpnet 1975", "siden 1902")
  - Regel J: Minst mulig tall (bemanning, anlegg-telling, totalstørrelser)

  ITER 4 (regel K, L, M) — 2.grads detaljer + rating-volum + påståelig tone:
  - Regel K: Ingen 2.grads detaljer (bygg-navn, adresser, bemanning) — 
    utløsende: "H2 Barber i Mercur-bygget" var utdatert, de har flyttet
  - Regel L: Minimum 30 google_review_count for navngiving, ellers generaliser
    — utløsende: "Enten Eller frisør" hadde 14 ratings
  - Regel M: Ikke påståelig tone ("ordnes uten at du forlater" → bare beskriv)

  ITER 5 (MVP-SVING — regel N, O, P): STRATEGISK ENDRING. Robust > elegant.
  - Regel N: Navngivings-hierarki. Alltid navngi: skoler, nærsentre, stasjoner,
    museer, parker. Aldri navngi: dagligvare-kjeder, apotek, frisør, vanlige
    treningssentre.
  - Regel O: Template-struktur per kategori. bridge = 1 setn profil, extended
    = 2 setn (signatur-POI + mengde-oversikt). Samme uansett persona.
  - Regel P: Input-filtrering før skriving — strip ustabile felt (adresse, bygg,
    meny) før LLM-trinnet. Deterministisk filter.
  - Alle tekster omskrevet i MVP-form (gikk fra 18KB til ~10KB HTML).

  ITER 5.1-5.5 (gotcha + regel R, S, T, U):
  - Gotcha: senter-type-disambiguering (Olavskvartalet = kulturkvartal,
    hører under Opplevelser, ikke Hverdagsliv). "MENY Solsiden" er butikk,
    ikke senter-navn.
  - Regel R: Ingen oppfunnede norske sammensetninger ("stasjonsnabolag",
    "voksen-nabolag", "bylivs-adresse") — klassisk AI-tekst-feil
  - Regel S: Bruk prosjektnavnet ("Stasjonskvartalet" / "Wesselsløkka"),
    ikke "adressen"
  - Regel T: Avstand i ankerverdier (5/10 min, kvarter, tjue), ikke
    minutt-presisjon. Tabell i skill.
  - Regel U: Ingen persona-nedvurdering. Alle skal føle seg velkomne.
    Vekting ≠ rangering. Banned: "ikke primært et barnefamilie-strøk".

  ITER 6 (regel V) — GENERISK TEKST + GOOGLE AI-LENKER:
  - Brukerens innsikt: vi er ekspert på nabolags-oversikt; Google AI er ekspert
    på ferske detaljer. Arbeidsdeling.
  - Bastante fakta (destinasjoner, rute-numre, priser) generaliseres. Per
    kategori legges en readMoreQuery som lenker til Google AI Mode
    (https://www.google.com/search?udm=50&q=...)
  - Datamodell-utvidelse: readMoreQuery-felt per tema i reportConfig
  - UI-implikasjon: "Les mer på Google AI"-knapp per kategori
  - Utløsende: "direktetog til Oslo, Bodø og Östersund" var bastant + feil
    (Östersund-ruten stemte ikke)

  NÅVÆRENDE TILSTAND:
  - /tmp/stasj-fixed.json og /tmp/wessel-fixed.json inneholder endelige
    MVP-tekster med readMoreQuery per tema
  - Ikke pushet til Supabase ennå — bruker ba om compact først, så regenerering
    i Placy-miljøet
  - 11 nye regler (F-V) + 2 gotchas i skill-filer
  - Skillens MVP-modus er nå default; S&J-kvalitet er "senere iter"

  NESTE (etter compact):
  1. Push oppdaterte tekster til Supabase (begge prosjekter)
  2. Datamodell-utvidelse: støtte readMoreQuery-felt i reportConfig-type
  3. UI-komponent: "Les mer på Google AI"-knapp per kategori-seksjon

---
date: 2026-04-17
action: generate-rapport-skill + ny tekst-pipeline for Stasjonskvartalet og Wesselsløkka
files:
  - .claude/skills/generate-rapport/SKILL.md (ny skill — tekst-pipeline for rapport-produktet)
  - .claude/skills/generate-rapport/references/personas.md (4 personas + Pendler-flagg)
  - .claude/skills/generate-rapport/references/vektmatrise.md (H/M/L adaptiv lengde per persona×kategori)
  - .claude/skills/generate-rapport/references/kvalitetsaksler.md (5 aksler per POI)
  - .claude/skills/generate-rapport/references/motiver.md (3 motiv-typer, rød tråd-mekanikk)
  - .claude/skills/generate-rapport/references/sj-prinsipper.md (rendyrket Sem & Johnsen-mal)
  - .claude/skills/generate-rapport/references/qa-checklist.md (10-punkts QA, erstatter gammel 11c)
  - docs/brainstorms/2026-04-17-tekst-pipeline-rapport-brainstorm.md (finalisert brainstorm)
  - Supabase: products.config (Stasjonskvartalet + Wesselsløkka) + translations (EN bridgeText)
branch: main
summary: >
  Ny `/generate-rapport`-skill bygget fra scratch for å erstatte tekst-delen av
  `/generate-bolig` for rapport-produktet. Personas + motiver + adaptiv lengde +
  S&J-kvalitet. Applied på to pilotprosjekter: Stasjonskvartalet (urban,
  Førstegangs+55+) og Wesselsløkka (suburban, Barnefamilie+Etablerer).
detail: |
  PROBLEM: Tekst-genereringen i `/generate-bolig` produserte ikke "livlagede"
  tekster. Faktisk feil ("Backstube for brødelskere" — industrikjede),
  irrelevant trivia ("Pirbadet åpnet i 2001 og tar imot 400 000 besøkende"),
  marketing-spin ("fast del av hverdagen for trondheimsfamilier" — Pirbadet
  er svindyrt), og ingen målgruppe-bevissthet.

  BRAINSTORM (Q1-Q11): 5 fundamentale beslutninger:
  - Personas som eksplisitt input (førstegangskjøper, etablerer, barnefamilie,
    55+ flyttere + Pendler-flagg)
  - Rød tråd via motiver + broingssetninger
  - Adaptiv lengde per persona (H=6-7 setn, M=5, L=4 min)
  - POI-valg: kvalitativ research + LLM-skjønn (fanger Backstube-fellen)
  - Tekst = primær, kort = supplement (bryter Tier-regelen som drev
    atmosfære-generikk)
  - Curator-stemme rensed til KUN Sem & Johnsen (fjerner Husa/Monocle/LP-drift)
  - Arkitektur: egen standalone skill (D), ikke bakt inn i generate-bolig
  - Scope: KUN rapport-produktet, ikke Explorer/Trips/hooks

  SKILL-STRUKTUR:
  - SKILL.md: 11-stegs pipeline fra input til publisering
  - 6 reference-filer for persona-definisjoner, vektmatrise, aksler, motiver,
    S&J-prinsipper og QA-sjekk
  - MVP er kun tekst; iter 2 utvider med hero-illustrasjon (via
    placy-illustrations), iter 3 med 3D + publisering

  PILOT 1 — STASJONSKVARTALET (urban, personas: forstegangskjoper + femtiefem-pluss):
  - Motiver: kaifronten / stasjonsnabolaget / 10-minutters-livet
  - Fjernet: Backstube (verifisert industrikjede via WebSearch), Pirbad-trivia,
    marketing-spin om familier
  - Løftet: Sjøbadet (1880, historisk), Adressaparken SXSW Place by Design 2018,
    Stu NTNU-designet flytende badstu, Troll Restaurant m/torsketunge, Spontan
    Vinbar Michelin-anbefalt, Jacobsen & Svart third-wave
  - heroIntro: 4 setn, 3 motiver etablert, kontrast "sentrum uten sentrum-støyen"

  PILOT 2 — WESSELSLØKKA (suburban, personas: barnefamilie + etablerer):
  - Motiver: Brøsetjordet / Valentinlyst-fem-minutter / ny bydel i forvandling
  - Stjerne-vinkel: Brøset skole (ny 1-7, åpner sommer 2026, 525 elever) —
    perfekt timing for innflyttere
  - Rettet feil-elementer: markdown-bold i bridgeText, Google-søkelinker,
    misvisende "fast del av hverdagen"-spin
  - Løftet: VYDA Restaurant (2 min, vietnamesisk, topp rating), Il Fornaio
    (steinovn, Adressa hull-i-veggen), Estenstadmarka (40 km stier),
    Spruten ("byens beste akebakke" per Adressa), NCA m/Thomas Whillock
    (UFC/Bellator-coach), NTNU Vitenskapsmuseet-stenging april 2026 varslet
    ærlig
  - heroIntro: 4 setn, 3 motiver, kontrast "rolig nabolag uten å miste byen"

  VERIFIKASJON: 6/7 kategori-seksjoner rendrer ny tekst på begge rapporter.
  Opplevelser-seksjonen rendrer IKKE — eksisterende filter-problem i
  report-data.ts (ikke forårsaket av tekstoppdateringen). Må fikses separat.

  TILDELTE TIL MIG (NESTE): Fikse Opplevelser-rendering-bug. Applye på Brøset.
  Iter 2 av skillen (hero-illustrasjon).

---
date: 2026-04-16
action: 3d-kart-per-prosjekt-default-heading
files:
  - components/map/map-view-3d.tsx (heading? i CameraLock + defaultHeading fra prop)
  - components/variants/report/blocks/ReportOverviewMap.tsx (initialHeading prop + effectiveCameraLock + reset-handler)
  - components/variants/report/report-data.ts (PROJECT_3D_HEADINGS + ReportData.initialHeading)
  - components/variants/report/ReportPage.tsx (pipe initialHeading til ReportOverviewMap)
branch: main
summary: >
  Per-prosjekt default heading for alle 3D-kart i rapporten. Stasjonskvartalet
  satt til 180° (sørvendt) — prosjektet vises fra den beste vinkelen.
  Gjelder både initial innlasting og camera-reset-knappen.
detail: |
  PROBLEM: 3D-kart åpnet alltid nordvendt (heading: 0) uavhengig av prosjekt.
  For Stasjonskvartalet er sørvendt (180°) den beste vinkelen — prosjektet
  ligger ved Brattøra/kaikanten og ser best ut fra sørøst.

  LØSNING: heading?-felt lagt til i CameraLock-interfacet. ReportOverviewMap
  bygger effectiveCameraLock fra initialHeading-prop og bruker det både i
  Map3D defaultHeading og i flyCameraTo (reset-knappen). PROJECT_3D_HEADINGS
  i report-data.ts følger samme pattern som PROJECT_THEME_ILLUSTRATIONS —
  nøkkel er "customer_urlSlug".

  KONFIGURASJON: Legg til linje i PROJECT_3D_HEADINGS for nye prosjekter.
  Prosjekter uten override bruker 0° (nord) som før.

---
date: 2026-04-16
action: stasjonskvartalet-urban-tema-illustrasjoner
files:
  - public/illustrations/stasjonskvartalet-hverdagsliv.jpg (ny)
  - public/illustrations/stasjonskvartalet-mat-drikke.jpg (ny)
  - public/illustrations/stasjonskvartalet-transport.jpg (ny)
  - public/illustrations/stasjonskvartalet-natur-friluftsliv.jpg (ny)
  - public/illustrations/stasjonskvartalet-trening-aktivitet.jpg (ny)
  - public/illustrations/stasjonskvartalet-barn-oppvekst.jpg (ny)
  - public/illustrations/stasjonskvartalet-opplevelser.jpg (ny)
  - components/variants/report/report-data.ts (PROJECT_THEME_ILLUSTRATIONS + fix)
  - .claude/skills/placy-illustrations/assets/anchor-urban-square.jpg (ny)
  - .claude/skills/placy-illustrations/assets/anchor-urban-boulevard.jpg (ny)
  - .claude/skills/placy-illustrations/assets/anchor-urban-station.jpg (ny)
  - .claude/skills/placy-illustrations/SKILL.md (5 urban ankere i tabellen)
branch: main
summary: >
  Generert 7 urban tema-illustrasjoner for Stasjonskvartalet-rapporten +
  3 nye urban stil-ankre (square, boulevard, station med buss). Kodet
  prosjekt-spesifikk override i report-data.ts via customer_urlSlug-nøkkel.
detail: |
  PROBLEM: Rapport-temabannerne brukte suburban-illustrasjoner (Wesselsløkka-stil)
  for Stasjonskvartalet (tett urban kaikant). Feil karakter.

  LØSNING:
  - PROJECT_THEME_ILLUSTRATIONS Record<string, Record<string, ThemeIllustration>>
    i report-data.ts, keyed på `${customer}_${urlSlug}`
  - Lookup: PROJECT_THEME_ILLUSTRATIONS[key]?.[themeId] ?? THEME_ILLUSTRATIONS[themeId]
  - Nøkkel er IKKE project.id (det er product UUID), men customer+urlSlug

  GOTCHA: project.id = product UUID, ikke container ID. Fant ved å trace
  getProductFromSupabase → id: product.id. Fikset til ${customer}_${urlSlug}.

  ANKERE (v2, norsk karakter):
  - anchor-urban-square.jpg: bytorg, brostein, variabel høyde 2-5 etg
  - anchor-urban-boulevard.jpg: bred gate, treverk+mur blandet, sykkel
  - anchor-urban-station.jpg: buss (ikke trikk), blandede fasader

  ITERASJON: første runde av square/boulevard/station var for ensartet og
  europeisk. Andre runde fikk norsk karakter — variabel høyde, treverk,
  buss istedenfor trikk. Mye bedre.

---
date: 2026-04-16
action: urban-illustration-anchors
files:
  - .claude/skills/placy-illustrations/assets/anchor-urban-waterfront.jpg (ny)
  - .claude/skills/placy-illustrations/assets/anchor-urban-street.jpg (ny)
  - .claude/skills/placy-illustrations/SKILL.md (oppdatert)
  - .claude/skills/placy-illustrations/references/prompt-patterns.md (oppdatert)
  - supabase/migrations/066_add_venue_context.sql (ny, kjørt)
  - lib/types.ts (venue_context i ProjectContainer)
  - .claude/commands/generate-bolig.md (Steg 0 + Steg 3 + Steg 11.5)
branch: main
summary: >
  Lagt til to urban stil-ankre (waterfront + street) og venue_context-tag på
  prosjekter. generate-bolig-pipelinen velger nå riktig anker-sett basert på
  om prosjektet er urban eller suburban.
detail: |
  BAKGRUNN:
  Stasjonskvartalet-genereringen avdekket at suburban-ankre (Wesselsløkka,
  café, playground) gir feil karakter for urbane sentrumsprosjekter med 6-8
  etasjer og kaikant. Trengte egne urban ankere.

  ANKERE:
  - anchor-urban-waterfront.jpg: kopi av Stasjonskvartalet-hero (6-8 etasjer,
    havnepromenade, båter, 2 gående + sykelist) — Gemini-generert, 7/7 OK
  - anchor-urban-street.jpg: ny Mønster A-generering, tett bygårdsgater
    (5-6 etasjer, kommersielt i 1. etg, cobblestone, café ute, sykklist) — 7/7 OK

  PIPELINE:
  - generate-bolig Steg 0: nytt spørsmål om urban/suburban
  - generate-bolig Steg 3: venue_context settes i project INSERT
  - generate-bolig Steg 11.5: urban → anchor-urban-waterfront.jpg,
    suburban → anchor-wesselslokka.png

  DB: projects.venue_context TEXT DEFAULT 'suburban' CHECK (suburban|urban)
  Stasjonskvartalet retroaktivt satt til 'urban'.

---
date: 2026-04-16
action: generate-bolig-stasjonskvartalet
files:
  - public/illustrations/stasjonskvartalet-hero.jpg (ny)
branch: main
summary: >
  Kjørte /generate-bolig for Stasjonskvartalet (Banenor Eiendom). Oppgraderte
  eksisterende prosjekt: fikset area_id, la til 7. tema (Opplevelser), genererte
  akvarell-heroImage via Gemini stil-transfer fra rendering, aktiverte 3D-addon.
detail: |
  PROSJEKT: StasjonsKvartalet, Sjøgangen 7, Trondheim (short_id: 1e3db54)
  KUNDE: Banenor Eiendom

  TILSTAND FØR SESJON:
  - Prosjekt eksisterte fra 2026-03-03 med 240 POIs og editorial hooks
  - 6 temaer med legacy IDs (barnefamilier, trening-velvare)
  - 47 POIs uten area_id, 193 med area_id='trondheim'
  - Ingen heroImage, has_3d_addon=false

  GJORT DENNE SESJONEN:
  1) has_3d_addon satt til true
  2) 240/240 POIs oppdatert til area_id='sentrum' (47 fra null, 193 fra 'trondheim')
  3) Tema-config oppgradert: barnefamilier→barn-oppvekst, trening-velvare→trening-aktivitet
  4) Opplevelser (7. tema) lagt til med bridgeText + extendedBridgeText (NO + EN)
     - museum: 8 POIs, library: 7 POIs, cinema: 4 POIs
     - Rockheim (3min), Cinemateket (4min), Nova Kinosenter (5min)
  5) heroImage generert via Gemini 3 Pro Image (Mønster B stil-transfer):
     - Kildebilde: solnedgangsrendering fra Banenor Eiendom
     - Output: public/illustrations/stasjonskvartalet-hero.jpg
     - Kvalitetssjekk: 7/7 poeng bestått
  6) 21 ekstra Google-bilder hentet på nytt

  QA-RESULTAT:
  - 240 POIs, alle med editorial_hook og area_id='sentrum'
  - 7/7 temaer med bridgeText + extendedBridgeText (NO + EN)
  - 66 featured POIs (42 med bilde, 24 uten — forventet for Entur/NSR/lekeplasser)
  - heroImage: /illustrations/stasjonskvartalet-hero.jpg
  - has_3d_addon: true

  GOTCHA OPPDAGET:
  - generate-bolig-skillen sier area_id kan settes på projects-tabellen, men
    kolonnen finnes ikke der — kun på pois. Skillen bør oppdateres.
  - Ruting er /eiendom/{customer}/{project}/rapport (ikke /{customer}/{project}/report)

---
date: 2026-04-16
action: generate-bolig-pipeline-oppgradering
files:
  - .claude/commands/generate-bolig.md (oppdatert)
branch: main
summary: >
  Oppgradert /generate-bolig-pipelinen med to nye steg: Steg 0 (innledende
  spørsmål om kildebilde + 3D-addon) og Steg 11.5 (heroImage-generering via
  Gemini stil-transfer). Også lagt til modellanbefaling (Sonnet for mekanisk
  pipeline), oppdatert QA-sjekker, referanser og gotchas.
detail: |
  BAKGRUNN:
  Wesselsløkka-rapporten har fått flere nye features (3D-kart, akvarell
  hero-illustrasjon, EditorialPull, MobilityStackCards) som /generate-bolig
  ikke visste om. Gjennomgang av worklog + rapport-kode identifiserte gaps.

  ENDRINGER I PIPELINE:

  1) STEG 0 — Innledende spørsmål (NY):
  - Spør om filsti til kildebilde for hero-illustrasjon (rendering, flyfoto)
  - Spør om 3D-karttillegg (ja/nei)
  - Begge verdier brukes senere i pipelinen

  2) STEG 3 — has_3d_addon:
  - Nytt felt i INSERT til projects-tabellen
  - Gater 3D-toggle i UnifiedMapModal og ReportOverviewMap

  3) STEG 11.5 — HeroImage-generering (NY):
  - Bruker /placy-illustrations-skillen med Mønster B (foto→akvarell)
  - Kildebilde = IMAGE 1, anchor-wesselslokka.png = IMAGE 2
  - Output: public/illustrations/{urlSlug}-hero.jpg
  - Lagrer heroImage-sti i reportConfig via PATCH
  - Viser resultat og ber om godkjenning
  - Hoppes over hvis ingen kildebilde oppgitt

  4) MODELLANBEFALING:
  - Lagt til påminnelse øverst: "bytt til Sonnet før kjøring"
  - Pipelinen er 95% mekanisk — Opus er overkill

  5) FORUTSETNINGER:
  - Lagt til GEMINI_API_KEY og Python-deps (google-genai, Pillow)

  6) QA (Steg 13):
  - Nye sjekker: HeroImage finnes + satt i config, has_3d_addon matcher

  7) OPPSUMMERING (Steg 18):
  - Inkluderer 3D-addon status og HeroImage-sti
  - Fikset tema-teller fra 6/6 til 7/7

  8) REFERANSER:
  - 8 nye linjer (placy-illustrations, Gemini, anchors, ReportHero,
    UnifiedMapModal, report-3d-config)

  9) GOTCHAS:
  - #18: heroImage lagres i reportConfig, ikke egen kolonne — merg config
  - #19: Gemini output er alltid JPEG — bruk .jpg extension
  - #20: has_3d_addon er boolean på projects-tabellen

  IKKE TATT MED (bevisst):
  - EditorialPull-sitater: Hardkodet i ReportThemeSection per nå, trenger
    design-beslutning om hvor de skal lagres (reportConfig?) før pipeline
  - MobilityStackCards: Rendres automatisk fra transport-POI-data, ingen
    pipeline-endring nødvendig
  - Opplevelser-illustrasjon: Mangler, men er engangsjobb utenfor pipeline
  - Sparkesykkel/bildeling-import: Trenger audit men ikke pipeline-endring
status: done

---
date: 2026-04-16
action: placy-illustrations-skill-og-rapport-blokker
files:
  - .claude/skills/placy-illustrations/ (NY SKILL — 8 filer)
  - components/variants/report/blocks/EditorialPull.tsx (NY)
  - components/variants/report/blocks/MobilityStackCards.tsx (NY)
  - components/variants/report/ReportThemeSection.tsx (import + wiring)
  - components/variants/report/ReportHeroInsight.tsx (erstatter MobilityCard-grid)
  - public/illustrations/hverdagsliv-humor-a.jpg (NY)
  - public/illustrations/hverdagsliv-humor-b.jpg (NY)
  - public/illustrations/trening-aktivitet-humor-a.jpg (NY)
  - public/illustrations/trening-aktivitet-humor-b.jpg (NY)
  - public/illustrations/trening-aktivitet-humor-c.jpg (NY)
  - docs/solutions/best-practices/aerial-photo-to-watercolor-model-comparison-20260415.md (NY)
branch: main
summary: >
  Tre store leveranser: (1) placy-illustrations skill — kanoniserer
  Wesselsløkka-akvarell-stilen med Gemini-pipeline. (2) EditorialPull-blokk
  for redaksjonelle sitater mellom dense seksjoner. (3) MobilityStackCards —
  scroll-drevet "deck reveal" som erstatter det generiske 4-kort-grid'et.
detail: |
  1) PLACY-ILLUSTRATIONS SKILL (.claude/skills/placy-illustrations/):
  Ny Claude Code skill som kanoniserer akvarell-stilen for alle Placy-
  illustrasjoner. Bygd fra bunnen basert på dagens læringer.

  Innhold:
  - scripts/generate.py — Gemini 3 Pro Image CLI, auto-sources .env.local
  - references/style-guide.md — palett, teknikk, komposisjon, 7-punkts QA
  - references/prompt-patterns.md — 3 beviste mønstre:
    A: ny scene fra scratch, B: foto→akvarell (stil-transfer), C: humor
  - references/humor-learnings.md — Mode C (tørr juxtaposition), bevist-sterke
    mønstre (hund-yoga visuelt rim, tempo-juxtaposition, environment humor)
  - assets/ — 3 frosne stil-ankre (playground, café, wesselsløkka-bred)

  Smoke-testet: genererte test-scene + stil-transferte marina-foto → akvarell.
  Skill registreres automatisk (placy-illustrations i skill-lista).

  5 humor-varianter commitet (parkert) + solutions-doc for modellvalg
  (Gemini vs Flux Kontext vs Replicate for flyfoto→akvarell).

  2) EDITORIALPULL (cherry-pick fra feat/report-blocks):
  Magasin-stil pull-sitat — stor serif-tekst med decorative open-quote.
  Brukes som "pust" mellom dense seksjoner. Koblet inn på hverdagsliv-
  tema med hardkodet Valentinlyst-sitat. Standalone, ingen deps.

  Props: quote (obligatorisk), attribution, tone ("plain" | "sage").

  3) MOBILITYSTACKCARDS (erstatter MobilityCard-grid):
  Scroll-drevet "deck reveal" for mobilitetskort (Bysykkel/Sparkesykkel/
  Bildeling/Elbillading). Inspirert av cards-stack-slider.uiinitiative.com.

  Iterasjoner (4 commits):
  i)   Naiv sticky-slot (h-[60vh] pr kort) → for mye tom plass, ingen overlap
  ii)  Negative margin + peek → stablet men aldri "fyrt av"
  iii) Scroll-lytter + absolute-posisjonerte kort i sticky-wrapper → ekte
       sekvensiell reveal: fired=translateY(-140%)+fade, active=full,
       waiting=translateY(depth*12px)+scale-down for peek-effekt
  iv)  Scroll-budsjett tunet fra 100vh→60vh pr kort (240vh totalt)

  Fortsatt under eksperimentering — scroll-budsjettet skaper tom plass
  under kortet. Kanskje trenger en annen tilnærming (intersection observer
  i stedet for tall container? Eller komprimere mer).

  GAMMEL MobilityCard-funksjon slettet (erstattet av ny StackCardItem-API).

  DESIGN-RETNING (fra bruker):
  - Kort i full bredde, clean bg/tekst (inspirert av dagligvare/apotek-
    kort med store tall)
  - Muted warm palett (cream/sage/peach/grey) som roterer
  - Scroll-basert reveal i stedet for statisk grid
  - "Noe en må forholde seg til mens en scroller"
status: wip

---
date: 2026-04-15
action: 3d-map-orbit-mode-zoom-off
files:
  - components/map/map-view-3d.tsx (ctrlKey-hijack + wheel-block)
  - components/map/Map3DControls.tsx (showZoom-prop)
  - components/variants/report/blocks/report-3d-config.ts (strammere altitude)
branch: feat/map-unification (worktree placy-ralph-map-unification)
summary: |
  3D-kartet i rapport-modaler skal føles som en satellitt-orbit rundt
  property, ikke et fritt eksplorativt kart. Drag rotérer rundt center
  (ikke pan), zoom er deaktivert, altitude er låst innen orbit-radien.
detail: |
  PROBLEM: Google Maps 3D Photorealistic åpnet i normal-modus med pan/zoom/
  rotate — brukere kunne dra seg langt unna property og miste ankeret.
  Ctrl+drag ga ønsket orbit-effekt, men burde være default uten modifier.

  LØSNING 1 — Orbit-som-default (ctrlKey-hijack):
  - Capture-phase pointer/mouse-listener overstyrer e.ctrlKey=true på
    mus-drags via Object.defineProperty.
  - Google's interne gesture-handler tolker da drag som ROTATE (native
    smørbløt — ingen custom rAF/flyCameraTo som tidligere hakket).
  - Touch (pointerType === 'touch') skipper — har ikke ctrlKey.

  LØSNING 2 — Deaktiver zoom helt:
  - Wheel blokkeres non-passive i capture (preventDefault + stopPropagation)
    før Google ser eventen.
  - Map3DControls fikk ny showZoom-prop (default true). MapView3D sender
    false så +/- knappene skjules. Kompass/rotér/tilt beholdes.

  LØSNING 3 — Strammere altitude:
  - minAltitude 200→150 (kan zoome tettere inn)
  - maxAltitude 3000→1200 (hindrer zoom-out som bryter orbit-ankeret)

  FALLGRUVER PRØVD OG AVVIST underveis:
  - Tight bounds (panHalfSideKm: 0.001): clamp under drag ga hakking.
  - Custom rAF orbit via flyCameraTo: hakkete (brukerens tidligere erfaring).
  - gmp-centerchange snap-back under drag: fightet Google's gesture, brøt
    rotasjon helt.
  - pointerup snap-back: ikke nødvendig — drift var kumulativ fra gamle
    eksperimenter; nå stabilt uten.

  Testet: drag rotérer rundt property, scroll/wheel ignoreres, +/- borte,
  prosjekt-markør synlig midt i framen ved load.

  PARKERT: Pinch-zoom på touch — ctrlKey-hijack treffer kun mus, så pinch
  på mobil vil zoome fortsatt. Må evt. legges til senere med touch-count
  guard eller manuell pinch-blokker.
status: done
related: commit c23a04c

---
date: 2026-04-15
action: unified-map-modal-2d-3d-toggle
files:
  - components/map/UnifiedMapModal.tsx (ny)
  - components/map/ModeToggle.tsx (ny)
  - components/variants/report/ReportThemeSection.tsx
  - components/variants/report/blocks/ReportOverviewMap.tsx
  - lib/utils/camera-map.ts (ny)
  - lib/types.ts (has3dAddon på ProjectContainer)
  - lib/supabase/queries.ts (begge loadere)
  - supabase/migrations/057_add_has_3d_addon.sql
  - docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md
branch: feat/map-unification (worktree placy-ralph-map-unification)
summary: |
  Forenet ReportThemeMap (Mapbox 2D) og Report3DMap (Google 3D) til én UnifiedMapModal med
  render-slot-mønster og 2D/3D-toggle. 3D er paid add-on (`projects.has_3d_addon`); toggle
  vises kun når flagg er true. 4-tilstands maskin håndterer WebGL-asymmetri (Mapbox
  loseContext 150ms, Google 3D GC 350ms). Kamera bevares mellom motorer via Web Mercator
  range↔zoom-konvertering.
detail: |
  KRITISK BUG fanget i Phase 5: has_3d_addon=true i DB, men toggle vises ikke. To parallelle
  Supabase-loadere — ny path manglet feltet. Fikset ved å mappe i begge + på ProjectContainer.

  POST-WORKFLOW PATCH (samme dag, commit 05a9ec8): Tema-modaler viste placeholder
  "3D-visning kommer snart" — google3dSlot returnerte <div> i stedet for MapView3D.
  Fikset med dynamic import + theme.allPOIs som POI-set. Lærdom: verifiser HVER
  consumer av en ny komponent, ikke bare den første.

  Verifisert visuelt: Wesselsløkka (add-on=true) viser toggle, Leangen (add-on=false) ikke.
  Hverdagsliv-tema rendrer 13 markører + prosjekt-pin i 3D.

  Parkert: Bead 2na.20 (eksplisitt loseContext på Google 3D), 2na.21 (webglcontextlost
  recovery med remount-key). Defensive forbedringer, ikke kritiske.
status: done
related: docs/plans/2026-04-15-feat-unified-map-modal-2d-3d-toggle-plan.md
---
date: 2026-04-15
action: google-maps-3d-touch-fixes
files:
  - components/variants/report/blocks/Report3DMap.tsx (to fix-er)
  - components/map/Map3DFallback.tsx (revert iOS-fallback)
branch: main
summary: To touch-fixes for Google Maps 3D — (1) unmount preview ved modal-åpning for å unngå WebGL-krasj på iOS, (2) pointer-events-none på preview-wrapper for pålitelig tap-to-open på alle touch devices.
detail: |
  PROBLEM: Chrome på iOS krasjet ved åpning av 3D-modal.
  ROTÅRSAK: To samtidige WebGL-kontekster (preview + modal). iOS WebKit
  tåler kun én aktiv WebGL-kontekst per side — krasjer stille ved to.

  FIX 1 — Én WebGL-kontekst:
  - {!sheetOpen && <MapView3D preview />} — preview fjernes fra DOM
    i det modal åpner, slik at kun modal-konteksten lever.
  - Gjelder alle touch devices, ikke bare iOS.

  FIX 2 — pointer-events-none på preview-wrapper:
  - Google Maps 3D (WebGL custom element) kan fange touch-events og
    blokkere knappens click-handler på touch devices.
  - pointer-events-none på wrapper-div → alle taps rutes til <button>,
    ikke til WebGL-elementet.

  REVERT: iOS-fallback til Mapbox (forrige commit) fjernet —
  problemet var kontekst-krasj, ikke iOS-inkompatibilitet.
  Google Maps 3D støtter iOS WebKit (iOS 15+) fint med én kontekst.

---
date: 2026-04-15
action: report-3d-map-apple-modal-og-mobil-touch
files:
  - components/variants/report/blocks/Report3DMap.tsx (Dialog→Sheet + UX)
  - components/map/map-view-3d.tsx (gestureHandling + touch-action)
  - app/globals.css (scrollbar-none utility)
branch: main
commit: 9209909
summary: Migrerte Report3DMap fra shadcn Dialog til Sheet (identisk Apple-style slide-up som Mapbox-kartene), fikset touch-interaksjon på mobil, og tweaket modal-layout (96vh, tabs til bottom bar, hint-tekst fjernet).
detail: |
  DIALOG→SHEET (visuell paritet med Mapbox-modalene):
  - Byttet Dialog/DialogContent/DialogTitle → Sheet/SheetContent/SheetTitle
  - Same klasser som ReportThemeSection: rounded-t-2xl, inset-x + top
  - Same slide-up animasjon: map-modal-slide-up (400ms) / map-modal-slide-down (300ms)

  MOBIL TOUCH-FIX:
  - gestureHandling={activated ? GREEDY : AUTO} på Map3D
    → én finger kan pan/rotere i modal, ingen "use two fingers"-melding
  - touch-action: none på wrapper-div + inline style på Map3D
    → nettleseren sender touch-events til WebGL-elementet i stedet for å
      fange dem som scroll
  - Google Maps 3D setter ikke touch-action selv (Mapbox gjør det)

  UX-TWEAKS:
  - Modal-høyde økt til 96vh (!top-[4vh]) — utnytter skjermen bedre
  - Tabs flyttet til bottom bar — lettere å nå med tommelen på mobil
  - Tab-rad er nå én horisontal linje med overflow-x-auto (scrollbar-none)
  - Hint-tekst "Dra horisontalt for å rotere…" fjernet (kompaktere header)

  NY UTILITY:
  - .scrollbar-none i globals.css — skjuler scrollbar på alle nettlesere

---
date: 2026-04-15
action: google-maps-3d-pan-firkant-og-prosjektmarkør
files:
  - components/map/ProjectSitePin.tsx (NY)
  - components/map/map-view-3d.tsx (panRadiusKm→panHalfSideKm, projectSite-prop)
  - components/variants/report/blocks/Report3DMap.tsx (sender projectSite)
  - components/variants/report/blocks/wesselslokka-3d-config.ts (panHalfSideKm: 1.5)
branch: feat/report-3d-map
pr: aharstad91/placy-nextjs#65
summary: To forbedringer — (1) tydeliggjør at pan-boksen alltid har vært en firkant (navnebytter til squareBoundsAround/panHalfSideKm), setter halvside til 1.5km; (2) ny prosjektmarkør-chip som flyter 30m over tomten og viser prosjektnavn + "Nybygg 2028".
detail: |
  PAN-FIRKANT:
  - radiusToBounds/panRadiusKm ga sirkel-assosiasjoner men returnerte alltid
    rektangulær south/north/west/east-boks (Googles Map3D bounds IS firkant).
  - Rename til squareBoundsAround/panHalfSideKm + oppdaterte kommentarer.
  - cos(lat)-korreksjonen er beholdt — gjør firkanten kvadratisk i meter
    (viktig på breddegrad 63° der 1° lng ≈ 50km, ikke 111km).
  - Halvside 1.5km → 3×3km totalboks rundt Wesselsløkka.
  - Større boks = kanten treffes sjeldnere i vanlig navigasjon.

  PROSJEKTMARKØR (ProjectSitePin):
  - SVG label-chip: avrundet pill-form, mørk bakgrunn (#1a1a1a).
  - Bygningsikon (manuell Lucide Building2-path), prosjektnavn i hvit bold,
    undertittel "Nybygg 2028" i gull (#e8b86d).
  - Liten pil peker ned mot tomten.
  - Rendres som Marker3D ved projectSite.lat/lng, altitude=30m
    (AltitudeMode.RELATIVE_TO_GROUND) → flyter tydelig over jordet.
  - Alltid synlig — ikke del av tab-filter.
  - projectSite-prop på MapView3DProps; Report3DMap sender mapCenter + projectName.
  - SVG text/rect fungerer i Google 3D fordi browser rasteriserer SVG til
    tekstur FØR Google prosesserer markøren.

---
date: 2026-04-15
action: google-maps-3d-rapportblokk-med-ui-kontroller
files:
  - components/map/Marker3DPin.tsx (NY)
  - components/map/map-view-3d.tsx (NY)
  - components/map/Map3DControls.tsx (NY)
  - components/map/poi-marker-3d.tsx (SLETTET — brokket for 3D)
  - components/variants/report/blocks/Report3DMap.tsx (NY)
  - components/variants/report/blocks/wesselslokka-3d-config.ts (NY)
  - components/variants/report/ReportPage.tsx
  - package.json (+@vis.gl/react-google-maps@^1.8.3)
  - docs/brainstorms/2026-04-15-report-3d-map-brainstorm.md
  - docs/plans/2026-04-15-feat-report-3d-map-plan.md
  - docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md
branch: feat/report-3d-map
pr: aharstad91/placy-nextjs#65
summary: Erstatter planlagt akvarell-TabbedAerialMap (ToS-brudd) med ekte Google Photorealistic 3D Tiles i rapporten. Pilot for Wesselsløkka. Full UX-iterasjon i én sesjon — fra naiv kamera-lock (hakket) til Google-native UX med bounds + UI-kontroller (smørbløt).
detail: |
  ARKITEKTUR:
  - Dormant preview + modal-mønster (matcher ReportThemeSection)
  - Preview: liten aspect-[4/3] kort med "Utforsk i 3D"-CTA, activated=false
  - Modal: 90vw × 88vh på desktop, bottom sheet mobil
  - Tabs-filter (Alle/Oppvekst/Mat&Drikke/Natur/Transport/Trening) i header
  - ReportMapDrawer fra venstre ved pin-klikk (gjenbruk)
  - 15 dummy-POIer rundt Wesselsløkka (ekte DB-senter 63.422074, 10.450617)
  - SSR-gated via dynamic import, ssr:false

  KAMERA-STRATEGI (iterert i sanntid):
  1. Forsøk 1: kontrollerte center/range/bounds-props + JS-snap-back
     → hakket, kjempet mot Googles interne state. FORKASTET.
  2. Forsøk 2: capture-phase event-interception (stopp Googles gestures)
     → senter-drift 0 men ga jitter ved rask drag. FORKASTET.
  3. Forsøk 3: rAF-throttlet snap-back
     → fortsatt hakking pga konkurrerende render-loops. FORKASTET.
  4. FINAL: bruk Googles native gesture-handling + bounds-props
     → butter smooth, håndheves i WebGL, ingen JS-kamp.

  GRENSER (Googles native, ingen custom logic):
  - bounds: 2km radius rundt senter (håndheves av Google)
  - minAltitude 200m, maxAltitude 3000m (zoom-grenser)
  - minTilt 15°, maxTilt 75°

  UI-KONTROLLER (flytende nederst høyre i modal):
  - Kompass (peker live med heading, klikk = snap til nord)
  - Rotér CCW/CW (45° per klikk)
  - Tilt opp/ned (15° per klikk)
  - Zoom inn/ut (1.5× per klikk)
  - Reset-knapp i header ("↺ Tilbake") fly-animerer til start
  - Alle bruker Googles flyCameraTo (400ms) — samme motor som drag

  FELLESFELLER OPPDAGET (dokumentert i solutions/):
  1. useMap3D() upålitelig utenfor Map3D-treet med flere instanser
     → prop-drill map3d via MapReadyBridge + lokal state
  2. LatLngAltitude har lat/lng som getters — {...map3d.center} sprer
     bare minifiserte interne felt (JB/KB/IB) → må kopiere eksplisitt
  3. Marker3D rasteriserer kun SVG/Pin/img, ikke HTML-portal
     → Marker3DPin bygget som inline SVG (circle + Lucide-path + badge)
  4. Ingen native minRange/maxRange → må bruke altitude-grenser i stedet
  5. minAltitude=maxAltitude=0 gir svart skjerm (kamera under bakken)
  6. Tilt-konvensjon: 0° = rett ned, 90° = horisontal (motsatt intuisjon)
  7. Map3D krever WebGL → SSR-crash uten dynamic({ssr:false})
  8. Kontroller som children i <gmp-map-3d> blir absorbert i shadow DOM
     → må være søsken til Map3D (inne i relative container)

  JURIDISK GEVINST:
  - Erstatter akvarell-pipeline som var ToS-brudd (derivative works +
    offline caching >30 dager i public/)
  - Googles Map Tiles API brukt direkte = 100% compliant
  - Attribusjon automatisk, ingen tiles caches lokalt

  KOSTNADSKONTROLL (deferred til etter validert salg):
  - Ingen quota-cap eller budget alert satt opp ennå
  - Bounds + maxAltitude begrenser tiles-lasting til nær-området
  - Worst-case: $10/mnd før alert
status: done

---
date: 2026-04-15
action: humor-i-kategori-illustrasjoner-eksperiment
files:
  - public/illustrations/hverdagsliv-humor-a.jpg
  - public/illustrations/hverdagsliv-humor-b.jpg
  - public/illustrations/trening-aktivitet-humor-a.jpg
  - public/illustrations/trening-aktivitet-humor-b.jpg
  - public/illustrations/trening-aktivitet-humor-c.jpg
  - /tmp/gen_hverdagsliv_variant_a.py
  - /tmp/gen_hverdagsliv_variant_b.py
  - /tmp/gen_trening_variant_a.py
  - /tmp/gen_trening_variant_b.py
  - /tmp/gen_trening_variant_c.py
summary: >
  Eksperimentert med å legge subtil voksenhumor (Mode C — tørr juxtaposition,
  ikke slapstick) INNE I kategori-illustrasjonene selv, ikke i captions. 5
  varianter generert via Gemini Nano Banana Pro med eksisterende Wesselsløkka-
  stil-lås. Parkert for senere — konseptet fungerer, men trenger fokusert
  sesjon for å konsolidere på tvers av alle 6 kategorier.
detail: |
  UTGANGSPUNKT:
  Brukeren ønsket å makse verdi ut av de allerede genererte kategori-
  illustrasjonene. Ikke "cheesy quotes" under bildene — humor i selve
  motivet, subtilt, "lur voksenhumor". Gemini-generering er gratis, så
  iterasjon er fritt.

  VALGT RETNING: Mode C — tørr juxtaposition
  To elementer i scenen som kommenterer hverandre uten å si det.
  Ikke to separate spøker — én joke med to synlige elementer.
  Maks 2 humor-detaljer per bilde.

  EKSPERIMENTER:
  - hverdagsliv-humor-a: "Barnet ser, forelderen scroller" — forelder med
    telefon opp, barn i vogn peker på spurv på bakken.
  - hverdagsliv-humor-b: "To fartene" — sprinter passer eldre person
    med rolator.
  - trening-aktivitet-humor-a: "De to tempoene" — jogger passer eldre
    par som går hånd-i-hånd.
  - trening-aktivitet-humor-b: "Hunden venter" — yoga-person på matte,
    hund sitter tålmodig ved siden av.
  - trening-aktivitet-humor-c: Konsoliderte iterasjonen — bygget endret
    til realistisk norsk mixed-use bygård (3 etg, gym i 1. etg), burger-
    sjappe ved siden, yoga-person i child's pose med hund i play-bow ved
    siden (hunden IMITERER posituren — visuelt rim), pluss person som
    henger i pull-up-stanga.

  LÆRDOMMER (viktige for videre arbeid):

  1. Foreground vs middle-ground — helt avgjørende.
     Første forsøk (hverdagsliv-a/b) plasserte humor-figurene foran i bildet
     — de dominerte komposisjonen og så ut som "sticker på et bakgrunnsbilde".
     Regelen som fungerte: ALLE figurer i middle-ground, samme skala som de
     andre beboerne i scenen, 8-15% av canvas-høyde. Ingen close-ups.
     Humoren skal oppdages, ikke skrikes.

  2. Bygg-realisme: norsk urban-forstad er mixed-use, ikke standalone trehus.
     Det opprinnelige trening-aktivitet-bygget var et idyllisk standalone
     trehus — ikke realistisk for norsk kontekst. Skifte til 3-etasjes
     bygård med kommersielt i 1. etg og leiligheter over = umiddelbart
     mer troverdig for brokers/kjøpere. Dette gjelder sannsynligvis også
     mat-drikke og hverdagsliv. Kan brukes som compound-læring senere.

  3. Burger-sjappa ved siden av gymmet ER humor i seg selv.
     Visuelt kodet (rødt-gult takskjerm, rundt burger-logo uten tekst).
     Lesbart som "fast food" uten å bryte no-text-regelen. Fungerer på
     miljø-nivå (environmental humor), ikke karakter-nivå.

  4. Hund-imiterer-menneske er den sterkeste enkelt-detaljen.
     Play-bow-posituren er ekte hund-gest som ser yoga-aktig ut.
     Visuelt rim mellom menneske og hund = det varmeste smilet.
     Rewards attention uten å være kryptisk.

  5. Kroppsspråk-nyanser er svakere i Gemini.
     Prompt'et "sliten pull-up person, slumpet kropp, hengende hode" —
     modellen gjorde det mer nøytralt. Subtile emosjonelle detaljer
     krever ofte re-generering eller enklere body-language-cues.

  STIL-LÅS HOLDER:
  Alle 5 varianter bevarte Wesselsløkka-akvarell-stilen, palett, og
  pure-white bakgrunn. Pipeline fra 2026-04-13 fungerer fortsatt.

  STATUS: PARKERT
  Konseptet er bevist. Trening-aktivitet-humor-c er den sterkeste
  variaten. Men dette krever fokusert sesjon for å:
  - Lande stil-konsistens på tvers av alle 6 kategorier
  - Bestemme hvilke humor-elementer som er "Placy-signaturer" vs per-bilde
  - Beslutte om vi faktisk erstatter eksisterende kategori-illustrasjoner,
    eller beholder de nåværende og har disse som "humor-varianter"
  - Eventuelt iterere trening-c for å fikse sliten-pull-up-svakheten

  Tar opp igjen når prioritert. Originale illustrasjoner (uten humor)
  forblir i bruk inntil beslutning.

status: parkert

---
date: 2026-04-15
action: natur-friluftsliv-trail-data-research
files:
  - (ingen kodeendringer — kun research/strategi)
summary: >
  Sparring om hvordan løse det tynne sti-UX-et i Natur & Friluftsliv-
  seksjonen. Konklusjon: vi trenger navngitte, kuraterte ruter —
  ikke et komplett sti-nettverk. Utsatt for nå; dokumentert for senere.
detail: |
  BAKGRUNN:
  Trail-overlay-featuren (committed 2026-04-10, branch feat/report-blocks)
  henter Overpass API-data (OSM route relations med navn), men dekning
  for lokale områder som Estenstadmarka er tynn. Session ble stoppet
  tidligere fordi UX-en føltes mangelfull.

  PROBLEMRAMMING:
  Brukeren korrigerte retningen: vi skal IKKE vise hele sti-grafen —
  vi skal vise "kjente, navngitte ruter mot meningsfulle mål"
  (f.eks. Estenstad P-plass → Estenstadhytta).

  DATAKILDER VURDERT (prioritert):
  1. Kartverket NDTF ("Tur- og friluftsruter") — WFS/WMS/GeoPackage
     via geonorge.no. Statlig kuratert, navngitte ruter, CC-BY 4.0.
     Sannsynligvis beste primærkilde for Norge.
  2. UT.no (DNT) — per-hytte-sider med tilkomstruter, GPX-nedlasting,
     tur-beskrivelser. Ingen offentlig API, men scrapable URL-er.
  3. Naturbase (Miljødirektoratet) — WFS med friluftsområder/turmål,
     koordinater men ikke rute-geometri.
  4. OSM utvidet query — relation["route"~"hiking|foot|bicycle"]["name"]
     = det vi har i dag.
  5. Strava Heatmap — tilleggslag for popularitet, ikke primærkilde.

  FORESLÅTT DATAMODELL (ikke implementert):
  interface NamedRoute {
    id, name, routeType, distanceKm, duration, difficulty,
    startPoint{lat,lng,name}, endPoint{lat,lng,name},
    geometry: GeoJSON.LineString,
    externalUrl?, editorialHook?,
    source: "kartverket" | "ut.no" | "manual"
  }
  Lagres som `reportConfig.namedRoutes[]` — ikke `trails`.

  UX-RETNING (for senere):
  - 3-8 navngitte ruter per prosjekt, ikke tett sti-graf
  - Labels alltid synlige (ikke bare hover)
  - Startpunkt-pin + klikk åpner drawer med tur-beskrivelse
  - "Åpne i ut.no"-knapp hvis rute har ekstern URL

  STATUS:
  Utsatt. For komplisert for å ta nå — trenger dedikert planning-sesjon
  (/brainstorm → /plan) før implementasjon. Denne læringen står i worklog
  så vi har konteksten når vi plukker det opp igjen.

status: parkert

---
date: 2026-04-15
action: tabbed-aerial-map-med-akvarell-pipeline
files:
  - components/variants/report/blocks/TabbedAerialMap.tsx
  - components/variants/report/ReportPage.tsx
  - public/illustrations/wesselslokka-{nord,ost,vest,sor}.png
  - .env.local (la til GEMINI_API_KEY og REPLICATE_API_TOKEN)
summary: >
  Bygd ny TabbedAerialMap-komponent: akvarell-illustrasjon med tabs per
  kategori, 4-retnings kompass (N/Ø/S/V), modal med zoom + sidebar drawer,
  cursor-endrings-hover på kantene for retningsbytte. Testet ulike
  bildegenererings-modeller for style transfer.
detail: |
  KOMPONENT-ARKITEKTUR (TabbedAerialMap):
  - Preview: akvarell + små markører + gradient + CTA "Utforsk illustrasjonen"
  - Modal (90vw/85vh): zoomable canvas, tabs, kompass via kant-hover, drawer
  - Markører: klikkbare, åpner ReportMapDrawer (hvis full POI) eller
    lettvekts MarkerDrawer (for dummy/enkle markører)
  - 7 kategorier som tabs: Alle/Oppvekst/Mat&Drikke/Natur/Transport/Trening
  - Retnings-bytte via hover-soner (60px) på alle 4 kanter med pil + label
    og cursor-change (w-resize, e-resize, etc.) — erstattet diskrete N/Ø/S/V-
    knapper etter UX-feedback
  - Crossfade mellom 4 retningsbilder ved direction-bytte
  - Drawer lukkes automatisk ved tab-bytte
  - Zoom begrenset til 1.5x pga. bildeoppløsningscap

  AKSEPTANSEKRITERIER TESTET (via Chrome DevTools MCP):
  AC1 Preview vises — OK
  AC2 Klikk åpner modal — OK
  AC3 Tabs switcher markører (Alle=15, Oppvekst=4, etc.) — OK
  AC4 Klikk markør → sidebar drawer — OK
  AC5 Klikk samme marker lukker drawer — OK
  AC6 Tab-bytte lukker drawer — OK
  AC7 Kompass/kant-hover bytter retning — OK

  AI-BILDEGENERERING — UNDERSØKELSE:
  Testet pipeline for å gjøre Google Maps 3D-screenshots → akvarell:

  1. Gemini 2.5 Flash Image (gratis) — BEST på layout-bevaring + stil,
     men hard cap på ~1344x768. Varierende konsistens mellom kjøringer.
     Generert 4 retninger (nord/ost/vest/sor) som nå brukes i komponenten.

  2. Gemini 3 Pro Image (standard API) — Same ~1376x768 cap. Ville fått
     4K-output via Vertex AI, men krever gcloud-setup + GCP-prosjekt.

  3. Flux Kontext Pro (Replicate) — Fullstendig mislykket. Laget et helt
     annet landskap, mistet layout-gjenkjenning komplett. Ikke brukbar.

  4. Replicate (fofr/style-transfer, ControlNet) — Krever betalingsmetode
     etter Flux-test (brukte opp gratis-kvote).

  RESEARCH-KONKLUSJON (for fremtiden):
  - #1: Gemini 3 Pro Image via Vertex AI — native 4K, $0.24/bilde
  - #2: Recraft V3 img2img — urban_sketching-stil + Creative Upscale, $0.29
  - #3: FLUX.2 [flex] — multi-referanse, 4MP, $0.12
  - Upscaling-alternativ: Real-ESRGAN ($0.002) eller Recraft Crisp ($0.004)

  UTSATT TIL SENERE:
  - Vertex AI-setup for 4K-output (gcloud install + GCP-prosjekt + billing)
  - Replicate billing + test av Recraft V3 / fofr/style-transfer
  - Ekte POI-kobling for markører (nå er det dummy-data)
  - Markør-posisjoner per retning (perspektiv endres ved rotasjon)

  Alt arbeid på feat/report-blocks-worktree. Gemini API og Replicate token
  lagt til .env.local (billing mangler på Replicate for å kjøre flere tester).

---
date: 2026-04-14
action: rapport-v2-blokk-bibliotek
files:
  - components/variants/report/blocks/BentoShowcase.tsx
  - components/variants/report/blocks/FeatureCarousel.tsx
  - components/variants/report/blocks/StatRow.tsx
  - components/variants/report/blocks/TimelineRow.tsx
  - components/variants/report/blocks/EditorialPull.tsx
  - components/variants/report/blocks/SplitFeature.tsx
  - components/variants/report/blocks/AnnotatedMap.tsx
  - components/variants/report/blocks/hverdagsliv-bento.ts
  - components/variants/report/blocks/matdrikke-carousel.ts
  - components/variants/report/blocks/transport-stats.ts
  - components/variants/report/blocks/barn-timeline.ts
  - components/variants/report/blocks/natur-annotated.ts
  - components/variants/report/ReportThemeSection.tsx
summary: >
  Syv blokk-typer for rikere kategori-presentasjon i rapport v2. Pilotert
  på Wesselsløkka. Alle 7 kategorier har nå dedikert blokk-komposisjon.
  Arbeidet er på feat/report-blocks-branch i worktree.
detail: |
  BLOKK-BIBLIOTEK (7 typer):
  
  Kort-baserte (4):
  1. BentoShowcase — Apple-bento, zoom-in på ETT subjekt (Valentinlyst Senter)
     Rendyrket etter scanability-feedback: alle celler handler om senteret.
     Hero 2×2 med Nettside/Utforsk-knapper + tenant-celler + "og mer"-pills.
  2. FeatureCarousel — Horisontal scroll, uniforme kort. Mat & Drikke (10 POIer).
     Snap-x, piler, bleed ut av 800px-kolonne. Google Places-bilder.
  3. StatRow — Punchy tall-kort. Transport med live Entur/GBFS-data
     (neste buss, bysykkel, sparkesykler, bildeling) + reisetidsberegninger
     til Trondheim-ankere (sentrum, Leangen, Værnes, Trondheim S).
  4. TimelineRow — Sekvensiell progresjon. Barn & Aktivitet skoleløp
     (barneskole → ungdomsskole → VGS) med node-ikoner + forbindelseslinje.
  
  Ikke-kort-baserte (3):
  5. EditorialPull — Magasin-sitat. Serif-typografi, dekorativt åpningsglyph.
     Brukes som "pust" mellom tunge seksjoner.
  6. SplitFeature — 50/50 diptyk. Tekst venstre + illustrasjon høyre.
     Break-out fra 800px-kolonne. Trening & Aktivitet.
  7. AnnotatedMap — Illustrert atlas. Nummererte callouts over akvarell-
     illustrasjon + ordered-list under. Natur & Friluftsliv.
  
  VIKTIG DESIGNPRINSIPP (oppdaget under arbeidet):
  "Én blokk = én narrativ enhet." Bento fungerer fordi alle celler
  handler om Valentinlyst. Da vi blandet 3 subjekter i én bento
  (senter + standalone POIer + horisont) ble det vanskelig å skanne.
  
  NESTE UTFORSKNINGSRETNING — AnnotatedMap med 3D-flyfoto:
  Google Maps 3D-screenshot som komposisjonsreferanse → Gemini
  transformerer til akvarell-illustrasjon → Placy-estetikk bevares,
  geografisk nøyaktighet sikres, opphavsrettproblemer unngås.
  Pipeline: 3D-screenshot → Gemini (stilreferanse: Placy akvarell)
  → illustrert flyfoto → AnnotatedMap med callouts.
  Topografi (bakker, trær, bygninger) bevares i illustrasjonen.
  Skalerbart: kan automatiseres for ethvert prosjekt.
  
  TEKNISKE LØSNINGER:
  - Walk-time: haversine × 1.3 road-factor @ 83m/min (matcher ReportHeroInsight)
  - Live transport-data: transportDashboard hook gjenbrukt
  - Banner-illustrasjon suppresses for themes med custom block
  - Child-POIs flattening for Valentinlyst-tenanter
  - minutesUntil(iso) erstatter formatRelativeDepartureTime for value/unit-split
  - Flybussen-hastighet (50 km/h) vs urban buss (18 km/h) for Værnes
  
  GÅR IKKE VIDERE MED (bevisste valg):
  - Duplikat-rydding: ReportHeroInsight vises fortsatt under blokkene
    → tas i generaliseringspasset
  - Opplevelser: eneste kategori uten dedikert blokk → bruker carousel
  - AnnotatedMap posisjoner: hardkodet per-prosjekt → auto-projeksjon
    fra lat/lng krever mer arbeid
  - Blokk-config-generalisering: conditions er hardkodet i
    ReportThemeSection → flyttes til report-data.ts
status: done

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
date: 2026-04-16
action: feat
branch: feat/transit-dashboard-card
files:
  - lib/hooks/useTransportDashboard.ts
  - components/variants/report/blocks/TransitDashboardCard.tsx
  - components/variants/report/ReportHeroInsight.tsx
summary: TransitDashboardCard — multi-stopp kollektiv med tabs og accordion
detail: |
  Erstatter TransportDashboard (1 stopp, flat 2-kol grid) med ny komponent.
  Rotårsak: selectTransportSources() hadde slice(0,1) — kun 1 stopp alltid.
  Nytt: per-kategori (Buss/Trikk/Tog), 5-min radius, maks 5 stopp, tabs ved
  2+ kategorier, accordion per holdeplass (alle kollapset som default).
  Tech Audit fanget 4 reelle feil før kodeskriving — alle fikset.
  DepartureBlock + StaticTransportList (~150 linjer) slettet.
  0 TS-feil, 0 lint-feil, 200 HTTP.
status: done
related: docs/plans/2026-04-16-feat-transit-dashboard-card-plan.md
---
date: 2026-04-17
action: feat
files:
  - supabase (projects/pois/product_pois/product_categories/translations)
  - public/illustrations/overvik-hero.jpg
summary: /generate-bolig for Overvik — full regenerering av Fredensborg Bolig-prosjekt
detail: |
  Kjørte /generate-bolig https://overvik.no/ som full regenerering (eksisterte fra
  feb med legacy 6-tema-config). Resultat: 77 POI-er fra 6 kilder (Google 19, NSR 3,
  Barnehagefakta 14, OSM 12, Entur 4, lekeplass/park/andre 25).

  Nøkkelpunkter:
  - Skolekrets-filtrering (Ranheim Vest) reduserte 12 NSR-skoler → 3 (Ranheim
    barneskole 1-7, Charlottenlund u.skole 8-10, Charlottenlund VGS)
  - Overpass API feilet (504/429 alle 3 mirrors) — fallback brukte eksisterende
    OSM idrett-POIs fra DB med name+coords-dedup
  - Pois-tabellen manglet unique constraints på nsr_id/barnehagefakta_id/osm_id —
    måtte bruke SELECT-then-INSERT i stedet for ON CONFLICT
  - LLM-kvalitetspass (5a) fjernet 5 (2 bar-POIs >15min, Impulse gym >18min,
    Rotvollfjæra >15min, MT Byggteknikk mismatch). 5b fjernet 2 duplikater.
  - Rapport-tekster via /generate-rapport: 3 motiver (fjord+marka, kvarter til
    tog, etablert tettsted). 7 bridgeText + 7 extendedBridgeText + 7 readMoreQuery.
    Alle S&J-regler passerte mekanisk sjekk (0 violations).
  - Hero-illustrasjon via Gemini stil-transfer (Mønster B) — terrassebilde
    konvertert til Wesselsløkka-akvarell med fjord/buildings/figurer.

  Kjent begrensning: Opplevelser-temaet rendres ikke i UI fordi travelTime.walk
  ikke er SSR-populert (gjelder også Stasjonskvartalet). Tekstene er lagret.

  URL: http://localhost:3000/eiendom/fredensborg-bolig/overvik/rapport
status: done
---
