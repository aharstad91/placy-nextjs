# Shared platform migration — verification

Status: implementation in progress, not yet deployed. Date: 2026-09-17.

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

## Model cost clarification

Andreas asked specifically about a lighter GPT-Live voice model. Official model catalog and GPT-Live documentation checked 2026-09-17 show GPT-Live-1 and no documented Live Mini/Light. Realtime Mini is a different protocol/integration. The proposed Luna backend change was canceled on clarification; public and benchmark configuration remain unchanged. Technical infrastructure tests make no paid AI calls; the release gate remains one short bounded real call, not a repeat of the prior long benchmark campaign.

Sources: [model catalog](https://developers.openai.com/api/docs/models/all), [GPT-Live pricing](https://developers.openai.com/api/docs/models/gpt-live-1), [protocol migration](https://developers.openai.com/api/docs/guides/live-migration).

## Remaining gates

Production database migration/live permissions, application checks, independent code review, candidate publication, real anonymous audio/ledger proof, alias cutover and final map update remain required. Do not treat this document's presence as a deployment receipt.
