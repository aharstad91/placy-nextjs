/**
 * Path-helpers for audio-tour MP3-filer. Sentralisert slik at både
 * scripts/audio-tour-build.ts og runtime-renderer bruker samme oppslag.
 *
 * Hjem → "hjem.mp3" (eksplisitt mapping, ikke "home.mp3").
 * Andre spor → "{trackKey}.mp3" (= theme.id).
 */

import * as path from "node:path";

export function audioFilename(trackKey: string): string {
  return trackKey === "home" ? "hjem.mp3" : `${trackKey}.mp3`;
}

/**
 * URL som lagres i `audio.url` — relativ til /public/, dvs. det runtime
 * laster via `<audio src=...>`.
 */
export function audioRelPath(projectSlug: string, trackKey: string): string {
  return `/audio/${projectSlug}/${audioFilename(trackKey)}`;
}

/**
 * Absolutt path i repo-treet — der `writeFileSync` skal skrive MP3-en.
 * Beregnes mot `process.cwd()` slik at scriptet kan kjøres fra
 * hvilken som helst worktree.
 */
export function audioAbsPath(projectSlug: string, trackKey: string): string {
  return path.resolve(
    process.cwd(),
    "public",
    "audio",
    projectSlug,
    audioFilename(trackKey),
  );
}
