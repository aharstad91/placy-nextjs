"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOPICS, type Block, type BoligFixture, type SessionStatus, type SessionUsage, type ToolResult, type TopicId, type VoiceSession } from "@/lib/prototype/bolig/contract";
import { blocksFromToolResult, mergeBlocks, upsertAnswer } from "@/lib/prototype/bolig/blocks";
import { BROWSER_TOOLS, resolvePlace, userActionMessage } from "@/lib/prototype/bolig/knowledge";
import { BOLIG_GREETING_INSTRUCTIONS } from "@/lib/prototype/bolig/session-config";
import { RATE_WAIT_PREFIX, SESSION_END_PREFIX } from "@/lib/realtime/types";
import { realtimeCost, type RealtimeTokenUsage } from "@/lib/realtime/usage";

/**
 * Ekte talesamtale (OpenAI Realtime over WebRTC) for bruktbolig-prototypen.
 *
 * Serveren (sideband) eier kunnskapsverktøy, videreføring, inaktivitet og
 * opprydding. Nettleseren eier mikrofon, lyd, transkript, kartmarkering
 * (`show_place`) og oversettelsen av verktøyresultater til blokker.
 *
 * Turregel: hver ny brukerhandling (tale, kategoritrykk, stedsvalg) øker
 * `turn`. Sene verktøyresultater rendres på sin egen tur, men får ikke flytte
 * aktivt tema eller valgt sted.
 */

const ENDPOINT = "/api/prototype/bolig/realtime";

interface ServerEvent {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { code?: string; message?: string };
  item?: { id?: string; type?: string; call_id?: string; role?: string; output?: string; content?: Array<{ type?: string; text?: string }> };
  response?: { id?: string; status?: string; usage?: RealtimeTokenUsage; status_details?: { error?: { code?: string; message?: string } }; output?: Array<{ type: string; name?: string; call_id?: string; arguments?: string }> };
}

interface Connection {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  audio: HTMLAudioElement;
  stream?: MediaStream;
  abort: AbortController;
  sessionToken: string | null;
  model: string;
  turn: number;
  responseActive: boolean;
  playing: boolean;
  /** call_id → tur der kallet ble bestilt. */
  callTurns: Map<string, number>;
  rendered: Set<string>;
  executed: Set<string>;
  endReason: string | null;
  usage: SessionUsage & { complete: boolean };
}

function friendlyError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Mikrofonen er ikke tilgjengelig. Tillat mikrofon i nettleseren og prøv igjen. Du kan fortsatt lese eksemplet under.";
  if (error instanceof DOMException && error.name === "NotFoundError") return "Fant ingen mikrofon. Koble til en mikrofon og prøv igjen.";
  if (error instanceof DOMException && error.name === "AbortError") return "Samtalen ble avbrutt.";
  return error instanceof Error ? error.message : "Samtalen ble avbrutt. Prøv igjen.";
}

export function useVoiceSession(fixture: BoligFixture): VoiceSession {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [activeTopic, setActiveTopic] = useState<TopicId | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [usage, setUsage] = useState<SessionUsage | null>(null);
  const connection = useRef<Connection | null>(null);
  const generation = useRef(0);

  const dispose = useCallback(() => {
    generation.current += 1;
    const current = connection.current;
    connection.current = null;
    if (!current) return;
    current.abort.abort();
    current.stream?.getTracks().forEach(track => track.stop());
    if (current.sessionToken) void fetch(ENDPOINT, { method: "DELETE", headers: { "X-Placy-Session": current.sessionToken }, keepalive: true }).catch(() => {});
    current.channel.close();
    current.pc.close();
    current.audio.pause();
    current.audio.srcObject = null;
    current.audio.remove();
  }, []);

  useEffect(() => dispose, [dispose]);

  // Legg på når siden forlates (reload, lukket fane, bytte av app på telefonen).
  // Unmount-effekten over kjører ikke ved en full navigasjon, og da sto samtalen
  // igjen som «aktiv» hos serveren til inaktivitetsgrensen på to minutter slo
  // inn – ny lasting ga «En samtale er allerede aktiv» (Andreas, 2026-09-13).
  // `pagehide` er det eneste som fyrer pålitelig i iOS Safari; DELETE sendes
  // med keepalive slik at den overlever at siden forsvinner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPageHide = () => { if (connection.current) stopRef.current(); };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const send = useCallback((event: Record<string, unknown>) => {
    const current = connection.current;
    if (current?.channel.readyState !== "open") return false;
    current.channel.send(JSON.stringify(event));
    return true;
  }, []);

  const stop = useCallback(() => {
    const hadConnection = Boolean(connection.current);
    dispose();
    setMuted(false);
    setBlocks(previous => previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b));
    setStatus(hadConnection ? "ended" : "idle");
  }, [dispose]);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const interrupt = useCallback(() => {
    const current = connection.current;
    if (!current) return;
    current.turn += 1;
    if (current.responseActive) send({ type: "response.cancel" });
    if (current.playing) send({ type: "output_audio_buffer.clear" });
    current.responseActive = false;
    current.playing = false;
    setBlocks(previous => previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b));
    setStatus("listening");
  }, [send]);

  /** Brukerens handling som tekstmelding; serveren starter svaret. */
  const sendUserText = useCallback((text: string) => {
    const current = connection.current;
    if (!current || current.channel.readyState !== "open") return false;
    interrupt();
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: text.slice(0, 1000) }] } });
    setStatus("thinking");
    return true;
  }, [interrupt, send]);

  const tapCategory = useCallback((topic: TopicId) => {
    const current = connection.current;
    if (!current) return;
    setActiveTopic(topic);
    setSelectedPlaceId(null);
    const prompt = TOPICS.find(t => t.id === topic)?.tapPrompt ?? topic;
    if (!sendUserText(userActionMessage(fixture, { type: "category", topic }))) return;
    const turn = current.turn;
    setBlocks(previous => [...previous, { id: `user-tap-${turn}`, turn, kind: "user", text: prompt, topic }]);
  }, [fixture, sendUserText]);

  const selectPlace = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    const current = connection.current;
    const place = fixture.places.find(p => p.id === placeId);
    if (!current || !place) return;
    if (!sendUserText(userActionMessage(fixture, { type: "place", placeId }))) return;
    const turn = current.turn;
    setBlocks(previous => [...previous, { id: `user-place-${turn}`, turn, kind: "notice", text: `Du valgte ${place.name} i kartet.` }]);
  }, [fixture, sendUserText]);

  const clearSelection = useCallback(() => setSelectedPlaceId(null), []);

  const toggleMute = useCallback(() => {
    const current = connection.current;
    if (!current?.stream) return;
    const enabled = current.stream.getAudioTracks().some(track => track.enabled);
    current.stream.getAudioTracks().forEach(track => { track.enabled = !enabled; });
    if (enabled) send({ type: "input_audio_buffer.clear" });
    setMuted(enabled);
  }, [send]);

  const handleToolOutput = useCallback((current: Connection, callId: string, output: string) => {
    if (current.rendered.has(callId)) return;
    current.rendered.add(callId);
    let result: ToolResult;
    try { result = JSON.parse(output) as ToolResult; } catch { return; }
    if (!result || typeof result !== "object" || !("kind" in result)) return;
    const turn = current.callTurns.get(callId) ?? current.turn;
    current.callTurns.delete(callId);
    const fresh = turn === current.turn;
    setBlocks(previous => mergeBlocks(previous, blocksFromToolResult(result, turn, callId)));
    // Agentens temaskifte oppdaterer synlig kontekst uten ny svarsløyfe.
    if (fresh && result.kind === "topic") { setActiveTopic(result.topic); setSelectedPlaceId(null); }
    if (fresh && result.kind === "place") setSelectedPlaceId(result.place.id);
  }, []);

  const executeBrowserTool = useCallback((name: string, args: Record<string, unknown>): ToolResult => {
    if (name === "show_place") {
      const placeId = typeof args.place_id === "string" ? args.place_id : "";
      const place = resolvePlace(fixture, placeId);
      if (!place) return { kind: "map", ok: false, error: "Ukjent sted. Bruk en ID fra et verktøyresultat." };
      setSelectedPlaceId(place.id);
      return { kind: "map", ok: true, place_id: place.id };
    }
    return { kind: "error", error: "Ukjent kartverktøy." };
  }, [fixture]);

  const start = useCallback(async () => {
    dispose();
    const run = generation.current;
    setStatus("connecting");
    setError(null);
    setNotice(null);
    setMuted(false);
    setBlocks([]);
    setActiveTopic(null);
    setSelectedPlaceId(null);
    setUsage(null);
    try {
      const health = await fetch(ENDPOINT, { cache: "no-store" });
      if (run !== generation.current) return;
      if (!health.ok) throw new Error("Denne prototypen kan bare starte samtaler lokalt (localhost).");
      const configured = await health.json() as { configured?: boolean; model?: string; version?: number };
      if (run !== generation.current) return;
      if (!configured.configured) throw new Error("Tale er ikke koblet til. Legg OPENAI_API_KEY i .env.local og prøv igjen.");
      if (configured.version !== fixture.version) throw new Error("Datagrunnlaget er oppdatert. Last siden på nytt.");
      if (!window.RTCPeerConnection) throw new Error("Nettleseren støtter ikke talesamtaler. Prøv Chrome eller Safari.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Denne nettleseren gir ikke tilgang til mikrofon. Åpne HTTPS-lenken direkte i Safari eller Chrome.");
      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel("oai-events");
      const audio = new Audio();
      audio.autoplay = true;
      const current: Connection = { pc, channel, audio, abort: new AbortController(), sessionToken: null, model: configured.model ?? "", turn: 0, responseActive: false, playing: false, callTurns: new Map(), rendered: new Set(), executed: new Set(), endReason: null, usage: { responses: 0, estimatedUsd: 0, complete: true } };
      connection.current = current;
      const active = () => connection.current === current && run === generation.current;
      pc.ontrack = event => {
        if (!active()) return;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => { if (active()) setError("Nettleseren stoppet lydavspillingen. Trykk Stopp og start på nytt."); });
      };
      pc.onconnectionstatechange = () => {
        if (!active()) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          dispose();
          setError("Forbindelsen ble brutt. Start samtalen igjen.");
          setStatus("error");
        }
      };
      channel.onclose = () => {
        if (!active()) return;
        const reason = current.endReason;
        dispose();
        setBlocks(previous => previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b));
        if (reason) { setNotice(reason); setStatus("ended"); }
        else { setError("Samtalen ble avsluttet. Du kan starte en ny."); setStatus("error"); }
      };
      channel.onmessage = message => {
        if (!active()) return;
        let event: ServerEvent;
        try { event = JSON.parse(message.data) as ServerEvent; } catch { return; }
        const id = event.item_id ?? "assistant-current";
        switch (event.type) {
          case "input_audio_buffer.speech_started":
            current.turn += 1;
            current.playing = false;
            setBlocks(previous => previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b));
            setStatus("listening");
            break;
          case "input_audio_buffer.speech_stopped":
            setStatus("thinking");
            break;
          case "conversation.item.input_audio_transcription.completed":
            if (event.transcript?.trim()) setBlocks(previous => mergeBlocks(previous, [{ id: `user-${id}`, turn: current.turn, kind: "user", text: event.transcript!.trim() }]));
            break;
          case "conversation.item.added":
          case "conversation.item.created":
          case "conversation.item.done": {
            const item = event.item;
            if (!item) break;
            if (item.role === "system") {
              const text = item.content?.find(c => c.text)?.text ?? "";
              if (text.startsWith(RATE_WAIT_PREFIX)) { setNotice("Placy venter litt på kapasitet og prøver igjen …"); setStatus("thinking"); }
              if (text.startsWith(SESSION_END_PREFIX)) current.endReason = text === SESSION_END_PREFIX + "limit" ? "Samtalen er avsluttet etter tolv minutter. Start gjerne en ny." : "Samtalen er avsluttet etter to minutter uten aktivitet. Start gjerne igjen.";
            }
            if (item.type === "function_call_output" && item.call_id && item.output) handleToolOutput(current, item.call_id, item.output);
            break;
          }
          case "response.created":
            current.responseActive = true;
            setNotice(null);
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
            if (event.delta) setBlocks(previous => upsertAnswer(previous, `answer-${id}`, current.turn, event.delta!, false));
            // Lyd etter et verktøykall legges i samme buffer uten ny «started»-hendelse.
            if (current.playing) setStatus("speaking");
            break;
          case "response.output_audio_transcript.done":
            if (event.transcript) setBlocks(previous => upsertAnswer(previous, `answer-${id}`, current.turn, event.transcript!, true, true));
            break;
          case "response.done": {
            current.responseActive = false;
            const response = event.response;
            if (response?.usage) {
              const cost = realtimeCost(current.model, response.usage);
              current.usage.responses += 1;
              current.usage.estimatedUsd = (current.usage.estimatedUsd ?? 0) + (cost ?? 0);
              current.usage.complete &&= cost !== null;
              setUsage({ responses: current.usage.responses, estimatedUsd: current.usage.complete ? current.usage.estimatedUsd : null });
            }
            if (response?.status === "failed" && response.status_details?.error?.code !== "rate_limit_exceeded") {
              setError("Placy klarte ikke å svare. Prøv å spørre på nytt.");
              setStatus("listening");
              break;
            }
            const calls = response?.output?.filter(item => item.type === "function_call" && item.call_id && item.name) ?? [];
            for (const call of calls) {
              current.callTurns.set(call.call_id!, current.turn);
              if (!BROWSER_TOOLS.has(call.name!) || current.executed.has(call.call_id!)) continue;
              current.executed.add(call.call_id!);
              let result: ToolResult;
              try {
                const args: unknown = JSON.parse(call.arguments || "{}");
                if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("invalid");
                result = executeBrowserTool(call.name!, args as Record<string, unknown>);
              } catch { result = { kind: "map", ok: false, error: "Ugyldige argumenter." }; }
              send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) } });
            }
            if (current.playing) break;
            setStatus(calls.length ? "thinking" : "listening");
            break;
          }
          case "error":
            if (event.error?.code === "response_cancel_not_active" || event.error?.code === "output_audio_buffer_clear_not_active") break;
            setError("Noe avbrøt svaret. Prøv igjen, eller stopp og start en ny samtale.");
            if (!current.playing) setStatus("listening");
            break;
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!active()) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream;
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
      const offer = await pc.createOffer();
      if (!active()) return;
      await pc.setLocalDescription(offer);
      if (!active()) return;
      const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdp: offer.sdp, mode: "voice", version: fixture.version }), signal: current.abort.signal });
      if (!active()) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Samtalen kunne ikke starte. Prøv igjen.");
      }
      current.sessionToken = response.headers.get("X-Placy-Session");
      const answer = await response.text();
      if (!active()) return;
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      if (!active()) return;
      await new Promise<void>((resolve, reject) => {
        if (channel.readyState === "open") { resolve(); return; }
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Forbindelsen brukte for lang tid. Prøv igjen.")); }, 15000);
        const opened = () => { cleanup(); resolve(); };
        const cancelled = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
        function cleanup() { clearTimeout(timeout); channel.removeEventListener("open", opened); current.abort.signal.removeEventListener("abort", cancelled); }
        channel.addEventListener("open", opened, { once: true });
        current.abort.signal.addEventListener("abort", cancelled, { once: true });
      });
      if (!active()) return;
      setStatus("listening");
      send({ type: "response.create", response: { instructions: BOLIG_GREETING_INSTRUCTIONS } });
    } catch (caught) {
      if (run !== generation.current) return;
      dispose();
      setError(friendlyError(caught));
      setStatus("error");
    }
  }, [dispose, executeBrowserTool, fixture, handleToolOutput, send]);

  return useMemo<VoiceSession>(() => ({
    status, blocks, error, notice, muted, activeTopic, selectedPlaceId, simulated: false, usage,
    start, stop, interrupt, toggleMute, tapCategory, selectPlace, clearSelection,
  }), [status, blocks, error, notice, muted, activeTopic, selectedPlaceId, usage, start, stop, interrupt, toggleMute, tapCategory, selectPlace, clearSelection]);
}
