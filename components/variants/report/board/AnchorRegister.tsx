"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { markerCircleStyle, poiVisualIdentity } from "./marker-style";
import type { BoardPOI } from "./board-data";
import type { POI } from "@/lib/types";
import { anchorRegisterHeading } from "@/lib/board/anchor-families";

/**
 * Innholdsregisteret til et anker — Apples Browse Directory-modell.
 *
 * Overskriften følger familien (`anchorRegisterHeading`): «I senteret» for et
 * kjøpesenter, «På anlegget» for et idrettsanlegg. Et anlegg er et område man
 * er PÅ, ikke et bygg man går INN i, og feil preposisjon leses som en feil.
 *
 * Ankeret er ÉN destinasjon, ikke førti markører. Det betyr at virksomhetene
 * inni det ikke finnes noe annet sted i grensesnittet: absorpsjonen i
 * `report-data` fjerner dem fra temaet, og uten dette registeret ville de vært
 * borte. Dette er stedet de bor.
 *
 * ## Hvorfor grupper og ikke en flat liste
 *
 * Sirkus Shopping absorberer ~50 virksomheter på Strindfjordvegen 10. En flat
 * navneliste er en vegg; gruppert på Placy-kategori blir det åtte rader du kan
 * skumme og åpne. Rekkefølgen er den SAMME som `buildAnchorSummary` bruker i
 * pipelinen (antall synkende, så navn stigende) — sammendragslinjen og
 * registeret skal ikke fortelle to ulike historier om samme senter.
 *
 * ## Hvorfor medlemsnavnene ikke er trykkbare
 *
 * Et medlem har ingen markør på kartet — det er hele poenget med ankeret. En
 * trykkbar rad ville sendt boardet inn i POI-fasen for et punkt uten pinne:
 * kameraet flyr, labelen mangler, ruta tegnes til et sted brukeren ikke ser.
 * Du reiser til senteret; virksomhetene er innholdet DER, ikke egne reisemål.
 *
 * ## Fjerne ankre har bare sammendraget
 *
 * Ankre utenfor prosjektsirkelen (Thon Senter Verdal, 12 km) importerer ingen
 * medlemmer — medlemstallet kommer fra Google-proben i Unit 3, og teksten er
 * `anchor_summary`. Da er sammendragslinjen hele registeret, og det er riktig:
 * vi later ikke som vi kjenner butikkene der.
 */

/**
 * Under denne grensen står alle gruppene åpne fra start. Vikhammer senteret har
 * fem medlemmer i fem kategorier — fem lukkede rader med ett navn i hver er
 * verre enn å bare vise dem. Samme resonnement som `HighlightsDisclosure`s
 * «ett punkt: ingen toggle».
 */
export const REGISTER_AUTO_EXPAND_MAX = 8;

export interface RegisterGroup {
  categoryId: string;
  name: string;
  members: POI[];
}

/**
 * Grupperer medlemmene på Placy-kategori. Rent og deterministisk: gruppene
 * sorteres på antall synkende, så navn stigende (nb-NO); medlemmene innad
 * alfabetisk. Samme input gir samme rekkefølge, uansett radenes rekkefølge inn.
 */
export function groupRegister(children: readonly POI[]): RegisterGroup[] {
  const byCategory = new Map<string, RegisterGroup>();

  for (const child of children) {
    const id = child.category.id;
    const existing = byCategory.get(id);
    if (existing) {
      existing.members.push(child);
      continue;
    }
    byCategory.set(id, { categoryId: id, name: child.category.name, members: [child] });
  }

  const groups = [...byCategory.values()];
  for (const group of groups) {
    group.members.sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));
  }
  return groups.sort(
    (a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name, "nb-NO"),
  );
}

/** Én kategori-rad med sitt medlemspanel. */
function RegisterGroupRow({
  group,
  fallback,
  defaultExpanded,
}: {
  group: RegisterGroup;
  fallback: { icon: string; color: string };
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  // Samme derivasjon som kartmarkøren, så raden og pinnen for samme slags sted
  // ser identiske ut. Medlemmet har ingen pinne lenger, men kategorien det
  // tilhører har det andre steder på kartet.
  const identity = poiVisualIdentity(group.members[0], fallback);
  const Icon = getFilledIcon(identity.icon);
  const circle = markerCircleStyle(identity.color);

  return (
    <div>
      <button
        type="button"
        data-testid="register-group"
        data-category-id={group.categoryId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-1 py-2 text-left transition-colors duration-150 hover:bg-black/[0.03]"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2"
          style={{
            borderColor: circle.borderColor,
            backgroundColor: circle.backgroundColor,
            color: circle.borderColor,
          }}
        >
          <Icon className="h-3.5 w-3.5" weight="fill" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-stone-800">
          {group.name}
        </span>
        <span className="flex-none text-[12.5px] tabular-nums text-stone-500">
          {group.members.length}
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={`flex-none text-stone-400 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Begge tilstander står i DOM og veksles med CSS — husets
          expand/collapse-oppskrift (`trip-desktop-accordion-sidebar-20260209`).
          Ingen auto-scroll ved åpning: høyde-animasjonen er signal nok. */}
      <ul
        id={panelId}
        data-testid="register-members"
        data-expanded={expanded}
        aria-hidden={!expanded}
        className={`overflow-hidden pl-[38px] transition-all duration-300 ease-out ${
          expanded ? "max-h-[2000px] pb-1 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {group.members.map((member) => (
          <li
            key={member.id}
            data-testid="register-member"
            className="truncate py-[3px] text-[13px] leading-snug text-stone-600"
          >
            {member.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnchorRegister({ poi }: { poi: BoardPOI }) {
  const groups = useMemo(() => groupRegister(poi.childPOIs ?? []), [poi.childPOIs]);
  const summary = poi.raw.anchorSummary?.trim();

  if (groups.length === 0 && !summary) return null;

  const total = groups.reduce((sum, g) => sum + g.members.length, 0);
  const fallback = {
    icon: poi.raw.category.icon,
    color: poi.raw.category.color,
  };

  return (
    <section data-testid="anchor-register" className="mt-5 border-t border-stone-100 pt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
        {anchorRegisterHeading(poi.raw.category.id)}
      </p>

      {groups.length === 0 ? (
        <p data-testid="register-summary" className="text-[13.5px] leading-relaxed text-stone-600">
          {summary}
        </p>
      ) : (
        <div className="-mx-1">
          {groups.map((group) => (
            <RegisterGroupRow
              key={group.categoryId}
              group={group}
              fallback={fallback}
              defaultExpanded={total <= REGISTER_AUTO_EXPAND_MAX}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default AnchorRegister;
