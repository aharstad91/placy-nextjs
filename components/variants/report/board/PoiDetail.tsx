"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Clock, Globe, Phone } from "lucide-react";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { computeIsOpen } from "@/lib/hooks/useOpeningHours";
import { cn } from "@/lib/utils";
import { AnchorRegister } from "./AnchorRegister";
import type { BoardPOI } from "./board-data";
import type { PoiGrounding } from "@/lib/types";

/**
 * Stedets innhold — ÉN blokk, uavhengig av flaten den står i (2026-08-28).
 *
 * ## Hvorfor den ble trukket ut
 *
 * Innholdet bodde i `POIExploreModal`, og modalen var den eneste veien til det.
 * På desktop betydde det at teksten, åpningstiden og senterets register lå bak
 * et trykk på «Utforsk» i en popup ute i kartet — mens sidekolonnen, som ER
 * lesestoffet, viste den første setningen og stoppet der (Andreas, 2026-08-28,
 * med PizzaPizza som eksempel: avsnitt to fantes, men ikke i raden).
 *
 * Blokken er derfor flat: ingen header, ingen lukkeknapp, ingen antakelse om
 * bredde. Modalen setter sin egen tittel, sidebar-raden bruker radens navn som
 * tittel, og panelet over kolonnen setter sin. Det som deles er det som ellers
 * ville driftet — hvilken tekst som vinner, hvordan fakta formateres, og at
 * Google-attribusjonen ALLTID følger leverandør-teksten.
 *
 * ## Hvorfor attribusjonen ligger inni og ikke hos kallstedet
 *
 * Fordi vilkårene ikke gir kallstedet et valg. Viser vi Gemini-hentet tekst, må
 * `searchEntryPointHtml` rendres verbatim og kildene være innen én interaksjon.
 * Lå den utenfor, ville en ny flate kunne vise narrativet uten den — og det er
 * nøyaktig den feilen som er lett å gjøre og vanskelig å oppdage.
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
 * grensesnittet — er flaten stengt, er de borte.
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
 * Teksten om stedet, i prioritert rekkefølge.
 *
 * `curated` vinner over `generated` når begge finnes — det Placy-eide laget er
 * redaksjonelt godkjent, leverandør-teksten er råstoff. Har stedet ingen av
 * dem, er `body` (redaksjonell krok + lokal innsikt, satt sammen i board-data)
 * det vi har.
 */
export function poiNarrativeText(poi: BoardPOI): string {
  const grounding = poi.raw.grounding;
  const grounded = grounding?.curated?.narrative ?? grounding?.generated?.narrative;
  if (grounded && hasGroundedNarrative(grounding)) return grounded;
  return poi.body ?? "";
}

/** Skal Google-attribusjonen følge teksten? Sann kun for leverandør-tekst vi
 *  faktisk viser — kuratert tekst som har erstattet den skal ikke bære
 *  Google-kilder som om Google skrev den. */
export function poiShowsAttribution(poi: BoardPOI): boolean {
  const g = poi.raw.grounding;
  return Boolean(
    hasGroundedNarrative(g) && !g?.curated?.narrative && g?.generated
  );
}

/**
 * Minimal markdown: avsnitt + `- `-punktlister. Ingen markdown-avhengighet, og
 * ingen HTML fra narrativet — teksten settes som tekstnoder, aldri innerHTML.
 * (`searchEntryPointHtml` er det ENESTE stedet vi rendrer HTML, og den er
 * sanert build-time.)
 */
export function PoiNarrative({ text }: { text: string }) {
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
          <p key={i} className="text-[15px] leading-[1.6] text-stone-700">
            {b.text}
          </p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.items.map((item, j) => (
              <li
                key={j}
                className="flex gap-2 text-[15px] leading-[1.6] text-stone-700"
              >
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-stone-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/**
 * Bildekarusell. Horisontal scroll — enklest som holder på mobil og desktop.
 *
 * `className` styrer utfallet mot flatens kant: modalen lar stripa gå ut i
 * marga (`-mx-5 px-5`), sidebar-raden bare mot høyre — der er venstrekanten
 * innrykket som flukter med navnet.
 */
export function PoiGallery({
  images,
  alt,
  className = "-mx-5 px-5",
}: {
  images: string[];
  alt: string;
  className?: string;
}) {
  // lh3-URL-er utløper (~14 dager). Utløp kan ikke oppdages build-time, så
  // runtime-degradering er nødvendig: feiler et bilde, skjules hele stripa
  // framfor å vise brutte ruter.
  const [broken, setBroken] = useState(false);
  if (broken || images.length === 0) return null;

  return (
    <div className={cn("mb-4 flex gap-2 overflow-x-auto pb-1", className)}>
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

/** Google-faktaene: vurdering, dagens åpningstid, telefon, nettside. */
export function PoiFacts({ poi }: { poi: BoardPOI }) {
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
    <div data-testid="poi-facts" className="mt-4 space-y-2 border-t border-stone-200/80 pt-4">
      {r.googleRating != null && r.googleRating > 0 && (
        <GoogleRating rating={r.googleRating} reviewCount={r.googleReviewCount} size="sm" showLabel />
      )}

      {today && (
        <div className="flex items-center gap-2 text-[13.5px] text-stone-600">
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
        <div className="flex items-center gap-2 text-[13.5px] text-stone-600">
          <Phone aria-hidden className="h-3.5 w-3.5 flex-none text-stone-400" />
          <a href={`tel:${r.googlePhone.replace(/\s/g, "")}`} className="hover:underline">
            {r.googlePhone}
          </a>
        </div>
      )}

      {r.googleWebsite && (
        <div className="flex items-center gap-2 text-[13.5px] text-stone-600">
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
 * uten at resten av flaten røres.
 */
export function PoiAttribution({
  generated,
}: {
  generated: NonNullable<PoiGrounding["generated"]>;
}) {
  return (
    <div className="mt-5 border-t border-stone-200/80 pt-4">
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

/**
 * Hele stedets innhold, i rekkefølgen det skal leses.
 *
 * Registeret står rett under teksten om senteret, FØR Google-faktaene: det er
 * svaret på «hva er dette stedet», ikke en detalj om det.
 *
 * `emptyText` er tomtilstanden, og kallstedet eier den: modalen sier det med
 * ord, sidebar-raden sier ingenting — der er en rad uten chevron allerede
 * beskjeden om at stedet ikke har mer å fortelle.
 */
export function PoiDetailBody({
  poi,
  galleryClassName,
  emptyText,
}: {
  poi: BoardPOI;
  galleryClassName?: string;
  emptyText?: string;
}) {
  const narrative = poiNarrativeText(poi);
  const images = poi.raw.galleryImages ?? [];
  const generated = poi.raw.grounding?.generated;

  return (
    <>
      {images.length > 0 && (
        <PoiGallery images={images} alt={poi.name} className={galleryClassName} />
      )}

      {narrative ? (
        <PoiNarrative text={narrative} />
      ) : emptyText && !hasAnchorRegister(poi) ? (
        /* Ankeret sier aldri dette: registeret UNDER er innholdet om senteret,
           og «vi vet ingenting om stedet» rett over en liste over det som
           ligger der ville motsagt seg selv. */
        <p className="text-[15px] leading-[1.6] text-stone-500">{emptyText}</p>
      ) : null}

      <AnchorRegister poi={poi} />

      <PoiFacts poi={poi} />

      {poiShowsAttribution(poi) && generated && <PoiAttribution generated={generated} />}
    </>
  );
}
