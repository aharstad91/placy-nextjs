/**
 * Container-ID-form: `{customer}_{slug}` — speil av Wesseløkka-konvensjonen
 * (`lib/pipeline/create-report-project.ts`: `projectId = ${customerSlug}_${slug}`).
 *
 * Begge ledd er `slugify()`-utdata (`[a-z0-9-]+` — `slugify` mapper alle
 * ikke-alfanumeriske tegn til `-`, så ingen av leddene inneholder underscore).
 * De skjøtes med ÉT enkelt underscore → ID-en har alltid nøyaktig ett `_`.
 *
 * Cache-tag = `product:${projectId}` (PRD 7, K1). En feilskrevet CLI-arg uten
 * `{customer}_{slug}`-form ville ellers stille buste en ikke-eksisterende tag —
 * derfor denne form-vakten (Unit 07.8 AC2).
 */
export const PROJECT_ID_SHAPE = /^[a-z0-9-]+_[a-z0-9-]+$/;

/**
 * True hvis `id` har gyldig `{customer}_{slug}`-container-form: kun små
 * bokstaver, tall og bindestrek i hvert ledd, skjøtt med nøyaktig ett `_`,
 * begge ledd ikke-tomme.
 */
export function isValidProjectIdShape(id: string): boolean {
  return PROJECT_ID_SHAPE.test(id);
}
