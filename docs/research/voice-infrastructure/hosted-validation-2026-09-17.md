# Nyhavna hosted voice validation — 2026-09-17

Follow-up: the shared demo now opens without an access code and declares `noindex, nofollow`. See [public-access verification](public-access-2026-09-17.md). The authenticated tests below describe the initial release.

Nyhavna is live for internal demo use at https://placy-nyhavna.vercel.app/demo/nyhavna-lokal. All six short scenarios have three passing executions; duration checks passed at 5/15/26 minutes, along with concurrent isolation, disconnect, silence and controlled ownership loss. Access requires the demo code. This is automated functional evidence, not human voice-quality validation or production reliability at scale.

## Revision and deployment

- Dedicated project: `placy-nyhavna`; entry point: https://placy-nyhavna.vercel.app/demo/nyhavna-lokal.
- Initial runtime corrections: local commit `2c55f70`, based on infrastructure snapshot `b34062d`; later pause-status correction is described below. No Git push.
- Audio candidate: `placy-nyhavna-elhv9mjva-andreas-harstads-projects-849bb7ff.vercel.app`.
- First fully checked candidate: `placy-nyhavna-ifcovpav8-andreas-harstads-projects-849bb7ff.vercel.app`. Runtime is identical to the initial audio candidate. The corrected-observer 26-minute run targets this revision.
- Final candidate: `placy-nyhavna-9svrkpcz2-andreas-harstads-projects-849bb7ff.vercel.app`. Adds the pause-status correction and final benchmark observations. New interruption tests target this exact build. The earlier duration runs establish transport/accounting behavior, not this later status correction.
- Models and content: GPT-Live-1, Willow, GPT-5.6-Terra; snapshot `nyhavna-lokal-9c5df28b80e5a9b9`.

## Mechanical checks and access

The final candidate ran `npm run lint && NODE_ENV=test npm test -- --maxWorkers=2 && npx tsc --noEmit && npm run build` as its actual Vercel build command. All 281 test files / 4,452 tests passed; lint had zero errors and 53 existing warnings; TypeScript and production build passed. Earlier checked revisions passed 4,446 and 4,449 tests before the added regressions. The initial full remote run found two tests dependent on ambient production configuration. They now explicitly stub the hosted-voice flag or absent Google Places key. All 17 tests in those files also passed locally with conflicting environment values supplied.

The local full-suite attempt was stopped after machine contention caused unrelated five-second timeouts. It is not counted as a passing run. Local lint, TypeScript, focused regressions and commit hooks passed; the complete remote run is the full-suite release evidence.

On the checked candidate, unauthenticated health and control returned 404, recovery returned 401, and admin redirected with 307. Demo-code submission returned 303, followed by authenticated health 200 and the intended models/WebSocket transport. No operator login was needed. Desktop 1440×900 and mobile 390×844 access/map layouts were visually inspected on the audio candidate; the desktop map was checked after tile loading, not inferred from an early blank screenshot.

## Recovery experiment

Run `owner-loss-2026-09-17T07-04-55-580Z` created exactly one benchmark session. The harness guarded its update by session ID, run ID, tenant, current owner and active state, replaced that session's owner capability, and expired its lease. Authenticated deployed recovery claimed one session, closed one provider call and left zero unresolved calls. The old owner was fenced and the browser terminated.

This proves ownership/lease-loss recovery; it is **not** a physical Vercel-process kill. The 15-second voice checkpoint and $0.0125 known lower bound survived. Final usage was unavailable, so the row correctly remains `incomplete` with `provider_closed=true` and its $5 reservation retained. No evidence was fabricated and no liability was released to make the report look complete.

## Audio matrix and costs

The [machine-readable evidence](hosted-evidence-2026-09-17.json) preserves every run, attempt and reconciled cost row. The [CSV export](hosted-costs-2026-09-17.csv) contains the same 52 paid sessions. Cost cutoff: 2026-09-17T08:04:48.262Z. All rows reconcile with persisted component events: **50 complete, 2 incomplete**, none provisional or open. Complete calculated costs total **$12.659459**; incomplete known lower bounds total **$0.129208**. These mixed test-expenditure totals are not a conversation-price distribution.

| Run label in evidence | Started attempts | Passed | Failed | Paid rows |
|---|---:|---:|---:|---:|
| resume-short | 18 | 7 | 11 | 18 |
| resume-long26 | 1 | 0 | 1 | 1 |
| resume-long15-5 | 1 | 1 | 1 | 1 |
| final-short | 18 | 15 | 3 | 18 |
| final-long26 | 1 | 0 | 1 | 1 |
| verified-long26 | 1 | 1 | 0 | 1 |
| verified-interrupted | 3 | 1 | 2 | 3 |
| release-interrupted | 3 | 3 | 0 | 3 |
| final-long5-failures | 3 | 3 | 0 | 3 |
| final-concurrent | 2 | 2 | 0 | 2 |
| owner loss | 1 | 1 | 0 | 1 |

There were 53 scenario attempts including one pre-start setup failure, with 52 durable paid-session records. `resume-*` are baseline runs before corrections. The first near-limit attempt stopped around 21 minutes, and `final-long26` stopped at 1,425 metered seconds; neither proves 26 minutes. `resume-long15-5` passed 15 minutes, then failed five-minute setup before a paid start. `verified-interrupted` predates the final observer/app and does not supply final stop evidence. Failed and intermediate runs remain retained.

### Final short sample

The final selection uses five non-interruption scenarios from `final-short` and the three final-build `release-interrupted` calls: **18 passing interactions, 17 complete cost samples and one incomplete**. Complete-sample median is $0.131547, nearest-rank p95/max $0.205989. This equally repeated synthetic mix is not observed customer behavior.

| Scenario | Passed / run | Complete / incomplete costs | Median USD | p95 / max USD |
|---|---:|---:|---:|---:|
| quiet | 3 / 3 | 3 / 0 | 0.085348 | 0.091952 |
| school | 3 / 3 | 3 / 0 | 0.200508 | 0.205989 |
| tool-heavy | 3 / 3 | 3 / 0 | 0.178623 | 0.196429 |
| sources | 3 / 3 | 2 / 1 | 0.146774 | 0.154687 |
| interrupted | 3 / 3 | 3 / 0 | 0.123071 | 0.130917 |
| corrected | 3 / 3 | 3 / 0 | 0.127497 | 0.131547 |

One ordinary sources call closed without confirmed final usage: its $0.116708 lower bound is excluded from complete statistics. Together with owner loss, it retains $10 of admission liability (two $5 reservations). Do not relabel these rows complete or erase them. Final authenticated recovery returned 200 with zero claimed/closed/unresolved sessions; no benchmark call remained open.

### Durations and failure cases

| Exercise | Metered voice seconds | Clips | Complete calculated USD |
|---|---:|---:|---:|
| long-5m | 336 | 7 | 0.463213 |
| long-15m | 925 | 20 | 1.391721 |
| long-26m | 1583 | 35 | 1.426934 |

Metered seconds include the greeting and differ from requested exercise duration. Each duration has one passing sample; varying backend work/caching means this is not a linear per-minute price curve. The 26-minute session ran 07:37:49–08:04:29 UTC, spanning later deployments and the 07:57 production promotion without losing its pinned connection. It closed normally with complete accounting. Disconnect closed with `connection`, silence with `idle`, both complete. Controlled owner loss remains separately incomplete.


The fixtures exercise actual audio input and responses with map-event observations. They do not establish semantic accuracy of every answer. Costs are calculated provider estimates from persisted rates, not invoices or observed customer averages; fixed Vercel/Supabase and map-provider expenses are excluded.

### Corrections discovered during real audio execution

The second near-limit attempt ended at 1,425 metered seconds / 31 clips during response observation. The UI retains only 100 messages; the runner incorrectly assumed total assistant transcript length could only increase. A newer shorter answer can lower that sum. The replacement follows the latest assistant message identity and fragment length. A regression reproduces a full history rolling over, and actual Chromium execution verifies the same serialized functions. Historical failures remain failed; the mechanism does not retroactively prove every prior timeout had only that cause.

The interruption scenario also incorrectly demanded speech after the pure `11-stopp` fixture, contrary to the voice policy. Its replacement requires a fresh three-second quiet interval; review caught and corrected reuse of the previous answer's already-satisfied quiet timer. Chromium measured 3,168 ms for an unchanged cursor after reset. An intermediate batch before the fresh-window fix is retained but excluded from final stop evidence.

The corrected expectation then exposed an actual UI defect: when the voice intentionally stayed silent after a pure pause request, `useLive` inferred that it was still thinking because the user's last words were newer. The final app recognizes pure `stopp`, `vent` and `vent litt` for this display state. Audible speech still takes precedence, and a subsequent question restores normal waiting. Three hook regressions and a new-build real-audio interruption batch verify this separately from the older transport-duration evidence.

## Final handoff

Deployment `dpl_4ARVwaVQVPUTPhSFVGDJ1axr6191` was promoted successfully and the fixed address resolves to it with status Ready. The two-browser audio test ran through that address and recorded `isolatedAfterPeerStop=true`. Desktop and mobile were visually checked there with loaded Google satellite tiles and zero page errors. An early 20-second capture still had coarse tiles; final 45-second captures were inspected. Google 3D uses a closed shadow root, so a light-DOM canvas count was not treated as rendering evidence. Local screenshots: `.context/release-desktop.png` and `.context/release-mobile.png`.

Recovery remains scheduled every minute. Unauthorized health/control/recovery/admin checks and authorized demo health passed at the fixed address. The demo-only code is in local ignored `.context/nyhavna-demo-access.txt` (0600); never distribute the broader secrets file. No message was sent to Lene and no Git push was made.

| Requirement | Evidence |
|---|---|
| R1 hosted demo | Promoted HTTPS deployment; desktop/mobile access, map and voice checks |
| R2 voice/map behavior | Six repeated audio scenarios; selected models/snapshot; final-build pause/interruption tests |
| R3 independent ownership | Two real concurrent contexts, live database races and hook isolation tests |
| R4 durable attempted-call records | All 52 paid calls retained, including failed calls and version/run identities; no transcripts in exported accounting |
| R5 explicit cost evidence | Component totals reconcile; two incomplete lower bounds excluded from complete statistics |
| R6 operator reporting | Credentialed JSON and same-row CSV export; public admin remains disabled and service-role data is not exposed |
| R7 repeated audio | Three passing interactions per short scenario, three duration samples; failures and synthetic limits retained |
| R8 bounded cleanup/access | Admission/grant tests, real disconnect/idle, controlled owner fencing/recovery and zero open benchmark calls |

[Code review](code-review-2026-09-17.md), [database verification](database-verification.md), [operations](operations.md) and raw evidence form the handoff. Open operational follow-up: reconcile the two retained liabilities when independent provider billing evidence is available; conduct the physical microphone/speaker and human voice-quality rehearsal with Andreas before treating automated audio evidence as a listening-quality verdict.
