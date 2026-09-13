import 'server-only';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RealtimeSupervisor } from '@/lib/realtime/server-session';
import { liveHangup } from '@/lib/live/hangup';

/**
 * Én lokal Node-prosess eier hvem som får starte en Live-sesjon, og rydder opp
 * etter en omstart. Samme supervisor-klasse som Realtime-banen, men egen
 * tilstandsfil: to demoer i samme repo skal ikke legge på hverandres samtaler.
 */
const stateFile = () => join(process.cwd(), '.context', 'nyhavna-live-session.json');

const globals = globalThis as typeof globalThis & { placyLiveSupervisor?: RealtimeSupervisor };

export function getLiveSupervisor() {
  return globals.placyLiveSupervisor ??= new RealtimeSupervisor({
    stop: liveHangup,
    read: async () => {
      try {
        const parsed = JSON.parse(await readFile(stateFile(), 'utf8'));
        if (typeof parsed.sessionId !== 'string') throw new Error('Invalid session state');
        return parsed.sessionId;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    save: async (sessionId) => {
      await mkdir(join(process.cwd(), '.context'), { recursive: true });
      if (!sessionId) { await unlink(stateFile()).catch(error => { if (error.code !== 'ENOENT') throw error; }); return; }
      const tmp = `${stateFile()}.tmp`;
      await writeFile(tmp, JSON.stringify({ sessionId }), { mode: 0o600 });
      await rename(tmp, stateFile());
    },
  });
}
