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

## Supplemental review: rolling transcript observation

Reviewed all three working-tree changes against `2c55f70e1343a68bad7daee5c3fc4f262f6b9743`: new `lib/live/benchmark-observation.ts`, its test file, and the runner's observation replacements. No new code findings.

The new cursor uses the latest assistant message ID and its fragment length, so evicting older entries from `useLive`'s 100-message history cannot hide a shorter new reply. Same-message appended fragments also advance the cursor; user-only changes do not. Quiet detection resets for a changed assistant identity or length and while status is not listening. All runner call sites use the new functions.

Loaded the helpers through the runner's `node --import tsx` path and inspected their actual serialized function bodies: they contain no module-local dependencies or injected helper references. Type-only imports disappear; each function uses browser globals and its serializable argument. The cursor exports only generated message identity and numeric length, not transcript text. Inspected the three regression tests and the root-produced test log: both observation/scenario files passed, seven tests total. Actual-browser rollover verification and the near-limit rerun remain owned by root.

The prior 26-minute attempt that failed during response observation after 31 clips and 1,425 metered seconds remains a failed duration test with complete accounting. This source correction does not retroactively mark that attempt, or earlier failed attempts, passed.

## Supplemental review: stop-fixture expectation

Reviewed the runner-only correction for `11-stopp` against the existing voice policy: a pure stop requests waiting, so requiring a new spoken reply was incorrect. The corrected branch requires a fresh three-second stable-listening interval and records `quietAfterStop=true` only after it succeeds. The separate `09-avbrudd` fixture still waits for speaking before injection and requires a new assistant reply; that interruption assertion is unchanged.

Review found and reproduced a stale quiet-timer gap: an unchanged cursor from the previous reply could satisfy the stop observation immediately. The final runner clears `placyBenchmarkQuiet` before every quiet wait. Reinspection and an offline deterministic reproduction confirmed false at zero and 2,999 ms, then true at 3,000 ms for an unchanged listening cursor. Root additionally reports actual-browser verification with a 60-second-old prior cursor. No remaining code finding in this correction.

Earlier failed interruption attempts remain failed. The intermediate batch started before the fresh-window correction retains that observation limitation and cannot supply the final stop-silence evidence. Root owns the new three-repeat run and its recorded results.

## Supplemental review: listening after a pure pause request

Reviewed the subsequent `lib/live/use-live.ts` and hook-test diff against `2c55f70e1343a68bad7daee5c3fc4f262f6b9743`. The accumulated current transcript recognizes only pure Norwegian `stopp`, `vent` or `vent litt` with optional punctuation. A pause suppresses the inferred thinking state; it neither closes the provider session nor changes voice instructions, metering or admission. Appended question text and a new non-pause utterance clear the flag. The flag starts false for every connection, and active-connection guards remain intact.

Actual received-audio speaking and its existing linger check still take precedence over the pause flag, so the change cannot label audible speech as listening merely because a stop was requested. Inspected three parameterized/test cases covering the pure commands, the next utterance and a question appended in a later fragment. No new code finding; test execution and the newly deployed real-audio interruption check remain with root.

This addresses the observed UI state that otherwise remained thinking indefinitely when the voice correctly gave no answer to a stop. Prior quiet-stage failures remain failed. Long-duration results from the earlier build remain scoped to that build's transport and accounting behavior and do not verify this later status correction.
