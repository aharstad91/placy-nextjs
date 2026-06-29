# PRD 12 — Self-serve admin

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Phase 1 har ingen blokkerende åpne spørsmål; ambisjons-avgrensningen i §10 Q1 er ratifisert til Beslutning 1.)
> **Lag (byggrekkefølge):** Lag 4 (admin + media + overflate) — blad-node, ingen nedstrøms-PRD blokkeres av denne (`00-INDEX` linje 59).
> **PRD-nr:** 12 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-self-serve-admin`
> **Kontekst:** Lag-4-PRD. Eier det **minimale admin-SKALLET** rundt tier-modellen, den kanoniske provisjonerings-INNGANGEN (operatør-trigger som kaller PRD 3s pipeline-kjerne), og `middleware.ts` (routing/locale/admin-guard — foldet hit per `00-INDEX` linje 76 og `CARRY-OVER-MANIFEST.md` linje 751). Denne PRD-en eier IKKE pipeline-logikken (PRD 3), tier-DEKLARASJONEN/validatoren (PRD 2), eller datamodellen (PRD 1) — den er operatør-flaten over dem. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt`, og faktisk admin-kode (`app/admin/*`, `app/api/admin/*`, `middleware.ts`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **operatør-flaten** i rebuilden: det tynne admin-skallet en produkteier (Andreas/team) bruker for å se, sette og trigge — IKKE produsere — board. Tre konkrete jobber:

1. **Tier-modell-admin (tynn flate over PRD 2).** I dag finnes INGEN `reportTier`-setter i admin-UI (verifisert: `reportTier` settes KUN via CLI-provision-pipeline gjennom `buildReportConfig`, som skriver det i `products.config` JSONB — `lib/pipeline/create-report-project.ts:71,169`). Den eneste tier-relaterte admin-kontrollen er 3D-addon-toggelen (`project-detail-client.tsx:425-446` bundet til `project.has_3d_addon` via server-action `updateProjectHas3dAddon`, `app/admin/projects/[id]/page.tsx:817-834`). Denne PRD-en bygger en tynn `reportTier`-flate (1|2) som skriver `products.config` og validerer mot PRD 2s lette nivå-2-readiness-sjekk (§5.3 — er kuratert editorial til stede?) før skriving. (To-nivå-modell 2026-06-27, INDEX note #8: `TIER_CAPABILITIES`-matrisen finnes ikke lenger.)

2. **Kanonisk provisjonerings-INNGANG.** Det finnes tre konkurrerende provisjon-innganger i dag (se §4.3-gotcha): legacy `/api/generate` (DØD, referert av ingenting), `generate-client` → `/api/story-writer` (scroll-story, `writeStoryStructure` dead per manifest linje 447), og den kanoniske self-serve `/api/generation-requests` (lager Explorer, ikke report — PRD 3 fikser). Denne PRD-en eier admin-INNGANGEN (UI/route/server-action) som TRIGGER PRD 3s ÉN report-pipeline, og re-peker «Generator»-knappen vekk fra `story-writer`.

3. **Trim dødt admin.** Trips/stories/knowledge/editorial-sidene er droppede produkter eller forlatte systemer (manifest linje 7, 674, 675, 701). Denne PRD-en sletter dem og trimmer `NAV_ITEMS` (verifisert: `admin-sidebar.tsx:23-34` lister fortsatt Trips + Kunnskap, begge dead) til keeper-settet.

> **Styrende prinsipp (eier-direktiv 2026-06-27, viktigst — Beslutning 11): admin skal være AGGRESSIVT strippet.** Bedre å bygge funksjonalitet man savner senere enn å dra med gammelt deprecated. Default ved tvil = slett/utelat, ikke behold «i tilfelle». Ny admin-funksjonalitet legges til kun ved konkret behov, aldri spekulativt. Dette overstyrer enhver fristelse til å port'e tvilsom admin-kode «for sikkerhets skyld».

**Tilgangs-realitet (load-bearing for scope):** Den ENESTE admin-tilgangskontrollen i dag er `process.env.ADMIN_ENABLED === "true"`, sjekket per-page/per-route på 23 steder (verifisert grep: **15 admin-sider + 8 admin-API-ruter**). Av de 15 sidene er flere dead og slettes i Unit 7 (trips, stories, story, knowledge, editorial), så keeper-siden-tallet er lavere; men `requireAdmin()`-konsolideringen (Unit 1 AC3) må enumerere ALLE 23 gate-steder før de keeper-bevarte beholder helperen og de dead slettes. Det finnes INGEN per-bruker auth, session, passord eller cookie noe sted i admin eller middleware. Middlewares `/admin`-branch er en REN passthrough (`middleware.ts:112-113`, `NextResponse.next()`), IKKE en guard. «Self-serve» i full betydning (kunde logger inn og provisjonerer eget board) krever en auth/tenant-modell som ikke eksisterer. Denne PRD-en avgrenser «self-serve» til (a) den allerede-publike adresse→board-formen (`generation_requests`, ingen auth) + (b) `ADMIN_ENABLED`-gated operatør-admin. Ekte kunde-innlogget admin er deferred (se §6 + §10 Q1).

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Ett konsistent admin-SKALL (layout/sidebar/secondary-nav) uten Mapbox-2D-kobling, der hver flate er `ADMIN_ENABLED`-gated og `noindex`. | Skall-port + gate-helper (Unit 1). |
| **G2** | `middleware.ts` portet med bevart legacy-SEO-routing + et eksplisitt, dokumentert admin-guard-valg (ikke en stille passthrough som leses som guard). | Middleware-port (Unit 2). |
| **G3** | En tynn `reportTier`-setter (1\|2) som skriver `products.config` JSONB og validerer mot PRD 2s lette nivå-2-readiness-sjekk FØR skriving — admin-flaten tier-modellen manglet helt. | Tier-flate (Unit 3). |
| **G4** | 3D-addon som operatør-tilstand (manuell toggle bevart, koblet til PRD 3s `has_3d_addon`-skrivepath), med varig kjøps-kilde eksplisitt deferred. | Addon-flate (Unit 3) + Beslutning 6. |
| **G5** | Én kanonisk provisjon-inngang i admin som TRIGGER PRD 3s report-pipeline-kjerne; legacy `story-writer`/`generate`-banene slettet. | Provisjon-inngang (Unit 4) + retry-trigger (Unit 5). |
| **G6** | Keeper-admin-sidene (customers/projects/requests/pois/categories) portet, re-typet mot PRD 1, med arkitektur-regler håndhevet (server-fetch, error-handling, `next/image`, metadata). | Keeper-admin-port (Unit 6). |
| **G7** | Alt dødt admin (trips/stories/knowledge/editorial + import-stub/orphan + legacy provisjon-ruter) slettet — ingen dead code i kontekst. | Dead-admin-sletting (Unit 7). |

---

## 3. Arkitektur-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *operatør-laget*, helt på toppen: admin er en flate som leser/skriver den delte datamodellen (PRD 1) og trigger den delte pipelinen (PRD 3). Den forker ALDRI per tier — den SETTER tier-data (`reportTier` i `products.config`, `has_3d_addon` på project) som PRD 2s validator avgjør dekningen av. Render-laget gater ALDRI på `reportTier` (`00-INDEX` linje 85); admin endrer kun deklarasjonen, aldri en render-bryter (det finnes ingen).

| Lag | Eierskap | Admin (denne PRD) sin rolle |
|-----|----------|------------------------------|
| Datamodell (`customers`/`projects`/`products`/`generation_requests`) | PRD 1 | Leser/skriver via server-wrappere; eier ikke skjema |
| Tier-modell + lett nivå-2-readiness-sjekk (`validateReportTier`; ingen `TIER_CAPABILITIES`-matrise — to-nivå 2026-06-27) | PRD 2 | Setter tier-felt (1\|2); bruker readiness-sjekken som forhåndsvisning; eier ikke deklarasjonen |
| Provisjon-pipeline-kjerne (`lib/pipeline/provision.ts`) | PRD 3 | Admin-inngang TRIGGER kjernen; eier ikke logikken |
| Trust/Google/foto-triggere (`/api/admin/trust-validate`/`fetch-photos`/`import`) | PRD 4 | Admin-knapper kaller dem; eier ikke heuristikken |
| Manuell cache-purge (`/api/admin/revalidate`, `ADMIN_ENABLED`-gated) | **PRD 12** (kontroll 2026-06-27) | EIES her (deler auth-mønster med `app/api/admin/*`); secret-gated build-hook `/api/revalidate` → PRD 7 |
| Moat-curation-admin (`/admin/public`, areas-editorial) | PRD 8 | Utenfor denne PRD-ens minimal-scope (se §6) |

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument | Hva den konsumerer |
|-----------|--------------------|
| **(ingen nedstrøms-PRD)** | Lag-4 blad-node. Ingen PRD i `00-INDEX` deklarerer deps på 12. Admin er operatør-flaten, ikke en kontraktskilde for andre PRD-er. |
| Operatør (Andreas/team) | Tier-/addon-setting, provisjon-trigger, request-tracking, keeper-CRUD. |
| Public self-serve-bruker (megler) | Den publike `generer`-formen (eies av PRD 3 Unit 8; denne PRD-en eier kun operatør-trigger — se §6 + §10 Q2). |

---

## 4. Eksisterende kodebase

### 4.1 Bæres over (keeper-core / port-with-rewrite)

| Fil (@/-sti) | Verdict | Rolle | Ref |
|--------------|---------|-------|-----|
| `middleware.ts` | port-with-rewrite | Legacy URL-routing + 301-redirects (`/for/*`→`/eiendom/*`, `/generer`→`/eiendom/generer`, KNOWN_CUSTOMERS). `/admin`-branch er ren passthrough (IKKE guard). | `middleware.ts:35,47-99,101-107,120-157,162-165`; manifest linje 670, 751 |
| `app/admin/layout.tsx` | port-with-rewrite | Admin-skall (AdminSidebar + main offset). Injiserer ekstern Mapbox-CSS via raw `<link>` til `api.mapbox.com` — DROP ved port (CSP-konsern + binder admin til Mapbox-2D, manifest linje 7). | `app/admin/layout.tsx:6,15-18,19-22,24` |
| `app/admin/page.tsx` | port-with-rewrite | Dashboard. Kanonisk `ADMIN_ENABLED`-gate-mønster (`:60`). Server-component, parallelle counts. | `app/admin/page.tsx:60-62,83-89,201-208` |
| `components/admin/admin-sidebar.tsx` | port-with-rewrite | Primær-nav. `NAV_ITEMS`-arrayet (deklarert `:23`, lukket `:34`, 10 entries) inkluderer DEAD Trips-entry (`:28`) + Kunnskap-entry (`:29`) → trim til keeper-sett. Inneholder OGSÅ «Offentlige sider»-entry (`/admin/public`, `:27`) som fjernes fra nav men ikke slettes (defer PRD 8, se Unit 1 AC2). Linje-anker er volatile — bruk symbol-referanse (Trips-/Kunnskap-/Offentlige sider-entry i `NAV_ITEMS`) ved implementasjon. | `admin-sidebar.tsx:23-34,27,28,29` |
| `components/admin/admin-secondary-nav.tsx` | port-with-rewrite | Generisk responsiv secondary-nav-drawer (`AdminSecondaryNav` + `SecondaryNavTrigger`). Tier-/produkt-agnostisk skall-primitiv. | `admin-secondary-nav.tsx:12,60` |
| `app/admin/projects/[id]/page.tsx` + `project-detail-client.tsx` | port-with-rewrite | Tier-modell-admin-flaten i dag: `updateProjectHas3dAddon` server-action (`page.tsx:817-834`) + 3D-toggle (`client.tsx:425-446`). Gate `page.tsx:91`. Trim til keeper-tabs. | `page.tsx:91-93,124,817-834`; `client.tsx:425-446` |
| `app/admin/projects/[id]/import-tab.tsx` | port-with-rewrite | DEN reelle in-project import-UI (rendret `project-detail-client.tsx:216`). Eneste import-vei etter konsolidering. | `import-tab.tsx:148`; manifest linje 673 |
| `app/admin/projects/page.tsx` + `projects-admin-client.tsx` | port-with-rewrite | Prosjekt-liste. Gate `:11`/`:241`. Keeper — kjerne-operatør-flate. | `projects/page.tsx:11,241` |
| `app/admin/customers/page.tsx` + `customers-admin-client.tsx` | port-with-rewrite | Kunde-admin. Gate `:7`/`:114`. Keeper — tenant-data er infra. | `customers/page.tsx:7,114`; manifest linje 611-612 |
| `app/admin/requests/page.tsx` + `requests-admin-client.tsx` | port-with-rewrite | `generation_requests`-liste. `force-dynamic` (`:5`), gate (`:8`), har `metadata` (`:32`). Viser status + retry. | `requests/page.tsx:5,8,32-34`; `requests-admin-client.tsx:4,32,86-122` |
| `app/admin/pois/page.tsx` + `poi-admin-client.tsx` | port-with-rewrite | POI-admin. Gate `:12`, `force-dynamic`. Keeper. | `pois/page.tsx:9,12`; manifest linje 597 |
| `app/admin/categories/page.tsx` + `categories-admin-client.tsx` | port-with-rewrite | Kategori-admin. Gate `:7`/`:103`. Keeper — kategori-data er infra. | `categories/page.tsx:7,103`; manifest linje 611 |
| `app/admin/generate/page.tsx` + `generate-client.tsx` | port-with-rewrite | Legacy bulk-gen-UI (TREDJE Mapbox-radius-UI, `generate-client.tsx:4` `react-map-gl/mapbox`). POSTer til `/api/story-writer` (`:164`). Port til kanonisk provisjon-inngang; DROP Mapbox. | `generate/page.tsx:5-8,12,28`; manifest linje 605, 607-609 |
| `app/api/admin/retry-request/route.ts` | keeper-core | Retry for failed `generation_requests`. Gate `:7`. UUID-validerer, setter `status='pending'` WHERE `failed`. Re-armer pipelinen. | `retry-request/route.ts:7,27-35` |
| `app/api/admin/projects/[id]/route.ts` | keeper-core | PATCH for prosjekt-edits (`discovery_circles`). Gate `:27`, Zod-validert, Norge-bounds. Ren mønster-kandidat for tier/addon-PATCH. | `projects/[id]/route.ts:18-20,27` |
| `app/api/admin/import/route.ts` | port-with-rewrite | POI-import-API (Google + offentlig). Gate `:323`. Backer import-tab. Kanonisk import-trigger. | `import/route.ts:323` |
| `app/api/admin/revalidate/route.ts` | keeper-core | `ADMIN_ENABLED`-gated manuell cache-purge. **PRD 12-eid (kontroll 2026-06-27)** — deler auth-mønster/livssyklus med `app/api/admin/*` (flyttet hit fra §4.2). Den secret-gated build-hooken `/api/revalidate` (egen rute, IKKE under `app/api/admin/`) eies av PRD 7. Portes i Unit 6 med `requireAdmin()`-gate. | `revalidate/route.ts:8`; `00-INDEX` linje 75 |

### 4.2 Referanse-only (admin-trigger; logikk eies av annen PRD)

| Fil (@/-sti) | Eier-PRD | Rolle (admin-trigger) | Ref |
|--------------|----------|------------------------|-----|
| `scripts/provision-rapport.ts` + `lib/pipeline/create-report-project.ts` | PRD 3 | Pipeline-kjernen admin-inngangen kaller (`provision.ts` extraheres i PRD 3 Unit 1, kallbar uten TTY `03:189`). Admin eier ikke logikken. | `provision-rapport.ts:399,415`; `create-report-project.ts:49,71,169,217`; `03:184,189` |
| `app/api/admin/trust-validate/route.ts` | PRD 4 | Trust-validate-trigger. Gate `:57`. | `trust-validate/route.ts:57` |
| `app/api/admin/trust-validate/update/route.ts` | PRD 4 | Trust-update-companion til trust-validate (skriver trust-vurdering). Gate `:31`. | `trust-validate/update/route.ts:31` |
| `app/api/admin/fetch-photos/route.ts` | PRD 4 | Foto-fetch-trigger. Gate `:5`. | `fetch-photos/route.ts:5` |
| `app/admin/projects/[id]/discovery-circles-editor.tsx` | (mønsterverdi) | Discovery-circles-editor; `discovery_circles` settes via PATCH-route. Mønsterverdi for tema-soner (PRD 8). | manifest linje 675 |
| `app/admin/public/page.tsx` | PRD 8 | Offentlige-sider/areas-admin. Gate `:18`. Moat-adjacent — defer til PRD 8 (se §6 + §10 Q4). | `public/page.tsx:18,58` |
| `app/(public)/generer/page.tsx` + `app/eiendom/(tools)/generer/page.tsx` | PRD 3 (Unit 8) | Publike self-serve-former; konsolideres til ÉN adaptiv form i PRD 3 (`03:267`). Admin eier operatør-trigger, ikke public-form (§10 Q2). | `03:267` |

### 4.3 Slettes (dead)

| Fil (@/-sti) | Begrunnelse | Ref |
|--------------|-------------|-----|
| `app/api/generate/route.ts` | Legacy Story Generator-API; skriver `data/projects/*.json` `productType:'explorer'`. Grep-verifisert: referert av INGENTING. Superseded av PRD 3-pipeline. | `generate/route.ts:1-5,110,138-139` |
| `app/api/story-writer/route.ts` | Genererer scroll-story fra Supabase via `writeStoryStructure` (dead, manifest linje 447). Re-pek `generate-client` til kanonisk inngang, så slett. | `story-writer/route.ts:1-6,14`; manifest linje 447, 621-623 |
| `app/admin/import/page.tsx` | Stub: `redirect('/admin/projects')`. Ikke en faktisk import-side. | `import/page.tsx:3-4` |
| `app/admin/import/import-client.tsx` | Orphan/dead — kun self-ref (import/page redirecter bort). DUPLIKAT-TRIPPEL (manifest linje 605). Reell import = `import-tab.tsx`. | `import-client.tsx:135`; manifest linje 605 |
| `app/admin/trips/*` (page, client, `[id]/page`, `[id]/trip-editor-client`) + `app/admin/projects/[id]/trips-tab.tsx` | Trip/Guide-produkt DROPPET (manifest linje 7, 674, ~2600 LOC). | manifest linje 674 |
| `app/admin/stories/page.tsx` | «Kommer snart»-stub (scroll-rapport droppet, manifest linje 7). | `stories/page.tsx:18` |
| `app/admin/projects/[id]/story/page.tsx` + `story-editor-client.tsx` | Story-editor (scroll-modell droppet). | `story/page.tsx:8`; manifest linje 675 |
| `app/admin/knowledge/page.tsx` + `knowledge-admin-client.tsx` + `app/api/admin/knowledge/route.ts` | Forlatt `place_knowledge`-editorial-UI (297 LOC, manifest linje 701, 734). SKJEMA+DATA er keeper-IP (PRD 1/8); KOMPONENTEN er dead — moat-curation rebuildes mot `areas` i PRD 8. | `knowledge/page.tsx:7`; `api/admin/knowledge/route.ts:12`; manifest linje 701, 734 |
| `app/admin/editorial/page.tsx` | «Kommer snart»-stub (manifest linje 701). | `editorial/page.tsx:18` |

> **Gotcha — tre konkurrerende provisjon-innganger (ikke forveksle):** (a) `/api/generate` = DØD (skriver JSON-fil, referert av ingenting); (b) `generate-client` POSTer til `/api/story-writer` = scroll-story (`writeStoryStructure` dead); (c) `/api/generation-requests` = KANONISK self-serve, men lager Explorer (PRD 3 fikser). Re-pek admin «Generator» til PRD 3-kjernen, slett (a) + (b).

---

## 5. Datakontrakt / Skjema

### 5.1 Felt admin LESER/SKRIVER (eier IKKE — PRD 1 definerer)

Alle kolonner verifisert mot `prod-schema-snapshot.txt`.

| Tabell.felt | Type (snapshot) | Admin-operasjon | Verifikasjon |
|-------------|------------------|-----------------|--------------|
| `customers` (id, name) | 3 kol | les/skriv (kunde-CRUD) | snapshot; manifest linje 611-612 |
| `projects.has_3d_addon` | boolean NOT NULL (snapshot linje 184) | SKRIV (addon-toggle) | `page.tsx:829`; `01` datakontrakt |
| `projects` (short_id, default_product, discovery_circles, venue_context, theme) | 22 kol | les/skriv (prosjekt-CRUD + PATCH) | `projects/[id]/route.ts`; snapshot |
| `products.config` (`reportConfig.reportTier`) | jsonb NOT NULL (snapshot linje 138) | SKRIV via read-modify-write (tier-setter — NY flate) | `01`/`02`; `create-report-project.ts:71` |
| `generation_requests` (id, address, address_normalized, email, housing_type, status, geocoded_lat, geocoded_lng, geocoded_city, address_slug, project_id, result_url, error_message, consent_given, created_at, updated_at, completed_at, customer_id) | 18 kol (snapshot linje 41-58) | les (request-liste, alle 18) + skriv `status='pending'`/`error_message=null`/`updated_at` (retry) | `requests-admin-client.tsx:86-122`; `retry-request/route.ts:27-35` |
| `categories`, `pois`, `product_*` | div | les/skriv (admin-CRUD) | snapshot |

### 5.2 Symboler admin KONSUMERER (eies av andre PRD-er)

| Symbol | Eier-PRD | Verifikasjon |
|--------|----------|--------------|
| Lett nivå-2-readiness-sjekk (PRD 2 §5.3; `TIER_CAPABILITIES`-matrisen er fjernet, to-nivå 2026-06-27) | PRD 2 | tier-setter viser readiness-funn som forhåndsvisning FØR skriving |
| `validateReportTier(project)` → `ReportTierFinding[]` (ren funksjon, funn=data) | PRD 2 (02:142) | admin viser funn som forhåndsvisning |
| `ReportTier` / `OptionalReportTierSchema` (Zod) | PRD 2 (02:75) | parse/validér tier-input før config-skriving |
| `ReportConfig.reportTier?: 1\|2` (i `products.config` JSONB) | PRD 1 (`@/lib/types.ts:473`) | feltet tier-setteren read-modify-writer |
| `lib/pipeline/provision.ts` (kjerne, kallbar fra server-action) | PRD 3 (03:184,189) | provisjon-inngangen TRIGGER den |
| `createServerClient` / `createPublicClient` (`@/lib/supabase`) | PRD 1 | all admin data-tilgang går via disse |
| `DbGenerationRequest` (`@/lib/supabase/types`) | PRD 1 | request-liste-typing |

### 5.3 Tier-setter write-path (NY — verifisert at den ikke finnes i dag)

`reportTier` bor i `products.config` JSONB (`@/lib/types.ts:473`: legacy-typen var `reportTier?: 1|2|3`, re-derives til `1|2` i v2 per PRD 1/2), IKKE en `projects`-kolonne. Settes i dag KUN av `buildReportConfig` i pipelinen (`create-report-project.ts:71,169`) — det finnes INGEN admin-setter. Konsekvens for Unit 3: tier-setting krever **read-modify-write** av `products.config` (les eksisterende config, sett `reportConfig.reportTier`, skriv tilbake), ikke en flat kolonne-update. `has_3d_addon` er derimot en flat boolean-kolonne (snapshot linje 184), satt via dagens `updateProjectHas3dAddon`-mønster (`page.tsx:817-834`).

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. Admin-SKALL (layout/sidebar/secondary-nav) uten Mapbox-2D-kobling, `ADMIN_ENABLED`-gated + `noindex`.
2. `middleware.ts`-port (legacy-SEO-routing bevart + eksplisitt admin-guard-valg).
3. Tier-modell-admin: `reportTier`-setter (read-modify-write `products.config`, validert mot PRD 2) + `has_3d_addon`-toggle.
4. Kanonisk provisjon-INNGANG (admin-UI/route/server-action) som TRIGGER PRD 3-kjernen + retry-trigger.
5. Keeper-admin-port (customers/projects/requests/pois/categories/import-tab + `/api/admin/revalidate` manuell cache-purge), re-typet mot PRD 1.
6. Sletting av dødt admin (trips/stories/knowledge/editorial + import-stub/orphan + legacy `/api/generate` + `/api/story-writer`).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Provisjon-PIPELINE-logikken (geocode/discovery/scoring/hydrering/`provision.ts`-kjerne) | **PRD 3 (prd-provisjon)** — admin-inngangen TRIGGER den, eier ikke logikken |
| Tier-DEKLARASJON + lett nivå-2-readiness-sjekk (`validateReportTier`; ingen `TIER_CAPABILITIES`-matrise) | **PRD 2 (prd-tier-capability-manifest)** — admin SETTER tier-felt (1\|2), eier ikke deklarasjonen |
| Datamodell/skjema (alle tabeller + kolonner + RLS + re-typede klienter) | **PRD 1 (prd-datamodell-supabase)** — admin leser/skriver mot, definerer ikke |
| Public self-serve `generer`-form-konsolidering (`(public)/generer` + `eiendom/(tools)/generer`) | **PRD 3 (Unit 8, `03:267`)** — admin eier operatør-trigger; public-form sitter på 3/12-grensen (§10 Q2) |
| Varig 3D-addon-KJØPSKILDE (kunde-/produkt-felt som driver `has_3d_addon` ved kjøp/billing) | **Denne PRD-en avgrenser til manuell operatør-toggle for MVP**; faktisk billing-tilstand er deferred her (§10 Q3). PRD 3 leverer skrive-pathen (`03:173,234`) |
| Nivå-2 menneskelig kurerings-arbeidsflyt-UI (operatør fyller editorial-overflaten) | **PRD 15 (prd-nivaa-2-kuratering)** — distinkt fra operatør-admin |
| Moat/areas-curation-admin (`/admin/public`, areas-editorial-flate) | **PRD 8 (prd-lokalkunnskap-moat)** — moat-flate, ikke tier/provisjon-flate (§10 Q4) |
| Trust-validate / foto-fetch / POI-import LOGIKK (admin trigger-knappene kaller) + build-hook `/api/revalidate` cache-logikk | **PRD 4 / PRD 7** — admin-trigger-mønster keeper, heuristikk/cache eies der. **MERK:** `/api/admin/revalidate` (manuell cache-purge) er PRD 12-EID (kontroll 2026-06-27, §10 Q6), ikke deferred |
| Ekte kunde-innlogget admin + auth/tenant-modell (utenfor «minimalt admin-skall») | **Deferred — ikke i nivå-1-MVP-scope** (§10 Q1, ratifisert til Beslutning 1) |

**Eksplisitt ikke-scope (patch #2):** render-gating på `reportTier`. Admin SETTER tier-data; render gater ALDRI på den (verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`, `00-INDEX` linje 85). Ingen unit bygger en render-bryter.

---

## 7. Implementation Units (7 av maks 8)

### Unit 1 — Admin-skall + gate-helper (layout/sidebar/secondary-nav, Mapbox-fri)
- **Mål (→ G1):** Port admin-skallet uten ekstern Mapbox-CSS, med ett delt `ADMIN_ENABLED`-gate-mønster og `noindex` på alle flater.
- **Filer:** `@/app/admin/layout.tsx` (port), `@/components/admin/admin-sidebar.tsx` (trim NAV_ITEMS), `@/components/admin/admin-secondary-nav.tsx` (port), `@/lib/admin/require-admin.ts` (ny — delt gate-helper), `@/app/admin/page.tsx` (dashboard-port).
- **Akseptansekriterier:**
  1. `layout.tsx` injiserer IKKE lenger ekstern `<link href="https://api.mapbox.com/...">` (verifisert i dag `layout.tsx:15-18`); admin-skallet drar ingen Mapbox-2D-CSS inn (manifest linje 7). Hvis en kart-stil trengs i admin, inlines/data-URI-es eller droppes — ingen ekstern host.
  2. `NAV_ITEMS` trimmet til keeper-sett: Dashboard, Kunder, Prosjekter, POI-er, Kategorier, Generator (kanonisk provisjon), Requests. DROPPET: Trips (`admin-sidebar.tsx:28`), Kunnskap (`:29`); «Offentlige sider» (`/admin/public`) holdes ute av minimal-scope (defer PRD 8, §10 Q4) — fjernes fra nav her, ikke slettes som side (PRD 8 avgjør).
  3. Delt `requireAdmin()`-helper i `@/lib/admin/` erstatter den dupliserte `process.env.ADMIN_ENABLED === "true"`-sjekken på alle **23 steder i dag (15 sider + 8 API-ruter, verifisert grep)**; forretningslogikk ut av page-komponentene (CLAUDE.md: ingen forretningslogikk i komponenter). De keeper-bevarte gate-stedene (9 sider + 7 API-ruter — alle unntatt knowledge-API som slettes i Unit 7, og de 6 dead side-gate-stedene som slettes i Unit 7: trips, trips/[id], stories, story, knowledge, editorial) konverteres til `requireAdmin()`; ingen keeper-flate beholder den inline `ADMIN_ENABLED`-strengen. Server-side env, lekker ikke til klient.
  4. Hver admin-`page.tsx` eksporterer `metadata` med `robots: { index: false }` (`noindex` — admin skal aldri indekseres; flere sider mangler metadata i dag, kun `requests`/`generate` har det).
  5. Skall-komponentene er tier-/produkt-agnostiske (ingen `reportTier`-ref, ingen produkt-spesifikk gren).
- **Avhengigheter:** PRD 1 (re-typede klienter for dashboard-counts).

### Unit 2 — middleware.ts-port (legacy-routing bevart + eksplisitt admin-guard-valg)
- **Mål (→ G2):** Port `middleware.ts` med bevart legacy-301-SEO-routing og et eksplisitt, dokumentert admin-guard-valg (ikke en stille passthrough lest som guard).
- **Filer:** `@/middleware.ts` (port).
- **Akseptansekriterier:**
  1. Legacy-301-redirects bevart verbatim (SEO-bevaring, manifest linje 670): `/for/*`→`/eiendom/*` (`middleware.ts:47-99`), `/generer`→`/eiendom/generer` (`:101-107`), KNOWN_CUSTOMERS legacy slugs (`:120-157`). `/eiendom`/`/en`/`/trondheim`-passthrough bevart (`:44,110,115-118`).
  2. `config.matcher` ekskluderer `api`/`_next`/static (`:162-165`) bevart — admin-API-ruter gates ikke i middleware (de har egen `ADMIN_ENABLED`-sjekk).
  3. **Admin-guard-valg dokumentert eksplisitt:** `/admin`-branchen er i dag en ren `NextResponse.next()`-passthrough (`:112-113`), IKKE en guard. Default-valg for nivå-1-MVP: **behold passthrough, men dokumenter i kode-kommentar at den ER en passthrough og at autoritativ admin-tilgangskontroll er `ADMIN_ENABLED` per-page/route** — så ingen leser den som en guard. En EKTE middleware-guard bygges KUN hvis kunde-auth innføres (deferred, §10 Q1) — ikke nå (ingen auth-modell å gate på).
  4. Ingen ny locale-rewrite utover dagens `/en` + `/trondheim`-passthrough (i18n-rewrite eies ikke her — i18n-data er PRD 5).
- **Avhengigheter:** ingen (rot for routing).

### Unit 3 — Tier-modell-admin (reportTier-setter + has_3d_addon-toggle)
- **Mål (→ G3, G4):** Bygg den tynne tier-flaten admin manglet: `reportTier`-setter (read-modify-write `products.config`, validert mot PRD 2) + bevart `has_3d_addon`-toggle.
- **Filer:** `@/app/admin/projects/[id]/page.tsx` (server-actions), `@/app/admin/projects/[id]/project-detail-client.tsx` (tier-UI + addon-toggle), `@/lib/admin/set-report-tier.ts` (ny — read-modify-write + validering-logikk, ut av komponenten).
- **Akseptansekriterier:**
  1. **`reportTier`-setter (NY):** server-action skriver `products.config.reportConfig.reportTier` via **read-modify-write** av JSONB (les eksisterende config, sett feltet, skriv tilbake) — IKKE en flat kolonne-update (verifisert: `reportTier` bor i `products.config`, `@/lib/types.ts:473`; ingen dedikert kolonne). Forretningslogikken (read-modify-write + parse) bor i `@/lib/admin/set-report-tier.ts`, ikke i UI-komponenten (CLAUDE.md).
  2. **Validering FØR skriving:** input parses med `OptionalReportTierSchema` (PRD 2, 02:75) — `"3"`/`4`/`0` avvises. Etter setting kjøres `validateReportTier` (PRD 2 §5.3, lett nivå-2-readiness) og funnene vises som forhåndsvisning («nivå 2 deklarert, mangler kuratert editorial på tema X») slik at operatøren ser om boardet faktisk dekker nivå 2. Sannhetskilden for nivå 2 er den lette readiness-sjekken (kuratert editorial til stede), IKKE en capability-matrise — `TIER_CAPABILITIES` er fjernet (to-nivå 2026-06-27, INDEX note #8).
  3. **`has_3d_addon`-toggle bevart:** dagens mønster (`updateProjectHas3dAddon` server-action `page.tsx:817-834`, toggle `client.tsx:425-446`, checkbox `:431`) portes; skriver flat `projects.has_3d_addon`-kolonne. Det er en MANUELL operatør-toggle (kjøps-tilstand er deferred, §10 Q3 + Beslutning 6). **Koordinerings-caveat (kontroll 2026-06-27):** toggelens «av» blir i dag overstyrt av pipeline-re-provisjon (`create-report-project.ts:217` hardkoder `has_3d_addon: true`); toggelen blir først autoritativ når PRD 3 gjør feltet input-styrt. PRD 12 endrer IKKE `create-report-project.ts` (PRD 3-eierskap) — den noterer kun avhengigheten.
  4. Server-action har eksplisitt error-håndtering (sjekk `{ error }`, kast/returner — CLAUDE.md); ingen stille svelging. `revalidatePath` på den berørte board-stien etter skriving.
  5. Setteren leser/skriver via `createServerClient` (service-role) — ALDRI Supabase direkte fra klient, ALDRI `@supabase/supabase-js`-import (CLAUDE.md).
  6. Ingen render-gating bygges — setteren skriver kun deklarasjonen (patch #2).
- **Avhengigheter:** Unit 1 (skall + gate-helper), PRD 1 (`products.config`-skjema + re-typede klienter), PRD 2 (lett nivå-2-readiness-sjekk + `report-tier-schema` 1|2).

### Unit 4 — Kanonisk provisjon-inngang (admin-trigger for PRD 3-kjernen)
- **Mål (→ G5):** Re-bygg admin «Generator» som den kanoniske provisjon-INNGANGEN som TRIGGER PRD 3-pipeline-kjernen; DROP Mapbox-radius-UI og `story-writer`-banen.
- **Filer:** `@/app/admin/generate/page.tsx` (port), `@/app/admin/generate/generate-client.tsx` (rewrite — drop `react-map-gl/mapbox`), `@/app/api/admin/provision/route.ts` (ny — operatør-trigger som kaller `lib/pipeline/provision.ts`).
- **Akseptansekriterier:**
  1. Admin-provisjon-inngangen kaller PRD 3s `lib/pipeline/provision.ts`-kjerne (03:184, kallbar uten TTY 03:189) — IKKE `/api/story-writer` (verifisert i dag `generate-client.tsx:164`), IKKE legacy `/api/generate`. Inngangen produserer et REPORT-board (samme kjerne som CLI), ikke Explorer/scroll-story.
  2. `generate-client.tsx` importerer IKKE `react-map-gl/mapbox` (verifisert i dag `:4`) — Mapbox-2D-radius-UI droppes (3D-motoren er Google `gmp-map-3d`, 0 Mapbox i hot path, manifest linje 7). Adresse-input + profil/tier-valg erstatter radius-pickeren.
  3. Provisjon er ikke et runtime-LLM-kall i request-pathen — den trigger PRD 3-pipelinen (build-time/script-natur); ingen Gemini/LLM kjøres synkront i admin-request (CLAUDE.md LLM-regel). API-nøkler i header, aldri URL.
  4. **Async-grense (IDENTISK fire-and-poll-kontrakt som PRD 3 Unit 8 AC6, `03:274`):** admin-trigger henger IKKE synkront på 5–10 min pipeline-kjøring. HTTP-svaret returnerer UMIDDELBART (lag/marker en `generation_requests`-rad eller tilsvarende job-record som `status='pending'`); pipelinen kjører ferdig i prosess (`pending`→`completed`/`failed`); admin-UI poller status / `result_url` — eksakt samme bane som den publike self-serve-pathen (`03:274`: «HTTP returnerer umiddelbart en `generation_requests`-status (`pending`), pipelinen kjører ferdig i prosess … Klienten poller status / `result_url`»). En blokkerende synkron kjøring er IKKE akseptabel: deploy er Vercel serverless (eneste `maxDuration` i kodebasen er 30s, `app/api/eiendom/tekst/route.ts:6`), så en synkron admin-trigger som henger på en 5–10 min pipeline ville time-out — PRD 3 designer dette bort via fire-and-poll, og PRD 12 arver samme kontrakt. Ekstern job-kø deferred til volum (koordineres med PRD 3, endrer ikke leveranse). Hvis fremtidig drift flytter til en langtkjørende ikke-serverless host kan synkron kjøring revurderes, men det er IKKE nivå-1-MVP-antagelsen.
  5. Ruten er `ADMIN_ENABLED`-gated via `requireAdmin()` (Unit 1); Supabase-kall med eksplisitt error-håndtering.
  6. `metadata` med `noindex` bevart/lagt til (`generate/page.tsx:5-8` har title i dag).
- **Avhengigheter:** Unit 1, PRD 3 (`lib/pipeline/provision.ts`-kjerne — admin kaller den), PRD 1 (skjema).

### Unit 5 — Request-tracking + retry-trigger (generation_requests-operatør-flate)
- **Mål (→ G5):** Port `generation_requests`-listen + retry-triggeren som operatør-flate for self-serve-pipelinen.
- **Filer:** `@/app/admin/requests/page.tsx` (port), `@/app/admin/requests/requests-admin-client.tsx` (port), `@/app/api/admin/retry-request/route.ts` (port).
- **Akseptansekriterier:**
  1. Request-listen leser `generation_requests` (snapshot linje 41-58) via server-side query-wrapper (`force-dynamic` `:5`, gate `:8`, query `:16-19`; `requests/page.tsx`); viser `address`/`email`/`housing_type`/`status`/`result_url`/`error_message`/`created_at` (`requests-admin-client.tsx:86-122`).
  2. Retry-triggeren (`POST /api/admin/retry-request`, `retry-request/route.ts:27-35`) UUID-validerer `id` og setter `status='pending'`, `error_message=null` OG `updated_at=now()` WHERE `status='failed'` (verifisert: retry-route skriver alle tre, `retry-request/route.ts:27-35`) — re-armer PRD 3-pipelinen for den raden. Gate `:7` via `requireAdmin()`.
  3. **PII-grense:** `generation_requests` inneholder e-post + consent → leses KUN via service-role (ikke anon), jf. PRD 1 RLS-kontrakt + PRD 3 Unit 8 AC5 (`03:273`). Admin-lesing av e-post er legitim operatør-tilgang (gated av `ADMIN_ENABLED`).
  4. Supabase-kall med eksplisitt error-håndtering; feilet henting gir tydelig feilmelding, ikke stille tom liste.
  5. `metadata` med `noindex` bevart (`requests/page.tsx:32-34` har metadata i dag).
- **Avhengigheter:** Unit 1, PRD 1 (`generation_requests`-skjema + `DbGenerationRequest`-type), PRD 3 (status-maskinen retry re-armer).

### Unit 6 — Keeper-admin-port (customers/projects/pois/categories/import-tab)
- **Mål (→ G6):** Port keeper-admin-sidene re-typet mot PRD 1, med arkitektur-regler håndhevet; konsolider import til import-tab.
- **Filer:** `@/app/admin/customers/{page,customers-admin-client}.tsx`, `@/app/admin/projects/{page,projects-admin-client}.tsx`, `@/app/admin/pois/{page,poi-admin-client}.tsx`, `@/app/admin/categories/{page,categories-admin-client}.tsx`, `@/app/admin/projects/[id]/import-tab.tsx`, `@/app/api/admin/import/route.ts`, `@/app/api/admin/projects/[id]/route.ts`, `@/app/api/admin/revalidate/route.ts` (port — manuell cache-purge, PRD 12-eid per kontroll 2026-06-27).
- **Akseptansekriterier:**
  1. Hver keeper-side er server-component som fetcher via `createServerClient` (ALDRI `useEffect`-data-fetching, ALDRI Supabase fra klient — CLAUDE.md); klient-komponenter får data som props, muterer via server-actions/API-ruter.
  2. Alle Supabase-kall har eksplisitt error-håndtering; ingen `return []`-stille-swallow uten logging (CLAUDE.md).
  3. Import konsolidert til `import-tab.tsx` (den reelle, `import-tab.tsx:148` rendret `project-detail-client.tsx:216`); `import-client.tsx`-duplikatet slettet (Unit 7). `import-tab` backes av `/api/admin/import` (gate `:323`).
  4. `project-detail-client.tsx` trimmet til keeper-tabs (3D-toggle + import bevart; Trips-tab slettet i Unit 7).
  5. Alle bilder bruker `next/image` (ALDRI `<img>` — CLAUDE.md); `@/`-prefix på alle imports.
  6. Re-typet mot PRD 1-baseline (ingen referanse til droppede tabeller); `npx tsc --noEmit` 0 feil, `npm run lint` 0 errors.
  7. `/api/admin/revalidate` portet med `requireAdmin()`-gate (Unit 1) som erstatter den inline `ADMIN_ENABLED`-sjekken (`route.ts:8`); manuell cache-purge er PRD 12-eid operatør-flate (kontroll 2026-06-27), IKKE PRD 7s secret-gated build-hook `/api/revalidate`. Eksplisitt error-håndtering på `revalidatePath`/`revalidateTag`-kall.
- **Avhengigheter:** Unit 1, PRD 1 (re-typede klienter + baseline-skjema).

### Unit 7 — Dead-admin-sletting (trips/stories/knowledge/editorial + legacy-ruter)
- **Mål (→ G7):** Slett alt dødt admin slik at ingen dead code degraderer kontekst (CLAUDE.md: slett gammelt umiddelbart).
- **Filer (slettes):** `@/app/admin/trips/` (hele treet) + `@/app/admin/projects/[id]/trips-tab.tsx`, `@/app/admin/stories/page.tsx`, `@/app/admin/projects/[id]/story/` (page + client), `@/app/admin/knowledge/` + `@/app/api/admin/knowledge/route.ts`, `@/app/admin/editorial/page.tsx`, `@/app/admin/import/page.tsx` + `@/app/admin/import/import-client.tsx`, `@/app/api/generate/route.ts`, `@/app/api/story-writer/route.ts`.
- **Akseptansekriterier:**
  1. Trip/Guide-admin slettet (manifest linje 674): `trips/page.tsx`, `trips-admin-client.tsx`, `trips/[id]/page.tsx`, `trip-editor-client.tsx`, `projects/[id]/trips-tab.tsx`. Ingen `getAllTripsAdmin`/trips-referanse igjen.
  2. Scroll-rapport-admin slettet (manifest linje 7, 675): `stories/page.tsx`, `story/page.tsx`, `story-editor-client.tsx`.
  3. Knowledge-KOMPONENT + API slettet (manifest linje 701, 734): `knowledge/page.tsx`, `knowledge-admin-client.tsx`, `api/admin/knowledge/route.ts`. **SKJEMA + DATA røres IKKE** (keeper-IP, PRD 1/8) — kun den forlatte komponenten/system-koden slettes.
  4. `editorial/page.tsx`-stub + `import/page.tsx`-stub + `import-client.tsx`-orphan slettet (manifest linje 605, 701).
  5. Legacy provisjon-ruter slettet ETTER at `generate-client` er re-pekt (Unit 4): `/api/generate` (dead, manifest-verifisert referert av ingenting) + `/api/story-writer` (`writeStoryStructure` dead, manifest linje 447). Grep bekrefter null gjenværende referanser FØR sletting.
  6. `npx tsc --noEmit` 0 feil, `npm run lint` 0 errors, `npm test` passerer, `npm run build` bygger etter sletting (ingen broken import).
- **Avhengigheter:** Unit 1 (NAV_ITEMS allerede trimmet), Unit 4 (provisjon re-pekt FØR legacy-ruter slettes).

> **Fullstendighet:** 7 av 7 units. Hver admin-fil i evidens-pakken er eksplisitt klassifisert: keeper-port (Unit 1/3/5/6 — inkl. `/api/admin/revalidate`, PRD 12-eid per kontroll 2026-06-27), referanse-only-trigger (§4.2, eies av PRD 3/4/8), eller dead-sletting (Unit 7). Ingen sampling — alle 23 `ADMIN_ENABLED`-gate-steder (15 sider + 8 API-ruter) dekkes av `requireAdmin()`-konsolidering (Unit 1 AC3), og alle tre provisjon-innganger er rutet (kanonisk→Unit 4, to legacy→Unit 7). De **8 admin-API-rutene** er: `retry-request` (keeper, Unit 5), `projects/[id]` (keeper, Unit 6), `import` (keeper, Unit 6), `revalidate` (keeper — PRD 12-eid manuell cache-purge, kontroll 2026-06-27; Unit 6 `requireAdmin()`-gate-port), `trust-validate` + `trust-validate/update` + `fetch-photos` (PRD 4-trigger, §4.2), `knowledge` (dead, Unit 7). De **15 admin-sidene** er: dashboard, customers, projects, projects/[id], pois, categories, generate, requests, public (keeper/referanse — Unit 1/3/5/6/§4.2) + trips, trips/[id], stories, story, knowledge, editorial (dead — Unit 7).

---

## 8. Utviklingsløp (faser)

### Fase 1 — Skall + routing + dead-sletting (fundament)
- **Mål:** Admin-skall portet (Mapbox-fri, `requireAdmin()`-helper, trimmet nav, `noindex`), middleware portet med dokumentert guard-valg, og alt dødt admin slettet.
- **Leveranse:** Unit 1, Unit 2, Unit 7.
- **Autonomi-nivå:** Høy. Mekanisk port + sletting forankret i manifest/grep. Unit 7s legacy-rute-sletting venter på Unit 4-re-peking (sekvensiell innen fasen, eller flytt `/api/generate`+`/api/story-writer`-sletting til Fase 3 hvis Unit 4 ikke er klar).

### Fase 2 — Keeper-CRUD + request-tracking
- **Mål:** Keeper-admin-sidene portet/re-typet mot PRD 1; request-liste + retry-trigger på plass.
- **Leveranse:** Unit 5, Unit 6.
- **Autonomi-nivå:** Middels. Re-typing mot PRD 1-baseline krever at PRD 1 er kjørt; import-konsolidering krever kaller-verifikasjon (import-tab vs import-client).

### Fase 3 — Tier-flate + provisjon-inngang (kontrakts-kobling)
- **Mål:** `reportTier`-setter (validert mot PRD 2) + `has_3d_addon`-toggle; kanonisk provisjon-inngang som trigger PRD 3-kjernen.
- **Leveranse:** Unit 3, Unit 4.
- **Autonomi-nivå:** Middels-lav. Unit 3 er NY flate (read-modify-write JSONB + PRD 2-validering); Unit 4 avhenger av at PRD 3 har extrahert `lib/pipeline/provision.ts`. Koordineres med PRD 2 + PRD 3. Verifiser mot et faktisk board (sett nivå 2 på et board uten editorial → validator-funn vises).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | **«Self-serve» nivå-1-MVP = operatør-admin + eksisterende public-form.** Konkret: (a) public `generer`-form (eksisterer, ingen auth, eies av PRD 3 Unit 8) + (b) `ADMIN_ENABLED`-gated operatør-admin (denne PRD-en). Ekte kunde-innlogget admin er deferred. **Denne avgrensningen er ratifisert i brainstorm-fasen — ikke et åpent valg.** Konsekvens: PRD 12 leverer operatør-flaten, ikke en ny kunde-self-serve-overflate; «self-serve» i tittelen viser til den eksisterende publike formen + operatør-trigger | Eneste tilgangskontroll i dag er `ADMIN_ENABLED`-env (23 steder); ingen per-bruker auth/session finnes. «Minimalt admin-skall» (`00-INDEX` linje 36) ≠ bygge en auth/tenant-modell. Ratifiserer §10 Q1 |
| 2 | `middleware.ts` `/admin`-branch forblir passthrough, men DOKUMENTERES eksplisitt som ikke-guard | Den ER en ren `NextResponse.next()` i dag (`:112-113`); autoritativ gate er `ADMIN_ENABLED` per-page. Ekte middleware-guard krever auth-modell (deferred). Hindrer at nedstrøms leser passthrough som guard |
| 3 | `reportTier`-setter bygges som NY admin-flate via read-modify-write av `products.config` JSONB | Verifisert: ingen tier-setter finnes i admin; `reportTier` bor i JSONB (`@/lib/types.ts:473`), ikke en kolonne. Tier-modellen trenger en operatør-flate |
| 4 | Tier-setter VALIDERER mot PRD 2 (`OptionalReportTierSchema` 1\|2 + `validateReportTier` lett readiness) FØR/etter skriving | Den lette readiness-sjekken er sannhetskilden (PRD 2 §5.3; ingen capability-matrise); operatøren skal se om boardet dekker nivå 2 (kuratert editorial), ikke deklarere blindt |
| 5 | Kanonisk provisjon-inngang TRIGGER PRD 3-kjernen; `story-writer` + `/api/generate` slettes | Manifest linje 608 ber om å avklare kanonisk vei. `story-writer`=scroll-story (dead), `/api/generate`=referert av ingenting. ÉN vei (PRD 3) |
| 6 | 3D-addon = manuell operatør-toggle for MVP; billing/kjøps-tilstand deferred. **BEKREFTET kontroll 2026-06-27.** | Ingen kjøps-/billing-felt finnes i skjema (kun `projects.has_3d_addon` boolean). Kilde verifisert: `updateProjectHas3dAddon` (`page.tsx:817-834`) + checkbox (`project-detail-client.tsx:431`). PRD 3 leverer skrive-pathen (`03:173,234`); varig kjøps-kilde defer til faktisk billing-behov. **Koordineringsnote:** toggelens «av» overstyres av pipeline-re-provisjon (`create-report-project.ts:217` hardkoder `has_3d_addon: true`) inntil PRD 3 gjør feltet input-styrt (se §10 Q3) |
| 7 | Mapbox-2D droppes fra admin (layout-`<link>` + `generate-client`-`react-map-gl`) | Manifest linje 7: Mapbox-2D ut av hot path; 3D-motor er Google `gmp-map-3d`. Ekstern CSS-host er også CSP-konsern |
| 8 | `requireAdmin()`-helper konsoliderer alle 23 dupliserte `ADMIN_ENABLED`-sjekker (15 sider + 8 API-ruter) | Forretningslogikk ut av komponenter (CLAUDE.md); ett gate-mønster å vedlikeholde |
| 9 | `/admin/public` (areas/moat-admin) holdes ute av minimal-scope, fjernes fra nav men slettes ikke | Moat-flate, ikke tier/provisjon-flate; PRD 8 avgjør dens skjebne (§10 Q4) |
| 10 | Knowledge-KOMPONENT + API slettes; SKJEMA + DATA bevares | Manifest linje 7 (system cruft) vs 149/734 (skjema-IP keeper). Skillet er reelt — system-kode dead, moat-IP keeper (PRD 1/8) |
| 11 | **Admin = aggressivt strippet (eier-direktiv, viktigst).** Heller bygge funksjonalitet man savner senere enn å dra med gammelt deprecated. Dead-admin slettes uten nøling (Unit 7); ny funksjonalitet legges til kun ved konkret behov, ikke spekulativt | Andreas (eier) 2026-06-27: «det viktigste med admin-panelet er at det er svært strippet ned — bedre å bygge funksjonalitet man savner enn ha med for mye gammelt deprecated». Forsterker `00-INDEX:36` «minimalt admin-skall»; verner mot kontekst-støy fra deprecated kode (CLAUDE.md «ALDRI la dead code ligge») |
| 12 | **Kunde er førsteklasses: board namespaces under kunde i URL; no-customer-fallback = reservert `intern`-kunde (Andreas valgte A, 2026-06-27).** Board-URL er allerede `/eiendom/[customer]/[project]/…` og kunde-CRUD er keeper (definere kunde i admin) → eier-direktivet er i hovedsak allerede designet. Den load-bearing `{customer}_{slug}`-invarianten (projectId + cache-tag `product:${customer}_${slug}`, PRD 7 K1 / PRD 9) krever ALLTID en customer-verdi internt. **VALGT (A):** kunde-løse board får den reserverte default-kunden `intern` → projectId/cache-tag `intern_<slug>`, og URL-en viser segmentet (`/eiendom/intern/<board>`). Bevarer ID-formen intakt med minst kode, ingen route-/middleware-spesialhåndtering. Hide-segment-varianten (B, renere URL uten segment) er **DEFERRED** som valgfri senere kosmetikk hvis en kunde krever det. | Andreas 2026-06-27: valgte A. Reservert-nøkkel = minst kode + bevarer den load-bearing ID-formen; passer strippet-MVP-prinsippet (Besl. 11). **Ripple:** PRD 3 (provisjon) bruker `intern` som `{customer}` når ingen kunde er oppgitt; PRD 1 reserverer `intern` som default-kunde-nøkkel. Route (PRD 9 `[customer]`-segment) trenger INGEN endring for A |

### Kontroll-runde 2026-06-27

- **revalidate-eierskap avklart:** `/api/admin/revalidate` (`ADMIN_ENABLED`-gated manuell cache-purge, `route.ts:8`) er PRD 12-eid (deler auth-mønster/livssyklus med `app/api/admin/*`, portes i Unit 6 AC7). Den secret-gated build-hooken `/api/revalidate` forblir PRD 7. Flyttet fra §4.2 (referanse-only) til §3-arkitekturtabell + §6 scope + §7-enumerasjon. (§10 Q6)
- **3D-addon-kjøpskilde BEKREFTET (Besl. 6):** manuell operatør-toggle for MVP, ingen billing-kilde. Kilde verifisert: `updateProjectHas3dAddon` (`app/admin/projects/[id]/page.tsx:817-834`) + checkbox (`project-detail-client.tsx:431`).
- **PRD 3-koordinering notert:** admin-toggelens «av» overstyres av pipeline-re-provisjon (`create-report-project.ts:217` hardkoder `has_3d_addon: true`) inntil PRD 3 gjør feltet input-styrt. PRD 12 rører ikke `create-report-project.ts`; noterer kun avhengigheten (Unit 3 AC3, §10 Q3).

---

## 10. Åpne spørsmål

1. **(ratifisert til Beslutning 1 — LØST, ikke-blokkerende)** «Self-serve»-ambisjonen: `00-INDEX` linje 36 sier «self-serve admin» + «minimalt admin-skall». Full self-serve (kunde logger inn, provisjonerer eget board) krever auth/tenant-modell som ikke finnes. **Avgjort og ratifisert:** nivå-1-MVP = (a) public `generer`-form (eksisterer, ingen auth) + (b) `ADMIN_ENABLED`-gated operatør-admin. Ekte kunde-onboarding-auth deferred (se «Deferred to Separate Tasks»). Dette er en bekreftet avgrensning (Beslutning 1), ikke et åpent valg — «minimalt admin-skall» (`00-INDEX` linje 36) ≠ å bygge auth/tenant-modell, og scope er ratifisert i brainstorm-fasen.
2. **(grense-avklaring med PRD 3 — ikke-blokkerende)** Eier PRD 12 eller PRD 3 den PUBLIKE `generer`-formen? PRD 3 Unit 8 (`03:267`) plasserer konsolideringen av de to formene i PRD 3 (pipeline-konvergens). **Forslag (landet):** PRD 3 eier public self-serve-FORM (del av pipeline-konvergens); PRD 12 eier intern operatør-trigger (Unit 4) + tier-flate + middleware. Bekreft at PRD 3 Unit 8 og PRD 12 Unit 4 ikke begge redigerer `generate-client` (de gjør ikke: 12 Unit 4 eier `admin/generate/*`, 3 Unit 8 eier `(public)/generer/*` + `eiendom/(tools)/generer/*`).
3. **(LØST — kontroll 2026-06-27, bekrefter Beslutning 6)** Varig 3D-addon-KJØPSKILDE: PRD 3 deferrer «kunde-/produkt-felt som driver `has_3d_addon` ved kjøp» hit (`03:173,234`). Ingen slik felt finnes (kun `projects.has_3d_addon` boolean). **Dom:** behold manuell operatør-toggle for MVP (verifisert kilde: `updateProjectHas3dAddon` `app/admin/projects/[id]/page.tsx:817-834` + checkbox `project-detail-client.tsx:431`). Ingen billing-/kjøps-kilde i MVP. **KOORDINERING med PRD 3:** admin-toggelens «av» blir i dag OVERSTYRT av pipeline-re-provisjon — `create-report-project.ts:217` hardkoder `has_3d_addon: true` ved provisjonering, så en re-provisjon setter feltet tilbake til `true` uavhengig av operatørens toggle. Dette er akseptabelt for MVP, men PRD 12s toggle blir først autoritativ når PRD 3 gjør `has_3d_addon` input-styrt (PRD 3 leverer skrive-pathen `03:173,234`). Noter koordineringen: PRD 12 eier toggelen, PRD 3 eier provisjon-defaulten som må slutte å hardkode `true`.
4. **(grense-avklaring med PRD 8 — ikke-blokkerende)** `/admin/public` (offentlige sider/areas-admin): i PRD 12 minimal-scope eller PRD 8 (moat/areas-admin)? **Forslag (landet):** defer til PRD 8 — moat-flate, ikke tier/provisjon-flate. PRD 12 fjerner den fra nav (Unit 1 AC2) men sletter ikke siden.
5. **(løst i Unit 4 AC1 + Unit 7 AC5 — informativt)** Hva skjer med `generate-client`/`story-writer`-banen ved port? **Avgjort:** re-pek admin «Generator» til PRD 3-kjernen (Unit 4), slett `story-writer` + legacy `/api/generate` (Unit 7) etter re-peking. Manifest linje 608 («avklar kanonisk vei») oppfylt.
6. **(LØST — kontroll 2026-06-27)** Eier PRD 12 eller PRD 7 cache-revalidate? **Dom:** `/api/admin/revalidate` (`ADMIN_ENABLED`-gated manuell cache-purge, `route.ts:8`) eies av **PRD 12** — den deler auth-mønster + livssyklus med resten av `app/api/admin/*` og portes i Unit 6 med `requireAdmin()`-gate. Den secret-gated build-hooken `/api/revalidate` (egen rute, ikke under `app/api/admin/`) forblir **PRD 7**. §4.2-raden flyttet til §3-arkitekturtabellen som PRD 12-eid; §6 scope + §7-completeness-enumerasjon + Unit 6 oppdatert.

---

## 11. Avhengigheter (PRD-graf)

```
        PRD 1 (datamodell)        PRD 2 (tier-modell + readiness)        PRD 3 (provisjon-pipeline)
              │                          │                                       │
              │  (customers/projects/    │  (lett nivå-2-readiness,              │  (lib/pipeline/provision.ts
              │   products.config/       │   validateReportTier,                 │   — kallbar server-action;
              │   generation_requests    │   OptionalReportTierSchema 1|2 —      │   ÉN report-pipeline-kjerne
              │   + re-typede klienter)  │   admin SETTER tier-felt,             │   admin-inngangen TRIGGER)
              │                          │   eier ikke deklarasjonen)            │
              └──────────────┬───────────┴───────────────────┬──────────────────┘
                             ▼                                ▼
                  ┌──────── prd-self-serve-admin (PRD 12 — DENNE) ────────┐
                  │   admin-skall (Mapbox-fri) + middleware (routing/guard-valg)
                  │   + tier-flate (reportTier-setter + has_3d_addon-toggle, validert)
                  │   + kanonisk provisjon-inngang (TRIGGER PRD 3) + retry-trigger
                  │   + keeper-CRUD-port + dead-admin-sletting
                  └────────────────────────────┬──────────────────────────┘
                                                ▼
                                       (ingen nedstrøms-PRD — Lag-4 blad-node)
```

**Blokkeres av:** PRD 1, PRD 2, PRD 3 (`00-INDEX` linje 36: deps 01, 02, 03).
**Blokkerer:** ingen (Lag-4 blad-node; admin er operatør-flaten).
**Trigger/konsumerer (eier ikke):** `lib/pipeline/provision.ts` (PRD 3), lett nivå-2-readiness-sjekk (`validateReportTier`, PRD 2 §5.3), trust/foto-trigger-ruter (PRD 4), build-hook `/api/revalidate` (PRD 7), `/admin/public`-moat-flate (PRD 8). **MERK (kontroll 2026-06-27):** `/api/admin/revalidate` (manuell cache-purge) er PRD 12-EID, ikke en ekstern trigger.

---

**Fullstendighet:** 7 av 7 implementation units spesifisert med avhengigheter + akseptansekriterier; 7 av 7 mål (G1–G7) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i `prod-schema-snapshot.txt` (`products.config` jsonb linje 138, `projects.has_3d_addon` linje 184, `generation_requests` linje 41-58), `CARRY-OVER-MANIFEST.md` (linje 7, 447, 597, 605, 607-609, 611-612, 670, 673, 674, 675, 701, 734, 751), `00-INDEX.md` (linje 36, 59, 75, 76, 85), `02`/`03`-PRD-ene, og faktisk kode (`middleware.ts:35-165`, `app/admin/*`, `app/api/admin/*`, `lib/supabase/client.ts:30`, `@/lib/types.ts:473`). Ingen P0/P1/P2-tiers; deferred work under Scope Boundaries med PRD-pekere; ingen render-gating spesifisert (patch #2).
