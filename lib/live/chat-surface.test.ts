import { describe, expect, it, vi } from "vitest";
import { loadLiveDemo } from "@/lib/live/demos";
import { CHAT_SURFACE_BACKEND_ADDENDUM, chatSurfaceAllowed, chatSurfaceBackendAddendum, chatSurfaceConversation, chatSurfaceTools, chatSurfaceVoiceInstructions } from "@/lib/live/chat-surface";
import { MAP_TOOLS } from "@/lib/realtime/types";
import type { LiveConversation } from "@/lib/live/types";

describe("chatflatens stemme (uten kart)", () => {
  it("gjelder bare nettsidekopienes datasett (Leangenbukta og Nyhavna)", () => {
    expect(chatSurfaceAllowed("leangenbukta-lokal")).toBe(true);
    expect(chatSurfaceAllowed("nyhavna-lokal")).toBe(true);
    expect(chatSurfaceAllowed("nyhavna-leve")).toBe(false);
    expect(chatSurfaceAllowed(undefined)).toBe(false);
  });

  it("henviser Nyhavnas stemme til Nyhavna Utvikling, ikke et salgsteam, og holder Leangenbukta uendret", async () => {
    const nyhavna = await loadLiveDemo("nyhavna-lokal");
    const leangenbukta = await loadLiveDemo("leangenbukta-lokal");
    const nh = chatSurfaceVoiceInstructions(nyhavna);
    expect(nh).toContain("om Nyhavna og nabolaget rundt");
    expect(nh).toContain("bekrefter Nyhavna Utvikling");
    expect(nh).not.toContain("salgsteamet");
    expect(nh).toContain("Skill mellom det som finnes i dag og det som er planlagt");
    expect(chatSurfaceBackendAddendum(nyhavna)).toContain("henvis til Nyhavna Utvikling");
    expect(chatSurfaceVoiceInstructions(leangenbukta)).toContain("bekrefter salgsteamet");
    expect(chatSurfaceBackendAddendum(leangenbukta)).toBe(CHAT_SURFACE_BACKEND_ADDENDUM);
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

  it("stemmeinstruksen sier ny samtale og ingen kart, uten boardets kartomvisning", async () => {
    const demo = await loadLiveDemo("leangenbukta-lokal");
    const text = chatSurfaceVoiceInstructions(demo);
    expect(text).toContain("Dette er en ny samtale");
    expect(text).toContain("Det finnes ikke noe kart");
    expect(text).not.toContain("finne hvert sted i kartet");
  });
});
