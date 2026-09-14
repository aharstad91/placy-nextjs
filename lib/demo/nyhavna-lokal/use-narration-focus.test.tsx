import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mentionedPlace, useNarrationFocus } from "@/lib/demo/nyhavna-lokal/use-narration-focus";
import type { LiveMessage, LiveStatus } from "@/lib/live/types";

const places = [{ id: "a", name: "MENY Solsiden" }, { id: "b", name: "KIWI Lilleby" }];
describe("narration place focus", () => {
  it("recognizes complete names across accumulated fragments and chooses the latest", () => {
    expect(mentionedPlace("MENY Sol", places)).toBeNull();
    expect(mentionedPlace("MENY Solsiden er nær. KIWI Lilleby er et alternativ.", places)).toBe("b");
    expect(mentionedPlace("Dora Kaffebar", [{ id: "stop", name: "Dora" }, { id: "cafe", name: "Dora Kaffebar" }])).toBe("cafe");
  });
  it("does not advance from silent text, or from user interruptions, and clears on stop", () => {
    const onFocus = vi.fn();
    const { rerender } = renderHook(({ status, messages }: { status: LiveStatus; messages: LiveMessage[] }) => useNarrationFocus(true, places, status, messages, onFocus), {
      initialProps: { status: "thinking" as LiveStatus, messages: [{ id: "1", role: "assistant" as LiveMessage["role"], text: "MENY Solsiden" }] },
    });
    expect(onFocus).not.toHaveBeenCalled();
    rerender({ status: "speaking", messages: [{ id: "1", role: "assistant", text: "MENY Solsiden" }] });
    expect(onFocus).toHaveBeenLastCalledWith("a");
    rerender({ status: "speaking", messages: [{ id: "2", role: "user", text: "Vent, hva med KIWI Lilleby?" }] });
    expect(onFocus).toHaveBeenLastCalledWith(null);
    rerender({ status: "speaking", messages: [{ id: "3", role: "assistant", text: "MENY Solsiden" }] });
    expect(onFocus).toHaveBeenLastCalledWith("a");
    rerender({ status: "listening", messages: [{ id: "3", role: "assistant", text: "MENY Solsiden" }] });
    expect(onFocus).toHaveBeenLastCalledWith(null);
    rerender({ status: "idle", messages: [] });
    expect(onFocus).toHaveBeenLastCalledWith(null);
  });
});
