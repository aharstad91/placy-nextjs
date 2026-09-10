/**
 * De leverte Lillebytunet-modellene, stedfestet.
 *
 * Registeret finnes for at flere bygg kan stå i samme kart. Hvert tall er målt,
 * ikke plassert for hånd: `georef_building.py` legger byggets egen punktklynge i
 * oversiktsrekonstruksjonen over i kartkoordinater med en likhetstransform mot
 * OpenStreetMap-fotavtrykkene til Ståltaugen 1 og 2, og leser lengdeaksens
 * bearing rett ut av klyngen. Metoden gjenskaper Hus Bs leverte plassering
 * innen 0,3 m og 0,6°, som er kontrollen på at Hus C er riktig plassert.
 *
 * Kilder: `docs/research/lillebytunet-3d/hus-c/georef-C.json` (Hus C) og
 * `docs/research/lillebytunet-3d/05-hus-c.md` (tabellen over alle fem bygg).
 *
 * `heading` legger modellens +Y-akse på oppgitt bearing. +Y er byggets langakse,
 * og for begge bygg peker den mot den enden de øverste etasjene står inntil —
 * tilbaketrekkene skjærer i motsatt ende. Et avvik på 180° i kartet er en
 * fortegnsfeil, ikke en målefeil.
 */

export interface LillebytunetBuilding {
  /** Nøkkel i `?buildings=`-parameteren. */
  id: string;
  label: string;
  /** GLB-sti, relativ til domenet. */
  modelSrc: string;
  lat: number;
  lng: number;
  /** Modellens +Y-akse i grader. 0 = rett nord. */
  heading: number;
  /**
   * Kameraets bearing fra bygget ved render-scene 0.
   *
   * Per bygningsserie, ikke per prosjekt: boligvelgeren gir hver serie sin egen
   * `direction 0`. Brukes bare av render-riggen.
   */
  rigBearingAtDirZero: number;
  /** Høyde i meter, målt på den leverte GLB-en. */
  heightMeters: number;
  /** Fotavtrykk i meter, målt i oversiktsrekonstruksjonen. Brukes til å ramme inn raden. */
  footprintMeters: readonly [number, number];
}

export const LILLEBYTUNET_BUILDINGS: readonly LillebytunetBuilding[] = [
  {
    id: "husB",
    label: "Hus B",
    modelSrc: "/models/lillebytunet/husB-v2.glb",
    lat: 63.441359,
    lng: 10.440215,
    heading: 110,
    rigBearingAtDirZero: 222,
    heightMeters: 19.31,
    footprintMeters: [16.4, 27.6],
  },
  {
    id: "husC",
    label: "Hus C",
    modelSrc: "/models/lillebytunet/husC-v1.glb",
    lat: 63.441259,
    lng: 10.440853,
    heading: 112.4,
    rigBearingAtDirZero: 218.4,
    heightMeters: 25.75,
    footprintMeters: [15.9, 22.4],
  },
];

export function findBuilding(id: string): LillebytunetBuilding | undefined {
  return LILLEBYTUNET_BUILDINGS.find((building) => building.id === id);
}

/**
 * Slår `?buildings=husB,husC` opp i registeret.
 *
 * Ukjente id-er hoppes over i stedet for å feile, slik at en skrivefeil i URL-en
 * gir de byggene som faktisk ble navngitt. Tom liste betyr «ingen valgt», og
 * kalleren faller tilbake til enkeltmodell-parameterne.
 */
export function parseBuildingIds(
  value: string | undefined,
): LillebytunetBuilding[] {
  if (!value) return [];
  const wanted = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const selected: LillebytunetBuilding[] = [];
  for (const id of wanted) {
    const building = findBuilding(id);
    if (building && !seen.has(building.id)) {
      seen.add(building.id);
      selected.push(building);
    }
  }
  return selected;
}
