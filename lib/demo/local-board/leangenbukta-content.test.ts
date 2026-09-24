import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { loadConversations, loadDataset } from "@/lib/demo/local-board/dataset";
import { getLocalDemo } from "@/lib/demo/local-board/registry";

const DEMO = getLocalDemo("leangenbukta-lokal");
const RESEARCH = "docs/research/leangenbukta-lokal-demo";
const CATEGORIES = ["natur", "transport", "hverdag", "oppvekst", "servering", "trening", "opplevelser"] as const;

type CandidateDecision = "start_set" | "member" | "topic_only" | "external_reference" | "defer" | "exclude";
type Candidate = {
  candidate_id: string;
  canonical_id: string;
  decision: CandidateDecision;
  approved_facts: string[];
  primary_source_urls: string[];
};
type CategoryPackage = { candidates: Candidate[]; buyer_questions: Array<{ question: string }> };
type AuditedClaim = { claim_id: string; status: string; approved_copy: string | null };
type ProjectPackage = { claims: AuditedClaim[] };
type CoordinateReceipt = {
  candidates: Array<{ candidate_id: string; error: string | null; results: unknown[] }>;
};
type TravelReceipt = {
  provider: string;
  origin: { coordinates: { lat: number; lng: number } };
  places: Array<{ place_id: string; minutes: { walk: number; bike: number; car: number } }>;
};

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function runtimeId(canonicalId: string): string {
  return canonicalId
    .split(":", 2)[1]
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function categoryPackages(): Promise<CategoryPackage[]> {
  return Promise.all(CATEGORIES.map(category => json<CategoryPackage>(`${RESEARCH}/categories/${category}.json`)));
}

describe("Leangenbukta: komplett revisjon og import", () => {
  it("har eksplisitt behandlet alle 145 kandidater og alle 35 kjøperspørsmål", async () => {
    const packages = await categoryPackages();
    const candidates = packages.flatMap(category => category.candidates);
    const counts = Object.fromEntries(
      ["start_set", "member", "topic_only", "external_reference", "defer", "exclude"].map(
        decision => [decision, candidates.filter(candidate => candidate.decision === decision).length],
      ),
    );

    expect(candidates).toHaveLength(145);
    expect(counts).toEqual({
      start_set: 26,
      member: 29,
      topic_only: 43,
      external_reference: 6,
      defer: 33,
      exclude: 8,
    });
    expect(packages.reduce((sum, category) => sum + category.buyer_questions.length, 0)).toBe(35);
  });

  it("importerer kandidatene, LadeTorget og de fire aktive byggetrinnene", async () => {
    const dataset = await loadDataset(DEMO);
    const candidates = (await categoryPackages()).flatMap(category => category.candidates);
    const selected = candidates.filter(candidate => candidate.decision === "start_set" || candidate.decision === "member");
    const auditedPlaces = dataset.places.filter(place => place.knowledgeLevel === "audited");
    const placeIds = new Set(auditedPlaces.map(place => place.id));

    expect(selected).toHaveLength(55);
    for (const candidate of selected) {
      expect(placeIds, `${candidate.candidate_id}: ${candidate.canonical_id}`).toContain(runtimeId(candidate.canonical_id));
    }
    expect(placeIds).toContain("ladetorget");
    expect(auditedPlaces).toHaveLength(60);
    expect(auditedPlaces.filter(place => !place.parentPlaceId)).toHaveLength(31);
    expect(auditedPlaces.filter(place => place.parentPlaceId)).toHaveLength(29);

    const selectedCanonicals = new Set(selected.map(candidate => candidate.canonical_id));
    const blockedOnly = candidates.filter(
      candidate => (candidate.decision === "defer" || candidate.decision === "exclude") && !selectedCanonicals.has(candidate.canonical_id),
    );
    for (const candidate of blockedOnly) {
      expect(placeIds, `${candidate.candidate_id}: ${candidate.canonical_id}`).not.toContain(runtimeId(candidate.canonical_id));
    }
  });

  it("representerer alle 124 godkjente prosjektpåstander og ingen ikke-godkjent kopi", async () => {
    const dataset = await loadDataset(DEMO);
    const project = await json<ProjectPackage>(`${RESEARCH}/audited/2026-09-18-project-facts-package.json`);
    const approved = project.claims.filter(
      claim => claim.approved_copy && (claim.status === "approved" || claim.status === "approved_time_sensitive"),
    );
    const notApprovedWithCopy = project.claims.filter(
      claim => claim.approved_copy && claim.status !== "approved" && claim.status !== "approved_time_sensitive",
    );
    const runtimeText = JSON.stringify(dataset.topics);

    expect(approved).toHaveLength(124);
    expect(notApprovedWithCopy).toEqual([]);
    for (const claim of approved) {
      expect(runtimeText, claim.claim_id).toContain(claim.approved_copy);
    }
  });

  it("beholder samtalescenariene som separat testgrunnlag", async () => {
    const dataset = await loadDataset(DEMO);
    const conversations = await loadConversations(DEMO);
    const questionCount = conversations.reduce((sum, conversation) => sum + conversation.questions.length, 0);

    expect(conversations).toHaveLength(7);
    expect(questionCount).toBe(35);
    expect(dataset).not.toHaveProperty("conversations");
    expect(JSON.stringify(dataset)).not.toContain("interruption-resume");
  });

  it("har koordinatkvittering for hvert importert kartobjekt og synlig presisjonsforbehold", async () => {
    const dataset = await loadDataset(DEMO);
    const receipt = await json<CoordinateReceipt>(`${RESEARCH}/place-coordinate-verification.json`);

    expect(receipt.candidates).toHaveLength(56);
    for (const check of receipt.candidates) {
      expect(check.error, check.candidate_id).toBeNull();
      expect(check.results.length, check.candidate_id).toBeGreaterThan(0);
    }
    for (const place of dataset.places.filter(place => place.knowledgeLevel === "audited")) {
      expect(place.sourceIds.length, place.id).toBeGreaterThan(0);
      if (place.locationPrecision === "approximate") {
        expect(place.locationNote, place.id).toMatch(/inngang|kartpunkt|plassering/i);
      }
    }

    const ladeMotor = dataset.places.find(place => place.id === "lade-motor");
    const fritidsklubb = dataset.places.find(place => place.id === "lade-fritidsklubb");
    expect(ladeMotor?.coordinates).toEqual(fritidsklubb?.coordinates);
    expect(ladeMotor?.parentPlaceId).toBe("lade-fritidsklubb");
  });

  it("bruker målte Mapbox-minutter fra prosjektpunktet for alle 27 reisetidsankre", async () => {
    const dataset = await loadDataset(DEMO);
    const receipt = await json<TravelReceipt>(`${RESEARCH}/travel-times.json`);
    const receiptById = new Map(receipt.places.map(place => [place.place_id, place.minutes]));
    const allTopLevel = dataset.places.filter(
      place => place.knowledgeLevel === "audited" && !place.parentPlaceId,
    );
    const topLevel = allTopLevel.filter(place => receiptById.has(place.id));
    const withoutTravelTime = allTopLevel
      .filter(place => !receiptById.has(place.id))
      .map(place => place.id)
      .sort();

    expect(receipt.provider).toBe("Mapbox Matrix API");
    expect(receipt.origin.coordinates).toEqual(dataset.board.center);
    expect(receipt.places).toHaveLength(27);
    expect(topLevel).toHaveLength(27);
    expect(withoutTravelTime).toEqual([
      "knutepunktet",
      "parktunet-1",
      "saltakshus-c",
      "saltakshus-h",
    ]);
    for (const place of topLevel) {
      expect(place.travelTime, place.id).toEqual(receiptById.get(place.id));
      expect(place.travelTime?.walk, place.id).toBeGreaterThan(0);
      expect(place.travelTime?.bike, place.id).toBeGreaterThan(0);
      expect(place.travelTime?.car, place.id).toBeGreaterThan(0);
    }
    expect(dataset.places.filter(place => place.knowledgeLevel === "audited" && place.parentPlaceId).every(place => place.travelTime === undefined)).toBe(true);
  });

  it("holder kjente feil og naboplanen ute av aktive kartobjekter", async () => {
    const dataset = await loadDataset(DEMO);
    const placeIds = new Set(dataset.places.map(place => place.id));

    expect(placeIds).not.toContain("fresh-fitness-lade-arena");
    expect(placeIds).not.toContain("leangenbukta-torget");
    expect(placeIds).not.toContain("leangen-bridge-elevator");
    expect(dataset.places.find(place => place.id === "lade-sfo")?.summary).toContain("07.15–16.30");
    expect(dataset.places.find(place => place.id === "leos-lekeland-trondheim")?.summary).toContain("09–20");
  });
});
