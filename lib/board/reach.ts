/**
 * Rekkevidde som en TILSTAND PER PUNKT, ikke bare tre linjer på kartet.
 *
 * Konturene alene svarte ikke på spørsmålet de reiser. Ringene lå der, og
 * punktene oppførte seg likt på begge sider av dem — så koblingen mellom
 * «Til fots» og «Rekkevidde» fantes bare som to knapper ved siden av hverandre
 * (Andreas, 2026-09-07: «de to kontrollene henger ikke sammen, de er to
 * separate […] det går ikke an å se det engang»). Her regnes koblingen ut:
 * hvilke steder ligger innenfor det du rekker, og hvilke gjør det ikke.
 *
 * ## Ringen er sannheten, ikke reisetiden
 *
 * Hvert POI bærer alt en precomputet reisetid (`POI.travelTime`, minutter fra
 * Matrix). Den er IKKE brukt her, og det er et bevisst valg: konturene kommer
 * fra Mapbox Isochrone, og de to kildene er ikke enige på marginen. Bruker vi
 * minuttene, kan et punkt som ligger godt innenfor den tegnede 10-minutters-
 * linja tegnes som «utenfor» fordi Matrix mente 11 — og da ser kartet ødelagt
 * ut, uansett hvem som har rett. Leseren dømmer etter linja hen ser. Derfor
 * avgjør linja.
 *
 * ## Hull teller
 *
 * En kontur kan ha hull: en lomme du ikke kommer til innenfor tidsbudsjettet
 * (motorveien uten kryssing, elva uten bru). Et punkt i hullet er UTENFOR.
 * `ContourLayer3D` tegner hullene som egne ringer nettopp fordi de er ekte
 * grenser, og da må punkt-testen respektere dem også.
 */

import type { ContourRing } from "./contour-geometry";
import type { IsochroneMinutes } from "@/lib/types";

/**
 * Hvor svakt et punkt UTENFOR rekkevidden tegnes, og hvor stort.
 *
 * Her — i motsetning til omvisningens vekting (`STORY_EMPHASIS_OPACITY`, der
 * opacityen alene ikke klarte å bære skillet) — er FORMEN hovedsignalet:
 * punktet utenfor faller til prikk og mister ikon og navn. Opacityen kommer
 * oppå det som forsterkning, og kan derfor være reell (45 %) uten at kartet
 * leser som avskrudd: prikken sier alt «jeg er sekundær nå».
 *
 * Delt av begge motorene, så «utenfor» ser likt ut i Kart og i Satelitt.
 */
export const REACH_OUTSIDE_OPACITY = 0.45;
export const REACH_OUTSIDE_DOT_SCALE = 0.8;

/**
 * Ray casting mot én ring, i lengde-/breddegrader.
 *
 * Grader og ikke meter: ringene er små (15 min bil er noen få km) og ligger
 * langt fra både dateline og pol, så en plan test er eksakt nok — og den er den
 * SAMME testen uansett hvilken motor som tegnet ringen.
 *
 * Kanten regnes som utenfor. En kontur har hundrevis av punkter, så et POI som
 * treffer selve linja på desimalen finnes i praksis ikke; å velge en side er
 * likevel bedre enn å la den være udefinert.
 */
export function pointInPolygon(
  ring: readonly (readonly [number, number])[],
  lng: number,
  lat: number,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inne i den ytre ringen og ikke i noe av hullene. */
export function ringContains(
  ring: ContourRing,
  lng: number,
  lat: number,
): boolean {
  if (!pointInPolygon(ring.outer, lng, lat)) return false;
  for (const hole of ring.holes) {
    if (pointInPolygon(hole, lng, lat)) return false;
  }
  return true;
}

/**
 * Den MINSTE konturen som inneholder punktet, eller null når ingen gjør det.
 *
 * `contourRings` leverer innerst først (5 → 10 → 15), så første treff er
 * svaret. Konturene er nøstet, så et punkt inne i 5 er også inne i 10 og 15 —
 * uten «minste» ville hvert punkt fått 5.
 */
export function reachMinutesFor(
  rings: readonly ContourRing[],
  coord: { lat: number; lng: number },
): IsochroneMinutes | null {
  for (const ring of rings) {
    if (ringContains(ring, coord.lng, coord.lat)) return ring.minutes;
  }
  return null;
}

export interface ReachState {
  /**
   * Rekkevidde er PÅ og det finnes ringer å måle mot. Av her betyr at kartet
   * skal se ut som før funksjonen fantes — ingen dempede punkter noe sted.
   */
  active: boolean;
  /** poi.id-er som ligger utenfor den ytterste konturen. */
  outsideIds: ReadonlySet<string>;
  /**
   * Antall steder innenfor.
   *
   * Ingen TOTAL her, med vilje. Nabolagspanelet skriver «998 steder» som summen
   * over temaene, og et anker er løftet inn i hvert tema et medlem hører hjemme
   * i — så summen teller Sirkus Shopping tre ganger. Et deduplisert totaltall
   * ved siden av det (973) ville lest som at kartet og panelet er uenige om hvor
   * stort nabolaget er. Andelen utenfor er dessuten ikke det leseren trenger:
   * «85 steder innenfor» er svaret, ikke «85 av 973». Trenger noe totalen, er
   * den `inside + outsideIds.size`.
   */
  inside: number;
  /** Konturene som faktisk finnes for denne reisemåten, innerst først. */
  minutes: IsochroneMinutes[];
}

export const REACH_INACTIVE: ReachState = {
  active: false,
  outsideIds: new Set(),
  inside: 0,
  minutes: [],
};

/**
 * Deler POI-ene i innenfor/utenfor mot konturene for én reisemåte.
 *
 * Tom ringliste gir INAKTIV, ikke «alle utenfor»: mangler profilen konturer,
 * har vi ikke målt noe, og da skal ingenting dempes. (Knappen sier selv fra i
 * det tilfellet — se `BoardMapControls.contoursAvailable`.)
 */
export function partitionByReach(
  rings: readonly ContourRing[],
  pois: readonly { id: string; coordinates: { lat: number; lng: number } }[],
): ReachState {
  if (rings.length === 0) return REACH_INACTIVE;
  const outsideIds = new Set<string>();
  let inside = 0;
  for (const poi of pois) {
    if (reachMinutesFor(rings, poi.coordinates) === null) {
      outsideIds.add(poi.id);
    } else {
      inside++;
    }
  }
  const minutes: IsochroneMinutes[] = [];
  for (const ring of rings) {
    if (!minutes.includes(ring.minutes)) minutes.push(ring.minutes);
  }
  return { active: true, outsideIds, inside, minutes };
}
