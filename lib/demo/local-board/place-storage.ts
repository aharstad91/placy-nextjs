import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { LocalDatasetError } from "@/lib/demo/local-board/errors";

export const PLACE_FILES = {
  legacy: "places.json",
  audited: "places-audited.json",
  register: "places-register.json",
} as const;

export type PlaceStorage =
  | { format: "legacy"; legacyRaw: string }
  | { format: "split"; auditedRaw: string; registerRaw: string };

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new LocalDatasetError(
      `Kunne ikke lese ${path}: ${error instanceof Error ? error.message : "ukjent feil"}`,
    );
  }
}

/** Leser enten én legacyfil eller det atomiske audited/register-paret. */
export async function readPlaceStorage(directory: string, readme?: string): Promise<PlaceStorage> {
  const paths = {
    legacy: join(/* turbopackIgnore: true */ directory, PLACE_FILES.legacy),
    audited: join(/* turbopackIgnore: true */ directory, PLACE_FILES.audited),
    register: join(/* turbopackIgnore: true */ directory, PLACE_FILES.register),
  };
  const [legacyRaw, auditedRaw, registerRaw] = await Promise.all([
    readOptional(paths.legacy),
    readOptional(paths.audited),
    readOptional(paths.register),
  ]);
  const hint = readme ? ` — se ${readme}` : "";

  if (legacyRaw !== undefined && (auditedRaw !== undefined || registerRaw !== undefined)) {
    throw new LocalDatasetError(
      `${directory}/ har både ${PLACE_FILES.legacy} og delt stedsformat. ` +
        `Behold enten den ene fila eller paret ${PLACE_FILES.audited} + ${PLACE_FILES.register}.`,
    );
  }
  if ((auditedRaw === undefined) !== (registerRaw === undefined)) {
    const missing = auditedRaw === undefined ? PLACE_FILES.audited : PLACE_FILES.register;
    throw new LocalDatasetError(
      `Fant ikke ${join(directory, missing)}. Delt stedsformat krever både ` +
        `${PLACE_FILES.audited} og ${PLACE_FILES.register}${hint}.`,
    );
  }
  if (auditedRaw !== undefined && registerRaw !== undefined) {
    return { format: "split", auditedRaw, registerRaw };
  }
  if (legacyRaw !== undefined) return { format: "legacy", legacyRaw };

  throw new LocalDatasetError(
    `Fant ikke ${paths.legacy}. Datasettet trenger enten ${PLACE_FILES.legacy} eller paret ` +
      `${PLACE_FILES.audited} + ${PLACE_FILES.register}${hint}.`,
  );
}
