import type { Board3DModel } from "@/lib/types";

/**
 * Prototype-lokal kilde til 3D-bygningsmodeller per prosjekt for rapport-boardet.
 *
 * Speiler camera-tours.ts: keyed på prosjekt-slug → `Board3DModel`. BEVISST en
 * lokal fil (ikke Supabase) på prototype-stadiet — enkel å iterere på (rediger
 * + reload), null DB-plumbing. Prod-promotering er deferert.
 *
 * `position` utelates her → ModelLayer3D bruker prosjektets home-koordinat
 * (single-sourced fra Supabase via board-data). Bytt `src` til en ekte
 * arkitekt-`.glb` uten kodeendring (Unit 7).
 *
 * MERK: kun prosjekter oppført her får en 3D-modell; alle andre rendrer kartet
 * uten modell (graceful — ModelLayer3D får `null`).
 */
const BOARD_MODELS: Record<string, Board3DModel> = {
  // Stasjonskvartalet: placeholder-massing (enhetskube skalert til grovt
  // bygningsvolum) på prosjekt-tomten (Sjøgangen 7, Brattøra). position
  // utelatt → home-koordinat. Skala/heading kalibreres mot tiles i browser.
  stasjonskvartalet: {
    src: "/models/placeholder-massing.glb",
    scale: { x: 60, y: 34, z: 46 },
    altitudeMode: "CLAMP_TO_GROUND",
  },
};

/** 3D-modellen for et prosjekt, eller `undefined` for ukjent slug. */
export function getBoardModel(slug: string): Board3DModel | undefined {
  return BOARD_MODELS[slug];
}
