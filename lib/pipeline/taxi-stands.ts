/**
 * Taxiholdeplasser i Trondheim — offentlig kilde, statisk datasett.
 *
 * `taxi` har stått i tema-defaultene (`lib/pipeline/report-defaults.ts`) og i
 * transport-dashbordet siden de ble skrevet, uten at NOEN kilde produserte
 * kategorien: Google har ingen brukbar taxi-type i Norge, Entur dekker
 * kollektiv og OSM-porten slipper ikke inn holdeplasser. Kategorien var altså
 * tom på samme måte som `marina` og `hundepark` var det før 2026-08-12.
 *
 * Kilden er Trondheim parkering sitt eget kart (KMZ-en bak
 * https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/), hentet
 * med `scripts/fetch-taxi-holdeplasser.sh` og bakt inn i repoet. Ingen
 * nettverkskall ved provisjonering: 35 punkter som flytter seg et par ganger i
 * året skal ikke kunne velte en kjøring fordi kommunens CDN er nede.
 *
 * Trondheim-only med vilje. Datasettet er kommunens eget, og det finnes ikke
 * et tilsvarende nasjonalt register — utenfor Trondheim gir kilden 0 treff,
 * som er riktig oppførsel («ingen data her» må ha definert oppførsel), ikke en
 * feil.
 */

import raw from "@/data/geo/trondheim/taxiholdeplasser.json";
import { slugify } from "@/lib/utils/slugify";

export interface TaxiStand {
  navn: string;
  lat: number;
  lng: number;
  /** Antall oppmerkede plasser, der kommunen oppgir det. */
  plasser?: number;
}

interface TaxiStandDataset {
  kilde: string;
  kildeUrl: string;
  sideUrl: string;
  hentet: string;
  holdeplasser: TaxiStand[];
}

const dataset = raw as TaxiStandDataset;

/** Kategori-definisjonen taxi-POI-ene skrives med. */
export const TAXI_CATEGORY = {
  id: "taxi",
  name: "Taxiholdeplass",
  icon: "CarTaxiFront",
  color: "#eab308",
} as const;

/** Alle holdeplassene i datasettet, i filens (navnesorterte) rekkefølge. */
export const TAXI_STANDS: readonly TaxiStand[] = Object.freeze(
  dataset.holdeplasser.map((h) => Object.freeze({ ...h }))
);

/** Når datasettet sist ble hentet fra kommunen (ISO-dato). */
export const TAXI_STANDS_FETCHED_AT = dataset.hentet;

/**
 * Stabil POI-id. Navnet er nøkkelen fordi KMZ-en ikke har noen id-felt —
 * flytter kommunen en holdeplass noen meter, oppdateres samme rad; døper de
 * den om, kommer den inn som en ny (og den gamle blir stående i poolen uten
 * lenke, som er det samme vi gjør for skoler).
 */
export function taxiStandId(stand: TaxiStand): string {
  return `taxi-tk-${slugify(stand.navn)}`;
}

/**
 * Holdeplassene innenfor `radiusMeters` av et punkt, nærmest først.
 *
 * `distance` er en ren funksjon inn (haversine fra kalleren) slik at denne
 * modulen ikke trenger geo-avhengigheter i testene.
 */
export function taxiStandsWithin(
  lat: number,
  lng: number,
  radiusMeters: number,
  distance: (aLat: number, aLng: number, bLat: number, bLng: number) => number
): Array<TaxiStand & { distanceMeters: number }> {
  return TAXI_STANDS.map((stand) => ({
    ...stand,
    distanceMeters: distance(lat, lng, stand.lat, stand.lng),
  }))
    .filter((s) => s.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
