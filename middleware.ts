import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for routing and legacy redirects.
 *
 * Routes:
 * - /for/customer/project/... → B2B (passthrough)
 * - /en/... → English public (passthrough)
 * - /trondheim/... → Norwegian public (passthrough)
 * - /admin/... → Admin (passthrough)
 * - /scandic/... → Legacy redirect to /for/scandic/...
 */

const PRODUCT_SUFFIXES = ["explore", "guide"] as const;

const SUFFIX_TO_ROUTE: Record<string, string> = {
  explore: "explore",
  guide: "trip",
};

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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return NextResponse.next();

  const firstSegment = segments[0];

  // /for/... → B2B passthrough
  if (firstSegment === "for") return NextResponse.next();

  // /en/... → English public passthrough
  if (firstSegment === "en") return NextResponse.next();

  // /admin/... → Admin passthrough
  if (firstSegment === "admin") return NextResponse.next();

  // /trondheim/... → Norwegian public passthrough
  if (KNOWN_AREAS.includes(firstSegment as typeof KNOWN_AREAS[number])) {
    return NextResponse.next();
  }

  // Legacy customer redirects: /customer/... → /for/customer/...
  if (KNOWN_CUSTOMERS.includes(firstSegment as typeof KNOWN_CUSTOMERS[number])) {
    // Handle legacy suffix redirects: /customer/slug-explore → /for/customer/slug/explore
    if (segments.length === 2) {
      const slugWithSuffix = segments[1];

      for (const suffix of PRODUCT_SUFFIXES) {
        if (slugWithSuffix.endsWith(`-${suffix}`)) {
          const baseSlug = slugWithSuffix.slice(0, -(suffix.length + 1));
          const route = SUFFIX_TO_ROUTE[suffix] ?? suffix;
          return NextResponse.redirect(
            new URL(`/for/${firstSegment}/${baseSlug}/${route}${search}`, request.url),
            308
          );
        }
      }

      // Redirect /customer/guides → /for/customer/trips
      if (slugWithSuffix === "guides") {
        return NextResponse.redirect(
          new URL(`/for/${firstSegment}/trips${search}`, request.url),
          301
        );
      }
    }

    // General redirect: /customer/... → /for/customer/...
    return NextResponse.redirect(
      new URL(`/for${pathname}${search}`, request.url),
      308
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
