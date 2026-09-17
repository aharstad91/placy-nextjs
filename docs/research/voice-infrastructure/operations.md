# Shared Placy voice operations

The delivery includes the complete Nyhavna demo and Anja. Hosting stays on Vercel + Supabase. OpenAI provides voice/backend inference; Google Maps/Places and Mapbox remain external map APIs.

Released 2026-09-17: [hosted validation and measured costs](hosted-validation-2026-09-17.md). Repeated short, 5/15/26-minute and concurrency/recovery checks have explicit revision limits. Two closed benchmark calls retain incomplete final-usage liabilities; review that report before adjusting budgets.

Shared-platform cutover completed on 2026-09-17: deployment `dpl_8RtoKwB491jQzDtwTPFCsRRwH6nZ`, application commit `11c78d1`. See [migration evidence](shared-platform-validation.md) for the bounded anonymous call and verified identities. The internal Vercel project name remains unchanged.

## Deployment and access

- Project: `placy-nyhavna`, in the existing Vercel Pro team. Its internal name is retained, but the registry and `/p/[slug]` route make it one reusable runtime for multiple customer projects. The older `placy` main app remains a separate compatibility boundary.
- Share link: https://placy.no/nyhavna — project-level 307 redirect on `placy`, version `86ff97bf-9e0f-4f74-9fae-019474c38f6c`. The apex first redirects to www; the short path then opens the hosted demo.
- Shared route: `/p/nyhavna`. Legacy entry `https://placy-nyhavna.vercel.app/demo/nyhavna-lokal` redirects to it on the same origin and preserves query parameters. Neutral shared alias: https://placy-platform.vercel.app/p/nyhavna. Both aliases point to the same deployment; legacy links do not create a second runtime.
- Code checkout: `feat/voice-infrastructure`. Deployments use the local checkout; no Git push is implied.
- Node 24, Fluid Compute, function region `dub1`. The control route explicitly declares `maxDuration=1800`. Browser audio connects directly to OpenAI over WebRTC; one pinned Vercel WebSocket owns server-side tools and map messages for each conversation.
- The media deadline is 1,650 seconds from reservation (27.5 minutes, including startup), with a browser notice about two minutes before that deadline. There is no promise of a full 30-minute conversation. A bounded 30-second owner lease margin allows final usage to drain after the media deadline.
- The demo opens directly without a code or cookie. Its HTML and HTTP header declare `noindex, nofollow`; robots.txt permits fetching this path so crawlers can read that directive. Benchmark access still requires a private code and signed HTTP-only cookie. `ADMIN_ENABLED=false`. No OpenAI/service-role secret reaches the browser.
- Secrets are configured in Vercel. The operator's local copy is `.context/voice-hosted.env` (ignored, mode 0600). Never commit or send that file. Share the demo URL directly; no demo code is needed. The benchmark code and signing/cron keys stay private.
- Rotate the benchmark access code to invalidate its outstanding cookies. Rotate the signing secret to invalidate all signed cookies; public demo access remains enabled. Set `PLACY_HOSTED_VOICE=false` and redeploy to disable new hosted starts; also disable tenant admission in Supabase for an immediate block on new paid starts. Keep `CRON_SECRET` configured: authenticated recovery remains available independently of the admission flag, so old paid sessions can still be cleaned up.

The WebSocket and extended-duration Vercel features are beta. The hosted echo proof verifies >800 seconds and connection isolation; real-audio evidence must additionally establish the integrated behavior. Redeploying does not terminate existing pinned connections automatically.

## Accounting and limits

Migrations 093–095 define service-only `v2.voice_tenants`, `voice_sessions`, `voice_usage_events`, and atomic RPCs. No transcript, SDP, client secret or provider response body is stored in this ledger. Owner UUIDs remain server-side.

| Project tenant | Concurrent | Per hour | Per 24h | Rolling budget | Per-call reservation |
|---|---:|---:|---:|---:|---:|
| `nyhavna-public` | 5 | 60 | 200 | $100 | $5 |
| `nyhavna-benchmark` | 3 | 60 | 100 | $50 | $5 |

These are operational safeguards, not a sold customer quota or price. Both tenants belong to customer `nyhavna-utvikling`, project `nyhavna-utvikling_nyhavna`, with explicit `public` or `benchmark` purpose. The server registry resolves that identity; the browser cannot supply accounting fields. Old rows retain their original identity and null legacy purpose. The old `nyhavna-lokal-demo` and `nyhavna-lokal-benchmark` admissions were disabled after the successful anonymous proof and production promotion; their history and recovery remain intact.

Admission also checks locked policies in platform → customer → project → tenant order. Customer and project ceilings are each 8 concurrent, 120/hour, 300/24h and $150 rolling exposure; platform is 8/120/300 and $200, including historical unresolved liabilities. Internal and benchmark work count against shared ceilings. Missing/disabled bindings or policies fail closed before paid creation. A server owner stops when measured cost reaches the reservation, but in-flight provider work can exceed it before the next checkpoint. A reservation is a conservative admission allowance, not an absolute provider-billing guarantee.

Usage snapshots are cumulative voice maxima. Backend response IDs are deduplicated. Prices and model/dataset/configuration versions are captured per session. `complete` requires authoritative provider closure, final voice usage, and complete known-rate backend evidence. Otherwise costs remain a known lower bound and the row is visibly `provisional` or `incomplete`. Never turn missing usage into zero.

Incomplete conversations keep at least their reservation against later admissions, even on later days. Active/unresolved rows also retain concurrency. A confirmed hangup releases concurrency but does not manufacture complete usage. An operator must investigate retained liabilities; do not erase sessions, relabel incomplete rows as complete, or blindly raise budgets to bypass unresolved costs. Resolve known provider sessions first, compare provider billing evidence, and record any reconciliation decision before adjusting liability.

## Recovery and monitoring

The production Vercel cron calls `/api/live/recover` every minute with `CRON_SECRET`. Each active connection heartbeats every 20 seconds; the usual lease is 60 seconds. Stale claims atomically replace the owner capability. Recovery hangs up known provider IDs; unknown creation outcomes stay unresolved. Database or provider failures remain retryable through durable leases.

Monitor fixed allowlisted log markers `voice_recovery_failed`, `voice_recovery_unresolved`, and `voice_finalization_pending` together with ledger state. Do not add raw errors, transcript snippets or provider payloads to hosted logs. Check `/api/prototype/live?project=nyhavna` without a cookie for model/transport health; a 200 is expected when hosted voice is enabled.

A signed benchmark cookie intentionally selects benchmark accounting for every project on that host. If a project has no benchmark tenant, admission is denied rather than silently labeled public. To validate normal anonymous use, open a fresh private browser context or remove only the `placy_demo_access` cookie for that origin. Public visitors do not need a cookie or access code.

Startup has separate limits: up to 75 seconds for hosted admission/provider/control setup, then 15 seconds for the media acknowledgement after SDP is available. Time spent granting microphone permission does not consume the media limit. Stop cancels the current attempt; failures never automatically create another paid conversation.

During internal validation, Andreas owns the demo. Check the ledger after each initial Lene test and daily while the link is in use. Unexpected unresolved sessions, missing final usage, repeated admission rejection or cross-session map behavior require investigation before broader distribution. Disable tenant admission immediately for uncontrolled paid creation or session cross-talk; let known active calls close and run recovery. Use a prior registry-compatible deployment if a new release breaks a verified flow. Never re-enable old unbound tenants to make pre-platform code admit calls. If no compatible version exists, disable new admission while repairing the app. Preserve the ledger, additive schema, and recovery during rollback.

## Reports and commercial interpretation

```sh
npx tsx scripts/voice-costs.ts --project nyhavna-utvikling_nyhavna --purpose public --format json
npx tsx scripts/voice-costs.ts --customer nyhavna-utvikling --purpose benchmark --format json
npx tsx scripts/voice-costs.ts --test-run RUN_ID --format csv
```

The private operator CLI separately reports filtered customer/project/purpose costs and unfiltered platform/customer/project headroom, with 80% warnings. These views overlap and are never added together. Headroom is an observation, not an atomic admission guarantee; tenant limits and the next reservation still apply. Vercel, Supabase and maps are not allocated by this report. Onboarding and ownership rules are in [shared-platform operations](../../architecture/shared-platform.md).

The operator CLI reports each conversation's voice, backend tokens/caching, components, status and configuration, plus grouped complete-only median/p95/max. Incomplete counts/lower bounds stay separate. Exported provider costs are calculated estimates, not invoice reconciliation. Synthetic test scenarios are not a customer usage distribution.

As checked 2026-09-16, the baseline advertised platform subscriptions are Vercel Pro $20/month and Supabase Pro from $25/month: $45/month before additional seats, projects/compute, usage and taxes. Supabase account plan has not been established by this implementation. Vercel includes $20/month usage credit; usage above included allowances is additional. Do not present $45 as an all-inclusive hosting bill. Google/Mapbox usage and OpenAI calls are separate, and fixed shared platform expenses are not assigned to individual voice sessions by this ledger.

Sources: [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Vercel pricing](https://vercel.com/docs/pricing), [Supabase pricing](https://supabase.com/pricing), [Supabase cost control](https://supabase.com/docs/guides/platform/cost-control).
