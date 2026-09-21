- date: 2026-09-21
  action: deployed
  files:
    - app/[slug]/page.test.tsx
    - app/[slug]/page.tsx
    - app/api/prototype/live/route.ts
    - app/eiendom/[customer]/[project]/rapport-board/page.test.tsx
    - app/eiendom/[customer]/[project]/rapport-board/page.tsx
    - components/variants/report/board/voice/BoardVoiceControl.test.tsx
    - components/variants/report/board/voice/board-voice.tsx
    - components/variants/report/reels/ReportReelsPage.tsx
    - lib/live/hosted-control.test.ts
    - lib/live/hosted-control.ts
    - lib/live/production-board.ts
    - lib/live/projects.test.ts
    - lib/live/projects.ts
    - lib/live/route.test.ts
    - lib/live/use-live.test.tsx
    - lib/live/use-live.ts
    - lib/public-projects.test.ts
    - lib/public-projects.ts
    - PROJECT-LOG.md
    - docs/research/voice-infrastructure/2026-09-21-claude-placy-consolidation-prompt.md
  summary: Lanserte det nye standardboardet på placy.no/nyhavna med report-koblet Anja over den eksisterende hosted WebSocket-infrastrukturen, og verifiserte desktop, mobil, talespørsmål, kartkommando, stop og ledger i produksjon.
  status: deployed
  detail: Produksjonsdeployment dpl_FekWTAh9U62X65adnQUtSiaGqbkn erstattet den tidligere offentlige deploymenten etter isolert kandidatkontroll. Nyhavna-assistenten ble aktivert med bevart før-snapshot. Leangenbukta og Lillebytunet ble ikke endret.
- date: 2026-09-21
  action: fixed
  files:
    - app/[slug]/page.test.tsx
    - app/[slug]/page.tsx
    - app/demo/nyhavna-lokal/lokal-board-gate.tsx
    - components/variants/report/board/voice/BoardVoiceControl.test.tsx
    - components/variants/report/board/voice/board-voice.tsx
    - PROJECT-LOG.md
    - WORKLOG.md
  summary: Rettet produksjonsavviket der Anja manglet Transittkaia-detaljer ved å la den offentlige Nyhavna-ruten bruke nøyaktig samme registrerte board- og samtalekilde som localhost.
  status: deployed
  detail: Deployment dpl_7F1wEAdWFtok2VNDAL4BS88dDUfG er live på placy.no. Readiness bekrefter dataset nyhavna-lokal over websocket, og produksjons-HTML-en inneholder samme dataset og Transittkaia-innhold. 78 målrettede tester, TypeScript og målrettet lint passerer.
