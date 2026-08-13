/**
 * Pin-spredning for samlokaliserte POI-er (Straumen-funn 2026-08-12).
 *
 * Steder i samme bygg deler ofte koordinat (AKSET: ungdomsskole + vgs +
 * bibliotek på identisk punkt; Uthuset pub + Landhandleri 0 m) — markørene
 * stables 100 % og bare én synes. Denne modulen beregner VISNINGS-koordinater:
 * medlemmer av en samlokalisert gruppe legges deterministisk på en liten
 * sirkel rundt gruppens tyngdepunkt.
 *
 * Kun visning: kilde-koordinatene (BoardPOI.raw / DB) røres aldri — reisetider,
 * ruter og dossier bruker de ekte punktene. Ved default-radius 12 m skiller et
 * par seg ~24 m ≈ 45 px på zoom 17 (label-nivå), og er i praksis sammenfallende
 * på oversiktszoom — kartet forblir sant der presisjonen ikke synes.
 */

export interface SpreadablePoint {
  id: string;
  coordinates: { lat: number; lng: number };
}

export interface SpreadOptions {
  /** Punkter nærmere enn dette regnes som samlokalisert (transitiv gruppering). */
  thresholdMeters?: number;
  /** Sirkelradius medlemmene legges på. */
  radiusMeters?: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng =
    (b.lng - a.lng) *
    METERS_PER_DEGREE_LAT *
    Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/**
 * Beregn visnings-koordinater for samlokaliserte punkter.
 *
 * Returnerer et map id → forskjøvet koordinat KUN for punkter som inngår i en
 * gruppe (2+ innen threshold) — alle andre er fraværende og skal vises der de
 * faktisk er. Deterministisk: gruppene sorteres på id før plassering, så samme
 * input gir samme resultat uavhengig av rekkefølge.
 */
export function computeSpreadCoordinates(
  points: readonly SpreadablePoint[],
  options: SpreadOptions = {},
): Map<string, { lat: number; lng: number }> {
  const threshold = options.thresholdMeters ?? 12;
  const radius = options.radiusMeters ?? 12;

  // Transitiv gruppering (greedy, O(n²) — board har <200 punkter)
  const assigned = new Set<string>();
  const groups: SpreadablePoint[][] = [];
  const sorted = [...points].sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(sorted[i].id)) continue;
    const group = [sorted[i]];
    assigned.add(sorted[i].id);
    // Transitiv: nye medlemmer kan dra inn flere (kjede av nære punkter)
    for (let g = 0; g < group.length; g++) {
      for (let j = 0; j < sorted.length; j++) {
        if (assigned.has(sorted[j].id)) continue;
        if (distanceMeters(group[g].coordinates, sorted[j].coordinates) <= threshold) {
          group.push(sorted[j]);
          assigned.add(sorted[j].id);
        }
      }
    }
    if (group.length >= 2) groups.push(group);
  }

  const result = new Map<string, { lat: number; lng: number }>();
  for (const group of groups) {
    const centroid = {
      lat: group.reduce((s, p) => s + p.coordinates.lat, 0) / group.length,
      lng: group.reduce((s, p) => s + p.coordinates.lng, 0) / group.length,
    };
    const latPerMeter = 1 / METERS_PER_DEGREE_LAT;
    const lngPerMeter =
      1 / (METERS_PER_DEGREE_LAT * Math.cos(centroid.lat * (Math.PI / 180)));

    group.forEach((p, i) => {
      // Start rett nord og gå med klokka — stabil, lesbar vifteform
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / group.length;
      result.set(p.id, {
        lat: centroid.lat - Math.sin(angle) * radius * latPerMeter,
        lng: centroid.lng + Math.cos(angle) * radius * lngPerMeter,
      });
    });
  }

  return result;
}
