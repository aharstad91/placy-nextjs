interface PortraitClosingProps {
  title: string;
  paragraphs: string[];
  projectName: string;
}

export default function PortraitClosing({
  title,
  paragraphs,
  projectName,
}: PortraitClosingProps) {
  return (
    <>
      {/* Closing narrative */}
      <section className="py-20 md:py-28 bg-[#f3f0eb]">
        <div className="max-w-prose mx-auto px-6">
          <div className="w-12 h-[1px] bg-[#c9a84c] mb-10" />
          <h2
            className="text-2xl md:text-3xl text-[#1a1a1a] leading-tight mb-10"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {title}
          </h2>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-lg md:text-xl text-[#3d3d3d] leading-[1.8] mb-8 last:mb-0"
            >
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#1a1a1a]">
        <div className="max-w-prose mx-auto px-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-[#666]">
            {projectName}
          </p>
          <p className="text-xs text-[#444] mt-2">
            Nabolagsportrett av Placy
          </p>
        </div>
      </footer>
    </>
  );
}
