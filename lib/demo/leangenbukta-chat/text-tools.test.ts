import { describe, expect, it } from "vitest";
import { textChatTools } from "@/lib/demo/leangenbukta-chat/text-tools";
import { conversationTools } from "@/lib/realtime/nyhavna-conversation";
import { presentationTool, similarPlacesTool, morePlacesTool } from "@/lib/demo/local-board/presentation";
import { NYHAVNA_LABELS } from "@/lib/realtime/conversation-labels";

describe("leangenbukta-chat/text-tools", () => {
  const fullToolset = [...conversationTools(NYHAVNA_LABELS), presentationTool, similarPlacesTool, morePlacesTool];

  it("fjerner nettleser-utførte karttverktøy", () => {
    const names = textChatTools(fullToolset).map((t) => t.name);
    expect(names).not.toEqual(expect.arrayContaining(["show_category", "show_place", "set_travel_mode", "reset_board", "highlight_places", "clear_highlights"]));
  });

  it("fjerner presentasjonens tre kartstyrte verktøy", () => {
    const names = textChatTools(fullToolset).map((t) => t.name);
    expect(names).not.toContain("present_neighbourhood");
    expect(names).not.toContain("find_similar_places");
    expect(names).not.toContain("reveal_more_places");
  });

  it("beholder kunnskaps- og omvisningsverktøyene", () => {
    const names = textChatTools(fullToolset).map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(["find_places", "get_place_facts", "get_place_address", "get_board_facts", "set_interests", "open_theme", "note_detour", "return_to_tour", "find_project_info"]),
    );
  });
});
