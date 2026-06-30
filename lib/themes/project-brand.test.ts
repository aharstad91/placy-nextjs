import { describe, expect, it } from "vitest";
import type { ProjectAssetFlags } from "@/lib/types";
import {
  getProjectLogoSrc,
  getProjectSplashImage,
  getProjectSplashVideo,
  getProjectBrokers,
  getProjectPinThumbnail,
} from "./project-brand";

// PRD 9 Unit 6 (r09.6): project-brand-modellen aktiverer nivå-2-overflaten via
// `assets`-flagg, ALDRI via reportTier — nivå-2 forkes ikke, den AKTIVERES av
// capability. Disse testene låser gate-betingelsene (assets-flagg-kombinasjoner)
// og verbatim slug-konvensjonen.

const SLUG = "stasjonskvartalet";
const brandOnly: ProjectAssetFlags = { brand: true };
const splashVideoOnly: ProjectAssetFlags = { splashVideo: true };
const pinOnly: ProjectAssetFlags = { pinThumbnail: true };

describe("getProjectLogoSrc", () => {
  it("returnerer slug-logo-stien når assets.brand er på", () => {
    expect(getProjectLogoSrc(SLUG, brandOnly)).toBe(
      "/illustrations/stasjonskvartalet-logo.svg",
    );
  });

  it("returnerer undefined uten brand-flagg (→ tekst-wordmark-fallback)", () => {
    expect(getProjectLogoSrc(SLUG, splashVideoOnly)).toBeUndefined();
    expect(getProjectLogoSrc(SLUG, undefined)).toBeUndefined();
    expect(getProjectLogoSrc(SLUG, {})).toBeUndefined();
  });

  it("returnerer undefined uten slug selv med brand-flagg", () => {
    expect(getProjectLogoSrc(undefined, brandOnly)).toBeUndefined();
  });
});

describe("getProjectSplashImage", () => {
  it("returnerer splash-hero-stien når assets.brand er på", () => {
    expect(getProjectSplashImage(SLUG, brandOnly)).toBe(
      "/illustrations/stasjonskvartalet-splash.jpg",
    );
  });

  it("returnerer undefined uten brand (→ home.heroImage-fallback uten tier-sjekk)", () => {
    expect(getProjectSplashImage(SLUG, splashVideoOnly)).toBeUndefined();
    expect(getProjectSplashImage(SLUG, undefined)).toBeUndefined();
    expect(getProjectSplashImage(undefined, brandOnly)).toBeUndefined();
  });
});

describe("getProjectSplashVideo (reels-video-gate)", () => {
  it("aktiveres av brand-flagget", () => {
    expect(getProjectSplashVideo(SLUG, brandOnly)).toBe(
      "/illustrations/stasjonskvartalet-splash-video.mp4",
    );
  });

  it("aktiveres også av splashVideo alene (levende splash uten logo/hero)", () => {
    expect(getProjectSplashVideo(SLUG, splashVideoOnly)).toBe(
      "/illustrations/stasjonskvartalet-splash-video.mp4",
    );
  });

  it("returnerer undefined når verken brand eller splashVideo er på", () => {
    expect(getProjectSplashVideo(SLUG, pinOnly)).toBeUndefined();
    expect(getProjectSplashVideo(SLUG, undefined)).toBeUndefined();
    expect(getProjectSplashVideo(undefined, brandOnly)).toBeUndefined();
  });
});

describe("getProjectBrokers", () => {
  it("returnerer demo-megler-fallback for kjent prosjekt", () => {
    const brokers = getProjectBrokers(SLUG);
    expect(brokers).toHaveLength(1);
    expect(brokers[0].name).toBe("Tonje Følstad");
    expect(brokers[0].officeName).toBe("DNB Eiendom");
  });

  it("returnerer tom liste for ukjent slug eller undefined", () => {
    expect(getProjectBrokers("ukjent-prosjekt")).toEqual([]);
    expect(getProjectBrokers(undefined)).toEqual([]);
  });
});

describe("getProjectPinThumbnail", () => {
  it("returnerer pin-thumbnail-data-URI når assets.pinThumbnail er på og slug finnes i tabellen", () => {
    const thumb = getProjectPinThumbnail(SLUG, pinOnly);
    expect(thumb).toBeDefined();
    expect(thumb).toMatch(/^data:/);
  });

  it("returnerer undefined uten pinThumbnail-flagg (→ bygnings-glyph-fallback)", () => {
    expect(getProjectPinThumbnail(SLUG, brandOnly)).toBeUndefined();
    expect(getProjectPinThumbnail(SLUG, undefined)).toBeUndefined();
    expect(getProjectPinThumbnail(undefined, pinOnly)).toBeUndefined();
  });

  it("returnerer undefined for slug uten registrert thumbnail selv med flagg", () => {
    expect(getProjectPinThumbnail("ukjent-prosjekt", pinOnly)).toBeUndefined();
  });
});
