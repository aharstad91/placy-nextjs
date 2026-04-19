import { describe, it, expect } from "vitest";
import { sanitizeSearchEntryPointHtml } from "./sanitize";

describe("sanitizeSearchEntryPointHtml", () => {
  it("returns empty for empty input", () => {
    expect(sanitizeSearchEntryPointHtml("")).toBe("");
    expect(sanitizeSearchEntryPointHtml(null as unknown as string)).toBe("");
  });

  it("strips <script> tags", () => {
    const out = sanitizeSearchEntryPointHtml(
      "<div>ok</div><script>alert(1)</script>",
    );
    expect(out).not.toMatch(/<script/);
    expect(out).toMatch(/<div>ok<\/div>/);
  });

  it("strips onclick/onerror handlers", () => {
    const out = sanitizeSearchEntryPointHtml(
      `<a href="https://google.com" onclick="alert(1)">click</a>`,
    );
    expect(out).not.toMatch(/onclick/i);
    expect(out).toMatch(/href="https:\/\/google.com"/);
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeSearchEntryPointHtml(
      `<a href="javascript:alert(1)">x</a>`,
    );
    expect(out).not.toMatch(/javascript:/i);
  });

  it("preserves <style> block (Google needs it for styling)", () => {
    const out = sanitizeSearchEntryPointHtml(
      "<style>.chip{color:red}</style><div class=\"chip\">x</div>",
    );
    expect(out).toMatch(/<style>.*chip.*<\/style>/);
    expect(out).toMatch(/class="chip"/);
  });

  it("preserves <a href> to https (target may be stripped by DOMPurify — OK)", () => {
    const input =
      '<a class="chip" href="https://google.com/search?q=test" rel="noopener">Chip</a>';
    const out = sanitizeSearchEntryPointHtml(input);
    expect(out).toMatch(/href="https:\/\/google.com/);
    expect(out).toMatch(/class="chip"/);
  });

  it("blocks iframe", () => {
    const out = sanitizeSearchEntryPointHtml(
      '<iframe src="https://evil.com"></iframe><div>ok</div>',
    );
    expect(out).not.toMatch(/<iframe/);
    expect(out).toMatch(/<div>ok<\/div>/);
  });
});
