/** Real audio only. --list is offline; paid execution requires explicit limits. */
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { LiveMessage, LiveStatus } from '@/lib/live/types';
import { BENCHMARK_SCENARIOS, admitBenchmark, costDistribution, expandScenarios, liabilityUsd, type BenchmarkLedgerRow, type BenchmarkScenario } from '@/lib/live/benchmark-scenarios';

interface VoiceHook { start(): void; stop(): void; play(url: string): Promise<void>; status(): LiveStatus; messages(): LiveMessage[] }
declare global { interface Window { placyVoice?: VoiceHook; placyBenchmarkQuiet?: { count: number; since: number } } }
interface Attempt {
  label: string; scenario: string; status: 'pending' | 'starting' | 'running' | 'passed' | 'failed' | 'blocked';
  startedAt?: string; endedAt?: string; reason?: string;
  audioClips: number; heardUser: boolean; heardAssistant: boolean; observedMapDirective: boolean;
  interruptedWhileSpeaking: boolean; isolatedAfterPeerStop?: boolean; sessions: BenchmarkLedgerRow[];
  endReason?: string;
}
const { values } = parseArgs({ options: {
  list: { type: 'boolean' }, url: { type: 'string' }, scenarios: { type: 'string', default: 'short' },
  repeat: { type: 'string', default: '3' }, 'max-usd': { type: 'string' },
  'deadline-minutes': { type: 'string', default: '45' }, output: { type: 'string' },
} });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  if (values.list) { console.log(JSON.stringify(BENCHMARK_SCENARIOS, null, 2)); return; }
  const matrix = expandScenarios(values.scenarios!, Number(values.repeat));
  const ceiling = Number(values['max-usd']), minutes = Number(values['deadline-minutes']);
  if (!values.url || !Number.isFinite(ceiling) || ceiling <= 0 || ceiling > 50 || !Number.isFinite(minutes) || minutes <= 0 || minutes > 120) {
    throw new Error('Require --url HTTPS_URL --max-usd (0,50], --deadline-minutes (0,120]');
  }
  const target = new URL(values.url);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) throw new Error('Use clean HTTPS demo URL without credentials/query/fragment');
  const run = `audio-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const output = resolve(values.output ?? `.context/voice-benchmark/${run}.json`);
  const attempts: Attempt[] = matrix.flatMap((s, i) => Array.from({ length: s.mode === 'concurrent' ? 2 : 1 }, (_, tab) => ({
    label: `${s.id}-${i + 1}-${tab + 1}`, scenario: s.id, status: 'pending' as const,
    audioClips: 0, heardUser: false, heardAssistant: false, observedMapDirective: false, interruptedWhileSpeaking: false, sessions: [],
  })));
  let rows: BenchmarkLedgerRow[] = [], browser: Browser | undefined, failure: string | undefined;
  let ledgerReadable = false;
  const deadline = Date.now() + minutes * 60_000;
  const save = async () => {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(`${output}.tmp`, JSON.stringify({ version: 1, synthetic: true, run, host: target.host,
      maxUsd: ceiling, deadlineAt: new Date(deadline).toISOString(), updatedAt: new Date().toISOString(),
      failure, ledgerReadable, knownLiabilityUsd: ledgerReadable ? liabilityUsd(rows) : null,
      attempted: attempts.filter(a => a.startedAt).length, passed: attempts.filter(a => a.status === 'passed').length,
      failed: attempts.filter(a => a.status === 'failed').length, distribution: costDistribution(rows),
      groups: Object.fromEntries([...new Set(attempts.map(a => a.scenario))].map(id => [id, costDistribution(rows.filter(r => attempts.some(a => a.scenario === id && a.label === r.scenario_id)))])),
      attempts, limitations: ['Synthetic audio fixtures are not a measured customer distribution.', 'Calculated provider costs exclude fixed platform costs.', 'Response/map booleans do not establish semantic correctness.', 'Forced owner loss requires separate controlled deployment/recovery evidence.'],
    }, null, 2), { mode: 0o600 });
    await rename(`${output}.tmp`, output);
  };
  await save();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const code = process.env.PLACY_BENCHMARK_ACCESS_CODE;
    if (!code) throw new Error('access_configuration_missing');
    const { createServerClient } = await import('@/lib/supabase/client');
    const db = createServerClient().schema('v2');
    const readLedger = async () => {
      ledgerReadable = false;
      const result: BenchmarkLedgerRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db.from('voice_sessions')
          .select('id,scenario_id,state,accounting_status,reservation_usd,known_cost_usd,voice_seconds,backend_cost_usd,invalid_usage,provider_closed,final_usage_confirmed,termination_reason')
          .eq('tenant_id', 'nyhavna-lokal-benchmark').eq('test_run_id', run).order('id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(15_000));
        if (error || !data) throw new Error('ledger_unavailable');
        result.push(...data);
        if (data.length < 500) break;
      }
      rows = result;
      liabilityUsd(rows); // Validate amounts before admitting any paid start.
      ledgerReadable = true;
      for (const attempt of attempts) attempt.sessions = rows.filter(r => r.scenario_id === attempt.label);
      return rows;
    };
    await readLedger();
    if (rows.length) throw new Error('run_id_collision');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    timer = setTimeout(() => { failure = 'deadline_reached'; void browser?.close(); }, Math.max(1, deadline - Date.now()));
    const prepare = async (attempt: Attempt) => {
      const context = await browser!.newContext();
      const response = await context.request.post(new URL('/api/demo/access', target).href, { form: { code }, headers: { origin: target.origin }, maxRedirects: 0 });
      if (response.status() !== 303 || (response.headers()['location'] ?? '').includes('access=failed')) { await context.close(); throw new Error('access_denied'); }
      await context.addInitScript({ content: `(() => {
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
          // A fresh silent track per start; stop() destroys the prior track.
          const audio = new AudioContext();
          await audio.resume();
          const destination = audio.createMediaStreamDestination();
          const source = audio.createConstantSource();
          source.offset.value = 0;
          source.connect(destination); source.start();
          for (const track of destination.stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => { stop(); source.stop(); void audio.close(); };
          }
          return destination.stream;
        } });
      })();` });
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
        // Inspect only the discriminator in memory; never retain frames or arguments.
        try {
          const frame = JSON.parse(String(payload));
          if (frame.type === 'map') attempt.observedMapDirective = true;
          if (frame.type === 'ended' && ['manual','limit','idle','connection','error'].includes(frame.reason)) attempt.endReason = frame.reason;
        } catch { /* Non-JSON signaling carries no observation. */ }
      }));
      const url = new URL(target); url.searchParams.set('voicedev', '1'); url.searchParams.set('voiceRun', run); url.searchParams.set('voiceScenario', attempt.label);
      await page.goto(url.href);
      await page.waitForFunction(() => Boolean(window.placyVoice));
      await page.getByRole('button', { name: 'Utforsk nærområdet', exact: true }).click();
      await page.waitForTimeout(2_000);
      // Missing assets must fail before a paid start.
      const fixtures = matrix.find(s => s.id === attempt.scenario)!.fixtures;
      for (const fixture of fixtures) {
        const response = await context.request.get(new URL(`/dev/nyhavna-tts/${fixture}.wav`, target).href);
        if (!response.ok() || !(response.headers()['content-type'] ?? '').includes('audio')) throw new Error('audio_fixture_unavailable');
      }
      return { context, page };
    };
    const observe = async (page: Page, attempt: Attempt) => {
      const seen = await page.evaluate(() => ({
        user: window.placyVoice!.messages().some(m => m.role === 'user' && m.text.length > 0),
        assistant: window.placyVoice!.messages().some(m => m.role === 'assistant' && m.text.length > 0),
      }));
      attempt.heardUser ||= seen.user; attempt.heardAssistant ||= seen.assistant;
    };
    const waitForQuiet = async (page: Page) => {
      await page.waitForFunction(() => {
        const voice = window.placyVoice!;
        const count = voice.messages().filter(m => m.role === 'assistant').reduce((sum, m) => sum + m.text.length, 0);
        const prior = window.placyBenchmarkQuiet;
        if (!prior || prior.count !== count || voice.status() !== 'listening') {
          window.placyBenchmarkQuiet = { count, since: Date.now() };
          return false;
        }
        return Date.now() - prior.since >= 3_000;
      }, undefined, { timeout: 60_000 });
    };
    const play = async (page: Page, attempt: Attempt, fixture: string, waitResponse = true) => {
      // Only an aggregate count leaves the browser, never spoken words.
      const before = await page.evaluate(() => window.placyVoice!.messages().filter(m => m.role === 'assistant').reduce((n, m) => n + m.text.length, 0));
      await page.evaluate(f => window.placyVoice!.play(`/dev/nyhavna-tts/${f}.wav`), fixture);
      attempt.audioClips++;
      if (waitResponse) {
        await page.waitForFunction(n => window.placyVoice!.messages().filter(m => m.role === 'assistant').reduce((sum, m) => sum + m.text.length, 0) > n, before, { timeout: 45_000 });
        await waitForQuiet(page);
      }
      await observe(page, attempt);
    };
    const drive = async (page: Page, context: BrowserContext, attempt: Attempt, scenario: BenchmarkScenario, peerStopped?: Promise<void>) => {
      try {
        await page.waitForFunction(() => ['listening', 'thinking', 'speaking'].includes(window.placyVoice!.status()));
        attempt.status = 'running';
        if (scenario.mode === 'silence') {
          await page.waitForFunction(() => ['idle','error'].includes(window.placyVoice!.status()), undefined, { timeout: 150_000 });
          if (attempt.endReason !== 'idle') throw new Error('unexpected_silence_termination');
        } else if (scenario.durationSeconds) {
          await page.waitForFunction(() => window.placyVoice!.messages().some(m => m.role === 'assistant'), undefined, { timeout: 45_000 });
          await waitForQuiet(page);
          const until = Date.now() + scenario.durationSeconds * 1000;
          let clip = 0;
          while (Date.now() < until) {
            const turnStart = Date.now();
            await play(page, attempt, scenario.fixtures[clip++ % scenario.fixtures.length]);
            await sleep(Math.max(0, Math.min(until - Date.now(), 45_000 - (Date.now() - turnStart))));
            if (await page.evaluate(() => ['idle', 'error'].includes(window.placyVoice!.status()))) throw new Error('ended_before_requested_duration');
          }
        } else {
          // Finish the greeting before measuring replies to the injected user audio.
          await page.waitForFunction(() => window.placyVoice!.messages().some(m => m.role === 'assistant'), undefined, { timeout: 45_000 });
          await waitForQuiet(page);
          for (let i = 0; i < scenario.fixtures.length; i++) {
            if (scenario.mode === 'interrupt' && i === 1) {
              await page.waitForFunction(() => window.placyVoice!.status() === 'speaking', undefined, { timeout: 30_000 });
              attempt.interruptedWhileSpeaking = true;
            }
            await play(page, attempt, scenario.fixtures[i], !(scenario.mode === 'interrupt' && i === 0));
          }
        }
        if (scenario.mode !== 'silence' && (!attempt.heardUser || !attempt.heardAssistant)) throw new Error('missing_audio_observation');
        if (scenario.id === 'tool-heavy' && !attempt.observedMapDirective) throw new Error('missing_map_observation');
        if (scenario.mode === 'concurrent' && attempt.label.endsWith('-2')) {
          await peerStopped;
          await sleep(1_000);
          attempt.isolatedAfterPeerStop = await page.evaluate(() => !['idle', 'error', 'connecting'].includes(window.placyVoice!.status()));
          if (!attempt.isolatedAfterPeerStop) throw new Error('concurrency_isolation_failed');
        }
        if (scenario.mode === 'disconnect') await context.close();
        else {
          await page.evaluate(() => window.placyVoice!.stop());
          // UI becomes idle immediately; transport retains media for its 8s final-usage drain.
          await sleep(8_500);
        }
        attempt.status = 'passed';
      } catch {
        attempt.status = 'failed'; attempt.reason = failure === 'deadline_reached' ? failure : 'audio_or_response_failed';
      } finally {
        if (!page.isClosed()) {
          await page.evaluate(() => window.placyVoice?.stop()).catch(() => {});
          if (attempt.status !== 'passed') await sleep(8_500);
        }
        await context.close().catch(() => {});
        attempt.endedAt = new Date().toISOString();
      }
    };
    let index = 0;
    for (const scenario of matrix) {
      const batch = attempts.slice(index, index + (scenario.mode === 'concurrent' ? 2 : 1)); index += batch.length;
      if (Date.now() >= deadline) throw new Error('deadline_reached');
      await readLedger();
      if (!admitBenchmark(rows, ceiling, batch.length)) throw new Error('spend_ceiling_reached');
      const prepared: Awaited<ReturnType<typeof prepare>>[] = [];
      try {
        for (const attempt of batch) prepared.push(await prepare(attempt));
        // Recheck after browser setup, immediately before any paid request.
        await readLedger();
        if (!admitBenchmark(rows, ceiling, batch.length)) throw new Error('spend_ceiling_reached');
        for (const attempt of batch) { attempt.status = 'starting'; attempt.startedAt = new Date().toISOString(); }
        await save();
        await Promise.all(prepared.map(({ page }) => page.evaluate(() => window.placyVoice!.start())));
        const first = drive(prepared[0].page, prepared[0].context, batch[0], scenario);
        await Promise.all([first, ...prepared.slice(1).map(({ page, context }, i) => drive(page, context, batch[i + 1], scenario, first))]);
      } catch {
        for (const attempt of batch) { attempt.status = 'failed'; attempt.reason ??= 'setup_or_start_failed'; attempt.endedAt = new Date().toISOString(); }
      } finally {
        await Promise.all(prepared.map(p => p.context.close().catch(() => {})));
        await save();
      }
      // Allow final checkpoint delivery, but never retry a paid call.
      for (let poll = 0; poll < 6; poll++) {
        await readLedger();
        if (batch.every(a => !a.startedAt || (a.sessions.length > 0 && a.sessions.every(s => s.state === 'closed')))) break;
        await sleep(2_000);
      }
      await save();
      if (batch.some(a => a.startedAt && !a.sessions.length)) throw new Error('paid_attempt_missing_ledger');
    }
  } catch (error) {
    const allowed = ['access_configuration_missing', 'ledger_unavailable', 'run_id_collision', 'deadline_reached', 'spend_ceiling_reached', 'paid_attempt_missing_ledger'];
    failure = error instanceof Error && allowed.includes(error.message) ? error.message : 'runner_failed';
    for (const attempt of attempts) if (attempt.status === 'pending') { attempt.status = 'blocked'; attempt.reason = failure; }
    process.exitCode = 1;
  } finally {
    if (timer) clearTimeout(timer);
    await browser?.close().catch(() => {});
    await save();
    console.log(JSON.stringify({ run, output, failure, attempted: attempts.filter(a => a.startedAt).length }));
  }
  if (attempts.some(a => a.status === 'failed')) process.exitCode = 1;
}
main().catch(() => { console.error('Benchmark configuration invalid; use --list or consult benchmark.md.'); process.exitCode = 1; });
