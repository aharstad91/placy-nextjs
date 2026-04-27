"use client";

import { MapPin } from "lucide-react";
import type { ReportTheme } from "./report-data";

interface ReportMapIntroCardProps {
  poiCount: number;
  motiver?: string[];
  themes: ReportTheme[];
}

export default function ReportMapIntroCard({ poiCount, motiver, themes }: ReportMapIntroCardProps) {
  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#a0937d] mb-1">Nabolaget</p>
        <p className="text-3xl font-semibold text-[#1a1a1a] leading-none">{poiCount}</p>
        <p className="text-sm text-[#6a6a6a] mt-1">steder kartlagt</p>
      </div>

      {motiver && motiver.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#a0937d] mb-3">Kjennetegn</p>
          <ul className="flex flex-col gap-2">
            {motiver.map((m) => (
              <li key={m} className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#a0937d] shrink-0 mt-0.5" />
                <span className="text-sm text-[#3a3a3a] leading-snug">{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#a0937d] mb-3">Kategorier</p>
        <ul className="flex flex-col gap-1.5">
          {themes.map((theme) => (
            <li key={theme.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#3a3a3a]">{theme.name}</span>
              <span className="text-xs text-[#a0937d] tabular-nums">{theme.allPOIs.length}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
