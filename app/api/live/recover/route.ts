import { randomUUID } from 'node:crypto';
import { createVoiceLedger } from '@/lib/live/metering';
import { liveHangup, LIVE_SESSION_ID } from '@/lib/live/hangup';
import { constantTimeEqual } from '@/lib/live/hosted-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Admission may be disabled while old deployments still own paid sessions.
  if (!secret || secret.length < 32) return new Response(null,{status:404});
  if(!constantTimeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return new Response(null,{status:401});
  const ledger = createVoiceLedger();
  try {
    const ownerToken = randomUUID();
    const sessions = await ledger.claimStaleRecoveries({ownerToken,limit:5});
    const outcomes = await Promise.all(sessions.map(async session => {
      let providerClosed = session.provider_closed;
      if(session.provider_session_id && LIVE_SESSION_ID.test(session.provider_session_id)) {
        try {await liveHangup(session.provider_session_id);providerClosed=true;} catch { /* Retry lease remains durable. */ }
      }
      await ledger.finalize({sessionId:session.id,ownerToken,terminationReason:'owner_lost',providerClosed,finalUsageConfirmed:false});
      if (!providerClosed) console.error('voice_recovery_unresolved',{sessionId:session.id});
      return providerClosed;
    }));
    return Response.json({claimed:outcomes.length,closed:outcomes.filter(Boolean).length,unresolved:outcomes.filter(value=>!value).length},{headers:{'Cache-Control':'no-store'}});
  } catch {
    console.error('voice_recovery_failed');
    return Response.json({error:'Recovery unavailable'},{status:503});
  }
}
