"use client";

import Image from "next/image";

/**
 * AnnotatedMap — redaksjonelt, illustrert atlas. Én stor illustrasjon eller
 * stilisert kart med nummererte callouts. Tilhørende liste under mapper hver
 * nummer → POI med detaljer.
 *
 * Bruker hand-kuraterte CSS-posisjoner (i %) for hver callout — er en editorial
 * approach, ikke auto-generert fra koordinater. Det gir kontroll over
 * komposisjonen og matcher akvarell-illustrasjonenes komposisjon.
 */

export interface AnnotatedMapMarker {
  /** Sequential number shown in the marker bubble (1, 2, 3…) */
  number: number;
  /** CSS top position (e.g. "30%") */
  top: string;
  /** CSS left position (e.g. "45%") */
  left: string;
  /** Title of the place this callout points to */
  title: string;
  /** Optional subtitle (walk time, category, etc.) */
  subtitle?: string;
  /** Optional longer description for the list */
  description?: string;
}

export interface AnnotatedMapProps {
  sectionKicker?: string;
  sectionTitle?: string;
  /** Illustration / map image path */
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  markers: AnnotatedMapMarker[];
}

export default function AnnotatedMap({
  sectionKicker,
  sectionTitle,
  image,
  imageWidth = 1200,
  imageHeight = 800,
  markers,
}: AnnotatedMapProps) {
  return (
    <div className="my-12">
      {(sectionKicker || sectionTitle) && (
        <div className="mb-6 text-center">
          {sectionKicker && (
            <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
              {sectionKicker}
            </p>
          )}
          {sectionTitle && (
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1a1a]">
              {sectionTitle}
            </h3>
          )}
        </div>
      )}

      {/* Map image with absolute-positioned number markers */}
      <div className="relative rounded-2xl overflow-hidden bg-[#f5f1ec]">
        <Image
          src={image}
          alt=""
          aria-hidden="true"
          width={imageWidth}
          height={imageHeight}
          sizes="(min-width: 1024px) 800px, 100vw"
          className="w-full h-auto pointer-events-none select-none"
          draggable={false}
        />

        {markers.map((m) => (
          <div
            key={m.number}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: m.top, left: m.left }}
          >
            {/* Outer halo pulse */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[#3a3530]/20 animate-ping"
            />
            {/* Marker bubble */}
            <span
              className="relative flex items-center justify-center w-9 h-9 rounded-full bg-[#3a3530] text-white text-sm font-semibold shadow-lg border-2 border-white"
              aria-label={`${m.number}. ${m.title}`}
            >
              {m.number}
            </span>
          </div>
        ))}
      </div>

      {/* Marker list below — ordered list with matching numbers */}
      <ol className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {markers.map((m) => (
          <li key={m.number} className="flex items-start gap-4">
            <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-[#3a3530] text-white text-xs font-semibold mt-0.5">
              {m.number}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-[#1a1a1a] tracking-tight text-[15px] md:text-base">
                  {m.title}
                </span>
                {m.subtitle && (
                  <span className="text-xs text-[#8a8279]">· {m.subtitle}</span>
                )}
              </div>
              {m.description && (
                <p className="text-sm text-[#5a5147] leading-snug mt-0.5">
                  {m.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
