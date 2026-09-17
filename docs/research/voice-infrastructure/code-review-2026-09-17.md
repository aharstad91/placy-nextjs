# Hosted voice code review — 2026-09-17

All seven code corrections were reviewed and cleared in the working tree. No code findings remain from this review. Final hosted audio and recovery evidence remains a release gate owned by the deployment workflow; this receipt does not certify those runs.

## Scope and coverage

- Original snapshot: `fc83a56..b34062d6f407f3067b8e6af2ae3acb30d9ede640`, branch `feat/voice-infrastructure`: 49 changed files, 4,399 changed lines, including 1,644 executable non-test lines.
- Resumed the interrupted September 16 review: 41 of 49 file diffs were identical; eight changed-file deltas were inspected. Prior security, reliability, migration, frontend-race, testing, standards, maintainability, performance and API-contract coverage was reused, not represented as independently rerun on those deltas.
- Fresh full-diff correctness, institutional-learnings and independent adversarial review completed. The external review served `claude-opus-5`; requested effort was high, actual effort unverified. The verified result was collected and its worker state removed.
- Eight original findings entered independent validation. Seven were confirmed, including the hosted-evidence gate. The benchmark startup-budget finding remained an unresolved snapshot verification gate because the validator's rejection did not account for the health request preceding the client timer.
- Two supplemental passes inspected all affected runtime/test changes. A final inspection covered the diagnostic-only benchmark stage addition. The reviewed runtime/test working-tree diff against `b34062d6` has SHA-256 `e71f8c97ac0bab1ca3c122bffac5fa849f2133213be6020e27c742b4ad3041b6` (the nine paths listed below, in that order).

## Corrections validated

| Original concern | Verified correction |
|---|---|
| Hosted startup could exceed the shared 15-second timer | Separate 75-second hosted handshake; media listener remains early, but its 15-second timer starts immediately before remote SDP application. Delayed permission, handshake, media and timeout regressions inspected. |
| Disabling admission also disabled stale-session recovery | Recovery remains available with valid `CRON_SECRET` authentication when `PLACY_HOSTED_VOICE=false`; authentication and missing-secret regressions inspected. |
| Benchmark inherited a 30-second startup wait | Explicit 120-second readiness window accommodates the revised client phases; the overall finite run deadline remains enforced. |
| Cost exports serialized every session's event reads | Batches of at most ten preserve session order and serial per-session pagination; failures stop later batches. Ordering/concurrency/error regressions inspected. |
| Isolation proof could pass after a peer failed to start | The second attempt requires the first peer to have started and passed before asserting isolation after its stop. |
| Unreadable ledger could produce apparently current aggregates | Both distributions and scenario groups become null when the ledger is unreadable. |
| Distinct benchmark failures collapsed into a generic reason | Fixed allowlisted diagnostic reasons survive; arbitrary provider/browser error contents remain excluded. Privacy regression inspected. |

Supplemental paths, in hash order: `app/api/live/recover/route.ts`, `app/api/live/recover/route.test.ts`, `lib/live/use-live.ts`, `lib/live/use-live.test.tsx`, `lib/live/cost-report.ts`, `lib/live/cost-report.test.ts`, `lib/live/benchmark-scenarios.ts`, `lib/live/benchmark-scenarios.test.ts`, `scripts/voice-benchmark.ts`.

The final `Attempt.stage` addition records only fixed phase labels around startup, greeting, playback, response, quiet, duration, peer stop and stop. All assignments and updated `waitForQuiet` call sites were inspected: the field is not read by control flow and changes no timeout, request, admission, pass/fail or teardown behavior. It adds diagnostic output without transcript or raw-error content. No further code finding resulted.

## Release evidence and limits

The original snapshot's **Not ready** verdict is historical: it includes code findings now corrected and the incomplete R7/R8/U6 evidence. It must not be interpreted as a fresh defect verdict against the reviewed working-tree fixes.

The deployment workflow must attach completed repeated audio scenarios and durations, concurrent-session isolation, disconnect/owner-loss recovery, and reconciled attempted/passed/failed plus complete/incomplete cost evidence before declaring the full plan complete. Failed or shortened runs remain in the evidence; a diagnostic stage marker does not turn them into successful duration tests. Mechanical checks and the final deployed revision also remain the deployment workflow's responsibility.

Supplemental validation was source/test inspection. The root workflow reported targeted passing tests; reviewers did not independently rerun those tests, make paid provider requests, or deploy. Proposals to release unknown liabilities or infer provider closure were rejected because the explicit plan requires fail-closed retention.

Detailed local receipts: `/tmp/compound-engineering-501/ce-code-review/20260917-voice-b34062d6/` (`review.json`, `metadata.json`, `supplemental-validation.json`). The complete staged review log and receipt were written; no detached review jobs remain.
