import 'server-only';
import { createServerClient } from '@/lib/supabase/client';
import { backendCostUsd, normalizeBackendUsage, VOICE_RATE_SNAPSHOT } from '@/lib/live/usage';
import type { Json } from '@/lib/supabase/types';
import type { VoiceSession } from '@/lib/live/metering/types';
export type { VoiceSession, VoiceTenant, VoiceUsageEvent } from '@/lib/live/metering/types';

export interface OwnedSession { sessionId: string; ownerToken: string }
export interface ReserveInput {
  tenantId: string;
  ownerToken: string;
  environment: VoiceSession['environment'];
  configVersion: string;
  datasetVersion: string;
  models: { voice: string; backend: string; speaker: string };
  testRunId?: string;
  scenarioId?: string;
}
export interface FinalizeInput extends OwnedSession {
  terminationReason: string;
  /** True only after successful provider hangup or authoritative closed evidence. */
  providerClosed: boolean;
  /** True only when final cumulative voice AND all backend response evidence arrived. */
  finalUsageConfirmed: boolean;
  /** Trusted server assertion: no provider request attempted; reserved/creating only. */
  neverCreated?: boolean;
  /** Definitive provider HTTP rejection proving no session started; never for network errors. */
  creationRejected?: boolean;
}
export interface UsageEventInput extends OwnedSession { responseId: string; model: string; usage: unknown }
export type VoiceRpc = 'voice_reserve' | 'voice_mutate' | 'voice_claim_recoveries';
export interface LedgerTransport {
  call(name: VoiceRpc, payload: Json): Promise<unknown>;
}

/** Errors deliberately omit PostgREST/provider bodies, payloads and credentials. */
export class VoiceLedgerError extends Error {
  constructor(public readonly code: 'unavailable' | 'invalid_input') { super(`Voice ledger ${code}`); }
}
const label = (v: string, max = 100) => {
  if (typeof v !== 'string' || !v.length || v.length > max || !/^[a-zA-Z0-9_.:-]+$/.test(v)) throw new VoiceLedgerError('invalid_input');
  return v;
};
const uuid = (v: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new VoiceLedgerError('invalid_input');
  return v;
};
const owned = (v: OwnedSession) => ({ sessionId: uuid(v.sessionId), ownerToken: uuid(v.ownerToken) });

function defaultTransport(): LedgerTransport {
  const client = createServerClient().schema('v2');
  return {
    async call(name, payload) {
      const { data, error } = await client.rpc(name, { p: payload }).abortSignal(AbortSignal.timeout(8000));
      if (error) throw new VoiceLedgerError('unavailable');
      return data;
    },
  };
}

/** No retry of admission: a timeout is ambiguous and must never trigger paid create. */
export function createVoiceLedger(transport?: LedgerTransport) {
  let activeTransport = transport;
  async function call<T>(name: VoiceRpc, payload: Json): Promise<T> {
    try {
      const data = await (activeTransport ??= defaultTransport()).call(name, payload);
      if (data === null || typeof data !== 'object') throw new VoiceLedgerError('unavailable');
      return data as T;
    } catch { throw new VoiceLedgerError('unavailable'); }
  }
  const mutate = (input: OwnedSession, action: string, fields: Record<string, Json> = {}) =>
    call<VoiceSession>('voice_mutate', { ...owned(input), action, ...fields });
  return {
    reserve(input: ReserveInput) {
      if (input.models?.voice !== 'gpt-live-1' || input.models?.backend !== 'gpt-5.6-terra' || input.models?.speaker !== 'willow'
        || !['development','preview','production','test'].includes(input.environment)) throw new VoiceLedgerError('invalid_input');
      return call<VoiceSession>('voice_reserve', {
        tenantId: label(input.tenantId,80), ownerToken: uuid(input.ownerToken), environment: input.environment,
        configVersion: label(input.configVersion), datasetVersion: label(input.datasetVersion),
        testRunId: input.testRunId === undefined ? null : label(input.testRunId),
        scenarioId: input.scenarioId === undefined ? null : label(input.scenarioId),
        models: { voice: input.models.voice, backend: input.models.backend, speaker: input.models.speaker },
        rateSnapshot: JSON.parse(JSON.stringify(VOICE_RATE_SNAPSHOT)) as Json,
      });
    },
    markCreating: (input: OwnedSession) => mutate(input,'creating'),
    bindProvider: (input: OwnedSession & {providerSessionId:string}) => mutate(input,'bind',{providerSessionId:label(input.providerSessionId,200)}),
    heartbeat: (input: OwnedSession) => mutate(input,'heartbeat'),
    recordVoiceUsage(input: OwnedSession & {seconds:number}) {
      if (!Number.isFinite(input.seconds) || input.seconds < 0 || input.seconds > 86400) throw new VoiceLedgerError('invalid_input');
      return mutate(input,'voice',{seconds:input.seconds});
    },
    recordUsageEvent(input: UsageEventInput) {
      const usage = normalizeBackendUsage(input.usage);
      return mutate(input,'event',{
        responseId:label(input.responseId,200), model:label(input.model),
        evidenceStatus:usage ? 'valid':'invalid',
        inputTokens:usage?.input_tokens ?? null,
        cachedTokens:usage?.input_tokens_details?.cached_tokens ?? null,
        outputTokens:usage?.output_tokens ?? null,
        knownRate:usage !== null && backendCostUsd(input.model,usage) !== null,
      });
    },
    finalize(input: FinalizeInput) {
      if (!/^[a-z0-9_:-]{1,80}$/.test(input.terminationReason)) throw new VoiceLedgerError('invalid_input');
      if (typeof input.providerClosed !== 'boolean' || typeof input.finalUsageConfirmed !== 'boolean'
        || (input.neverCreated !== undefined && typeof input.neverCreated !== 'boolean')
        || (input.creationRejected !== undefined && typeof input.creationRejected !== 'boolean')) throw new VoiceLedgerError('invalid_input');
      return mutate(input,'finalize',{terminationReason:input.terminationReason,providerClosed:input.providerClosed,
        finalUsageConfirmed:input.finalUsageConfirmed,neverCreated:input.neverCreated ?? false,creationRejected:input.creationRejected ?? false});
    },
    claimStaleRecoveries(input: {ownerToken:string;limit?:number}) {
      const limit=input.limit ?? 10;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new VoiceLedgerError('invalid_input');
      return call<VoiceSession[]>('voice_claim_recoveries',{ownerToken:uuid(input.ownerToken),limit});
    },
  };
}
