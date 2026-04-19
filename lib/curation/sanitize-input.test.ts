import { describe, it, expect } from "vitest";
import { sanitizeGeminiInput } from "./sanitize-input";

describe("sanitizeGeminiInput", () => {
  it("stripper markdown-lenker, beholder tekst", () => {
    const input = "Se [Byhaven](https://byhaven.no) for detaljer.";
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("Se Byhaven for detaljer.");
    expect(result.strippedLinks).toBe(1);
  });

  it("stripper zero-width chars", () => {
    const input = "Byhaven\u200B er fint.\u200C"; // zero-width space + non-joiner
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("Byhaven er fint.");
    expect(result.strippedChars).toBeGreaterThan(0);
  });

  it("stripper RTL-override", () => {
    const input = "Byhaven er\u202E bra.";
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("Byhaven er bra.");
  });

  it("trunkerer hvis over max-lengde", () => {
    const long = "abc".repeat(2000); // 6000 tegn
    const result = sanitizeGeminiInput(long);
    expect(result.sanitized.length).toBe(3000);
    expect(result.truncated).toBe(true);
  });

  it("beholder newlines og tabs", () => {
    const input = "Linje 1\nLinje 2\tkolonne";
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("Linje 1\nLinje 2\tkolonne");
  });

  it("respekterer custom maxLength", () => {
    const input = "x".repeat(100);
    const result = sanitizeGeminiInput(input, { maxLength: 50 });
    expect(result.sanitized.length).toBe(50);
    expect(result.truncated).toBe(true);
  });
});
