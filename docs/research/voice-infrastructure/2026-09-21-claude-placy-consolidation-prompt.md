# Claude-prompt: konsolider hosted Anja i det varige Placy-oppsettet

Kopier alt fra «PROMPT» og ned i en ny Claude Code-sesjon med repoet som arbeidsmappe.

## PROMPT

Du er tech lead og teknisk motpart. Vær uenig når koden eller driftsdataene tilsier det. Bruk Opus som hovedagent. Fan ut Sonnet-agenter på medium effort til avgrensede, uavhengige lesespor eller testspor når det gir reell parallellitet; én agent skal eie skriv til overlappende filer. Ikke stopp ved en plan dersom arbeidet kan gjennomføres trygt.

### Mål

Flytt eller konsolider den fungerende hosted voice/WebSocket-infrastrukturen fra Vercel-prosjektet `placy-nyhavna` til det varige Placy-oppsettet, slik at standardboards kan bruke Anja fra den kanoniske Placy-deploymenten uten prosjektspesifikk sidecar. Bevar den verifiserte produksjonsopplevelsen på `https://placy.no/nyhavna` gjennom hele migreringen. Velg konsolidering fremfor permanent duplisering dersom evidensen støtter det.

### Verifiserte fakta per 2026-09-21

- Hele domenet `placy.no`, ikke bare `/nyhavna`, peker nå på Vercel-prosjektet `placy-nyhavna` (`prj_87r4xPF1YIH4UvUwrOZBAnFzx0SM`).
- Produksjonsdeploymenten er `dpl_FekWTAh9U62X65adnQUtSiaGqbkn`. Forrige kjente rollback-deployment er `dpl_3o3VM6GjRr2u2rxwCH67Eyvps8Ar`.
- Det finnes også et Vercel-prosjekt som heter `placy`, men det betjener ikke `placy.no` i dag. Ikke anta at miljøvariabler, cron, funksjonsgrenser eller domener er like; inspiser dem.
- Nyhavna kjører nå det ordinære standardboardet på `/nyhavna`. Anja bruker eksplisitt `project=nyhavna&source=report`, og serveren laster det autoritative report-produktet.
- Browseren sender lyd direkte til OpenAI over WebRTC. Vår server bytter SDP og holder kontrollforbindelsen.
- `/api/live/control` bruker Vercels `experimental_upgradeWebSocket`. Den samme funksjonen eier OpenAI-sideband, verktøyløkken, kartmeldinger til browseren, rundetak, ledger og avslutning. Produksjonsfunksjonen er konfigurert med lang varighet; kontroller den faktiske bygde `maxDuration`-verdien i begge prosjekter.
- `/api/live/recover` kjøres periodisk og rydder/reparerer sesjoner.
- Registry og adgang ligger i Supabase `v2`: `voice_projects`, `voice_tenants`, `voice_admission_policies`, `voice_sessions`, `voice_usage_events` og tilhørende RPC-er. Browseren velger bare en offentlig slug; serveren validerer binding, prosjekt, produkt, kunde, tenant, formål og policies.
- `source=report` er additivt. Eldre kall uten feltet bruker fortsatt det registrerte demo-datasettet. Report-start validerer produkt-ID, kunde, slug, aktiv assistant og `contentVersion` før samtalen opprettes.
- Nyhavnas aktive report-versjon ved cutover var `78a9614b1b5861ba8f1a9f3ad8ed7b73c284bebbbd8853dc31579e898688596b`.
- En ekte produksjonstest på `placy.no/nyhavna` fikk Anja til å høre et kaféspørsmål, svare med steder fra report-boardet, sende kartkommando og nummerere Dora kaffebar, Ramp Pub & Spiseri og Ladejarlen. Sesjonen ble manuelt lukket. Ledgeren viste ingen aktive eller ugyldige testøkter.
- Det finnes ingen dokumentert grunn til å innføre Fly.io eller en separat container for denne flyten nå. Dagens fungerende Vercel-WebSocket er motbevis mot påstanden om at en ekstern alltid-på-prosess er nødvendig. Endre bare dette dersom du kan vise en konkret, reproducerbar begrensning.

### Før du endrer noe

1. Les `CLAUDE.md` og `AGENTS.md` fullt ut og følg worktree-, test-, logg- og pushreglene.
2. Arbeid i en isolert worktree fra oppdatert `origin/main`. Ikke rør andre pågående worktrees.
3. Inspiser begge Vercel-prosjektene read-only:
   - prosjekt-ID, git/ref og production deployment
   - alle relevante miljøvariabelnavn og hvilke miljøer de finnes i, uten å skrive ut verdier
   - funksjonsruntime, region, minne, `maxDuration`, WebSocket-støtte og cron
   - domener/aliaser og deploy protection
4. Kartlegg den faktiske request-flyten fra boardets `useLive` til readiness, WebSocket start, OpenAI Live/WebRTC, sideband, kartmelding, stop og recovery. Siter fil og linje for hvert ledd.
5. Sammenlign konfigurasjonen i `placy-nyhavna` med `placy`. Lag en eksplisitt gap-liste. Ikke foreslå å kopiere alt ukritisk; klassifiser hvert avvik som nødvendig, foreldet eller irrelevant.

### Beslutning som skal tas

Velg den minste varige arkitekturen som gjør `placy` til én kanonisk deployment for nettsiden og hosted voice. Mest sannsynlig løp er å gjøre `placy` driftsmessig lik den verifiserte deploymenten, validere en isolert production-target deployment uten domene, og deretter flytte `placy.no`. Hvis repo-/prosjektkoblingen eller Vercel-begrensninger tilsier en annen løsning, dokumenter evidensen og velg deretter.

Ikke:

- opprett en ny container eller sidecar uten dokumentert behov
- endre Supabase-identiteter, budgets eller adgangspolicies bare for å få testen grønn
- legge secrets i repo, logger, terminaloutput eller prompt
- flytte domenet før kandidatens board, tale, kart og ledger er verifisert
- slette `placy-nyhavna` eller gamle deployments; de er rollback til migreringen er stabil og Andreas har godkjent opprydding
- endre Leangenbukta- eller Lillebytunet-data som del av infrastrukturflytten

### Implementering

1. Gjør nødvendige kode- og Vercel-konfigurasjonsendringer i den isolerte worktree-en.
2. Sørg for at hosted voice er prosjektuavhengig: samme runtime skal kunne løse enhver aktiv `voice_projects`-binding og hente riktig report-kilde uten slug-spesialkode.
3. Bevar disse invariantene:
   - serverautoritativ prosjekt-/produkt-/tenant-identitet
   - `contentVersion` mellom rendret board og samtalekilde
   - public/benchmark-separasjon og atomisk reservasjon
   - maks seks backend-verktøyrunder eller gjeldende dokumenterte vern
   - aggregerte kostnader/bruk uten lagring av dialogtekst
   - kartkommando fra server til riktig browserforbindelse
   - eksplisitt stop, provider-close, final usage og recovery
   - legacy-kall uten `source=report`
4. Legg til eller oppdater tester for alle nye konfigurasjons- og rutinggrener. Ikke mock bort WebSocket-/prosjektgrensen i den eneste testen som skal bevise migreringen.

### Verifiseringsport før domeneendring

Kjør minst:

- `npm run lint`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- en production-target kandidatdeploy i riktig Vercel-prosjekt uten å flytte domenet
- HTTP 200 og nytt standardboard på kandidatens `/nyhavna`
- readiness som viser `configured: true`, `transport: websocket` og `dataset: report`
- desktop- og mobiltest gjennom splash, tema, sted og tilbakeflyt
- ekte Anja-sesjon med samtykke og mikrofon/WebRTC
- minst ett norsk talespørsmål som krever et kartverktøy
- synlig kartreaksjon med riktige report-steder
- eksplisitt stop og kontroll i `voice_sessions` av lukket state, provider-close, sluttbruk og riktig dataset-versjon
- kontroll av at Leangenbukta og Lillebytunet fortsatt svarer som før

Først når alt dette er grønt kan `placy.no` flyttes til den verifiserte deploymenten. Test deretter de samme kritiske punktene på domenet, ikke bare på kandidat-URL-en.

### Rollback

Før domeneendringen skal du lagre:

- eksakt tidligere deployment-ID og domene-/aliasstatus
- eventuelle miljø- eller cron-endringer
- eventuelle databaseendringer med før-snapshot

Ved kritisk feil etter cutover: flytt domenet tilbake til den eksakte tidligere deploymenten, gjenopprett endret konfigurasjon fra snapshot og verifiser den gamle banen. Ikke improviser en tredje produksjonsarkitektur under rollback.

### Leveranse

Når arbeidet er ferdig, rapporter kort:

- valgt arkitektur og hvorfor
- hvilke Vercel-/kodeendringer som ble gjort
- kandidat- og produksjonsdeployment-ID
- konkret resultat for board, tale, kart og ledger
- hva som er bevart for rollback
- commit/branch/PR-status
- eventuelle resterende risikoer

Logg alt teknisk arbeid i `PROJECT-LOG.md` og alle arbeidsrunder i `WORKLOG.md` etter prosjektets format. Ikke push eller flytt domene uten eksplisitt autorisasjon i sesjonen.
