import "server-only";

import type { BoardData } from "@/components/variants/report/board/board-data";
import { getNyhavnaSnapshot } from "@/lib/demo/nyhavna-leve/snapshot";
import { buildLocalBoard, datasetId } from "@/lib/demo/nyhavna-lokal/board";
import { loadDataset, LOCAL_DATASET_ID } from "@/lib/demo/nyhavna-lokal/dataset";
import { buildVoiceDeps, buildLocalInstructions } from "@/lib/demo/nyhavna-lokal/voice";
import { createNyhavnaConversation, type NyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { nyhavnaInstructions } from "@/lib/realtime/nyhavna-knowledge";
import { nyhavnaProjectInfo } from "@/lib/realtime/nyhavna-project-info";

/**
 * Hvilket datagrunnlag en Live-samtale gjelder (2026-09-13).
 *
 * ## Hvorfor et register
 *
 * Ruta `/api/prototype/live` leste tidligere ÉTT datagrunnlag, hardkodet: det
 * frosne Nyhavna-snapshotet. Nå finnes to demoer på samme kode — snapshotet og
 * det lokale JSON-datasettet — og de har ulike steder, ulike fakta og ulik
 * hilsen. Uten et eksplisitt valg ville den ene demoens guide snakket om den
 * andres innhold, og det er nøyaktig den feilen demoen finnes for å ikke gjøre.
 *
 * Valget kommer fra BOARDET (`BoardData.demoDataset`), ikke fra en URL eller en
 * miljøvariabel: det er boardet brukeren faktisk ser på, og det er det guiden
 * skal snakke om. `snapshotId` kontrolleres i tillegg, så en fane som sto åpen
 * mens innholdet ble endret får beskjed om å laste på nytt i stedet for en
 * guide som er uenig med skjermen.
 */

export const DEFAULT_LIVE_DATASET = "nyhavna-leve";

/** Datasett-ID-ene ruta godtar. Alt annet avvises. */
export const LIVE_DATASETS = [DEFAULT_LIVE_DATASET, LOCAL_DATASET_ID] as const;
export type LiveDatasetId = (typeof LIVE_DATASETS)[number];

export function isLiveDataset(value: string): value is LiveDatasetId {
  return (LIVE_DATASETS as readonly string[]).includes(value);
}

export interface LiveDemo {
  id: LiveDatasetId;
  /** Innholds-ID-en flaten må bære for å få snakke med dette grunnlaget. */
  snapshotId: string;
  board: BoardData;
  /** Den lange instruksen til Responses-backenden: regler, temaer, katalog. */
  backendInstructions: string;
  /** Fabrikken lager en FERSK samtaletilstand per sesjon — aldri delt. */
  createConversation: () => NyhavnaConversation;
}

async function leveDemo(): Promise<LiveDemo> {
  const snapshot = await getNyhavnaSnapshot();
  return {
    id: DEFAULT_LIVE_DATASET,
    snapshotId: snapshot.snapshotId,
    board: snapshot.board,
    backendInstructions: nyhavnaInstructions(snapshot.board),
    createConversation: () =>
      createNyhavnaConversation(snapshot.board, { projectInfo: nyhavnaProjectInfo }),
  };
}

async function lokalDemo(): Promise<LiveDemo> {
  const dataset = await loadDataset();
  const board = buildLocalBoard(dataset);
  const deps = buildVoiceDeps(dataset);
  return {
    id: LOCAL_DATASET_ID,
    snapshotId: datasetId(dataset),
    board,
    backendInstructions: buildLocalInstructions(dataset, board),
    createConversation: () => createNyhavnaConversation(board, deps),
  };
}

/** Laster datagrunnlaget for ett datasett. Kaster hvis filene ikke kan leses. */
export function loadLiveDemo(dataset: LiveDatasetId): Promise<LiveDemo> {
  return dataset === LOCAL_DATASET_ID ? lokalDemo() : leveDemo();
}
