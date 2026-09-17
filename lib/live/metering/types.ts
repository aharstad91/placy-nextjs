export type VoicePurpose = 'public' | 'internal' | 'benchmark';

export interface VoiceSession {
  id: string;
  tenant_id: string;
  /** Absent/null only for pre-platform records and legacy fixtures. */
  purpose?: VoicePurpose | null;
  internal_demo_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  owner_token: string;
  state: 'reserved' | 'creating' | 'active' | 'recovering' | 'closed' | 'unresolved';
  created_at: string;
  updated_at: string;
  lease_expires_at: string;
  deadline_at: string;
  provider_session_id: string | null;
  environment: 'development' | 'preview' | 'production' | 'test';
  config_version: string;
  dataset_version: string;
  models: { voice: string; backend: string; speaker: string };
  rate_snapshot: import('@/lib/supabase/types').Json;
  test_run_id: string | null;
  scenario_id: string | null;
  reservation_usd: number;
  voice_seconds: number | null;
  backend_cost_usd: number;
  known_cost_usd: number;
  invalid_usage: boolean;
  provider_closed: boolean;
  final_usage_confirmed: boolean;
  accounting_status: 'provisional' | 'complete' | 'incomplete';
  termination_reason: string | null;
  ended_at: string | null;
  recovery_attempts: number;
}
export interface VoiceTenant {
  id: string;
  /** Null legacy tenants produce new sessions with internal purpose. */
  purpose?: VoicePurpose | null;
  internal_demo_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  enabled: boolean;
  max_concurrent: number;
  max_per_hour: number;
  max_per_day: number;
  daily_budget_usd: number;
  reservation_usd: number;
  max_duration_seconds: number;
}
export interface VoiceUsageEvent {
  session_id: string;
  response_id: string;
  model: string;
  input_tokens: number | null;
  cached_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  evidence_status: 'valid' | 'invalid' | 'unknown_rate';
  received_at: string;
}

/** Service-only binding; content_source selects an allowlisted server loader. */
export interface VoiceProject {
  slug: string;
  customer_id: string;
  project_id: string;
  content_source: string;
  enabled: boolean;
  public_tenant_id: string;
  benchmark_tenant_id: string | null;
  internal_tenant_id: string | null;
}

export interface VoiceAdmissionPolicy {
  scope_type: 'platform' | 'customer' | 'project';
  /** The platform singleton uses scope_id=platform. */
  scope_id: string;
  enabled: boolean;
  max_concurrent: number;
  max_per_hour: number;
  max_per_day: number;
  /** Rolling 24-hour known cost plus all unfinished liability, not a sales quota. */
  daily_budget_usd: number;
}
