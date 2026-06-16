"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronUp, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Styrer synlighet. Komponenten holdes montert (kartet varmes opp bak) og
   *  veksler kun opacity/pointer-events — re-åpning er momentan. */
  visible: boolean;
  /** Prosjektnavn, eks. "Stasjonskvartalet". */
  name: string;
  /** Bydel + by, eks. "Midtbyen, Trondheim". */
  subline?: string;
  /** Logo-SVG (prosjekt-brand). Mangler → tekst-eyebrow vises i stedet. */
  logoSrc?: string;
  /** Full-bleed hero-bilde (fallback når heroVideo mangler). */
  heroImage?: string;
  /** Full-bleed hero-video (9:16-vennlig, center-croppet) — overstyrer
   *  heroImage. Poster avledes ved `.mp4` → `.jpg`. */
  heroVideo?: string;
  /** Valgfri intro-tekst — faller tilbake til standard velkomst-copy. */
  intro?: string;
  /** Overstyrer overskriften "Velkommen til {name}" (brukes i embed-modus). */
  headline?: string;
  /** Knappe-tekst: "Start opplevelsen" / "Fortsett" / "Spill av på nytt". */
  primaryLabel: string;
  /** Trykk play / swipe opp → dropp splash, fly inn kartet, start tur. */
  onPlay: () => void;
  /**
   * Embed-modus: splashen vises inni en iframe på en ekstern nettside. Da:
   * ingen swipe-to-start (knappen er eneste utløser), ingen logo, og knappen
   * åpner full Placy-opplevelse i ny fane (target=_blank) i stedet for å starte
   * turen inline. URL avledes fra gjeldende side med `?embed` fjernet.
   */
  embed?: boolean;
}

const DEFAULT_INTRO =
  "Vi tar deg med på en guidet tur gjennom nærområdet — bli kjent med hva som " +
  "ligger i gangavstand.";

/**
 * Mobil velkomst-splash for rapport-board (<1024px). Portrait, full-bleed
 * hero (video/bilde) med velkomst-copy + CTA forankret mot
 * bunn (tommel-rekkevidde). Ligger som lag OPPÅ board-opplevelsen (kart +
 * reels) på z-50, og kan re-åpnes uten refresh — kartet bak forblir montert
 * og varmt. Speiler DesktopReportSplash, men én kolonne. Erstatter den gamle
 * IntroReel-som-splash på mobil.
 */
export function MobileReportSplash({
  visible,
  name,
  subline,
  logoSrc,
  heroImage,
  heroVideo,
  intro,
  headline,
  primaryLabel,
  onPlay,
  embed = false,
}: Props) {
  const heroPoster = heroVideo?.replace(/\.mp4$/i, ".jpg");

  // Embed: knappen lenker til full Placy-opplevelse i ny fane (gjeldende side
  // uten `?embed`). Iframen kjenner sin egen placy.no-URL → peker korrekt.
  const embedHref = useMemo(() => {
    if (!embed || typeof window === "undefined") return undefined;
    const url = new URL(window.location.href);
    url.searchParams.delete("embed");
    return url.toString();
  }, [embed]);

  // Stagger-inn ved første visning (rAF etter mount). Re-åpning re-staggrer
  // ikke (lag-opacity tar overgangen).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Swipe opp = "Start opplevelsen" (mobil-konvensjon: dra opp for å gå inn).
  // Akkumulerer touch-delta og fyrer onPlay én gang per visning.
  const touchStartY = useRef<number | null>(null);
  useEffect(() => {
    // Embed: ingen swipe-to-start. Knappen (ny fane) er eneste utløser.
    if (!visible || embed) return;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      onPlay();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY.current == null) return;
      const dy = touchStartY.current - (e.touches[0]?.clientY ?? touchStartY.current);
      if (dy > 40) fire(); // finger opp ≥ 40px
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [visible, embed, onPlay]);

  const stagger = (i: number) =>
    ({ transitionDelay: shown ? `${120 + i * 80}ms` : "0ms" }) as React.CSSProperties;

  const itemCls = cn(
    "transition-all duration-700 ease-out",
    shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-hidden bg-black transition-opacity duration-[600ms] ease-out",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!visible}
    >
      {/* Full-bleed hero — video (foretrukket) eller bilde. */}
      <div className="absolute inset-0">
        {heroVideo ? (
          <video
            src={heroVideo}
            poster={heroPoster}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          heroImage && (
            <Image
              src={heroImage}
              alt={`${name} – nabolag`}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )
        )}
        {/* Kontrast-gradient: mørk topp (logo) + mørk bunn (copy/CTA). */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/90 pointer-events-none" />
      </div>

      {/* Topp: logo (vises kun når prosjektet har brand-logo; skjult i embed). */}
      {logoSrc && !embed && (
        <div className="absolute inset-x-0 top-0 px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className={itemCls} style={stagger(0)}>
            <Image
              src={logoSrc}
              alt={name}
              width={150}
              height={58}
              unoptimized
              priority
              className="h-11 w-auto drop-shadow-lg [filter:brightness(0)_invert(1)]"
            />
          </div>
        </div>
      )}

      {/* Bunn-blokk: copy + CTA + swipe-hint. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div className={itemCls} style={stagger(1)}>
          <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-white drop-shadow-md">
            {headline || `Velkommen til ${name}`}
          </h1>
          {subline && (
            <p className="mt-1.5 text-sm font-medium text-white/75">{subline}</p>
          )}
        </div>

        <p
          className={cn(itemCls, "max-w-[34ch] text-[15px] leading-relaxed text-white/85")}
          style={stagger(2)}
        >
          {intro || DEFAULT_INTRO}
        </p>

        {embed ? (
          <a
            href={embedHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              itemCls,
              "mt-1 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-7 py-4 text-base font-semibold text-stone-900 shadow-2xl transition-transform duration-200 active:scale-[0.98]",
            )}
            style={stagger(4)}
          >
            {primaryLabel}
            <ArrowUpRight size={18} />
          </a>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className={cn(
              itemCls,
              "mt-1 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-7 py-4 text-base font-semibold text-stone-900 shadow-2xl transition-transform duration-200 active:scale-[0.98]",
            )}
            style={stagger(4)}
          >
            <Play size={18} className="fill-stone-900" />
            {primaryLabel}
          </button>
        )}

        {/* Swipe-hint — kun standalone. I embed er knappen eneste utløser. */}
        {!embed && (
          <div
            className={cn(
              "pointer-events-none flex flex-col items-center gap-0.5 text-white/60 transition-opacity duration-700",
              shown ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: shown ? "640ms" : "0ms" }}
          >
            <ChevronUp className="h-4 w-4 animate-bounce" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
              Swipe opp for å starte
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
