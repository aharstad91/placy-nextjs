# Canonical project URLs — 2026-09-17

Status: complete. Canonical apex live; browser, voice and project accounting verified. Deployment `dpl_3o3VM6GjRr2u2rxwCH67Eyvps8Ar`; application tree recorded in `c0a0b19`.

## Contract and architecture

Every newly activated project uses `https://placy.no/<slug>`, with the URL retained in the browser, anonymous access and noindex. The global registry already enforces one slug per project and uniqueness across customers. The root route uses the same server resolver as health and paid admission; it does not infer ownership from the URL.

Move only `placy.no` from the older `placy` Vercel project to the shared `placy-nyhavna` project. Keep `www.placy.no` and its deployment unchanged. The internal project name is historical; there is no new app or domain configuration per customer. Existing DNS already points at Vercel and requires no change. No cross-project reverse proxy, iframe, asset-prefix workaround, CORS expansion or provider-model change is needed.

On the apex, root and existing website namespaces redirect to www. Platform aliases retain their existing pages; this prevents previously working demo links from being redirected into missing pages on the older website. `/p/<slug>` and the legacy Nyhavna entry redirect to the root project path on the same origin, preserving query parameters. Temporary 307 responses keep this first domain cutover reversible.

`lib/project-paths.ts` owns reserved namespaces and slug syntax. Registry resolution rejects reserved slugs before database access or paid start. Its regression test inventories all concrete app and public directories. New namespaces must update this authority before deployment. The older deployed commit `bef9ae2` was separately inventoried: all 22 page routes belong to the root, admin, eiendom, event, kart, midtbyen, pitch or portefolje. Public website prefixes and old proxy aliases are covered; admin is disabled on both existing deployments.

## Search and operating cost

Root project pages have noindex/nofollow metadata and HTTP headers. All responses from the hosted platform, including legacy pages on technical aliases, have the noindex/nofollow header. Robots allows project pages to be fetched to read it, blocks `/api/` and `/dev/`, and does not enumerate customer slugs. Sitemap remains empty.

An unknown syntactically valid root slug can perform an indexed registry read before returning 404. Unknown `/p/` project selections already used that lookup. This does not start paid inference, but anonymous HTTP and database work still consumes resources. Robots is voluntary and is not abuse prevention. No saturation incident or high-load capacity has been demonstrated. Monitor Vercel request/function usage and Supabase load; keep the existing paid-admission and spending limits. A public robots list of every customer slug was rejected because direct-link demos should not become a project directory.

## Evidence

Local first-pass full suite: 4,586 tests passed in 285 files; lint, TypeScript and production build passed. The optional PGlite test passed locally. The first candidate passed 4,585 tests with that one optional test skipped on Vercel, and passed lint, TypeScript and build.

The first candidate passed ten HTTP routing/header checks, same-origin WebSocket upgrade (101), hostile/missing origin rejection (404), desktop/mobile UI, maps/images, reload, unknown project 404, noindex and legacy query preservation. Robots and empty sitemap returned 200. These socket checks sent no paid start message.

The final compatibility correction was first reproduced by a failing regression test (307 instead of 200 on a neutral-alias demo). All 123 focused tests then passed. The final candidate passed all release gates: 4,586 tests passed in 285 files, one optional PGlite test skipped; lint had zero errors and 59 existing warnings, TypeScript and production build passed.

## Final production verification

Machine-readable evidence: [project-url-release-2026-09-17.json](project-url-release-2026-09-17.json).

- The actual apex passed all ten HTTP and three WebSocket checks. `/nyhavna` returns 200 without Location, with canonical metadata and noindex/nofollow. Correct-origin WebSocket upgrades return 101; missing/foreign origins return 404 without paid start.
- Desktop and mobile on `https://placy.no/nyhavna` retained the URL, loaded maps and visible images, and had no JavaScript errors, failed local resources or horizontal overflow. Reload, legacy query preservation and unknown-project 404 passed.
- One anonymous real voice call heard injected test audio, replied, produced two map frames and stopped normally with restart available. Session `01d3b07f-0e99-46f8-8fc1-2c806ce3ed9d` is closed/complete and reconciles to `nyhavna-utvikling` / `nyhavna-utvikling_nyhavna`, purpose public: 78 voice seconds, $0.065 voice + $0.120168 backend = **$0.185168** estimated provider cost. Two usage events, zero unknown usage. This is a synthetic release test, not a customer average or invoice. Models were unchanged. No additional paid call was made after the pause.
- All six access/security checks passed. The post-call ledger had 62 sessions, none open. All 60 historical sessions and their existing incomplete liabilities remain unchanged.
- `www.placy.no` remains on `dpl_ENuhYMxhiAeAEtdSDxvLGQESZY1k`. All three before/after website HTTP/title checks matched (root and Lillebytunet 200; the already-missing Nyhavna website demo remains 404 on www). The new www short redirect preserves repeated query parameters. The final read-only check at 13:42 UTC confirmed direct apex 200, noindex, robots 200 without slug enumeration, and empty sitemap 200.
- The standalone system map in `~/Downloads/placy-systemkart.html` reflects the actual domain split. Desktop and mobile passed all three tabs, the cost slider and overflow/error checks; screenshots were visually inspected.

No DNS change or Git push was made. The URL contract and onboarding standard are recorded in `CLAUDE.md` and `docs/architecture/shared-platform.md`. Physical microphone/speaker and subjective voice quality, customer pricing, other-provider cost allocation, historical incomplete accounting, and high-load validation remain outside this URL release.

## Review disposition

Completed actual CE review: `20260917-141035-67931205`, full read-only review including an independent Claude pass; receipt in `project-url-code-review.json`.

- Finding #2 (P1, alias demo compatibility): fixed by restricting website redirects to the apex hostname. The regression failed before the fix and passed afterward. Rebuilt candidate `dpl_3o3VM6GjRr2u2rxwCH67Eyvps8Ar` serves the old alias demo directly with 200 and noindex. All 123 scoped tests and the final Vercel gates passed (4,586 passed / one optional test skipped; lint, typecheck, build). Final candidate desktop/mobile and all ten HTTP/three WebSocket checks passed.
- Finding #1 (P2, anonymous crawler/query exposure): choose the review's explicit monitoring option. Keep root pages crawlable and registry decisions fresh; do not publish a customer-slug directory or add a stale admission cache. Block API/dev crawling and apply noindex/nofollow across the hosted app. The ordinary unknown-root lookup remains and is recorded above; no claim of measured load safety or automated bot protection is made. Monitor request/function/database usage during the release and normal operation. No deferred code fix is required to meet the URL contract.

Simplification applied one improvement: constrain output tracing to the literal root dynamic route instead of a wildcard that would bundle voice data into every function. Reuse/quality passes had no findings. Actual build trace includes all nine required content files.

## Cutover and rollback

1. Validate the immutable candidate, including anonymous native WebSocket and assets. Promote it in the shared project and point the neutral technical alias at the same deployment.
2. Clear the existing domain-level apex → www redirect first with the project-domain PATCH API. The move API rejected the initial attempt while this old redirect remained, despite explicit nulls in its move payload. Then move apex with Vercel's domain-move API, explicitly setting `redirect: null`, `gitBranch: null`, and `redirectStatusCode: null`. Do not remove/add the domain or alter DNS.
3. Verify first response at `https://placy.no/nyhavna` is 200 without Location; recheck noindex, canonical metadata, maps, Server Actions, control socket and one bounded real voice call with complete project accounting.
4. Update the old www `/nyhavna` redirect to the canonical apex URL. Recheck query preservation, existing www pages and unchanged deployment assignment.
5. If reverting the domain after step 4, first restore www's previous redirect version `86ff97bf-9e0f-4f74-9fae-019474c38f6c`, then move apex back to the older project with `redirect: "www.placy.no"`. The neutral/legacy aliases continue serving relative compatibility paths, avoiding a redirect loop. Keep the ledger and shared-admission configuration intact. A pre-root-route application rollback also needs this domain rollback so `/nyhavna` does not point at an app that only supports `/p/nyhavna`.

During this release, the operator verifies the public path immediately after cutover and checks ledger closure after the bounded call. Repeated asset/action/socket failures, wrong project accounting or a website regression trigger mitigation; noindex and unknown-project 404 are intended behavior. Disable new admission for uncontrolled paid starts while retaining recovery and accounting.
