// Fane-raden på innsiktssidene: samme transport som boardets StoryRail —
// temaene i boardets farger, i ett avrundet spor. Her er brikkene LENKER til
// egne sider, ikke steg i en omvisning, så raden bygges med Next-Link og uten
// omvisnings-tilstand. Utseendet speiler StoryRails brikke bevisst: megleren
// skal kjenne igjen produktet kunden ser.
//
// ## Første brikke er FESTET og heter «Oversikt»
//
// På boardet heter utgangen «Tilbake» (2026-09-05): der er området et stopp du
// forlater, og brikken beskriver bevegelsen. Her er oversikten et STED du står
// på like ofte som du går til det — det er siden megleren lander på, og siden
// alle tema-lenkene peker hjem til. En pil bakover ville lyve på oversiktssiden
// selv (bakover fra hva?). Brikken er derfor et hjem: hus-ikon og ordet
// «Oversikt», aktiv når du er der, akkurat som temaene.
//
// Den ligger UTENFOR sporet som ruller. Med seks temaer og en vanlig mus uten
// sidelengs sveip kan resten av raden bare nås ved å dra, men veien hjem skal
// alltid være synlig. En loddrett strek skiller det faste fra det rullende.

"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Home, type LucideIcon } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { cn } from "@/lib/utils";
import type { CategoryInsight } from "@/lib/insight/types";

export interface InsightRailProps {
  /** Grunnsti til oversikten, f.eks. `/eiendom/kunde/prosjekt/innsikt`. */
  basePath: string;
  /** `?t=…` og evt. demo/dager — må følge alle lenker. */
  query: string;
  themes: CategoryInsight[];
}

export function InsightRail({ basePath, query, themes }: InsightRailProps) {
  /* Hvor vi er, lest fra ruta i stedet for mottatt som prop: raden bor i
     layouten og skal IKKE bygges på nytt ved navigasjon. Se InsightShell. */
  const activeId = useActiveThemeId();

  return (
    <nav aria-label="Innsikt per tema" className="flex min-w-0 items-stretch gap-0.5 rounded-[22px] bg-black/[0.055] p-1">
      <Chip href={`${basePath}${query}`} label="Oversikt" Icon={Home} color="#1c1917" active={activeId === null} root />
      <span aria-hidden className="my-1.5 w-px shrink-0 bg-stone-900/[0.11]" />
      <div
        role="presentation"
        className={cn(
          "flex min-w-0 flex-1 flex-nowrap items-stretch gap-0.5 overflow-x-auto overflow-y-hidden",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden [overscroll-behavior-x:contain]",
        )}
      >
        {themes.map((c) => (
          <Chip
            key={c.id}
            href={`${basePath}/${c.id}${query}`}
            label={c.label}
            Icon={getIcon(c.icon ?? "MapPin")}
            color={c.color ?? "#78716c"}
            active={activeId === c.id}
          />
        ))}
      </div>
    </nav>
  );
}

/** Segmentet under `innsikt`: `__PAGE__` (eller null) = oversikten. */
export function useActiveThemeId(): string | null {
  const segment = useSelectedLayoutSegment();
  return !segment || segment === "__PAGE__" ? null : segment;
}

function Chip({ href, label, Icon, color, active, root = false }: {
  href: string; label: string; Icon: LucideIcon; color: string; active: boolean; root?: boolean;
}) {
  return (
    <Link
      href={href}
      /* Se InsightSidebar: sidene er dynamiske, så payloaden hentes ikke uten
         at vi ber om det — og uten den blir hvert temabytte en lasting. */
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 flex-col items-center gap-[3px] rounded-[18px] px-[11px] pb-[7px] pt-1.5",
        "whitespace-nowrap text-[11px] font-semibold tracking-[-0.01em] transition-colors duration-200",
        active
          ? "bg-white text-stone-900 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.07),0_1px_3px_rgba(28,25,23,0.1)]"
          : "text-stone-500 hover:text-stone-800",
      )}
    >
      <span aria-hidden className="flex h-[22px] shrink-0 items-center justify-center">
        <span
          className={cn("flex shrink-0 items-center justify-center rounded-full text-white", root ? "h-[22px] w-[22px]" : "h-5 w-5")}
          style={{ backgroundColor: color }}
        >
          <Icon size={root ? 13 : 12} strokeWidth={root ? 2.5 : 2} />
        </span>
      </span>
      <span>{label}</span>
    </Link>
  );
}
