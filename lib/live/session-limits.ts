/** Lokal samtalegrense, uavhengig av eventuelle grenser hos leverandøren. */
export const LIVE_SESSION_MAX_MS = 30 * 60 * 1000;
export const LIVE_SESSION_WARNING_MS = LIVE_SESSION_MAX_MS - 2 * 60 * 1000;
