"use client";

import type { LiveVoice } from "@/lib/live/voices";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveBoardState, LiveContextMessage, LiveMessage, LiveServerMessage, LiveStatus, MapDirective } from "@/lib/live/types";
import { LIVE_SESSION_WARNING_MS } from "@/lib/live/session-limits";
import { MAP_TOOLS } from "@/lib/realtime/types";

/**
 * Nyhavna-samtalen på GPT-Live-1 (2026-09-13).
 *
 * Forskjellen fra Realtime-hooken denne erstatter er hvem som eier turene.
 * Live er full duplex: lyden flyter kontinuerlig begge veier, modellen
 * bestemmer selv når den snakker, og det finnes verken `response.create` per
 * tur eller turgrenser i transkriptet. Derfor gjør denne hooken tre ting
 * annerledes:
 *
 * 1. Mikrofonsporet står PÅ fra sekundet det er koblet til. Realtime-koden
 *    dempet mikrofonen til hilsenen var ferdig spilt; Live kvitterer ikke
 *    kontekst-appends før lydrammer flyter, så en dempet mikrofon gjør at
 *    hilsenen aldri leveres (målt mot ekte API 2026-09-13).
 * 2. Kartkommandoene kommer IKKE på datakanalen. Serveren eier verktøysløyfen
 *    og sender kartdirektiver over kontrollforbindelsen (lokalt: SSE/HTTP). Datakanalen brukes bare til å lese transkript,
 *    forbruk og feil – og til å sende hilsenen.
 * 3. «Snakker» avgjøres av FAKTISK avspilling (RMS på den mottatte lyden),
 *    ikke av transkriptet. Transkriptfragmenter kommer før og etter lyden, så
 *    et transkriptbasert signal ville blinket feil i begge ender.
 */

/** Stemmeprisen for gpt-live-1 (models_gpt-live-1.md, 2026-09-13): $0,05 per minutt, fakturert per sekund. Backend-kostnaden ligger i serverloggen. */
const VOICE_USD_PER_SECOND = 0.05 / 60;
/** Nytt transkript-innslag når det er mer enn dette mellom fragmentene – Live har ingen turgrenser å lene seg på. */
const TRANSCRIPT_GAP_MS = 1500;
/** Hvor lenge lyden regnes som «ute» etter siste ramme over terskel. Kort med vilje: den gater ekko-målingen av brukerens mikrofon. */
const SPEAKING_HOLD_MS = 300;
const SPEAKING_RMS = 0.012;
/**
 * Hvor lenge ETIKETTEN «snakker» står etter siste lyd. Stemmen tar pusterom på
 * 0,5–1,5 s mellom setninger, og med 300 ms blinket feltet «lytter» i hver
 * pause (Andreas, 2026-09-14). Brukerens egne ord bryter ventetiden: sier hen
 * noe, går feltet til «lytter» med en gang.
 */
const SPEAKING_LINGER_MS = 1800;
/** Stillhet fra stemmen før vi kaller det «undersøker». */
const THINKING_AFTER_MS = 1200;
/** Pause etter brukerens siste fragment før vi antar at hen er ferdig med å snakke. */
const USER_SETTLE_MS = 400;
const METER_INTERVAL_MS = 100;
/** Brukerens egen stemme: terskel og holdetid for «hører deg»-ringen. Lavere enn stemmens, mikrofoner er svakere enn fjernlyd. */
const HEARING_RMS = 0.015;
const HEARING_HOLD_MS = 250;
const ICE_TIMEOUT_MS = 10000;
const SESSION_START_TIMEOUT_MS = 15000;
/** Puffet som får stemmen til å si hilsenen med én gang (se `session.instructions.appended`-casen). */
const GREETING_KICK = "Begynn samtalen nå: si hilsenen slik instruksjonen sier, og vent så på brukeren.";

export interface LiveOptions {
  voice?: LiveVoice;
  /** Internal benchmark labels; authorization is checked by the server. */
  testRunId?: string;
  scenarioId?: string;
  /** Kartkommandoen serveren ba om. Returverdien er ren kartstatus, aldri fakta. */
  executeTool: (name: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
  getContext: () => LiveBoardState;
  snapshotId?: string;
  /**
   * Hvilket datagrunnlag guiden skal snakke ut fra (`lib/live/demos.ts`).
   * Utelatt = serverens standard, den frosne Nyhavna-demoen.
   */
  dataset?: string;
  /** Hilsenen, formulert som en instruksjon til stemmen (`session.instructions.append`). */
  greeting: string;
}

interface Connection {
  generation: number;
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  audio: HTMLAudioElement;
  transceiver: RTCRtpTransceiver;
  abort: AbortController;
  stream?: MediaStream;
  sessionToken?: string;
  events?: EventSource;
  control?: WebSocket;
  stopping?: boolean;
  drainTimer?: ReturnType<typeof setTimeout>;
  finishDrain?: () => void;
  warningMs?: number;
  audioContext?: AudioContext;
  meter?: ReturnType<typeof setInterval>;
  warningTimer?: ReturnType<typeof setTimeout>;
  started: boolean;
  /** Serveren har avsluttet sesjonen; da skal vi ikke sende en ny DELETE. */
  ended: boolean;
  greetingEventId: string;
  greetingKicked: boolean;
  speaking: boolean;
  loudAt: number;
  lastAssistantAt: number;
  lastUserAt: number;
  transcript: { role: "user" | "assistant"; id: string; endMs: number } | null;
}

interface LiveEvent {
  type?: string;
  client_event_id?: string;
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  usage?: { seconds?: number };
  reason?: string;
  error?: { code?: string; message?: string };
}

function friendlyError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Mikrofonen er ikke tilgjengelig. Tillat mikrofon i nettleseren, og prøv igjen.";
  if (error instanceof DOMException && error.name === "NotFoundError") return "Fant ingen mikrofon. Koble til en mikrofon, og prøv igjen.";
  return error instanceof Error ? error.message : "Samtalen ble avbrutt. Prøv igjen.";
}

export function useLive(options: LiveOptions) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [interruptionVersion, setInterruptionVersion] = useState(0);
  // Brukeren snakker akkurat nå (etter mikrofonens eget nivå). Nivået ligger i
  // en ref, ikke i state: det oppdateres ti ganger i sekundet og skal bare
  // drive en ring, ikke rendre boardet.
  const [hearing, setHearing] = useState(false);
  const micLevel = useRef(0);
  const [usage, setUsage] = useState({ voiceSeconds: 0, estimatedUsd: 0 });
  const connection = useRef<Connection | null>(null);
  const generation = useRef(0);
  const startRequest = useRef(0);
  const contextSent = useRef("");
  const cleanupToken = useRef<string | undefined>(undefined);
  const cleanupPending = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestOptions = useRef(options);
  useEffect(() => { latestOptions.current = options; }, [options]);

  const dispose = useCallback(() => {
    generation.current += 1;
    contextSent.current = "";
    const current = connection.current;
    connection.current = null;
    if (!current) return;
    clearInterval(current.meter);
    clearTimeout(current.warningTimer);
    clearTimeout(current.drainTimer);
    current.finishDrain?.();
    current.abort.abort();
    if (current.control?.readyState === WebSocket.OPEN && !current.ended && !current.stopping) current.control.send(JSON.stringify({ type: "stop" }));
    current.control?.close();
    current.events?.close();
    current.stream?.getTracks().forEach(track => track.stop());
    current.channel.close();
    current.pc.close();
    current.audio.pause();
    current.audio.srcObject = null;
    current.audio.remove();
    void current.audioContext?.close().catch(() => {});
    // Serveren har alt ryddet når den selv avsluttet; en ny DELETE ville bare
    // treffe et ukjent token.
    if (current.sessionToken && !current.ended) {
      cleanupToken.current = current.sessionToken;
      cleanupPending.current = fetch("/api/prototype/live", { method: "DELETE", headers: { "X-Placy-Session": current.sessionToken }, keepalive: true }).then(response => response.ok).catch(() => false);
    }
  }, []);

  useEffect(() => () => { startRequest.current += 1; dispose(); }, [dispose]);

  const stop = useCallback(() => {
    startRequest.current += 1;
    const current = connection.current;
    if (current?.control && !current.ended) {
      if (!current.stopping) {
        current.stopping = true;
        generation.current += 1;
        current.abort.abort();
        clearInterval(current.meter);
        clearTimeout(current.warningTimer);
        current.stream?.getTracks().forEach(track => { track.enabled = false; });
        if (current.transceiver.sender.track) current.transceiver.sender.track.enabled = false;
        current.audio.pause();
        cleanupPending.current = new Promise(resolve => { current.finishDrain = () => resolve(true); });
        if (current.control.readyState === WebSocket.OPEN) {
          current.control.send(JSON.stringify({ type: "stop" }));
          current.drainTimer = setTimeout(dispose, 8000);
        } else dispose();
      }
    } else dispose();
    setNotice(null);
    setHearing(false);
    micLevel.current = 0;
    setStatus("idle");
  }, [dispose]);

  const send = useCallback((event: Record<string, unknown>) => {
    const current = connection.current;
    if (current?.channel.readyState !== "open") return false;
    current.channel.send(JSON.stringify(event));
    return true;
  }, []);

  const sendContext = useCallback((message: LiveContextMessage) => {
    const current = connection.current;
    if (!current || current.stopping || (!current.sessionToken && !current.control)) return;
    const body = JSON.stringify(message);
    // Karttilstanden meldes hver gang React committer; bare endringer er nytt
    // for serveren, og hver melding koster en kontekst-append hos stemmen.
    if (message.kind === "state") {
      if (contextSent.current === body) return;
      contextSent.current = body;
    }
    if (current.control) {
      if (current.control.readyState === WebSocket.OPEN) current.control.send(JSON.stringify({ type: "context", message }));
      return;
    }
    if (!current.sessionToken) return;
    void fetch("/api/prototype/live/context", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Placy-Session": current.sessionToken },
      body,
    }).catch(() => {});
  }, []);

  const addMessage = useCallback((message: LiveMessage, append = false) => {
    setMessages(previous => {
      const exists = previous.some(item => item.id === message.id);
      if (!exists) return [...previous.slice(-99), message];
      return previous.map(item => item.id === message.id ? { ...message, text: append ? item.text + message.text : message.text } : item);
    });
  }, []);

  const sendText = useCallback((text: string) => {
    const content = text.trim().slice(0, 4000);
    if (!content) return;
    setError(null);
    setNotice(null);
    addMessage({ id: `user-${crypto.randomUUID()}`, role: "user", text: content });
    sendContext({ kind: "text", text: content });
  }, [addMessage, sendContext]);

  const replaceMicrophoneTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const current = connection.current;
    if (!current) return;
    // `null` betyr «tilbake til den ekte mikrofonen», ikke «send ingenting»:
    // Live kvitterer ikke kontekst før det flyter lydrammer.
    await current.transceiver.sender.replaceTrack(track ?? current.stream?.getAudioTracks()[0] ?? null);
  }, []);

  const start = useCallback(async () => {
    const requestId = ++startRequest.current;
    if (connection.current?.stopping) await cleanupPending.current;
    if (requestId !== startRequest.current) return;
    dispose();
    const run = generation.current;
    setStatus("connecting");
    setError(null);
    setNotice(null);
    setMessages([]);
    setUsage({ voiceSeconds: 0, estimatedUsd: 0 });
    try {
      let cleaned = await cleanupPending.current;
      if (!cleaned && cleanupToken.current) {
        cleaned = await fetch("/api/prototype/live", { method: "DELETE", headers: { "X-Placy-Session": cleanupToken.current } }).then(response => response.ok).catch(() => false);
        cleanupPending.current = Promise.resolve(cleaned);
      }
      if (cleaned) cleanupToken.current = undefined;
      if (run !== generation.current) return;
      if (!cleaned) throw new Error("Forrige samtale kunne ikke avsluttes. Vent på serverens opprydding før du prøver igjen.");

      // Sjekk oppsettet før vi ber om mikrofontillatelse.
      const dataset = latestOptions.current.dataset;
      const selectedVoice = latestOptions.current.voice;
      const health = await fetch(`/api/prototype/live${dataset ? `?dataset=${encodeURIComponent(dataset)}` : ""}`, { cache: "no-store" });
      if (run !== generation.current) return;
      if (!health.ok) throw new Error("Samtalen er ikke tilgjengelig. Kontroller tilgangen og prøv igjen.");
      const configured = await health.json() as { configured?: boolean; protocol?: string; snapshotId?: string; transport?: string; warningMs?: number };
      if (run !== generation.current) return;
      // Ingen reservevei til Realtime: en server som ikke svarer «live» ville
      // gitt en samtale med andre turregler enn resten av koden regner med.
      if (configured.protocol !== "live") throw new Error("Serveren kjører ikke Live-protokollen. Start serveren på nytt med Live-ruten før du prøver igjen.");
      if (!configured.configured) throw new Error("Tale er ikke koblet til ennå. Legg OPENAI_API_KEY i .env.local, og prøv igjen.");
      const snapshotId = latestOptions.current.snapshotId ?? configured.snapshotId;
      if (!snapshotId) throw new Error("Åpne Nyhavna-demoen med riktig dataversjon før du starter samtalen.");
      if (!window.RTCPeerConnection) throw new Error("Nettleseren støtter ikke talesamtaler. Prøv Chrome eller Safari.");

      const pc = new RTCPeerConnection();
      // Datakanalen må finnes FØR tilbudet lages, ellers mangler den i SDP-en.
      const channel = pc.createDataChannel("oai-events");
      const transceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
      const audio = new Audio();
      audio.autoplay = true;
      const current: Connection = {
        generation: run, pc, channel, audio, transceiver, abort: new AbortController(),
        started: false, ended: false, greetingEventId: `greeting-${crypto.randomUUID()}`, greetingKicked: false, speaking: false, loudAt: 0,
        lastAssistantAt: 0, lastUserAt: 0, transcript: null, warningMs: configured.warningMs,
      };
      connection.current = current;
      const active = () => connection.current === current && run === generation.current;

      const settle = () => {
        if (!active() || !current.started) return;
        if (current.speaking) { setStatus("speaking"); return; }
        const now = Date.now();
        const lingering = now - current.loudAt < SPEAKING_LINGER_MS && current.lastUserAt < current.loudAt;
        if (lingering) { setStatus("speaking"); return; }
        // «Undersøker» er stillhet ETTER at brukeren sa noe: stemmen har
        // hverken ord eller lyd ute, og siste ord i rommet var brukerens.
        // Den lille pausen etter brukerens siste fragment holder etiketten på
        // «lytter» mens hen fortsatt snakker.
        const waiting = current.lastUserAt > current.lastAssistantAt
          && now - current.lastAssistantAt > THINKING_AFTER_MS
          && now - current.lastUserAt > USER_SETTLE_MS;
        setStatus(waiting ? "thinking" : "listening");
      };

      /**
       * Måleren leser den MOTTATTE lyden, ikke transkriptet: fragmentene kommer
       * både før og etter at ordene faktisk høres. Klokken går uansett om
       * måleren finnes, så etiketten skifter til «undersøker» av seg selv.
       */
      let analyser: AnalyserNode | null = null;
      let samples = new Float32Array(new ArrayBuffer(0));
      let micAnalyser: AnalyserNode | null = null;
      let micSamples = new Float32Array(new ArrayBuffer(0));
      let heardAt = 0;
      const rms = (node: AnalyserNode, buffer: Float32Array<ArrayBuffer>) => {
        node.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        return Math.sqrt(sum / buffer.length);
      };
      current.meter = setInterval(() => {
        if (!active()) return;
        const now = Date.now();
        if (analyser && rms(analyser, samples) > SPEAKING_RMS) current.loudAt = now;
        current.speaking = now - current.loudAt < SPEAKING_HOLD_MS;
        // Brukerens stemme måles bare når guiden er stille: ekkoet av hennes
        // egen lyd i rommet skal ikke lese som at brukeren snakker.
        if (micAnalyser && !current.speaking) {
          const level = rms(micAnalyser, micSamples);
          if (level > HEARING_RMS) heardAt = now;
          micLevel.current = Math.min(1, level / 0.12);
        } else {
          micLevel.current = 0;
        }
        setHearing(current.started && now - heardAt < HEARING_HOLD_MS);
        settle();
      }, METER_INTERVAL_MS);

      const audioContext = () => {
        if (current.audioContext) return current.audioContext;
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        current.audioContext = new Ctor();
        return current.audioContext;
      };
      const meterRemoteAudio = (stream: MediaStream) => {
        try {
          const context = audioContext();
          if (!context) return;
          const node = context.createAnalyser();
          node.fftSize = 512;
          context.createMediaStreamSource(stream).connect(node);
          samples = new Float32Array(new ArrayBuffer(node.fftSize * 4));
          analyser = node;
        } catch {
          // Uten måler står status på «lytter» og «undersøker»; samtalen går som før.
        }
      };
      const meterMicrophone = (stream: MediaStream) => {
        try {
          const context = audioContext();
          if (!context) return;
          const node = context.createAnalyser();
          node.fftSize = 512;
          context.createMediaStreamSource(stream).connect(node);
          micSamples = new Float32Array(new ArrayBuffer(node.fftSize * 4));
          micAnalyser = node;
        } catch {
          // Uten måler puster ringen bare; samtalen går som før.
        }
      };

      const appendTranscript = (role: "user" | "assistant", event: LiveEvent) => {
        const delta = event.delta;
        if (!delta) return;
        const now = Date.now();
        if (role === "assistant") current.lastAssistantAt = now; else current.lastUserAt = now;
        const startMs = typeof event.start_ms === "number" ? event.start_ms : null;
        const previous = current.transcript;
        // Live sender fragmenter uten turgrenser og uten item-ID: bruker og
        // assistent kan overlappe. Et nytt innslag begynner når taleren bytter
        // eller det er en tydelig pause i den samme talerens tidslinje.
        const fresh = !previous || previous.role !== role || (startMs !== null && startMs - previous.endMs > TRANSCRIPT_GAP_MS);
        const id = fresh ? `${role}-${crypto.randomUUID()}` : previous.id;
        current.transcript = { role, id, endMs: event.end_ms ?? startMs ?? (fresh ? 0 : previous.endMs) };
        addMessage({ id, role, text: delta }, !fresh);
        settle();
      };

      const noteUsage = (event: LiveEvent) => {
        const seconds = event.usage?.seconds;
        if (typeof seconds !== "number") return;
        // Snapshots, ikke inkrementer: siste tall er fasiten.
        setUsage({ voiceSeconds: seconds, estimatedUsd: seconds * VOICE_USD_PER_SECOND });
      };

      pc.ontrack = event => {
        if (!active()) return;
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        audio.srcObject = stream;
        meterRemoteAudio(stream);
        void audio.play?.().catch(() => {
          if (active()) {
            setInterruptionVersion(version => version + 1);
            setError("Nettleseren stoppet lydavspillingen. Start samtalen på nytt.");
          }
        });
      };
      pc.onconnectionstatechange = () => {
        if (!active()) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          dispose();
          setError("Forbindelsen ble brutt. Trykk start for å koble til igjen.");
          setStatus("error");
        }
      };
      channel.onclose = () => {
        if (!active() || current.control) return; // Hosted control owns final cleanup.
        dispose();
        setError("Samtalen ble avsluttet. Du kan starte en ny.");
        setStatus("error");
      };

      // `session.started` er kvitteringen på at Live-sesjonen lever. Den kommer
      // på datakanalen, så ventingen må stå klar før den første meldingen.
      let sessionStarted: () => void = () => {};
      let startedTimeout: ReturnType<typeof setTimeout> | undefined;
      const startedPromise = new Promise<void>((resolve, reject) => {
        sessionStarted = resolve;
        startedTimeout = setTimeout(() => reject(new Error("Samtalen svarte ikke i tide. Prøv igjen.")), SESSION_START_TIMEOUT_MS);
        current.abort.signal.addEventListener("abort", () => {
          clearTimeout(startedTimeout);
          reject(new DOMException("Cancelled", "AbortError"));
        }, { once: true });
      });

      // Cancellation may happen before SDP negotiation; keep rejection handled.
      void startedPromise.catch(() => {});

      channel.onmessage = message => {
        if (connection.current !== current) return;
        let event: LiveEvent;
        try { event = JSON.parse(message.data) as LiveEvent; } catch { return; }
        if (current.stopping) {
          if (event.type === "session.usage.updated" || event.type === "session.closed") noteUsage(event);
          return;
        }
        if (!active()) return;
        switch (event.type) {
          case "session.started":
            if (!current.started) {
              current.warningTimer = setTimeout(() => {
                if (active()) setNotice("Samtalen avsluttes om cirka to minutter. Du kan starte en ny samtale etterpå.");
              }, current.warningMs ?? LIVE_SESSION_WARNING_MS);
            }
            current.started = true;
            sessionStarted();
            break;
          case "session.instructions.appended":
            // Målt mot ekte API 2026-09-13: hilsenen som instruksjon alene ga
            // ingen tale – modellen ventet på brukeren. Et kort «begynn nå» som
            // kommentar (docs: «Greet before the caller speaks») fikk den til å
            // si hilsenen ordrett. Sendes først når instruksen er kvittert, så
            // puffet ikke kommer før teksten det peker på.
            if (event.client_event_id === current.greetingEventId && !current.greetingKicked) {
              current.greetingKicked = true;
              send({ type: "session.commentary.append", event_id: `greeting-kick-${crypto.randomUUID()}`, delegation_id: null, content: GREETING_KICK });
            }
            break;
          case "session.input_transcript.delta":
            appendTranscript("user", event);
            break;
          case "session.output_transcript.delta":
            appendTranscript("assistant", event);
            break;
          case "session.usage.updated":
            noteUsage(event);
            break;
          case "session.closed":
            noteUsage(event);
            if (current.control) break; // Server closes only after final accounting drains.
            current.ended = true;
            dispose();
            setError("Samtalen ble avsluttet. Du kan starte en ny.");
            setStatus("error");
            break;
          case "error":
            // Moderasjon kan kutte ett svar uten å drepe sesjonen; å legge på
            // ville vært å avslutte en samtale som fortsatt lever.
            setInterruptionVersion(version => version + 1);
            setNotice("Noe avbrøt svaret. Spør gjerne igjen.");
            break;
        }
      };

      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofon krever localhost eller HTTPS.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!active()) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      meterMicrophone(stream);
      const track = stream.getAudioTracks()[0];
      // Sporet står på fra start, også under hilsenen: Live kvitterer ikke
      // kontekst-appends uten lydrammer, og hilsenen ER en kontekst-append.
      if (track) await transceiver.sender.replaceTrack(track);
      if (!active()) return;

      const offer = await pc.createOffer();
      if (!active()) return;
      await pc.setLocalDescription(offer);
      if (!active()) return;
      await new Promise<void>(resolve => {
        if (pc.iceGatheringState === "complete") { resolve(); return; }
        const finish = () => { clearTimeout(timeout); pc.removeEventListener?.("icegatheringstatechange", check); resolve(); };
        const check = () => { if (pc.iceGatheringState === "complete") finish(); };
        // Live-tilbudet sendes som én blokk (ingen trickle). Tar innsamlingen
        // for lang tid, sender vi det vi har heller enn å stoppe samtalen.
        const timeout = setTimeout(finish, ICE_TIMEOUT_MS);
        pc.addEventListener?.("icegatheringstatechange", check);
        check();
      });
      if (!active()) return;

      const handleServerMessage = async (payload: LiveServerMessage) => {
        if (connection.current !== current) return;
        if (payload.type === "ended") {
          const stopped = current.stopping;
          current.ended = true;
          dispose();
          if (!stopped) { setError(payload.message); setStatus("error"); }
          return;
        }
        if (!active() || current.stopping || payload.type !== "map") return;
        const directive: MapDirective = payload.directive;
        if (!directive || typeof directive.id !== "string" || typeof directive.name !== "string") return;
        let output: unknown;
        try {
          if (!MAP_TOOLS.has(directive.name) && !(dataset === "nyhavna-lokal" && directive.name === "reveal_places")) throw new Error("Ukjent kartkommando");
          if (directive.args && (typeof directive.args !== "object" || Array.isArray(directive.args))) throw new Error("Ugyldig kartkommando");
          output = await latestOptions.current.executeTool(directive.name, directive.args ?? {});
        } catch {
          output = { error: "Kartkommandoen kunne ikke utføres. Ikke påstå at kartet ble flyttet." };
        }
        if (!active() || current.stopping) return;
        const result = { id: directive.id, output: output ?? { ok: true } };
        if (current.control?.readyState === WebSocket.OPEN) current.control.send(JSON.stringify({ type: "map_result", ...result }));
        else if (current.sessionToken) void fetch("/api/prototype/live/map", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Placy-Session": current.sessionToken }, body: JSON.stringify(result),
        }).catch(() => {});
      };
      const request = { sdp: pc.localDescription?.sdp ?? offer.sdp, snapshotId, ...(dataset ? { dataset } : {}), ...(selectedVoice ? { voice: selectedVoice } : {}) };
      let sdp: string | undefined;
      if (configured.transport === "websocket") {
        const url = new URL("/api/live/control", window.location.href);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const control = new WebSocket(url);
        current.control = control;
        sdp = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Samtalen svarte ikke i tide. Prøv igjen.")), SESSION_START_TIMEOUT_MS);
          const fail = (message: string) => {
            clearTimeout(timeout);
            reject(new Error(message));
            if (connection.current !== current) return;
            const stopped = current.stopping;
            dispose();
            if (!stopped) { setError(message); setStatus("error"); }
          };
          current.abort.signal.addEventListener("abort", () => { clearTimeout(timeout); reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
          control.onopen = () => {
            if (!active()) return;
            control.send(JSON.stringify({ type: "start", ...request, ...(latestOptions.current.testRunId ? { testRunId: latestOptions.current.testRunId } : {}), ...(latestOptions.current.scenarioId ? { scenarioId: latestOptions.current.scenarioId } : {}) }));
          };
          control.onmessage = event => {
            if (connection.current !== current) return;
            let payload;
            try { payload = JSON.parse(event.data); } catch { return; }
            if (!payload || typeof payload !== "object") return;
            if (payload.type === "ready") {
              if (!active()) return;
              if (typeof payload.sdp !== "string" || !payload.sdp) { fail("Serveren svarte uten lydforbindelse. Prøv igjen."); return; }
              clearTimeout(timeout);
              if (typeof payload.warningMs === "number" && payload.warningMs > 0) current.warningMs = payload.warningMs;
              resolve(payload.sdp);
            } else if (payload.type === "error") fail("Samtalen kunne ikke fortsette. Trykk start for å prøve igjen.");
            else void handleServerMessage(payload);
          };
          control.onclose = () => fail("Forbindelsen ble brutt. Trykk start for å koble til igjen.");
          control.onerror = () => fail("Forbindelsen ble brutt. Trykk start for å koble til igjen.");
        });
      } else {
        const response = await fetch("/api/prototype/live", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: current.abort.signal,
        });
        if (!active()) return;
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(payload.error || "Samtalen kunne ikke starte. Prøv igjen.");
        }
        current.sessionToken = response.headers?.get?.("X-Placy-Session") ?? undefined;
        const payload = await response.json() as { sdp?: string };
        sdp = payload.sdp;
      }
      if (!active()) return;
      if (!sdp) throw new Error("Serveren svarte uten lydforbindelse. Prøv igjen.");
      await pc.setRemoteDescription({ type: "answer", sdp });
      if (!active()) return;
      await startedPromise;
      clearTimeout(startedTimeout);
      if (!active()) return;
      setStatus("listening");
      if (current.sessionToken) {
        const events = new EventSource(`/api/prototype/live/map?session=${encodeURIComponent(current.sessionToken)}`);
        current.events = events;
        events.onmessage = message => {
          let payload: LiveServerMessage;
          try { payload = JSON.parse(message.data) as LiveServerMessage; } catch { return; }
          if (payload && typeof payload === "object") void handleServerMessage(payload);
        };
      }

      sendContext({ kind: "state", ...latestOptions.current.getContext() });
      // Hilsenen er en instruksjon til stemmen, ikke et svar: Live har ingen
      // «lag et svar nå»-kommando, og ingen «hilsen ferdig»-event.
      send({ type: "session.instructions.append", event_id: current.greetingEventId, delegation_id: null, content: latestOptions.current.greeting });
    } catch (caught) {
      if (run !== generation.current) return;
      dispose();
      setError(friendlyError(caught));
      setStatus("error");
    }
  }, [addMessage, dispose, send, sendContext]);

  // Siste assistentinnslag, ikke siste fragment: kontrollen viser det som en
  // lesbar setning mens lyden går.
  const latest = messages.filter(message => message.role === "assistant").at(-1)?.text ?? null;
  return { status, hearing, micLevel, messages, latest, error, notice, interruptionVersion, usage, start, stop, sendContext, sendText, replaceMicrophoneTrack };
}
