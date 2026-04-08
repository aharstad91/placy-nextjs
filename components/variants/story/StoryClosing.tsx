"use client";

import { MapPin, FileText } from "lucide-react";
import Link from "next/link";

interface StoryClosingProps {
  projectName: string;
  explorerUrl?: string;
  reportUrl?: string;
}

export default function StoryClosing({ projectName, explorerUrl, reportUrl }: StoryClosingProps) {
  return (
    <footer className="py-16 md:py-24 text-center">
      {/* Closing separator */}
      <div className="flex items-center gap-4 mb-10">
        <div className="h-px flex-1 bg-[#e0dcd6]" />
        <div className="w-2 h-2 rounded-full bg-[#d4cfc8]" />
        <div className="h-px flex-1 bg-[#e0dcd6]" />
      </div>

      <h2
        className="text-2xl md:text-3xl font-semibold text-[#1a1a1a] mb-4"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        Utforsk nabolaget videre
      </h2>

      <p className="text-lg text-[#6a6a6a] mb-8 max-w-md mx-auto">
        Denne oversikten er et utdrag. Utforsk alle steder interaktivt på kartet, eller les den fullstendige rapporten.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {explorerUrl && (
          <Link
            href={explorerUrl}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Åpne Explorer
          </Link>
        )}

        {reportUrl && (
          <Link
            href={reportUrl}
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#d4cfc8] bg-white text-[#4a4a4a] text-sm font-medium hover:bg-[#f5f3f0] transition-colors"
          >
            <FileText className="w-4 h-4" />
            Full rapport
          </Link>
        )}
      </div>

      {/* Placy attribution */}
      <p className="mt-12 text-xs text-[#b0a89c]">
        Nabolagsanalyse av Placy · {projectName}
      </p>
    </footer>
  );
}
