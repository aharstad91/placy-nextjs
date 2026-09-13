import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * Gaten for demoens rutefiler: bare loopback, og i produksjonsbygg bare når
 * `PLACY_LOCAL_REALTIME_DEMO=1`. Ligger utenfor route.ts fordi Next bare
 * tillater HTTP-metodene og konfigurasjonsfeltene som eksporter der.
 */
export function localRequest(request: NextRequest) {
  let url: URL;
  try { url = new URL(`${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`); } catch { return false; }
  const enabled = process.env.NODE_ENV !== 'production' || process.env.PLACY_LOCAL_REALTIME_DEMO === '1';
  return enabled && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && (!request.headers.get('origin') || request.headers.get('origin') === url.origin);
}
