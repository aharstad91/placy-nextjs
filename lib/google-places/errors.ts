/**
 * Typet Google Places-feil med maskinlesbar HTTP-status.
 *
 * HVORFOR STATUS MÅ VÆRE ET FELT og ikke bare tekst i en `Error`-melding:
 * backfill-scriptene MÅ skille kvotefeil fra transiente feil, og de to skal
 * håndteres motsatt:
 *
 *   403/429 (nøkkel avslått / rate limit) → abortér HELE kjøringen før noe
 *     skrives. Ellers står halvparten av boardet med fakta og ser komplett ut,
 *     mens resten mangler — et datasett i den tilstanden er verre enn ingen
 *     backfill, fordi ingenting i DB-en forteller hvor kjøringen stoppet.
 *   404 → stedet finnes ikke (utdatert place_id). Hopp over POI-en, fortsett.
 *   500/timeout → transient. Tell som feil per POI, fortsett batchen.
 *
 * Meldingsteksten er bevisst uendret fra den tidligere `new Error(...)`-formen
 * (`Google Places API error: ${status}`) slik at eksisterende kallere og tester
 * som matcher på tekst fortsetter å virke.
 */
export class PlacesApiError extends Error {
  readonly status: number;

  constructor(status: number, message = `Google Places API error: ${status}`) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
  }
}

/** HTTP-statuser som betyr «slutt å kalle Google» og ikke «dette stedet finnes ikke». */
const QUOTA_STATUSES = new Set([403, 429]);

/**
 * True når feilen betyr at kvoten/nøkkelen er problemet — altså at videre kall
 * er nytteløse og kjøringen skal abortere uten å skrive.
 */
export function isQuotaError(err: unknown): err is PlacesApiError {
  return err instanceof PlacesApiError && QUOTA_STATUSES.has(err.status);
}
