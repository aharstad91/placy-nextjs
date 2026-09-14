"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveBoardState, LiveContextMessage, LiveMessage, LiveServerMessage, LiveStatus, MapDirective } from "@/lib/live/types";
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
 *    og sender kartdirektiver over SSE; nettleseren utfører dem og svarer med
 *    kartstatus over HTTP. Datakanalen brukes bare til å lese transkript,
 *    forbruk og feil – og til å sende hilsenen.
 * 3. «Snakker» avgjøres av FAKTISK avspilling (RMS på den mottatte lyden),
 *    ikke av transkriptet. Transkriptfragmenter kommer før og etter lyden, så
 *    et transkriptbasert signal ville blinket feil i begge ender.
 */

/** Stemmeprisen for gpt-live-1 (models_gpt-live-1.md, 2026-09-13): $0,05 per minutt, fakturert per sekund. Backend-kostnaden ligger i serverloggen. */
const VOICE_USD_PER_SECOND = 0.05 / 60;
/** Nytt transkript-innslag når det er mer enn dette mellom fragmentene – Live har ingen turgrenser å lene seg på. */
const TRANSCRIPT_GAP_MS = 1500;
/** Hvor lenge «snakker» holdes etter siste lydramme over terskel, så små pauser i en setning ikke blinker. */
const SPEAKING_HOLD_MS = 300;
const SPEAKING_RMS = 0.012;
/** Stillhet fra stemmen før vi kaller det «undersøker». */
const THINKING_AFTER_MS = 1200;
/** Pause etter brukerens siste fragment før vi antar at hen er ferdig med å snakke. */
const USER_SETTLE_MS = 400;
const METER_INTERVAL_MS = 100;
const ICE_TIMEOUT_MS = 10000;
const SESSION_START_TIMEOUT_MS = 15000;
/** Puffet som får stemmen til å si hilsenen med én gang (se `session.instructions.appended`-casen). */
const GREETING_KICK = "Begynn samtalen nå: si hilsenen slik instruksjonen sier, og vent så på brukeren.";

export interface LiveOptions {
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
  audioContext?: AudioContext;
  meter?: ReturnType<typeof setInterval>;
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
  const [usage, setUsage] = useState({ voiceSeconds: 0, estimatedUsd: 0 });
  const connection = useRef<Connection | null>(null);
  const generation = useRef(0);
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
    current.abort.abort();
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

  useEffect(() => dispose, [dispose]);

  const stop = useCallback(() => {
    dispose();
    setNotice(null);
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
    if (!current?.sessionToken) return;
    const body = JSON.stringify(message);
    // Karttilstanden meldes hver gang React committer; bare endringer er nytt
    // for serveren, og hver melding koster en kontekst-append hos stemmen.
    if (message.kind === "state") {
      if (contextSent.current === body) return;
      contextSent.current = body;
    }
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
      const health = await fetch(`/api/prototype/live${dataset ? `?dataset=${encodeURIComponent(dataset)}` : ""}`, { cache: "no-store" });
      if (run !== generation.current) return;
      if (!health.ok) throw new Error("Denne prototypen kan bare starte samtaler på localhost.");
      const configured = await health.json() as { configured?: boolean; protocol?: string; snapshotId?: string };
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
        lastAssistantAt: 0, lastUserAt: 0, transcript: null,
      };
      connection.current = current;
      const active = () => connection.current === current && run === generation.current;

      const settle = () => {
        if (!active() || !current.started) return;
        if (current.speaking) { setStatus("speaking"); return; }
        const now = Date.now();
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
      let samples = new Float32Array(0);
      current.meter = setInterval(() => {
        if (!active()) return;
        const now = Date.now();
        if (analyser) {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          if (Math.sqrt(sum / samples.length) > SPEAKING_RMS) current.loudAt = now;
        }
        current.speaking = now - current.loudAt < SPEAKING_HOLD_MS;
        settle();
      }, METER_INTERVAL_MS);

      const meterRemoteAudio = (stream: MediaStream) => {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        try {
          const context = new Ctor();
          const node = context.createAnalyser();
          node.fftSize = 512;
          context.createMediaStreamSource(stream).connect(node);
          samples = new Float32Array(node.fftSize);
          analyser = node;
          current.audioContext = context;
        } catch {
          // Uten måler står status på «lytter» og «undersøker»; samtalen går som før.
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
        if (!active()) return;
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

      channel.onmessage = message => {
        if (!active()) return;
        let event: LiveEvent;
        try { event = JSON.parse(message.data) as LiveEvent; } catch { return; }
        switch (event.type) {
          case "session.started":
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

      const response = await fetch("/api/prototype/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: pc.localDescription?.sdp ?? offer.sdp, snapshotId, ...(dataset ? { dataset } : {}) }),
        signal: current.abort.signal,
      });
      if (!active()) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Samtalen kunne ikke starte. Prøv igjen.");
      }
      const token = response.headers?.get?.("X-Placy-Session") ?? undefined;
      const payload = await response.json() as { sdp?: string; sessionId?: string };
      if (!active()) return;
      if (!payload.sdp) throw new Error("Serveren svarte uten lydforbindelse. Prøv igjen.");
      current.sessionToken = token;
      await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      if (!active()) return;

      await startedPromise;
      clearTimeout(startedTimeout);
      if (!active()) return;
      setStatus("listening");

      if (token) {
        const events = new EventSource(`/api/prototype/live/map?session=${encodeURIComponent(token)}`);
        current.events = events;
        events.onmessage = async message => {
          if (!active()) return;
          let payload: LiveServerMessage;
          try { payload = JSON.parse(message.data) as LiveServerMessage; } catch { return; }
          if (payload.type === "ended") {
            current.ended = true;
            dispose();
            setError(payload.message);
            setStatus("error");
            return;
          }
          if (payload.type !== "map") return;
          const directive: MapDirective = payload.directive;
          let output: unknown;
          try {
            if (!MAP_TOOLS.has(directive.name)) throw new Error("Ukjent kartkommando");
            output = await latestOptions.current.executeTool(directive.name, directive.args ?? {});
          } catch {
            output = { error: "Kartkommandoen kunne ikke utføres. Ikke påstå at kartet ble flyttet." };
          }
          if (!active()) return;
          void fetch("/api/prototype/live/map", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Placy-Session": token },
            body: JSON.stringify({ id: directive.id, output: output ?? { ok: true } }),
          }).catch(() => {});
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
  return { status, messages, latest, error, notice, interruptionVersion, usage, start, stop, sendContext, sendText, replaceMicrophoneTrack };
}
