"use client";

import type { Block, BoligFixture, VoiceSession } from "@/lib/prototype/bolig/contract";
import { formatCheckedDate } from "@/lib/prototype/bolig/format";
import PlaceCard from "@/components/prototype/bolig/PlaceCard";
import MiniMap from "@/components/prototype/bolig/MiniMap";
import styles from "@/components/prototype/bolig/bolig.module.css";

/** Renderer for én blokk i samtalefeeden. Slår opp id-er i fixturen per kind. */
export default function ConversationBlock({ block, fixture, session, onExpandMap }: {
  block: Block;
  fixture: BoligFixture;
  session: VoiceSession;
  onExpandMap: (placeIds: string[]) => void;
}) {
  switch (block.kind) {
    case "user":
      return <div className={styles.userBubble}>{block.text}</div>;

    case "answer":
      return (
        <div className={styles.answerBlock}>
          <span className={styles.guideName}>Placy</span>
          <p className={styles.answerText}>{block.text}{!block.done && <span className={styles.typingDot} aria-hidden="true" />}</p>
        </div>
      );

    case "places": {
      const places = block.placeIds.map((id) => fixture.places.find((p) => p.id === id)).filter((p): p is BoligFixture["places"][number] => Boolean(p));
      if (!places.length) return null;
      return (
        <div className={styles.blockPlaces}>
          <div className={styles.placeScroller}>
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} selected={session.selectedPlaceId === place.id} onSelect={session.selectPlace} />
            ))}
          </div>
          <MiniMap house={fixture.house} places={places} onExpand={() => onExpandMap(places.map((p) => p.id))} />
        </div>
      );
    }

    case "seller": {
      const notes = block.noteIds.map((id) => fixture.seller.find((s) => s.id === id)).filter((n): n is BoligFixture["seller"][number] => Boolean(n));
      if (!notes.length) return null;
      return (
        <div className={styles.blockSeller}>
          <span className={styles.blockLabel}>Dette sier selgeren</span>
          {notes.map((note) => <p key={note.id} className={styles.sellerQuote}>«{note.text}»</p>)}
          <span className={styles.provenanceBadge} data-provenance="seller">Selgerens erfaring · Eksempeldata</span>
        </div>
      );
    }

    case "unknown": {
      const unknowns = block.unknownIds.map((id) => fixture.unknowns.find((u) => u.id === id)).filter((u): u is BoligFixture["unknowns"][number] => Boolean(u));
      if (!unknowns.length) return null;
      return (
        <div className={styles.blockUnknown}>
          {unknowns.map((item) => {
            const links = item.sourceIds
              .map((id) => fixture.sources.find((s) => s.id === id))
              .filter((s): s is BoligFixture["sources"][number] & { url: string } => Boolean(s?.url));
            return (
              <div key={item.id} className={styles.unknownItem}>
                <span className={styles.provenanceBadge} data-provenance="unknown">Ukjent</span>
                <p className={styles.unknownQuestion}>{item.question}</p>
                <p className={styles.unknownAnswer}>{item.answer}</p>
                {links.length > 0 && (
                  <div className={styles.unknownLinks}>
                    {links.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "sources": {
      const sources = block.sourceIds.map((id) => fixture.sources.find((s) => s.id === id)).filter((s): s is BoligFixture["sources"][number] => Boolean(s));
      if (!sources.length) return null;
      return (
        <div className={styles.blockSources}>
          <span className={styles.blockLabel}>Kilder</span>
          <div className={styles.sourceList}>
            {sources.map((source) => (
              <span key={source.id} className={styles.sourceItem}>
                {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> : <span>{source.label}</span>}
                <span className={styles.sourceChecked}>kontrollert {formatCheckedDate(source.checkedAt)}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "notice":
      return <p className={styles.systemNotice}>{block.text}</p>;

    default:
      return null;
  }
}
