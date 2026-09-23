import { describe, expect, it } from "vitest";
import { resolveLinkIds } from "@/lib/demo/leangenbukta-chat/links";

describe("leangenbukta-chat/links", () => {
  it("løser en kjent side-ID til registerets tittel og sti", () => {
    const resolved = resolveLinkIds(["page:beliggenhet"]);
    expect(resolved).toEqual([{ id: "page:beliggenhet", label: "Beliggenhet", href: "/demo/leangenbukta-nettside/beliggenhet" }]);
  });

  it("løser board", () => {
    expect(resolveLinkIds(["board"])).toEqual([{ id: "board", label: "Åpne Board", href: "/demo/leangenbukta-lokal" }]);
  });

  it("dropper contact stille når ingen kontaktside finnes i registeret", () => {
    expect(resolveLinkIds(["contact"])).toEqual([]);
  });

  it("dropper ukjente side-ID-er, vilkårlige URL-er og javascript: stille", () => {
    const resolved = resolveLinkIds(["page:ukjent-side", "https://evil.example.com", "javascript:alert(1)", "//evil.example.com"]);
    expect(resolved).toEqual([]);
  });

  it("dedupliserer og kapper til 4 lenker", () => {
    const resolved = resolveLinkIds(["board", "board", "page:beliggenhet", "page:forside", "page:beliggenhet", "board"]);
    expect(resolved.map((r) => r.id)).toEqual(["board", "page:beliggenhet", "page:forside"]);
  });

  it("ignorerer ikke-streng-verdier uten å kaste", () => {
    expect(resolveLinkIds([42, null, undefined, {}] as unknown[])).toEqual([]);
  });
});
