import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/client";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";
import OfficeGenererForm from "@/components/megler/OfficeGenererForm";

/**
 * Kontor-scopet self-serve-inngang (Unit 1, R1/R2/R15).
 *
 * Lenken ER tilgangsmodellen — derfor noindex (en indeksert slug-side ødelegger
 * rotasjonssemantikken) og slug-oppslag SERVER-SIDE (ugyldig slug når aldri
 * klient-JS). Ukjent/inaktiv slug → 404 (not-found.tsx i samme segment); ingen
 * kunde-rad opprettes noen gang her (getOrCreateCustomer-upsert gjelder IKKE
 * denne inngangen — R15).
 */

export const metadata: Metadata = {
  title: "Lag nabolagskart | Placy",
  robots: { index: false, follow: false },
};

// GET-siden er dynamisk — Next ville ellers prøve å prerendre den statisk.
export const dynamic = "force-dynamic";

// Slug-suffikset (6 tegn) kunne brute-forces friksjonsfritt uten grense på
// oppslaget. Per-IP-tak + 404-burst er brute-force-signalet. In-memory
// (prototype-grense, som resten av rate-limitene — lib/utils/rate-limit.ts).
const slugLookupLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

interface OfficePageProps {
  params: Promise<{ slug: string }>;
}

export default async function OfficePage({ params }: OfficePageProps) {
  const { slug } = await params;

  const ip = getClientIp(await headers());
  if (!slugLookupLimiter.check(ip)) {
    console.warn(
      `[megler] rate-limited kontor-oppslag fra ${ip} (mulig brute-force av slug-suffiks)`
    );
    notFound();
  }

  const db = createServerClient().schema("v2");
  const { data: office, error } = await db
    .from("broker_offices")
    .select("slug, name, customer_id, active")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  // Fail-closed: en DB-feil skal ikke lekke som en distinguibel 500 (rotasjons-
  // orakel) — samme 404 som ukjent slug, men logget så ops kan se det.
  if (error) {
    console.error(
      `[megler] broker_offices-oppslag feilet for "${slug}": ${error.message}`
    );
    notFound();
  }
  if (!office) {
    console.warn(`[megler] ukjent/inaktiv kontor-slug: "${slug}"`);
    notFound();
  }

  return <OfficeGenererForm officeSlug={office.slug} officeName={office.name} />;
}
