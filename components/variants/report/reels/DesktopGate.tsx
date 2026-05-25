"use client";

import Link from "next/link";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

interface Props {
  fallbackHref: string;
  children: React.ReactNode;
}

export function DesktopGate({ fallbackHref, children }: Props) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (!isDesktop) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-8 bg-background text-foreground">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Placy Reels — best på mobil</h1>
        <p className="text-muted-foreground">
          Denne visningen er designet for vertikal swipe på telefon. Åpne lenken
          under på mobilen, eller gå til rapporten istedenfor.
        </p>
        <Link
          href={fallbackHref}
          className="inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium hover:opacity-90 transition-opacity"
        >
          Åpne rapporten
        </Link>
      </div>
    </div>
  );
}
