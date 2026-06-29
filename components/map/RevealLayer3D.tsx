"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Marker3D, AltitudeMode } from "@vis.gl/react-google-maps";
import type { POI } from "@/lib/types";
import { BlobMarker3D } from "./BlobMarker3D";
import { Marker3DPin } from "./Marker3DPin";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { hexLightTint } from "@/lib/utils/marker-color";

/**
 * Sekvensiell inntegning av nærområdet på velkommen + oppsummering: POI-ene
 * tegnes inn rundt objektet, én etter én, hver med en liten sprett (bounce) —
 * BÅDE små farge-prikker ("blob") og fulle legend-pins ("pin", ikon + farge)
 * animeres inn på lik linje, i én distanse-sortert kaskade (nærmest først).
 *
 * WebGL-churn-disiplin: Google Maps 3D re-rasteriserer en markør hver gang
 * innholdet endrer seg. Vi animerer derfor SEKVENSIELT — bounded antall markører
 * re-rasteriseres per frame, ikke hele settet samtidig. Når en markør har settlet
 * på skala 1 fryses propen (kvantisert), `memo` stopper re-render og raster-en
 * opphører. rAF-loopen stoppes helt når siste markør er ferdig. `animate={false}`
 * (prefers-reduced-motion): alt vises umiddelbart på full skala, ingen rAF.
 */

/** Ett element i inntegningen. "blob" = liten farge-prikk; "pin" = full
 *  legend-pin (ikon + farge) som gir et lesbart holdepunkt for prikkene.
 *  `at` (valgfri, 0–1): posisjon langs en rett flylinje. Når ALLE items har `at`
 *  kjører laget i POSITIONAL-modus — hver markør dukker opp ved sin `at`-andel av
 *  `windowMs` i stedet for indeks-stagger → punktene tegnes inn i fly-over-orden,
 *  i takt med at kameraet passerer dem. */
export type RevealItem = { kind: "blob" | "pin"; poi: POI; at?: number };

/** Forsinkelse før første markør dukker opp (ms) — lar tile-settle + starten på
 *  push-in-en passere så markørene følger kamera-bevegelsen, ikke den døde pausen. */
const START_DELAY_MS = 900;
/** Tidsvindu (ms) fra første til siste markør STARTER å sprette inn. Stagger-
 *  intervallet utledes av dette delt på antallet, så hele kaskaden alltid rekker
 *  innenfor beaten uansett antall — flere markører = tettere kaskade, ikke lengre. */
const REVEAL_WINDOW_MS = 4200;
/** Klamring på stagger-intervallet så få markører ikke blir trege, og veldig mange
 *  ikke blir et samtidig «poff» (holder concurrent-bouncen lav). */
const MIN_STAGGER_MS = 45;
const MAX_STAGGER_MS = 220;
/** Varighet på én markørs sprett-inn (ms). */
const BOUNCE_MS = 280;
/** Høyder over bakken (m). Blob litt lavere (liten/dekorativ); legend-pin på samme
 *  nivå som de vanlige pinnene (Marker3DItem bruker 18) for visuell konsistens. */
const BLOB_ALTITUDE_M = 16;
const PIN_ALTITUDE_M = 18;
/** Full størrelse (px) på legend-pin ved skala 1 — matcher inaktiv Marker3DItem. */
const PIN_SIZE = 40;

/** easeOutBack: starter på 0, ender på 1 med en liten overshoot midtveis. */
function bounceScale(tMs: number): number {
  if (tMs >= BOUNCE_MS) return 1;
  const t = tMs / BOUNCE_MS;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

const RevealMarker = memo(function RevealMarker({
  item,
  scale,
}: {
  item: RevealItem;
  scale: number;
}) {
  const { poi } = item;
  if (item.kind === "pin") {
    return (
      <Marker3D
        position={{
          lat: poi.coordinates.lat,
          lng: poi.coordinates.lng,
          altitude: PIN_ALTITUDE_M,
        }}
        altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
      >
        <Marker3DPin
          color={poi.category.color}
          backgroundColor={hexLightTint(poi.category.color)}
          Icon={getFilledIcon(poi.category.icon)}
          size={PIN_SIZE}
          scale={scale}
        />
      </Marker3D>
    );
  }
  return (
    <Marker3D
      position={{
        lat: poi.coordinates.lat,
        lng: poi.coordinates.lng,
        altitude: BLOB_ALTITUDE_M,
      }}
      altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
    >
      <BlobMarker3D color={poi.category.color} scale={scale} />
    </Marker3D>
  );
});

export function RevealLayer3D({
  items,
  animate = true,
  windowMs = REVEAL_WINDOW_MS,
}: {
  items: RevealItem[];
  animate?: boolean;
  /** Tidsvindu kaskaden skal spenne over (ms). I positional-modus (alle items har
   *  `at`) settes denne ≈ flyturens varighet så punktene tegnes inn i takt med at
   *  kameraet flyr forbi dem. Default = REVEAL_WINDOW_MS (indeks-stagger-modus). */
  windowMs?: number;
}) {
  const [elapsed, setElapsed] = useState(animate ? 0 : Number.POSITIVE_INFINITY);
  const rafRef = useRef(0);
  const startRef = useRef<number | null>(null);

  // POSITIONAL-modus: alle markører har en `at`-andel langs flylinja → appearAt
  // utledes av `at` * windowMs (fly-over-orden). Ellers: adaptivt indeks-stagger
  // (hele kaskaden innenfor windowMs uansett antall, klamret).
  const positional = items.length > 0 && items.every((it) => typeof it.at === "number");
  const staggerMs =
    !positional && items.length > 1
      ? Math.min(
          MAX_STAGGER_MS,
          Math.max(MIN_STAGGER_MS, windowMs / (items.length - 1)),
        )
      : 0;

  const appearAts = items.map((it, i) =>
    positional
      ? START_DELAY_MS + Math.min(1, Math.max(0, it.at as number)) * windowMs
      : START_DELAY_MS + i * staggerMs,
  );

  const total =
    items.length > 0 ? Math.max(...appearAts) + BOUNCE_MS : 0;

  useEffect(() => {
    if (!animate || items.length === 0) return;
    startRef.current = null;
    const frame = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const e = ts - startRef.current;
      setElapsed(e);
      if (e < total) {
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // total er avledet av items.length; den dekker re-start ved nytt sett.
  }, [animate, items.length, total]);

  return (
    <>
      {items.map((item, i) => {
        const appearAt = appearAts[i];
        if (elapsed < appearAt) return null; // ikke mountet ennå (sekvensiell)
        const raw = bounceScale(elapsed - appearAt);
        // Kvantiser så settlede markører (skala 1) får identisk prop hver frame →
        // memo hopper over re-render → ingen re-rasterisering.
        const scale = Math.round(raw * 100) / 100;
        return <RevealMarker key={item.poi.id} item={item} scale={scale} />;
      })}
    </>
  );
}
