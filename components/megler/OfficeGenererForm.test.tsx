import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OfficeGenererForm from "./OfficeGenererForm";

/**
 * Kontrakt-vakter for Unit 1-formen (R3/R4/R5): kontornavn som avsender, INGEN
 * meglerkontor-fritekstfelt, POST bærer officeSlug (ikke navn), og
 * outside_coverage → CoverageStop med notify-opt-in (den eksplisitte andre
 * opt-in-en som re-poster med notifyWhenCovered).
 */

// AddressAutocomplete-stub: én knapp som velger en fast adresse via onSelect.
vi.mock("@/components/inputs/AddressAutocomplete", () => ({
  default: ({ onSelect }: { onSelect: (r: unknown) => void }) => (
    <button
      type="button"
      data-testid="pick-address"
      onClick={() =>
        onSelect({
          address: "Testvegen 12, 7030 Trondheim",
          lat: 63.4,
          lng: 10.4,
          city: "Trondheim",
        })
      }
    >
      pick
    </button>
  ),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function fillForm() {
  fireEvent.click(screen.getByTestId("pick-address"));
  fireEvent.change(screen.getByLabelText("E-postadresse"), {
    target: { value: "megler@example.com" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("OfficeGenererForm", () => {
  it("viser kontornavnet som avsender og har INGEN meglerkontor-fritekstfelt", () => {
    render(<OfficeGenererForm officeSlug="dnb-x" officeName="DNB Midtbyen" />);
    expect(screen.getByText("DNB Midtbyen")).toBeInTheDocument();
    expect(screen.queryByLabelText(/meglerkontor/i)).not.toBeInTheDocument();
  });

  it("submit poster officeSlug (ikke navn) og adressen, uten brokerage-felt", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "req-1",
        status: "pending",
        url: "/eiendom/dnb-midtbyen/testvegen-12/rapport-board",
      }),
    });

    render(<OfficeGenererForm officeSlug="dnb-x" officeName="DNB Midtbyen" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Lag nabolagskart" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/generation-requests");
    const body = JSON.parse((opts as { body: string }).body);
    expect(body.officeSlug).toBe("dnb-x");
    expect(body.address).toBe("Testvegen 12, 7030 Trondheim");
    expect(body.consentGiven).toBe(true);
    expect(body).not.toHaveProperty("brokerage");

    await waitFor(() =>
      expect(screen.getByText("Forespørsel mottatt!")).toBeInTheDocument()
    );
  });

  it("outside_coverage → CoverageStop med dekningsliste; notify re-poster med notifyWhenCovered", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "outside_coverage",
        place: "Melhus",
        coveredAreas: ["Ranheim", "Tyholt"],
      }),
    });

    render(<OfficeGenererForm officeSlug="dnb-x" officeName="DNB Midtbyen" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Lag nabolagskart" }));

    await waitFor(() =>
      expect(screen.getByText(/Vi dekker ikke Melhus ennå/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Ranheim, Tyholt/)).toBeInTheDocument();

    // Andre opt-in: re-post med notifyWhenCovered=true
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    fireEvent.click(
      screen.getByRole("button", { name: /Varsle meg når Melhus dekkes/ })
    );

    await waitFor(() => expect(screen.getByText(/Takk!/)).toBeInTheDocument());
    const notifyCall = fetchMock.mock.calls[1];
    const notifyBody = JSON.parse((notifyCall[1] as { body: string }).body);
    expect(notifyBody.notifyWhenCovered).toBe(true);
    expect(notifyBody.officeSlug).toBe("dnb-x");
  });

  it("!ok-respons → viser feilmelding, ingen bekreftelse", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server misconfigured" }),
    });

    render(<OfficeGenererForm officeSlug="dnb-x" officeName="DNB Midtbyen" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Lag nabolagskart" }));

    await waitFor(() =>
      expect(screen.getByText("Server misconfigured")).toBeInTheDocument()
    );
    expect(screen.queryByText("Forespørsel mottatt!")).not.toBeInTheDocument();
  });
});
