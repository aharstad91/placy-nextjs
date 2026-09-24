import { describe, expect, it } from "vitest";
import board from "@/data/demo/nyhavna-lokal/board.json";
import sources from "@/data/demo/nyhavna-lokal/sources.json";
import { chatCategories, CATEGORY_QUESTIONS } from "@/lib/demo/leangenbukta-chat/categories";
import { replyNotice } from "@/lib/demo/leangenbukta-chat/instructions";
import { NH_CATEGORY_QUESTIONS } from "@/lib/demo/nyhavna-chat/categories";
import { nhPageOpening, nhTextChatInstructions, NH_REPLIES } from "@/lib/demo/nyhavna-chat/instructions";
import { getNhSitePage, getNhSitePages } from "@/lib/demo/nyhavna-chat/pages";
import { nhFallbackLinks, resolveNhLinkIds } from "@/lib/demo/nyhavna-chat/links";
import { nyhavnaSourceRegistry } from "@/lib/demo/nyhavna-chat/sources";
import { loadLiveDemo } from "@/lib/live/demos";

describe("Nyhavna-chattens innhold", () => {
  it("har tre forslag for hver av boardets kategorier, og ingen for kategorier boardet ikke har", () => {
    const ids = board.categories.map((category) => category.id);
    expect(Object.keys(NH_CATEGORY_QUESTIONS).sort()).toEqual([...ids].sort());
    for (const questions of Object.values(NH_CATEGORY_QUESTIONS)) expect(questions).toHaveLength(3);
  });

  it("bygger temaraden av det ekte boardet, med sidens forslag først i første tema", async () => {
    const demo = await loadLiveDemo("nyhavna-lokal");
    const page = getNhSitePage("beliggenhet")!;
    const categories = chatCategories(demo.board.categories, page.chatStarters, NH_CATEGORY_QUESTIONS);
    expect(categories.map((category) => category.id)).toEqual(board.categories.map((category) => category.id));
    expect(categories[0].questions).toEqual(page.chatStarters);
    expect(categories[1].questions).toEqual([...NH_CATEGORY_QUESTIONS.hverdagsliv]);
    // «transport» og «opplevelser» finnes i begge boardene; Nyhavna får sine egne forslag.
    const transport = categories.find((category) => category.id === "transport")!;
    expect(transport.questions).toEqual([...NH_CATEGORY_QUESTIONS.transport]);
    expect(transport.questions).not.toEqual([...CATEGORY_QUESTIONS.transport]);
  });

  it("kjenner bare kopiens to sider, med tre forslag hver", () => {
    expect(getNhSitePages().map((page) => page.id)).toEqual(["forside", "beliggenhet"]);
    for (const page of getNhSitePages()) expect(page.chatStarters).toHaveLength(3);
    expect(getNhSitePage("om-selskapet")).toBeNull();
    expect(nhPageOpening(getNhSitePage("forside")!)).toMatch(/planlegges.*i dag/);
    expect(nhPageOpening(getNhSitePage("beliggenhet")!)).toMatch(/i dag/);
  });

  it("slipper bare lenker fra det lukkede alfabetet gjennom", () => {
    expect(resolveNhLinkIds(["board", "contact", "page:beliggenhet", "page:ukjent", "https://evil.example", "javascript:alert(1)"])).toEqual([
      { id: "board", label: "Utforsk Nyhavna med Placy", href: "/demo/nyhavna-lokal" },
      { id: "contact", label: "Kontakt Nyhavna Utvikling", href: "/demo/nyhavna-nettside#kontakt" },
      { id: "page:beliggenhet", label: "Beliggenhet", href: "/demo/nyhavna-nettside/beliggenhet" },
    ]);
    expect(nhFallbackLinks().map((link) => link.id)).toEqual(["board", "contact"]);
  });

  it("leser Nyhavnas eget kilderegister", () => {
    const registry = nyhavnaSourceRegistry();
    expect(registry.byId(sources[0].id)?.url).toBe(sources[0].url);
    expect(registry.latestCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(registry.byId("leangenbukta-prosjekt")).toBeNull();
  });

  it("instruksen skiller dagens tilbud fra planene og henviser til Nyhavna Utvikling", () => {
    const text = nhTextChatInstructions(getNhSitePage("forside")!, [{ id: "nyhavna-bydel", label: "Nyhavna som bydel" }]);
    expect(text).toContain("I DAG ELLER PLANLAGT");
    expect(text).toContain("delområder, ikke fem vedtatte eller nummererte byggetrinn");
    expect(text).toContain("henvis til Nyhavna Utvikling");
    expect(text).toContain("nyhavna-bydel (Nyhavna som bydel)");
    expect(text).not.toMatch(/Leangenbukta|salgsteamet/);
  });

  it("gir Nyhavnas egne forbehold, og ingen når svaret alt har forbeholdet", () => {
    const base = { answerType: "fact", provisional: false };
    expect(replyNotice({ ...base, userText: "Hva koster en leilighet?", reply: "Det vet jeg ikke." }, NH_REPLIES.notices)?.text).toBe(NH_REPLIES.notices.sales);
    expect(replyNotice({ ...base, userText: "Hva koster en leilighet?", reply: "Det har Nyhavna Utvikling oppdatert informasjon om." }, NH_REPLIES.notices)).toBeNull();
    expect(replyNotice({ ...base, userText: "Når er Transittkaia ferdig?", reply: "Første etappe avhenger av plangodkjenning." }, NH_REPLIES.notices)).toBeNull();
    expect(replyNotice({ ...base, provisional: true, userText: "Hva er Bunkerkvartalet?", reply: "Et delområde ved havna." }, NH_REPLIES.notices)?.kind).toBe("provisional");
    expect(NH_REPLIES.unsupportedYear(["2031"])).toContain("2031");
  });
});
