"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { t } from "@/lib/i18n/strings";

interface ReportClosingProps {
  projectName: string;
  totalPOIs: number;
  avgRating: number;
  label?: string;
}

export default function ReportClosing({
  label,
}: Pick<ReportClosingProps, "label">) {
  const { locale } = useLocale();

  return (
    <footer className="col-span-12 py-8 bg-[#f3f0eb] border-t border-[#e8e4df] -mx-8 px-8 md:-mx-16 md:px-16">
      <p className="text-xs text-[#8a8a8a]">
        Data: Google, Entur, Trondheim Bysykkel
      </p>
      <p className="text-xs text-[#a0a0a0] mt-1">
        {label ? `${label} ${t(locale, "byPlacy")}` : `${t(locale, "label")} ${t(locale, "byPlacy")}`}
      </p>
    </footer>
  );
}
