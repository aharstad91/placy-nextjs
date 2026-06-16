"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Styrer om laget er synlig. Komponenten holdes alltid montert (én
   *  kart-instans bak), og veksler kun opacity/pointer-events — så re-åpning
   *  er momentan og bakgrunns-videoen aldri re-initialiseres. */
  visible: boolean;
  /** Prosjektnavn, eks. "Stasjonskvartalet". */
  name: string;
  /** Bydel + by, eks. "Midtbyen, Trondheim". */
  subline?: string;
  /** Logo-SVG (prosjekt-brand). Mangler → tekst-wordmark vises i stedet. */
  logoSrc?: string;
  /** Crisp hero-render i høyre panel (fallback når heroVideo mangler). */
  heroImage?: string;
  /** Hero-video (16:9) i høyre panel — overstyrer heroImage når satt. Poster
   *  avledes ved å bytte `.mp4` → `.jpg`. */
  heroVideo?: string;
  /** Valgfri intro-tekst — faller tilbake til standard velkomst-copy. */
  intro?: string;
  /** Overstyrer overskriften "Velkommen til {name}" (brukes i embed-modus). */
  headline?: string;
  /** Knappe-tekst: "Start opplevelsen" / "Fortsett" / "Spill av på nytt". */
  primaryLabel: string;
  /** Trykk play → dropp splash, fly inn kartet, start/forsett guidet tur. */
  onPlay: () => void;
  /**
   * Embed-modus: splashen vises inni en iframe på en ekstern nettside (megler-
   * side). Da: ingen scroll-/swipe-to-start (knappen er eneste utløser), ingen
   * logo, og knappen er en lenke som åpner full Placy-opplevelse i ny fane
   * (target=_blank) i stedet for å starte turen inline. URL avledes fra
   * gjeldende side med `?embed` fjernet.
   */
  embed?: boolean;
  /**
   * "Klar"-gate (fra embed): kartet varmes opp bak splashen. Når true vises
   * knappen i en deaktivert loader-tilstand ("Gjør klar…") til oppvarmingen er
   * ferdig — da settes `loading` til false og knappen aktiveres. Hindrer at en
   * tidlig klikk gir kald fly-inn.
   */
  loading?: boolean;
  /** Pulser play-knappen (brukes når "Klar"-gaten er ferdig oppvarmet → invitér). */
  pulse?: boolean;
  /** Liten tekst under knappen, eks. "🔊 Med lyd · guidet tur". */
  ctaSubtext?: string;
}

const DEFAULT_INTRO =
  "Vi tar deg med på en guidet tur gjennom nærområdet — transport, hverdagsliv, " +
  "mat og uteliv, natur og opplevelser rett utenfor døra. Trykk play, så viser " +
  "vi deg hva som ligger i gangavstand.";

/**
 * Velkomst-splash for rapport-board (desktop, >=1024px). Ligger som et lag
 * OPPÅ board-opplevelsen (kart + sidebar) og kan re-åpnes uten refresh.
 * Komposisjon: venstre kolonne med logo, velkomst-copy og play-knapp;
 * høyre kolonne med crisp prosjekt-render. Bak alt ligger en
 * rolig, sterkt sløret bakgrunns-video som gir et hint av bevegelse ("hva er
 * området som rører seg bak her"). Mobil bruker IntroReel-videoen i stedet.
 */
export function DesktopReportSplash({
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
  loading = false,
  pulse = false,
  ctaSubtext,
}: Props) {
  const heroPoster = heroVideo?.replace(/\.mp4$/i, ".jpg");

  // Embed-modus: knappen lenker til full Placy-opplevelse i ny fane. URL =
  // gjeldende side uten `?embed`, men MED `?from=embed` — sistnevnte signaliserer
  // til standalone-siden at brukeren kom fra embedet, så den viser en "Klar"-gate
  // (oppvarming + ett lyd-trykk) i stedet for å gjenta velkomst-splashen. Iframe-en
  // kjenner sin egen placy.no-URL, så dette peker korrekt til standalone-ruten.
  const embedHref = useMemo(() => {
    if (!embed || typeof window === "undefined") return undefined;
    const url = new URL(window.location.href);
    url.searchParams.delete("embed");
    url.searchParams.set("from", "embed");
    return url.toString();
  }, [embed]);
  // Stagger-inn av innholdet ved første visning. Settes én gang via rAF etter
  // mount; re-åpning re-staggrer ikke (lag-opacity tar overgangen).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Scroll/swipe nedover = samme som "Start opplevelsen". Uten dette føles
  // splashen klaustrofobisk (man prøver å scrolle og ingenting skjer).
  // Akkumulerer wheel/touch-delta og trigger onPlay én gang per visning.
  useEffect(() => {
    // Embed-modus: ingen scroll-to-start (knappen åpner ny fane). "Klar"-gate
    // under oppvarming (loading): heller ikke scroll-start, ellers ville en
    // tidlig scroll gi kald fly-inn før kartet er varmt.
    if (!visible || embed || loading) return;
    let acc = 0;
    let fired = false;
    let touchStartY: number | null = null;

    const fire = () => {
      if (fired) return;
      fired = true;
      onPlay();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0) return; // kun nedover
      acc += e.deltaY;
      if (acc > 24) fire();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const dy = touchStartY - (e.touches[0]?.clientY ?? touchStartY);
      if (dy > 32) fire(); // finger opp = scroll ned
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [visible, embed, loading, onPlay]);

  const stagger = (i: number) =>
    ({
      transitionDelay: shown ? `${120 + i * 90}ms` : "0ms",
    }) as React.CSSProperties;

  const itemCls = cn(
    "transition-all duration-700 ease-out",
    shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-hidden bg-[#f2e9dc] transition-opacity duration-[600ms] ease-out",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] items-center gap-10 px-10 lg:gap-16 lg:px-20">
        {/* Venstre kolonne */}
        <div className="flex w-full max-w-[480px] flex-col">
          {logoSrc && !embed && (
            <div className={itemCls} style={stagger(0)}>
              <Image
                src={logoSrc}
                alt={name}
                width={168}
                height={65}
                unoptimized
                priority
                className="h-14 w-auto"
              />
            </div>
          )}

          <div className={cn(itemCls, logoSrc && !embed ? "mt-9" : "mt-0")} style={stagger(1)}>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-stone-900 lg:text-5xl">
              {headline || `Velkommen til ${name}`}
            </h1>
            {subline && (
              <p className="mt-2 text-base font-medium text-stone-500">{subline}</p>
            )}
          </div>

          <p
            className={cn(itemCls, "mt-5 max-w-[440px] text-[15px] leading-relaxed text-stone-600")}
            style={stagger(2)}
          >
            {intro || DEFAULT_INTRO}
          </p>

          <div className={cn(itemCls, "mt-7 flex flex-col items-start gap-2.5")} style={stagger(3)}>
            {embed ? (
              <a
                href={embedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full bg-stone-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-stone-700 hover:scale-[1.02] active:scale-[0.99]"
              >
                {primaryLabel}
                <ArrowUpRight size={18} />
              </a>
            ) : loading ? (
              // "Klar"-gate under oppvarming: deaktivert loader-knapp.
              <button
                type="button"
                disabled
                className="inline-flex cursor-default items-center gap-2.5 rounded-full bg-stone-900/60 px-7 py-3.5 text-base font-semibold text-white/90 shadow-lg"
              >
                <Loader2 size={18} className="animate-spin" />
                Gjør klar nabolaget…
              </button>
            ) : (
              <div className="relative">
                {pulse && (
                  <span
                    className="pointer-events-none absolute -inset-1 rounded-full bg-stone-900/20 animate-ping"
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={onPlay}
                  className="relative inline-flex items-center gap-2.5 rounded-full bg-stone-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-stone-700 hover:scale-[1.02] active:scale-[0.99]"
                >
                  <Play size={18} className="fill-white" />
                  {primaryLabel}
                </button>
              </div>
            )}
            {ctaSubtext && !loading && (
              <span className="text-[13px] font-medium text-stone-500">{ctaSubtext}</span>
            )}
          </div>

        </div>

        {/* Scroll-cue — kun standalone direkte. Skjules i embed og i "Klar"-gaten
            (fromEmbed), der det bevisste knappetrykket er poenget. */}
        {!embed && !loading && !pulse && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-7 flex flex-col items-center gap-1 text-stone-500 transition-opacity duration-700",
              shown ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: shown ? "600ms" : "0ms" }}
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.16em]">
              Bla for å starte
            </span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </div>
        )}

        {/* Høyre kolonne — prosjekt-video (16:9), fallback til render */}
        {(heroVideo || heroImage) && (
          <div
            className={cn(itemCls, "relative hidden flex-1 lg:block")}
            style={stagger(2)}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5">
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
                <Image
                  src={heroImage as string}
                  alt={`${name} – illustrasjon`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 0px"
                  className="object-cover"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
