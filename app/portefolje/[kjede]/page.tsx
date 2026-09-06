import { notFound } from "next/navigation";
import { buildPortfolioPageData } from "@/lib/portfolio/rows";
import { PortfolioShell } from "@/components/portfolio/PortfolioShell";

/**
 * Porteføljekart per meglerkjede: `/portefolje/hem`.
 *
 * Ruten kan IKKE ligge under `/kart/` — `app/kart/[slug]` er en redirect-stubb
 * som svelger ett segment og sender det videre til et eiendomsprosjekt.
 *
 * Delbar uten innlogging (R9), men ikke indeksert: dette er materiell til ett
 * møte, ikke en offentlig flate. Samme mønster som redirect-stubben og
 * pitch-siden.
 *
 * Sidevisninger telles av Vercel Analytics, som er montert for alle ruter i
 * `app/layout.tsx`. Ingen egen hendelsestype: en ny type i `v2.events` krever
 * migrasjon av CHECK-constrainten for en måling analytics-dashbordet alt gir
 * per rute og enhet.
 */
export const metadata = {
  title: "Porteføljekart",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ kjede: string }>;
}

export default async function PortefoljePage({ params }: PageProps) {
  const { kjede } = await params;

  const data = await buildPortfolioPageData(kjede);
  if (!data) notFound();

  return <PortfolioShell data={data} />;
}
