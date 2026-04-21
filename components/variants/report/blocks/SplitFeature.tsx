"use client";

import Image from "next/image";
import { renderEmphasizedText } from "@/lib/utils/render-emphasized-text";

/**
 * SplitFeature — 50/50 diptyk som bryter ut av 800px-kolonnen.
 * Venstre: tekst (kicker, heading, body, bullets). Høyre: illustrasjon eller
 * custom visual slot. Apple bruker dette for feature-highlights hele veien.
 *
 * Kolonnerekkefølge kan flippes via `reverse={true}` for rytme-variasjon.
 */

export interface SplitFeatureProps {
  kicker?: string;
  /** Headline — supports **markdown emphasis** */
  title: string;
  /** Main body text — supports **markdown emphasis** */
  body?: string;
  /** Optional bullet points rendered as a stat-list */
  bullets?: Array<{ label: string; value?: string }>;
  /** Illustration path (full-width inside its column) */
  image?: string;
  /** Image dimensions for next/image aspect-ratio reservation */
  imageWidth?: number;
  imageHeight?: number;
  /** If true, image on left, text on right (default: text left, image right) */
  reverse?: boolean;
  /** Background tone for text side — subtle card feel. Default transparent. */
  tone?: "transparent" | "sage" | "cream";
}

const TONE_BG: Record<NonNullable<SplitFeatureProps["tone"]>, string> = {
  transparent: "",
  sage: "bg-[#dde5d6]/50",
  cream: "bg-[#f5f1ec]",
};

export default function SplitFeature({
  kicker,
  title,
  body,
  bullets,
  image,
  imageWidth = 1200,
  imageHeight = 800,
  reverse = false,
  tone = "transparent",
}: SplitFeatureProps) {
  return (
    <div className="my-16 md:my-20 -mx-16">
      <div
        className={[
          "grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0 rounded-2xl overflow-hidden",
          TONE_BG[tone],
        ].join(" ")}
      >
        {/* Text side */}
        <div
          className={[
            "flex flex-col justify-center px-8 md:px-12 py-10 md:py-16",
            reverse ? "md:order-2" : "md:order-1",
          ].join(" ")}
        >
          {kicker && (
            <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
              {kicker}
            </p>
          )}
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1a1a1a] leading-tight mb-4">
            {renderEmphasizedText(title)}
          </h3>
          {body && (
            <p className="text-base md:text-lg text-[#4a4a4a] leading-relaxed tracking-tight">
              {renderEmphasizedText(body)}
            </p>
          )}
          {bullets && bullets.length > 0 && (
            <ul className="mt-6 space-y-3">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  {b.value && (
                    <span className="font-semibold tracking-tight text-[#1a1a1a] text-lg md:text-xl tabular-nums min-w-[3.5rem]">
                      {b.value}
                    </span>
                  )}
                  <span className="text-sm md:text-base text-[#4a4a4a] leading-snug">
                    {b.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Image side */}
        <div
          className={[
            "relative min-h-[320px] md:min-h-0",
            reverse ? "md:order-1" : "md:order-2",
          ].join(" ")}
        >
          {image && (
            <Image
              src={image}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover pointer-events-none select-none"
              draggable={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
