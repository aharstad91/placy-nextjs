"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "no";
  const saved = localStorage.getItem("placy-locale");
  if (saved === "en" || saved === "no") return saved;
  if (navigator.language.startsWith("en")) return "en";
  return "no";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("placy-locale", l);
    }
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
