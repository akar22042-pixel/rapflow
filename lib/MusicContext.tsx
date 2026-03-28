"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";

interface MusicContextValue {
  currentBPM: number;
  setCurrentBPM: (bpm: number) => void;
  currentStyle: string;
  setCurrentStyle: (style: string) => void;
  currentLyrics: string;
  setCurrentLyrics: (lyrics: string) => void;
  targetSyllables: number;
  breathInterval: number;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [currentBPM, setCurrentBPM] = useState(100);
  const [currentStyle, setCurrentStyle] = useState("Kanye West");
  const [currentLyrics, setCurrentLyrics] = useState("");

  const targetSyllables = useMemo(() => Math.round(currentBPM / 30), [currentBPM]);

  const breathInterval = useMemo(() => {
    if (currentBPM < 80) return 16;
    if (currentBPM < 120) return 8;
    return 4;
  }, [currentBPM]);

  return (
    <MusicContext.Provider
      value={{
        currentBPM,
        setCurrentBPM,
        currentStyle,
        setCurrentStyle,
        currentLyrics,
        setCurrentLyrics,
        targetSyllables,
        breathInterval,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusicContext(): MusicContextValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusicContext must be used within a MusicProvider");
  return ctx;
}
