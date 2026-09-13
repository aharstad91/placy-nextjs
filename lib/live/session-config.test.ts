import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendEffort, backendModel, liveModel, liveSessionConfig } from '@/lib/live/session-config';

afterEach(() => vi.unstubAllEnvs());

describe('live session configuration', () => {
  it('delegates to the Responses backend and carries no Realtime-only fields', () => {
    const session = liveSessionConfig('kort stemmeinstruks', 'lang backendinstruks', []) as Record<string, unknown>;
    expect(session).toMatchObject({ model: 'gpt-live-1', instructions: 'kort stemmeinstruks', audio: { output: { voice: 'marin' } } });
    expect(session.delegation).toMatchObject({ type: 'responses', responses: { model: 'gpt-5.6-terra', instructions: 'lang backendinstruks', tool_choice: 'auto', parallel_tool_calls: true, reasoning: { effort: 'low' } } });
    for (const field of ['type', 'turn_detection', 'transcription', 'truncation', 'output_modalities']) expect(session).not.toHaveProperty(field);
    expect(session.audio).not.toHaveProperty('format');
    expect(session.audio).not.toHaveProperty('input');
  });
  it('refuses a model that is not a Live model instead of falling back', () => {
    vi.stubEnv('OPENAI_BOARD_LIVE_MODEL', 'gpt-realtime-2.1-mini');
    expect(() => liveSessionConfig('a', 'b', [])).toThrow(/Live-modell/);
  });
  it('reads models and effort from the environment and rejects an unknown effort', () => {
    vi.stubEnv('OPENAI_BOARD_LIVE_MODEL', 'gpt-live-1-preview');
    vi.stubEnv('OPENAI_BOARD_BACKEND_MODEL', 'gpt-5.6-luna');
    vi.stubEnv('OPENAI_BOARD_BACKEND_EFFORT', 'medium');
    expect(liveModel()).toBe('gpt-live-1-preview');
    expect(backendModel()).toBe('gpt-5.6-luna');
    expect(backendEffort()).toBe('medium');
    vi.stubEnv('OPENAI_BOARD_BACKEND_EFFORT', 'blazing');
    expect(() => backendEffort()).toThrow();
  });
});
