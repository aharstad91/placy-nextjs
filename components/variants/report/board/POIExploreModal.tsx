"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ExternalLink, Clock, Globe, Phone } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle } from "./marker-style";
import { AnchorRegister } from "./AnchorRegister";
import { computeIsOpen } from "@/lib/hooks/useOpeningHours";
import type { BoardPOI } from "./board-data";
import type { PoiGrounding } from "@/lib/types";

/**
 * Utforsk-modalen: Google-grounded stedsinnhold vist INNE i Placy, i stedet for
 * at «Utforsk» sender brukeren til Google AI Mode i ny fane.
 *
 * Ansvarsforholdet er bevisst det samme som når vi lenket ut: innholdet er
 * hentet fra Google, ikke skrevet av Placy, og attribusjonen sier det.
 * `searchEntryPointHtml` rendres VERBATIM (DOMPurify-sanert build-time) fordi
 * Google ToS krever det — se lib/gemini/sanitize.ts.
 *
 * Ren DOM-overlay i portal (via components/ui/Modal), ALDRI en ny WebGL-flate:
 * iOS WebKit tåler én kontekst, og gmp-map-3d rendrer ikke React-popovers
 * pålitelig (docs/solutions/ui-bugs/google-maps-3d-popover-not-rendering.md).
 *
 * Google-fakta leses fra DB-kolonner, aldri fra API ved visning — modal-åpning
 * koster 0 Google-kall.
 */

/** Sant når POI-en har noe å vise. Gating-signalet for CTA-en og mobil-inngangen. */
export function hasExploreContent(poi: BoardPOI): boolean {
  return (
    hasAnchorRegister(poi) || hasGroundedNarrative(poi.raw.grounding) || hasGoogleFacts(poi)
  );
}

/**
 * Ankeret har alltid et register å vise — enten medlemslista eller
 * `anchor_summary` alene.
 *
 * Må stå i gaten, ikke bare i innholdet: Vikhammer senteret har verken rating
 * eller anmeldelser hos Google (målt i Unit 3), så `hasGoogleFacts` er falsk og
 * uten dette ville registeret vært uåpnelig på nettopp de nærsentrene ankeret
 * er bygget for. Virksomhetene inni er absorbert og finnes ikke andre steder i
 * grensesnittet — er modalen stengt, er de borte.
 */
export function hasAnchorRegister(poi: BoardPOI): boolean {
  // `isAnchor` avledes av `anchorSummary` (lib/board/anchor-poi.ts), så flagget
  // impliserer at det finnes minst en sammendragslinje.
  return poi.isAnchor === true;
}

export function hasGroundedNarrative(grounding: PoiGrounding | undefined): boolean {
  if (!grounding) return false;
  if (grounding.curated?.narrative) return true;
  return grounding.generated?.qualityGate.passed === true;
}

export function hasGoogleFacts(poi: BoardPOI): boolean {
  const r = poi.raw;
  return Boolean(
    r.googleRating ||
      r.openingHoursJson?.weekday_text?.length ||
      r.googleWebsite ||
      r.googlePhone ||
      r.galleryImages?.length
  );
}

/**
 * Minimal markdown: avsnitt + `- `-punktlister. Ingen markdown-avhengighet, og
 * ingen HTML fra narrativet — teksten settes som tekstnoder, aldri innerHTML.
 * (`searchEntryPointHtml` er det ENESTE stedet vi rendrer HTML, og den er
 * sanert build-time.)
 */
function NarrativeBody({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const out: Array<{ kind: "p"; text: string } | { kind: "ul"; items: string[] }> = [];
    for (const raw of text.split(/\n{2,}/)) {
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        out.push({ kind: "ul", items: lines.map((l) => l.replace(/^[-*]\s+/, "")) });
        continue;
      }
      // Blandet blokk: skill ut punktlinjer så en liste uten tom linje over
      // ikke havner inni avsnittsteksten.
      const bullets = lines.filter((l) => /^[-*]\s+/.test(l));
      const prose = lines.filter((l) => !/^[-*]\s+/.test(l));
      if (prose.length > 0) out.push({ kind: "p", text: prose.join(" ") });
      if (bullets.length > 0) {
        out.push({ kind: "ul", items: bullets.map((l) => l.replace(/^[-*]\s+/, "")) });
      }
    }
    return out;
  }, [text]);

  return (
    <div className="space-y-3">
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="text-[14px] leading-relaxed text-stone-700">
            {b.text}
          </p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.items.map((item, j) => (
              <li
                key={j}
                className="flex gap-2 text-[14px] leading-relaxed text-stone-700"
              >
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-stone-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** Bildekarusell. Horisontal scroll — enklest som holder på mobil og desktop. */
function GalleryStrip({ images, alt }: { images: string[]; alt: string }) {
  // lh3-URL-er utløper (~14 dager). Utløp kan ikke oppdages build-time, så
  // runtime-degradering er nødvendig: feiler et bilde, skjules hele stripa
  // framfor å vise brutte ruter.
  const [broken, setBroken] = useState(false);
  if (broken || images.length === 0) return null;

  return (
    <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
      {images.map((src, i) => (
        <div
          key={src}
          className="relative h-32 w-44 flex-none overflow-hidden rounded-lg bg-stone-100"
        >
          <Image
            src={src}
            alt={i === 0 ? alt : `${alt} – bilde ${i + 1}`}
            fill
            sizes="176px"
            className="object-cover"
            onError={() => setBroken(true)}
          />
        </div>
      ))}
    </div>
  );
}

function FactsSection({ poi }: { poi: BoardPOI }) {
  const r = poi.raw;
  const weekdayText = r.openingHoursJson?.weekday_text;

  // Dagsnavnene er ENGELSKE med vilje — se OPENING_HOURS_LANGUAGE i
  // scripts/places-backfill-lib.ts. Samme matching som MapPopupCard.
  const today = useMemo(() => {
    if (!weekdayText?.length) return null;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const name = days[new Date().getDay()];
    const line = weekdayText.find((l) => l.toLowerCase().startsWith(name.toLowerCase()));
    return line ? line.replace(/^[^:]+:\s*/, "") : null;
  }, [weekdayText]);

  const isOpen = useMemo(
    () => (weekdayText?.length ? computeIsOpen(weekdayText) : undefined),
    [weekdayText]
  );

  const hasAnything = r.googleRating || today || r.googleWebsite || r.googlePhone;
  if (!hasAnything) return null;

  return (
    <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
      {r.googleRating != null && r.googleRating > 0 && (
        <GoogleRating rating={r.googleRating} reviewCount={r.googleReviewCount} size="sm" showLabel />
      )}

      {today && (
        <div className="flex items-center gap-2 text-[13px] text-stone-600">
          <Clock aria-hidden className="h-3.5 w-3.5 flex-none text-stone-400" />
          <span>{today}</span>
          {isOpen !== undefined && (
            <span
              className={
                isOpen
                  ? "font-medium text-emerald-600"
                  : "font-medium text-stone-400"
              }
            >
              {isOpen ? "Åpent nå" : "Stengt nå"}
            </span>
          )}
        </div>
      )}

      {r.googlePhone && (
        <div className="flex items-center gap-2 text-[13px] text-stone-600">
          <Phone aria-hidden className="h-3.5 w-3.5 flex-none text-stone-400" />
          <a href={`tel:${r.googlePhone.replace(/\s/g, "")}`} className="hover:underline">
            {r.googlePhone}
          </a>
        </div>
      )}

      {r.googleWebsite && (
        <div className="flex items-center gap-2 text-[13px] text-stone-600">
          <Globe aria-hidden className="h-3.5 w-3.5 flex-none text-stone-400" />
          <a
            href={r.googleWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:underline"
          >
            {r.googleWebsite.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Attribusjonsblokken velges av `generated.provider`. Én variant i dag; når
 * Googles generativeSummary dekker Norge kommer den inn som en ny gren her,
 * uten at resten av modalen røres.
 */
function AttributionBlock({ generated }: { generated: NonNullable<PoiGrounding["generated"]> }) {
  return (
    <div className="mt-5 border-t border-stone-100 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
        Hentet via Google Søk
      </p>

      {generated.sources.length > 0 && (
        <ul className="mt-2 space-y-1">
          {generated.sources.map((s) => {
            // Gemini setter ofte `title` til bare domenet, og da rendrer
            // tittel + domene samme tekst to ganger («dgo.no  dgo.no» —
            // observert i nettleser 2026-08-12). Vis domenet kun når det
            // tilfører noe utover tittelen.
            const domainAddsInfo =
              Boolean(s.domain) &&
              !s.title.toLowerCase().includes(s.domain.toLowerCase()) &&
              !s.domain.toLowerCase().includes(s.title.toLowerCase());
            return (
              <li key={s.redirectUrl}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline gap-1.5 text-[12px] text-stone-500 hover:text-stone-800 hover:underline"
                >
                  <span className="truncate">{s.title}</span>
                  {domainAddsInfo && (
                    <span className="flex-none text-stone-400">{s.domain}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Google ToS: searchEntryPoint skal rendres VERBATIM. Innholdet er sanert
        build-time med DOMPurify (lib/gemini/sanitize.ts) og validert som påkrevd
        av PoiGroundingGeneratedSchema — mangler det, vises grounding ikke i det
        hele tatt. Chips står her, adjacent til SIN egen response, aldri
        aggregert på tvers av POI-er.
      */}
      <div
        className="mt-3 [&_a]:text-[12px]"
        dangerouslySetInnerHTML={{ __html: generated.searchEntryPointHtml }}
      />
    </div>
  );
}

export interface POIExploreModalProps {
  poi: BoardPOI | null;
  open: boolean;
  onClose: () => void;
  /** Ekstern Google-lenke, brukt når POI-en ikke har grounded narrativ. */
  fallbackUrl?: string;
  /** Kalles ÉN gang per åpning — Moat 2-signalet (Unit 7). */
  onOpened?: (poi: BoardPOI) => void;
}

export function POIExploreModal({
  poi,
  open,
  onClose,
  fallbackUrl,
  onOpened,
}: POIExploreModalProps) {
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  const grounding = poi?.raw.grounding;
  // curated vinner over generated når begge finnes — det Placy-eide laget er
  // redaksjonelt godkjent, leverandør-teksten er råstoff.
  const narrative = grounding?.curated?.narrative ?? grounding?.generated?.narrative;
  const showNarrative = Boolean(narrative) && hasGroundedNarrative(grounding);
  const generated = grounding?.generated;

  // Emit ÉN gang per åpning, i en effekt — aldri under render. Nøkkelen er
  // `open + poi.id`, så å bytte POI mens modalen står åpen teller som en ny
  // åpning, mens en re-render av samme POI ikke gjør det.
  const emitKey = open && poi ? poi.id : null;
  const lastEmitted = useRef<string | null>(null);
  useEffect(() => {
    if (emitKey === null) {
      lastEmitted.current = null;
      return;
    }
    if (lastEmitted.current === emitKey) return;
    lastEmitted.current = emitKey;
    if (poi) onOpenedRef.current?.(poi);
    // poi er stabil for en gitt emitKey; onOpened holdes i ref for å unngå at
    // en ny funksjonsidentitet per render trigger ny emit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitKey]);

  if (!poi) return null;

  const Icon = getFilledIcon(poi.raw.category.icon);
  const circle = markerCircleStyle(poi.raw.category.color);
  const images = poi.raw.galleryImages ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      // Modal-ens default er md:max-h-[50vh], som er for trangt for bilder +
      // narrativ + fakta + attribusjon. ToS krever at kildene er tilgjengelige
      // innen én interaksjon, så de skal ikke havne utenfor rekkevidde.
      className="md:max-w-[560px] md:max-h-[85vh]"
      title={
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2"
            style={{
              borderColor: circle.borderColor,
              backgroundColor: circle.backgroundColor,
              color: circle.borderColor,
            }}
          >
            <Icon className="h-4 w-4" weight="fill" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-stone-900">{poi.name}</h2>
            <p className="truncate text-xs text-stone-500">
              {poi.address ?? poi.raw.category.name}
            </p>
          </div>
        </div>
      }
      footer={
        fallbackUrl ? (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-stone-100 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-200"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            Se mer på Google
          </a>
        ) : undefined
      }
    >
      <div className="px-5 py-4">
        {images.length > 0 && <GalleryStrip images={images} alt={poi.name} />}

        {showNarrative && narrative ? (
          <NarrativeBody text={narrative} />
        ) : poi.body ? (
          /* Redaksjonell krok + lokal innsikt. Mini-popupen viser den på
             desktop, men mobilen har ingen popup — modalen ER POI-flaten der,
             så uten denne grenen sto det «vi har ikke noe innhold» på steder
             som har det. */
          <NarrativeBody text={poi.body} />
        ) : hasAnchorRegister(poi) ? null : (
          /* Ankeret sier aldri dette: registeret UNDER er innholdet om
             senteret, og «vi vet ingenting om stedet» rett over en liste over
             det som ligger der ville motsagt seg selv. */
          <p className="text-[14px] leading-relaxed text-stone-500">
            Vi har ikke noe redaksjonelt innhold om dette stedet ennå.
          </p>
        )}

        {/* Registeret står rett under teksten om senteret, før Google-faktaene:
            det er svaret på «hva er dette stedet», ikke en detalj om det. */}
        <AnchorRegister poi={poi} />

        <FactsSection poi={poi} />

        {/* Attribusjon kun når vi faktisk viser leverandør-tekst. Kuratert
            tekst som har erstattet generated skal ikke bære Google-kilder som
            om Google skrev den. */}
        {showNarrative && !grounding?.curated && generated && (
          <AttributionBlock generated={generated} />
        )}
      </div>
    </Modal>
  );
}

export default POIExploreModal;
