"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "violet" | "emerald" | "amber" | "rose" | "cyan";

export interface Theme {
  id: ThemeId;
  label: string;
  swatch: string; // Tailwind bg class for the swatch dot
}

export const THEMES: Theme[] = [
  { id: "violet", label: "Mor",    swatch: "#8b5cf6" },
  { id: "emerald",label: "Yeşil",  swatch: "#10b981" },
  { id: "amber",  label: "Sarı",   swatch: "#f59e0b" },
  { id: "rose",   label: "Kırmızı",swatch: "#f43f5e" },
  { id: "cyan",   label: "Mavi",   swatch: "#06b6d4" },
];

const LS_KEY = "rapflow_theme";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "violet",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("violet");

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as ThemeId | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      applyTheme(saved);
      setThemeState(saved);
    }
  }, []);

  function setTheme(id: ThemeId) {
    applyTheme(id);
    setThemeState(id);
    localStorage.setItem(LS_KEY, id);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  // Remove all theme classes first
  root.classList.remove("theme-violet", "theme-emerald", "theme-amber", "theme-rose", "theme-cyan");
  root.classList.add(`theme-${id}`);
}

export function useTheme() {
  return useContext(ThemeContext);
}
