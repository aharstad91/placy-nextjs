import { afterEach, describe, expect, it } from "vitest";
import { buildSwitcherOptions, insightHrefFor, type InsightCustomer } from "./projects";
import { insightToken } from "./token";

const SECRET = "test-secret";
const CUSTOMER: InsightCustomer = {
  id: "klp-eiendom",
  name: "KLP Eiendom",
  projects: [
    { id: "klp-eiendom_teknostallen", customerId: "klp-eiendom", slug: "teknostallen", name: "Teknostallen" },
    { id: "klp-eiendom_ferjemannsveien-10", customerId: "klp-eiendom", slug: "ferjemannsveien-10", name: "Ferjemannsveien 10" },
  ],
};

afterEach(() => {
  delete process.env.INSIGHT_REPORT_SECRET;
});

describe("insightHrefFor", () => {
  it("stempler lenken med prosjektets EGET token", () => {
    process.env.INSIGHT_REPORT_SECRET = SECRET;
    const href = insightHrefFor(CUSTOMER.projects[1], { demo: false });
    expect(href).toBe(
      `/eiendom/klp-eiendom/ferjemannsveien-10/innsikt?t=${insightToken("klp-eiendom_ferjemannsveien-10", SECRET)}`,
    );
  });

  it("tar med demo og vindu så konteksten overlever byttet", () => {
    process.env.INSIGHT_REPORT_SECRET = SECRET;
    const href = insightHrefFor(CUSTOMER.projects[0], { demo: true, dager: "90" });
    expect(href).toContain("demo=1");
    expect(href).toContain("dager=90");
  });

  it("gir null uten secret — da finnes det ingen gyldig lenke å tilby", () => {
    expect(insightHrefFor(CUSTOMER.projects[0], { demo: false })).toBeNull();
  });
});

describe("buildSwitcherOptions", () => {
  it("merker prosjektet du står på, og bare det", () => {
    process.env.INSIGHT_REPORT_SECRET = SECRET;
    const opts = buildSwitcherOptions(CUSTOMER, "klp-eiendom_teknostallen", { demo: false });
    expect(opts.map((o) => o.current)).toEqual([true, false]);
  });

  it("holder seg innenfor kunden: hver lenke peker på kundens egen sti", () => {
    process.env.INSIGHT_REPORT_SECRET = SECRET;
    const opts = buildSwitcherOptions(CUSTOMER, "klp-eiendom_teknostallen", { demo: false });
    expect(opts.every((o) => o.href.startsWith("/eiendom/klp-eiendom/"))).toBe(true);
  });

  it("uten kunde er det ingen velger", () => {
    expect(buildSwitcherOptions(null, "klp-eiendom_teknostallen", { demo: false })).toEqual([]);
  });

  it("uten secret står bare prosjektet du er på igjen, og det lenker ingensteds", () => {
    const opts = buildSwitcherOptions(CUSTOMER, "klp-eiendom_teknostallen", { demo: false });
    expect(opts).toEqual([{ project: CUSTOMER.projects[0], href: "#", current: true }]);
  });
});
