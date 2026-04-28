/**
 * Watercolor-illustrasjoner per tema, generert via Gemini i Wesselsløkka-akvarell-stil.
 *
 * To sett finnes:
 *   - THEME_ICON_SRC: små kvadratiske ikoner brukt i `ReportThemeChipsRow`
 *   - THEME_SCENE_SRC: større nabolags-scener brukt i `ReportMapPreviewCard`s info-stripe
 *
 * Filnavn matcher tema-id, med legacy-overrides for tema som har skiftet id
 * (barn-oppvekst → barn-aktivitet, transport → transport-mobilitet).
 */
export const THEME_ICON_SRC: Record<string, string> = {
  hverdagsliv: "/illustrations/icons/hverdagsliv-icon.png",
  "barn-oppvekst": "/illustrations/icons/barn-aktivitet-icon.png",
  "mat-drikke": "/illustrations/icons/mat-drikke-icon.png",
  opplevelser: "/illustrations/icons/opplevelser-icon.png",
  "natur-friluftsliv": "/illustrations/icons/natur-friluftsliv-icon.png",
  transport: "/illustrations/icons/transport-mobilitet-icon.png",
  "trening-aktivitet": "/illustrations/icons/trening-aktivitet-icon.png",
};

/**
 * Scene-illustrasjoner per tema — bredere nabolags-illustrasjoner som vises i
 * map-preview-card info-stripen. Genereres via `placy-illustrations`-skill.
 *
 * For tema som mangler dedikert scene faller vi tilbake til hverdagsliv-scenen
 * (varm, generisk nabolags-vibe). En ekte `opplevelser`-scene mangler enn så lenge.
 */
export const THEME_SCENE_SRC: Record<string, string> = {
  hverdagsliv: "/illustrations/hverdagsliv.jpg",
  "barn-oppvekst": "/illustrations/barn-aktivitet.jpg",
  "mat-drikke": "/illustrations/mat-drikke.jpg",
  opplevelser: "/illustrations/hverdagsliv.jpg",
  "natur-friluftsliv": "/illustrations/natur-friluftsliv.jpg",
  transport: "/illustrations/transport-mobilitet.jpg",
  "trening-aktivitet": "/illustrations/trening-aktivitet.jpg",
};
