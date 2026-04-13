import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { displayDomain, safeHref } from "@/lib/theme-utils";
import ShareButton from "./ShareButton";

interface PlacyReportHeaderProps {
  /** Prosjektnavn fra project.name */
  projectName: string;
  /** URL til kundens hjemmeside. Null skjuler tilbake-linken. */
  homepageUrl?: string | null;
  /** Tittel sendt til share-sheet. Default: "Nabolagsrapport for {projectName}". */
  shareTitle?: string;
}

/**
 * Sticky header for Placy-rapporter.
 *
 * - Bakgrunn: `--primary` (kundens brand-farge fra ProjectTheme)
 * - Tekst: `--primary-foreground` (auto-computed fra luminance, eller DB-verdi)
 * - Venstre: tilbake-link til kundens hjemmeside (hvis homepage_url er satt)
 * - Senter: prosjektnavn (skjult på mobile — hero viser det tydelig allerede)
 * - Høyre: del-knapp (native share sheet på mobile, clipboard på desktop)
 *
 * Server component — interaktivitet isolert i ShareButton (client).
 * Z-index 50 — sitter over ReportFloatingNav (z-40).
 */
export default function PlacyReportHeader({
  projectName,
  homepageUrl,
  shareTitle,
}: PlacyReportHeaderProps) {
  const href = safeHref(homepageUrl);
  const domain = displayDomain(homepageUrl);

  return (
    <header
      className="h-14 bg-primary text-primary-foreground"
      style={{ backgroundColor: "hsl(var(--primary))" }}
    >
      <div className="h-full px-16 flex items-center justify-between gap-4">
        {/* Venstre: tilbake-link */}
        {href && domain ? (
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Tilbake til ${domain}`}
            className="inline-flex items-center gap-1.5 text-sm opacity-90 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-md px-2 py-1 -ml-2"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{domain}</span>
          </Link>
        ) : (
          <div aria-hidden="true" />
        )}

        {/* Senter: prosjektnavn — kun desktop (hero viser på mobile) */}
        <div className="hidden sm:block font-semibold text-base tracking-tight truncate">
          {projectName}
        </div>

        {/* Høyre: del-knapp */}
        <ShareButton title={shareTitle ?? `Nabolagsrapport for ${projectName}`} />
      </div>
    </header>
  );
}
