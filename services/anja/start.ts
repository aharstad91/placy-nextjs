import "server-only";

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createAnjaServiceHandler } from "@/services/anja/service";

const port = Number(process.env.ANJA_SERVICE_PORT) || 8787;
const handler = createAnjaServiceHandler();

createServer(async (incoming, outgoing) => {
  const controller = new AbortController();
  incoming.on("aborted", () => controller.abort());
  outgoing.on("close", () => {
    if (!outgoing.writableEnded) controller.abort();
  });
  const origin = `http://${incoming.headers.host ?? `127.0.0.1:${port}`}`;
  const body = incoming.method === "GET" || incoming.method === "HEAD"
    ? undefined
    : Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
  const request = new Request(new URL(incoming.url ?? "/", origin), {
    method: incoming.method,
    headers: incoming.headers as HeadersInit,
    body,
    duplex: body ? "half" : undefined,
    signal: controller.signal,
  } as RequestInit & { duplex?: "half" });
  const response = await handler(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) { outgoing.end(); return; }
  Readable.fromWeb(response.body as never).pipe(outgoing);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Anja service listening on 127.0.0.1:${port}\n`);
});
