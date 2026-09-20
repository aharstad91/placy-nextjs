import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocalDemoDescriptor, LocalDemoFeatures } from "@/lib/demo/local-board/registry";

/**
 * Et annet lokalt datasett, skrevet til en midlertidig mappe.
 *
 * Finnes for å bevise at kjernen er delt og ikke arvet: et datasett uten
 * steder, temaer eller spørsmål skal laste, og ingenting fra Nyhavna skal følge
 * med — verken i boardet, i stemmens kunnskap eller i instruksene.
 */

const ALL_OFF: LocalDemoFeatures = {
  faqProgress: false,
  revealPlaces: false,
  followHighlightCategory: false,
  unscopedCategoryList: false,
  narrationFocus: false,
  voicePacing: false,
  guidedPersona: false,
};

export async function writeTestDemo(options: {
  id?: string;
  name?: string;
  greeting?: string;
  features?: LocalDemoFeatures;
  board?: Record<string, unknown>;
} = {}): Promise<LocalDemoDescriptor> {
  const id = options.id ?? "leangenbukta-test";
  const name = options.name ?? "Leangenbukta";
  const directory = await mkdtemp(join(tmpdir(), `placy-${id}-`));
  const board = {
    schemaVersion: 1,
    // Boligprosjekt er den eneste implementerte profilen; en test som trenger
    // en annen setter den selv gjennom `board`.
    profile: "housing-development",
    id,
    name,
    center: { lat: 63.44, lng: 10.47 },
    greeting: options.greeting ?? `Hei, jeg er guiden din i ${name}.`,
    projectInfoLabel: `det kildekontrollerte materialet om ${name}`,
    categories: [{ id: "hverdagsliv", name: "Hverdagsliv", icon: "ShoppingBag", color: "#3b82f6" }],
    ...options.board,
  };
  await writeFile(join(directory, "board.json"), JSON.stringify(board));
  for (const file of ["sources.json", "places.json", "topics.json", "faq.json", "conversations.json"]) {
    await writeFile(join(directory, file), "[]");
  }
  return { id, directory, readme: `docs/research/${id}/README.md`, features: options.features ?? ALL_OFF };
}
