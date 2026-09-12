/**
 * Geometrien demoen tegner: ett forløp, én akse, to bygg.
 *
 * REGELEN SOM STYRER DENNE FILA: ingenting tegnes uten belegg. Hver geometri
 * bærer `precision` og `sourceNote`, og de to feltene er ikke dokumentasjon —
 * de rendres. En omtrentlig plassering skal SES som omtrentlig på flaten, ikke
 * bare stå notert her.
 *
 * Derfor mangler det ting med vilje. Nyhavna.no navngir Kullkranparken,
 * Jernbaneparken, Transittparken, Elveparken og allmenningene ved
 * Ladehammerkaia, men ingen av dem har en avgrensning vi kan belegge mens
 * planene er under arbeid. De står som navn i temateksten, ikke som flater i
 * kartet. Å tegne en vedtatt trasé vi ikke har, ville vært den ene feilen et
 * områdekart ikke har lov til å gjøre.
 *
 * Koordinatene er `[lng, lat]` (GeoJSON-rekkefølge), samme konvensjon som
 * `lib/board/contour-geometry.ts` — begge kartmotorene leser herfra.
 *
 * Kilde for alt som er merket `sourced`: OpenStreetMap, hentet via Overpass
 * 2026-09-11. OSM-objektene er navngitt i `sourceNote` slik at de kan slås opp.
 */

import type { CuratedGeometryFeature } from "@/lib/types";
import { THEME_KULTUR_ID, THEME_PARK_ID } from "./ids";

/**
 * Elvepromenaden slik den er å GÅ i dag.
 *
 * Bygget ved å knytte sammen gang- og sykkelveiene langs Nidelvas østside
 * gjennom Nyhavna til én sammenhengende kjede (korteste vei i OSM-nettverket
 * fra elvekanten ved Nidelvbrua og nordover). 404 m, ti punkter etter at
 * punkter tettere enn 6 m er luket.
 *
 * Statusen er `mixed`, og det er kildens egen påstand, ikke en unnvikelse:
 * «Her kan du allerede i dag gå, sykle eller bare nyte utsikten» (finnes) og
 * «Elvepromenaden skal bli en grønn oase … en levende park med benker,
 * lekeapparater, kunst» (kommer). Linja viser det som finnes; teksten bærer
 * planen.
 *
 * Den PLANLAGTE forlengelsen — koblingene til Doraparken og parken ytterst på
 * Transittkaia som kilden beskriver — er IKKE tegnet. Vi har ingen trasé for
 * dem.
 */
export const ELVEPROMENADEN: CuratedGeometryFeature = {
  id: "leve-geo-elvepromenaden",
  name: "Elvepromenaden",
  kind: "line",
  themeId: THEME_PARK_ID,
  poiId: "leve-elvepromenaden",
  status: "mixed",
  precision: "sourced",
  coordinates: [
    [10.410466, 63.437399],
    [10.410597, 63.437564],
    [10.410832, 63.437791],
    [10.410898, 63.437852],
    [10.411102, 63.438041],
    [10.411283, 63.438238],
    [10.411348, 63.438308],
    [10.412325, 63.43932],
    [10.413472, 63.440562],
    [10.41351, 63.440731],
  ],
  sourceNote:
    "Forløpet følger dagens gang- og sykkelvei langs Nidelva (OpenStreetMap). Den planlagte forlengelsen mot Doraparken og Transittkaia er ikke tegnet — traséen er ikke offentlig.",
};

/**
 * Kulturaksen i Skippergata — strekningen, ikke en avgrensning.
 *
 * Kilden peker ut «Kulturaksen i Skippergata» som ett av tre kulturelle
 * tyngdepunkt og nevner fire steder i den: Fyringsbunkeren, Dora2, Doratorget
 * og Bunkerparken. Den oppgir ingen grense.
 *
 * Derfor tegnes aksen som den GATA den er oppkalt etter — Skippergatas
 * nordøstre strekning, som går mellom Fyringsbunkeren og Dora 2 — og ikke som
 * et polygon vi ville måttet finne på. Det er den enklere representasjonen:
 * den sier sant hvor aksen ligger, uten å påstå hvor den slutter.
 */
export const KULTURAKSEN: CuratedGeometryFeature = {
  id: "leve-geo-kulturaksen",
  name: "Kulturaksen i Skippergata",
  kind: "line",
  themeId: THEME_KULTUR_ID,
  poiId: "leve-kulturaksen",
  status: "mixed",
  precision: "sourced",
  coordinates: [
    [10.418291, 63.439296],
    [10.418216, 63.439399],
    [10.418167, 63.43945],
    [10.418102, 63.439518],
    [10.418056, 63.439548],
    [10.417947, 63.439619],
    [10.417795, 63.43969],
    [10.417677, 63.439733],
    [10.417595, 63.439763],
    [10.417208, 63.439856],
    [10.417143, 63.439869],
    [10.41666, 63.439965],
    [10.415368, 63.440225],
  ],
  sourceNote:
    "Aksen er tegnet som Skippergatas strekning mellom Fyringsbunkeren og Dora 2 (OpenStreetMap). Nyhavna.no navngir kulturaksen, men oppgir ingen avgrensning — flaten er derfor ikke tegnet.",
};

/**
 * Fyringsbunkerens fotavtrykk. Bygget står; den kulturelle bruken er planlagt.
 * Ett av de tolv vernede byggene kilden viser til.
 */
export const FYRINGSBUNKEREN_FLATE: CuratedGeometryFeature = {
  id: "leve-geo-fyringsbunkeren",
  name: "Fyringsbunkeren",
  kind: "area",
  themeId: THEME_KULTUR_ID,
  poiId: "leve-fyringsbunkeren",
  status: "existing",
  precision: "sourced",
  coordinates: [
    [10.418951, 63.4395],
    [10.41898, 63.439529],
    [10.418909, 63.439544],
    [10.419046, 63.43968],
    [10.418589, 63.439778],
    [10.41836, 63.439558],
    [10.418541, 63.439519],
    [10.418435, 63.439412],
    [10.418563, 63.439386],
    [10.418512, 63.439339],
    [10.418505, 63.43934],
    [10.418478, 63.439315],
    [10.418549, 63.439286],
    [10.418571, 63.439296],
    [10.418703, 63.439269],
    [10.418951, 63.4395],
  ],
  sourceNote: "Bygningsomriss fra OpenStreetMap (way 80560182).",
};

/**
 * Dora 2. Samme sak som Fyringsbunkeren: bygget står, bruken er under
 * omforming.
 */
export const DORA2_FLATE: CuratedGeometryFeature = {
  id: "leve-geo-dora2",
  name: "Dora 2",
  kind: "area",
  themeId: THEME_KULTUR_ID,
  poiId: "leve-dora2",
  status: "existing",
  precision: "sourced",
  coordinates: [
    [10.416714, 63.440215],
    [10.416798, 63.440298],
    [10.416818, 63.440294],
    [10.416865, 63.440341],
    [10.416845, 63.440345],
    [10.416867, 63.440367],
    [10.416887, 63.440363],
    [10.417317, 63.440792],
    [10.417283, 63.440798],
    [10.417244, 63.440758],
    [10.416798, 63.440847],
    [10.416725, 63.440772],
    [10.416269, 63.440864],
    [10.416222, 63.440874],
    [10.416029, 63.440681],
    [10.415898, 63.44066],
    [10.415743, 63.440501],
    [10.415795, 63.440448],
    [10.415584, 63.440239],
    [10.416201, 63.440117],
    [10.416545, 63.440048],
    [10.416714, 63.440215],
  ],
  sourceNote: "Bygningsomriss fra OpenStreetMap (way 80560165).",
};

/** Alt demoen tegner, i tegnerekkefølge: flater først, linjer over. */
export const NYHAVNA_LEVE_GEOMETRY: CuratedGeometryFeature[] = [
  FYRINGSBUNKEREN_FLATE,
  DORA2_FLATE,
  KULTURAKSEN,
  ELVEPROMENADEN,
];
