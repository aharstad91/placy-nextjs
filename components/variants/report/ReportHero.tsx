"use client";

import Image from "next/image";
import { renderEmphasizedText } from "@/lib/utils/render-emphasized-text";

interface ReportHeroProps {
  projectName: string;
  heroIntro?: string;
  heroImage?: string;
}

export default function ReportHero({ projectName, heroIntro, heroImage }: ReportHeroProps) {
  return (
    <section className="flex flex-col bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-8">
        {/* Left: text — padding fra 1080px-containeren rundt, ikke internt */}
        <div className="flex flex-col justify-center py-10 md:py-14">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-[#1a1a1a] leading-tight tracking-tight mb-6">
            {projectName}
          </h1>

          {heroIntro && (
            <p className="text-xl md:text-2xl text-[#6a6a6a] leading-snug tracking-tight">
              {renderEmphasizedText(heroIntro)}
            </p>
          )}
        </div>

        {/* Right: illustration */}
        {heroImage && (
          <div className="relative hidden md:block min-h-[420px]">
            <Image
              src={heroImage}
              alt={projectName}
              fill
              className="object-contain object-right"
              priority
              sizes="50vw"
            />
          </div>
        )}
      </div>
    </section>
  );
}
