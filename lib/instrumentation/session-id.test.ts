import { describe, it, expect } from "vitest";
import { generateSessionId } from "./session-id";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateSessionId", () => {
  it("returnerer en opaque streng (UUID v4)", () => {
    const id = generateSessionId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(UUID_V4);
  });

  it("genererer en ny verdi per kall (per-økt, ikke persistert)", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateSessionId()));
    expect(ids.size).toBe(1000); // ingen kollisjoner → random, ikke deterministisk
  });

  it("er ikke avledet fra noen input (ingen PII-kilde, ingen argumenter)", () => {
    // Funksjonen tar ingen argumenter → kan ikke knyttes til IP/e-post/bruker-id.
    expect(generateSessionId.length).toBe(0);
  });
});
