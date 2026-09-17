# Nyhavna direct-link access — 2026-09-17

At Andreas's request, removed the demo access-code screen. The public demo receives the existing demo tenant and its admission limits; only a valid signed cookie grants the separate benchmark role.

Published to https://placy-nyhavna.vercel.app/demo/nyhavna-lokal as `dpl_3CcKcvs7pw8zTkDDVEDnRsLUGYxw`. No Git push.

The candidate and fixed URL return HTTP 200 anonymously. Both the HTML robots metadata and `X-Robots-Tag` declare `noindex, nofollow`. `robots.txt` explicitly permits fetching this demo path so crawlers can read those directives; the general prelaunch disallow remains. The sitemap stays empty.

Production build passed lint, all 4,454 tests in 281 files, TypeScript and Next.js build. Added access tests cover anonymous starts, origin/shutdown checks, and rejection of invalid or expired benchmark privileges.

The fixed URL's health endpoint returns 200 anonymously. Control returns 404 without an Origin or with a foreign Origin, and 426 for a same-origin request without a WebSocket upgrade. Recovery remains 401 without authentication; disabled admin redirects (307).

Anonymous browser audio verification passed on the fixed URL with no access cookie before or after the call. The browser received an assistant greeting and a reply to the existing `01-interesse.wav` fixture, recognized user speech, and received two map directives. Manual stop closed session `a12a7f67-fcf1-4e0d-bcb0-5afa92351793` under `nyhavna-lokal-demo`: 69 voice seconds, complete accounting, calculated provider cost $0.177338. This is one focused access-regression check; the broader voice evidence remains in the initial hosted validation report.
