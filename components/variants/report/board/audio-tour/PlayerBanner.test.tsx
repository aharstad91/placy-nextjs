import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { BoardProvider } from "../board-state";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardData,
} from "../board-data";
import { useAudioTourStore, type AudioTrack } from "@/lib/stores/audio-tour-store";
import { PlayerBanner } from "./PlayerBanner";
import { StartTourButton } from "./StartTourButton";
import { AudioElementContext } from "./use-audio-element";

afterEach(() => {
  cleanup();
  act(() => {
    useAudioTourStore.getState().close();
  });
});

function makeCategory(over: Partial<BoardCategory> = {}): BoardCategory {
  return {
    id: "mat-drikke" as BoardCategoryId,
    label: "Mat & drikke",
    lead: "",
    body: "",
    icon: "Utensils",
    color: "#a16207",
    pois: [],
    illustration: { src: "/illustrations/mat-drikke.jpg", width: 1, height: 1 },
    ...over,
  };
}

function makeBoardData(over: Partial<BoardData> = {}): BoardData {
  return {
    home: {
      name: "StasjonsKvartalet",
      coordinates: { lat: 63.4, lng: 10.4 },
      address: "Brattørkaia",
      heroImage: "/illustrations/sk-hero.jpg",
      audio: { url: "/audio/sk/hjem.mp3", manus: "hjem-manus" },
    },
    categories: [
      makeCategory({
        id: "mat-drikke" as BoardCategoryId,
        audio: { url: "/audio/sk/mat-drikke.mp3", manus: "mat-manus" },
      }),
      makeCategory({
        id: "transport" as BoardCategoryId,
        label: "Transport",
        color: "#0e7490",
        audio: { url: "/audio/sk/transport.mp3", manus: "transport-manus" },
      }),
    ],
    poisById: new Map(),
    audioTourEnabled: true,
    ...over,
  };
}

const TRACKS: AudioTrack[] = [
  { categoryId: "home", url: "/audio/sk/hjem.mp3", manus: "h" },
  { categoryId: "mat-drikke" as BoardCategoryId, url: "/audio/sk/mat-drikke.mp3", manus: "m" },
  { categoryId: "transport" as BoardCategoryId, url: "/audio/sk/transport.mp3", manus: "t" },
];

function renderBanner(data: BoardData = makeBoardData(), audio = { currentTime: 0, duration: 60 }) {
  return render(
    <BoardProvider data={data}>
      <AudioElementContext.Provider value={audio}>
        <PlayerBanner />
      </AudioElementContext.Provider>
    </BoardProvider>,
  );
}

describe("PlayerBanner", () => {
  it("returnerer null når phase=idle", () => {
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("viser '1/3 — Nabolaget' når tour starter på Hjem-sporet", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
    });
    renderBanner();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("Nabolaget")).toBeInTheDocument();
  });

  it("viser kategori-label når track-index peker på kategori-track", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
      useAudioTourStore.getState().goToTrack(1);
    });
    renderBanner();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Mat & drikke")).toBeInTheDocument();
  });

  it("disabler 'Forrige' på første spor og 'Neste' på siste spor", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
    });
    renderBanner();
    expect(screen.getByLabelText("Forrige spor")).toBeDisabled();
    expect(screen.getByLabelText("Neste spor")).not.toBeDisabled();

    act(() => {
      useAudioTourStore.getState().goToTrack(2);
    });
    expect(screen.getByLabelText("Forrige spor")).not.toBeDisabled();
    expect(screen.getByLabelText("Neste spor")).toBeDisabled();
  });

  it("Neste-knapp kaller store.next()", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
    });
    renderBanner();
    fireEvent.click(screen.getByLabelText("Neste spor"));
    expect(useAudioTourStore.getState().trackIndex).toBe(1);
  });

  it("Pause-knapp setter phase=paused med reason=manual", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
    });
    renderBanner();
    fireEvent.click(screen.getByLabelText("Pause"));
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("paused");
    expect(s.pauseReason).toBe("manual");
  });

  it("viser 'Fortsett tour' når pauseReason=category-clicked", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
      useAudioTourStore.getState().pause("category-clicked");
    });
    renderBanner();
    expect(screen.getByText("Fortsett tour")).toBeInTheDocument();
    expect(screen.queryByLabelText("Spill av")).not.toBeInTheDocument();
  });

  it("viser 'Prøv igjen' når phase=error", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
      useAudioTourStore.getState().setError();
    });
    renderBanner();
    expect(screen.getByText("Prøv igjen")).toBeInTheDocument();
    expect(screen.getByText("Lyd-feil")).toBeInTheDocument();
  });

  it("Avslutt-knapp kaller close() og resetter store", () => {
    act(() => {
      useAudioTourStore.getState().start(TRACKS);
    });
    renderBanner();
    fireEvent.click(screen.getByLabelText("Avslutt tour"));
    expect(useAudioTourStore.getState().phase).toBe("idle");
  });
});

describe("StartTourButton", () => {
  function renderStart(data: BoardData) {
    return render(
      <BoardProvider data={data}>
        <StartTourButton />
      </BoardProvider>,
    );
  }

  it("returnerer null når home.audio mangler", () => {
    const data = makeBoardData();
    const { container } = renderStart({
      ...data,
      home: { ...data.home, audio: undefined },
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("returnerer null når én kategori mangler audio", () => {
    const data = makeBoardData();
    const { container } = renderStart({
      ...data,
      categories: [
        data.categories[0],
        { ...data.categories[1], audio: undefined },
      ],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renderes og starter tour med home + alle kategorier", () => {
    renderStart(makeBoardData());
    expect(screen.getByText(/Start tour/)).toBeInTheDocument();
    expect(screen.getByText(/3 spor/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    const s = useAudioTourStore.getState();
    expect(s.phase).toBe("playing");
    expect(s.tracks).toHaveLength(3);
    expect(s.tracks[0].categoryId).toBe("home");
    expect(s.tracks[1].categoryId).toBe("mat-drikke");
    expect(s.tracks[2].categoryId).toBe("transport");
  });
});
