import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { lbDemoAccessFromHeaders, type LbDemoVisitor } from "@/lib/demo/leangenbukta-site/access";

/**
 * Forsvar i dybden for sidene i kundedemoen.
 *
 * Proxyen er gaten som sender til innlogging; denne kalles i tillegg fra
 * layout/side, slik at en side aldri rendres selv om proxyens matcher en dag
 * skulle endres. Uten tilgang: 404, som den gamle `NODE_ENV`-sperren.
 */
export async function requireLbDemoPageAccess(): Promise<LbDemoVisitor> {
  const h = await headers();
  const visitor = lbDemoAccessFromHeaders({ cookie: h.get("cookie"), host: h.get("host") });
  if (!visitor) notFound();
  return visitor;
}
