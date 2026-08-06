import type { Metadata } from "next";
import ReportReelsPage from "@/components/variants/report/reels/ReportReelsPage";
import { buildMidtbyenProject } from "@/lib/gigs/midtbyen/build-project";

/**
 * Midtbyen-demoen: 147 sentrumsbutikker på nivå-1-nabolagsflaten, forankret på
 * Torvet.
 *
 * Ruta sender KUN `project`. Det er en beslutning, ikke en forglemmelse:
 * `ReportReelsPage` går i event-modus i det `boardData` sendes inn som prop, og
 * event-modus bytter mobilflaten til `EventMobileSheet` — ikke nabolagsflaten
 * denne demoen skal ligne. Legger noen til `boardData` her «for å gjenbruke
 * event-mønsteret», bytter flaten uten at noe feiler.
 *
 * Ingen data hentes: butikkene ligger som en JSON-fil i repoet, og prosjektet
 * bygges ved render. Ingen Supabase, ingen API-kall, ingen `searchParams` — så
 * ruta kan rendres statisk.
 */
export const metadata: Metadata = {
  title: "Butikkene i Midtbyen | Placy",
  description:
    "147 butikker i Trondheim sentrum på kartet, sortert etter hvor lang tid " +
    "du bruker dit fra Torvet.",
};

export default function MidtbyenPage() {
  const project = buildMidtbyenProject();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ReportReelsPage project={project} />
    </div>
  );
}
