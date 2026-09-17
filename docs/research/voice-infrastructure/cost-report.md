# Operator conversation costs

Run from the repository root with `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The CLI uses the existing uncached server wrapper. Migration 093 must be applied. This is a local operator tool; no public route or `ADMIN_ENABLED` gate is involved. Never distribute the service-role key to demo visitors.

```sh
npx tsx scripts/voice-costs.ts --tenant nyhavna --environment production --format json > voice-costs.json
npx tsx scripts/voice-costs.ts --test-run RUN_ID --format csv > voice-costs.csv
npx tsx scripts/voice-costs.ts --customer CUSTOMER_ID --format json
```

Run `--help` for all filters. Filters combine with AND. JSON includes individual sessions and component totals, complete sample counts, median, nearest-rank p95 and maximum. Each statistical group has its own tenant/customer/project/internal demo, environment, test run and scenario. Synthetic runs and customer observations never share an implicit average. Provisional and incomplete counts and known lower-bound costs are separate and excluded from all complete statistics. Empty distributions use null statistics. CSV contains the individual rows for export; use JSON for summary statistics. All CSV fields are quoted and spreadsheet formula prefixes are neutralized.

The provider-reported units are voice seconds and backend input/cached/output tokens. Cached tokens are a subset of input, not extra input. USD values are calculated estimates from persisted versioned tariff evidence, not provider invoices. Voice cost uses the session tariff snapshot; backend cost sums persisted deduplicated usage events. Missing evidence or an event/session reconciliation mismatch downgrades an otherwise complete report row to incomplete. Unknown component costs remain unknown; known lower bounds are never presented as final totals. Session duration is wall-clock creation-to-end time, distinct from metered voice seconds. Models, rate/config/dataset versions and termination reason are included. No owner token or transcript is selected or exported.

Reads use an initial UTC cutoff, `created_at <= cutoff` for sessions and `received_at <= cutoff` for events, with stable ascending primary-key cursors. They continue until an empty page, including when the database applies a page cap below 1000. Event reads run in batches of at most ten sessions, retaining output order; any database error aborts without emitting a partial report or scheduling later batches. These separate REST reads are not a transactional snapshot: sessions can receive late usage/finalization during export. Reconciliation detects component drift; for repeatable final figures export after the run and its recovery have settled, retaining the cutoff. Reports describe the state observed, not a historical reconstruction as of cutoff.

Vercel and Supabase subscriptions and shared platform usage are **separate operating expenses**. This report neither fetches those bills nor fabricates a per-call allocation. Pricing decisions must add verified billing-period platform expenses and an explicit allocation policy separately. Synthetic benchmark distributions alone do not establish a real customer distribution.

Verification: `npx vitest run lib/live/cost-report.test.ts`, targeted ESLint and TypeScript. Tests cover arithmetic, incomplete exclusion, empty/unknown data, separate cohorts, capability exclusion, 1001 sessions/events with capped pagination, filter/cutoff forwarding, denied reads and CSV escaping. [Live grant denial](database-verification.md) and [52 reconciled paid sessions](hosted-validation-2026-09-17.md) are recorded separately, including two incomplete costs rather than treating missing final usage as zero.
