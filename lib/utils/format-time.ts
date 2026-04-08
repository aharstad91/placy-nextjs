/**
 * Format an ISO departure time to a relative string like "2 min" or "Nå".
 */
export function formatRelativeDepartureTime(isoTime: string): string {
  const departure = new Date(isoTime);
  const now = new Date();
  const diffMs = departure.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins <= 0) return "Nå";
  if (diffMins === 1) return "1 min";
  return `${diffMins} min`;
}
