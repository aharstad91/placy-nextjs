"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Styrer synlighet/fade. Settes false av onEnter → laget fader ut og avdekker
   *  det allerede varme kartet bak. Holdes montert (som splashen). */
  visible: boolean;
  /** Prosjektnavn (alt-tekst). */
  projectName: string;
  /** Overskrift, sentrert. */
  headline: string;
  /** Bydel + by, eks. "Midtbyen, Trondheim". */
  subline?: string;
  /** Kort intro-linje under overskriften. */
  intro?: string;
  /** Logo-SVG — vises lite, sentrert øverst. */
  logoSrc?: string;
  /** Hero-bilde (crisp render) — sentrert kort. */
  heroImage?: string;
  /** Hero-video (16:9) — overstyrer heroImage. Poster avledes `.mp4`→`.jpg`. */
  heroVideo?: string;
  /** Prosjektet har voice-over → ta med "Henter stemmen…"-steget. */
  hasAudio: boolean;
  /** Hopp over oppvarmingen (start på 100%) — re-åpning etter at turen alt er
   *  startet, så man slipper å vente på loaderen på nytt. */
  warm?: boolean;
  /** Trykk "Se nærområdet" → låser opp lyd (gest) + avdekker kart + starter tur. */
  onEnter: () => void;
}

/** Tid (ms) fra 0 → 100%. Dekker 3D-tile-oppvarmingen bak loaderen og gir et par
 *  sekunder "game-loading"-tålmodighet. Justeres her. */
const DURATION_MS = 2400;

/**
 * Ankomst-loader for brukere som kommer fra embedet (`?from=embed`). Sentrert
 * "laster inn"-skjerm: logo + hero-bilde + overskrift/tekst, og nederst en
 * fremdriftslinje (0–100%) med rullerende status-tekst i spill-lastestil
 * ("Henter Google Maps 3D…", "Plasserer punkter…", "Henter stemmen…"). Kartet
 * varmes opp BAK dette opake laget. Når baren når 100% byttes den ut med
 * "Se nærområdet"-knappen — det bevisste trykket er gesten som låser opp lyden
 * (nettleser-policy) og avdekker det varme kartet med en momentan, glatt fly-inn.
 */
export function EmbedArrivalLoader({
  visible,
  projectName,
  headline,
  subline,
  intro,
  logoSrc,
  heroImage,
  heroVideo,
  hasAudio,
  warm = false,
  onEnter,
}: Props) {
  const heroPoster = heroVideo?.replace(/\.mp4$/i, ".jpg");
  const [progress, setProgress] = useState(warm ? 100 : 0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Steg-tekster, valgt etter fremdrift. "Henter stemmen…" kun for VO-prosjekter.
  const steps: { until: number; label: string }[] = [
    { until: 32, label: "Henter Google Maps 3D…" },
    { until: 62, label: "Plasserer punkter i nabolaget…" },
    ...(hasAudio ? [{ until: 90, label: "Henter stemmen…" }] : []),
    { until: 100, label: "Gjør klar opplevelsen…" },
  ];

  useEffect(() => {
    if (!visible || warm) return;
    // rAF-drevet 0→100 med ease-out. `t` er DOMHighResTimeStamp (ikke Date.now).
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const raw = Math.min(1, (t - startRef.current) / DURATION_MS);
      const eased = 1 - Math.pow(1 - raw, 2);
      setProgress(Math.round(eased * 100));
      if (raw < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, warm]);

  const ready = progress >= 100;
  const statusLabel =
    steps.find((s) => progress < s.until)?.label ?? steps[steps.length - 1].label;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[#f2e9dc] px-6 transition-opacity duration-[600ms] ease-out",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {logoSrc && (
          <Image
            src={logoSrc}
            alt={projectName}
            width={180}
            height={70}
            unoptimized
            priority
            className="mb-7 h-11 w-auto"
          />
        )}

        {(heroVideo || heroImage) && (
          <div className="relative mb-7 aspect-video w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
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
                alt={`${projectName} – illustrasjon`}
                fill
                priority
                sizes="(min-width: 768px) 28rem, 90vw"
                className="object-cover"
              />
            )}
          </div>
        )}

        <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-stone-900">
          {headline}
        </h1>
        {subline && (
          <p className="mt-1.5 text-sm font-medium text-stone-500">{subline}</p>
        )}
        {intro && (
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-stone-600">
            {intro}
          </p>
        )}

        {/* Nederst: fremdriftslinje (laster) som byttes ut med knappen ved 100%. */}
        <div className="mt-8 flex h-[52px] w-full max-w-xs items-center justify-center">
          {ready ? (
            <button
              type="button"
              onClick={onEnter}
              className="inline-flex items-center gap-2.5 rounded-full bg-stone-900 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-300 ease-out hover:bg-stone-700 hover:scale-[1.02] active:scale-[0.99]"
            >
              <Play size={18} className="fill-white" />
              Se nærområdet
            </button>
          ) : (
            <div className="w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-900/10">
                <div
                  className="h-full rounded-full bg-stone-900 transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px] font-medium text-stone-500">
                <span>{statusLabel}</span>
                <span className="tabular-nums text-stone-400">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
