# OpenAI cost reconciliation

Status: Admin access and actual Costs reads verified on 2026-09-17 for OpenAI project Placy. First comparisons require review: an omitted cache-write premium was found in the existing voice tariff. This is not an automatic billing or ledger-repair service.

## Access

Model/API access is already used by Anja. Organization cost data uses a separate Admin API key. Only an organization owner can create one in [OpenAI Admin keys](https://platform.openai.com/settings/organization/admin-keys). Keep `OPENAI_ADMIN_KEY` in the ignored local `.env.local` or operator environment. Do not put it in chat, Git, browser variables or the public Vercel app. The reader sends it only in the Authorization header to fixed `https://api.openai.com/v1/organization/` GET endpoints; it never falls back to the inference key.

This release adds no account mutation, budget change, cron, public endpoint, deployment or key rotation. Project listing, key metadata and actual Costs reads are verified; the admin key is stored only in the local ignored environment file. Historical per-session provider identity remains unverified.

## Run

From the `placy-voice-infrastructure` checkout:

```bash
# Identify the provider project; a Placy customer/project ID is not an OpenAI project ID.
npx tsx scripts/openai-reconcile.ts --list-projects

# Private unfiltered snapshot, including legacy/internal work and every environment.
npx tsx scripts/voice-costs.ts --format json > .context/openai-reconcile-ledger.json

# UTC period: from inclusive, to exclusive. Prefer elapsed days, then recheck later.
npx tsx scripts/openai-reconcile.ts --openai-project proj_CONFIRMED \
  --from 2026-09-10 --to 2026-09-17 \
  --ledger .context/openai-reconcile-ledger.json > .context/openai-reconciliation.json
```

Dates must be real calendar dates spanning 1–180 UTC days. All provider pages are read. Missing or overlapping buckets, duplicate groups/cursors, wrong project/currency, malformed amounts and HTTP failures stop the command rather than emit a partial total. A returned empty day is zero; a missing day is not. Provider credits can be negative. The CLI `--help` requires no credentials or network.

## Reading the result

- `providerUsd`: the selected OpenAI project's reported USD, grouped by day, line item and API key ID. Raw credentials are never included.
- `ledger.completeUsd`: the voice ledger's complete estimates for sessions entirely inside the period. `incompleteKnownUsd` is a separate known lower bound.
- `ledger.groups`: these same ledger amounts by Placy customer, project and purpose. They are not a second set of costs and must not be added to the ledger total.
- `unallocatedDifferenceUsd`: provider total minus known contained ledger costs. This is a comparison aid, not an amount to allocate to Nyhavna. It is null when either observation predates the interval end or a call crosses its boundaries; amounts for boundary calls are not arbitrarily assigned to a day.
- `ledger_changed_during_export` marks a session that closed after the export cutoff. The source performs separate reads, so this is valid evidence of a changing snapshot, not corrupt data.
- `status` stays `needs_review`, even for an exact numeric match. The ledger does not yet contain a verified provider-project/API-key mapping for every historical call. The OpenAI project may include unmetered/non-voice work, and recent provider data may change. Filtered ledger exports are refused because a customer subset cannot represent a shared provider project.

For a meaningful review, establish which keys/projects served the voice calls over the selected period, identify other work billed there, confirm elapsed-period observations, and inspect line items. Daily provider totals do not prove an individual call's missing final usage. **Never close incomplete sessions, release reservations, or charge a customer just because aggregate totals happen to match.** Historical liabilities remain untouched. The existing `reconciles` field in voice-costs checks internal ledger components; it does not mean reconciliation to the OpenAI bill.

The first live check must confirm account/project identity, accepted grouping parameters, complete pagination/bucket coverage and actual Live line items. If the provider response differs from the documented contract, retain the failure and adapt the parser with a sanitized fixture; never substitute zeros or fabricated values. No additional production monitoring is required for this local CLI because it is not imported by a serving route and performs no writes. The operator should retain dated private reports and repeat reads for recent periods before concluding anything about differences.

## Sources

Checked 2026-09-17: [Costs API](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs), [Admin API keys](https://platform.openai.com/docs/api-reference/admin-api-keys). Costs currently supports `project_id`, `line_item` and `api_key_id` grouping with one-day buckets. These are provider identities, not Placy customer identities.

## Local verification — 2026-09-17

- 14 focused tests passed, including pagination, amount/currency/project validation, sanitized HTTP failure, dates, filtered/duplicate exports, incomplete/boundary sessions and credits. The initial focused run failed because the new implementation module did not exist; after implementation it passed. An earlier test-environment setup error was corrected before that red observation.
- Full suite: 4,601 tests / 286 files passed. Lint: zero errors / 59 existing warnings. TypeScript and production build passed. Targeted ESLint includes the CLI, which the standard lint command does not cover.
- `--help` works without credentials. `--list-projects` currently exits with a controlled missing `OPENAI_ADMIN_KEY` error; this is not authenticated API verification.
- Fresh unfiltered ledger export at `2026-09-17T14:02:28.638Z`: 63 rows, 61 complete and two incomplete. Parser compatibility passed using an explicitly synthetic empty provider bucket. No actual provider amount or delta is claimed. A preceding transient usage-read failure emitted no partial report; the subsequent complete read succeeded.
- Simplification: no reuse findings; one quality correction consistently uses the validated provider object; one optional early CLI argument check was skipped as low value because it only avoids a small local environment-file load on invalid invocations. No network request is made for missing arguments.
- No production deploy, Git push, paid inference, account setting change or ledger write is involved.

Review follow-up: one confirmed P2 producer/consumer mismatch was fixed. The ledger exporter filters creation timestamps but can read an end timestamp after its cutoff; the comparison now accepts it and marks `ledger_changed_during_export`, retaining creation and timestamp-order checks. Regression observed red (1 failed / 14 passed), then all 34 provider/ledger tests passed (15 new comparator tests + 19 existing ledger tests). The full 4,601-test suite and build above preceded this narrowly scoped repair; final targeted lint and TypeScript were repeated.

Completed code-review receipt: [openai-reconciliation-code-review.json](openai-reconciliation-code-review.json), run `20260917-160147-10d52c80`, six local lenses plus independent validation of the sole P2. No cross-model pass: the sanctioned peer diff path could not include the explicitly scoped untracked files without Git mutation, so a local adversarial pass was used. The receipt preserves its pre-fix snapshot. Finding #1 was applied inline under the single-finding exception; no findings were rejected or left unresolved in code. Actual closure timestamps remain visible with a changing-snapshot warning; observations before the requested period end still suppress the delta. The optional transport-error and invalid-JSON coverage gaps were also addressed. Authenticated provider verification subsequently completed; see the live findings below.

Final focused result after the two added provider-failure cases: **36 passed** (17 provider + 19 ledger).

## First authenticated comparison — 2026-09-17

[Sanitized live evidence](openai-reconciliation-live-2026-09-17.json). The Admin key was entered through a hidden local macOS dialog, saved without printing its value, and used only for GET requests. It was not copied to Vercel, Git or a public app. The existing inference key still returns 200 on a read-only model-list request. Its redacted prefix/suffix matches the sole key metadata entry in the selected Placy project; this is current configuration evidence, not proof of every historical session's identity.

For 10–16 September UTC, seven daily provider buckets sum to **$21.5354661694**. The ledger contains seven sessions and **$0.9909740667** for that interval, an unallocated difference of **$20.5444921027**. Its first row is **16 September at 20:29:59 UTC**, so the earlier provider history is outside ledger coverage. The difference is not a Nyhavna charge or evidence of unexplained spend on its own.

For 17 September (still an open UTC day), provider cost was **$13.7547054991**, versus **$13.349405** known ledger cost: $13.2201966667 complete and $0.1292083333 known lower bound from two incomplete sessions. The CLI correctly leaves the period's final difference null. Recent provider data may still change.

**Confirmed tariff defect, not yet repaired:** provider backend total $5.5972055 versus ledger $5.204405 differs by **$0.3928005**. The provider's cache-write line is $1.9640025. Terra cache writes cost 1.25 times base input, so charging those writes at base price misses exactly $1.9640025 × (1 − 1/1.25) = **$0.3928005**. Current normalization/sideband drops `cache_write_tokens`, and the saved v1 JS/SQL tariff only handles ordinary input, cached reads and output. This establishes a pricing defect; it does not provide cache-write counts per historical session. [Official Terra pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

The voice difference is about **$0.0125**, equivalent to 15 seconds at the current voice tariff. Its per-session cause is unresolved; the two incomplete calls and the open reporting day prevent a final conclusion. Do not close historical liabilities or spread these aggregate differences across customers.

**Required follow-up before treating costs as invoice-aligned:** capture cache-write counts through provider event normalization, durable events and SQL; version the price snapshot; test JS/SQL parity; expose historical tariff uncertainty in reports; validate the production change separately. Existing history stays intact. This access-verification session changed no application code, production deployment, budgets, ledger statuses or billing automation.
