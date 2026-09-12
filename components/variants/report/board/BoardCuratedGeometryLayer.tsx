"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/mapbox";
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from "mapbox-gl";
import type { CuratedGeometryFeature } from "@/lib/types";
import { useBoard } from "./board-state";

/**
 * Kuratert geometri i «Kart» (Mapbox-motoren): forløpene og flatene som ikke er
 * punkter — en promenade, en kulturakse, et bygg med fotavtrykk.
 *
 * Hele grunnen til at laget finnes: et punkt kan bare si HVOR noe er. En
 * promenade er en strekning, og et vernet bygg er en flate — tegnet som pinne
 * blir begge til en prikk midt i noe som egentlig har utstrekning.
 *
 * DERFOR BÆRER FORMEN STATUS. Geometrien kommer fra en kilde som blander det
 * som står der i dag med det som er planlagt, og et områdekart har ikke lov til
 * å la de to se like ferdige ut. Hel strek = finnes. Stiplet = planlagt. En
 * `approximate` plassering tegnes svakere enn en `sourced`, slik at en omtrentlig
 * strekning ser omtrentlig ut på flaten og ikke bare i en kildenote.
 *
 * `line-dasharray` er IKKE data-drevet i Mapbox — verdien kan ikke leses fra
 * feature-egenskaper. Stiplet og hel MÅ derfor være to lag med hvert sitt
 * filter, ikke ett lag med et uttrykk. Samme begrensning som gjør konturene til
 * tre lag i `BoardContourLayer`.
 *
 * Opasiteten er den motsatte historien: den ER data-drevet, så hele
 * fremhevingen ligger i to uttrykk i stedet for i åtte lag (status × presisjon ×
 * aktivt/dempet ville blitt en kombinatorikk ingen kan lese). Grunnstyrken bakes
 * per feature når GeoJSON-en bygges, og temaets vekt ganges på i paint —
 * geometrien trenger da ikke bygges om når leseren bytter tema.
 */

/**
 * Grunnstyrke per rolle, FØR status, presisjon og tema ganges på.
 *
 * Fyllet er lyst med vilje — kartet under skal fortsatt kunne leses gjennom
 * flaten, samme regel som de planlagte byggene i `project-massing-layer`.
 */
const FILL_BASE = 0.3;
const LINE_BASE = 0.95;

/**
 * Vektene er DE SAMME som i `components/map/curated-geometry-layer-3d.tsx`.
 *
 * Kart og 3D er to motorer på samme geometri, og leseren bytter mellom dem med
 * én knapp. Hadde de hatt hvert sitt sett med tall, ville det samme forløpet
 * sett ulikt belagt ut avhengig av hvilken motor som sto fremme — og da er det
 * ikke lenger geometriens status som styrer inntrykket, men visningsvalget.
 *
 * `mixed` følger `existing`: forløpet finnes i dag, og det er det streken
 * påstår. Planen står i teksten.
 */
const FOCUS_WEIGHT = { active: 1, neutral: 0.45, other: 0.12 } as const;
const STATUS_WEIGHT: Record<CuratedGeometryFeature["status"], number> = {
  existing: 1,
  mixed: 1,
  planned: 0.55,
};
const APPROXIMATE_WEIGHT = 0.7;

/**
 * Temaets vekt er den ENE aksen geometrien demper på.
 *
 * Markørene demper med STØRRELSE og beholder full opasitet
 * (`STORY_EMPHASIS_PIN_SCALE`), fordi en mindre pinne leser som «lenger bak»
 * mens en blek pinne leser som «avskrudd». Den aksen finnes ikke for en linje:
 * en tynnere strekning er ikke lenger bak, den er en annen strekning.
 *
 * Områdestoppet (`activeThemeId === null`) er ikke «ingen tema», det er
 * oversikten — da står alt like svakt (`neutral`), slik at ingen av dem leses
 * som valgt.
 */

/**
 * Prikkmønster for det planlagte. Verdiene er multipler av linjebredden.
 *
 * 3D-laget tynner i tillegg den planlagte streken (`PLANNED_WIDTH_FACTOR`),
 * fordi opasitet alene forsvinner på en bred strek over lyse fotofliser. Her er
 * underlaget et vektorkart og streken er 1,5–5 px: en ytterligere tynning ville
 * gjort det planlagte usynlig på åpningszoomen. Stiplingen bærer signalet i
 * stedet — den er dessuten måten kart sier «ikke bygd ennå» på.
 */
const PLANNED_DASH = [2.5, 1.5];

/**
 * Linjebredde over zoom. Samme begrunnelse som byggene: på åpningszoomen er
 * hele Nyhavna noen få piksler bredt, og en 4 px strek der er en klatt, ikke en
 * strekning.
 */
const LINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  1.5,
  15,
  3,
  18,
  5,
];

/** Fallback når temaet ikke finnes i boardet — synlig grå slår usynlig feil. */
const FALLBACK_COLOR = "#57534e";

interface Props {
  /** Det boardet faktisk har å tegne. Tom liste = laget monteres ikke. */
  features: CuratedGeometryFeature[];
  /**
   * Temaet leseren står i — valgt kategori, ellers omvisningens stopp.
   * `null` = områdestoppet (oversikten).
   *
   * Kommer inn som prop og leses ikke fra `useBoard()` her, fordi avledningen
   * «valgt kategori ellers stoppet» allerede finnes i `BoardMap` (den styrer
   * hvilken kategori en markør presenteres som). To steder som regner ut samme
   * begrep hver for seg ville før eller siden svart forskjellig.
   */
  activeThemeId: string | null;
}

export function BoardCuratedGeometryLayer({ features, activeThemeId }: Props) {
  const { data } = useBoard();

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const colorOf = (themeId: string) =>
      data.categories.find((c) => String(c.id) === themeId)?.color;

    const built: GeoJSON.Feature[] = [];
    for (const f of features) {
      // Status × presisjon bakes inn i dataene; temaets vekt ganges på i paint.
      const baseWeight =
        STATUS_WEIGHT[f.status] *
        (f.precision === "approximate" ? APPROXIMATE_WEIGHT : 1);
      const properties = {
        id: f.id,
        name: f.name,
        kind: f.kind,
        themeId: f.themeId,
        status: f.status,
        // Fargen løses her og ikke i paint: et Mapbox-uttrykk kan ikke slå opp
        // i boardets kategorier, og en farge per feature er uansett det laget
        // trenger.
        color: f.color ?? colorOf(f.themeId) ?? FALLBACK_COLOR,
        fillOpacity: FILL_BASE * baseWeight,
        lineOpacity: LINE_BASE * baseWeight,
      };

      if (f.kind === "line") {
        // En «linje» med ett punkt er ingen strekning. Den ville tegnet
        // ingenting, men også skjult at kilden mangler noe.
        if (f.coordinates.length < 2) continue;
        built.push({
          type: "Feature",
          properties,
          geometry: { type: "LineString", coordinates: f.coordinates },
        });
        continue;
      }

      // En flate trenger tre hjørner pluss gjentakelsen av det første.
      if (f.coordinates.length < 3) continue;
      // Ringen SKAL komme lukket inn (se `CuratedGeometryFeature`), men en
      // uluket ring er en stille feil: GeoJSON-spec krever lukking, og en åpen
      // ring gir udefinert oppførsel i stedet for noe som feiler synlig. Vi
      // lukker den heller her enn å tegne noe ingen vet hva er.
      const ring: [number, number][] = [...f.coordinates];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

      built.push({
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }

    return { type: "FeatureCollection", features: built };
  }, [features, data.categories]);

  /**
   * Temaets vekt som uttrykk, ikke som data: bytter leseren tema, endres bare
   * paint-verdien — kilden beholder de samme radene og trenger ikke lastes opp
   * på nytt.
   */
  const themeWeight: DataDrivenPropertyValueSpecification<number> =
    activeThemeId === null
      ? FOCUS_WEIGHT.neutral
      : [
          "case",
          ["==", ["get", "themeId"], activeThemeId],
          FOCUS_WEIGHT.active,
          FOCUS_WEIGHT.other,
        ];

  const fillOpacity: DataDrivenPropertyValueSpecification<number> = [
    "*",
    ["get", "fillOpacity"],
    themeWeight,
  ] as DataDrivenPropertyValueSpecification<number>;
  const lineOpacity: DataDrivenPropertyValueSpecification<number> = [
    "*",
    ["get", "lineOpacity"],
    themeWeight,
  ] as DataDrivenPropertyValueSpecification<number>;

  if (geojson.features.length === 0) return null;

  return (
    <Source id="board-curated-geometry-source" type="geojson" data={geojson}>
      {/* Flatene nederst: linjene — både omrissene og strekningene — skal kunne
          krysse dem uten å bli spist. */}
      <Layer
        id="board-curated-geometry-fill"
        type="fill"
        source="board-curated-geometry-source"
        filter={["==", ["get", "kind"], "area"]}
        paint={{
          "fill-color": ["get", "color"],
          "fill-opacity": fillOpacity,
          // Temabytte er et LAGBYTTE i resten av boardet, ikke en morfing. En
          // kort overgang holder flaten fra å blinke i skiftet.
          "fill-opacity-transition": { duration: 200 },
        }}
      />
      {/* Hel strek: alt som FINNES. `mixed` hører hjemme her — forløpet er
          gåbart i dag, og det er planen teksten bærer, ikke linja.
          Linje-laget tegner både `LineString`-ene og polygonenes ringer, så
          flatenes omriss trenger ikke et eget lag. */}
      <Layer
        id="board-curated-geometry-line"
        type="line"
        source="board-curated-geometry-source"
        filter={["!=", ["get", "status"], "planned"]}
        layout={{ "line-join": "round", "line-cap": "round" }}
        paint={{
          "line-color": ["get", "color"],
          "line-width": LINE_WIDTH,
          "line-opacity": lineOpacity,
          "line-opacity-transition": { duration: 200 },
        }}
      />
      {/* Stiplet: det PLANLAGTE, og laget ligger sist slik at en planlagt
          strekning som krysser noe eksisterende fortsatt leses som stiplet.
          `line-cap: butt` fordi runde ender fyller mellomrommene og gjør
          stiplingen til en heltrukket strek ved lav zoom. */}
      <Layer
        id="board-curated-geometry-line-planned"
        type="line"
        source="board-curated-geometry-source"
        filter={["==", ["get", "status"], "planned"]}
        layout={{ "line-join": "round", "line-cap": "butt" }}
        paint={{
          "line-color": ["get", "color"],
          "line-width": LINE_WIDTH,
          "line-dasharray": PLANNED_DASH,
          "line-opacity": lineOpacity,
          "line-opacity-transition": { duration: 200 },
        }}
      />
    </Source>
  );
}
