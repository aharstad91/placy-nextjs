import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentModeToggle } from "./AgentModeToggle";

afterEach(() => cleanup());

describe("AgentModeToggle", () => {
  it("rendrer to radio-alternativer i en radiogroup, med guidens navn i det andre", () => {
    render(<AgentModeToggle mode="explore" onChange={vi.fn()} name="Anja" />);
    const group = screen.getByRole("radiogroup");
    const options = screen.getAllByRole("radio");
    expect(group).toBeTruthy();
    expect(options).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Utforsk" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Spør Anja" })).toHaveAttribute("aria-checked", "false");
  });

  it("kun det valgte alternativet er i tab-rekkefølgen (roving tabindex)", () => {
    render(<AgentModeToggle mode="agent" onChange={vi.fn()} name="Anja" />);
    expect(screen.getByRole("radio", { name: "Utforsk" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "Spør Anja" })).toHaveAttribute("tabindex", "0");
  });

  it("klikk kaller onChange med det trykkede alternativet", () => {
    const onChange = vi.fn();
    render(<AgentModeToggle mode="explore" onChange={onChange} name="Anja" />);
    fireEvent.click(screen.getByRole("radio", { name: "Spør Anja" }));
    expect(onChange).toHaveBeenCalledWith("agent");
  });

  it("piltast høyre/venstre bytter valg og flytter fokus mellom alternativene", () => {
    const onChange = vi.fn();
    const { rerender } = render(<AgentModeToggle mode="explore" onChange={onChange} name="Anja" />);
    const first = screen.getByRole("radio", { name: "Utforsk" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("agent");
    rerender(<AgentModeToggle mode="agent" onChange={onChange} name="Anja" />);
    expect(screen.getByRole("radio", { name: "Spør Anja" })).toHaveFocus();

    const second = screen.getByRole("radio", { name: "Spør Anja" });
    fireEvent.keyDown(second, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("explore");
  });

  it("Enter/Space er knappens egen native oppførsel (ekte <button>)", () => {
    render(<AgentModeToggle mode="explore" onChange={vi.fn()} name="Anja" />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio) => expect(radio.tagName).toBe("BUTTON"));
  });

  it("en ny veksler tar imot fokuset når koordinatoren sier det, ellers ikke", () => {
    render(<AgentModeToggle mode="agent" onChange={vi.fn()} name="Anja" claimFocus={() => true} />);
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Spør Anja" }));
    cleanup();
    (document.activeElement as HTMLElement | null)?.blur();
    render(<AgentModeToggle mode="agent" onChange={vi.fn()} name="Anja" claimFocus={() => false} />);
    expect(document.activeElement).toBe(document.body);
  });
});
