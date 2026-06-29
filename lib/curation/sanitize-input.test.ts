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
    const input = "Byhaven​ er fint.‌"; // zero-width space + non-joiner
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("Byhaven er fint.");
    expect(result.strippedChars).toBeGreaterThan(0);
  });

  it("stripper RTL-override", () => {
    const input = "Byhaven er‮ bra.";
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

  // AC1: DANGEROUS_CHARS_RE MED /g — replace-all, ikke bare første treff.
  // Låser /g eksplisitt (regresjon hvis noen "konsistens-fikser" bort /g her).
  it("stripper ALLE farlige tegn (replace-all via /g) + teller dem", () => {
    const input = "a​b‌c﻿d"; // zero-width space + non-joiner + BOM
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("abcd");
    expect(result.strippedChars).toBe(3);
  });

  it("stripper BOM (U+FEFF)", () => {
    const result = sanitizeGeminiInput("﻿Byhaven er fint.");
    expect(result.sanitized).toBe("Byhaven er fint.");
    expect(result.strippedChars).toBe(1);
  });

  it("stripper kontroll-tegn men beholder \\n og \\t", () => {
    // U+0001 er farlig; \t (U+0009) + \n (U+000A) ligger i regex-hullene og bevares
    const input = "abcd\te\nf";
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("abcd\te\nf");
    expect(result.strippedChars).toBe(1);
  });

  it("teller flere markdown-lenker", () => {
    const input = "[A](http://a.no) og [B](http://b.no) og [C](http://c.no)";
    const result = sanitizeGeminiInput(input);
    expect(result.sanitized).toBe("A og B og C");
    expect(result.strippedLinks).toBe(3);
  });

  it("truncated=false når under max-lengde", () => {
    const result = sanitizeGeminiInput("kort tekst");
    expect(result.truncated).toBe(false);
    expect(result.strippedLinks).toBe(0);
    expect(result.strippedChars).toBe(0);
  });
});
