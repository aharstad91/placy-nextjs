export interface VoiceSession {
  id: string;
  tenant_id: string;
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
