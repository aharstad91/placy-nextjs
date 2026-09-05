import type { ReactNode } from "react";

/**
 * Presentasjonsprimitiver for pitch-slides. Rene server-komponenter — de
 * sendes som children inn i <PitchDeck> (klient), så innholdet rendres på
 * server og deck-skallet håndterer bare navigasjon.
 */

export function PitchSlide({
  children,
  wide = false,
  tone = "light",
}: {
  children: ReactNode;
  /** Bredere spalte — for slides med tre kort ved siden av hverandre. */
  wide?: boolean;
  tone?: "light" | "dark";
}) {
  // Innholdet sentreres alltid vertikalt. Slides som er høyere enn vinduet
  // scroller i stedet (main-elementet i PitchDeck eier scrollen).
  return (
    <section
      className={`flex min-h-full flex-col justify-center px-5 py-8 md:px-12 md:py-12 ${
        tone === "dark" ? "bg-[#1a1a1a] text-[#faf9f7]" : ""
      }`}
    >
      <div className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        tone === "dark" ? "text-[#a0937d]" : "text-[#a0937d]"
      }`}
    >
      {children}
    </p>
  );
}

export function Headline({
  children,
  size = "md",
}: {
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <h2
      className={`font-semibold tracking-tight ${
        size === "lg"
          ? "text-3xl leading-[1.1] md:text-6xl"
          : "text-2xl leading-[1.15] md:text-4xl"
      }`}
    >
      {children}
    </h2>
  );
}

export function Lede({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={`mt-5 max-w-3xl text-base leading-relaxed md:text-lg ${
        tone === "dark" ? "text-[#c9c4bc]" : "text-[#57534e]"
      }`}
    >
      {children}
    </p>
  );
}

/** Faktakort — brukes i rader på 2–4. */
export function Fact({
  value,
  label,
  tone = "light",
}: {
  value: ReactNode;
  label: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        tone === "dark"
          ? "border-[#3a3733] bg-[#232120]"
          : "border-[#eae6e1] bg-white"
      }`}
    >
      <div className="text-2xl font-semibold tracking-tight md:text-3xl">
        {value}
      </div>
      <div
        className={`mt-1 text-[13px] leading-snug ${
          tone === "dark" ? "text-[#a09a92]" : "text-[#78716c]"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

export function FactRow({
  children,
  cols = 3,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}) {
  const grid =
    cols === 2
      ? "sm:grid-cols-2"
      : cols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3";
  return <div className={`mt-8 grid gap-3 ${grid}`}>{children}</div>;
}

/** Nummerert punkt i en prosess- eller argumentrekke. */
export function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-4 border-t border-[#eae6e1] pt-4">
      <div className="mt-0.5 w-24 shrink-0 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a0937d]">
        {n}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        {children && (
          <p className="mt-1 text-sm leading-relaxed text-[#57534e]">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

/** Sitat hentet fra kundens eget materiell — kilden må alltid oppgis. */
export function Quote({
  children,
  source,
}: {
  children: ReactNode;
  source: string;
}) {
  return (
    <figure className="mt-8 border-l-2 border-[#a0937d] pl-5 md:pl-6">
      <blockquote className="text-lg leading-relaxed text-[#2a2724] md:text-2xl md:leading-[1.45]">
        {children}
      </blockquote>
      <figcaption className="mt-3 text-[13px] text-[#8a8a8a]">
        {source}
      </figcaption>
    </figure>
  );
}
