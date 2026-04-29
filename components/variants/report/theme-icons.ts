/**
 * Akvarell-illustrasjoner per tema — full-bleed 1:1 scener brukt i
 * `ReportThemeChipsRow`. Generert via `placy-illustrations`-skill.
 *
 * Filnavn matcher tema-id, med legacy-overrides for tema som har skiftet id
 * (transport → transport-mobilitet).
 */
export const THEME_SCENE_SRC: Record<string, string> = {
  hverdagsliv: "/illustrations/themes/hverdagsliv.jpg",
  "barn-oppvekst": "/illustrations/themes/barn-oppvekst.jpg",
  "mat-drikke": "/illustrations/themes/mat-drikke.jpg",
  opplevelser: "/illustrations/themes/opplevelser.jpg",
  "natur-friluftsliv": "/illustrations/themes/natur-friluftsliv.jpg",
  transport: "/illustrations/themes/transport.jpg",
  "trening-aktivitet": "/illustrations/themes/trening-aktivitet.jpg",
};
