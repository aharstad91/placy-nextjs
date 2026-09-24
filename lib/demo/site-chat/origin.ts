import "server-only";

import type { NextRequest } from "next/server";

/**
 * Stemmens ruter godtar bare samme origin (eller ingen `Origin`-header, som en
 * samme-side-forespørsel uten den). Felles vakt for alle kunders `remoteVisitor`.
 */
export function sameOriginOrNone(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
