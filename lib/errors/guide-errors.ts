export type GuideErrorCode =
  | "ROUTE_CALCULATION_FAILED"
  | "ROUTE_CALCULATION_TIMEOUT"
  | "GEOLOCATION_UNAVAILABLE"
  | "GEOLOCATION_PERMISSION_DENIED"
  | "POI_NOT_FOUND"
  | "INVALID_GUIDE_CONFIG";

export class GuideError extends Error {
  constructor(
    message: string,
    public readonly code: GuideErrorCode
  ) {
    super(message);
    this.name = "GuideError";
  }
}

export function isGuideError(error: unknown): error is GuideError {
  return error instanceof GuideError;
}
