import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFaqProgress } from "@/lib/demo/nyhavna-lokal/use-faq-progress";
import type { LiveMessage, LiveStatus } from "@/lib/live/types";

afterEach(() => vi.useRealTimers());
const user: LiveMessage = { id: "u", role: "user", text: "Hvor er skolen?" };
const answer: LiveMessage = { id: "a", role: "assistant", text: "Lilleby er aktuell." };
function mount() {
  return renderHook(({ status, messages }: { status: LiveStatus; messages: LiveMessage[] }) =>
    useFaqProgress(["skole", "mat"], status, messages),
    { initialProps: { status: "listening" as LiveStatus, messages: [user] } });
}
describe("FAQ-framdrift", () => {
  it("markerer et åpnet tekstsvar og lar det nullstilles", () => {
    const { result } = mount();
    act(() => result.current.read("skole"));
    expect(result.current.explored.has("skole")).toBe(true);
    act(() => result.current.reset());
    expect(result.current.explored.size).toBe(0);
  });
  it("venter på tale og ro etter et bekreftet kartkall", () => {
    vi.useFakeTimers();
    const { result, rerender } = mount();
    act(() => result.current.queue(["skole", "unknown"]));
    expect(result.current.active.has("skole")).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.explored.size).toBe(0);
    rerender({ status: "speaking", messages: [user, answer] });
    rerender({ status: "listening", messages: [user, answer] });
    act(() => vi.advanceTimersByTime(1200));
    expect([...result.current.explored]).toEqual(["skole"]);
  });
  it("beholder samme spørsmål når et sent transkriptfragment kommer", () => {
    vi.useFakeTimers();
    const { result, rerender } = mount();
    act(() => result.current.queue(["skole"]));
    const completedUser = { ...user, text: "Hvor er skolen, og hvor langt er det?" };
    rerender({ status: "thinking", messages: [completedUser] });
    expect(result.current.active.has("skole")).toBe(true);
    rerender({ status: "speaking", messages: [completedUser, answer] });
    rerender({ status: "listening", messages: [completedUser, answer] });
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.explored.has("skole")).toBe(true);
  });
  it("venter videre hvis stemmen fortsetter etter en kort pause", () => {
    vi.useFakeTimers();
    const { result, rerender } = mount();
    act(() => result.current.queue(["skole"]));
    rerender({ status: "speaking", messages: [user, answer] });
    rerender({ status: "listening", messages: [user, answer] });
    act(() => vi.advanceTimersByTime(1000));
    rerender({ status: "speaking", messages: [user, answer] });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.explored.size).toBe(0);
    rerender({ status: "listening", messages: [user, answer] });
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.explored.has("skole")).toBe(true);
  });
  it("ignorerer et sent kartresultat etter feil, men tillater et nytt spørsmål", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ status, interruptionVersion, messages }: { status: LiveStatus; interruptionVersion: number; messages: LiveMessage[] }) =>
      useFaqProgress(["skole"], status, messages, interruptionVersion),
      { initialProps: { status: "speaking" as LiveStatus, interruptionVersion: 0, messages: [user, answer] } });
    rerender({ status: "speaking", interruptionVersion: 1, messages: [user, answer] });
    act(() => result.current.queue(["skole"]));
    expect(result.current.active.size).toBe(0);
    rerender({ status: "listening", interruptionVersion: 1, messages: [user, answer] });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.explored.size).toBe(0);
    const nextUser = { ...user, id: "next" };
    rerender({ status: "thinking", interruptionVersion: 1, messages: [user, answer, nextUser] });
    act(() => result.current.queue(["skole"]));
    expect(result.current.active.has("skole")).toBe(true);
    rerender({ status: "speaking", interruptionVersion: 1, messages: [nextUser, answer] });
    rerender({ status: "listening", interruptionVersion: 1, messages: [nextUser, answer] });
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.explored.has("skole")).toBe(true);
  });
  it("avviser et delvis svar ved gjentatte feil uten at forbindelsen avsluttes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ status, interruptionVersion }: { status: LiveStatus; interruptionVersion: number }) =>
      useFaqProgress(["skole"], status, [user, answer], interruptionVersion),
      { initialProps: { status: "speaking" as LiveStatus, interruptionVersion: 0 } });
    for (const interruptionVersion of [1, 2]) {
      act(() => result.current.queue(["skole"]));
      rerender({ status: "listening", interruptionVersion });
      act(() => vi.advanceTimersByTime(2000));
      expect(result.current.explored.size).toBe(0);
      expect(result.current.active.size).toBe(0);
      rerender({ status: "speaking", interruptionVersion });
    }
  });
  it("markerer ikke avbrutt tale eller tilkoblingsfeil som utforsket", () => {
    vi.useFakeTimers();
    const { result, rerender } = mount();
    act(() => result.current.queue(["skole"]));
    rerender({ status: "speaking", messages: [user, answer] });
    rerender({ status: "listening", messages: [user, answer, { id: "u2", role: "user", text: "Vent" }] });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.explored.size).toBe(0);
    act(() => result.current.queue(["mat"]));
    rerender({ status: "error", messages: [user] });
    expect(result.current.active.size).toBe(0);
  });
});
