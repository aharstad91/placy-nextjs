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
  // Always start with "no" to match SSR — detect client locale after mount
  const [locale, setLocaleState] = useState<Locale>("no");

  useEffect(() => {
    const saved = localStorage.getItem("placy-locale");
    if (saved === "en" || saved === "no") {
      setLocaleState(saved);
    } else if (navigator.language.startsWith("en")) {
      setLocaleState("en");
    }
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
