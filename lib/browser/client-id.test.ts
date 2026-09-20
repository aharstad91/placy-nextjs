import { describe, expect, it, vi } from "vitest";
import { newClientId } from "@/lib/browser/client-id";

describe("newClientId", () => {
  it("bruker randomUUID når nettleseren tilbyr det", () => {
    const randomUUID = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    expect(newClientId({ randomUUID })).toBe("11111111-1111-4111-8111-111111111111");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("lager en UUID v4 når randomUUID mangler på en usikker mobil-origin", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    const getRandomValues = vi.fn((target: Uint8Array) => {
      target.set(bytes);
      return target;
    });

    expect(newClientId({ getRandomValues })).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});
