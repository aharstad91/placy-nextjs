# Nyhavna voice operations

The delivery includes the complete Nyhavna demo and Anja. Hosting stays on Vercel + Supabase. OpenAI provides voice/backend inference; Google Maps/Places and Mapbox remain external map APIs.

Released 2026-09-17: [hosted validation and measured costs](hosted-validation-2026-09-17.md). Repeated short, 5/15/26-minute and concurrency/recovery checks have explicit revision limits. Two closed benchmark calls retain incomplete final-usage liabilities; review that report before adjusting budgets.

## Deployment and access

- Project: `placy-nyhavna`, in the existing Vercel Pro team. This separate project isolates releases from the existing `placy` app while keeping one account.
- Share link: https://placy.no/nyhavna — project-level 307 redirect on `placy`, version `86ff97bf-9e0f-4f74-9fae-019474c38f6c`. The apex first redirects to www; the short path then opens the hosted demo.
- Hosted entry: https://placy-nyhavna.vercel.app/demo/nyhavna-lokal
- Code checkout: `feat/voice-infrastructure`. Deployments use the local checkout; no Git push is implied.
- Node 24, Fluid Compute, function region `dub1`. The control route explicitly declares `maxDuration=1800`. Browser audio connects directly to OpenAI over WebRTC; one pinned Vercel WebSocket owns server-side tools and map messages for each conversation.
- The media deadline is 1,650 seconds from reservation (27.5 minutes, including startup), with a browser notice about two minutes before that deadline. There is no promise of a full 30-minute conversation. A bounded 30-second owner lease margin allows final usage to drain after the media deadline.
- The demo opens directly without a code or cookie. Its HTML and HTTP header declare `noindex, nofollow`; robots.txt permits fetching this path so crawlers can read that directive. Benchmark access still requires a private code and signed HTTP-only cookie. `ADMIN_ENABLED=false`. No OpenAI/service-role secret reaches the browser.
- Secrets are configured in Vercel. The operator's local copy is `.context/voice-hosted.env` (ignored, mode 0600). Never commit or send that file. Share the demo URL directly; no demo code is needed. The benchmark code and signing/cron keys stay private.
- Rotate the benchmark access code to invalidate its outstanding cookies. Rotate the signing secret to invalidate all signed cookies; public demo access remains enabled. Set `PLACY_HOSTED_VOICE=false` and redeploy to disable new hosted starts; also disable tenant admission in Supabase for an immediate block on new paid starts. Keep `CRON_SECRET` configured: authenticated recovery remains available independently of the admission flag, so old paid sessions can still be cleaned up.

The WebSocket and extended-duration Vercel features are beta. The hosted echo proof verifies >800 seconds and connection isolation; real-audio evidence must additionally establish the integrated behavior. Redeploying does not terminate existing pinned connections automatically.

## Accounting and limits

Migrations 093 and 094 define service-only `v2.voice_tenants`, `voice_sessions`, `voice_usage_events`, and atomic RPCs. No transcript, SDP, client secret or provider response body is stored in this ledger. Owner UUIDs remain server-side.

| Internal tenant | Concurrent | Per hour | Per 24h | Rolling budget | Per-call reservation |
|---|---:|---:|---:|---:|---:|
| `nyhavna-lokal-demo` | 5 | 60 | 200 | $100 | $5 |
| `nyhavna-lokal-benchmark` | 3 | 60 | 100 | $50 | $5 |

These are engineering safeguards for internal demos, not a sold customer quota or price. Identity is explicitly internal; customer/project columns remain null until a real customer mapping is verified. A server owner stops when measured cost reaches the reservation, but in-flight provider work can exceed it before the next checkpoint. A reservation is a conservative admission allowance, not an absolute provider-billing guarantee.

Usage snapshots are cumulative voice maxima. Backend response IDs are deduplicated. Prices and model/dataset/configuration versions are captured per session. `complete` requires authoritative provider closure, final voice usage, and complete known-rate backend evidence. Otherwise costs remain a known lower bound and the row is visibly `provisional` or `incomplete`. Never turn missing usage into zero.

Incomplete conversations keep at least their reservation against later admissions, even on later days. Active/unresolved rows also retain concurrency. A confirmed hangup releases concurrency but does not manufacture complete usage. An operator must investigate retained liabilities; do not erase sessions, relabel incomplete rows as complete, or blindly raise budgets to bypass unresolved costs. Resolve known provider sessions first, compare provider billing evidence, and record any reconciliation decision before adjusting liability.

## Recovery and monitoring

The production Vercel cron calls `/api/live/recover` every minute with `CRON_SECRET`. Each active connection heartbeats every 20 seconds; the usual lease is 60 seconds. Stale claims atomically replace the owner capability. Recovery hangs up known provider IDs; unknown creation outcomes stay unresolved. Database or provider failures remain retryable through durable leases.

Monitor fixed allowlisted log markers `voice_recovery_failed`, `voice_recovery_unresolved`, and `voice_finalization_pending` together with ledger state. Do not add raw errors, transcript snippets or provider payloads to hosted logs. Check `/api/prototype/live?dataset=nyhavna-lokal` without a cookie for model/transport health; a 200 is expected when hosted voice is enabled.

Startup has separate limits: up to 75 seconds for hosted admission/provider/control setup, then 15 seconds for the media acknowledgement after SDP is available. Time spent granting microphone permission does not consume the media limit. Stop cancels the current attempt; failures never automatically create another paid conversation.

During internal validation, Andreas owns the demo. Check the ledger after each initial Lene test and daily while the link is in use. Unexpected unresolved sessions, missing final usage, repeated admission rejection or cross-session map behavior require investigation before broader distribution. Disable tenant admission immediately for uncontrolled paid creation or session cross-talk; let known active calls close and run recovery. Roll back the dedicated Vercel app if a new deployment breaks a previously verified flow. Preserve the ledger and additive schema during rollback.

## Reports and commercial interpretation

```sh
npx tsx scripts/voice-costs.ts --tenant nyhavna-lokal-demo --format json
npx tsx scripts/voice-costs.ts --test-run RUN_ID --format csv
```

The operator CLI reports each conversation's voice, backend tokens/caching, components, status and configuration, plus grouped complete-only median/p95/max. Incomplete counts/lower bounds stay separate. Exported provider costs are calculated estimates, not invoice reconciliation. Synthetic test scenarios are not a customer usage distribution.

As checked 2026-09-16, the baseline advertised platform subscriptions are Vercel Pro $20/month and Supabase Pro from $25/month: $45/month before additional seats, projects/compute, usage and taxes. Supabase account plan has not been established by this implementation. Vercel includes $20/month usage credit; usage above included allowances is additional. Do not present $45 as an all-inclusive hosting bill. Google/Mapbox usage and OpenAI calls are separate, and fixed shared platform expenses are not assigned to individual voice sessions by this ledger.

Sources: [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Vercel pricing](https://vercel.com/docs/pricing), [Supabase pricing](https://supabase.com/pricing), [Supabase cost control](https://supabase.com/docs/guides/platform/cost-control).
