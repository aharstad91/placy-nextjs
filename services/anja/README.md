# Anja conversation service

This process owns the complete lifetime of production board conversations:
the OpenAI Live session, sideband, conversation state, map bridge and cleanup.
Next.js remains a stateless gateway and is the only caller.

Run it beside Next with:

```bash
npm run anja:service
```

`ANJA_SERVICE_URL` should point Next to the loopback listener. Both processes
must share `ANJA_SERVICE_SECRET`; the browser never receives it. The gateway
stores the service session in the signed `placy_anja` HttpOnly cookie using a
separate `ANJA_CAPABILITY_SECRET`.

Required production properties:

- expose no public port for this service;
- keep one process alive for the duration of every active conversation;
- use sticky or single-instance routing if multiple service instances are run;
- send no transcript, SDP, tool arguments or capability values to application
  logs;
- configure the concurrent, hourly-start and duration caps before enabling an
  ordinary board.

The service reloads the authoritative board source at startup and rejects a
browser whose `contentVersion` is stale before it creates a paid Live session.
