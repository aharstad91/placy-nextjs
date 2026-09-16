import { NextRequest, NextResponse } from 'next/server';
import { DEMO_ACCESS_COOKIE, DEMO_ACCESS_MAX_AGE, hostedVoiceEnabled, issueDemoAccess, sameOrigin } from '@/lib/live/hosted-access';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!hostedVoiceEnabled()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get('content-length')) > 2048) return new NextResponse(null, { status: 413 });
  const text = await request.text();
  if (text.length > 2048) return new NextResponse(null, { status: 413 });
  const token = issueDemoAccess(new URLSearchParams(text).get('code') ?? '');
  const destination = new URL('/demo/nyhavna-lokal', request.url);
  if (!token) destination.searchParams.set('access', 'failed');
  const response = NextResponse.redirect(destination, 303);
  response.headers.set('Cache-Control', 'no-store');
  if (token) response.cookies.set(DEMO_ACCESS_COOKIE, token, {
    httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: DEMO_ACCESS_MAX_AGE,
  });
  return response;
}
