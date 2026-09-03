"use client";

import { useEffect, useRef } from "react";
import type { ContourRing } from "@/lib/board/contour-geometry";
import type { Map3DInstance } from "./map-view-3d";

/**
 * Rekkevidde-konturene på Google-motoren — «Satelitt» og «3D».
 *
 * ## Lukket polylinje, ikke polygon
 *
 * Konturene tegnes som LUKKEDE `Polyline3DElement`-ringer og ikke som
 * `Polygon3DElement`. To grunner, begge målt i nettleseren 2026-09-03:
 *
 * 1. `Polygon3DElement` har ingen `outerColor`/`outerWidth` (verifisert på API
 *    3.66.3d). Uten kantlinje er en tynn mørk strek nesten usynlig over mørk
 *    vegetasjon og forsvinner over lyse hustak — nøyaktig der et nabolagskart
 *    trenger den. Polylinjen bærer den lyse kantlinja som gjør streken lesbar
 *    mot begge, akkurat som rutelinja på samme motor.
 * 2. Prikket strek finnes ikke på denne motoren uansett, så en tynn heltrukket
 *    strek er den avtalte formen her (R6). Da er polygon-formen bare en flate
 *    vi ikke fyller.
 *
 * Hull tegnes som egne ringer: uten fyll er et hull en ekte grense — en lomme
 * inne i konturen du ikke kommer til innenfor tidsbudsjettet.
 *
 * ## Én langlevet instans per ring, aldri avmontert
 *
 * Samme kontrakt som `RouteLayer3D`: 3D-motoren har langsom WebGL-cleanup, så
 * instansene beholdes i en pool som VOKSER ved behov og aldri rives. Ved
 * modusbytte muteres koordinatene; ved av fjernes elementene fra DOM-en mens
 * referansene består.
 *
 * Antallet elementer følger antall RINGER, ikke antall konturer: Isochrone
 * returnerer MultiPolygon når et nåbart område henger på en bru eller gangvei
 * uten kobling i veinettet, og ett element per kontur ville da tegnet bare den
 * ene flaten — stille.
 */

interface Props {
  map3d: Map3DInstance | null;
  /** Ringene som skal tegnes. Tom liste = ingenting vises (av, eller ingen
   *  konturer for aktiv reisemåte). */
  rings: ContourRing[];
}

/** Samme klaring over bakkemesh som rutelinja — unngår z-fighting. */
const CONTOUR_ALTITUDE_M = 3;

/** Mørk strek med lys kantlinje. Streken er en ramme, ikke en kategori. */
const STROKE_COLOR = "rgba(41, 37, 36, 0.95)";
const OUTER_COLOR = "rgba(255, 255, 255, 0.9)";
const OUTER_WIDTH = 0.55;

/** Innerste kontur er tydeligst; de ytre tynnere (R5). */
const STROKE_WIDTH: Record<string, number> = { "5": 3, "10": 2.5, "15": 2 };

type Polyline3D = google.maps.maps3d.Polyline3DElement;

export function ContourLayer3D({ map3d, rings }: Props) {
  // Poolen av polylinje-instanser. Vokser, krymper aldri.
  const poolRef = useRef<Polyline3D[]>([]);

  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;

    // Hver ytre ring og hvert hull blir én linje å tegne.
    const paths = rings.flatMap((ring) =>
      [ring.outer, ...ring.holes].map((coords) => ({
        minutes: ring.minutes,
        coordinates: coords.map(([lng, lat]) => ({
          lat,
          lng,
          altitude: CONTOUR_ALTITUDE_M,
        })),
      })),
    );

    // Ingenting å tegne: ta elementene ut av DOM-en, behold instansene.
    if (paths.length === 0) {
      for (const line of poolRef.current) {
        if (line.parentNode) line.remove();
      }
      return;
    }

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;
        if (cancelled) return;

        for (let i = 0; i < paths.length; i++) {
          const path = paths[i];
          // Dobbeltsjekk lengden etter hver async-pause: StrictMode kjører
          // effekten to ganger, og uten sjekken bygges poolen dobbelt opp.
          if (!poolRef.current[i]) {
            poolRef.current[i] = new lib.Polyline3DElement({
              strokeColor: STROKE_COLOR,
              outerColor: OUTER_COLOR,
              outerWidth: OUTER_WIDTH,
              altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND,
              drawsOccludedSegments: true,
            });
          }
          const line = poolRef.current[i];
          if (cancelled) return;

          line.strokeWidth = STROKE_WIDTH[path.minutes] ?? 2;
          // `path`, ikke `coordinates`: sistnevnte er utfaset på
          // gmp-polyline-3d og advarer i konsollen. Samme egenskap rutelinja
          // bruker. Settes FØR append — append uten path kan gi «empty
          // iterable»-feil i noen API-versjoner.
          (line as unknown as { path: typeof path.coordinates }).path = path.coordinates;
          if (!line.parentNode) map3d.append(line);
        }

        // Overtallige linjer fra et tidligere, større sett: ut av DOM-en,
        // instansen består i poolen for neste gang.
        for (let i = paths.length; i < poolRef.current.length; i++) {
          const line = poolRef.current[i];
          if (line.parentNode) line.remove();
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[ContourLayer3D] konturene kunne ikke tegnes:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map3d, rings]);

  // Full unmount: ta alt ut av DOM-en og slipp poolen, slik at en ny mount
  // bygger friske instanser.
  useEffect(() => {
    return () => {
      for (const line of poolRef.current) {
        if (line.parentNode) line.remove();
      }
      poolRef.current = [];
    };
  }, []);

  return null;
}
