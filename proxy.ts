import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { WEBSITE_NAMESPACES, isPublicProjectSlug } from "@/lib/project-paths";
import { LB_DEMO_ACCESS_PATH, lbDemoAccess, lbDemoAccessConfigured } from "@/lib/demo/leangenbukta-site/access";

/**
 * Proxy (Next 16-navnet på middleware) for routing og legacy-redirects.
 * Kjører på nodejs-runtime (proxy støtter ikke edge).
 *
 * Routes:
 * - /eiendom/.../rapport → 301 → /eiendom/.../rapport-board (scroll-rapporten
 *   døde ved cutover-trimmen 2026-07-06; boardet er produktflaten)
 * - /eiendom/.../innsikt* → passthrough MED `x-insight-search`-header
 *   (innsiktssidene har rammen i en layout, og en layout ser ikke
 *   searchParams — se app/eiendom/[customer]/[project]/innsikt/layout.tsx)
 * - /eiendom/... → Eiendom passthrough (primary)
 * - /for/.../explore → 301 → /eiendom/.../
 * - /for/.../report → 301 → /eiendom/.../rapport-board
 * - /for/... → 301 → /eiendom/... (trips-frysingen døde med rutene)
 * - /generer → 301 → /eiendom/generer
 * - /admin/... → Admin passthrough
 * - /scandic/... → Legacy redirect to /eiendom/scandic/...
 * - /demo/leangenbukta-{nettside,lokal,tilgang} → tilgangsgaten for kundedemoen
 */

const PRODUCT_SUFFIXES = ["explore", "guide"] as const;

/**
 * Leangenbukta-kundedemoen: nettsidekopien, boardet og innloggingen.
 *
 * Gaten ligger her og ikke bare i layoutene fordi proxyen kjører på HVER
 * forespørsel, også klientnavigasjonens RSC-kall — en layout gjør ikke det.
 * Avgjørelsen er `lbDemoAccess` (se lib/demo/leangenbukta-site/access.ts):
 * uten gyldig tilgang gir et konfigurert miljø innlogging, et ukonfigurert 404.
 * Alle svar merkes `noindex`; kopien er ikke kundens offisielle nettsted.
 */
const LB_DEMO_SEGMENTS = new Set(["leangenbukta-nettside", "leangenbukta-lokal", "leangenbukta-tilgang"]);

function leangenbuktaDemo(request: NextRequest, segment: string) {
  const noindex = (response: NextResponse) => {
    response.headers.set("x-robots-tag", "noindex, nofollow");
    return response;
  };
  if (segment === "leangenbukta-tilgang" || lbDemoAccess(request)) return noindex(NextResponse.next());
  if (!lbDemoAccessConfigured()) return noindex(new NextResponse(null, { status: 404 }));
  const target = new URL(LB_DEMO_ACCESS_PATH, request.url);
  target.searchParams.set("neste", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return noindex(NextResponse.redirect(target));
}

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

  // Apex belongs to the shared platform. Nyhavnas site demo stays here too,
  // so its chat cookie and hosted voice control connection share an origin.
  // Other website pages still run on their unchanged www deployment.
  if (process.env.PLACY_HOSTED_VOICE === "true") {
    if (segments[0] === "p" && segments.length === 2 && isPublicProjectSlug(segments[1])) {
      return NextResponse.redirect(new URL(`/${segments[1]}${search}`, request.url));
    }
    const nyhavnaSiteDemo = segments[0] === "demo" && segments[1] === "nyhavna-nettside";
    const websitePage = segments.length === 0
      || (WEBSITE_NAMESPACES as readonly string[]).includes(segments[0])
      || (segments[0] === "demo" && segments[1] !== "nyhavna-lokal" && !nyhavnaSiteDemo);
    if (websitePage && request.nextUrl.hostname === "placy.no") return NextResponse.redirect(new URL(`${pathname}${search}`, "https://www.placy.no"));
  }

  if (segments.length === 0) return NextResponse.next();

  const firstSegment = segments[0];

  if (firstSegment === "demo" && segments[1] === "nyhavna-nettside") {
    const response = NextResponse.next();
    response.headers.set("x-robots-tag", "noindex, nofollow");
    return response;
  }

  if (firstSegment === "demo" && LB_DEMO_SEGMENTS.has(segments[1])) {
    return leangenbuktaDemo(request, segments[1]);
  }

  // /eiendom/... → Eiendom passthrough — men gammel scroll-rapport-URL
  // redirectes til boardet (ruten er slettet, cutover 2026-07-06)
  if (firstSegment === "eiendom") {
    if (segments.length === 4 && segments[3] === "rapport") {
      return NextResponse.redirect(
        new URL(`/eiendom/${segments[1]}/${segments[2]}/rapport-board${search}`, request.url),
        301
      );
    }
    // Innsiktssidenes lenke-token ligger i `?t=`, og rammen rundt dem bor i en
    // layout for at sidepanelet skal overleve navigasjon. Layouts får ikke
    // searchParams, så spørrestrengen sendes videre som header. Bare denne ene
    // ruta: ingen andre sider trenger den, og en header som settes overalt er
    // en header ingen husker hvor kommer fra.
    if (segments.length >= 4 && segments[3] === "innsikt") {
      const headers = new Headers(request.headers);
      headers.set("x-insight-search", search);
      return NextResponse.next({ request: { headers } });
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
