import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for routing and legacy redirects.
 *
 * Routes:
 * - /eiendom/... → Eiendom passthrough (primary)
 * - /for/.../trips/... → Frozen trips passthrough
 * - /for/.../explore → 301 → /eiendom/.../
 * - /for/.../report → 301 → /eiendom/.../rapport
 * - /for/... → 301 → /eiendom/...
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

// Known area slugs for public pages
const KNOWN_AREAS = ["trondheim"] as const;

// Sub-paths under /for/ that are frozen (not redirected)
const FROZEN_SUBPATHS = ["trips", "trip"] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return NextResponse.next();

  const firstSegment = segments[0];

  // /eiendom/... → Eiendom passthrough
  if (firstSegment === "eiendom") return NextResponse.next();

  // /for/... → Redirect to /eiendom/ (with exceptions for frozen features)
  if (firstSegment === "for") {
    // /for/customer/project/trips/... or /for/customer/project/trip/... → passthrough (frozen)
    if (segments.length >= 4) {
      const subPath = segments[3];
      if (FROZEN_SUBPATHS.includes(subPath as typeof FROZEN_SUBPATHS[number])) {
        return NextResponse.next();
      }
    }

    // /for/customer/project/explore → /eiendom/customer/project
    if (segments.length >= 4 && segments[3] === "explore") {
      const customer = segments[1];
      const project = segments[2];
      return NextResponse.redirect(
        new URL(`/eiendom/${customer}/${project}${search}`, request.url),
        301
      );
    }

    // /for/customer/project/report → /eiendom/customer/project/rapport
    if (segments.length >= 4 && segments[3] === "report") {
      const customer = segments[1];
      const project = segments[2];
      return NextResponse.redirect(
        new URL(`/eiendom/${customer}/${project}/rapport${search}`, request.url),
        301
      );
    }

    // /for/customer/project/landing → /eiendom/customer/project
    if (segments.length >= 4 && segments[3] === "landing") {
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

    // /for/customer → passthrough (customer landing, if it exists)
    // /for → passthrough
    return NextResponse.next();
  }

  // /generer → /eiendom/generer
  if (firstSegment === "generer") {
    return NextResponse.redirect(
      new URL(`/eiendom/generer${search}`, request.url),
      301
    );
  }

  // /en/... → English public passthrough
  if (firstSegment === "en") return NextResponse.next();

  // /admin/... → Admin passthrough
  if (firstSegment === "admin") return NextResponse.next();

  // /trondheim/... → Norwegian public passthrough
  if (KNOWN_AREAS.includes(firstSegment as typeof KNOWN_AREAS[number])) {
    return NextResponse.next();
  }

  // Legacy customer redirects: /customer/... → /eiendom/customer/...
  if (KNOWN_CUSTOMERS.includes(firstSegment as typeof KNOWN_CUSTOMERS[number])) {
    // Handle legacy suffix redirects: /customer/slug-explore → /eiendom/customer/slug
    if (segments.length === 2) {
      const slugWithSuffix = segments[1];

      for (const suffix of PRODUCT_SUFFIXES) {
        if (slugWithSuffix.endsWith(`-${suffix}`)) {
          const baseSlug = slugWithSuffix.slice(0, -(suffix.length + 1));
          if (suffix === "explore") {
            return NextResponse.redirect(
              new URL(`/eiendom/${firstSegment}/${baseSlug}${search}`, request.url),
              301
            );
          }
          // guide suffix → passthrough to trips (frozen)
          return NextResponse.redirect(
            new URL(`/for/${firstSegment}/${baseSlug}/trip${search}`, request.url),
            301
          );
        }
      }

      // Redirect /customer/guides → /for/customer/trips (frozen)
      if (slugWithSuffix === "guides") {
        return NextResponse.redirect(
          new URL(`/for/${firstSegment}/trips${search}`, request.url),
          301
        );
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
