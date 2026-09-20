import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runHostedControl, type HostedControlDependencies } from '@/lib/live/hosted-control';
import type { VoiceSession, ReserveInput } from '@/lib/live/metering';
import type { DemoAccess } from '@/lib/live/hosted-access';
import type { LiveSidebandOptions } from '@/lib/live/sideband';
import type { VoiceProjectSelection } from '@/lib/live/projects';
import { LiveSessionError } from '@/lib/live/create-session';

class Socket extends EventEmitter {
  readyState=1;
  sent: Record<string,unknown>[]=[];
  send(data:string) {this.sent.push(JSON.parse(data));}
  ping=vi.fn();
  close=vi.fn(() => {this.readyState=3;this.emit('close');});
  message(value:unknown) {this.emit('message',Buffer.from(JSON.stringify(value)));}
}
const access: DemoAccess={role:'benchmark',visitorId:'visitor',expiresAt:Date.now()+100000,version:'v1'};
const start={type:'start',sdp:'v=0\r\n',snapshotId:'snapshot',dataset:'nyhavna-lokal',testRunId:'test-run',scenarioId:'simple'};
const tick=async () => {for(let i=0;i<20;i++) await Promise.resolve();};
function setup(role: DemoAccess['role'] = 'benchmark') {
  let options:LiveSidebandOptions | undefined;
  const row={id:crypto.randomUUID(),owner_token:crypto.randomUUID(),deadline_at:new Date(Date.now()+1650000).toISOString(),known_cost_usd:0,reservation_usd:5} as VoiceSession;
  const ledger={reserve:vi.fn<(input: ReserveInput) => Promise<VoiceSession>>(async()=>row),markCreating:vi.fn(async()=>row),bindProvider:vi.fn(async()=>row),heartbeat:vi.fn(async()=>row),recordVoiceUsage:vi.fn(async()=>row),recordUsageEvent:vi.fn(async()=>row),finalize:vi.fn(async()=>row),claimStaleRecoveries:vi.fn(async()=>[])};
  const handle={onContext:vi.fn(),end:vi.fn(async(reason)=>{
    options?.onMeteringEvent?.({type:'voice.snapshot',seconds:30,final:true});
    options?.onMeteringEvent?.({type:'finalized',complete:true,observedResponses:0,terminalResponses:0,finalVoiceConfirmed:true});
    await options?.supervisor?.end('token',reason);
  })};
  const deps:HostedControlDependencies={ledger,createSession:vi.fn(async()=>({sessionId:'live_test',sdp:'answer',model:'gpt-live-1'})),hangup:vi.fn(async()=>{}),
    resolveProject:vi.fn(async(selection: VoiceProjectSelection,purpose: 'public' | 'benchmark' = 'public')=>{
      const slug=selection.project ?? 'nyhavna';
      return {slug,project:{id:slug},tenant:{id:`${slug}-${purpose}`},demo:{snapshotId:slug==='nyhavna'?'snapshot':`${slug}-snapshot`,id:'nyhavna-lokal',backendInstructions:`facts-${slug}`,voiceInstructions:'voice',createConversation:()=>({project:slug}),board:{}}};
    }) as unknown as HostedControlDependencies['resolveProject'],
    connect:vi.fn(async(_id,_token,_conversation,input)=>{options=input;input?.supervisor?.setCleanup('token',()=>{});return handle;})};
  const socket=new Socket();
  const done=runHostedControl(socket as unknown as WebSocket,{...access,role},deps);
  return {socket,done,deps,ledger,handle,row,getOptions:()=>options};
}
beforeEach(()=>{vi.stubEnv('OPENAI_BOARD_LIVE_MODEL','gpt-live-1');vi.stubEnv('OPENAI_BOARD_BACKEND_MODEL','gpt-5.6-terra');vi.stubEnv('OPENAI_BOARD_LIVE_VOICE','willow');});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});

describe('hosted conversation owner',()=>{
  it('reserves and binds before ready, drains usage before finalizing, never exposes owner token',async()=>{
    const s=setup();s.socket.message(start);await tick();
    expect(s.ledger.reserve).toHaveBeenCalledOnce();
    expect(s.deps.resolveProject).toHaveBeenCalledWith({dataset:'nyhavna-lokal'},'benchmark');
    expect(s.ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({tenantId:'nyhavna-benchmark'}));
    expect(s.ledger.bindProvider).toHaveBeenCalledWith(expect.objectContaining({sessionId:s.row.id,providerSessionId:'live_test'}));
    expect(s.socket.sent[0]).toMatchObject({type:'ready',sdp:'answer',sessionId:s.row.id});
    expect(JSON.stringify(s.socket.sent)).not.toContain(s.ledger.reserve.mock.calls[0][0].ownerToken);
    s.socket.message({type:'stop'});await s.done;
    expect(s.ledger.recordVoiceUsage).toHaveBeenCalledWith(expect.objectContaining({seconds:30}));
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({providerClosed:true,finalUsageConfirmed:true,terminationReason:'manual'}));
    expect(s.deps.hangup).not.toHaveBeenCalled();
  });
  it('does not create a paid session when admission fails',async()=>{
    const s=setup();s.ledger.reserve.mockRejectedValueOnce(new Error('database unavailable'));
    s.socket.message(start);await s.done;
    expect(s.deps.createSession).not.toHaveBeenCalled();expect(s.ledger.finalize).not.toHaveBeenCalled();
  });
  it('preserves an ambiguous create as unresolved instead of claiming zero cost',async()=>{
    const s=setup();vi.mocked(s.deps.createSession).mockRejectedValueOnce(new Error('network'));
    s.socket.message(start);await s.done;
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({providerClosed:false,finalUsageConfirmed:false,neverCreated:false,creationRejected:false}));
  });
  it('records a definitive upstream rejection separately',async()=>{
    const s=setup();vi.mocked(s.deps.createSession).mockRejectedValueOnce(new LiveSessionError(403,'forbidden','denied'));
    s.socket.message(start);await s.done;
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({creationRejected:true,neverCreated:false}));
  });
  it('routes two concurrent clients to separate bridges and context owners',async()=>{
    const a=setup(),b=setup();a.socket.message(start);b.socket.message(start);await tick();
    const command=a.getOptions()!.bridge!.dispatch('show_place',{poi_id:'a'});
    expect(a.socket.sent.at(-1)).toMatchObject({type:'map'});expect(b.socket.sent.some(m=>m.type==='map')).toBe(false);
    b.socket.message({type:'map_result',id:command.id,output:{wrong:true}});
    a.socket.message({type:'map_result',id:command.id,output:{ok:true}});
    expect(await command.result).toEqual({ok:true});
    a.socket.message({type:'context',message:{kind:'place',id:'a'}});
    expect(a.handle.onContext).toHaveBeenCalledOnce();expect(b.handle.onContext).not.toHaveBeenCalled();
    a.socket.message({type:'stop'});await a.done;expect(b.socket.close).not.toHaveBeenCalled();
    b.socket.message({type:'stop'});await b.done;
  });
  it('waits for the paid creation result when browser disappears, then hangs up',async()=>{
    const s=setup();let resolve!: (value:{sessionId:string;sdp:string;model:string})=>void;
    vi.mocked(s.deps.createSession).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    s.socket.message(start);await tick();s.socket.close();
    resolve({sessionId:'live_late',sdp:'answer',model:'gpt-live-1'});await s.done;
    expect(s.deps.hangup).toHaveBeenCalledWith('live_late');
    expect(s.deps.connect).not.toHaveBeenCalled();
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({providerClosed:true,finalUsageConfirmed:false}));
  });
  it('keeps accounting incomplete when a durable usage write fails',async()=>{
    const s=setup();s.socket.message(start);await tick();s.ledger.recordVoiceUsage.mockRejectedValueOnce(new Error('down'));
    s.socket.message({type:'stop'});await s.done;
    expect(s.ledger.finalize).toHaveBeenCalledWith(expect.objectContaining({finalUsageConfirmed:false}));
  });
});


describe('hosted project admission boundary',()=>{
  it('uses explicit project content and public tenant, with independent conversation/map owners',async()=>{
    const a=setup('demo'),b=setup('demo');
    a.socket.message({type:'start',sdp:'v=0',snapshotId:'snapshot',project:'nyhavna'});
    b.socket.message({type:'start',sdp:'v=0',snapshotId:'fixture-snapshot',project:'fixture'});
    await tick();
    expect(a.ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({tenantId:'nyhavna-public',datasetVersion:'snapshot'}));
    expect(b.ledger.reserve).toHaveBeenCalledWith(expect.objectContaining({tenantId:'fixture-public',datasetVersion:'fixture-snapshot'}));
    expect(a.deps.createSession).toHaveBeenCalledWith(expect.objectContaining({delegation:expect.objectContaining({responses:expect.objectContaining({instructions:'facts-nyhavna'})})}),'v=0');
    expect(b.deps.createSession).toHaveBeenCalledWith(expect.objectContaining({delegation:expect.objectContaining({responses:expect.objectContaining({instructions:'facts-fixture'})})}),'v=0');
    expect(a.deps.connect).toHaveBeenCalledWith(expect.anything(),expect.anything(),{project:'nyhavna'},expect.objectContaining({backendInstructions:'facts-nyhavna'}));
    expect(b.deps.connect).toHaveBeenCalledWith(expect.anything(),expect.anything(),{project:'fixture'},expect.objectContaining({backendInstructions:'facts-fixture'}));
    const command=a.getOptions()!.bridge!.dispatch('show_place',{poi_id:'nyhavna-place'});
    expect(b.socket.sent.some(m=>m.type==='map')).toBe(false);
    a.socket.message({type:'map_result',id:command.id,output:{ok:true}});await command.result;
    a.socket.message({type:'stop'});b.socket.message({type:'stop'});await Promise.all([a.done,b.done]);
  });
  it('passes the report source through the trusted project resolver',async()=>{
    const s=setup('demo');
    s.socket.message({type:'start',sdp:'v=0',snapshotId:'snapshot',project:'nyhavna',source:'report'});
    await tick();
    expect(s.deps.resolveProject).toHaveBeenCalledWith({project:'nyhavna',source:'report'},'public');
    expect(s.deps.createSession).toHaveBeenCalledOnce();
    s.socket.message({type:'stop'});await s.done;
  });
  it.each(['customerId','tenantId','purpose','models','rates','instructions'])('rejects browser accounting/config field %s before paid creation',async field=>{
    const s=setup();s.socket.message({...start,[field]:'attacker'});await s.done;
    expect(s.deps.resolveProject).not.toHaveBeenCalled();expect(s.ledger.reserve).not.toHaveBeenCalled();expect(s.deps.createSession).not.toHaveBeenCalled();
  });
  it('rejects another project snapshot before admission or creation',async()=>{
    const s=setup();s.socket.message({...start,dataset:undefined,project:'fixture'});await s.done;
    expect(s.ledger.reserve).not.toHaveBeenCalled();expect(s.deps.createSession).not.toHaveBeenCalled();
  });
  it('never falls back to a demo tenant when the registry cannot resolve',async()=>{
    const s=setup();vi.mocked(s.deps.resolveProject).mockRejectedValueOnce(new Error('secret registry detail'));
    s.socket.message(start);await s.done;
    expect(s.ledger.reserve).not.toHaveBeenCalled();expect(s.deps.createSession).not.toHaveBeenCalled();
    expect(JSON.stringify(s.socket.sent)).not.toContain('secret');
  });
  it('requires signed benchmark access before labels may be used',async()=>{
    const s=setup('demo');s.socket.message(start);await s.done;
    expect(s.ledger.reserve).not.toHaveBeenCalled();expect(s.deps.createSession).not.toHaveBeenCalled();
  });
  it('never creates a second paid session for duplicate start during creation',async()=>{
    const s=setup();let resolve!: (value:{sessionId:string;sdp:string;model:string})=>void;
    vi.mocked(s.deps.createSession).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    s.socket.message(start);await tick();s.socket.message(start);
    resolve({sessionId:'live_duplicate',sdp:'answer',model:'gpt-live-1'});await s.done;
    expect(s.ledger.reserve).toHaveBeenCalledOnce();expect(s.deps.createSession).toHaveBeenCalledOnce();
    expect(s.deps.hangup).toHaveBeenCalledWith('live_duplicate');
  });
});
