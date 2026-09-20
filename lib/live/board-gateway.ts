import "server-only";

import type { NextRequest } from "next/server";
import { BOARD_ASSISTANT_COOKIE, verifyBoardCapability } from "@/lib/live/board-capability";
import { callAnjaService } from "@/lib/live/anja-service-client";

type GatewayError = { error: string; status: number };

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

export async function boardCapability(request: NextRequest): Promise<
  { capability: NonNullable<ReturnType<typeof verifyBoardCapability>> } | GatewayError
> {
  const capability = verifyBoardCapability(request.cookies.get(BOARD_ASSISTANT_COOKIE)?.value);
  if (!capability) return { error: "Samtalen er ikke aktiv. Start den på nytt.", status: 404 } as const;
  // Den autoritative, versjonsbundne kildekontrollen skjer i den langlivede
  // Anja-tjenesten før leverandørsesjonen opprettes. En signert capability er
  // beviset på at akkurat denne samtalen passerte kontrollen; å laste hele
  // 800+-punktsboardet på nytt for hvert context/map-kall ga sekunders venting.
  return { capability } as const;
}

export async function serviceJson(path: string, init: RequestInit, session?: string) {
  const response = await callAnjaService(path, init, session);
  const payload = await response.json().catch(() => ({ error: "Tjenesten er midlertidig utilgjengelig." }));
  return { response, payload };
}
