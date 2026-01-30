interface ReportClosingProps {
  projectName: string;
  totalPOIs: number;
  avgRating: number;
}

export default function ReportClosing({
  projectName,
  totalPOIs,
  avgRating,
}: ReportClosingProps) {
  return (
    <>
      {/* Closing section */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="h-px bg-[#e8e4df] mb-12" />

          <h2 className="text-xl md:text-2xl font-semibold text-[#1a1a1a] mb-4">
            Oppsummert
          </h2>
          <p className="text-base md:text-lg text-[#4a4a4a] leading-relaxed">
            Nærområdet rundt {projectName} byr på {totalPOIs} steder innenfor
            gangavstand — fra kafeer og restauranter til dagligvare,
            treningssentre og kollektivtransport. Med et samlet snitt på{" "}
            {avgRating.toFixed(1)} stjerner viser vurderingene at dette er et
            nabolag med jevnt god kvalitet på tilbudet. Det handler ikke om
            enkeltsteder alene, men om helheten: hverdagen fungerer.
          </p>
        </div>
      </section>

      {/* Attribution footer */}
      <footer className="py-8 bg-[#f3f0eb] border-t border-[#e8e4df]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs text-[#8a8a8a]">
            Data: Google, Entur, Trondheim Bysykkel
          </p>
          <p className="text-xs text-[#a0a0a0] mt-1">
            Nabolagsrapport av Placy
          </p>
        </div>
      </footer>
    </>
  );
}
