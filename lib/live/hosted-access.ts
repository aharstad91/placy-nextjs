import 'server-only';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const DEMO_ACCESS_COOKIE = 'placy_demo_access';
export const DEMO_ACCESS_MAX_AGE = 14 * 24 * 60 * 60;
export interface DemoAccess { role: 'demo' | 'benchmark'; visitorId: string; expiresAt: number; version: string }

export function hostedVoiceEnabled() {
  return process.env.PLACY_HOSTED_VOICE === 'true';
}
function signingKey() {
  const key = process.env.PLACY_DEMO_COOKIE_SECRET;
  return hostedVoiceEnabled() && key && key.length >= 32 ? key : null;
}
export function constantTimeEqual(a: string, b: string) {
  const first = createHash('sha256').update(a).digest();
  const second = createHash('sha256').update(b).digest();
  return timingSafeEqual(first, second);
}
function accessCode(role: DemoAccess['role']) {
  return role === 'benchmark' ? process.env.PLACY_BENCHMARK_ACCESS_CODE : process.env.PLACY_DEMO_ACCESS_CODE;
}
function version(code: string) { return createHash('sha256').update(code).digest('hex'); }

export function issueDemoAccess(code: string, now = Date.now()): string | null {
  const key = signingKey();
  if (!key || !code || code.length > 256) return null;
  const role = (['demo', 'benchmark'] as const).find(candidate => {
    const expected = accessCode(candidate);
    return expected && expected.length >= 16 && constantTimeEqual(code, expected);
  });
  if (!role) return null;
  const payload: DemoAccess = { role, visitorId: randomUUID(), expiresAt: now + DEMO_ACCESS_MAX_AGE * 1000, version: version(accessCode(role)!) };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

export function verifyDemoAccess(token: string | undefined, now = Date.now()): DemoAccess | null {
  const key = signingKey();
  if (!key || !token || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !constantTimeEqual(parts[1], createHmac('sha256', key).update(parts[0]).digest('base64url'))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as DemoAccess;
    if (value.role !== 'demo' && value.role !== 'benchmark') return null;
    const code = accessCode(value.role);
    if (!code || value.version !== version(code) || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + DEMO_ACCESS_MAX_AGE * 1000 || typeof value.visitorId !== 'string') return null;
    return value;
  } catch { return null; }
}

export function requestDemoAccess(request: Request, now = Date.now()): DemoAccess | null {
  if (!hostedVoiceEnabled()) return null;
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${DEMO_ACCESS_COOKIE}=`))?.slice(DEMO_ACCESS_COOKIE.length + 1);
  // Shared demo links need no login. Only a signed cookie can grant the
  // separate benchmark role; paid admission remains controlled by the ledger.
  return verifyDemoAccess(token, now) ?? {
    role: 'demo', visitorId: randomUUID(), expiresAt: now + DEMO_ACCESS_MAX_AGE * 1000, version: 'public-demo-v1',
  };
}

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function hasHostedAccess(request: Request, now = Date.now()) {
  return sameOrigin(request) && requestDemoAccess(request, now) !== null;
}
