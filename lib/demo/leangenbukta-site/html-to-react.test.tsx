import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderSiteFragment } from "@/lib/demo/leangenbukta-site/html-to-react";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string; width: number; height: number }) => <img data-next-image="" src={props.src} alt={props.alt} width={props.width} height={props.height} />,
}));

function mount(html: string, slots = {}) {
  return render(<div data-testid="root">{renderSiteFragment(html, slots)}</div>).getByTestId("root");
}

describe("renderSiteFragment", () => {
  it("rendrer aldri kjørbart innhold, selv om fragmentet skulle inneholde det", () => {
    const root = mount(
      `<div onclick="alert(1)" class="a"><script>alert(1)</script><iframe src="https://evil.example"></iframe>
       <form action="https://evil.example"><input name="x"></form><style>body{}</style>
       <a href="javascript:alert(1)">farlig</a><p style="background:url(https://evil.example/x.png);color:red">tekst</p></div>`,
    );
    expect(root.querySelector("script, iframe, form, style")).toBeNull();
    expect(root.querySelector("[onclick]")).toBeNull();
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toContain("farlig");
    const p = root.querySelector("p")!;
    expect(p.style.color).toBe("red");
    expect(p.style.background).toBe("");
  });

  it("gjør lokale bilder til next/image og dropper bilder uten lokal kilde eller mål", () => {
    const root = mount(
      `<img src="/demo/leangenbukta-nettside/pages/a.jpg" alt="Tunet" width="800" height="600" class="img-with-animation">
       <img src="https://leangenbukta.no/b.jpg" width="10" height="10"><img src="/demo/x.jpg">`,
    );
    const images = root.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("data-next-image")).toBe("");
    expect(images[0].getAttribute("alt")).toBe("Tunet");
  });

  it("setter Placy-feltet inn på plassholderen og beholder lenketypene", () => {
    const root = mount(
      `<a href="/demo/leangenbukta-nettside/knutepunktet">Lokal</a>
       <a href="https://leangenbukta.plyo.cloud/" data-demo-external="true" target="_blank" rel="noopener noreferrer">Boligvelger</a>
       <div data-placy-slot="building"></div><div data-placy-slot="ukjent"></div>`,
      { building: <section data-testid="placy">Placy</section> },
    );
    expect(root.querySelector("[data-testid=placy]")).not.toBeNull();
    expect(root.querySelector("[data-placy-slot]")).toBeNull();
    const [local, external] = [...root.querySelectorAll("a")];
    expect(local.getAttribute("href")).toBe("/demo/leangenbukta-nettside/knutepunktet");
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
