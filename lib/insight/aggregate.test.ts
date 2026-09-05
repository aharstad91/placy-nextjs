import { describe, it, expect } from "vitest";
import { aggregateInsight, osloDate, MIN_VIEWS_FOR_REPORT } from "./aggregate";
import { generateDemoEvents } from "./demo-data";
import type { InsightEventRow, InsightLabels } from "./types";

const LABELS: InsightLabels = {
  categories: [
    { id: "hverdagsliv", label: "Hverdagsliv" },
    { id: "barn-oppvekst", label: "Barn & oppvekst" },
    { id: "transport", label: "Transport" },
  ],
  pois: new Map([
    ["p1", { name: "Brøset skole", categoryId: "barn-oppvekst" }],
    ["p2", { name: "Rema 1000", categoryId: "hverdagsliv" }],
  ]),
  faq: new Map([["skolekrets", { question: "Hvilken skolekrets sogner boligen til?", categoryId: "barn-oppvekst" }]]),
};

const CTX = {
  mode: "report",
  has_3d_addon: true,
  categories_presented: ["hverdagsliv", "barn-oppvekst", "transport"],
  locale: "no",
  travel_mode: "walk",
};

const row = (
  event_type: InsightEventRow["event_type"],
  payload: Record<string, unknown> = {},
  poi_id: string | null = null,
  created_at = "2026-09-01T18:00:00.000Z",
): InsightEventRow => ({ event_type, poi_id, payload: { context: CTX, ...payload }, created_at });

const SINCE = new Date("2026-08-31T00:00:00Z");
const UNTIL = new Date("2026-09-02T00:00:00Z");

describe("aggregateInsight", () => {
  it("teller åpninger, kategorier med grunnlag og vist plassering", () => {
    const rows = [
      row("board_viewed"),
      row("board_viewed", { context: { ...CTX, source: "qr" } }),
      row("category_opened", { category_id: "barn-oppvekst" }),
      row("category_opened", { category_id: "barn-oppvekst" }),
      row("category_opened", { category_id: "hverdagsliv" }),
      row("poi_clicked", { category_id: "barn-oppvekst" }, "p1"),
      row("poi_explore_opened", { category_id: "barn-oppvekst", has_grounding: true }, "p1"),
      row("faq_opened", { faq_id: "skolekrets", category_id: "barn-oppvekst" }),
    ];
    const baseline = [
      row("category_opened", { category_id: "barn-oppvekst" }),
      row("category_opened", { category_id: "hverdagsliv" }),
      row("category_opened", { category_id: "transport" }),
      row("category_opened", { category_id: "transport" }),
    ];
    const r = aggregateInsight({ rows, baselineRows: baseline, labels: LABELS, since: SINCE, until: UNTIL, minViews: 1 });

    expect(r.views).toBe(2);
    expect(r.interactions).toBe(6);
    const barn = r.categories.find((c) => c.id === "barn-oppvekst")!;
    expect(barn.opens).toBe(2);
    expect(barn.share).toBeCloseTo(2 / 3);
    expect(barn.baselineShare).toBeCloseTo(0.25);
    expect(barn.deltaPp).toBeCloseTo(41.7, 0);
    expect(barn.presentedPosition).toBe(2);
    // Kategorier uten åpninger er med — negativ-rom er også signal.
    expect(r.categories.find((c) => c.id === "transport")!.opens).toBe(0);

    expect(r.pois[0]).toMatchObject({ id: "p1", name: "Brøset skole", clicks: 1, explores: 1, categoryLabel: "Barn & oppvekst" });
    expect(r.faq[0]).toMatchObject({ question: "Hvilken skolekrets sogner boligen til?", opens: 1 });
    expect(r.sources).toEqual([
      { source: "direkte", views: 1, share: 0.5, prevViews: 0 },
      { source: "qr", views: 1, share: 0.5, prevViews: 0 },
    ]);
    expect(r.threeDShare).toBe(1);
    expect(r.daily.map((d) => d.date)).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
    expect(r.window.days).toBe(3);
    expect(r.daily[1]).toEqual({ date: "2026-09-01", views: 2, interactions: 6 });
  });

  it("splitter rader på since: forrige periode gir grunnlag for endring", () => {
    const rows = [
      row("board_viewed", {}, null, "2026-08-29T12:00:00.000Z"), // forrige periode
      row("category_opened", { category_id: "transport" }, null, "2026-08-29T12:00:00.000Z"),
      row("board_viewed"),
      row("board_viewed"),
    ];
    const r = aggregateInsight({ rows, baselineRows: [], labels: LABELS, since: SINCE, until: UNTIL });
    expect(r.views).toBe(2);
    expect(r.previous.views).toBe(1);
    expect(r.previous.daily).toHaveLength(3);
    expect(r.window.days).toBe(3);
    expect(r.categories.find((c) => c.id === "transport")).toMatchObject({ opens: 0, prevOpens: 1 });
  });

  it("teller åpninger per time siste 24 t", () => {
    const until = new Date("2026-09-02T00:00:00Z");
    const rows = [
      row("board_viewed", {}, null, "2026-09-01T23:30:00.000Z"), // 0,5 t siden → siste bøtte
      row("board_viewed", {}, null, "2026-09-01T01:30:00.000Z"), // 22,5 t siden → bøtte 1
      row("board_viewed", {}, null, "2026-08-30T00:00:00.000Z"), // utenfor
    ];
    const r = aggregateInsight({ rows, baselineRows: [], labels: LABELS, since: SINCE, until });
    expect(r.hourly[23]).toBe(1);
    expect(r.hourly[1]).toBe(1);
    expect(r.hourly.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("holder tilbake lesninger under terskelen", () => {
    const r = aggregateInsight({ rows: [row("board_viewed")], baselineRows: [], labels: LABELS, since: SINCE, until: UNTIL });
    expect(r.threshold).toEqual({ minViews: MIN_VIEWS_FOR_REPORT, reached: false });
    expect(r.observations).toEqual([]);
    expect(r.actions).toEqual([]);
  });

  it("uten grunnlag er delta null, ikke 0", () => {
    const r = aggregateInsight({
      rows: [row("category_opened", { category_id: "transport" })],
      baselineRows: [],
      labels: LABELS,
      since: SINCE,
      until: UNTIL,
    });
    expect(r.categories[0].deltaPp).toBeNull();
    expect(r.categories[0].baselineShare).toBeNull();
  });

  it("konverterer til Oslo-dato", () => {
    expect(osloDate("2026-09-01T23:30:00.000Z")).toBe("2026-09-02");
  });
});

describe("demodata", () => {
  it("er deterministisk, holder seg i minnet og gir en lesbar rapport", () => {
    const since = new Date("2026-08-04T00:00:00Z");
    const until = new Date("2026-09-02T00:00:00Z");
    const a = generateDemoEvents({ labels: LABELS, since, until, baselineSince: new Date("2026-08-18T00:00:00Z") });
    const b = generateDemoEvents({ labels: LABELS, since, until, baselineSince: new Date("2026-08-18T00:00:00Z") });
    expect(a.rows.length).toBe(b.rows.length);
    expect(a.rows[0]).toEqual(b.rows[0]);

    const r = aggregateInsight({ ...a, labels: LABELS, since: new Date("2026-08-18T00:00:00Z"), until });
    expect(r.threshold.reached).toBe(true);
    expect(r.previous.views).toBeGreaterThan(0);
    expect(r.categories[0].id).toBe("barn-oppvekst");
    expect(r.categories[0].deltaPp).toBeGreaterThan(5);
    expect(r.observations.length).toBeGreaterThan(0);
    expect(r.actions.length).toBeGreaterThan(0);
    expect(r.sources.some((s) => s.source === "finn")).toBe(true);
  });
});
