"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowLeft, ArrowUp, ArrowUpRight, Bike, Car, Check, Coffee, Compass, Footprints, MapPin, Mic, MicOff, Plus, RotateCcw, Sparkles, Square, Waves, X } from "lucide-react";
import type { Project } from "@/lib/types";
import type { BoardPOI } from "@/components/variants/report/board/board-data";
import { adaptBoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { useRealtime } from "@/lib/realtime/use-realtime";
import { allConversationPlaces, conversationInstructions, conversationTools, executeConversationTool, initialConversationView, placeEvidence, type ConversationView } from "@/lib/realtime/conversation-tools";
import styles from "@/components/prototype/conversation.module.css";

const ConversationMap = dynamic(() => import("@/components/prototype/ConversationMap"), { ssr: false, loading: () => <div className={styles.mapLoading}>Henter kartet over Nyhavna …</div> });
const starters = [
  { icon: Coffee, title: "En kaffe og noe godt", text: "Jeg vil ta en kaffe og spise noe på Nyhavna. Vis meg noen steder." },
  { icon: Waves, title: "En tur langs vannet", text: "Jeg er nysgjerrig på promenaden og parkene på Nyhavna. Hva finnes nå, og hva er planlagt? Vis meg." },
  { icon: Sparkles, title: "Kunst, kultur og nye inntrykk", text: "Jeg liker kunst og kultur. Hva kan jeg oppdage på Nyhavna? Vis meg et lite utvalg." },
];
const statusLabels: Record<string, string> = { idle: "Klar når du er", connecting: "Kobler til …", listening: "Jeg lytter", thinking: "Finner frem …", speaking: "Placy snakker", error: "Samtalen ble avbrutt" };

export default function ConversationExperience({ project }: { project: Project }) {
  const data = useMemo(() => adaptBoardData(transformToReportData(project)), [project]);
  const places = useMemo(() => allConversationPlaces(data), [data]);
  const [view, setView] = useState<ConversationView>(() => initialConversationView(data));
  const viewRef = useRef(view);
  const [input, setInput] = useState("");
  const [sessionMode, setSessionMode] = useState<"voice" | "text">("voice");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const update = useCallback((next: ConversationView) => { viewRef.current = next; setView(next); setShowSaved(false); }, []);
  const executeTool = useCallback((name: string, args: Record<string, unknown>) => executeConversationTool(name, args, data, viewRef.current, update), [data, update]);
  const getContext = useCallback(() => JSON.stringify({ area: "Nyhavna, Trondheim", map: viewRef.current, saved_places: savedIds, viewing_saved: showSaved, selected_place: places.find((poi) => String(poi.id) === viewRef.current.selectedId)?.name ?? null }), [places, savedIds, showSaved]);
  const realtime = useRealtime({ instructions: useMemo(() => conversationInstructions(data), [data]), tools: conversationTools, executeTool, getContext });
  const active = !["idle", "error"].includes(realtime.status);
  const messages = realtime.messages.filter((message) => message.role !== "tool");
  const visiblePlaces = useMemo(() => {
    const ids = showSaved ? savedIds : view.placeIds;
    return ids.map((id) => places.find((poi) => String(poi.id) === id)).filter((poi): poi is BoardPOI => Boolean(poi));
  }, [places, view.placeIds, savedIds, showSaved]);
  const selected = places.find((poi) => String(poi.id) === view.selectedId);
  const cards = selected && !showSaved ? [selected, ...visiblePlaces.filter((poi) => poi.id !== selected.id)] : visiblePlaces;

  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); }, [realtime.messages]);

  const send = useCallback((text: string) => {
    if (!text.trim() || realtime.status === "connecting") return;
    setInput("");
    if (active) realtime.sendText(text.trim());
    else { setSessionMode("text"); void realtime.start({ mode: "text", initialText: text.trim() }); }
  }, [active, realtime]);
  const startVoice = () => { setSessionMode("voice"); void realtime.start({ mode: "voice" }); };
  const submit = (event: FormEvent) => { event.preventDefault(); send(input); };
  const openPlace = (id: string) => { setShowSaved(false); executeTool("open_place", { place_id: id }); };
  const savePlace = (id: string) => setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <a className={styles.brand} href="/prototype" aria-label="Placy Nyhavna">placy<span className={styles.brandDot}>.</span></a>
        <div className={styles.headerDivider} />
        <div className={styles.location}><span>NYHAVNA</span><span>Trondheim, ved vannet</span></div>
        <span className={styles.prototype}>Samtale · konsept B</span>
        <button className={styles.savedButton} onClick={() => setShowSaved(!showSaved)} aria-pressed={showSaved}><MapPin size={15} /> Mine steder <span>{savedIds.length}</span></button>
      </header>

      <div className={styles.workspace}>
        <section className={styles.conversation} aria-label="Samtale med Placy">
          <div className={styles.conversationTop}><span className={styles.eyebrow}><span className={styles.tinyOrb} /> DIN LOKALE SAMTALEPARTNER</span><button className={styles.infoButton} onClick={() => setShowPrivacy(!showPrivacy)} aria-expanded={showPrivacy}>Om samtalen</button></div>
          {showPrivacy && <div className={styles.privacy}><button onClick={() => setShowPrivacy(false)} aria-label="Lukk informasjon"><X size={15} /></button>Du snakker med en AI. Når du starter, sendes samtaletekst og eventuell mikrofonlyd til OpenAI. Kartutvalget og stedsdata deles som kontekst. Mikrofonen brukes bare etter at du har startet tale. «Avslutt» slår den av. Mine steder beholdes bare på denne siden.</div>}

          <div className={styles.transcript} ref={transcriptRef} role="log" aria-label="Samtalehistorikk">
            {messages.length === 0 ? <div className={styles.welcome}>
              <div className={`${styles.orb} ${active ? styles.orbActive : ""}`} aria-hidden="true"><span /><span /><span /></div>
              <p className={styles.welcomeKicker}>ET STED. DIN NYSGJERRIGHET.</p>
              <h1>Hva vil du oppdage<br />på <em>Nyhavna?</em></h1>
              <p className={styles.welcomeBody}>Fortell litt om hva du liker.<br />Så finner vi stedene, og lar kartet følge samtalen.</p>
              <div className={styles.starters}>{starters.map(({ icon: Icon, title, text }) => <button key={title} onClick={() => send(text)} disabled={realtime.status === "connecting"}><Icon size={18} /><span>{title}</span><ArrowUpRight size={16} /></button>)}</div>
            </div> : <div className={styles.messageList}><p className={styles.conversationDate}>Din utforskning av Nyhavna</p>{messages.map((message) => <div key={message.id} className={message.role === "user" ? styles.userMessage : styles.assistantMessage}>{message.role === "assistant" && <span className={styles.assistantName}><span className={styles.tinyOrb} /> Placy</span>}<p>{message.text}</p></div>)}{realtime.status === "thinking" && <div className={styles.thinking}><span /><span /><span /><span>Ser nærmere på nabolaget</span></div>}</div>}
          </div>

          <div className={styles.composerWrap}>
            {realtime.error && <div className={styles.error} role="alert">{realtime.error}</div>}
            {active && <div className={styles.liveControls}><span role="status" className={styles.liveStatus}><span className={styles.liveDot} />{sessionMode === "text" && realtime.status === "listening" ? "Tekstsamtale" : realtime.muted && realtime.status === "listening" ? "Mikrofon av" : statusLabels[realtime.status]}</span>{realtime.status === "speaking" && <button onClick={realtime.interrupt}><Square size={12} /> Avbryt svar</button>}<button onClick={realtime.stop}>Avslutt</button></div>}
            <form onSubmit={submit} className={styles.composer}><input aria-label="Skriv til Placy" value={input} onChange={(event) => setInput(event.target.value)} placeholder={messages.length ? "Spør videre, eller pek i kartet …" : "Skriv hva du er nysgjerrig på …"} disabled={realtime.status === "connecting"} /><button type="submit" className={styles.sendButton} disabled={!input.trim() || realtime.status === "connecting"} aria-label="Send melding"><ArrowUp size={18} /></button></form>
            <button className={`${styles.voiceButton} ${active ? styles.voiceButtonLive : ""}`} onClick={() => active && sessionMode === "voice" ? realtime.toggleMute() : startVoice()} disabled={realtime.status === "connecting"}>{active && sessionMode === "voice" ? (realtime.muted ? <MicOff size={18} /> : <Mic size={18} />) : <Mic size={18} />}<span>{realtime.status === "connecting" ? "Kobler til Placy …" : active && sessionMode === "voice" ? (realtime.muted ? "Slå på mikrofonen" : "Slå av mikrofonen") : active ? "Start ny samtale med tale" : "Snakk med Placy"}</span>{active && sessionMode === "voice" && !realtime.muted && <span className={styles.waveform} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 0.14}s` }} />)}</span>}</button>
            <p className={styles.composerNote}>{active ? "Du kan snakke, skrive og peke om hverandre." : "Velg tale eller tekst. Du bestemmer tempoet."}</p>
          </div>
        </section>

        <section className={styles.visual} aria-label="Nyhavna i kart og steder">
          <div className={styles.map}><ConversationMap places={visiblePlaces} selectedId={view.selectedId} center={data.home.coordinates} revision={view.revision} onSelect={openPlace} />
            <div className={styles.mapTop}><div className={styles.mapCaption}><span className={styles.mapStatusDot} /><span>{view.revision === 0 ? "Nabolaget venter på deg" : "Kartet følger utforskningen"}</span></div><button className={styles.mapReset} title="Vis oversikt" aria-label="Vis oversikt" onClick={() => { setShowSaved(false); executeTool("reset_map", {}); }}><RotateCcw size={16} /></button></div>
            <div className={styles.mapBottom}><span><MapPin size={13} /> {visiblePlaces.length} steder i kartet</span><div className={styles.travelModes}>{[{ id: "walk", icon: Footprints, label: "Til fots" }, { id: "bike", icon: Bike, label: "På sykkel" }, { id: "car", icon: Car, label: "Med bil" }].map(({ id, icon: Icon, label }) => <button key={id} className={view.travelMode === id ? styles.travelActive : ""} onClick={() => executeTool("set_travel_mode", { mode: id })} title={label} aria-label={label} aria-pressed={view.travelMode === id}><Icon size={15} /></button>)}</div></div>
          </div>

          <div className={styles.discovery}>
            <div className={styles.discoveryHeader}><div><p className={styles.eyebrow}>{showSaved ? "DIN LILLE SAMLING" : view.revision === 0 ? "BEGYNN ET STED" : "FRA UTFORSKNINGEN DIN"}</p><h2>{showSaved ? "Mine steder" : view.title}</h2></div>{showSaved ? <button className={styles.backButton} onClick={() => setShowSaved(false)}><ArrowLeft size={15} /> Tilbake</button> : <Compass size={22} className={styles.compass} />}</div>
            {!showSaved && <div className={styles.categories}>{data.categories.map((category) => <button key={String(category.id)} onClick={() => executeTool("activate_category", { category_id: String(category.id) })} className={view.categoryId === String(category.id) ? styles.categoryActive : ""}><span style={{ background: category.color }} />{category.label}</button>)}</div>}
            <div className={styles.cards}>{cards.slice(0, 18).map((poi) => { const evidence = placeEvidence(poi, data); const minutes = poi.raw.travelTime?.[view.travelMode]; const saved = savedIds.includes(String(poi.id)); return <article key={String(poi.id)} className={`${styles.placeCard} ${view.selectedId === String(poi.id) ? styles.placeSelected : ""}`}>
              <button className={styles.placeMain} onClick={() => openPlace(String(poi.id))}><div className={styles.placeImage}>{poi.raw.featuredImage ? <Image src={poi.raw.featuredImage} alt="" fill sizes="220px" unoptimized /> : <div className={styles.placeIllustration} style={{ color: poi.color }}><span /><MapPin size={28} strokeWidth={1.2} /><span /></div>}<span className={styles.placeType}>{poi.raw.developmentStatus === "planned" ? "Planlagt" : evidence.category}</span></div><div className={styles.placeCopy}><h3>{poi.name}<ArrowUpRight size={14} /></h3><p>{poi.body || poi.raw.description || poi.address || "Utforsk stedet i kartet."}</p><span className={styles.walkTime}>{view.travelMode === "bike" ? <Bike size={12} /> : view.travelMode === "car" ? <Car size={12} /> : <Footprints size={12} />}{typeof minutes === "number" ? `${minutes} min fra utgangspunktet` : "Reisetid ikke oppgitt"}</span>{poi.raw.locationPrecision === "approximate" && <span className={styles.locationNote}>Omtrentlig plassering</span>}</div></button><div className={styles.placeFooter}>{evidence.sources[0] ? <a href={evidence.sources[0]} target="_blank" rel="noreferrer">Les kilden <ArrowUpRight size={11} /></a> : <span>Fra Nyhavna-boardet</span>}<button onClick={() => savePlace(String(poi.id))} aria-label={`${saved ? "Fjern" : "Lagre"} ${poi.name}`} aria-pressed={saved}>{saved ? <Check size={14} /> : <Plus size={14} />}</button></div>
            </article>; })}{showSaved && cards.length === 0 && <p className={styles.emptySaved}>Trykk + på et sted du liker, så finner du det igjen her mens du utforsker.</p>}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
