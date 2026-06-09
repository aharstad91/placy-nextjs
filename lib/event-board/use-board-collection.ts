"use client";

import { useEffect, useMemo } from "react";
import { useCollection } from "@/lib/collection-store";

/**
 * Event-board "Min samling"-søm (Unit 5). Tynt lag oppå den eksisterende,
 * UENDREDE `useCollection`-storen (`lib/collection-store.ts`) som board-skallet
 * mangler i dag — all collection-UI har bodd i `ExplorerPage`.
 *
 * To ansvar:
 *
 * 1. **Scope + rehydrering.** `setProject(projectId)` scoper samlingen til dette
 *    event-prosjektet (clearer stale POIer fra andre prosjekter — `collection-
 *    store` gjør det selv ved prosjekt-bytte). Når en delt `?c=<slug>`-samling er
 *    levert fra serveren (`initialPoiIds`, via `getCollectionBySlug` i ruten —
 *    eiendom-presedens, IKKE event-Explorer-rutas boolske c-sjekk) seedes den inn
 *    i storen ÉN gang per slug, så de delte POIene preselekteres/highlightes.
 *
 *    Dette er state-synk (server → klient-store), ikke data-fetching: dataen er
 *    allerede hentet i server-komponenten. `useEffect` er riktig verktøy her
 *    (ingen Supabase-kall fra klient).
 *
 * 2. **Avledet `Set`.** `collectionPoiIds` eksponeres som `Set<string>` så
 *    `BoardMap` (markør-highlight) og lista (lagre-toggle) deler én kilde.
 */
export interface BoardCollectionApi {
  /** POI-IDene i den lokale samlingen (live, persistert via collection-store). */
  collectionPoiIds: Set<string>;
  /** Flat liste — bevart innsettingsrekkefølge (for samling-drawer-visning). */
  collectionPoiList: string[];
  /** Legg til / fjern en POI fra samlingen. */
  toggle: (poiId: string) => void;
  /** Fjern en POI fra samlingen. */
  remove: (poiId: string) => void;
  /** Tøm hele samlingen. */
  clear: () => void;
  /** True hvis POI-en er i samlingen. */
  has: (poiId: string) => boolean;
}

export function useBoardCollection(
  /** Prosjekt-id (scoper samlingen i collection-store). */
  projectId: string,
  /** Når false er hooken inert: ingen scoping/seeding, returnerer tom API. Brukes
   *  så boligrapporter (kaller hooken ubetinget pga. hook-reglene) IKKE clobber-er
   *  en aktiv Explorer-samling. */
  enabled: boolean,
  /** Delt samlings-POIer fra serveren (`?c=<slug>` → `getCollectionBySlug`).
   *  `undefined` når ingen delt lenke (eller ugyldig/utløpt slug → tom samling). */
  initialPoiIds?: string[],
  /** Slug på den delte samlingen — gjør seedingen idempotent per lenke. */
  initialSlug?: string,
): BoardCollectionApi {
  const {
    collectionPOIs,
    setProject,
    addToCollection,
    removeFromCollection,
    clearCollection,
  } = useCollection();

  // Scope samlingen til prosjektet. `setProject` no-op-er når id er uendret, så
  // den clearer ikke en aktiv samling ved re-render — kun ved faktisk bytte.
  // Inert når disabled (boligrapport) så Explorer-samlingen ikke clobbres.
  useEffect(() => {
    if (!enabled) return;
    setProject(projectId);
  }, [enabled, projectId, setProject]);

  // Rehydrer delt samling (server → store) ÉN gang per slug. Gates på slug så
  // brukerens egne add/remove etterpå ikke re-seedes på hver render. Ugyldig/
  // utløpt slug → `initialPoiIds` undefined → ingen seeding (tom samling).
  useEffect(() => {
    if (!enabled) return;
    if (!initialSlug || !initialPoiIds || initialPoiIds.length === 0) return;
    // setProject over har allerede scopet/cleret; legg de delte POIene inn.
    for (const id of initialPoiIds) {
      addToCollection(id);
    }
    // Kjør kun når enabled/slug/prosjekt endrer seg — ikke ved hver add/remove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, initialSlug, projectId]);

  // Disabled → tom, inert API (boligrapport). Ingen IDer lekker til markører/liste.
  const poiList = useMemo(
    () => (enabled ? collectionPOIs : []),
    [enabled, collectionPOIs],
  );

  const collectionPoiIds = useMemo(() => new Set(poiList), [poiList]);

  return {
    collectionPoiIds,
    collectionPoiList: poiList,
    toggle: (poiId: string) => {
      if (!enabled) return;
      if (collectionPOIs.includes(poiId)) {
        removeFromCollection(poiId);
      } else {
        addToCollection(poiId);
      }
    },
    remove: (poiId: string) => {
      if (!enabled) return;
      removeFromCollection(poiId);
    },
    clear: () => {
      if (!enabled) return;
      clearCollection();
    },
    has: (poiId: string) => enabled && collectionPOIs.includes(poiId),
  };
}
