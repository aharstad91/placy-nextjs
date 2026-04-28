interface Props {
  projectName: string;
  heroIntro?: string;
  themesCount: number;
  poiCount: number;
}

export default function ParaformHero({ projectName, heroIntro, themesCount, poiCount }: Props) {
  return (
    <section className="max-w-[1080px] mx-auto w-full px-6 md:px-12 pt-24 md:pt-32 pb-12 md:pb-20">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8a8275] mb-6">
        Nabolagsrapport
      </p>

      <h1 className="font-[family-name:var(--font-serif)] text-5xl md:text-7xl text-[#1a1a1a] leading-[1.05] tracking-tight mb-8 max-w-[820px]">
        {projectName}
      </h1>

      {heroIntro && (
        <p className="text-lg md:text-xl text-[#5a5a5a] leading-snug max-w-[640px] mb-14">
          {heroIntro}
        </p>
      )}

      <div className="flex items-end gap-12 md:gap-20 border-t border-[#e8e3d8] pt-8">
        <div>
          <p className="font-[family-name:var(--font-serif)] text-5xl md:text-6xl text-[#1a1a1a] leading-none mb-2">
            {poiCount}
          </p>
          <p className="text-sm text-[#6a6a6a]">steder kartlagt</p>
        </div>
        <div>
          <p className="font-[family-name:var(--font-serif)] text-5xl md:text-6xl text-[#1a1a1a] leading-none mb-2">
            {themesCount}
          </p>
          <p className="text-sm text-[#6a6a6a]">temaer</p>
        </div>
      </div>
    </section>
  );
}
