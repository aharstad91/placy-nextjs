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
    - lib/live/production-board.ts
    - lib/live/production-board.test.ts
    - lib/realtime/nyhavna-knowledge.ts
    - PROJECT-LOG.md
  summary: Rettet report-koblede Anjas Transittkaia-oppslag uten å endre standardboardet, og deployet samt validerte nytt Nyhavna-board med 1054 steder på placy.no/nyhavna.
  status: deployed
  detail: Mapped publishedKnowledge ble gjort søkbart som prosjektkunnskap, authored plan-1/2/3-rekkefølge ble bevart, og talevarianter som «Transit Kaia», «Transitkaia» og «Transit-kaja» ble normalisert i både prosjekt- og stedsoppslag. Deployment dpl_6VuWMddbnXxKMiZtASbSSjGpqG23 ble testet isolert og promotert. Ekte WebRTC-tester på placy.no bekreftet report-datasettet, 1054 steder, korrekt Transittkaia-svar og en bred Nyhavna-beskrivelse. En feilaktig mellomdeploy av den gamle 75-stedersdemoen ble rullet tilbake før den endelige rettingen.
