"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n/strings";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "no", label: "NO" },
  { value: "en", label: "EN" },
];

export default function ReportLocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="inline-flex rounded-full border border-[#e0dbd4] bg-white overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          aria-label={opt.value === "no" ? "Norsk" : "English"}
          aria-pressed={locale === opt.value}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            locale === opt.value
              ? "bg-[#1a1a1a] text-white"
              : "text-[#6a6a6a] hover:text-[#1a1a1a]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
