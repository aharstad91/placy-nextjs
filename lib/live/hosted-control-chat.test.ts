import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runHostedControl, type HostedControlDependencies } from '@/lib/live/hosted-control';
import type { VoiceSession, ReserveInput } from '@/lib/live/metering';
import type { DemoAccess } from '@/lib/live/hosted-access';
import type { LiveSidebandOptions } from '@/lib/live/sideband';
import type { VoiceProjectSelection } from '@/lib/live/projects';
import { LiveSessionError } from '@/lib/live/create-session';
import { loadLiveDemo, type LiveDemo } from '@/lib/live/demos';
import { MAP_TOOLS } from '@/lib/realtime/types';
import { chatSurfaceVoiceInstructions } from '@/lib/live/chat-surface';
import { issueTranscript, verifyTranscript } from '@/lib/demo/site-chat/transcript';
import { transcriptScope } from '@/lib/demo/site-chat/profile';
import { nyhavnaChatProfile } from '@/lib/demo/nyhavna-chat/profile';
import { leangenbuktaChatProfile } from '@/lib/demo/leangenbukta-chat/profile';
import { siteChatCustomerForDataset } from '@/lib/demo/site-chat/customers';

/**
 * Chatflaten på den delte stemmen (2026-09-24): kontrollforbindelsen med ekte
 * kunderegister, ekte samtaletoken og ekte Nyhavna-datasett. Bare leverandøren
 * (Live), regnskapet og sidebandet er erstattet.
 */

class Socket extends EventEmitter {
  readyState=1;
  sent: Record<string,unknown>[]=[];
  send(data:string) {this.sent.push(JSON.parse(data));}
  ping=vi.fn();
  close=vi.fn(() => {this.readyState=3;this.emit('close');});
  message(value:unknown) {this.emit('message',Buffer.from(JSON.stringify(value)));}
}
const access: DemoAccess={role:'demo',visitorId:'shared-random',expiresAt:Date.now()+100000,version:'public-demo-v1'};
const VISITOR='3b8f2d1e-0000-4000-8000-000000000001';
const NH_SCOPE=transcriptScope(nyhavnaChatProfile);
const LB_SCOPE=transcriptScope(leangenbuktaChatProfile);
const TURNS=[{role:'user' as const,text:'Hva er Bunkerkvartalet?'},{role:'assistant' as const,text:'Et planlagt delområde ved Dora 2.'}];
const tick=async () => {for(let i=0;i<30;i++) await Promise.resolve();};

let source: LiveDemo;
beforeEach(async ()=>{
  vi.stubEnv('OPENAI_BOARD_LIVE_MODEL','gpt-live-1');vi.stubEnv('OPENAI_BOARD_BACKEND_MODEL','gpt-5.6-terra');vi.stubEnv('OPENAI_BOARD_LIVE_VOICE','willow');
  vi.stubEnv('PLACY_NH_CHAT_COOKIE_SECRET','n'.repeat(40));vi.stubEnv('PLACY_LB_DEMO_COOKIE_SECRET','s'.repeat(40));
  source=await loadLiveDemo('nyhavna-lokal');
});
afterEach(()=>{vi.unstubAllEnvs();});

function setup(options: { visitor?: string | null; contentId?: string } = {}) {
  let sideband:LiveSidebandOptions | undefined;
  const row={id:crypto.randomUUID(),owner_token:crypto.randomUUID(),deadline_at:new Date(Date.now()+1650000).toISOString(),known_cost_usd:0,reservation_usd:5} as VoiceSession;
  const ledger={reserve:vi.fn<(input: ReserveInput) => Promise<VoiceSession>>(async()=>row),markCreating:vi.fn(async()=>row),bindProvider:vi.fn(async()=>row),heartbeat:vi.fn(async()=>row),recordVoiceUsage:vi.fn(async()=>row),recordUsageEvent:vi.fn(async()=>row),finalize:vi.fn(async()=>row),claimStaleRecoveries:vi.fn(async()=>[])};
  const handle={onContext:vi.fn(),end:vi.fn(async(reason)=>{
    sideband?.transcript?.close();
    sideband?.onMeteringEvent?.({type:'voice.snapshot',seconds:12,final:true});
    sideband?.onMeteringEvent?.({type:'finalized',complete:true,observedResponses:1,terminalResponses:1,finalVoiceConfirmed:true});
    await sideband?.supervisor?.end('token',reason);
  })};
  // Prosjektets egen innholdsversjon, avledet slik `resolveVoiceProject` gjør.
  const projectSnapshot='project-0123456789abcdef0123456789abcdef';
  const resolveProject=vi.fn(async(_selection: VoiceProjectSelection,purpose: 'public' | 'benchmark' = 'public')=>({
    slug:'nyhavna',project:{id:'product'},tenant:{id:`nyhavna-${purpose}`},contentSnapshotId:source.snapshotId,
    demo:{...source,id:options.contentId ?? source.id,snapshotId:projectSnapshot},
  })) as unknown as HostedControlDependencies['resolveProject'];
  const deps:HostedControlDependencies={ledger,createSession:vi.fn(async()=>({sessionId:'live_chat',sdp:'answer',model:'gpt-live-1'})),hangup:vi.fn(async()=>{}),
    resolveProject,connect:vi.fn(async(_id,_token,_conversation,input)=>{sideband=input;input?.supervisor?.setCleanup('token',()=>{});return handle;}),
    chatCustomer:siteChatCustomerForDataset,consumeChatVoiceQuota:vi.fn(async()=>({allowed:true}))};
  const socket=new Socket();
  const visitor=options.visitor === undefined ? VISITOR : options.visitor;
  const done=runHostedControl(socket as unknown as WebSocket,access,deps,{visitorFor:id=>id==='nyhavna' ? visitor : null});
  const start=(extra: Record<string,unknown> = {})=>socket.message({type:'start',sdp:'v=0\r\n',snapshotId:projectSnapshot,dataset:'nyhavna-lokal',surface:'chat',...extra});
  return {socket,done,deps,ledger,handle,row,start,projectSnapshot,getSideband:()=>sideband};
}
const createdConfig=(s: ReturnType<typeof setup>, call=0)=>vi.mocked(s.deps.createSession).mock.calls[call][0] as unknown as {
  instructions:string; input?: unknown[]; delegation:{responses:{instructions:string;tools:{name:string}[]}};
};

describe('den delte stemmen: chatflaten',()=>{
  it('fortsetter tekstsamtalen, bruker kartfrie verktøy og Nyhavnas egne instrukser, og trekker begge kvotene',async()=>{
    const s=setup();
    s.start({transcript:issueTranscript({scope:NH_SCOPE,visitorId:VISITOR,snapshotId:source.snapshotId,previousTurns:[],newTurns:TURNS})});
    await tick();
    expect(s.deps.resolveProject).toHaveBeenCalledWith({project:'nyhavna',dataset:'nyhavna-lokal'},'public');
    expect(s.ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({tenantId:'nyhavna-public',datasetVersion:s.projectSnapshot}));
    expect(s.deps.consumeChatVoiceQuota).toHaveBeenCalledWith(VISITOR,nyhavnaChatProfile.voice.meter);
    // Kvoten trekkes etter reservasjonen og før den betalte opprettelsen.
    expect(vi.mocked(s.deps.consumeChatVoiceQuota).mock.invocationCallOrder[0]).toBeGreaterThan(s.ledger.reserve.mock.invocationCallOrder[0]);
    expect(vi.mocked(s.deps.consumeChatVoiceQuota).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(s.deps.createSession).mock.invocationCallOrder[0]);
    const config=createdConfig(s);
    expect(config.instructions).toBe(chatSurfaceVoiceInstructions(nyhavnaChatProfile.voice,{continued:true}));
    expect(config.delegation.responses.instructions).toContain('henvis til Nyhavna Utvikling');
    for (const tool of config.delegation.responses.tools) expect(MAP_TOOLS.has(tool.name)).toBe(false);
    expect(config.input).toHaveLength(2);
    expect(s.getSideband()?.browserTools).toEqual(new Set());
    expect(s.getSideband()?.transcript).toBeDefined();
    expect(s.socket.sent.find(m=>m.type==='ready')).toMatchObject({continuity:{status:'carried',turns:2,trimmed:false}});
    // Configversjonen navngir instrukser og verktøy, aldri samtaleinnhold.
    expect(s.ledger.reserve.mock.calls[0][0].configVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(s.ledger.reserve.mock.calls)).not.toContain('Bunkerkvartalet');

    const sink=s.getSideband()!.transcript!;
    sink.delta('user','Hvor spiser vi i nærheten?',{startMs:0,endMs:900});
    sink.delta('assistant','Blant annet Dora Kaffebar.',{startMs:1200,endMs:2400});
    s.socket.message({type:'stop'});await s.done;
    const handoffIndex=s.socket.sent.findIndex(m=>m.type==='handoff');
    const endedIndex=s.socket.sent.findIndex(m=>m.type==='ended');
    expect(handoffIndex).toBeGreaterThan(-1);expect(handoffIndex).toBeLessThan(endedIndex);
    const handoff=s.socket.sent[handoffIndex] as {status:string;transcript:string;voiceTurns:number};
    expect(handoff).toMatchObject({status:'ready',voiceTurns:2,trimmed:false});
    // Tokenet er Nyhavnas, for den samme besøkende og kildens egen versjon — det tekstendepunktet godtar.
    const verified=verifyTranscript(handoff.transcript,VISITOR,NH_SCOPE);
    expect(verified?.snapshotId).toBe(source.snapshotId);
    expect(verified?.turns.map(turn=>turn.text)).toEqual([...TURNS.map(turn=>turn.text),'Hvor spiser vi i nærheten?','Blant annet Dora Kaffebar.']);
    expect(verifyTranscript(handoff.transcript,VISITOR,LB_SCOPE)).toBeNull();
    expect(verifyTranscript(handoff.transcript,'en-annen',NH_SCOPE)).toBeNull();
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({providerClosed:true,finalUsageConfirmed:true,terminationReason:'manual'}));
  });

  it.each([
    ['et Leangenbukta-token for samme besøkende', () => issueTranscript({scope:LB_SCOPE,visitorId:VISITOR,snapshotId:source.snapshotId,previousTurns:[],newTurns:TURNS})],
    ['et token for en annen besøkende', () => issueTranscript({scope:NH_SCOPE,visitorId:'en-annen',snapshotId:source.snapshotId,previousTurns:[],newTurns:TURNS})],
    ['et token bundet til prosjektets versjon i stedet for kildens', () => issueTranscript({scope:NH_SCOPE,visitorId:VISITOR,snapshotId:'project-0123456789abcdef0123456789abcdef',previousTurns:[],newTurns:TURNS})],
    ['et forfalsket token', () => 'e30.forfalsket'],
  ])('starter uten historikk og sier det ved %s',async(_label,token)=>{
    const s=setup();s.start({transcript:token()});await tick();
    expect(s.socket.sent.find(m=>m.type==='ready')).toMatchObject({continuity:{status:'rejected'}});
    expect(createdConfig(s).input).toBeUndefined();
    expect(createdConfig(s).instructions).toContain('Dette er en ny samtale');
    s.socket.message({type:'stop'});await s.done;
  });

  it('melder «none» uten token, og gir likevel en overføring av talen',async()=>{
    const s=setup();s.start();await tick();
    expect(s.socket.sent.find(m=>m.type==='ready')).toMatchObject({continuity:{status:'none'}});
    s.getSideband()!.transcript!.delta('assistant','Hei, det er Anja.',{startMs:0,endMs:500});
    s.socket.message({type:'stop'});await s.done;
    const handoff=s.socket.sent.find(m=>m.type==='handoff') as {transcript:string};
    expect(verifyTranscript(handoff.transcript,VISITOR,NH_SCOPE)?.turns).toEqual([{role:'assistant',text:'Hei, det er Anja.',via:'voice'}]);
  });

  it('starter uten historikk hvis Live avviser session.input, og sier det',async()=>{
    const s=setup();
    vi.mocked(s.deps.createSession).mockRejectedValueOnce(new LiveSessionError(400,'invalid_request_error','bad input'));
    s.start({transcript:issueTranscript({scope:NH_SCOPE,visitorId:VISITOR,snapshotId:source.snapshotId,previousTurns:[],newTurns:TURNS})});
    await tick();
    expect(s.deps.createSession).toHaveBeenCalledTimes(2);
    expect(createdConfig(s,1).input).toBeUndefined();
    expect(s.socket.sent.find(m=>m.type==='ready')).toMatchObject({continuity:{status:'rejected'}});
    s.socket.message({type:'stop'});await s.done;
  });

  it.each([
    ['uten kundens besøkende (ingen chatcookie ved oppgraderingen)', {visitor:null}, {}],
    ['for en kunde uten delt stemme (Leangenbukta)', {}, {dataset:'leangenbukta-lokal'}],
    ['for et datasett uten chatboks', {}, {dataset:'nyhavna-leve'}],
    ['med et annet prosjekt enn kundens', {}, {project:'fixture'}],
    ['med testetiketter', {}, {testRunId:'run-1'}],
  ])('avviser chatflaten %s før opptak og betalt opprettelse',async(_label,options,extra)=>{
    const s=setup(options as {visitor?:string|null});s.start(extra);await s.done;
    expect(s.deps.resolveProject).not.toHaveBeenCalled();
    expect(s.ledger.reserve).not.toHaveBeenCalled();expect(s.deps.createSession).not.toHaveBeenCalled();
    expect(s.socket.sent.some(m=>m.type==='handoff' || m.type==='ready')).toBe(false);
  });

  it('avviser en binding som ikke peker på kundens datasett, før opptak',async()=>{
    const s=setup({contentId:'leangenbukta-lokal'});s.start();await s.done;
    expect(s.ledger.reserve).not.toHaveBeenCalled();expect(s.deps.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ['brukt opp', {allowed:false,reason:'visitor'}, 'Dagens samtaler'],
    ['utilgjengelig lager', {allowed:false,reason:'store'}, 'midlertidig utilgjengelig'],
  ])('feiler lukket når kundens stemmekvote er %s: ingen betalt sesjon, reservasjonen lukkes som aldri opprettet',async(_label,decision,message)=>{
    const s=setup();vi.mocked(s.deps.consumeChatVoiceQuota).mockResolvedValueOnce(decision as {allowed:false;reason:'visitor'|'store'});
    s.start();await s.done;
    expect(s.deps.createSession).not.toHaveBeenCalled();expect(s.ledger.markCreating).not.toHaveBeenCalled();
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({neverCreated:true,providerClosed:false}));
    expect(s.socket.sent.find(m=>m.type==='error')?.message).toContain(message);
    expect(s.socket.sent.some(m=>m.type==='handoff')).toBe(false);
  });

  it('gir ingen overføring når sesjonen aldri ble klar',async()=>{
    const s=setup();vi.mocked(s.deps.createSession).mockRejectedValueOnce(new Error('network'));
    s.start();await s.done;
    expect(s.socket.sent.some(m=>m.type==='handoff')).toBe(false);
  });
});
