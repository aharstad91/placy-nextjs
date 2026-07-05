import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

/**
 * DEN delte admin-gaten (PRD 12 Unit 1 AC3) — erstatter den dupliserte
 * `process.env.ADMIN_ENABLED === "true"`-sjekken som lå inline på alle
 * admin-sider og admin-API-ruter.
 *
 * Tilgangs-realiteten (PRD 12 §tilgang): `ADMIN_ENABLED` er den ENESTE
 * admin-tilgangskontrollen — ingen per-bruker-auth/session/cookie finnes.
 * Middlewarens `/admin`-branch er en ren passthrough, IKKE en guard;
 * autoritativ gating skjer her, per side/route. Ekte kunde-auth er deferred.
 *
 * `server-only`: modulen kan aldri importeres fra klientkomponenter —
 * env-verdien lekker ikke til klient-bundelen.
 */

export function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

/** Side-gate (server components): redirecter til forsiden når admin er av. */
export function requireAdmin(): void {
  if (!isAdminEnabled()) {
    redirect("/");
  }
}

/**
 * API-gate (route handlers): returnerer 403-respons når admin er av, ellers
 * null. Kalles øverst i handleren:
 *
 *   const gate = requireAdminApi();
 *   if (gate) return gate;
 */
export function requireAdminApi(): NextResponse | null {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: "Admin ikke aktivert" }, { status: 403 });
  }
  return null;
}
