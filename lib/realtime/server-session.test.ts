import { describe, it, expect, vi, afterEach } from 'vitest';
import { RealtimeSupervisor } from '@/lib/realtime/server-session';
afterEach(() => vi.useRealTimers());
describe('server session supervision', () => {
  it('serializes admission and releases only after upstream stop succeeds', async () => {
    const stop = vi.fn(async () => {});
    const supervisor = new RealtimeSupervisor({ stop, save: async () => {}, read: async () => null });
    const token = await supervisor.reserve();
    await expect(supervisor.reserve()).rejects.toThrow();
    await supervisor.attach(token, 'rtc_test');
    expect(await supervisor.end('wrong')).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(await supervisor.end(token)).toBe(true);
    expect(stop).toHaveBeenCalledWith('rtc_test');
    await expect(supervisor.reserve()).resolves.toBeTruthy();
  });
  it('reports only the running session as active, so routes can gate on the token', async () => {
    const supervisor = new RealtimeSupervisor({ stop: async () => {}, save: async () => {}, read: async () => null });
    expect(supervisor.isActive('anything')).toBe(false);
    const token = await supervisor.reserve();
    expect(supervisor.isActive(token)).toBe(true);
    expect(supervisor.isActive('other')).toBe(false);
    await supervisor.end(token);
    expect(supervisor.isActive(token)).toBe(false);
  });
  it('ends upstream at the deadline without browser participation', async () => {
    vi.useFakeTimers();
    const stop = vi.fn(async () => {});
    const supervisor = new RealtimeSupervisor({ stop, save: async () => {}, read: async () => null, maxMs: 100 });
    const token = await supervisor.reserve();
    await supervisor.attach(token, 'rtc_test');
    await vi.advanceTimersByTimeAsync(101);
    expect(stop).toHaveBeenCalledWith('rtc_test');
  });
  it('fails closed when recovery cannot hang up a prior call', async () => {
    const supervisor = new RealtimeSupervisor({ stop: async () => { throw new Error('offline'); }, save: async () => {}, read: async () => 'rtc_old', retryDelaysMs: [] });
    await expect(supervisor.reserve()).rejects.toThrow();
    await expect(supervisor.reserve()).rejects.toThrow();
  });
  it('cleans up a recovered call before admitting a new session', async () => {
    const stop = vi.fn(async () => {});
    const save = vi.fn(async () => {});
    const supervisor = new RealtimeSupervisor({ stop, save, read: async () => 'rtc_old' });
    await supervisor.reserve();
    expect(stop).toHaveBeenCalledWith('rtc_old');
    expect(save).toHaveBeenCalledWith(null);
  });
  it('retries a failed hangup while keeping admission blocked and the registry intact', async () => {
    vi.useFakeTimers();
    const stop = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const save = vi.fn(async () => {});
    const supervisor = new RealtimeSupervisor({ stop, save, read: async () => null, retryDelaysMs: [100] });
    const token = await supervisor.reserve();
    await supervisor.attach(token, 'rtc_retry');
    await expect(supervisor.end(token)).rejects.toThrow('offline');
    expect(save).not.toHaveBeenCalledWith(null);
    await expect(supervisor.reserve()).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(100);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(null);
    await expect(supervisor.reserve()).resolves.toBeTruthy();
  });
  it('cancels the scheduled retry when a manual end succeeds first', async () => {
    vi.useFakeTimers();
    const stop = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const supervisor = new RealtimeSupervisor({ stop, save: async () => {}, read: async () => null, retryDelaysMs: [100] });
    const token = await supervisor.reserve();
    await supervisor.attach(token, 'rtc_manual');
    await expect(supervisor.end(token)).rejects.toThrow('offline');
    await expect(supervisor.end(token)).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(stop).toHaveBeenCalledTimes(2);
  });
  it('retries startup recovery before admitting a new session', async () => {
    vi.useFakeTimers();
    const stop = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const save = vi.fn(async () => {});
    const supervisor = new RealtimeSupervisor({ stop, save, read: async () => 'rtc_old', retryDelaysMs: [100] });
    const reservation = supervisor.reserve();
    await vi.advanceTimersByTimeAsync(100);
    await expect(reservation).resolves.toBeTruthy();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(null);
  });
  it('allows exactly 60 starts per rolling hour and reopens at the boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'));
    const supervisor = new RealtimeSupervisor({ stop: async () => {}, save: async () => {}, read: async () => null });
    for (let count = 0; count < 60; count += 1) {
      const token = await supervisor.reserve();
      await supervisor.end(token);
    }
    await expect(supervisor.reserve()).rejects.toThrow();
    vi.setSystemTime(new Date('2026-09-12T13:00:00Z'));
    await expect(supervisor.reserve()).resolves.toBeTruthy();
  });
});
