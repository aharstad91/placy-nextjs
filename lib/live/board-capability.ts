import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const BOARD_ASSISTANT_COOKIE = "placy_anja";
const MAX_AGE_SECONDS = 15 * 60;

const payloadSchema = z.object({
  session: z.string().uuid(),
  customer: z.string().min(1).max(120),
  projectSlug: z.string().min(1).max(160),
  contentVersion: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
});

export type BoardCapability = z.infer<typeof payloadSchema>;

function secret(): string {
  const value = process.env.ANJA_CAPABILITY_SECRET;
  if (!value || value.length < 32) {
    throw new Error("ANJA_CAPABILITY_SECRET må være minst 32 tegn.");
  }
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueBoardCapability(
  input: Omit<BoardCapability, "expiresAt">,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...input, expiresAt: now + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyBoardCapability(
  value: string | undefined,
  now = Date.now(),
): BoardCapability | null {
  if (!value) return null;
  const [payload, provided, extra] = value.split(".");
  if (!payload || !provided || extra) return null;
  const expected = signature(payload);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = payloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.expiresAt > now ? parsed : null;
  } catch {
    return null;
  }
}

export const boardCapabilityCookie = (value: string) => ({
  name: BOARD_ASSISTANT_COOKIE,
  value,
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/api/board-assistant",
  maxAge: MAX_AGE_SECONDS,
});
