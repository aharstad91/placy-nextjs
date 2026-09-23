"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  issueLbDemoCookie,
  LB_DEMO_ACCESS_PATH,
  LB_DEMO_COOKIE,
  LB_DEMO_MAX_AGE_SECONDS,
  safeNextPath,
} from "@/lib/demo/leangenbukta-site/access";

/**
 * Bytter tilgangskoden mot demo-cookien.
 *
 * Koden sammenlignes på serveren i konstant tid; nettleseren ser aldri annet
 * enn cookien, som er httpOnly og bare gjelder dette domenet. Feil kode gir
 * samme side med en feilmelding, uten å si noe om hvorfor.
 */
export async function enterLeangenbuktaDemo(formData: FormData) {
  const code = formData.get("kode");
  const next = safeNextPath(typeof formData.get("neste") === "string" ? (formData.get("neste") as string) : null);
  const token = typeof code === "string" ? issueLbDemoCookie(code) : null;
  if (!token) redirect(`${LB_DEMO_ACCESS_PATH}?feil=1&neste=${encodeURIComponent(next)}`);

  const jar = await cookies();
  jar.set(LB_DEMO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LB_DEMO_MAX_AGE_SECONDS,
  });
  redirect(next);
}
