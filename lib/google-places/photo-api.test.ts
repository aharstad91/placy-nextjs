import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPhotoNames, resolvePhotoUri, isNewPhotoFormat } from "./photo-api";
import { PlacesApiError, isQuotaError } from "./errors";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("fetchPhotoNames", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bruker header-auth og photos-feltmasken ($0 Essentials-nivå)", async () => {
    const fetchSpy = mockFetch(200, { photos: [{ name: "places/X/photos/a" }] });
    vi.stubGlobal("fetch", fetchSpy);

    const names = await fetchPhotoNames("ChIJxyz", "hemmelig");

    const [url, init] = (fetchSpy as unknown as { mock: { calls: [string, RequestInit & { headers: Record<string, string> }][] } }).mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJxyz");
    expect(url).not.toContain("key=");
    expect(init.headers["X-Goog-Api-Key"]).toBe("hemmelig");
    expect(init.headers["X-Goog-FieldMask"]).toBe("photos");
    expect(names).toEqual(["places/X/photos/a"]);
  });

  it("ugyldig place-ID-form gir tom liste uten nettverkskall", async () => {
    const fetchSpy = mockFetch(200, {});
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchPhotoNames("ChIJ/../evil", "k")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("404 → tom liste (stedet finnes ikke)", async () => {
    vi.stubGlobal("fetch", mockFetch(404, {}));
    expect(await fetchPhotoNames("ChIJ", "k")).toEqual([]);
  });

  it("403/429/500 → kaster PlacesApiError med status", async () => {
    for (const status of [403, 429, 500]) {
      vi.stubGlobal("fetch", mockFetch(status, {}));
      const err = await fetchPhotoNames("ChIJ", "k").catch((e) => e);
      expect(err).toBeInstanceOf(PlacesApiError);
      expect((err as PlacesApiError).status).toBe(status);
    }
  });
});

describe("resolvePhotoUri", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolver til lh3-CDN-URL via skipHttpRedirect", async () => {
    const fetchSpy = mockFetch(200, { photoUri: "https://lh3.googleusercontent.com/abc" });
    vi.stubGlobal("fetch", fetchSpy);

    const url = await resolvePhotoUri("places/X/photos/a", "hemmelig", 800);

    const [reqUrl, init] = (fetchSpy as unknown as { mock: { calls: [string, RequestInit & { headers: Record<string, string> }][] } }).mock.calls[0];
    expect(reqUrl).toBe(
      "https://places.googleapis.com/v1/places/X/photos/a/media?maxWidthPx=800&skipHttpRedirect=true",
    );
    expect(reqUrl).not.toContain("key=");
    expect(init.headers["X-Goog-Api-Key"]).toBe("hemmelig");
    expect(url).toBe("https://lh3.googleusercontent.com/abc");
  });

  it("404 → null (bildet finnes genuint ikke lenger, kaller kan nulle ut)", async () => {
    vi.stubGlobal("fetch", mockFetch(404, {}));
    expect(await resolvePhotoUri("places/X/photos/a", "k")).toBeNull();
  });

  /**
   * REGRESJONSVERN mot datatap (funnet 2026-08-12):
   * funksjonen returnerte tidligere null på ALLE ≠ok-statuser. Kallerne
   * (`refresh-photo-urls.ts`, `resolve-photo-urls.ts`) tolker null som «bildet
   * er borte» og NULLER UT photo_reference/featured_image/photo_resolved_at.
   * En forbigående 429 slettet altså bilde-data permanent.
   */
  it("429/403/500 → kaster i stedet for null, så kallere ikke sletter bilde-data", async () => {
    for (const status of [403, 429, 500]) {
      vi.stubGlobal("fetch", mockFetch(status, {}));
      const err = await resolvePhotoUri("places/X/photos/a", "k").catch((e) => e);
      expect(err, `status ${status} må kaste, ikke returnere null`).toBeInstanceOf(PlacesApiError);
      expect((err as PlacesApiError).status).toBe(status);
    }
  });

  it("kvotefeil er gjenkjennelig som kvotefeil (403/429), 500 er ikke", async () => {
    vi.stubGlobal("fetch", mockFetch(429, {}));
    expect(isQuotaError(await resolvePhotoUri("places/X/photos/a", "k").catch((e) => e))).toBe(true);
    vi.stubGlobal("fetch", mockFetch(500, {}));
    expect(isQuotaError(await resolvePhotoUri("places/X/photos/a", "k").catch((e) => e))).toBe(false);
  });

  it("200 uten photoUri → null", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {}));
    expect(await resolvePhotoUri("places/X/photos/a", "k")).toBeNull();
  });
});

describe("isNewPhotoFormat", () => {
  it("skiller nytt format fra legacy opak referanse", () => {
    expect(isNewPhotoFormat("places/ChIJabc/photos/AUc-def")).toBe(true);
    expect(isNewPhotoFormat("AUc_opak_legacy_referanse")).toBe(false);
  });
});
