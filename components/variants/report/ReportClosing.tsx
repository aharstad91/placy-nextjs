"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { t } from "@/lib/i18n/strings";

interface ReportClosingProps {
  projectName: string;
  totalPOIs: number;
  avgRating: number;
  closingTitle?: string;
  closingText?: string;
  label?: string;
}

const DEFAULT_CLOSING: Record<"no" | "en", (name: string, pois: number, rating: string) => string> = {
  no: (name, pois, rating) =>
    `Nærområdet rundt ${name} byr på ${pois} steder innenfor gangavstand — fra kafeer og restauranter til dagligvare, treningssentre og kollektivtransport. Med et samlet snitt på ${rating} stjerner viser vurderingene at dette er et nabolag med jevnt god kvalitet på tilbudet. Det handler ikke om enkeltsteder alene, men om helheten: hverdagen fungerer.`,
  en: (name, pois, rating) =>
    `The neighborhood around ${name} offers ${pois} places within walking distance — from cafés and restaurants to grocery stores, gyms, and public transit. With an overall average of ${rating} stars, ratings show this is a neighborhood with consistently high quality across the board. It's not about individual places alone, but the whole picture: everyday life just works.`,
};

export default function ReportClosing({
  projectName,
  totalPOIs,
  avgRating,
  closingTitle,
  closingText,
  label,
}: ReportClosingProps) {
  const { locale } = useLocale();
  const rating = avgRating.toFixed(1);
  const defaultText = DEFAULT_CLOSING[locale](projectName, totalPOIs, rating);

  return (
    <>
      {/* Closing section */}
      <section className="col-span-12 py-16 md:py-20">
        <div className="max-w-4xl">
          <div className="h-px bg-[#e8e4df] mb-12" />

          <h2 className="text-xl md:text-2xl font-semibold text-[#1a1a1a] mb-4">
            {closingTitle ?? t(locale, "summary")}
          </h2>
          <p className="text-base md:text-lg text-[#4a4a4a] leading-relaxed">
            {closingText ?? defaultText}
          </p>
        </div>
      </section>

      {/* Attribution footer */}
      <footer className="col-span-12 py-8 bg-[#f3f0eb] border-t border-[#e8e4df] -mx-16 px-16">
        <p className="text-xs text-[#8a8a8a]">
          Data: Google, Entur, Trondheim Bysykkel
        </p>
        <p className="text-xs text-[#a0a0a0] mt-1">
          {label ? `${label} ${t(locale, "byPlacy")}` : `${t(locale, "label")} ${t(locale, "byPlacy")}`}
        </p>
      </footer>
    </>
  );
}
