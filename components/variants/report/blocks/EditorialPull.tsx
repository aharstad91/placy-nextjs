"use client";

/**
 * EditorialPull — magasin-stil pull-sitat. Ikke kort, bare tekst som stopper
 * leseren. Brukes som "pust" mellom dense seksjoner eller som emosjonell
 * forsterkning av en vinkel.
 *
 * Typografi:
 *  - Stor serif-lignende (tailwind font-serif hvis tilgjengelig, ellers
 *    vi bruker system-serif)
 *  - Decorative åpnende quote-glyph
 *  - Attribusjon i liten uppercase sans nedenfor
 */

export interface EditorialPullProps {
  /** The quote itself — without surrounding quotation marks (added by component) */
  quote: string;
  /** Attribution line (e.g. "Thomas, beboer på Brøset") */
  attribution?: string;
  /** Visual tone — "plain" (no bg), "sage" (subtle card) */
  tone?: "plain" | "sage";
}

export default function EditorialPull({
  quote,
  attribution,
  tone = "plain",
}: EditorialPullProps) {
  return (
    <figure
      className={[
        "my-16 md:my-20 mx-auto text-center",
        tone === "sage" ? "rounded-2xl bg-[#dde5d6]/50 py-12 md:py-16 px-6" : "py-6",
        "max-w-2xl",
      ].join(" ")}
    >
      {/* Decorative open-quote — large, decorative, low-emphasis */}
      <span
        aria-hidden="true"
        className="block text-6xl md:text-7xl leading-none text-[#d4cfc8] font-serif mb-2 select-none"
      >
        &ldquo;
      </span>

      <blockquote>
        <p
          className="text-2xl md:text-[30px] leading-tight tracking-tight text-[#1a1a1a] font-medium"
          style={{ fontFamily: "'Iowan Old Style', 'Georgia', 'Times New Roman', serif" }}
        >
          {quote}
        </p>
      </blockquote>

      {attribution && (
        <figcaption className="mt-6 text-xs uppercase tracking-[0.22em] text-[#a0937d]">
          — {attribution}
        </figcaption>
      )}
    </figure>
  );
}
