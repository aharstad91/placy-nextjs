# Repeatable hosted voice benchmark

This runner uses actual WAV audio through `window.placyVoice.play`. It never uses `say` or synthetic microphone tones. Each new browser gets a fresh silent microphone stream before starting. Audio and transcript contents remain in browser memory; the saved report contains only operational IDs, numeric accounting, and observation booleans.

## Prerequisites

Use the deployed HTTPS Nyhavna URL, with hosted voice and signed **benchmark** access enabled. The server must admit benchmark sessions into `nyhavna-lokal-benchmark`, store `voiceRun`/`voiceScenario` labels, and enforce its durable reservation/concurrency limits. Configure that tenant with a $50 daily cap, $5 session reservation and three concurrent slots. Copy all 14 existing WAV files from the main checkout's ignored `public/dev/nyhavna-tts/` into the deployment before running. Do not generate new paid speech fixtures.

Install the repository's pinned Playwright dependency and its Chromium browser (`npx playwright install chromium`). Environment must contain `PLACY_BENCHMARK_ACCESS_CODE`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; keep them in the shell/environment file, never CLI arguments. The access code is submitted as form data, while service credentials are used only by the local read-only ledger client.

## Commands

List scenarios without opening a browser, reading credentials, accessing a database, or issuing paid requests:

```sh
npx tsx scripts/voice-benchmark.ts --list
```

Default short matrix: three repetitions each of quiet, school, tool-heavy, sources, interrupted and corrected (18 paid starts at most):

```sh
node --env-file=.env.local --import tsx scripts/voice-benchmark.ts --url https://YOUR-HOST/demo/nyhavna-lokal --max-usd 15 --deadline-minutes 45
```

Explicit separate duration and failure batches:

```sh
node --env-file=.env.local --import tsx scripts/voice-benchmark.ts --url https://YOUR-HOST/demo/nyhavna-lokal --scenarios long-5m,long-15m,long-26m --repeat 1 --max-usd 15 --deadline-minutes 60
node --env-file=.env.local --import tsx scripts/voice-benchmark.ts --url https://YOUR-HOST/demo/nyhavna-lokal --scenarios concurrent,disconnect,silence --repeat 1 --max-usd 15 --deadline-minutes 15
```

`--repeat` is 1–10. `--max-usd` is required and capped at $50; `--deadline-minutes` is 1–120. A concurrent scenario costs two session reservations. The runner re-reads the complete paginated durable ledger before every batch, counts completed closed sessions at known cost, and retains at least the $5 reservation for any active/provisional/incomplete session. It admits the whole concurrent pair together. Missing ledger access or a paid attempt without a ledger identity blocks further paid starts. The server remains the atomic authority across other processes; run only one runner per budget, and use the tenant's daily limit as the shared ceiling. Provider liabilities beyond the configured reservation cannot be guaranteed by client-side arithmetic.

Long tests inject a real fixture approximately every 45 seconds to avoid the two-minute inactivity shutdown. Silence deliberately sends no fixtures and expects idle within 150 seconds. Interruption waits for actual speaking before injecting its second clip. Concurrent sessions use separate authenticated browser contexts, with a delayed stop observation on the second browser. Disconnect closes the browser context; inspect its recovery/final-usage accounting separately. Forced owner loss requires a separately controlled owner termination/redeploy and recovery evidence; it is not simulated by this runner.

## Evidence and limitations

Every execution creates a fresh run ID and an atomic JSON report under `.context/voice-benchmark/` (override using `--output`). The report is written before paid work and after each batch, including on failure. Browser/setup failures are finite attempts, never automatic paid retries. Exit status is nonzero for failures or blocked execution. No screenshots, browser traces, provider frames, SDP or raw errors are retained.

Startup allows 120 seconds around the asynchronous dev hook, including health/ICE and the server/media limits. Authored failure codes distinguish missing map/audio evidence, early termination, unexpected silence termination and failed peer isolation; unknown errors remain redacted. Isolation requires the first peer to have completed successfully before its stop can be evidence. If a ledger read fails, distributions and groups are null; previously fetched rows are not presented as current financial statistics.

Reply/quiet observations use the latest assistant message identity and fragment length, not summed transcript length. The UI keeps only 100 messages, so a valid new response can make that sum shrink. Cursor functions are serialized into the browser and tested against rolling-history replacement; no spoken words leave the browser. Reports retain a fixed phase label for failed waits.

The final `11-stopp` clip asks for silence: success requires three seconds of stable listening (`quietAfterStop`), not a new spoken response. The preceding interruption/question is still injected while speaking and requires a response. Requiring speech after an explicit stop contradicts the product's voice policy.

Report attempted/passed/failed counts alongside complete/incomplete accounting. `distribution` and scenario `groups` provide sample count, median, nearest-rank p95 and max calculated USD for **closed complete** sessions only. Incomplete sessions remain visible with their last-known usage and reservations. A passed browser interaction is not proof of complete accounting or correct answers. Observation booleans establish that speech/map events happened, not that their meaning was correct. Use the operator cost CLI for normalized component/token exports and reconciliation by run ID.

Keep short, long, concurrent and failure samples separate when discussing pricing. These fixtures are synthetic measurements, not a customer average or invoice reconciliation. Fixed Vercel/Supabase expenses are separate. The 26-minute test must remain active for its requested duration; if the hosted safety deadline ends it earlier, the runner marks it failed and the hosted configuration/evidence must explain that limit.

Authorized hosted executions, failures, version limits, cost reconciliation and final results are attached in [the September 17 validation](hosted-validation-2026-09-17.md) and its JSON/CSV evidence.
