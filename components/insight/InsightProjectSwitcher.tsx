// Prosjekt-velgeren: hvilket board du ser på, og veien til kundens andre.
//
// Bygget på <details>, ikke på tilstand i React. Sidene er rene
// server-komponenter, og en meny som bare skal åpne og lukke seg trenger ikke
// et klient-bundle for å gjøre det. Escape og klikk utenfor mangler, men en
// meny som lukker seg ved å klikkes på igjen er ikke i veien for noe: den
// ligger øverst i et panel, ikke over innholdet du leser.
//
// Har kunden bare ETT board, er dette ikke en velger i det hele tatt — da
// vises navnet som ren tekst. En nedtrekksmeny med ett valg lover et sted å gå
// og fører tilbake til der du sto.

import Link from "next/link";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightCustomer, InsightSwitcherOption } from "@/lib/insight/projects";

export function InsightProjectSwitcher({ customer, projectName, options, className }: {
  customer: InsightCustomer | null;
  projectName: string;
  options: InsightSwitcherOption[];
  className?: string;
}) {
  const others = options.filter((o) => !o.current);
  const label = (
    <>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14px] font-semibold leading-tight tracking-tight text-stone-900">{projectName}</span>
        <span className="block truncate text-[11.5px] text-stone-500">{customer?.name ?? ""}</span>
      </span>
    </>
  );

  if (others.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.07]", className)}>
        {label}
      </div>
    );
  }

  return (
    <details className={cn("group relative", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.07]",
          "transition-shadow hover:shadow-sm [&::-webkit-details-marker]:hidden",
        )}
      >
        {label}
        <ChevronsUpDown size={15} className="shrink-0 text-stone-400" aria-hidden />
      </summary>
      <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/[0.08]">
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] uppercase tracking-[0.12em] text-stone-400">Boards</p>
        <ul>
          {options.map((o) => (
            <li key={o.project.id}>
              <Link
                href={o.href}
                aria-current={o.current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] leading-tight",
                  o.current ? "bg-stone-100 font-medium text-stone-900" : "text-stone-700 hover:bg-stone-50",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{o.project.name}</span>
                {o.current && <Check size={14} className="shrink-0 text-stone-500" aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
