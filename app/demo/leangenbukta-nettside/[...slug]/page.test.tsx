import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import manifest from "@/data/demo/leangenbukta-nettside/pages.json";

/**
 * Ruta for de kopierte Leangenbukta-sidene (`/demo/leangenbukta-nettside/[...slug]`).
 *
 * Fragmentene rendres med de ekte filene (ikke stubbet): det som faktisk
 * verifiseres er at registeret (`pages.json`) styrer hvilke slugger som
 * finnes, at forsiden (håndskrevet egen rute) aldri kan nås herfra, og at
 * Placy-feltet settes inn med riktig spørsmål for siden.
 */

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFoundMock() }));

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img data-next-image="" src={props.src} alt={props.alt} width={props.width} height={props.height} />
  ),
}));

import LeangenbuktaSitePage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/demo/leangenbukta-nettside/[...slug]/page";

function params(slug: string[]) {
  return Promise.resolve({ slug });
}

describe("/demo/leangenbukta-nettside/[...slug]", () => {
  it("rendrer en kjent byggside med Placy-feltet og side-ID-markøren", async () => {
    notFoundMock.mockClear();
    const { container, getByRole } = render(await LeangenbuktaSitePage({ params: params(["knutepunktet"]) }));

    const heading = getByRole("heading", { level: 3 });
    expect(heading.textContent).toContain("Knutepunktet");

    const chatButton = container.querySelector("[data-placy-chat-open]") as HTMLButtonElement | null;
    expect(chatButton).not.toBeNull();
    expect(chatButton?.getAttribute("data-placy-chat-question")).toBe("Hva finnes rundt Knutepunktet?");

    const marker = container.querySelector("[data-placy-page-id]") as HTMLElement | null;
    expect(marker?.getAttribute("data-placy-page-id")).toBe("knutepunktet");
    expect(marker?.hidden).toBe(true);

    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("kaller notFound for en ukjent slug", async () => {
    notFoundMock.mockClear();
    await expect(LeangenbuktaSitePage({ params: params(["finnes-ikke"]) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("kaller notFound for forsidens håndskrevne rute, selv om siden finnes i registeret", async () => {
    notFoundMock.mockClear();
    // Forsiden har `path: ""` i registeret og har sin egen håndskrevne rute;
    // denne fangst-alt-ruta skal aldri kunne rendre den.
    await expect(LeangenbuktaSitePage({ params: params([]) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("generateStaticParams returnerer alle sider i registeret unntatt forsiden", () => {
    const expectedIds = manifest.pages.filter((page) => page.id !== "forside").map((page) => page.id);
    const params = generateStaticParams();
    expect(params).toHaveLength(expectedIds.length);
    expect(params.some((entry) => entry.slug.join("/") === "")).toBe(false);

    const knutepunktetParam = params.find((entry) => entry.slug[0] === "knutepunktet");
    expect(knutepunktetParam?.slug).toEqual(["knutepunktet"]);

    // Ingen forside blant slugger, og alle andre registerte sider er med.
    const producedIds = manifest.pages
      .filter((page) => page.id !== "forside")
      .filter((page) =>
        params.some((entry) => `/${entry.slug.join("/")}` === page.path),
      );
    expect(producedIds).toHaveLength(expectedIds.length);
  });

  it("generateMetadata setter noindex/nofollow for en kjent side", async () => {
    const metadata = await generateMetadata({ params: params(["knutepunktet"]) });
    expect(metadata.title).toBe("Knutepunktet – Leangenbukta");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("generateMetadata returnerer tom metadata for en ukjent slug", async () => {
    const metadata = await generateMetadata({ params: params(["finnes-ikke"]) });
    expect(metadata).toEqual({});
  });
});
