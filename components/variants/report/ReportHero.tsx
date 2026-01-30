import type { ReportHeroMetrics } from "./report-data";

interface ReportHeroProps {
  projectName: string;
  metrics: ReportHeroMetrics;
}

export default function ReportHero({ projectName, metrics }: ReportHeroProps) {
  return (
    <section className="pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="max-w-3xl mx-auto px-6">
        {/* Label */}
        <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
          Nabolagsrapport
        </p>

        {/* Project name */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#1a1a1a] leading-tight mb-6">
          {projectName}
        </h1>

        {/* Summary paragraph with inline metrics */}
        <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed">
          I nærområdet finner du{" "}
          <span className="font-semibold text-[#1a1a1a]">
            {metrics.totalPOIs} steder
          </span>{" "}
          innen gåavstand.{" "}
          {metrics.ratedPOIs > 0 && (
            <>
              De{" "}
              <span className="font-semibold text-[#1a1a1a]">
                {metrics.ratedPOIs} vurderte
              </span>{" "}
              har et snitt på{" "}
              <span className="font-semibold text-[#b45309]">
                {metrics.avgRating.toFixed(1)} ★
              </span>
              {metrics.totalReviews > 0 && (
                <>
                  {" "}
                  basert på{" "}
                  <span className="font-semibold text-[#1a1a1a]">
                    {metrics.totalReviews.toLocaleString("nb-NO")} anmeldelser
                  </span>
                </>
              )}
              .{" "}
            </>
          )}
          {metrics.transportCount > 0 && (
            <>
              <span className="font-semibold text-[#1a1a1a]">
                {metrics.transportCount} transportpunkter
              </span>{" "}
              gjør det enkelt å komme seg rundt.
            </>
          )}
        </p>

        {/* Divider */}
        <div className="mt-10 h-px bg-[#e8e4df]" />
      </div>
    </section>
  );
}
