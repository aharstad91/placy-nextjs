import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { createVoiceLedger } from '@/lib/live/metering';
const models={voice:'gpt-live-1',backend:'gpt-5.6-terra',speaker:'willow'};
const owner={sessionId:'10000000-0000-4000-8000-000000000000',ownerToken:'20000000-0000-4000-8000-000000000000'};
describe('voice ledger service boundary',()=>{
  it('sends only allowlisted numeric usage, with strict unknown-rate evidence',async()=>{
    const call=vi.fn().mockResolvedValue({id:owner.sessionId});
    const ledger=createVoiceLedger({call});
    await ledger.recordUsageEvent({...owner,responseId:'resp_1',model:'gpt-5.6-terra-evil',usage:{input_tokens:10,output_tokens:20,transcript:'private',output:[{text:'private'}]}});
    expect(call).toHaveBeenCalledWith('voice_mutate',{...owner,action:'event',responseId:'resp_1',model:'gpt-5.6-terra-evil',evidenceStatus:'valid',inputTokens:10,cachedTokens:0,outputTokens:20,knownRate:false});
    expect(JSON.stringify(call.mock.calls)).not.toContain('private');
  });
  it('retains malformed event evidence without converting it to free valid usage',async()=>{
    const call=vi.fn().mockResolvedValue({});
    await createVoiceLedger({call}).recordUsageEvent({...owner,responseId:'resp_2',model:'gpt-5.6-terra',usage:{input_tokens:-1,output_tokens:4}});
    expect(call.mock.calls[0][1]).toMatchObject({evidenceStatus:'invalid',inputTokens:null,outputTokens:null,knownRate:false});
  });
  it('fails closed without retries or leaking database errors',async()=>{
    const call=vi.fn().mockRejectedValue(new Error('secret transcript'));
    const ledger=createVoiceLedger({call});
    await expect(ledger.reserve({models,tenantId:'nyhavna-demo',ownerToken:owner.ownerToken,environment:'test',configVersion:'v1',datasetVersion:'v1'})).rejects.toThrow('Voice ledger unavailable');
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid control IDs, durations, metadata and unbounded recovery before I/O',()=>{
    const call=vi.fn(); const ledger=createVoiceLedger({call});
    expect(()=>ledger.heartbeat({...owner,ownerToken:'wrong'})).toThrow();
    expect(()=>ledger.recordVoiceUsage({...owner,seconds:NaN})).toThrow();
    expect(()=>ledger.claimStaleRecoveries({ownerToken:owner.ownerToken,limit:51})).toThrow();
    expect(()=>ledger.reserve({models,tenantId:'x',ownerToken:owner.ownerToken,environment:'test',configVersion:'transcript with spaces',datasetVersion:'v1'})).toThrow();
    expect(call).not.toHaveBeenCalled();
  });
  it('marks paid create separately and forwards only explicit final closure evidence',async()=>{
    const call=vi.fn().mockResolvedValue({}); const ledger=createVoiceLedger({call});
    await ledger.markCreating(owner);
    await ledger.finalize({...owner,terminationReason:'http_rejected',providerClosed:false,finalUsageConfirmed:false,creationRejected:true});
    expect(call.mock.calls[0][1]).toEqual({...owner,action:'creating'});
    expect(call.mock.calls[1][1]).toMatchObject({providerClosed:false,finalUsageConfirmed:false,creationRejected:true});
  });
});
