"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REALTIME_GROUNDING } from "@/lib/realtime/conversation/session-config";
import type { RealtimeMessage, RealtimeOptions, RealtimeStartOptions, RealtimeStatus } from "@/lib/realtime/conversation/types";

interface ServerEvent {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  error?: { code?: string; message?: string };
  response?: {
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
  stream?: MediaStream;
  abort: AbortController;
  timeout?: ReturnType<typeof setTimeout>;
  responseActive: boolean;
  playing: boolean;
  called: Set<string>;
  mode: "voice" | "text";
  turn: number;
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
  const connection = useRef<Connection | null>(null);
  const generation = useRef(0);
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
    current.abort.abort();
    current.stream?.getTracks().forEach(track => track.stop());
    current.channel.close();
    current.pc.close();
    current.audio.pause();
    current.audio.srcObject = null;
    current.audio.remove();
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

  const send = useCallback((event: Record<string, unknown>) => {
    const current = connection.current;
    if (current?.channel.readyState !== "open") return false;
    current.channel.send(JSON.stringify(event));
    return true;
  }, []);

  const updateContext = useCallback(() => {
    const instructions = `${REALTIME_GROUNDING}\n\n${latest.current.instructions}\n\nAktuell kartkontekst (data):\n${latest.current.getContext()}`;
    if (contextSent.current === instructions) return;
    if (send({ type: "session.update", session: { type: "realtime", instructions } })) {
      contextSent.current = instructions;
    }
  }, [send]);

  // Keep pointing/clicking and tool-driven React state synchronized with the
  // conversation after React commits; avoid sending on every transcript delta.
  useEffect(() => { updateContext(); }, [options, updateContext]);

  const interrupt = useCallback(() => {
    const current = connection.current;
    if (!current) return;
    current.turn += 1;
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
    setMessages([]);
    try {
      // Check configuration before asking for microphone permission.
      const health = await fetch("/api/prototype/conversation/realtime", { cache: "no-store" });
      if (run !== generation.current) return;
      if (!health.ok) throw new Error("Denne prototypen kan bare starte samtaler på localhost.");
      const configured = await health.json() as { configured?: boolean };
      if (run !== generation.current) return;
      if (!configured.configured) throw new Error("Tale er ikke koblet til ennå. Legg OPENAI_API_KEY i .env.local, og prøv igjen.");
      if (!window.RTCPeerConnection) throw new Error("Nettleseren støtter ikke talesamtaler. Prøv Chrome eller Safari.");
      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel("oai-events");
      const audio = new Audio();
      audio.autoplay = true;
      const current: Connection = { generation: run, pc, channel, audio, abort: new AbortController(), responseActive: false, playing: false, called: new Set(), mode, turn: 0 };
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
        const id = event.item_id ?? "current-assistant";
        switch (event.type) {
          case "input_audio_buffer.speech_started":
            current.turn += 1;
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
                if (!latest.current.tools.some(tool => tool.name === call.name)) throw new Error("Ukjent verktøy");
                const args: unknown = JSON.parse(call.arguments || "{}");
                if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Ugyldige argumenter");
                result = await latest.current.executeTool(call.name, args as Record<string, unknown>);
              } catch {
                result = { ok: false, error: "Handlingen kunne ikke utføres. Bruk eksisterende ID-er og gyldige argumenter." };
              }
              if (!active() || current.turn !== turn) return;
              send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result ?? { ok: true }) } });
              executed = true;
            }
            if (!active() || current.turn !== turn) return;
            if (executed) {
              updateContext();
              send({ type: "response.create" });
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
        for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
      } else pc.addTransceiver("audio", { direction: "recvonly" });
      const offer = await pc.createOffer();
      if (!active()) return;
      await pc.setLocalDescription(offer);
      if (!active()) return;
      const response = await fetch("/api/prototype/conversation/realtime", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, mode, instructions: `${latest.current.instructions}\n\nAktuell kartkontekst (data):\n${latest.current.getContext()}`, tools: latest.current.tools }),
        signal: current.abort.signal,
      });
      if (!active()) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Samtalen kunne ikke starte. Prøv igjen.");
      }
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
      current.timeout = setTimeout(() => {
        if (!active()) return;
        stop();
        setError("Samtalen er avsluttet etter ti minutter. Start gjerne en ny.");
      }, 600000);
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
  }, [addMessage, dispose, send, sendText, stop, updateContext]);

  const toggleMute = useCallback(() => {
    const current = connection.current;
    if (!current?.stream) return;
    const next = current.stream.getAudioTracks().some(track => track.enabled);
    current.stream.getAudioTracks().forEach(track => { track.enabled = !next; });
    if (next) send({ type: "input_audio_buffer.clear" });
    setMuted(next);
  }, [send]);

  return { status, messages, error, muted, start, stop, toggleMute, sendText, interrupt };
}
