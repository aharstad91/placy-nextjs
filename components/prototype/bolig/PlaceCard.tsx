"use client";

import Image from "next/image";
import { Footprints } from "lucide-react";
import { PROVENANCE_LABEL, type Place } from "@/lib/prototype/bolig/contract";
import { formatWalkMinutes } from "@/lib/prototype/bolig/format";
import styles from "@/components/prototype/bolig/bolig.module.css";

/** Ett sted i den horisontalt scrollbare stedskort-raden. */
export default function PlaceCard({ place, selected, onSelect }: { place: Place; selected: boolean; onSelect: (placeId: string) => void }) {
  const fact = place.facts[0]?.text;

  return (
    <button
      type="button"
      className={`${styles.placeCard} ${selected ? styles.placeCardSelected : ""}`}
      onClick={() => onSelect(place.id)}
      aria-pressed={selected}
    >
      <div className={styles.placeCardMedia}>
        {place.image ? (
          <Image src={place.image.src} alt={place.image.alt} fill unoptimized sizes="196px" />
        ) : (
          <div className={styles.placeCardFallback} aria-hidden="true" />
        )}
        {place.image?.kind === "illustration" && <span className={styles.illustrationBadge}>Illustrasjon</span>}
      </div>
      <div className={styles.placeCardBody}>
        <div className={styles.placeCardHead}>
          <span className={styles.placeCardName}>{place.name}</span>
          <span className={styles.provenanceBadge} data-provenance={place.provenance}>{PROVENANCE_LABEL[place.provenance]}</span>
        </div>
        <span className={styles.placeCardKind}>{place.kind}</span>
        {typeof place.walkMinutes === "number" && (
          <span className={styles.placeCardWalk}><Footprints size={12} />{formatWalkMinutes(place.walkMinutes)}</span>
        )}
        {fact && <p className={styles.placeCardFact}>{fact}</p>}
        {place.note && <p className={styles.placeCardNote}>{place.note}</p>}
      </div>
    </button>
  );
}
