/**
 * Delt PATCH-med-optimistisk-lås for build-scripts (curate-narrative +
 * audio-tour-build). Ekstrahert fra de to identiske inline-blokkene
 * (audit-bead whp) slik at de bærende invariantene er EKSEKVERBART testet:
 *
 *   1. Låsen: PATCH-en filtrerer på `updated_at=eq.<lest verdi>` — en
 *      concurrent write gir 0 rader, aldri stille overskriving.
 *   2. Sekvensen: revalidate kalles KUN etter vellykket PATCH (>0 rader) —
 *      aldri ved HTTP-feil, aldri ved 0-rader.
 *
 * Kallerne (CLI-scriptene) eier exit-koder og console-meldinger; denne
 * modulen returnerer et diskriminert resultat og kaster aldri på
 * forretnings-utfall.
 */

export interface PatchWithLockInput {
  supabaseUrl: string;
  supabaseKey: string;
  productId: string;
  /** updated_at slik den ble LEST — optimistisk lås. */
  updatedAt: string;
  config: unknown;
  /** Injiserbar for tester; default global fetch. */
  fetchImpl?: typeof fetch;
}

export type PatchWithLockResult =
  | { ok: true; rows: number }
  | { ok: false; reason: "http"; status: number; body: string }
  | { ok: false; reason: "zero-rows" };

export async function patchProductConfigWithLock(
  input: PatchWithLockInput
): Promise<PatchWithLockResult> {
  const doFetch = input.fetchImpl ?? fetch;

  const patchUrl = new URL(`${input.supabaseUrl}/rest/v1/products`);
  patchUrl.searchParams.set("id", `eq.${input.productId}`);
  patchUrl.searchParams.set("updated_at", `eq.${input.updatedAt}`);

  const patchRes = await doFetch(patchUrl.toString(), {
    method: "PATCH",
    headers: {
      apikey: input.supabaseKey,
      Authorization: `Bearer ${input.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ config: input.config }),
  });

  if (!patchRes.ok) {
    const body = await patchRes.text();
    return { ok: false, reason: "http", status: patchRes.status, body };
  }

  const patched = (await patchRes.json()) as unknown[];
  if (!Array.isArray(patched) || patched.length === 0) {
    return { ok: false, reason: "zero-rows" };
  }
  return { ok: true, rows: patched.length };
}

/**
 * PATCH → revalidate-sekvensen: revalidate kjøres KUN når PATCH-en lyktes.
 * Revalidate-feil svelges IKKE her — kalleren sender en funksjon som selv
 * eier sin fail-soft-håndtering (begge scripts warner uten å abortere).
 */
export async function patchThenRevalidate(
  input: PatchWithLockInput & { revalidate: () => Promise<void> }
): Promise<PatchWithLockResult> {
  const result = await patchProductConfigWithLock(input);
  if (result.ok) {
    await input.revalidate();
  }
  return result;
}
