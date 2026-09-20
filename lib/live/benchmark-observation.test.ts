import { afterEach, describe, expect, it, vi } from 'vitest';
import { benchmarkIsQuiet, benchmarkReplyArrived, readAssistantCursor } from '@/lib/live/benchmark-observation';
import type { LiveMessage } from '@/lib/live/types';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('browser benchmark observation', () => {
  it('detects a shorter reply when the 100-message rolling history discards older text', () => {
    let messages: LiveMessage[] = Array.from({length:100}, (_,i) => ({id:`old-${i}`,role:'assistant',text:'long earlier answer '.repeat(20)}));
    vi.stubGlobal('window', {placyVoice:{messages:()=>messages,status:()=>'listening'}});
    const before=readAssistantCursor();
    const oldLength=messages.reduce((n,m)=>n+m.text.length,0);
    messages=[...messages.slice(-99),{id:'new-reply',role:'assistant',text:'Ja.'}];
    expect(messages.reduce((n,m)=>n+m.text.length,0)).toBeLessThan(oldLength);
    expect(benchmarkReplyArrived(before)).toBe(true);
    expect(benchmarkReplyArrived(readAssistantCursor())).toBe(false);
  });

  it('requires assistant progress, including appended fragments in the same message', () => {
    const messages:LiveMessage[]=[{id:'a',role:'assistant',text:'Hei'}];
    vi.stubGlobal('window',{placyVoice:{messages:()=>messages,status:()=>'listening'}});
    const before=readAssistantCursor();
    messages.push({id:'u',role:'user',text:'Spørsmål'});
    expect(benchmarkReplyArrived(before)).toBe(false);
    messages[0].text+=' igjen';
    expect(benchmarkReplyArrived(before)).toBe(true);
  });

  it('restarts the quiet interval for a new equally long reply and while speaking', () => {
    vi.useFakeTimers();vi.setSystemTime(0);
    let messages:LiveMessage[]=[{id:'a',role:'assistant',text:'Hei'}];
    let status='listening';
    vi.stubGlobal('window',{placyVoice:{messages:()=>messages,status:()=>status}});
    expect(benchmarkIsQuiet()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(benchmarkIsQuiet()).toBe(true);
    messages=[{id:'b',role:'assistant',text:'Hei'}];
    expect(benchmarkIsQuiet()).toBe(false);
    vi.advanceTimersByTime(3000);status='speaking';
    expect(benchmarkIsQuiet()).toBe(false);
    status='listening';
    expect(benchmarkIsQuiet()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(benchmarkIsQuiet()).toBe(true);
  });
});
