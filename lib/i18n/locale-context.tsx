"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Locale } from "./strings";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "no",
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start with "no" to match SSR — read the saved choice after mount
  const [locale, setLocaleState] = useState<Locale>("no");

  useEffect(() => {
    const saved = localStorage.getItem("placy-locale");
    if (saved === "en" || saved === "no") {
      setLocaleState(saved);
    }
    // INGEN auto-deteksjon av navigator.language (fjernet 2026-08-14).
    //
    // Et norsk boligboard byttet språk fordi nettleseren tilfeldigvis sto på
    // engelsk, og engelsk er bare halvveis implementert: knappelabels som
    // «Utforsk» er hardkodet norske, mens POI-tekstene kom fra
    // oversettelsesrader laget februar–april 2026. En engelsk bruker fikk
    // dermed «Walking distance from Overvik» på et Grilstad-board — Overvik er
    // et prosjekt som ikke finnes lenger.
    //
    // Samme mekanisme ga feil innhold 2026-08-12 (tema-radene på bar nøkkel).
    // Da ble dataene ryddet, ikke mekanismen. Engelsk krever nå et aktivt valg.
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("placy-locale", l);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
