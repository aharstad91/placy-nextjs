import "server-only";

import type { BoardData } from "@/components/variants/report/board/board-data";
import { getNyhavnaSnapshot } from "@/lib/demo/nyhavna-leve/snapshot";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/local-board/board";
import { loadDataset } from "@/lib/demo/local-board/dataset";
import { getLocalDemo, isLocalDemoId, LOCAL_DEMO_IDS, type LocalDemoDescriptor, type LocalDemoId } from "@/lib/demo/local-board/registry";
import { LocalDatasetError } from "@/lib/demo/local-board/errors";
import { buildVoiceDeps, buildLocalInstructions } from "@/lib/demo/local-board/voice";
import { conversationTools, createNyhavnaConversation, type NyhavnaConversation } from "@/lib/realtime/nyhavna-conversation";
import { NYHAVNA_LABELS, type ConversationLabels } from "@/lib/realtime/conversation-labels";
import { nyhavnaInstructions } from "@/lib/realtime/nyhavna-knowledge";
import { nyhavnaProjectInfo } from "@/lib/realtime/nyhavna-project-info";
import { createPresentation, presentationTool, similarPlacesTool, morePlacesTool } from "@/lib/demo/local-board/presentation";
import { buildLocalVoiceInstructions } from "@/lib/demo/local-board/voice-instructions";
import type { RealtimeTool } from "@/lib/realtime/types";
import type { Project } from "@/lib/types";

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

/**
 * Datasett-ID-ene ruta godtar: snapshotet pluss hver registrerte lokale demo.
 *
 * Typen er unionen av nettopp de ID-ene, ikke `string`: da er `isLiveDataset`
 * en ekte innsnevring, og et kallsted som glemmer sjekken blir en typefeil i
 * stedet for en runtime-avvisning.
 */
export type LiveDatasetId = typeof DEFAULT_LIVE_DATASET | LocalDemoId;

export const LIVE_DATASETS: readonly LiveDatasetId[] = [DEFAULT_LIVE_DATASET, ...LOCAL_DEMO_IDS];

export function isLiveDataset(value: string): value is LiveDatasetId {
  return LIVE_DATASETS.some((id) => id === value);
}

export interface LiveDemo {
  id: LiveDatasetId;
  /** Innholds-ID-en flaten må bære for å få snakke med dette grunnlaget. */
  snapshotId: string;
  board: BoardData;
  project: Project;
  /** Den lange instruksen til Responses-backenden: regler, temaer, katalog. */
  backendInstructions: string;
  voiceInstructions?: string;
  /**
   * HELE verktøylista sesjonen får. Ligger på demoen og ikke i ruta fordi
   * beskrivelsene navngir stedet: en global liste ville sagt «Nyhavna» til
   * enhver demo (`ConversationLabels`).
   */
  tools: RealtimeTool[];
  parallelTools?: boolean;
  /** Fabrikken lager en FERSK samtaletilstand per sesjon — aldri delt. */
  createConversation: () => NyhavnaConversation;
}

async function leveDemo(): Promise<LiveDemo> {
  const snapshot = await getNyhavnaSnapshot();
  return {
    id: DEFAULT_LIVE_DATASET,
    snapshotId: snapshot.snapshotId,
    board: snapshot.board,
    project: snapshot.project,
    backendInstructions: nyhavnaInstructions(snapshot.board),
    // Navnene sendes EKSPLISITT, ikke som standard: snapshotet er frosset, og
    // teksten modellen leser skal ikke kunne endres av en standardverdi.
    tools: conversationTools(NYHAVNA_LABELS),
    createConversation: () =>
      createNyhavnaConversation(snapshot.board, { projectInfo: nyhavnaProjectInfo, labels: NYHAVNA_LABELS }),
  };
}

/**
 * `id` kommer fra kallstedet og ikke fra deskriptoren fordi det er DER den er
 * innsnevret til en godkjent datasett-ID. Deskriptorens `id` er en vanlig
 * streng, slik at tester kan skrive et syntetisk datasett til en midlertidig
 * mappe uten å stå i registeret.
 */
async function lokalDemo(descriptor: LocalDemoDescriptor, id: LiveDatasetId): Promise<LiveDemo> {
  const dataset = await loadDataset(descriptor);
  // Prosjektet bygges én gang og sendes inn: innholds-ID-en er en SHA-256 over
  // hele datasettet, og den skal beregnes én gang per lasting.
  const project = buildLocalProject(dataset, descriptor);
  const board = buildLocalBoard(dataset, descriptor, project);
  // Stedsnavnet og kildematerialet kommer fra datasettets `board.json`, så
  // verktøytekstene omtaler det boardet faktisk viser.
  const labels: ConversationLabels = {
    areaName: dataset.board.name,
    projectInfoLabel: dataset.board.projectInfoLabel,
  };
  const deps = { ...buildVoiceDeps(dataset), labels };
  return {
    id,
    // Alltid satt av `buildLocalProject`; feltet er valgfritt på `Project`
    // fordi provisjonerte boards ikke har noe frosset datagrunnlag.
    snapshotId: project.demoSnapshotId!,
    board,
    project,
    backendInstructions: buildLocalInstructions(dataset, board),
    voiceInstructions: buildLocalVoiceInstructions(dataset),
    tools: [...conversationTools(labels), presentationTool, similarPlacesTool, morePlacesTool],
    parallelTools: false,
    createConversation: () => createPresentation(createNyhavnaConversation(board, deps), {
      segments: dataset.board.presentation ?? [],
      places: dataset.places,
      center: dataset.board.center,
      categories: dataset.board.categories,
      homeName: dataset.board.name,
      discoveryCategoryIds: dataset.board.discoveryCategoryIds,
    }),
  };
}

/**
 * Laster datagrunnlaget for ett datasett. Kaster hvis filene ikke kan leses.
 *
 * Ukjent ID gir en feil, ALDRI snapshotet: et stille tilbakefall ville gitt en
 * guide som snakker om Nyhavna på et board som viser noe annet.
 */
export function loadLiveDemo(dataset: LiveDatasetId): Promise<LiveDemo> {
  if (dataset === DEFAULT_LIVE_DATASET) return leveDemo();
  if (isLocalDemoId(dataset)) return lokalDemo(getLocalDemo(dataset), dataset);
  return Promise.reject(new LocalDatasetError(`Ukjent datasett «${dataset}». Godkjente: ${LIVE_DATASETS.join(", ")}.`));
}
