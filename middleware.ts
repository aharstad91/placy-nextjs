import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Legacy URL Redirect Middleware
 *
 * Handles redirects from old URL structure to new:
 * - /customer/slug-explore → /customer/slug/explore
 * - /customer/slug-guide → /customer/slug/trip  (guide route renamed to trip)
 * - /customer/slug (report) → stays as-is (handled by page.tsx)
 *
 * Uses 308 permanent redirects to preserve HTTP method and transfer SEO equity.
 */

const PRODUCT_SUFFIXES = ["explore", "guide"] as const;

/** Map legacy suffix to actual route path */
const SUFFIX_TO_ROUTE: Record<string, string> = {
  explore: "explore",
  guide: "trip",
};

// Known customer slugs - add new customers here
// In production, this could be fetched from database or config
const KNOWN_CUSTOMERS = [
  "klp-eiendom",
  "visitnorway",
  "strawberry",
  "scandic",
  "thon",
] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  // Only process 2-segment paths: /customer/slug
  if (segments.length !== 2) {
    return NextResponse.next();
  }

  const [customer, slugWithSuffix] = segments;

  // Only process known customers
  if (!KNOWN_CUSTOMERS.includes(customer as typeof KNOWN_CUSTOMERS[number])) {
    return NextResponse.next();
  }

  // Check for product suffix: slug-explore, slug-guide
  for (const suffix of PRODUCT_SUFFIXES) {
    if (slugWithSuffix.endsWith(`-${suffix}`)) {
      const baseSlug = slugWithSuffix.slice(0, -(suffix.length + 1));
      const route = SUFFIX_TO_ROUTE[suffix] ?? suffix;

      // Redirect to new URL structure
      return NextResponse.redirect(
        new URL(`/${customer}/${baseSlug}/${route}${search}`, request.url),
        308 // Permanent redirect, preserves HTTP method
      );
    }
  }

  // Redirect /customer/guides → /customer/trips
  if (slugWithSuffix === "guides") {
    return NextResponse.redirect(
      new URL(`/${customer}/trips${search}`, request.url),
      301
    );
  }

  // No suffix found - this is either a report URL or new format
  // Let the page handle it
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt
     * - files with extensions (static files)
     */
    "/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
