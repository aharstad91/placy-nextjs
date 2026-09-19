import "server-only";

import type { NextRequest } from "next/server";
import { BOARD_ASSISTANT_COOKIE, verifyBoardCapability } from "@/lib/live/board-capability";
import { callAnjaService } from "@/lib/live/anja-service-client";
import { loadProductionAssistantSource } from "@/lib/live/production-board";

type ProductionSource = NonNullable<Awaited<ReturnType<typeof loadProductionAssistantSource>>>;
type GatewayError = { error: string; status: number };

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

export async function boardSource(
  customer: string,
  projectSlug: string,
  contentVersion: string,
): Promise<{ source: ProductionSource } | GatewayError> {
  const source = await loadProductionAssistantSource(customer, projectSlug);
  if (!source) return { error: "Assistenten er ikke aktivert for dette boardet.", status: 404 } as const;
  if (source.contentVersion !== contentVersion) {
    return { error: "Datagrunnlaget er oppdatert. Last boardet på nytt.", status: 409 } as const;
  }
  return { source } as const;
}

export async function boardCapability(request: NextRequest): Promise<
  { capability: NonNullable<ReturnType<typeof verifyBoardCapability>>; source: ProductionSource } | GatewayError
> {
  const capability = verifyBoardCapability(request.cookies.get(BOARD_ASSISTANT_COOKIE)?.value);
  if (!capability) return { error: "Samtalen er ikke aktiv. Start den på nytt.", status: 404 } as const;
  const checked = await boardSource(capability.customer, capability.projectSlug, capability.contentVersion);
  if ("error" in checked) return checked;
  return { capability, source: checked.source } as const;
}

export async function serviceJson(path: string, init: RequestInit, session?: string) {
  const response = await callAnjaService(path, init, session);
  const payload = await response.json().catch(() => ({ error: "Tjenesten er midlertidig utilgjengelig." }));
  return { response, payload };
}
