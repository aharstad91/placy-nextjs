"use client";

import React from "react";
import Image from "next/image";
import { renderEmphasizedText } from "@/lib/utils/render-emphasized-text";
import { linkPOIsInText } from "@/lib/utils/story-text-linker";
import type { ReportTheme } from "../report-data";
import POIPopover from "../POIPopover";

interface Props {
  theme: ReportTheme;
  index: number;
  isLast: boolean;
}

export default function ParaformThemeSection({ theme, index, isLast }: Props) {
  const bridgeSegments = theme.bridgeText
    ? linkPOIsInText(theme.bridgeText, theme.allPOIs)
    : [];
  const segments = theme.leadText
    ? linkPOIsInText(theme.leadText, theme.allPOIs)
    : [];

  return (
    <section
      id={`paraform-${theme.id}`}
      className="scroll-mt-[7rem] py-16 md:py-20"
      style={isLast ? undefined : { borderBottom: "1px solid #e8e3d8" }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="font-[family-name:var(--font-serif)] text-sm tabular-nums text-[#a89f8c]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-xs uppercase tracking-[0.22em] text-[#8a8275]">
          Tema
        </span>
      </div>

      <h2 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl text-[#1a1a1a] leading-[1.1] tracking-tight mb-6">
        {theme.name}
      </h2>

      {bridgeSegments.length > 0 && (
        <p className="text-xl md:text-2xl text-[#4a4a4a] leading-snug mb-10 max-w-[640px]">
          {bridgeSegments.map((seg, i) =>
            seg.type === "poi" && seg.poi ? (
              <POIPopover key={i} poi={seg.poi} label={seg.content} />
            ) : (
              <React.Fragment key={i}>{renderEmphasizedText(seg.content)}</React.Fragment>
            )
          )}
        </p>
      )}

      {theme.image && (
        <div className="mb-10 w-full rounded-2xl overflow-hidden bg-white">
          <Image
            src={theme.image.src}
            alt=""
            aria-hidden="true"
            width={theme.image.width}
            height={theme.image.height}
            sizes="(min-width: 1024px) 720px, 100vw"
            className="w-full h-auto select-none pointer-events-none"
            draggable={false}
          />
        </div>
      )}

      {segments.length > 0 && (
        <div className="text-base md:text-lg text-[#3a3a3a] leading-[1.7]">
          {segments.map((seg, i) =>
            seg.type === "poi" && seg.poi ? (
              <POIPopover key={i} poi={seg.poi} label={seg.content} />
            ) : (
              <span key={i}>{seg.content}</span>
            )
          )}
        </div>
      )}

      {segments.length === 0 && theme.intro && (
        <p className="text-base md:text-lg text-[#3a3a3a] leading-[1.7]">
          {theme.intro}
        </p>
      )}
    </section>
  );
}
