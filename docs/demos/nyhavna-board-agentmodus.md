# Nyhavna Board med «Spør Anja» — prototype (2026-09-25)

Lokal prototype av Boardets agentmodus: sidebaren veksler mellom **Utforsk** (dagens board) og **Spør Anja** (én samtale med tekst og tale, der kartklikk, forslag og FAQ blir samtaleinnslag). Planen: [`docs/plans/2026-09-25-1220-feat-nyhavna-board-agentmodus-prototype-plan.md`](../plans/2026-09-25-1220-feat-nyhavna-board-agentmodus-prototype-plan.md).

## Starte

```bash
cd ../placy-board-agentmodus        # worktree, gren feat/nyhavna-board-agentmodus
PORT=3021 npm run dev
```

Åpne <http://localhost:3021/demo/nyhavna-lokal>. Krever `OPENAI_API_KEY` i `.env.local` (symlinket fra hovedrepoet). Prototypen er bare slått på for den lokale ruta (`agentMode` fra `app/demo/nyhavna-lokal/page.tsx`); plattformsiden `/nyhavna` og ordinære boards er uendret.

## Slik henger det sammen

- **Veksleren** står der «Snakk med Anja» sto (desktopkolonnen og mobilens sheet). Å gå inn i Spør Anja starter verken mikrofon eller modellkall.
- **Utforsk gjenopprettes eksakt**: board-tilstand, omvisningens stopp og åpne rader, og kamerautsnittet tas vare på ved inngang og legges tilbake ved utgang. Samtalen beholdes for økten.
- **Tekst** går til `POST /api/demo/nyhavna-board-chat` (Board-profil av nettsidechatten: samme kilder, svarvakter, kvoter og signerte historikktoken). Serveren validerer kartkommandoer mot Boardets data og returnerer direktiver; klienten kjører dem gjennom `executeBoardTool` som Anjas egne.
- **Brukerinitiativ**: kartklikk, stedskort og forslag sendes som strukturert `intent` (sted/tema/FAQ). FAQ besvares deterministisk med den godkjente teksten (ingen modellkall, ingen kvote).
- **Tale** bruker Boardets Live-bane med `boardAgent: true`: den skrevne historikken bæres inn, Anja hilser som en fortsettelse, og når talen avsluttes byttes sesjonstokenet mot nytt tekst-token (`/api/prototype/live/handoff`).
- Koden: `components/variants/report/board/agent/` (koordinator + panel), `lib/board-agent/` (kontrakt, klient, feed, forslag), `lib/demo/site-chat/board-map.ts` (servervalidering).

## Testoppskrift (AE1–AE7)

1. Utforsk → Servering → «Dora Kaffebar» → **Spør Anja** → **Utforsk**: samme tema, samme åpne sted, samme kart. Ingen mikrofonprompt.
2. Spør Anja → klikk «Dora 1 Bowling» i kartet (gjerne to ganger): ett stedskort, ett svar, stedet valgt i kartet, intet stedspanel.
3. Skriv «Vis kaféer i nærheten»: tekstsvar med kilder, og kartet fremhever stedene (1, 2 …).
4. Velg et FAQ-forslag: spørsmål og godkjent svar vises straks; mikrofonen er av. Neste forslag er et annet spørsmål eller sted.
5. **Snakk** → «Tillat og start»: Anja knytter an til det som er skrevet. Klikk et sted i kartet: ett stedskort og muntlig kommentar. **Skriv**: talen stopper; et oppfølgingsspørsmål («hva med det stedet?») forstår det som ble sagt.
6. Klikk to steder raskt etter hverandre: to stedskort, bare det siste får svar.
7. Mobil (390 × 844): veksleren i sheeten, velg et kartpunkt over sheeten, les svaret, tilbake til Utforsk.

## Verifisert 2026-09-25

AE1–AE7 kjørt i Chrome mot ekte kart, tekstbane og GPT-Live (simulert mikrofon i en egen Chrome-profil): handoff tale → tekst svarte 200, og tekstsvaret etter talen refererte stedet fra talesamtalen. `npm run lint` (0 feil), `npx tsc --noEmit`, `npm test` (alle grønne) og `npm run build` grønne.

## Kjente begrensninger

- Bare Nyhavna-demoen; ingen produksjonsaktivering, pris eller måling på tvers av produkter (se planens «Deferred»).
- Modusbytte måles ikke i Moat 2: hendelsestypene er et lukket skjema, og en ny type krever migrasjon.
- Tekstbanen og nettsidechatten deler Nyhavnas døgnkvote (40 meldinger per besøkende lokalt).
- Kartmarkører som overlapper i 3D-kartet kan gi et annet sted enn det man siktet på; det er kartets eksisterende treffflate.
- Brukertesten med en person som ikke har bygd løsningen (planens Verification Contract) gjenstår — den gjøres av Andreas.
