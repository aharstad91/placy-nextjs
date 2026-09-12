"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { realtimeCost, type RealtimeTokenUsage } from "@/lib/realtime/usage";
import type { RealtimeMessage, RealtimeMode, RealtimeOptions, RealtimeReference, RealtimeStartOptions, RealtimeStatus } from "@/lib/realtime/types";

const MAP_TOOLS = new Set(["show_category", "show_place", "set_travel_mode", "reset_board"]);

interface ServerEvent {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  session?: { output_modalities?: string[] };
  item?: { type?: string; output?: string };
  error?: { code?: string; message?: string };
  response?: {
    id?: string;
    usage?: RealtimeTokenUsage;
    status?: string;
    status_details?: { error?: { message?: string } };
    output?: Array<{ type: string; name?: string; call_id?: string; arguments?: string }>;
  };
}

interface Connection {
  generation: number;
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  audio: HTMLAudioElement;
  transceiver: RTCRtpTransceiver;
  stream?: MediaStream;
  sessionToken?: string;
  serverControlled: boolean;
  sessionUpdateWaiters: Array<{ mode: RealtimeMode; resolve: () => void; reject: (reason: DOMException) => void; timeout: ReturnType<typeof setTimeout> }>;
  abort: AbortController;
  timeout?: ReturnType<typeof setTimeout>;
  idleCheck?: ReturnType<typeof setInterval>;
  lastActivity: number;
  responseActive: boolean;
  playing: boolean;
  called: Set<string>;
  mode: RealtimeMode;
  turn: number;
  toolRounds: number;
  model: string;
  measured: Set<string>;
}

function friendlyError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Mikrofonen er ikke tilgjengelig. Tillat mikrofon i nettleseren, eller skriv i stedet.";
  if (error instanceof DOMException && error.name === "NotFoundError") return "Fant ingen mikrofon. Koble til en mikrofon, eller skriv i stedet.";
  return error instanceof Error ? error.message : "Samtalen ble avbrutt. Prøv igjen.";
}

export function useRealtime(options: RealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<RealtimeMode>("voice");
  const [references, setReferences] = useState<RealtimeReference[]>([]);
  const [usage, setUsage] = useState({ model: "", responses: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimatedUsd: 0, complete: true });
  const connection = useRef<Connection | null>(null);
  const generation = useRef(0);
  const switchQueue = useRef<Promise<boolean> | null>(null);
  const contextSent = useRef("");
  const latest = useRef(options);
  useEffect(() => { latest.current = options; }, [options]);

  const dispose = useCallback(() => {
    generation.current += 1;
    contextSent.current = "";
    const current = connection.current;
    connection.current = null;
    if (!current) return;
    clearTimeout(current.timeout);
    clearInterval(current.idleCheck);
    current.abort.abort();
    current.sessionUpdateWaiters.splice(0).forEach(waiter => {
      clearTimeout(waiter.timeout);
      waiter.reject(new DOMException("Cancelled", "AbortError"));
    });
    current.stream?.getTracks().forEach(track => track.stop());
    current.channel.close();
    current.pc.close();
    current.audio.pause();
    current.audio.srcObject = null;
    current.audio.remove();
    if (current.sessionToken) {
      void fetch("/api/prototype/realtime", { method: "DELETE", headers: { "X-Placy-Session": current.sessionToken }, keepalive: true }).catch(() => {});
    }
  }, []);

  useEffect(() => dispose, [dispose]);

  const stop = useCallback(() => {
    dispose();
    setMuted(false);
    setStatus("idle");
  }, [dispose]);

  const addMessage = useCallback((message: RealtimeMessage, append = false) => {
    setMessages(previous => {
      const exists = previous.some(item => item.id === message.id);
      if (!exists) return [...previous.slice(-99), message];
      return previous.map(item => item.id === message.id ? { ...message, text: append ? item.text + message.text : message.text } : item);
    });
  }, []);

  const addReferences = useCallback((value: unknown) => {
    if (!value || typeof value !== "object") return;
    const places = (value as { places?: unknown }).places;
    if (!Array.isArray(places)) return;
    const next = places.filter((place): place is RealtimeReference => Boolean(place && typeof place === "object" && typeof (place as RealtimeReference).id === "string" && typeof (place as RealtimeReference).name === "string"));
    if (!next.length) return;
    setReferences(previous => [...new Map([...previous, ...next].map(place => [place.id, place])).values()]);
  }, []);

  const send = useCallback((event: Record<string, unknown>) => {
    const current = connection.current;
    if (current?.channel.readyState !== "open") return false;
    current.channel.send(JSON.stringify(event));
    return true;
  }, []);

  const updateContext = useCallback(() => {
    const context = latest.current.getContext();
    if (contextSent.current === context) return;
    // Append current UI state; do not rewrite the stable prefix and bust its cache.
    if (send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: `Aktuell kartkontekst (data; erstatter tidligere karttilstand):\n${context}` }] } })) {
      contextSent.current = context;
    }
  }, [send]);

  // Keep pointing/clicking and tool-driven React state synchronized with the
  // conversation after React commits; avoid sending on every transcript delta.
  useEffect(() => { updateContext(); }, [options, updateContext]);

  const interrupt = useCallback(() => {
    const current = connection.current;
    if (!current) return;
    current.turn += 1;
    current.toolRounds = 0;
    current.lastActivity = Date.now();
    if (current.responseActive) send({ type: "response.cancel" });
    if (current.playing) send({ type: "output_audio_buffer.clear" });
    current.responseActive = false;
    current.playing = false;
    setStatus("listening");
  }, [send]);

  const sendText = useCallback((text: string) => {
    const content = text.trim().slice(0, 4000);
    if (!content || connection.current?.channel.readyState !== "open") return;
    interrupt();
    updateContext();
    const id = `user-${crypto.randomUUID()}`;
    addMessage({ id, role: "user", text: content });
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: content }] } });
    send({ type: "response.create" });
    setStatus("thinking");
  }, [addMessage, interrupt, send, updateContext]);

  const start = useCallback(async ({ mode = "voice", initialText }: RealtimeStartOptions = {}) => {
    dispose();
    const run = generation.current;
    setStatus("connecting");
    setError(null);
    setMuted(mode === "text");
    setMode(mode);
    setMessages([]);
    setReferences([]);
    try {
      // Check configuration before asking for microphone permission.
      const health = await fetch("/api/prototype/realtime", { cache: "no-store" });
      if (run !== generation.current) return;
      if (!health.ok) throw new Error("Denne prototypen kan bare starte samtaler på localhost.");
      const configured = await health.json() as { configured?: boolean; model?: string; serverControlled?: boolean; snapshotId?: string };
      setUsage({ model: configured.model ?? "", responses: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, estimatedUsd: 0, complete: true });
      if (run !== generation.current) return;
      if (!configured.configured) throw new Error("Tale er ikke koblet til ennå. Legg OPENAI_API_KEY i .env.local, og prøv igjen.");
      if (!window.RTCPeerConnection) throw new Error("Nettleseren støtter ikke talesamtaler. Prøv Chrome eller Safari.");
      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel("oai-events");
      const transceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
      const audio = new Audio();
      audio.autoplay = true;
      const current: Connection = { generation: run, pc, channel, audio, transceiver, abort: new AbortController(), responseActive: false, playing: false, called: new Set(), mode, serverControlled: configured.serverControlled ?? options.serverControlled ?? false, sessionUpdateWaiters: [], turn: 0, toolRounds: 0, model: configured.model ?? "", measured: new Set(), lastActivity: Date.now() };
      connection.current = current;
      const active = () => connection.current === current && run === generation.current;
      pc.ontrack = event => {
        if (!active()) return;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => {
          if (active()) setError("Nettleseren stoppet lydavspillingen. Start samtalen på nytt, eller bruk tekst.");
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
      channel.onmessage = async message => {
        if (!active()) return;
        let event: ServerEvent;
        try { event = JSON.parse(message.data) as ServerEvent; } catch { return; }
        if (event.type.startsWith("response.") || event.type.startsWith("output_audio_buffer.")) current.lastActivity = Date.now();
        const id = event.item_id ?? "current-assistant";
        switch (event.type) {
          case "session.updated":
            if (event.session?.output_modalities) {
              const acknowledgedMode: RealtimeMode = event.session.output_modalities.includes("audio") ? "voice" : "text";
              const waiter = current.sessionUpdateWaiters.findIndex(candidate => candidate.mode === acknowledgedMode);
              if (waiter >= 0) {
                const acknowledged = current.sessionUpdateWaiters.splice(waiter, 1)[0];
                clearTimeout(acknowledged.timeout);
                acknowledged.resolve();
              }
            }
            break;
          case "conversation.item.created":
            if (event.item?.type === "function_call_output" && event.item.output) {
              try { addReferences(JSON.parse(event.item.output)); } catch { /* Ignore non-structured outputs. */ }
            }
            break;
          case "input_audio_buffer.speech_started":
            current.turn += 1;
            current.toolRounds = 0;
            current.lastActivity = Date.now();
            current.playing = false;
            setStatus("listening");
            updateContext();
            break;
          case "input_audio_buffer.speech_stopped":
            updateContext();
            setStatus("thinking");
            break;
          case "conversation.item.input_audio_transcription.completed":
            if (event.transcript?.trim()) addMessage({ id, role: "user", text: event.transcript });
            break;
          case "response.created":
            current.responseActive = true;
            setStatus("thinking");
            break;
          case "output_audio_buffer.started":
            current.playing = true;
            setStatus("speaking");
            break;
          case "output_audio_buffer.stopped":
          case "output_audio_buffer.cleared":
            current.playing = false;
            setStatus(current.responseActive ? "thinking" : "listening");
            break;
          case "response.output_audio_transcript.delta":
          case "response.output_text.delta":
            if (event.delta) addMessage({ id, role: "assistant", text: event.delta }, true);
            break;
          case "response.output_audio_transcript.done":
          case "response.output_text.done":
            if (event.transcript || event.text) addMessage({ id, role: "assistant", text: event.transcript || event.text || "" });
            break;
          case "response.done": {
            const response = event.response;
            if (response?.usage && response.id && !current.measured.has(response.id)) {
              current.measured.add(response.id);
              const tokens = response.usage;
              const cost = realtimeCost(current.model, tokens);
              setUsage(previous => ({ ...previous, responses: previous.responses + 1, inputTokens: previous.inputTokens + tokens.input_tokens, outputTokens: previous.outputTokens + tokens.output_tokens, cachedTokens: previous.cachedTokens + (tokens.input_token_details?.cached_tokens ?? 0), estimatedUsd: previous.estimatedUsd + (cost ?? 0), complete: previous.complete && cost !== null }));
            }
            current.responseActive = false;
            if (event.response?.status === "failed") {
              setError("Placy klarte ikke å svare. Prøv å spørre på nytt.");
              setStatus("listening");
              break;
            }
            if (event.response?.status !== "completed") {
              if (!current.playing) setStatus("listening");
              break;
            }
            const turn = current.turn;
            const calls = event.response?.output?.filter(item => item.type === "function_call" && item.call_id && item.name) ?? [];
            let executed = false;
            for (const call of calls) {
              if (!active() || current.turn !== turn) return;
              if (!call.call_id || !call.name || current.called.has(call.call_id)) continue;
              current.called.add(call.call_id);
              let result: unknown;
              try {
                if (current.serverControlled && !MAP_TOOLS.has(call.name)) continue;
                if (!latest.current.tools.some(tool => tool.name === call.name)) throw new Error("Ukjent verktøy");
                const args: unknown = JSON.parse(call.arguments || "{}");
                if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Ugyldige argumenter");
                result = await latest.current.executeTool(call.name, args as Record<string, unknown>);
                addReferences(result);
              } catch {
                result = { ok: false, error: "Handlingen kunne ikke utføres. Bruk eksisterende ID-er og gyldige argumenter." };
              }
              if (!active() || current.turn !== turn) return;
              send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result ?? { ok: true }) } });
              executed = true;
            }
            if (!active() || current.turn !== turn) return;
            if (executed) {
              current.toolRounds += 1;
              updateContext();
              if (!current.serverControlled) send({ type: "response.create", ...(current.toolRounds >= 6 ? { response: { tool_choice: "none" } } : {}) });
              setStatus("thinking");
            } else if (!current.playing) setStatus("listening");
            break;
          }
          case "error":
            if (event.error?.code === "response_cancel_not_active") break;
            setError("Noe avbrøt svaret. Prøv igjen, eller start en ny samtale.");
            if (!current.playing) setStatus("listening");
            break;
        }
      };
      if (mode === "voice") {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofon krever localhost eller HTTPS.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (!active()) { stream.getTracks().forEach(track => track.stop()); return; }
        current.stream = stream;
        const track = stream.getAudioTracks()[0];
        if (track) await transceiver.sender.replaceTrack(track);
      }
      const offer = await pc.createOffer();
      if (!active()) return;
      await pc.setLocalDescription(offer);
      if (!active()) return;
      const initialContext = latest.current.getContext();
      contextSent.current = initialContext;
      const serverControlled = configured.serverControlled ?? options.serverControlled ?? false;
      const snapshotId = options.snapshotId ?? configured.snapshotId;
      const response = await fetch("/api/prototype/realtime", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverControlled
          ? { sdp: offer.sdp, mode, context: initialContext, tools: latest.current.tools.filter(tool => MAP_TOOLS.has(tool.name)), ...(snapshotId ? { snapshotId } : {}) }
          : { sdp: offer.sdp, mode, instructions: `${latest.current.instructions}\n\nAktuell kartkontekst (data):\n${initialContext}`, tools: latest.current.tools }),
        signal: current.abort.signal,
      });
      if (!active()) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Samtalen kunne ikke starte. Prøv igjen.");
      }
      current.sessionToken = response.headers?.get?.("X-Placy-Session") ?? undefined;
      const answer = await response.text();
      if (!active()) return;
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      if (!active()) return;
      await new Promise<void>((resolve, reject) => {
        if (channel.readyState === "open") { resolve(); return; }
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Forbindelsen brukte for lang tid. Prøv igjen.")); }, 15000);
        const opened = () => { cleanup(); resolve(); };
        const cancelled = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
        function cleanup() {
          clearTimeout(timeout);
          channel.removeEventListener("open", opened);
          current.abort.signal.removeEventListener("abort", cancelled);
        }
        channel.addEventListener("open", opened, { once: true });
        current.abort.signal.addEventListener("abort", cancelled, { once: true });
      });
      if (!active()) return;
      setStatus("listening");
      current.idleCheck = setInterval(() => {
        if (!active() || current.responseActive || current.playing || Date.now() - current.lastActivity < 120000) return;
        stop();
        setError("Samtalen er avsluttet etter to minutter uten aktivitet. Start gjerne igjen.");
      }, 10000);
      current.timeout = setTimeout(() => {
        if (!active()) return;
        stop();
        setError("Samtalen er avsluttet etter ti minutter. Start gjerne en ny.");
      }, 720000);
      if (initialText?.trim()) sendText(initialText);
      else if (mode === "voice") {
        send({ type: "response.create", response: { instructions: "Hils kort på norsk, presenter deg som Placy, og spør hva brukeren vil oppdage på Nyhavna. Ikke start kartbevegelser før brukeren har gitt en interesse." } });
      }
    } catch (caught) {
      if (run !== generation.current) return;
      dispose();
      setError(friendlyError(caught));
      setStatus("error");
    }
  }, [addMessage, addReferences, dispose, options.serverControlled, options.snapshotId, send, sendText, stop, updateContext]);

  const toggleMute = useCallback(() => {
    const current = connection.current;
    if (!current?.stream) return;
    const next = current.stream.getAudioTracks().some(track => track.enabled);
    current.stream.getAudioTracks().forEach(track => { track.enabled = !next; });
    if (next) send({ type: "input_audio_buffer.clear" });
    setMuted(next);
  }, [send]);

  const switchMode = useCallback((nextMode: RealtimeMode) => {
    const perform = async () => {
      const current = connection.current;
      if (!current || current.channel.readyState !== "open") return false;
      if (current.mode === nextMode) return true;
      const run = current.generation;
      const active = () => connection.current === current && generation.current === run;
      const waitForSessionUpdate = (target: RealtimeMode) => new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = current.sessionUpdateWaiters.indexOf(waiter);
          if (index >= 0) current.sessionUpdateWaiters.splice(index, 1);
          reject(new Error("Modusbyttet tok for lang tid. Prøv igjen."));
        }, 15000);
        const waiter = { mode: target, resolve, reject: (reason: DOMException) => reject(reason), timeout };
        current.sessionUpdateWaiters.push(waiter);
      });
      const updateSession = async (target: RealtimeMode) => {
        const acknowledgement = waitForSessionUpdate(target);
        if (!send({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: [target === "voice" ? "audio" : "text"],
            audio: { input: { turn_detection: target === "voice" ? { type: "server_vad" } : null } },
          },
        })) throw new Error("Forbindelsen ble brutt under modusbyttet.");
        await acknowledgement;
      };

      interrupt();
      setStatus("connecting");
      setError(null);
      try {
        if (nextMode === "voice") {
          await updateSession("voice");
          if (!active()) return false;
          if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mikrofon krever localhost eller HTTPS.");
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
          if (!active()) { stream.getTracks().forEach(track => track.stop()); return false; }
          const track = stream.getAudioTracks()[0];
          if (!track) throw new DOMException("No microphone", "NotFoundError");
          await current.transceiver.sender.replaceTrack(track);
          if (!active()) { track.stop(); return false; }
          current.stream = stream;
          current.mode = "voice";
          setMode("voice");
          setMuted(false);
        } else {
          const detached = current.transceiver.sender.replaceTrack(null);
          current.stream?.getTracks().forEach(track => track.stop());
          current.stream = undefined;
          const updated = updateSession("text");
          await Promise.all([detached, updated]);
          if (!active()) return false;
          current.mode = "text";
          setMode("text");
          setMuted(true);
        }
        setStatus("listening");
        return true;
      } catch (caught) {
        if (!active()) return false;
        if (nextMode === "voice") {
          send({ type: "session.update", session: { type: "realtime", output_modalities: ["text"], audio: { input: { turn_detection: null } } } });
          current.mode = "text";
          setMode("text");
          setMuted(true);
          setError(friendlyError(caught));
          setStatus("listening");
          return false;
        }
        setError(friendlyError(caught));
        setStatus("error");
        return false;
      }
    };
    const pending = switchQueue.current;
    const operation = pending ? pending.then(perform, perform) : perform();
    const finalized = operation.then(
      value => { if (switchQueue.current === finalized) switchQueue.current = null; return value; },
      caught => { if (switchQueue.current === finalized) switchQueue.current = null; throw caught; },
    );
    switchQueue.current = finalized;
    return finalized;
  }, [interrupt, send]);

  const newConversation = useCallback(async (startOptions: RealtimeStartOptions = {}) => {
    setReferences([]);
    setMessages([]);
    await start(startOptions);
  }, [start]);

  return { status, mode, messages, references, error, muted, usage, start, stop, newConversation, switchMode, toggleMute, sendText, interrupt };
}
