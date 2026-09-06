"use client";

import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "./marker-style";
import { PoiDetailBody } from "./PoiDetail";
import type { BoardPOI } from "./board-data";

/**
 * Utforsk-modalen: Google-grounded stedsinnhold vist INNE i Placy, i stedet for
 * at «Utforsk» sender brukeren til Google AI Mode i ny fane.
 *
 * Ansvarsforholdet er bevisst det samme som når vi lenket ut: innholdet er
 * hentet fra Google, ikke skrevet av Placy, og attribusjonen sier det.
 * `searchEntryPointHtml` rendres VERBATIM (DOMPurify-sanert build-time) fordi
 * Google ToS krever det — se lib/gemini/sanitize.ts.
 *
 * Ren DOM-overlay i portal (via components/ui/Modal), ALDRI en ny WebGL-flate:
 * iOS WebKit tåler én kontekst, og gmp-map-3d rendrer ikke React-popovers
 * pålitelig (docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md).
 *
 * Google-fakta leses fra DB-kolonner, aldri fra API ved visning — modal-åpning
 * koster 0 Google-kall.
 *
 * ## Hva modalen er igjen etter 2026-08-28
 *
 * MOBILENS stedsflate, og bare den — pluss desktop på boards uten omvisning
 * (VO-boards, der sidekolonnen spiller reels og ikke har en stedsliste). Selve
 * innholdet bor i {@link PoiDetailBody} og deles med sidekolonnen; her ligger
 * bare rammen: tittelrad med ikon og adresse, og Google-lenken i foten.
 */

export interface POIExploreModalProps {
  poi: BoardPOI | null;
  open: boolean;
  onClose: () => void;
  /** Ekstern Google-lenke, brukt når POI-en ikke har grounded narrativ. */
  fallbackUrl?: string;
  /** Kalles ÉN gang per åpning — Moat 2-signalet (Unit 7). */
  onOpened?: (poi: BoardPOI) => void;
}

export function POIExploreModal({
  poi,
  open,
  onClose,
  fallbackUrl,
  onOpened,
}: POIExploreModalProps) {
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  // Emit ÉN gang per åpning, i en effekt — aldri under render. Nøkkelen er
  // `open + poi.id`, så å bytte POI mens modalen står åpen teller som en ny
  // åpning, mens en re-render av samme POI ikke gjør det.
  const emitKey = open && poi ? poi.id : null;
  const lastEmitted = useRef<string | null>(null);
  useEffect(() => {
    if (emitKey === null) {
      lastEmitted.current = null;
      return;
    }
    if (lastEmitted.current === emitKey) return;
    lastEmitted.current = emitKey;
    if (poi) onOpenedRef.current?.(poi);
    // poi er stabil for en gitt emitKey; onOpened holdes i ref for å unngå at
    // en ny funksjonsidentitet per render trigger ny emit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitKey]);

  if (!poi) return null;

  const Icon = getFilledIcon(poi.raw.category.icon);
  const circle = markerCircleStyle(poi.raw.category.color);

  return (
    <Modal
      open={open}
      onClose={onClose}
      // Modal-ens default er md:max-h-[50vh], som er for trangt for bilder +
      // narrativ + fakta + attribusjon. ToS krever at kildene er tilgjengelige
      // innen én interaksjon, så de skal ikke havne utenfor rekkevidde.
      className="md:max-w-[560px] md:max-h-[85vh]"
      title={
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2"
            style={{
              borderColor: circle.borderColor,
              backgroundColor: circle.backgroundColor,
              color: circle.borderColor,
            }}
          >
            <Icon className="h-4 w-4" weight="fill" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-stone-900">{poi.name}</h2>
            <p className="truncate text-xs text-stone-500">
              {poi.address ?? poi.raw.category.name}
            </p>
          </div>
        </div>
      }
      footer={
        fallbackUrl ? (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-stone-100 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-200"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            Se mer på Google
          </a>
        ) : undefined
      }
    >
      <div className="px-5 py-4">
        <PoiDetailBody
          poi={poi}
          emptyText="Vi har ikke noe redaksjonelt innhold om dette stedet ennå."
        />
      </div>
    </Modal>
  );
}

export default POIExploreModal;
