# Live voice database verification

Verified 2026-09-16T20:21:35.165Z against the configured Supabase database, after migration 093 was applied by the root agent.

- All three tables have RLS; 24 table privilege combinations and six function privilege combinations deny anon/authenticated access; SELECT and RPC EXECUTE also denied in actual role-switched queries; service_role privileges explicit.
- Six simultaneous reservations through six separate psql processes: exactly one accepted, five voice_admission_limit; durable max_concurrent=1.
- Six simultaneous recovery claims through separate processes: exactly one claimed row; wrong and expired owner tokens denied; new owner finalized unresolved/incomplete retaining $1 liability.
- Seeded the two explicitly authorized internal demo identities; customer/project IDs remain null. No customer rows touched.
- Isolated test tenant and all its sessions/events removed after checks. No provider requests or paid calls were made.

## Explicit tenant configuration

| Tenant | Concurrent | Hourly | Daily calls | Daily USD ceiling | Reserved USD/call | Maximum seconds |
|---|---:|---:|---:|---:|---:|---:|
| nyhavna-lokal-benchmark | 3 | 60 | 100 | 50 | 5 | 1650 |
| nyhavna-lokal-demo | 5 | 60 | 200 | 100 | 5 | 1650 |

All identities are explicit internal demos, with matching internal_demo_id and null customer_id/project_id. Admission limits are durable database values. The runtime must stop at its configured duration and monetary reservation; this database cannot itself terminate a provider call.

The admission/recovery race matrix passed in two complete repetitions: 12 reservation attempts produced two accepted sessions and 10 admission-limit denials; 12 recovery attempts produced exactly two claims. Each repetition used a fresh isolated tenant, removed afterward. The second repetition also audited the full privilege matrix.

## Method and limits

Used six independent psql subprocesses/connections for each race, a short tenant-row lock to queue competing reservations, transaction-scoped SQL SET LOCAL ROLE for anon/authenticated/service_role access checks, and separate connections for durable rereads. Database credentials were passed only through subprocess environment and never logged. Recovery was tested only after confirming no pre-existing stale sessions.

This proves live database serialization, role restrictions and recovery fencing. It does not prove hosted WebSocket continuity, real provider shutdown or final usage delivery; those require the hosted/audio acceptance checks.
