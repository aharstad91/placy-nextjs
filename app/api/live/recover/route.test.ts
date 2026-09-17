import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/live/recover/route';

const mocks = vi.hoisted(() => ({ claim: vi.fn(), finalize: vi.fn(), hangup: vi.fn() }));
vi.mock('@/lib/live/metering', () => ({ createVoiceLedger: () => ({ claimStaleRecoveries: mocks.claim, finalize: mocks.finalize }) }));
vi.mock('@/lib/live/hangup', () => ({ liveHangup: mocks.hangup, LIVE_SESSION_ID: /^live_[a-z0-9_]+$/i }));
const secret = 'a'.repeat(32);
const request = (authorization = `Bearer ${secret}`) => new Request('https://demo.test/api/live/recover', { headers: { authorization } });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('PLACY_HOSTED_VOICE', 'true');
  vi.stubEnv('CRON_SECRET', secret);
  mocks.claim.mockResolvedValue([]);
  mocks.finalize.mockResolvedValue({});
  mocks.hangup.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('hosted recovery boundary', () => {
  it('rejects missing or incorrect credentials before touching the ledger', async () => {
    expect((await GET(request(''))).status).toBe(401);
    expect((await GET(request('Bearer wrong'))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('still recovers old paid sessions when new hosted starts are disabled', async () => {
    vi.stubEnv('PLACY_HOSTED_VOICE', 'false');
    mocks.claim.mockResolvedValue([{ id: 'session-a', provider_session_id: 'live_test', provider_closed: false }]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.hangup).toHaveBeenCalledWith('live_test');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ providerClosed: true, finalUsageConfirmed: false }));
    expect((await GET(request(''))).status).toBe(401);
  });
  it('disables recovery when its authentication secret is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(request())).status).toBe(404);
    vi.stubEnv('CRON_SECRET', 'short');
    expect((await GET(request())).status).toBe(404);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('hangs up a known provider using the claimed owner without inventing final usage', async () => {
    mocks.claim.mockResolvedValue([{ id: 'session-a', provider_session_id: 'live_test', provider_closed: false }]);
    const response = await GET(request());
    const owner = mocks.claim.mock.calls[0][0].ownerToken;
    expect(mocks.hangup).toHaveBeenCalledWith('live_test');
    expect(mocks.finalize).toHaveBeenCalledWith({ sessionId: 'session-a', ownerToken: owner, terminationReason: 'owner_lost', providerClosed: true, finalUsageConfirmed: false });
    expect(await response.json()).toEqual({ claimed: 1, closed: 1, unresolved: 0 });
  });
  it('keeps failed hangups and unknown identities unresolved', async () => {
    mocks.claim.mockResolvedValue([
      { id: 'session-a', provider_session_id: 'live_test', provider_closed: false },
      { id: 'session-b', provider_session_id: null, provider_closed: false },
    ]);
    mocks.hangup.mockRejectedValue(new Error('private provider response'));
    const response = await GET(request());
    expect(mocks.hangup).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).toHaveBeenCalledTimes(2);
    for (const [input] of mocks.finalize.mock.calls) expect(input).toMatchObject({ providerClosed: false, finalUsageConfirmed: false });
    expect(await response.json()).toEqual({ claimed: 2, closed: 0, unresolved: 2 });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private provider response');
  });
  it('reports a database failure without returning error bodies or owner capabilities', async () => {
    mocks.claim.mockRejectedValue(new Error('private database response'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Recovery unavailable' });
    expect(mocks.hangup).not.toHaveBeenCalled();
  });
});
