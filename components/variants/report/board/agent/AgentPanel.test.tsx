import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentPanel } from "./AgentPanel";
import type { AgentEntry, AgentSuggestion } from "@/lib/board-agent/types";

afterEach(() => cleanup());

const baseProps = {
  name: "Anja",
  suggestions: [] as AgentSuggestion[],
  input: "write" as const,
  onInputChange: vi.fn(),
  onSend: vi.fn(),
  onSuggestion: vi.fn(),
  onDismissSuggestions: vi.fn(),
  onPlaceFocus: vi.fn(),
  busy: false,
  emptyTitle: "Spør om Nyhavna",
  emptyBody: "Anja svarer med det vi vet om nabolaget.",
  variant: "column" as const,
};

const suggestions: AgentSuggestion[] = [
  { key: "s1", kind: "faq", faqId: "kaffe", label: "Hvor finner jeg kaffe?" },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof AgentPanel>> = {}) {
  return render(<AgentPanel {...baseProps} entries={[]} {...overrides} />);
}

describe("AgentPanel — tom tilstand", () => {
  it("viser tittel og hjelpetekst, og forslag som chips når de finnes", () => {
    renderPanel({ suggestions });
    expect(screen.getByText("Spør om Nyhavna")).toBeTruthy();
    expect(screen.getByText("Anja svarer med det vi vet om nabolaget.")).toBeTruthy();
    expect(screen.getAllByTestId("agent-suggestion")).toHaveLength(1);
  });

  it("uten forslag vises ingen chips", () => {
    renderPanel();
    expect(screen.queryAllByTestId("agent-suggestion")).toHaveLength(0);
  });
});

describe("AgentPanel — alle innslagstyper rendres", () => {
  const entries: AgentEntry[] = [
    { id: "u1", kind: "user", text: "Hvor er nærmeste barnehage?", via: "text" },
    { id: "u2", kind: "user", text: "Sagt med stemmen", via: "voice" },
    {
      id: "a1",
      kind: "assistant",
      text: "Nyhavna barnehage ligger fem minutter unna.",
      via: "text",
      sources: [{ id: "src1", label: "nyhavna.no", page: "Barnehager", checkedAt: "2026-09-01T10:00:00Z" }],
      links: [{ id: "lnk1", label: "Se barnehagen", href: "https://nyhavna.no/barnehage" }],
      notice: "Svaret ble avbrutt før det var ferdig.",
    },
    { id: "p1", kind: "place", poiId: "dora-kaffebar", name: "Dora Kaffebar", categoryLabel: "Kafé", origin: "map" },
    { id: "f1", kind: "faq", faqId: "kaffe", question: "Hvor finner jeg kaffe?" },
    { id: "t1", kind: "theme", categoryId: "mat", label: "Kafé og servering" },
    { id: "pend", kind: "pending", forEntryId: "a2" },
    { id: "st1", kind: "status", tone: "error", text: "Noe gikk galt. Prøv igjen." },
    { id: "st2", kind: "status", tone: "info", text: "Samtalen fortsetter fra tidligere." },
  ];

  it("rendrer bruker-, assistent-, steds-, FAQ-, tema-, pending- og statusinnslag", () => {
    renderPanel({ entries });
    expect(screen.getByText("Hvor er nærmeste barnehage?")).toBeTruthy();
    expect(screen.getByText("Sagt med stemmen")).toBeTruthy();
    expect(screen.getByText("Nyhavna barnehage ligger fem minutter unna.")).toBeTruthy();
    expect(screen.getByText(/Kilde: nyhavna\.no/)).toBeTruthy();
    expect(screen.getByText("Se barnehagen")).toHaveAttribute("href", "https://nyhavna.no/barnehage");
    expect(screen.getByText("Svaret ble avbrutt før det var ferdig.")).toBeTruthy();
    expect(screen.getByTestId("agent-place-entry")).toHaveTextContent("Dora Kaffebar");
    expect(screen.getByTestId("agent-place-entry")).toHaveTextContent("Kafé");
    expect(screen.getByText("Hvor finner jeg kaffe?")).toBeTruthy();
    expect(screen.getByText("Kafé og servering")).toBeTruthy();
    expect(screen.getByTestId("agent-pending")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("Noe gikk galt");
    expect(screen.getByText("Samtalen fortsetter fra tidligere.")).toBeTruthy();
  });

  it("stedskort kaller onPlaceFocus med POI-id ved trykk", () => {
    const onPlaceFocus = vi.fn();
    renderPanel({ entries, onPlaceFocus });
    fireEvent.click(screen.getByTestId("agent-place-entry"));
    expect(onPlaceFocus).toHaveBeenCalledWith("dora-kaffebar");
  });

  it("lang tekst og lange URL-er brytes i stedet for å overflyte (break-words)", () => {
    const longWord = "a".repeat(220);
    const longEntries: AgentEntry[] = [
      { id: "u-long", kind: "user", text: longWord, via: "text" },
      {
        id: "a-long",
        kind: "assistant",
        text: "Se lenken under",
        via: "text",
        links: [{ id: "lnk-long", label: `https://nyhavna.no/${"b".repeat(200)}`, href: "https://nyhavna.no/x" }],
      },
    ];
    renderPanel({ entries: longEntries });
    const userBubble = screen.getByText(longWord);
    expect(userBubble.className).toMatch(/break-words/);
    const link = screen.getByRole("link");
    expect(link.className).toMatch(/break-words/);
  });
});

describe("AgentPanel — forslag", () => {
  it("klikk på et forslag kaller onSuggestion, og avvis kaller onDismissSuggestions", () => {
    const onSuggestion = vi.fn();
    const onDismissSuggestions = vi.fn();
    const entries: AgentEntry[] = [{ id: "a1", kind: "assistant", text: "Svar", via: "text" }];
    renderPanel({ entries, suggestions, onSuggestion, onDismissSuggestions });
    fireEvent.click(screen.getByTestId("agent-suggestion"));
    expect(onSuggestion).toHaveBeenCalledWith(suggestions[0]);
    fireEvent.click(screen.getByTestId("agent-suggestions-dismiss"));
    expect(onDismissSuggestions).toHaveBeenCalledOnce();
  });
});

describe("AgentPanel — composer", () => {
  it("Enter sender, Shift+Enter lager ny linje uten å sende", () => {
    const onSend = vi.fn();
    renderPanel({ onSend });
    const textarea = screen.getByTestId("agent-composer-input");
    fireEvent.change(textarea, { target: { value: "Hvor er butikken?" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Hvor er butikken?");
  });

  it("tom eller whitespace-tekst sendes ikke, verken via Enter eller sendeknappen", () => {
    const onSend = vi.fn();
    renderPanel({ onSend });
    const textarea = screen.getByTestId("agent-composer-input");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId("agent-composer-send")).toBeDisabled();
    fireEvent.click(screen.getByTestId("agent-composer-send"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("busy blokkerer send, men skriving er fortsatt tillatt", () => {
    const onSend = vi.fn();
    renderPanel({ onSend, busy: true });
    const textarea = screen.getByTestId("agent-composer-input");
    fireEvent.change(textarea, { target: { value: "Er dette mulig?" } });
    expect(textarea).toHaveValue("Er dette mulig?");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId("agent-composer-send")).toBeDisabled();
  });

  it("felt tømmes og beholder fokus etter sending", () => {
    const onSend = vi.fn();
    renderPanel({ onSend });
    const textarea = screen.getByTestId("agent-composer-input") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Send meg" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("");
    expect(textarea).toHaveFocus();
  });

  it("Skriv/Snakk-bytte kaller onInputChange, og voiceSlot vises kun i Snakk", () => {
    const onInputChange = vi.fn();
    const { rerender } = render(
      <AgentPanel {...baseProps} entries={[]} onInputChange={onInputChange} voiceSlot={<div>Stemmestatus</div>} />,
    );
    expect(screen.queryByTestId("agent-voice-slot")).toBeNull();
    fireEvent.click(screen.getByTestId("agent-input-talk"));
    expect(onInputChange).toHaveBeenCalledWith("talk");

    rerender(
      <AgentPanel
        {...baseProps}
        entries={[]}
        input="talk"
        onInputChange={onInputChange}
        voiceSlot={<div>Stemmestatus</div>}
      />,
    );
    expect(screen.getByTestId("agent-voice-slot")).toHaveTextContent("Stemmestatus");

    fireEvent.click(screen.getByTestId("agent-input-write"));
    expect(onInputChange).toHaveBeenCalledWith("write");
  });
});

describe("AgentPanel — loggen følger samtalen (review #1)", () => {
  it("følger med når svaret erstatter «svar på vei» og når talen vokser, uten at antallet endres", () => {
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
    try {
      const pending: AgentEntry[] = [{ id: "u1", kind: "user", text: "Hei", via: "text" }, { id: "w1", kind: "pending", forEntryId: "u1" }];
      const view = renderPanel({ entries: pending });
      scrollTo.mockClear();
      const answered: AgentEntry[] = [pending[0], { id: "a1", kind: "assistant", text: "Hei!", via: "text" }];
      view.rerender(<AgentPanel {...baseProps} entries={answered} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      const grown: AgentEntry[] = [pending[0], { id: "a1", kind: "assistant", text: "Hei! Nyhavna er en bydel under utvikling.", via: "voice" }];
      view.rerender(<AgentPanel {...baseProps} entries={grown} />);
      expect(scrollTo).toHaveBeenCalledTimes(2);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "auto" }));
    } finally {
      HTMLElement.prototype.scrollTo = original;
    }
  });
});
