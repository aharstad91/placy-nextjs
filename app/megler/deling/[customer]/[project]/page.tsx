import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";
import { createServerClient } from "@/lib/supabase/client";
import SharePanel from "@/components/megler/SharePanel";
import { shareUrl, boardPath, siteBaseUrl } from "@/lib/megler/urls";

/**
 * Delings-siden per board (Unit 3, R8–R11/R18/R19).
 *
 * Oppslagsstrategi (sluggene DIVERGERER — se plan Key Technical Decisions):
 * request-radens `address_slug` = slugify(gatedelen), mens prosjektets `url_slug`
 * lages av HELE adressen i createReportProject. Derfor:
 *  1) Resolve FØRST mot v2.projects.url_slug (per customer) — kanonisk board.
 *  2) Fallback mot generation_requests.address_slug (pending/eldre lenker):
 *     - completed → 301 til den kanoniske url_slug-delings-siden.
 *     - pending/failed → vente-/feil-tilstand (ikke død preview).
 *  3) Ellers 404.
 *
 * noindex — samme URL-hemmeligholds-logikk som kontor-siden.
 */

export const metadata: Metadata = {
  title: "Del nabolagskartet | Placy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Anbefalt iframe-min-høyde — startverdi, empirisk tunet i Unit 6 (mobil).
const RECOMMENDED_IFRAME_HEIGHT = 600;

// v2-scopet klient. Konkret .schema("v2")-instansiering (ellers taper Db-typen
// v2-eneste tabeller som broker_offices — jf. route.ts).
function v2Client() {
  return createServerClient().schema("v2");
}
type Db = ReturnType<typeof v2Client>;

interface PageProps {
  params: Promise<{ customer: string; project: string }>;
}

export default async function DelingPage({ params }: PageProps) {
  const { customer, project } = await params;
  const db = v2Client();

  // 1) Kanonisk: prosjekt-slug (url_slug) per kunde
  const { data: proj } = await db
    .from("projects")
    .select("url_slug, name")
    .eq("customer_id", customer)
    .eq("url_slug", project)
    .maybeSingle();

  if (proj) {
    return renderShare(db, customer, proj.url_slug, proj.name);
  }

  // 2) Fallback: request-slug (address_slug) — pending/eldre lenker
  const { data: req } = await db
    .from("generation_requests")
    .select("status, project_id, address")
    .eq("customer_id", customer)
    .eq("address_slug", project)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) notFound();

  if (req.status === "completed" && req.project_id) {
    // Kanonisér: hent prosjektets url_slug og 301 dit
    const { data: canonical } = await db
      .from("projects")
      .select("url_slug")
      .eq("id", req.project_id)
      .maybeSingle();
    if (canonical) redirect(shareUrl(customer, canonical.url_slug));
    notFound();
  }

  // pending/failed → vente-/feil-tilstand
  return <PendingState status={req.status} address={req.address} />;
}

/** Bygger SharePanel-props (absolutte board-URLer med kanal-markører). */
async function renderShare(
  db: Db,
  customer: string,
  slug: string,
  address: string
) {
  const base = siteBaseUrl();
  const board = boardPath(customer, slug);

  // Tilbake-lenke til kontor-siden: nyeste aktive kontor for kunden (om noen)
  const { data: office } = await db
    .from("broker_offices")
    .select("slug")
    .eq("customer_id", customer)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <SharePanel
      address={address}
      boardLinkUrl={`${base}${board}?src=finn`}
      boardEmbedUrl={`${base}${board}?embed=1&src=embed`}
      boardQrUrl={`${base}${board}?src=qr`}
      previewSrc={`${board}?embed=1&src=embed`}
      recommendedHeight={RECOMMENDED_IFRAME_HEIGHT}
      backHref={office ? `/megler/${office.slug}` : null}
    />
  );
}

function PendingState({ status, address }: { status: string; address: string }) {
  const failed = status === "failed";
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {failed ? (
          <MapPin className="w-16 h-16 text-red-400 mx-auto mb-6" />
        ) : (
          <Loader2 className="w-16 h-16 text-gray-400 mx-auto mb-6 animate-spin" />
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {failed ? "Genereringen feilet" : "Nabolagskartet genereres"}
        </h1>
        <p className="text-gray-600">
          {failed
            ? `Noe gikk galt under genereringen av kartet for ${address}. Vi har registrert feilen — prøv gjerne igjen senere.`
            : `Kartet for ${address} lages nå. Dette tar vanligvis noen minutter — last siden på nytt om litt.`}
        </p>
      </div>
    </div>
  );
}
