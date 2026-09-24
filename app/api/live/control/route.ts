import { experimental_upgradeWebSocket } from '@vercel/functions';
import { hasHostedAccess, requestDemoAccess } from '@/lib/live/hosted-access';
import { CONTROL_MAX_MESSAGE, runHostedControl } from '@/lib/live/hosted-control';
import { hostedChatVisitors } from '@/lib/live/hosted-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 1800;
export async function GET(request: Request) {
  if (!hasHostedAccess(request)) return new Response(null, {status:404});
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response(null, {status:426});
  const access = requestDemoAccess(request)!;
  // The chat surface's visitor is the customer's own (cookie on this upgrade
  // request); decided here once, because messages on the socket carry no cookies.
  const chatVisitors = hostedChatVisitors(request);
  return experimental_upgradeWebSocket(socket => runHostedControl(socket,access,{},chatVisitors), {maxPayload:CONTROL_MAX_MESSAGE});
}
