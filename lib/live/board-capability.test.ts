import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  boardCapabilityCookie,
  issueBoardCapability,
  verifyBoardCapability,
} from "@/lib/live/board-capability";

describe("board assistant capability", () => {
  beforeEach(() => {
    process.env.ANJA_CAPABILITY_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  });
  afterEach(() => delete process.env.ANJA_CAPABILITY_SECRET);

  it("binder en kortlivet capability til prosjekt og innholdsversjon", () => {
    const token = issueBoardCapability(
      {
        session: "11111111-1111-4111-8111-111111111111",
        customer: "kunde",
        projectSlug: "prosjekt",
        contentVersion: "a".repeat(64),
      },
      1_000,
    );
    expect(verifyBoardCapability(token, 2_000)).toMatchObject({
      customer: "kunde",
      projectSlug: "prosjekt",
      contentVersion: "a".repeat(64),
    });
    expect(verifyBoardCapability(token, 1_000 + 15 * 60_000 + 1)).toBeNull();
    expect(verifyBoardCapability(`${token.slice(0, -1)}x`, 2_000)).toBeNull();
  });

  it("gir nettleseren bare en HttpOnly Secure-cookie", () => {
    expect(boardCapabilityCookie("signed")).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/board-assistant",
    });
  });
});
