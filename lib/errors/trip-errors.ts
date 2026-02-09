export type TripErrorCode =
  | "ROUTE_CALCULATION_FAILED"
  | "ROUTE_CALCULATION_TIMEOUT"
  | "GEOLOCATION_UNAVAILABLE"
  | "GEOLOCATION_PERMISSION_DENIED"
  | "POI_NOT_FOUND"
  | "INVALID_TRIP_CONFIG";

export class TripError extends Error {
  constructor(
    message: string,
    public readonly code: TripErrorCode
  ) {
    super(message);
    this.name = "TripError";
  }
}

export function isTripError(error: unknown): error is TripError {
  return error instanceof TripError;
}
