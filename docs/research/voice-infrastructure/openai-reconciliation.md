# OpenAI cost reconciliation

Status: local read-only comparison implemented; live provider verification pending `OPENAI_ADMIN_KEY` and confirmation of the correct OpenAI project. This is not an automatic billing or ledger-repair service.

## Access

Model/API access is already used by Anja. Organization cost data uses a separate Admin API key. Only an organization owner can create one in [OpenAI Admin keys](https://platform.openai.com/settings/organization/admin-keys). Keep `OPENAI_ADMIN_KEY` in the ignored local `.env.local` or operator environment. Do not put it in chat, Git, browser variables or the public Vercel app. The reader sends it only in the Authorization header to fixed `https://api.openai.com/v1/organization/` GET endpoints; it never falls back to the inference key.

This release adds no account mutation, budget change, cron, public endpoint, deployment or key rotation. Account access and the actual Costs response remain unverified until the first successful read.

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

Completed code-review receipt: [openai-reconciliation-code-review.json](openai-reconciliation-code-review.json), run `20260917-160147-10d52c80`, six local lenses plus independent validation of the sole P2. No cross-model pass: the sanctioned peer diff path could not include the explicitly scoped untracked files without Git mutation, so a local adversarial pass was used. The receipt preserves its pre-fix snapshot. Finding #1 was applied inline under the single-finding exception; no findings were rejected or left unresolved in code. Actual closure timestamps remain visible with a changing-snapshot warning; observations before the requested period end still suppress the delta. The optional transport-error and invalid-JSON coverage gaps were also addressed. Authenticated provider verification remains pending.

Final focused result after the two added provider-failure cases: **36 passed** (17 provider + 19 ledger).
