import Link from "next/link";
import { displayDomain, safeHref } from "@/lib/theme-utils";
import CookiesModal from "./CookiesModal";

interface PlacyReportFooterProps {
  /** Prosjektnavn fra project.name */
  projectName: string;
  /** URL til kundens hjemmeside. Null skjuler "Besøk"-linken. */
  homepageUrl?: string | null;
}

/**
 * Footer for Placy-rapporter.
 *
 * Nøytral Placy-branding — ALDRI kundens farger. Footer er Placy-domene.
 * Server component — `CookiesModal` er client-leaf for Dialog-interaktivitet.
 */
export default function PlacyReportFooter({
  projectName,
  homepageUrl,
}: PlacyReportFooterProps) {
  const href = safeHref(homepageUrl);
  const domain = displayDomain(homepageUrl);

  return (
    <footer className="mt-16 bg-[#f7f4ec] border-t border-[#e5e0d5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Rad 1: prosjektnavn + Placy */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-semibold text-[#204c4c]">{projectName}</div>
          <div className="font-semibold text-[#204c4c]">Placy</div>
        </div>

        {/* Rad 2: hjemmeside-lenker */}
        <div className="mt-2 flex items-center justify-between flex-wrap gap-3 text-sm text-[#6a6a6a]">
          {href && domain ? (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1a1a1a] transition-colors"
            >
              Besøk {domain}
            </Link>
          ) : (
            <span />
          )}
          <Link
            href="https://placy.no"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1a1a1a] transition-colors"
          >
            placy.no
          </Link>
        </div>

        {/* Rad 3: lovpålagt + kontakt */}
        <div className="mt-8 pt-4 border-t border-[#e5e0d5] text-xs text-[#8a8a8a] flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <span>© 2026 Placy</span>
          <span aria-hidden="true">·</span>
          <Link
            href="https://placy.no/personvern"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1a1a1a] transition-colors"
          >
            Personvern
          </Link>
          <span aria-hidden="true">·</span>
          <CookiesModal />
          <span aria-hidden="true">·</span>
          <a
            href="mailto:hei@placy.no"
            className="hover:text-[#1a1a1a] transition-colors"
          >
            Kontakt
          </a>
        </div>
      </div>
    </footer>
  );
}
