# Shared platform migration — verification

Status: database migration applied and verified; application migration in progress, not yet deployed. Date: 2026-09-17.

## Plan review

Plan: `docs/plans/2026-09-17-1212-feat-shared-placy-platform-plan.md`.

`ce-doc-review` completed in non-interactive mode. Coherence, feasibility, security, adversarial, product, design and scope leaves completed; zero retained findings. Cross-model review was explicitly skipped. One scope proposal to remove the neutral shared origin / optional DNS work was rejected because this is part of the authorized common runtime migration; it does not reopen the stopped main-domain path reverse proxy. No product-contract changes or pending approvals.

## Before changes

- Main Vercel project `placy`: `prj_azJSjvc6iE3lM35rGLvqxeuNXvLg`, production `dpl_ENuhYMxhiAeAEtdSDxvLGQESZY1k`, commit `bef9ae2d0643fb249ce0b344a915ba61c1ef2cb2`. Must remain unchanged.
- Voice Vercel project `placy-nyhavna`: `prj_87r4xPF1YIH4UvUwrOZBAnFzx0SM`, production `dpl_3CcKcvs7pw8zTkDDVEDnRsLUGYxw`, alias `placy-nyhavna.vercel.app`.
- Existing `/nyhavna` redirect on the main project remains. Temporary control-proxy experiment was removed and its removal published before this migration.
- `placy.no` uses external nameservers `ns1.proisp.no`, `ns2.proisp.no`. Available Vercel credentials do not provide authoritative DNS access. No DNS connector or connected browser surface was available during the readiness check.
- Neutral alias lookup `placy-platform.vercel.app` returned 404 through the current Vercel account. Availability is not claimed until assignment succeeds.
- Supabase read-only baseline: 60 sessions, all closed. 57 complete benchmark rows: $13.6504334 known; two incomplete benchmark rows: $0.1292083333 known lower bound and $10 retained reservation exposure; one complete anonymous demo row: $0.177338. These are all-time ledger totals, not the earlier bounded benchmark cohort.
- Existing public tenant: 5 concurrent, 60/hour, 200/24h, $100 rolling exposure, $5 reservation, 1,650-second maximum. Benchmark: 3 concurrent, 60/hour, 100/24h, $50 rolling exposure, same reservation/duration.
- Existing customer `nyhavna-utvikling` owns project `nyhavna-utvikling_nyhavna`. Leangenbukta remains under `placy-demo`.

## Initial system map

Interactive current/target/usage map checked using Playwright at 820px and 390px. Node selection, tab changes and annual-usage arithmetic passed; no JavaScript errors. Both screenshots visually inspected. This is a map of verified systems and a labeled target, not live telemetry.

## U1 — identity and admission

Migration 095 implements the service-only registry and fixed-order platform/customer/project/tenant admission. Session identity, purpose, model and rate snapshots are immutable; historical rows remain unassigned legacy records. Seed public/benchmark limits preserve the previous operating allowances, with combined customer/project ceilings of 8 concurrent, 120/hour, 300/24h and $150 rolling exposure; platform $200 includes historic liability and operating headroom. These are not sold quotas.

Proof-first evidence: the focused test initially failed with migration 095 absent; the SQL verifier also demonstrates that 093 accepted a legacy reservation without platform policy before applying 095. Parent reran the focused metering suites: 6 tests passed. Worker typecheck and focused lint passed. Full integrated checks remain below.

Real database proof passed with independent PostgreSQL connections against a unique disposable private schema on the hosted database. Migrations 093–095 were executed with only their `v2` namespace rewritten. Customer and platform final-slot races each admitted exactly one caller; sibling isolation, missing/disabled policies, ownership, all-purpose and old incomplete liabilities, idempotent seeds, immutable snapshots, owner fencing/deadline drain and anon/authenticated denial passed. Role changes used `SET LOCAL ROLE` inside transactions to work correctly with the transaction pooler. The verifier cleaned up its own schema; it did not alter live customer data, operational policies or ledger rows and made no provider calls.

The initial certificate check required Supabase's CA. The successful proof used the downloaded Supabase Root 2021 CA and `sslmode=verify-full`; no database SSL setting changed.

Production migration 095 then applied successfully. A before/after comparison confirmed all 60 existing rows retained their IDs, tenant/internal/customer/project identity, model/rate snapshot, accounting status and known cost; their new purpose field is null. The live read-only verifier confirmed Nyhavna's canonical registry, enabled public/benchmark tenants, all three required scope policies and denied anon/authenticated privileges. Existing public health still returned 200 with GPT-Live-1, Terra and Willow after the database change. Old tenants remain enabled only until the new application is proven and cut over.

## U2 / U4 — resolution and reporting

Parent verified the combined resolver/controller/route/report suite: 68 tests passed. The project resolver exercises both real content loaders and canonical identity; bad ownership, disabled/missing policies, client accounting fields and stale cross-project snapshots fail before provider creation. The pre-commit typecheck caught the Supabase timeout modifier placed after `maybeSingle`; moving it before the terminal modifier fixed the API typing without changing the timeout. The 18 resolver tests and commit typecheck then passed.

The live private CLI read with `--project nyhavna-utvikling_nyhavna --purpose public` returned zero selected sessions before cutover, as expected. Its separate unfiltered operational view included all 60 historical attempts, $13.8277714 complete calculated cost and $10 unresolved liability, leaving $176.1722286 of the $200 platform exposure allowance at that read. Customer/project views remained empty; historical internal demos were not silently reassigned. Read-only reporting made no provider calls.

## U3 and integrated local checks

The shared `/p/[slug]` page resolves canonical project data server-side and forwards only the public selector to the browser. Nyhavna retains its existing shell/assets; the old path redirects with query parameters intact. The client selector test first failed because readiness omitted the project (35 existing tests passed), then all 36 client tests passed after wiring. Parent reran 36/36 and inspected the actual nine-file diff. Page/layout proof is the published browser gate below, not an isolated mocked React assertion.

`ce-simplify-code` completed reuse, quality and efficiency passes. No reuse/quality findings. Two optional reporting optimizations were left unchanged: parallelizing the private reads alters fail-first ordering, and streaming admission aggregation changes the snapshot interface. Neither is needed for current correctness; no safety check was removed. No simplification edits applied.

Local lint passed with 0 errors / 54 warnings. The full local suite passed 4,492 tests and failed four in the pre-existing provisioning orchestrator suite: an unmocked isochrone step made network calls and timed-out tests polluted later call-order expectations. The test now mocks that step, includes it in the expected orchestration order, and isolates revalidation fetches; its 19 tests pass in 23 ms without live network. Production provisioning code is unchanged. TypeScript and production build passed. The final full suite will also run in the candidate Vercel build; the failed initial local run is not claimed as fully green.

## Model cost clarification

Andreas asked specifically about a lighter GPT-Live voice model. Official model catalog and GPT-Live documentation checked 2026-09-17 show GPT-Live-1 and no documented Live Mini/Light. Realtime Mini is a different protocol/integration. The proposed Luna backend change was canceled on clarification; public and benchmark configuration remain unchanged. Technical infrastructure tests make no paid AI calls; the release gate remains one short bounded real call, not a repeat of the prior long benchmark campaign.

Sources: [model catalog](https://developers.openai.com/api/docs/models/all), [GPT-Live pricing](https://developers.openai.com/api/docs/models/gpt-live-1), [protocol migration](https://developers.openai.com/api/docs/guides/live-migration).

## Candidate deployment

Candidate `dpl_7z8xRdGPxjFvVbgRjhJGUiJietoM`, code commit `606d205`, built with production settings and `--skip-domain`. URL: `https://placy-nyhavna-pdo68wbyk-andreas-harstads-projects-849bb7ff.vercel.app`. The existing public aliases were not promoted by this build.

Vercel ran lint, full tests, TypeScript and production build successfully: **4,495 passed, one optional PGlite test skipped** in 283 files. The skipped database fixture has local PGlite and actual hosted independent-connection proof in U1. Anonymous candidate check passed: `/p/nyhavna` 200, robots meta/header `noindex, nofollow`, robots allows `/p/`, project health 200, no access cookie, no paid call.

Candidate browser proof passed at 1440×900 and 390×844: map tiles/markers visible, Nyhavna branding/fonts preserved, no JavaScript errors, no local resource HTTP failures, all visible images loaded and no horizontal overflow. Both screenshots were visually inspected. Refresh worked; unknown project returned 404; legacy URL preserved `?voicedev=1` and ended at `/p/nyhavna` with 200. Anonymous/cross-origin control requests were denied (404), recovery without credentials denied (401), admin redirected (307), and hosted POST to the local-only prototype endpoint denied (404).

## Review correction — report product identity

The independent review identified that `ReportReelsPage` expects the render object's `Project.id` to be the report product UUID, while the first shared resolver supplied the canonical project container ID. That would reject board analytics at the existing event schema. Voice ledger identity was already correct. The resolver now reads and verifies the project's report product in parallel with ownership/policy reads, preserves the product UUID for rendering, and keeps the canonical project container on the admission tenant. It also checks the container matches the renderer's customer/slug convention.

The strengthened resolver fixture runs both real content loaders through the real analytics event schema and verifies page/ledger project agreement. Four tests failed before the fix; 91 focused resolver/controller/route/event tests passed afterward. Missing, misowned or wrong-type products fail before content/provider loading. Actual Nyhavna report product `063a0b6a-edb3-4fb2-885d-c594ddd46063` was verified read-only. Candidate above is superseded for release until this correction is rebuilt and rechecked.

## Completed review and caller-owned correction

`ce-code-review` completed with `status: complete`, run `20260917-125511-f980b544`, artifact `/tmp/compound-engineering-501/ce-code-review/20260917-125511-f980b544`. Its durable unmodified receipt is [shared-platform-code-review.json](shared-platform-code-review.json). All ten local reviewers and the independent Claude peer completed. Of three merged candidates, analytics was already repaired and independently validated; signed benchmark-purpose refusal was reconciled as intentional fail-closed accounting, with anonymous-cookie guidance added to operations. One P2 remained: operational registry failures looked like missing projects.

The caller dispatched one coupled resolver/page/health fix batch for finding #1. The resolver now preserves the distinction between unknown/disabled/inconsistent identity and dependency failure. Unknown projects remain 404; health returns safe no-store 503 for operational failure; the page uses a Norwegian retry boundary without showing raw database details. Admission still fails before paid creation. Parent inspected the diff and ran the combined resolver, route, controller, page and browser-client suite: **101 tests passed**. No benchmark fallback or model change was made. No justified review finding remains deferred after this correction.

The analytics-corrected intermediate candidate `dpl_6BRbSPFjbydVC5TjARk3WT56FZk7` (commit `4c1e609`) passed lint, 4,497 tests with one optional database-fixture skip, TypeScript and production build; desktop/mobile checks also passed. Read-only production events confirmed board views with `project_id=nyhavna-utvikling_nyhavna` and `product_id=063a0b6a-edb3-4fb2-885d-c594ddd46063`. This candidate was not promoted; the outage correction requires the final build below.

## U5 — final production cutover

Final candidate **`dpl_8RtoKwB491jQzDtwTPFCsRRwH6nZ`**, application commit **`11c78d1`**, built successfully with production configuration and `--skip-domain`: lint 0 errors / 54 warnings, **4,511 tests passed and one optional PGlite fixture skipped** in 284 files, TypeScript passed, production build passed. Actual independent PostgreSQL race/role proof is recorded under U1; the skipped default fixture is not treated as a new concurrency proof.

Candidate URL: `https://placy-nyhavna-nrqtfmy9g-andreas-harstads-projects-849bb7ff.vercel.app`. Final candidate desktop/mobile checks passed at 1440×900 and 390×844 with visible map/branding, loaded images, no horizontal overflow, no JavaScript errors or local resource failures. Both screenshots were inspected. Refresh, unknown-project 404, legacy redirect with query preservation, anonymous health and noindex meta/header/robots passed. Neutral alias `placy-platform.vercel.app` was then assigned to this candidate.

Exactly **one paid call** was made during this shared-platform migration, on the neutral alias in a fresh anonymous browser. One audio fixture was played after the greeting: user audio was transcribed, Anja replied, two map messages arrived, and manual stop produced `ended` plus idle UI with “Snakk med Anja igjen”. No second paid start was made; restart state handling also remains covered by the client regression suite. The three-minute harness deadline bounded the proof; no benchmark loop or long-duration campaign was repeated.

Ledger row `49645796-4e46-4d28-a823-def54c880b74` belongs to tenant `nyhavna-public`, customer `nyhavna-utvikling`, project `nyhavna-utvikling_nyhavna`, purpose `public`, environment `production`. It is `closed` / `complete`, with 73 voice seconds and two known-rate backend usage events. Components reconcile exactly: **$0.0608333333 voice + $0.119898 backend = $0.1807313333 total**. Models remain GPT-Live-1 / GPT-5.6-Terra / Willow. This is a synthetic anonymous release check, not an organic customer visit, representative average, invoice or automatic customer charge.

The verified deployment was promoted to production. Both old tenants (`nyhavna-lokal-demo`, `nyhavna-lokal-benchmark`) were then disabled for new admission after the script rechecked the complete, correctly attributed anonymous proof. No session history, ownership or cost was rewritten. All 60 historical rows retain legacy meaning; one new project-bound session exists. No nonclosed sessions remained in the post-cutover read. The private project report selected exactly that new session and reconciled its components. The separate platform view retained $10 unresolved historical exposure and $0.1292083333 known incomplete lower bound; rolling platform exposure was $24.0085027333 with $175.9914972667 headroom at the report cutoff. These scope views overlap and are not additive.

Post-promotion HTTP checks passed for the neutral URL, old Nyhavna link and `https://placy.no/nyhavna`; all ended at a 200 noindex project page. The short link remains a redirect through the old compatible alias. Missing/wrong-origin control requests returned 404, unauthenticated recovery 401, disabled admin 307, unknown-project health 404, and local-only POST 404. Public health returned the unchanged model/voice, project selector and WebSocket transport. The neutral alias resolves to the final deployment; main `placy.no` still resolves to **`dpl_ENuhYMxhiAeAEtdSDxvLGQESZY1k`**. No main-site code publication, DNS change or Git push occurred.

## Post-deploy monitoring and rollback

Owner: Andreas, during initial internal use and daily while the link is being shared. Expect new public sessions with the verified customer/project/purpose, clean closure and complete usage; inspect the private usage report and `voice_recovery_failed`, `voice_recovery_unresolved`, `voice_finalization_pending` markers. Check public health without a benchmark cookie. Investigate any growing incomplete liability, unexplained new sessions, repeated start failures or session/map cross-talk before broader distribution. Disable affected tenant admission immediately for uncontrolled paid creation or isolation failures, while preserving active-call cleanup and recovery. Roll back only to a registry-compatible deployment; never reopen unbound legacy tenants to make an older release work.

First-party `app.placy.no` remains unconfigured because authoritative DNS is at PRO ISP and no authorized DNS editing surface was available. This does not block the shared runtime or existing short link. No high-load certification, hosting/map cost allocation, final customer pricing or automated billing is claimed.

## U6 — final map and completion

The final neutral alias also passed the full desktop/mobile page check after promotion, including map/images, refresh, noindex, unknown-project 404 and legacy query preservation; both screenshots were inspected. Final system-map node selection, all tabs, operational-limit detail and usage/cost arithmetic passed at 820px and 390px with no JavaScript errors or overflow. Desktop/mobile topology and cost views were visually inspected. The map now marks Nyhavna live, leaves next projects inactive, distinguishes the older main site, shows the private operator report and labels the unconfigured first-party domain and unallocated map/hosting costs.

The machine-readable, secret-free release receipt is [shared-platform-release-2026-09-17.json](shared-platform-release-2026-09-17.json). Application code is unchanged since the verified deployment; subsequent changes are documentation only.

All **6 of 6 implementation units** and **10 of 10 requirements** were checked:

| Requirements | Completion evidence |
|---|---|
| R1–R2 | Shared server resolver, product/container identity separation, tamper/stale/disabled/outage regressions and attributed paid proof. |
| R3 | Two distinct content/session fixtures, published Nyhavna UI/audio/map behavior and unchanged model/voice. |
| R4 | Immutable new customer/project/purpose; 60 historical records retain original meaning. |
| R5–R6 | Independent PostgreSQL admission races/roles, fixed-order shared limits, recovery/fencing and retained old liabilities. |
| R7 | Private filtered report reconciles the real session; unfiltered headroom and incomplete amounts remain separate. |
| R8 | Shared neutral runtime live, anonymous/noindex legacy links work, main production deployment unchanged. |
| R9 | Idempotent ownership-preserving provisioning; both old unbound admission tenants disabled after proof. |
| R10 | Interactive map and operations documents match the verified final topology and explicitly state remaining boundaries. |

No actionable code-review finding remains. DNS, commercial pricing, broader cost allocation and human microphone/voice-quality checks remain explicit operational boundaries, not undisclosed completed work. Existing historical incomplete usage still requires independent provider-billing reconciliation; this migration preserved it.
