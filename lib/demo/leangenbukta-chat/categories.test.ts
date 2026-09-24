import { describe, expect, it } from "vitest";
import { chatCategories, type BoardCategoryMeta } from "@/lib/demo/leangenbukta-chat/categories";

const base: BoardCategoryMeta[] = [
  { id: "leangenbukta-prosjektet", label: "Leangenbukta", icon: "Building2", color: "#91563e" },
  { id: "hverdag", label: "Hverdag", icon: "ShoppingCart", color: "#36d16f" },
];

describe("chatCategories", () => {
  it("dropper temaer uten kuraterte forslag eller med utrygg farge/ikon", () => {
    const result = chatCategories(
      [
        ...base,
        { id: "ukjent", label: "Ukjent", icon: "Bus", color: "#000000" },
        { id: "natur", label: "Natur", icon: "Trees", color: "url(x)" },
        { id: "transport", label: "Transport", icon: "<svg>", color: "#4d93f8" },
      ],
      [],
    );
    expect(result.map((c) => c.id)).toEqual(["leangenbukta-prosjektet", "hverdag"]);
  });

  it("setter sidens forslag først i første tema og fyller opp til tre uten duplikater", () => {
    const [project, hverdag] = chatCategories(base, ["Hva er Leangenbukta?", "Hvor lang tid tar det til sentrum?"]);
    expect(project.questions).toEqual(["Hva er Leangenbukta?", "Hvor lang tid tar det til sentrum?", "Hvilke bygg består Leangenbukta av?"]);
    expect(hverdag.questions).toHaveLength(3);
  });
});
