import { describe, it, expect } from "vitest";
import {
  audioFilename,
  audioRelPath,
  audioAbsPath,
} from "./storage-paths";

describe("audioFilename", () => {
  it('home → "hjem.mp3"', () => {
    expect(audioFilename("home")).toBe("hjem.mp3");
  });
  it('andre spor → "{key}.mp3"', () => {
    expect(audioFilename("mat-drikke")).toBe("mat-drikke.mp3");
    expect(audioFilename("transport")).toBe("transport.mp3");
  });
});

describe("audioRelPath", () => {
  it("home", () => {
    expect(audioRelPath("stasjonskvartalet", "home")).toBe(
      "/audio/stasjonskvartalet/hjem.mp3",
    );
  });
  it("kategori", () => {
    expect(audioRelPath("stasjonskvartalet", "mat-drikke")).toBe(
      "/audio/stasjonskvartalet/mat-drikke.mp3",
    );
  });
});

describe("audioAbsPath", () => {
  it("returnerer absolutt path mot public/audio/{slug}/{file}.mp3", () => {
    const p = audioAbsPath("stasjonskvartalet", "home");
    expect(p.endsWith("/public/audio/stasjonskvartalet/hjem.mp3")).toBe(true);
    expect(p.startsWith("/")).toBe(true);
  });
});
