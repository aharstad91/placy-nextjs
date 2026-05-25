"use client";

import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import type { MeglerReelCard } from "./reels-data";

interface Props {
  card: MeglerReelCard;
  isActive: boolean;
  desktopMode?: boolean;
}

/**
 * Statisk slutt-card uten audio. Viser megler-kontakter med tlf/e-post-
 * knapper. Mobil-modus: card fyller full skjerm. Desktop: card fyller 400px
 * venstre kolonne. Ingen video-bg — bare dempet bakgrunnsgradient så fokus
 * holdes på kortene.
 */
export function MeglerReel({ card }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-stone-950">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-stone-950 to-black" />
      <div className="relative h-full w-full flex flex-col px-6 py-10 overflow-y-auto">
        <span
          className="inline-block text-[11px] uppercase tracking-[0.15em] text-white/70 mb-2 font-semibold"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
        >
          {card.label}
        </span>
        <h2 className="text-white text-2xl font-bold leading-tight mb-6">
          Spørsmål? Vi hjelper deg.
        </h2>
        <div className="flex flex-col gap-5">
          {card.brokers.map((broker) => (
            <BrokerCard key={`${broker.name}-${broker.email}`} broker={broker} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BrokerCard({ broker }: { broker: MeglerReelCard["brokers"][number] }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-stone-800">
        {broker.photoUrl && (
          <Image
            src={broker.photoUrl}
            alt={broker.name}
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold leading-tight text-white">
          {broker.name}
        </span>
        <span className="truncate text-[12px] text-white/60">
          {broker.title} · {broker.officeName}
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`tel:${broker.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-stone-900 px-3 py-1.5 text-[12px] font-semibold transition hover:bg-stone-100"
          >
            <Phone className="h-3.5 w-3.5" />
            Ring
          </a>
          <a
            href={`mailto:${broker.email}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/10"
          >
            <Mail className="h-3.5 w-3.5" />
            E-post
          </a>
        </div>
      </div>
    </div>
  );
}
