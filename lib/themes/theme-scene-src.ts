/**
 * Akvarell-illustrasjoner per tema — full-bleed 1:1 scener brukt i
 * `ReportThemeChipsRow` og `getCategoryIllustrationSrc`. Generert via
 * `placy-illustrations`-skill.
 *
 * Bor i `lib/` (delt infra) — IKKE i `components/`. Tidligere lå dette i
 * `components/variants/report/theme-icons.ts`, men `lib/themes/category-
 * illustrations.ts` importerte det → en lib→components-avhengighet (arkitektur-
 * brudd). Flyttet hit (PRD 2 / r02.3) så avhengigheten peker riktig vei.
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
