import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (Next 16-navnet på middleware) for routing og legacy-redirects.
 * Kjører på nodejs-runtime (proxy støtter ikke edge).
 *
 * Routes:
 * - /eiendom/.../rapport → 301 → /eiendom/.../rapport-board (scroll-rapporten
 *   døde ved cutover-trimmen 2026-07-06; boardet er produktflaten)
 * - /eiendom/... → Eiendom passthrough (primary)
 * - /for/.../explore → 301 → /eiendom/.../
 * - /for/.../report → 301 → /eiendom/.../rapport-board
 * - /for/... → 301 → /eiendom/... (trips-frysingen døde med rutene)
 * - /generer → 301 → /eiendom/generer
 * - /admin/... → Admin passthrough
 * - /scandic/... → Legacy redirect to /eiendom/scandic/...
 */

const PRODUCT_SUFFIXES = ["explore", "guide"] as const;

// Known customer slugs for legacy redirect
const KNOWN_CUSTOMERS = [
  "klp-eiendom",
  "visitnorway",
  "strawberry",
  "scandic",
  "thon",
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return NextResponse.next();

  const firstSegment = segments[0];

  // /eiendom/... → Eiendom passthrough — men gammel scroll-rapport-URL
  // redirectes til boardet (ruten er slettet, cutover 2026-07-06)
  if (firstSegment === "eiendom") {
    if (segments.length === 4 && segments[3] === "rapport") {
      return NextResponse.redirect(
        new URL(`/eiendom/${segments[1]}/${segments[2]}/rapport-board${search}`, request.url),
        301
      );
    }
    return NextResponse.next();
  }

  // /for/... → Redirect to /eiendom/ (trips/trip-frysingen døde med rutene —
  // alt under /for/customer/project redirecter nå til prosjektroten)
  if (firstSegment === "for") {
    // /for/customer/project/explore → /eiendom/customer/project
    if (segments.length >= 4 && segments[3] === "explore") {
      const customer = segments[1];
      const project = segments[2];
      return NextResponse.redirect(
        new URL(`/eiendom/${customer}/${project}${search}`, request.url),
        301
      );
    }

    // /for/customer/project/report → /eiendom/customer/project/rapport-board
    if (segments.length >= 4 && segments[3] === "report") {
      const customer = segments[1];
      const project = segments[2];
      return NextResponse.redirect(
        new URL(`/eiendom/${customer}/${project}/rapport-board${search}`, request.url),
        301
      );
    }

    // /for/customer/project/<annet> (inkl. gamle trips/trip) → prosjektroten
    if (segments.length >= 4) {
      const customer = segments[1];
      const project = segments[2];
      return NextResponse.redirect(
        new URL(`/eiendom/${customer}/${project}${search}`, request.url),
        301
      );
    }

    // /for/customer/project (root — WelcomeScreen) → /eiendom/customer/project
    if (segments.length === 3) {
      const customer = segments[1];
      const project = segments[2];
      return NextResponse.redirect(
        new URL(`/eiendom/${customer}/${project}${search}`, request.url),
        301
      );
    }

    // /for/customer og /for → forsiden (app/for/** er slettet, cutover 2026-07-06)
    return NextResponse.redirect(new URL(`/${search}`, request.url), 301);
  }

  // /generer → /eiendom/generer
  if (firstSegment === "generer") {
    return NextResponse.redirect(
      new URL(`/eiendom/generer${search}`, request.url),
      301
    );
  }

  // /admin/... → PASSTHROUGH, IKKE guard (eksplisitt valg, PRD 12 Unit 2 AC3).
  // Autoritativ admin-tilgangskontroll er ADMIN_ENABLED per side/route via
  // lib/admin/require-admin.ts — det finnes ingen per-bruker-auth å gate på i
  // middleware. En EKTE middleware-guard bygges først hvis kunde-auth innføres
  // (deferred, PRD 12 §10 Q1). Ikke les denne branchen som en sikkerhetsgrense.
  if (firstSegment === "admin") return NextResponse.next();

  // Legacy customer redirects: /customer/... → /eiendom/customer/...
  if (KNOWN_CUSTOMERS.includes(firstSegment as typeof KNOWN_CUSTOMERS[number])) {
    // Handle legacy suffix redirects: /customer/slug-explore → /eiendom/customer/slug
    if (segments.length === 2) {
      const slugWithSuffix = segments[1];

      // Suffiks-stripping: /customer/slug-explore og /customer/slug-guide →
      // /eiendom/customer/slug (guide/trips-rutene døde ved cutover 2026-07-06)
      for (const suffix of PRODUCT_SUFFIXES) {
        if (slugWithSuffix.endsWith(`-${suffix}`)) {
          const baseSlug = slugWithSuffix.slice(0, -(suffix.length + 1));
          return NextResponse.redirect(
            new URL(`/eiendom/${firstSegment}/${baseSlug}${search}`, request.url),
            301
          );
        }
      }
    }

    // General redirect: /customer/... → /eiendom/customer/...
    return NextResponse.redirect(
      new URL(`/eiendom/${firstSegment}${segments.length > 1 ? "/" + segments.slice(1).join("/") : ""}${search}`, request.url),
      301
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
