import type { InheritAreaEditorialResult } from "@/lib/pipeline/inherit-area-editorial";

/**
 * Kjører Steg 8 (nabolags-editorial-arv) via `/api/admin/inherit-editorial`
 * i stedet for in-process.
 *
 * Bakgrunn: `inheritAreaEditorial` bygger det render-filtrerte board-settet via
 * `v2-queries` (`server-only`) + `report-data` ("use client"), som KASTER i en
 * ren `tsx`-CLI. Kjørt bak admin-ruten treffer de Next.js' server-kontekst der
 * de resolver — så vi gjenbruker den EKSAKTE render-filtreringen (null drift) og
 * beholder `server-only`-vernet.
 *
 * Kontrakt:
 * - Adminporten (`ADMIN_ENABLED`) må være på → derfor localhost (prod-admin er
 *   avslått). Overstyr base med `PROVISION_LOCAL_URL` ved behov (f.eks. worktree
 *   på :3001).
 * - Fail-soft: ureikbar dev-server / 403 / feil → `skipped`-resultat med warning.
 *   Board leveres da som nivå 1, og akseptansesjekken flagger den manglende
 *   editorial-en (aldri stille halvt innhold).
 */
export async function inheritAreaEditorialViaRoute(opts: {
  projectId: string;
  customerSlug: string;
  projectSlug: string;
  lat: number;
  lng: number;
}): Promise<InheritAreaEditorialResult> {
  const base = process.env.PROVISION_LOCAL_URL ?? "http://localhost:3000";
  const skip = (warning: string): InheritAreaEditorialResult => ({
    skipped: true,
    themesInherited: [],
    themesWithFaq: [],
    globalFaqAnswers: 0,
    highlights: { kept: 0, dropped: [] },
    warnings: [warning],
  });

  try {
    const res = await fetch(`${base}/api/admin/inherit-editorial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const detail =
        res.status === 403
          ? "admin ikke aktivert (ADMIN_ENABLED) på dev-serveren"
          : `HTTP ${res.status}`;
      return skip(
        `⚠️  Editorial-arv via route feilet (${detail}) — board leveres som nivå 1`
      );
    }
    return (await res.json()) as InheritAreaEditorialResult;
  } catch (e) {
    return skip(
      `⚠️  Editorial-arv-route utilgjengelig (${
        e instanceof Error ? e.message : "ukjent"
      }) — kjører dev-server på ${base}? Board leveres som nivå 1`
    );
  }
}
