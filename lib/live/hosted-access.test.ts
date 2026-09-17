import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueDemoAccess, verifyDemoAccess, requestDemoAccess, hasHostedAccess, DEMO_ACCESS_COOKIE } from '@/lib/live/hosted-access';

afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv('PLACY_HOSTED_VOICE', 'true');
  vi.stubEnv('PLACY_DEMO_ACCESS_CODE', 'a-demo-code-with-enough-entropy');
  vi.stubEnv('PLACY_DEMO_COOKIE_SECRET', 'a-signing-key-with-at-least-32-characters');
}
describe('hosted demo access', () => {
  it('opens ordinary demo access without cookies while preserving origin and shutdown checks', () => {
    configure();
    vi.stubEnv('PLACY_DEMO_ACCESS_CODE', '');
    const request = new Request('https://demo.example/api/live/control', { headers: { origin: 'https://demo.example' } });
    expect(requestDemoAccess(request)?.role).toBe('demo');
    expect(hasHostedAccess(request)).toBe(true);
    expect(hasHostedAccess(new Request(request.url))).toBe(false);
    expect(hasHostedAccess(new Request(request.url, { headers: { origin: 'https://other.example' } }))).toBe(false);
    vi.stubEnv('PLACY_HOSTED_VOICE', 'false');
    expect(requestDemoAccess(request)).toBeNull();
    expect(hasHostedAccess(request)).toBe(false);
  });
  it('does not let an unsigned or expired benchmark cookie elevate public demo access', () => {
    configure();
    vi.stubEnv('PLACY_BENCHMARK_ACCESS_CODE', 'separate-test-code');
    const token = issueDemoAccess('separate-test-code', 1000)!;
    const request = (cookie: string) => new Request('https://demo.example', { headers: { cookie: `${DEMO_ACCESS_COOKIE}=${cookie}` } });
    expect(requestDemoAccess(request(token), 1001)?.role).toBe('benchmark');
    expect(requestDemoAccess(request(token + 'tampered'), 1001)?.role).toBe('demo');
    expect(requestDemoAccess(request(token), 1000 + 15 * 86400000)?.role).toBe('demo');
  });
  it('accepts an issued cookie only for same-origin requests', () => {
    configure();
    const token = issueDemoAccess('a-demo-code-with-enough-entropy', 1000)!;
    expect(verifyDemoAccess(token, 1001)?.role).toBe('demo');
    const headers = new Headers({ cookie: `${DEMO_ACCESS_COOKIE}=${token}`, origin: 'https://demo.example' });
    expect(hasHostedAccess(new Request('https://demo.example/api/live', { headers }), 1001)).toBe(true);
    headers.set('origin', 'https://attacker.example');
    expect(hasHostedAccess(new Request('https://demo.example/api/live', { headers }), 1001)).toBe(false);
  });
  it('denies wrong codes, altered and expired cookies, missing origin and disabled hosting', () => {
    configure();
    expect(issueDemoAccess('wrong', 1000)).toBeNull();
    const token = issueDemoAccess('a-demo-code-with-enough-entropy', 1000)!;
    expect(verifyDemoAccess(token + 'a', 1001)).toBeNull();
    expect(verifyDemoAccess(token, 1000 + 15 * 86400000)).toBeNull();
    expect(hasHostedAccess(new Request('https://demo.example', { headers: { cookie: `${DEMO_ACCESS_COOKIE}=${token}` } }), 1001)).toBe(false);
    vi.stubEnv('PLACY_HOSTED_VOICE', 'false');
    expect(verifyDemoAccess(token, 1001)).toBeNull();
  });
  it('revokes cookies when the code rotates and separates benchmark authorization', () => {
    configure();
    vi.stubEnv('PLACY_BENCHMARK_ACCESS_CODE', 'separate-test-code');
    const demo = issueDemoAccess('a-demo-code-with-enough-entropy', 1000)!;
    const test = issueDemoAccess('separate-test-code', 1000)!;
    expect(verifyDemoAccess(test, 1001)?.role).toBe('benchmark');
    expect(verifyDemoAccess(demo, 1001)?.role).toBe('demo');
    vi.stubEnv('PLACY_DEMO_ACCESS_CODE', 'replacement-demo-code');
    expect(verifyDemoAccess(demo, 1001)).toBeNull();
  });
});
