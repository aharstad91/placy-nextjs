import { experimental_upgradeWebSocket } from '@vercel/functions';
import { hasHostedAccess, requestDemoAccess } from '@/lib/live/hosted-access';
import { runHostedControl } from '@/lib/live/hosted-control';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;
export async function GET(request: Request) {
  if (!hasHostedAccess(request)) return new Response(null, {status:404});
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response(null, {status:426});
  const access = requestDemoAccess(request)!;
  return experimental_upgradeWebSocket(socket => runHostedControl(socket,access), {maxPayload:50000});
}
