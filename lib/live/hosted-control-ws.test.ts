import { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTROL_MAX_MESSAGE, runHostedControl, type HostedControlDependencies } from '@/lib/live/hosted-control';
import type { VoiceSession } from '@/lib/live/metering';
import type { LiveSidebandOptions } from '@/lib/live/sideband';
import { loadLiveDemo } from '@/lib/live/demos';
import { issueTranscript, MAX_TRANSCRIPT_TOKEN_LENGTH, verifyTranscript } from '@/lib/demo/site-chat/transcript';
import { transcriptScope } from '@/lib/demo/site-chat/profile';
import { nyhavnaChatProfile } from '@/lib/demo/nyhavna-chat/profile';
import { siteChatCustomerForDataset } from '@/lib/demo/site-chat/customers';

/**
 * Den samme kontrollprotokollen over en ekte WebSocket (ws 8), med samme
 * meldingstak som `/api/live/control` setter. Leverandør, regnskap og sideband
 * er erstattet; forbindelsen, rammene og tokenet er ekte.
 */
const VISITOR = '3b8f2d1e-0000-4000-8000-000000000002';
let server: WebSocketServer;

beforeEach(() => {
  vi.stubEnv('OPENAI_BOARD_LIVE_MODEL', 'gpt-live-1'); vi.stubEnv('OPENAI_BOARD_BACKEND_MODEL', 'gpt-5.6-terra'); vi.stubEnv('OPENAI_BOARD_LIVE_VOICE', 'willow');
  vi.stubEnv('PLACY_NH_CHAT_COOKIE_SECRET', 'n'.repeat(40));
});
afterEach(async () => { vi.unstubAllEnvs(); await new Promise(resolve => server?.close(resolve)); });

describe('kontrollforbindelsen over en ekte WebSocket', () => {
  it('tar imot et fullt SDP pluss et maksimalt samtaletoken, og leverer overføringen før avslutningen', async () => {
    const source = await loadLiveDemo('nyhavna-lokal');
    let sideband: LiveSidebandOptions | undefined;
    const row = { id: crypto.randomUUID(), owner_token: crypto.randomUUID(), deadline_at: new Date(Date.now() + 1650000).toISOString(), known_cost_usd: 0, reservation_usd: 5 } as VoiceSession;
    const ledger = { reserve: vi.fn(async () => row), markCreating: vi.fn(async () => row), bindProvider: vi.fn(async () => row), heartbeat: vi.fn(async () => row), recordVoiceUsage: vi.fn(async () => row), recordUsageEvent: vi.fn(async () => row), finalize: vi.fn(async () => row), claimStaleRecoveries: vi.fn(async () => []) };
    const deps: HostedControlDependencies = {
      ledger, createSession: vi.fn(async () => ({ sessionId: 'live_ws', sdp: 'answer', model: 'gpt-live-1' })), hangup: vi.fn(async () => {}),
      resolveProject: vi.fn(async () => ({ slug: 'nyhavna', project: {}, tenant: { id: 'nyhavna-public' }, contentSnapshotId: source.snapshotId, demo: { ...source, snapshotId: 'project-snap' } })) as unknown as HostedControlDependencies['resolveProject'],
      connect: vi.fn(async (_id, _token, _conversation, input) => {
        sideband = input; input?.supervisor?.setCleanup('token', () => {});
        return { onContext: vi.fn(), end: vi.fn(async reason => { sideband?.transcript?.close(); await sideband?.supervisor?.end('token', reason); }) };
      }),
      chatCustomer: siteChatCustomerForDataset, consumeChatVoiceQuota: vi.fn(async () => ({ allowed: true as const })),
    };
    server = new WebSocketServer({ port: 0, maxPayload: CONTROL_MAX_MESSAGE });
    server.on('connection', socket => { void runHostedControl(socket, { role: 'demo', visitorId: 'x', expiresAt: Date.now() + 1e5, version: 'v' }, deps, { visitorFor: id => id === 'nyhavna' ? VISITOR : null }); });
    const port = (server.address() as AddressInfo).port;

    // 40 turer med norske tegn: tokenet blir så stort vinduet tillater.
    const turns = Array.from({ length: 40 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', text: `Tur ${i}: æøå ${'x'.repeat(190)}` }));
    const scope = transcriptScope(nyhavnaChatProfile);
    const transcript = issueTranscript({ scope, visitorId: VISITOR, snapshotId: source.snapshotId, previousTurns: [], newTurns: turns });
    expect(transcript.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_TOKEN_LENGTH);
    const sdp = `v=0\r\n${'a=candidate:x\r\n'.repeat(1900)}`.slice(0, 32000);

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    const frames: Record<string, unknown>[] = [];
    const closed = new Promise<void>(resolve => client.on('close', () => resolve()));
    client.on('message', data => {
      const frame = JSON.parse(String(data));
      frames.push(frame);
      if (frame.type === 'ready') {
        sideband?.transcript?.delta('assistant', 'Hei igjen.', { startMs: 0, endMs: 400 });
        client.send(JSON.stringify({ type: 'stop' }));
      }
    });
    await new Promise(resolve => client.on('open', resolve));
    const start = JSON.stringify({ type: 'start', sdp, snapshotId: 'project-snap', dataset: 'nyhavna-lokal', surface: 'chat', transcript });
    // Nær det gamle taket på 50 000; den lokale ruta tillater 64 000.
    expect(start.length).toBeGreaterThan(40000);
    expect(start.length).toBeLessThanOrEqual(CONTROL_MAX_MESSAGE);
    client.send(start);
    await closed;

    expect(frames.map(frame => frame.type)).toEqual(['ready', 'handoff', 'ended']);
    expect(frames[0]).toMatchObject({ continuity: { status: 'carried', trimmed: true } });
    const verified = verifyTranscript(String(frames[1].transcript), VISITOR, scope);
    expect(verified?.turns.at(-1)).toEqual({ role: 'assistant', text: 'Hei igjen.', via: 'voice' });
    expect(verified?.trimmed).toBe(true);
    expect(ledger.finalize).toHaveBeenCalledOnce();
  });
});
