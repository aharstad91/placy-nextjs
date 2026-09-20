import { describe, expect, it, vi } from 'vitest';
import { revealAfterCamera } from '@/lib/demo/local-board/reveal-transition';

describe('map reveal sequencing', () => {
  it('frames first, keeps new markers hidden during the flight, then acknowledges after paint', async () => {
    const events: string[] = [];
    let finish!: () => void;
    const result = revealAfterCamera({
      painted: async () => { events.push('paint'); },
      frame: () => { events.push('camera'); },
      wait: () => new Promise(resolve => { finish = resolve; }),
      reveal: () => { events.push('markers'); return 'ok'; },
      current: () => true,
    });
    await Promise.resolve();
    expect(events).toEqual(['paint', 'camera']);
    finish();
    expect(await result).toBe('ok');
    expect(events).toEqual(['paint', 'camera', 'markers', 'paint']);
  });
  it('does not load stale places after another command interrupts the flight', async () => {
    let current = true;
    const reveal = vi.fn();
    expect(await revealAfterCamera({ painted: async () => {}, frame: () => {},
      wait: async () => { current = false; }, current: () => current, reveal,
    })).toBeNull();
    expect(reveal).not.toHaveBeenCalled();
  });
});
