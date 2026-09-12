/**
 * Ren presentasjonsformatering for bolig-prototypen. Ingen forretningslogikk —
 * bare hvordan tall og datoer vises på skjermen.
 */

/** "7 min å gå" fra målt gangtid i minutter. */
export function formatWalkMinutes(minutes: number): string {
  return `${minutes} min å gå`;
}

/** ISO-dato ("2026-09-12") til "12.09.2026". Ukjent format vises uendret. */
export function formatCheckedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/** Estimert forbruk i USD, f.eks. "$0.0123". */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}
