"use client";

import { useMemo } from "react";
import { contourRingsForMode } from "@/lib/board/contour-geometry";
import {
  partitionByReach,
  REACH_INACTIVE,
  type ReachState,
} from "@/lib/board/reach";
import { useBoard } from "./board-state";

/**
 * Rekkevidde-tilstanden for hele boardet: hvilke steder ligger innenfor de
 * tegnede konturene for den valgte reisemåten, og hvilke gjør det ikke.
 *
 * ## Hvorfor hele boardet, og ikke bare de mountede markørene
 *
 * Begge kartmotorene monterer ULIKE sett — Mapbox rendrer alle POI-er med
 * stabil DOM-identitet og fader dem inn/ut, Google monterer bare de relevante
 * (`useBoardMarkerSet`). Regnet vi over «det som er mountet», ville tellingen i
 * kart-kontrollen sagt to forskjellige tall avhengig av hvilken visning du sto
 * i, for samme nabolag. Settet her er derfor alle POI-ene på boardet,
 * deduplikert — samme svar i Kart, Satelitt og 3D.
 *
 * Oppslaget er et `Set`, så en motor som monterer et subsett bare slår opp i det
 * som er relevant for den.
 *
 * ## Kostnad
 *
 * Punkt-i-polygon per POI per kontur. Målt på Wesselsløkka-skalaen — 973 POI-er
 * mot tre ringer på 400–600 punkter, altså verst tenkelige tilfelle der de
 * fleste punktene ligger utenfor og må testes mot alle tre: 23 ms.
 *
 * Det er én frames arbeid, og memoen holder på `data.categories` + reisemåte +
 * av/på — så det skjer bare ved boardets første render og når brukeren selv
 * bytter reisemåte eller slår funksjonen av og på. Ikke under panorering, ikke
 * per frame.
 */
export function useReach(): ReachState {
  const { state, data } = useBoard();

  const rings = useMemo(
    () =>
      state.showContours
        ? contourRingsForMode(data.isochrones, state.travelMode)
        : [],
    [state.showContours, state.travelMode, data.isochrones],
  );

  // Deduplikert: et anker løftes inn i HVERT tema et medlem hører hjemme i
  // (`report-data`), så samme POI kommer flere ganger ut av en flatMap over
  // kategoriene — og ville blitt talt like mange ganger.
  const pois = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; coordinates: { lat: number; lng: number } }[] = [];
    for (const category of data.categories) {
      for (const poi of category.pois) {
        if (seen.has(poi.id)) continue;
        seen.add(poi.id);
        out.push({ id: poi.id, coordinates: poi.coordinates });
      }
    }
    return out;
  }, [data.categories]);

  return useMemo(
    () => (rings.length === 0 ? REACH_INACTIVE : partitionByReach(rings, pois)),
    [rings, pois],
  );
}
