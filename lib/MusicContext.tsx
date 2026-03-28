"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { StyleProfile, loadStyleProfile } from "@/lib/styleProfile";

interface MusicContextValue {
  currentBPM: number;
  setCurrentBPM: (bpm: number) => void;
  currentStyle: string;
  setCurrentStyle: (style: string) => void;
  currentLyrics: string;
  setCurrentLyrics: (lyrics: string) => void;
  targetSyllables: number;
  breathInterval: number;
  pendingLines: string[];
  setPendingLines: (lines: string[]) => void;
  styleProfile: StyleProfile | null;
  setStyleProfile: (profile: StyleProfile | null) => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [currentBPM, setCurrentBPM]       = useState(100);
  const [currentStyle, setCurrentStyle]   = useState("Kanye West");
  const [currentLyrics, setCurrentLyrics] = useState("");
  const [pendingLines, setPendingLines]   = useState<string[]>([]);
  const [styleProfile, setStyleProfile]   = useState<StyleProfile | null>(() => {
    // Lazy init from localStorage — only runs on client
    if (typeof window === "undefined") return null;
    return loadStyleProfile();
  });

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
        pendingLines,
        setPendingLines,
        styleProfile,
        setStyleProfile,
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
