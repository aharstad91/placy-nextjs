import 'server-only';
import { createHash } from 'node:crypto';
import { createServerClient } from '@/lib/supabase/client';
import { isLiveDataset, loadLiveDemo, type LiveDemo } from '@/lib/live/demos';
import type { VoiceAdmissionPolicy, VoiceProject, VoiceTenant } from '@/lib/live/metering/types';
import type { Project } from '@/lib/types';

export interface VoiceProjectSelection { project?: string; dataset?: string }
type HostedPurpose = 'public' | 'benchmark';
type ProjectIdentity = { id: string; customer_id: string; url_slug: string };
type ReportProductIdentity = { id: string; project_id: string; product_type: string };
export interface VoiceProjectDependencies {
  readBinding(slug: string): Promise<VoiceProject | null>;
  readProject(id: string): Promise<ProjectIdentity | null>;
  readProduct(projectId: string): Promise<ReportProductIdentity | null>;
  readTenant(id: string): Promise<VoiceTenant | null>;
  readPolicy(scope: VoiceAdmissionPolicy['scope_type'], id: string): Promise<VoiceAdmissionPolicy | null>;
  loadDemo: typeof loadLiveDemo;
}
export interface ResolvedVoiceProject {
  slug: string;
  project: Project;
  demo: LiveDemo;
  tenant: VoiceTenant;
}
/** Do not expose database errors, registry IDs, credentials or local file paths. */
export class VoiceProjectError extends Error {
  constructor() { super('Voice project unavailable'); }
}
function defaultDependencies(): VoiceProjectDependencies {
  const client = createServerClient().schema('v2');
  return {
    async readBinding(slug) {
      const {data,error}=await client.from('voice_projects').select('*').eq('slug',slug).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if(error) throw new VoiceProjectError();
      return data;
    },
    async readProject(id) {
      const {data,error}=await client.from('projects').select('id,customer_id,url_slug').eq('id',id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if(error) throw new VoiceProjectError();
      return data;
    },
    async readProduct(projectId) {
      const {data,error}=await client.from('products').select('id,project_id,product_type').eq('project_id',projectId).eq('product_type','report').abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if(error) throw new VoiceProjectError();
      return data;
    },
    async readTenant(id) {
      const {data,error}=await client.from('voice_tenants').select('*').eq('id',id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if(error) throw new VoiceProjectError();
      return data;
    },
    async readPolicy(scope,id) {
      const {data,error}=await client.from('voice_admission_policies').select('*').eq('scope_type',scope).eq('scope_id',id).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
      if(error) throw new VoiceProjectError();
      return data;
    },
    loadDemo: loadLiveDemo,
  };
}

/**
 * Single uncached authority for page, readiness and paid start. The browser selects
 * only a public slug; ownership, content and accounting purpose remain server-owned.
 * Policy reads signal readiness; voice_reserve repeats admission atomically.
 */
export async function resolveVoiceProject(selection: VoiceProjectSelection, purpose: HostedPurpose = 'public', dependencies?: VoiceProjectDependencies): Promise<ResolvedVoiceProject> {
  try {
    const slug=selection.project ?? (selection.dataset==='nyhavna-lokal'?'nyhavna':undefined);
    if(!slug || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || !['public','benchmark'].includes(purpose)) throw new VoiceProjectError();
    const deps=dependencies ?? defaultDependencies();
    const binding=await deps.readBinding(slug);
    if(!binding?.enabled || binding.slug!==slug || !isLiveDataset(binding.content_source)
      || (selection.dataset!==undefined && selection.dataset!==binding.content_source)) throw new VoiceProjectError();
    const tenantId=purpose==='benchmark'?binding.benchmark_tenant_id:binding.public_tenant_id;
    if(!tenantId) throw new VoiceProjectError();
    const scopes: Array<[VoiceAdmissionPolicy['scope_type'],string]>=[['platform','platform'],['customer',binding.customer_id],['project',binding.project_id]];
    const [identity,product,tenant,...policies]=await Promise.all([
      deps.readProject(binding.project_id),deps.readProduct(binding.project_id),deps.readTenant(tenantId),
      ...scopes.map(([scope,id])=>deps.readPolicy(scope,id)),
    ] as const);
    if(!identity || identity.id!==binding.project_id || identity.customer_id!==binding.customer_id || !identity.url_slug
      || identity.id!==`${identity.customer_id}_${identity.url_slug}`
      || !product?.id || product.project_id!==binding.project_id || product.product_type!=='report'
      || !tenant?.enabled || tenant.id!==tenantId || tenant.customer_id!==binding.customer_id || tenant.project_id!==binding.project_id
      || tenant.internal_demo_id!==null || tenant.purpose!==purpose
      || policies.some((policy,index)=>!policy?.enabled || policy.scope_type!==scopes[index][0] || policy.scope_id!==scopes[index][1])) throw new VoiceProjectError();
    const loaded=await deps.loadDemo(binding.content_source);
    if(loaded.id!==binding.content_source || !loaded.snapshotId || !loaded.project || !loaded.board) throw new VoiceProjectError();
    // Even projects temporarily sharing a trusted source have distinct rendered versions.
    const snapshotId=`project-${createHash('sha256').update(JSON.stringify([slug,binding.customer_id,binding.project_id,binding.content_source,loaded.snapshotId])).digest('hex').slice(0,32)}`;
    // The existing renderer uses Project.id for the product UUID (analytics).
    // Voice accounting uses the separately verified tenant.project_id container.
    const project={...loaded.project,id:product.id,customer:identity.customer_id,urlSlug:identity.url_slug,demoSnapshotId:snapshotId};
    // projectSlug is deliberately source-specific: existing images/3D assets use it.
    const demo={...loaded,project,snapshotId,board:{...loaded.board,demoSnapshotId:snapshotId}};
    return {slug,project,demo,tenant};
  } catch { throw new VoiceProjectError(); }
}
