import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Leser et renset sidefragment (data/demo/leangenbukta-nettside/pages/<id>.html).
 *
 * Fragmentene er bygd av `scripts/demo/leangenbukta-site/build-pages.mjs` og
 * leses ved bygging: sidene er statiske, så fila leses bare når siden rendres
 * første gang. ID-en kommer fra sideregisteret, aldri fra en URL, og valideres
 * likevel mot filnavnmønsteret.
 */
const DIR = path.join(process.cwd(), "data/demo/leangenbukta-nettside/pages");

export function readSiteFragment(id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(id)) throw new Error(`Ugyldig side-ID «${id}»`);
  return fs.readFileSync(path.join(DIR, `${id}.html`), "utf8");
}
