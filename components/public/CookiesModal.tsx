"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const STORAGE_KEY = "placy-cookies-ok";

/**
 * Informasjonskapsler-link i footeren, åpner en modal med kort info.
 *
 * MVP — ikke full GDPR-consent-flyt (proaktiv banner med preferanser).
 * Bruker shadcn Dialog med innebygd focus-trap, Escape-lukking og a11y.
 * Husker brukerens "OK"-valg i localStorage for fremtidig proaktiv banner.
 */
export default function CookiesModal() {
  const handleAccept = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // localStorage kan være blokkert (Safari ITP, Private Browsing)
        // — aksept-modalen lukkes uansett via DialogClose
      }
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="hover:text-[#1a1a1a] transition-colors underline-offset-2 hover:underline"
        >
          Informasjonskapsler
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Informasjonskapsler</DialogTitle>
          <DialogDescription className="text-sm text-[#4a4a4a] pt-2">
            Vi bruker informasjonskapsler for å forstå bruken av siden og
            forbedre opplevelsen. Vi deler ikke persondata med tredjepart
            utover det som er nødvendig for anonym bruks-analyse (Plausible).
            <br />
            <br />
            Ved å bruke Placy aksepterer du dette.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center justify-center rounded-md bg-[#1a1a1a] text-white px-4 py-2 text-sm font-medium hover:bg-[#2a2a2a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1a1a1a]"
            >
              OK
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
