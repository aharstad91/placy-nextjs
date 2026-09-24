import { describe, expect, it } from "vitest";
import { sanitizeReply } from "@/lib/demo/site-chat/sanitize";

describe("leangenbukta-chat/sanitize", () => {
  it("beholder vanlig norsk tekst uendret", () => {
    expect(sanitizeReply("Knutepunktet er planlagt med treningsrom for beboerne.")).toBe(
      "Knutepunktet er planlagt med treningsrom for beboerne.",
    );
  });

  it("fjerner styretegn men ikke linjeskift", () => {
    const withControl = "Linje 1\nLinje 2\u0007 med bjelle-tegn";
    expect(sanitizeReply(withControl)).toBe("Linje 1\nLinje 2 med bjelle-tegn");
  });

  it("gjør ikke <script> til noe annet enn tekst (widgeten bruker aldri innerHTML)", () => {
    const text = "<script>alert(1)</script> er bare tekst her.";
    expect(sanitizeReply(text)).toContain("<script>alert(1)</script>");
  });

  it("kapper svært lange svar", () => {
    const long = "a".repeat(2000);
    const result = sanitizeReply(long);
    expect(result.length).toBeLessThan(1210);
    expect(result.endsWith("…")).toBe(true);
  });
});
