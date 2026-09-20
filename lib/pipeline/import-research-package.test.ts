import { describe, expect, it, vi } from "vitest";
import {
  importResearchPackage,
  prepareResearchImportPayload,
  type ResearchImportRpc,
} from "@/lib/pipeline/import-research-package";
import type { Json } from "@/lib/supabase/types";

function input() {
  return {
    schemaVersion: 1,
    packageId: "leangenbukta-2026-09-18",
    projectId: "kunde_leangenbukta",
    projectName: "Leangenbukta",
    mode: "full_snapshot",
    scopeKey: "leangenbukta:project-facts",
    reviewedAt: "2026-09-18",
    sourcePath: "docs/research/package.json",
    entities: [
      {
        entityId: "topic:barnehage",
        canonicalId: "topic:barnehage",
        name: "Planlagt barnehage",
        entityKind: "topic",
        scope: "project",
        geography: "Leangenbukta",
        reusableAcrossBoards: false,
        reuseConstraints: "Prosjektspesifikt",
        boardId: null,
        mappingStatus: "not_applicable",
      },
    ],
    claims: [
      {
        claimId: "LB-1",
        subjectId: "topic:barnehage",
        canonicalId: "topic:barnehage",
        scope: "project",
        geography: "Leangenbukta",
        field: "status",
        value: "Regulert, ikke vedtatt bygget",
        temporalKind: "regulated",
        reviewStatus: "approved",
        sourceUrls: ["https://example.com/plan"],
        sourceTitles: ["Vedtatt plan"],
        sourceType: "municipal_plan",
        sourceDate: "2019-01-31",
        observedAt: "2026-09-18",
        validFrom: null,
        validUntil: null,
        confidence: "high",
        conflictNotes: null,
        editorialNote: null,
        approvedCopy: "Barnehagetomten er regulert, men bygging er ikke vedtatt.",
        reason: null,
        reusableAcrossBoards: false,
        reuseConstraints: "Prosjektspesifikt",
        boardId: null,
        mappingStatus: "not_applicable",
      },
    ],
  };
}

describe("importResearchPackage", () => {
  it("normalizes the reviewed package to the snake-case RPC contract", () => {
    const payload = prepareResearchImportPayload(input()) as Record<string, Json>;

    expect(payload.package_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.package_mode).toBe("full_snapshot");
    expect(payload.scope_key).toBe("leangenbukta:project-facts");
    expect(payload.entities).toEqual([
      expect.objectContaining({
        entity_id: "topic:barnehage",
        mapping_status: "not_applicable",
        mapped_poi_id: null,
      }),
    ]);
    expect(payload.claims).toEqual([
      expect.objectContaining({
        claim_id: "LB-1",
        review_status: "approved",
        temporal_kind: "regulated",
        valid_until: null,
      }),
    ]);
  });

  it("uses exactly one RPC call and returns its import receipt", async () => {
    const rpc = vi.fn<ResearchImportRpc>().mockResolvedValue({
      data: {
        status: "imported",
        package_hash: "a".repeat(64),
        entities: 1,
        claims: 1,
      },
      error: null,
    });

    await expect(importResearchPackage(input(), rpc)).resolves.toEqual({
      status: "imported",
      package_hash: "a".repeat(64),
      entities: 1,
      claims: 1,
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("surfaces the transaction error instead of returning a partial receipt", async () => {
    const rpc = vi.fn<ResearchImportRpc>().mockResolvedValue({
      data: null,
      error: { message: "foreign key violation" },
    });

    await expect(importResearchPackage(input(), rpc)).rejects.toThrow(
      "Researchimport feilet: foreign key violation",
    );
  });
});

