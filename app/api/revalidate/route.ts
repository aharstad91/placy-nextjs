import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Build-time revalidation hook kalt av scripts/gemini-grounding.ts etter
 * vellykket PATCH.
 *
 * Usage:
 *   GET /api/revalidate?tag=product:{id}&secret=<REVALIDATE_SECRET>
 *
 * Secret sammenlignes konstant-tid for å unngå timing-leks.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag");
  const secret = url.searchParams.get("secret");

  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { revalidated: false, error: "REVALIDATE_SECRET not configured" },
      { status: 500 },
    );
  }
  if (!secret || !safeCompare(secret, expected)) {
    return NextResponse.json(
      { revalidated: false, error: "Invalid secret" },
      { status: 401 },
    );
  }
  if (!tag) {
    return NextResponse.json(
      { revalidated: false, error: "Missing tag" },
      { status: 400 },
    );
  }

  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
