import { describe, expect, it, vi } from 'vitest';
import * as supabase from '@/lib/supabase/client';
import { parseLogEventInput } from '@/lib/instrumentation/event-schema';
import { loadLiveDemo } from '@/lib/live/demos';
import { resolveVoiceProject, type VoiceProjectDependencies } from '@/lib/live/projects';
import type { VoiceProject, VoiceTenant } from '@/lib/live/metering/types';

const bindings: Record<string, VoiceProject> = {
  nyhavna: { slug:'nyhavna', customer_id:'owner-a', project_id:'owner-a_nyhavna', content_source:'nyhavna-lokal', enabled:true, public_tenant_id:'a-public', benchmark_tenant_id:'a-benchmark', internal_tenant_id:null },
  fixture: { slug:'fixture', customer_id:'owner-b', project_id:'owner-b_fixture', content_source:'nyhavna-leve', enabled:true, public_tenant_id:'b-public', benchmark_tenant_id:null, internal_tenant_id:null },
};
function dependencies(): VoiceProjectDependencies {
  return {
    readBinding: vi.fn(async slug => bindings[slug] ?? null),
    readProject: vi.fn(async id => ({id, customer_id:id==='owner-a_nyhavna'?'owner-a':'owner-b', url_slug:id==='owner-a_nyhavna'?'nyhavna':'fixture'})),
    readProduct: vi.fn(async id => ({id:id==='owner-a_nyhavna'?'00000000-0000-4000-8000-000000000001':'00000000-0000-4000-8000-000000000002',project_id:id,product_type:'report'})),
    readTenant: vi.fn(async id => ({id, customer_id:id.startsWith('a-')?'owner-a':'owner-b', project_id:id.startsWith('a-')?'owner-a_nyhavna':'owner-b_fixture', internal_demo_id:null, purpose:id.endsWith('benchmark')?'benchmark':'public', enabled:true}) as VoiceTenant),
    readPolicy: vi.fn(async (scope_type,scope_id) => ({scope_type,scope_id,enabled:true,max_concurrent:5,max_per_hour:60,max_per_day:200,daily_budget_usd:100})),
    loadDemo: vi.fn(loadLiveDemo),
  };
}
describe('server project resolution', () => {
  it('loads two real, distinct content sources with canonical identity and fresh conversations', async () => {
    const deps=dependencies();
    const a=await resolveVoiceProject({project:'nyhavna'},'public',deps);
    const b=await resolveVoiceProject({project:'fixture'},'public',deps);
    expect(a.project).toMatchObject({id:'00000000-0000-4000-8000-000000000001',customer:'owner-a',urlSlug:'nyhavna',demoSnapshotId:a.demo.snapshotId});
    expect(b.project).toMatchObject({id:'00000000-0000-4000-8000-000000000002',customer:'owner-b',urlSlug:'fixture'});
    for (const resolved of [a,b]) {
      const projectId=`${resolved.project.customer}_${resolved.project.urlSlug}`;
      expect(projectId).toBe(resolved.tenant.project_id);
      expect(parseLogEventInput({eventType:'board_viewed',projectId,productId:resolved.project.id}).ok).toBe(true);
    }
    expect(a.tenant.id).toBe('a-public'); expect(b.tenant.id).toBe('b-public');
    expect(a.demo.backendInstructions).not.toBe(b.demo.backendInstructions);
    expect(a.demo.board.categories).not.toEqual(b.demo.board.categories);
    expect(a.demo.snapshotId).not.toBe(b.demo.snapshotId);
    expect(a.demo.board.demoSnapshotId).toBe(a.demo.snapshotId);
    const first=a.demo.createConversation(),second=a.demo.createConversation(),other=b.demo.createConversation();
    first.execute('set_interests',{interests:['mat']});
    expect(first.state()).not.toEqual(second.state());
    expect(second.state()).toEqual(a.demo.createConversation().state());
    expect(other).not.toBe(first);
  });
  it('routes the legacy selector through the same registry and binds snapshots to identity', async () => {
    const deps=dependencies();
    const legacy=await resolveVoiceProject({dataset:'nyhavna-lokal'},'public',deps);
    const explicit=await resolveVoiceProject({project:'nyhavna',dataset:'nyhavna-lokal'},'public',deps);
    expect(legacy.demo.snapshotId).toBe(explicit.demo.snapshotId);
    vi.mocked(deps.readBinding).mockResolvedValue({...bindings.fixture,content_source:'nyhavna-lokal'});
    const second=await resolveVoiceProject({project:'fixture'},'public',deps);
    expect(second.demo.snapshotId).not.toBe(explicit.demo.snapshotId);
  });
  it.each([
    ['unknown', {project:'missing'}], ['missing selector', {}], ['invalid slug', {project:'../nyhavna'}],
    ['unknown legacy source',{dataset:'nyhavna-leve'}], ['mismatched source',{project:'fixture',dataset:'nyhavna-lokal'}],
  ])('rejects %s', async (_name, selection) => {
    await expect(resolveVoiceProject(selection,'public',dependencies())).rejects.toMatchObject({ kind: 'not_found' });
  });
  it.each(['disabled','owner','product-owner','product-type','source','tenant-owner','tenant-purpose','tenant-disabled','policy-missing','policy-disabled','read-failed'])('fails closed before loading content for %s', async reason => {
    const deps=dependencies();
    if(reason==='disabled') vi.mocked(deps.readBinding).mockResolvedValue({...bindings.nyhavna,enabled:false});
    if(reason==='owner') vi.mocked(deps.readProject).mockResolvedValue({id:'owner-a_nyhavna',customer_id:'wrong',url_slug:'nyhavna'});
    if(reason.startsWith('product-')) vi.mocked(deps.readProduct).mockResolvedValue({id:'00000000-0000-4000-8000-000000000001',project_id:reason==='product-owner'?'wrong':'owner-a_nyhavna',product_type:reason==='product-type'?'explorer':'report'});
    if(reason==='source') vi.mocked(deps.readBinding).mockResolvedValue({...bindings.nyhavna,content_source:'../../secret'});
    if(reason.startsWith('tenant-')) vi.mocked(deps.readTenant).mockResolvedValue({id:'a-public',project_id:'owner-a_nyhavna',customer_id:reason==='tenant-owner'?'wrong':'owner-a',purpose:reason==='tenant-purpose'?'benchmark':'public',internal_demo_id:null,enabled:reason!=='tenant-disabled'} as VoiceTenant);
    if(reason==='policy-missing') vi.mocked(deps.readPolicy).mockResolvedValue(null);
    if(reason==='policy-disabled') vi.mocked(deps.readPolicy).mockResolvedValue({scope_type:'platform',scope_id:'platform',enabled:false,max_concurrent:1,max_per_hour:1,max_per_day:1,daily_budget_usd:1});
    if(reason==='read-failed') vi.mocked(deps.readBinding).mockRejectedValue(new Error('secret database URL'));
    await expect(resolveVoiceProject({project:'nyhavna'},'public',deps)).rejects.toThrow('Voice project unavailable');
    expect(deps.loadDemo).not.toHaveBeenCalled();
  });
  it('treats missing ownership/tenant records and unreadable content as unavailable', async () => {
    for (const missing of ['project','product','tenant','content']) {
      const deps=dependencies();
      if(missing==='project') vi.mocked(deps.readProject).mockResolvedValue(null);
      if(missing==='product') vi.mocked(deps.readProduct).mockResolvedValue(null);
      if(missing==='tenant') vi.mocked(deps.readTenant).mockResolvedValue(null);
      if(missing==='content') vi.mocked(deps.loadDemo).mockRejectedValue(new Error('/private/data/file.json invalid'));
      await expect(resolveVoiceProject({project:'nyhavna'},'public',deps)).rejects.toThrow('Voice project unavailable');
    }
  });
  it.each(['readBinding','readProject','readProduct','readTenant','readPolicy','loadDemo'] as const)('classifies %s rejection as retryable without dependency details', async method => {
    const deps=dependencies();
    vi.mocked(deps[method]).mockRejectedValue(new Error('secret database URL /private/file'));
    await expect(resolveVoiceProject({project:'nyhavna'},'public',deps)).rejects.toMatchObject({kind:'unavailable',message:'Voice project unavailable'});
  });
  it('distinguishes Supabase registry errors from an absent registry row', async () => {
    const maybeSingle=vi.fn().mockResolvedValue({data:null,error:{message:'private database details'}});
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),maybeSingle};
    const client={schema:vi.fn().mockReturnThis(),from:vi.fn().mockReturnValue(query)};
    const spy=vi.spyOn(supabase,'createServerClient').mockReturnValue(client as unknown as ReturnType<typeof supabase.createServerClient>);
    try {
      await expect(resolveVoiceProject({project:'nyhavna'})).rejects.toMatchObject({kind:'unavailable',message:'Voice project unavailable'});
      maybeSingle.mockResolvedValue({data:null,error:null});
      await expect(resolveVoiceProject({project:'missing'})).rejects.toMatchObject({kind:'not_found'});
    } finally { spy.mockRestore(); }
  });
  it('only selects a configured benchmark tenant for trusted purpose', async () => {
    const deps=dependencies();
    expect((await resolveVoiceProject({project:'nyhavna'},'benchmark',deps)).tenant.id).toBe('a-benchmark');
    await expect(resolveVoiceProject({project:'fixture'},'benchmark',deps)).rejects.toMatchObject({ kind: 'not_found' });
  });
});
