import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin";
import { inheritAreaEditorial } from "@/lib/pipeline/inherit-area-editorial";

/**
 * Steg 8 (nabolags-editorial-arv) eksponert som admin-route.
 *
 * Hvorfor route og ikke in-process: `inheritAreaEditorial` drar `v2-queries`
 * (`server-only`) + `report-data` ("use client") via dynamiske imports for å
 * bygge det render-filtrerte board-settet (highlight-resolusjon). De KASTER i
 * en ren `tsx`-CLI (provision-rapport.ts), men resolver korrekt i Next.js'
 * server-kontekst. Ved å kjøre steget her gjenbruker vi den EKSAKTE
 * render-filtreringen (null drift), beholder `server-only`-vernet, og lar
 * provisjonerings-pipelinen forbli CLI-kjørbar (den kaller denne ruten).
 */
export async function POST(request: NextRequest) {
  const gate = requireAdminApi();
  if (gate) return gate;

  let body: {
    projectId?: unknown;
    customerSlug?: unknown;
    projectSlug?: unknown;
    lat?: unknown;
    lng?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, customerSlug, projectSlug, lat, lng } = body;
  if (
    typeof projectId !== "string" ||
    typeof customerSlug !== "string" ||
    typeof projectSlug !== "string" ||
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return NextResponse.json(
      {
        error:
          "projectId/customerSlug/projectSlug (string) + lat/lng (finite number) kreves",
      },
      { status: 400 }
    );
  }

  try {
    const result = await inheritAreaEditorial({
      projectId,
      customerSlug,
      projectSlug,
      lat,
      lng,
    });
    return NextResponse.json(result);
  } catch (e) {
    // Skrive-/optimistisk-lås-feil i editorial-arven kaster med vilje (aldri
    // delvis editorial). Rapportér til kalleren så pipelinen kan flagge nivå-2-
    // mangel i akseptansesjekken framfor å skrive halvt innhold.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "editorial-arv feilet" },
      { status: 500 }
    );
  }
}
