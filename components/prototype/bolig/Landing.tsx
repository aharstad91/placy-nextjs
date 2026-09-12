"use client";

import Image from "next/image";
import type { BoligFixture } from "@/lib/prototype/bolig/contract";
import styles from "@/components/prototype/bolig/bolig.module.css";

/** Forside før samtalen starter. Mikrofon og samtale er av til brukeren trykker. */
export default function Landing({ fixture, simulated, onStart }: { fixture: BoligFixture; simulated: boolean; onStart: () => void | Promise<void> }) {
  const { house } = fixture;

  return (
    <div className={styles.landing}>
      {simulated && <span className={styles.simBadge}>Simulering</span>}
      <div className={styles.landingImage}>
        {house.image ? (
          <Image src={house.image.src} alt={house.image.alt} fill unoptimized sizes="480px" priority />
        ) : (
          <div className={styles.landingImageFallback} aria-hidden="true" />
        )}
        {house.image?.kind === "illustration" && <span className={styles.illustrationBadge}>Illustrasjon</span>}
      </div>
      <div className={styles.landingBody}>
        <h1>{house.title}</h1>
        <p className={styles.address}>
          <span>{house.addressLabel}</span>
          {house.provenance === "example" && <span className={styles.exampleBadge}>Eksempeldata</span>}
        </p>
        <p className={styles.intro}>{house.intro}</p>
        <button type="button" className={styles.startButton} onClick={onStart}>Snakk om nabolaget</button>
        <p className={styles.startNote}>Mikrofon og samtale er av til du trykker.</p>
      </div>
    </div>
  );
}
