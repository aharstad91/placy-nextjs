# Worklog

<!-- Each entry is a YAML block. Most recent first. -->

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
