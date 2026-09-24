import { describe, expect, it, vi } from "vitest";
import { loadLiveDemo } from "@/lib/live/demos";
import { chatSurfaceBackendAddendum, chatSurfaceConversation, chatSurfaceTools, chatSurfaceVoiceInstructions } from "@/lib/live/chat-surface";
import { siteChatCustomerForDataset } from "@/lib/demo/site-chat/customers";
import { leangenbuktaChatProfile } from "@/lib/demo/leangenbukta-chat/profile";
import { nyhavnaChatProfile } from "@/lib/demo/nyhavna-chat/profile";
import { MAP_TOOLS } from "@/lib/realtime/types";
import type { LiveConversation } from "@/lib/live/types";

describe("chatflatens stemme (uten kart)", () => {
  it("finnes bare for datasettene i chatboks-registeret", () => {
    expect(siteChatCustomerForDataset("leangenbukta-lokal")).toBe(leangenbuktaChatProfile);
    expect(siteChatCustomerForDataset("nyhavna-lokal")).toBe(nyhavnaChatProfile);
    expect(siteChatCustomerForDataset("nyhavna-leve")).toBeNull();
    expect(siteChatCustomerForDataset(undefined)).toBeNull();
  });

  it("tar stedsnavn og kontaktperson fra kundens profil", () => {
    const nh = chatSurfaceVoiceInstructions(nyhavnaChatProfile.voice);
    expect(nh).toContain("om Nyhavna og nabolaget rundt");
    expect(nh).toContain("bekrefter Nyhavna Utvikling");
    expect(nh).not.toContain("salgsteamet");
    expect(nh).toContain("Skill mellom det som finnes i dag og det som er planlagt");
    expect(chatSurfaceBackendAddendum(nyhavnaChatProfile.voice)).toContain("henvis til Nyhavna Utvikling.");
    const lb = chatSurfaceVoiceInstructions(leangenbuktaChatProfile.voice);
    expect(lb).toContain("om Leangenbukta og nabolaget rundt");
    expect(lb).toContain("bekrefter salgsteamet");
    expect(chatSurfaceBackendAddendum(leangenbuktaChatProfile.voice)).toContain("henvis til salgsteamet.");
    expect(chatSurfaceBackendAddendum(leangenbuktaChatProfile.voice)).not.toContain("{{");
  });

  it("tilbyr bare oppslag: ingen kart- eller presentasjonsverktøy av Leangenbuktas verktøy", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const names = chatSurfaceTools(demo.tools).map((tool) => tool.name);
    for (const name of MAP_TOOLS) expect(names).not.toContain(name);
    expect(names).not.toContain("present_neighbourhood");
    expect(names).not.toContain("reveal_more_places");
    expect(names).toEqual(expect.arrayContaining(["find_places", "get_place_facts", "find_project_info"]));
  });

  it("slipper aldri kartdirektiver eller kartinstrukser ut av den ekte Leangenbukta-samtalen", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const raw = demo.createConversation();
    const theme = demo.board.categories.map((c) => String(c.id)).find((id) => {
      const outcome = demo.createConversation().execute("open_theme", { theme_id: id });
      return !(outcome instanceof Promise) && (outcome.directives?.length ?? 0) > 0;
    });
    // Forutsetningen for testen: boardflaten sender faktisk kart for dette temaet.
    expect(theme).toBeTruthy();
    const chat = chatSurfaceConversation(raw);
    const outcome = await chat.execute("open_theme", { theme_id: theme! });
    expect(outcome.directives).toBeUndefined();
    expect(outcome.result).toHaveProperty("chapter");
    expect(outcome.result).not.toHaveProperty("instruction");
    expect(JSON.stringify(outcome.result)).not.toMatch(/Kartet fremhever|Kartkommandoer|highlight_places/);
    expect(chat.noteIfChanged()).toBeNull();
    expect(chat.mapContextIfChanged()).toBeNull();
    expect(chat.onMapSelection("theme", theme!)).toBeNull();
  });

  it("videresender vanlige oppslag uendret", async () => {
    const execute = vi.fn(async () => ({ result: { matches: 1, results: [{ text: "x" }] } }));
    const inner = { execute } as unknown as LiveConversation;
    const outcome = await chatSurfaceConversation(inner).execute("find_project_info", { query: "skole" });
    expect(execute).toHaveBeenCalledWith("find_project_info", { query: "skole" });
    expect(outcome).toEqual({ result: { matches: 1, results: [{ text: "x" }] } });
  });

  it("stemmeinstruksen sier ny samtale og ingen kart, uten boardets kartomvisning", () => {
    const text = chatSurfaceVoiceInstructions(leangenbuktaChatProfile.voice);
    expect(text).toContain("Dette er en ny samtale");
    expect(text).toContain("Det finnes ikke noe kart");
    expect(text).not.toContain("finne hvert sted i kartet");
  });
});
