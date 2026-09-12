"use client";

import { useEffect, useRef } from "react";
import type { CuratedGeometryFeature } from "@/lib/types";
import type { Map3DInstance } from "./map-view-3d";

/**
 * Kuratert geometri på Google-motoren — «Satelitt» og «3D».
 *
 * Laget tegner det kildeteksten beskriver som et FORLØP eller en UTSTREKNING:
 * en promenade, en kulturakse, et bygg. Punktene klarer ikke den jobben. En
 * promenade som én pin sier «her er promenaden», som er usant overalt bortsett
 * fra i det ene punktet.
 *
 * ## Hvorfor linjer er polyline og flater er polygon
 *
 * Motsatt av konturlaget, som tegner LUKKEDE ringer som polylinjer nettopp for
 * å slippe unna at `Polygon3DElement` mangler `outerColor`/`outerWidth`
 * (verifisert mot @types/google.maps: `Polygon3DElementOptions` har
 * fillColor/strokeColor/strokeWidth, men ingen ytre kantlinje). Her er
 * forskjellen at flatene faktisk skal FYLLES — et bygg er en utstrekning, ikke
 * en grense — og da er polygonen riktig primitiv selv uten kantlinje.
 * Linjene har ingen fyll å hente og bruker polylinjen, som bærer den lyse
 * kantlinja som gjør en strek lesbar både mot mørk vegetasjon og lyse hustak.
 *
 * ## Hvorfor status er OPASITET og ikke prikket strek
 *
 * Google 3D har ingen dash-støtte på disse elementene. Verken
 * `Polyline3DElementOptions` eller `Polygon3DElementOptions` har en dash-,
 * dashPattern- eller lineDash-egenskap (gjennomsøkt i
 * `node_modules/@types/google.maps/index.d.ts` — det eneste treffet på «dash» i
 * hele fila er HTML-entiteten `&mdash;` i en kommentar). Det som er planlagt
 * skilles derfor på det motoren faktisk kan: svakere farge og tynnere strek.
 *
 * Det er ikke bare et nødvalg. Et planlagt forløp SKAL se mindre fast ut enn et
 * som finnes, og en dempet strek sier akkurat det uten å rope. `mixed` tegnes
 * som eksisterende, fordi forløpet finnes i dag — planen om hva det skal BLI
 * bæres av temateksten, ikke av streken.
 *
 * `precision: "approximate"` demper ytterligere: en geometri vi har tolket oss
 * frem til skal aldri se like belagt ut som en vi har hentet.
 *
 * ## Hvorfor det aktive temaet får geometrien alene
 *
 * Leseren står i ett tema om gangen. En kulturakse som ligger like sterk i
 * kartet mens man leser om parkene, konkurrerer med det man faktisk ser på.
 * Geometri fra andre temaer dempes derfor nesten bort — den forsvinner fra
 * blikket, men blir stående i DOM-en (se levetid under). På områdestoppet er
 * intet tema aktivt, og da vises alt halvveis: det er oversikten over hva
 * boardet har.
 *
 * ## Levetid
 *
 * Samme kontrakt som `RouteLayer3D` og `ProjectMassingLayer3D`: ett langlevet
 * element per feature-id, egenskapene MUTERES ved endring. 3D-motoren har
 * langsom WebGL-cleanup, og mount/unmount per render lekker GPU-buffere på
 * iOS/Android. Geometri som faller bort tas ut av DOM-en; instansen blir
 * stående i kartet sitt for neste gang.
 */

interface Props {
  map3d: Map3DInstance | null;
  /** Geometrien som skal tegnes. Tom liste = ingenting vises — et vanlig board
   *  uten kuratert geometri skal se nøyaktig ut som før. */
  features: CuratedGeometryFeature[];
  /** Temaet leseren står i, eller null på områdestoppet. */
  activeThemeId: string | null;
}

/** Samme klaring over bakkemesh som rute- og konturlinjene: nok til å slippe
 *  z-fighting, lavt nok til at streken ikke klatrer på hustak. */
const LINE_ALTITUDE_M = 3;

/** Bredden på et kuratert forløp i piksler. Tynnere enn rutelinja (10), som er
 *  svaret på ett spørsmål leseren nettopp stilte, og tykkere enn konturene
 *  (2–3), som bare er en ramme. */
const LINE_STROKE_WIDTH = 8;
/** Andel av strekbredden, ikke piksler — samme enhet som rutelinja bruker. */
const LINE_OUTER_WIDTH = 0.35;
const AREA_STROKE_WIDTH = 2.5;

/** Hvit kantlinje, som på rute- og konturlinjene. Den er det eneste som gjør en
 *  farget strek lesbar mot både mørk vegetasjon og lyse tak. */
const OUTER_COLOR_RGB = "255, 255, 255";

/** Temafargen mangler bare hvis noe har gått galt oppstrøms. Stone-400 er
 *  boardets egen fallback-farge for tema uten profil (`adaptCategory`). */
const DEFAULT_COLOR = "#94a3b8";

/** Fyllet i en flate. Lavt: bygget skal leses som en utstrekning på kartet, ikke
 *  som et lokk over fotoflisene under. */
const AREA_FILL_ALPHA = 0.3;
const AREA_STROKE_ALPHA = 0.9;
const LINE_STROKE_ALPHA = 0.95;
/** Kantlinja skal bære streken, ikke gløde rundt den. */
const OUTER_ALPHA = 0.8;

/**
 * Hvor mye et tema-treff betyr. Ikke-aktivt tema forsvinner i praksis, men
 * elementet blir stående i DOM-en — å rive det ville kostet en GPU-buffer per
 * temabytte, og vi bytter tema hele veien nedover i kolonnen.
 */
const FOCUS_WEIGHT = { active: 1, neutral: 0.45, other: 0.12 } as const;

/** `mixed` følger `existing`: forløpet finnes i dag, og det er det streken
 *  påstår. Planen står i teksten. */
const STATUS_WEIGHT: Record<CuratedGeometryFeature["status"], number> = {
  existing: 1,
  mixed: 1,
  planned: 0.55,
};

/** En tolket geometri skal aldri se like belagt ut som en hentet. */
const APPROXIMATE_WEIGHT = 0.7;

/** Planlagt får tynnere strek i tillegg til svakere farge — opasitet alene
 *  forsvinner på en 8 px strek over lyse fotofliser. */
const PLANNED_WIDTH_FACTOR = 0.65;

/** Flatene under, linjene over. Settes eksplisitt fordi append-rekkefølgen bare
 *  gjelder FØRSTE gang: elementene gjenbrukes, så en linje som ble lagt til før
 *  en flate ville blitt liggende under den for alltid. */
const Z_INDEX = { area: 1, line: 2 } as const;

/** Google-motoren tar CSS-farger. Temafargen er hex, så alfa legges på her. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Hvor sterkt denne geometrien skal stå akkurat nå: status × presisjon × tema. */
function weightFor(
  feature: CuratedGeometryFeature,
  activeThemeId: string | null,
): number {
  const focus =
    activeThemeId === null
      ? FOCUS_WEIGHT.neutral
      : activeThemeId === feature.themeId
        ? FOCUS_WEIGHT.active
        : FOCUS_WEIGHT.other;
  const precision =
    feature.precision === "approximate" ? APPROXIMATE_WEIGHT : 1;
  return focus * STATUS_WEIGHT[feature.status] * precision;
}

type Polyline3D = google.maps.maps3d.Polyline3DElement;
type Polygon3D = google.maps.maps3d.Polygon3DElement;

export function CuratedGeometryLayer3D({
  map3d,
  features,
  activeThemeId,
}: Props) {
  // Ett element per feature-id, på tvers av renders. Kind-ene ligger hver for
  // seg fordi de er ulike klasser — en feature bytter ikke kind, men da slipper
  // vi å påstå det i typene.
  const lineByIdRef = useRef(new Map<string, Polyline3D>());
  const areaByIdRef = useRef(new Map<string, Polygon3D>());

  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;
    const lineById = lineByIdRef.current;
    const areaById = areaByIdRef.current;

    // Ingenting å tegne: ta elementene ut av DOM-en, behold instansene.
    if (features.length === 0) {
      for (const element of [...lineById.values(), ...areaById.values()]) {
        if (element.parentNode) element.remove();
      }
      return;
    }

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;
        if (cancelled) return;

        const liveIds = new Set(features.map((feature) => feature.id));
        for (const [id, element] of [...lineById, ...areaById]) {
          if (!liveIds.has(id) && element.parentNode) element.remove();
        }

        // Flater først, så linjene ligger øverst i append-rekkefølgen også
        // første gang — zIndex holder dem der etterpå.
        const ordered = [
          ...features.filter((feature) => feature.kind === "area"),
          ...features.filter((feature) => feature.kind === "line"),
        ];

        for (const feature of ordered) {
          if (cancelled) return;
          const weight = weightFor(feature, activeThemeId);
          const color = feature.color ?? DEFAULT_COLOR;
          const widthFactor =
            feature.status === "planned" ? PLANNED_WIDTH_FACTOR : 1;

          if (feature.kind === "area") {
            // Dobbeltsjekk etter async-pausen: StrictMode kjører effekten to
            // ganger, og uten sjekken får samme feature to elementer.
            let polygon = areaById.get(feature.id);
            if (!polygon) {
              polygon = new lib.Polygon3DElement();
              areaById.set(feature.id, polygon);
            }
            // CLAMP_TO_GROUND + extruded=false: flaten legger seg på terrenget
            // slik det faktisk ligger. Et bygg tegnet som volum ville konkurrert
            // med fotoflisenes eget bygg på samme sted.
            polygon.path = feature.coordinates.map(([lng, lat]) => ({
              lat,
              lng,
            }));
            polygon.altitudeMode = lib.AltitudeMode.CLAMP_TO_GROUND;
            polygon.extruded = false;
            // UTEN DENNE ER FLATEN USYNLIG DER DEN BETYR MEST.
            //
            // En flate klemt til terrenget ligger per definisjon UNDER bygget
            // som står på den, og fotoflisene har byggets faktiske mesh. Målt i
            // Chrome på Nyhavna-demoen: Fyringsbunkerens og Dora 2s fotavtrykk
            // lå korrekt i DOM-en med riktig fyll og strek, og var likevel
            // usynlige i Satelitt — bygningstaket dekket dem helt. Samme
            // geometri tegnet på Mapbox (som ikke har bygningsvolum) viste seg
            // med én gang, som bekreftet at det var okklusjon og ikke data.
            //
            // `drawsOccludedSegments` tegner den okkluderte delen
            // semi-transparent i stedet for å kaste den. Rutelinja bruker den av
            // samme grunn. Egenskapen finnes på BEGGE primitivene (verifisert i
            // `Polygon3DElementOptions`), og det er lett å tro noe annet fordi
            // polygonen mangler `outerColor`/`outerWidth`.
            polygon.drawsOccludedSegments = true;
            polygon.fillColor = withAlpha(color, AREA_FILL_ALPHA * weight);
            polygon.strokeColor = withAlpha(color, AREA_STROKE_ALPHA * weight);
            polygon.strokeWidth = AREA_STROKE_WIDTH * widthFactor;
            polygon.zIndex = Z_INDEX.area;
            if (polygon.parentNode && polygon.parentNode !== map3d) {
              polygon.remove();
            }
            if (!polygon.parentNode) map3d.append(polygon);
            continue;
          }

          let line = lineById.get(feature.id);
          if (!line) {
            line = new lib.Polyline3DElement();
            lineById.set(feature.id, line);
          }
          // `path`, ikke `coordinates`: sistnevnte er utfaset på
          // gmp-polyline-3d og advarer i konsollen. Settes FØR append — append
          // uten path kan gi «empty iterable»-feil i noen API-versjoner.
          line.path = feature.coordinates.map(([lng, lat]) => ({
            lat,
            lng,
            altitude: LINE_ALTITUDE_M,
          }));
          line.altitudeMode = lib.AltitudeMode.RELATIVE_TO_GROUND;
          line.strokeColor = withAlpha(color, LINE_STROKE_ALPHA * weight);
          line.outerColor = `rgba(${OUTER_COLOR_RGB}, ${OUTER_ALPHA * weight})`;
          line.strokeWidth = LINE_STROKE_WIDTH * widthFactor;
          line.outerWidth = LINE_OUTER_WIDTH;
          line.zIndex = Z_INDEX.line;
          // Tegnes semi-transparent der bygninger blokkerer, som rutelinja:
          // et forløp som forsvinner bak første lagerbygg leses som avbrutt.
          line.drawsOccludedSegments = true;
          if (line.parentNode && line.parentNode !== map3d) line.remove();
          if (!line.parentNode) map3d.append(line);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            "[CuratedGeometryLayer3D] geometrien kunne ikke tegnes:",
            err,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map3d, features, activeThemeId]);

  // Full unmount: ut av DOM-en og slipp referansene, slik at en ny mount bygger
  // friske instanser mot det nye kartet.
  useEffect(() => {
    const lineById = lineByIdRef.current;
    const areaById = areaByIdRef.current;
    return () => {
      for (const element of [...lineById.values(), ...areaById.values()]) {
        if (element.parentNode) element.remove();
      }
      lineById.clear();
      areaById.clear();
    };
  }, []);

  return null;
}
