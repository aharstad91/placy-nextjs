import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/utils/rate-limit";

const ALLOWED_HOSTS = ["mymaps.usercontent.google.com"];

// Audit-fiks 2026-07-06: samme timeout-konstant som directions/travel-times.
const UPSTREAM_TIMEOUT_MS = 8000;

// Audit-fiks 2026-07-06: per-IP-grense mot kvote-tapping — 60/min
// er romslig for legitim bruk men stopper enkel misbruk.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

// 10 MB — avvis store responser før arrayBuffer() trekker dem inn i minnet.
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
  if (!limiter.check(getClientIp(request.headers))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  try {
    // redirect: "manual" hindrer at fetch stille følger redirects til vilkårlige
    // verter uten re-validering mot allowlisten (SSRF-restfare). 30x-svar avvises.
    const response = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        { error: "upstream redirect not allowed" },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `upstream ${response.status}` },
        { status: 502 },
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "response too large" }, { status: 502 });
    }

    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "response too large" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=2592000",
        "CDN-Cache-Control": "public, max-age=2592000",
      },
    });
  } catch {
    return NextResponse.json({ error: "failed to fetch image" }, { status: 502 });
  }
}
