"use client";

import { useEffect, useRef } from "react";
import { Sparkles, X, ExternalLink } from "lucide-react";
import { useBoard, useActivePOI } from "./board-state";
import { hasExploreContent } from "./POIExploreModal";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "./marker-style";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import { projectLatLngToScreen } from "@/components/map/project-latlng-to-screen";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { POIRealtimeSection } from "../blocks/POIRealtimeSection";
// merknad: hide-during-motion ble tidligere brukt for å skjule popup under
// kamera-bevegelse fordi den gamle approksimasjonen drifted. Med korrekt
// perspektiv-projeksjon tracker popupen markøren smooth — fjernet.

interface Props {
  map3d: Map3DInstance | null;
}

/**
 * 3D-variant av BoardPOIMiniPopup. Google Maps 3D eksponerer ingen
 * native `latLngToScreen`, så vi projiserer manuelt fra kameraets center,
 * heading, tilt og range hver frame (samme tilnærming som Map3DActionButtons).
 *
 * Drift-håndtering: ved POI-åpning fly-er vi kameraet inn til en tilt≈30°
 * (nær-top-down) hvor projeksjonen er nær eksakt. Brukeren kan fortsatt
 * tilte etterpå — popupen følger med, men drift øker proporsjonalt.
 *
 * No-photo-fallback (PRD 9 Unit 4 AC5; foto DEFERRED): identisk med 2D-popupen
 * rendrer denne ALDRI et POI-foto — identiteten er kategorifargen + ikonet
 * (`markerCircleStyle(color)` + `getFilledIcon`). 3D-markørene er allerede
 * kategorifarge-baserte (PRD 6), så pin-laget er upåvirket av manglende foto.
 */

// Projeksjon (lat/lng → skjerm) er delt med prosjekt-pin-overlayet — se
// `@/components/map/project-latlng-to-screen`. POI-markørene ligger på
// altitude 18 (matcher Marker3D i map-view-3d.tsx).

export function BoardPOI3DMiniPopup({ map3d }: Props) {
  const { dispatch } = useBoard();
  const poi = useActivePOI();
  const engagement = useEngagement();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const isTransportPOI = !!(
    poi?.raw.enturStopplaceId ||
    poi?.raw.bysykkelStationId ||
    poi?.raw.hyreStationId
  );
  const realtimeData = useRealtimeData(isTransportPOI && poi ? poi.raw : null);

  // Per-frame projeksjon. Skriver direkte til DOM (`transform: translate3d`)
  // istedenfor å gå via React setState — setState hver frame trigger React-
  // reconciliation som ikke alltid synkroniseres med browser paint, og under
  // tung zoom-animasjon (når Google også driver GPU-en hardt) får man dropped
  // frames som ser ut som "hopping". translate3d går rett til compositoren,
  // ingen layout/paint, ingen React-overhead.
  useEffect(() => {
    if (!map3d || !poi) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      return;
    }
    const update = () => {
      const el = wrapperRef.current;
      if (el) {
        const p = projectLatLngToScreen(
          map3d,
          poi.coordinates.lat,
          poi.coordinates.lng,
          18,
        );
        if (p) {
          // −28: matcher Mapbox 2D-popupens offset slik at bunn-kanten lander
          // like over markørens visuelle topp. translate(-50%, -100%) sentrerer
          // horisontalt og forankrer bunn-kant til pos.
          el.style.transform = `translate3d(${p.x}px, ${p.y - 28}px, 0) translate(-50%, -100%)`;
          el.style.opacity = "1";
        } else {
          // Bak kameraet eller utenfor projeksjonsdomene — skjul.
          el.style.opacity = "0";
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };
    update();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    };
  }, [poi?.id, map3d]);

  if (!poi) return null;

  const Icon = getFilledIcon(poi.raw.category.icon);
  const color = poi.raw.category.color;
  const circle = markerCircleStyle(color);
  // Samme kontrakt som 2D-popupen: innhold → modal i Placy, ellers ekstern
  // lenke merket med ekstern-lenke-ikon. Begge kart-flatene MÅ oppføre seg likt.
  const canExplore = hasExploreContent(poi);
  const ctaClass =
    "inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100";
  const exploreQuery = poi.address
    ? `${poi.name} ${poi.address}`
    : poi.name;
  const exploreUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(exploreQuery)}`;

  return (
    <div
      ref={wrapperRef}
      className="fixed left-0 top-0 z-30 pointer-events-none"
      style={{ willChange: "transform", opacity: 0 }}
    >
      <div
        className="pointer-events-auto w-[260px] rounded-2xl bg-white shadow-[0_12px_32px_rgba(15,29,68,0.22)] border border-stone-200/80"
      >
        <div className="flex items-start gap-2.5 px-3 pt-3">
          <div
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2"
            style={{
              borderColor: circle.borderColor,
              backgroundColor: circle.backgroundColor,
              color: circle.borderColor,
            }}
          >
            <Icon className="h-4 w-4" weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-900">
              {poi.name}
            </div>
            {poi.address && (
              <div className="truncate text-xs text-stone-500">
                {poi.address}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "BACK_TO_DEFAULT" })}
            aria-label="Lukk"
            className="-mr-1 -mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {poi.body && (
          <p className="mt-1.5 px-3 line-clamp-2 text-[13px] leading-snug text-stone-700">
            {poi.body}
          </p>
        )}

        {isTransportPOI && (
          <div className="mt-1.5 px-3">
            <POIRealtimeSection realtimeData={realtimeData} />
          </div>
        )}

        <div className="mt-2.5 px-3 pb-3">
          {canExplore ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_EXPLORE" })}
              className={ctaClass}
            >
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
              Utforsk
            </button>
          ) : (
            <a
              href={exploreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ctaClass}
              // target="_blank" unloader ikke denne siden, sa server-actionen
              // bak emit() fullfores normalt. Ingen beacon nodvendig.
              onClick={() =>
                engagement.emit("poi_outbound_clicked", {
                  poiId: poi.id,
                  payload: { category_id: poi.categoryId },
                })
              }
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              Utforsk
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
