// Lenke-token for innsiktsrapporten. Rapporten ligger på en noindex-URL som
// bare er nåbar med riktig `?t=` — ingen innlogging, ingen brukerkonto: samme
// modell som en delt Google-Docs-lenke. Token = HMAC-SHA256(project_id,
// INSIGHT_REPORT_SECRET), forkortet. Bytt secreten → alle lenker dør.

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LEN = 24; // 96 bit — rikelig mot gjetting, kort nok for en lenke

export function insightToken(projectId: string, secret: string): string {
  return createHmac("sha256", secret).update(projectId).digest("hex").slice(0, TOKEN_LEN);
}

export function verifyInsightToken(
  projectId: string,
  candidate: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !candidate) return false;
  const expected = insightToken(projectId, secret);
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate, "utf8"), Buffer.from(expected, "utf8"));
}
