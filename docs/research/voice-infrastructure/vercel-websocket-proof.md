# Hosted WebSocket proof — 2026-09-16

Vercel Pro, Node 24, Next.js 16.2.10, @vercel/functions 3.9.8, Fluid Compute, dub1. Route declared `maxDuration = 1800` and used `experimental_upgradeWebSocket`. A temporary deployment on the existing Placy project exposed a token-protected echo route.

Two simultaneous clients received distinct connection identities. The short client closed normally after 30 seconds. The long client continued receiving its own echoes past 800 seconds (last echo 818.948 seconds; last server heartbeat 820.017 seconds), then the client closed normally after 825 seconds. Close codes were 1000. Numeric/connection-only evidence is in `vercel-websocket-proof.json`.

This proves the deployed connection can exceed the ordinary 800-second limit and remain isolated from another closing connection. It does not prove OpenAI audio, map tools, final usage, or a 27-minute session; those require the integrated benchmark. The temporary deployment is removed after verification. No OpenAI calls were made by this probe.

Sources: [Vercel WebSockets](https://vercel.com/docs/functions/websockets), [duration configuration](https://vercel.com/docs/functions/configuring-functions/duration), [Functions API](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).
