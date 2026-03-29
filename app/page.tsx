"use client";

import { useState, useRef, useEffect } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import Metronome from "@/components/metronome/Metronome";
import FlowPanel from "@/components/flow/FlowPanel";
import LyricsEditor from "@/components/lyrics/LyricsEditor";
import BreathTrainer from "@/components/breath/BreathTrainer";
import GhostWriter from "@/components/ghostwriter/GhostWriter";
import BeatMatcher from "@/components/beatmatch/BeatMatcher";
import CypherMode from "@/components/cypher/CypherMode";
import BattleMode from "@/components/battle/BattleMode";
import ThemeCustomizer from "@/components/theme/ThemeCustomizer";

const TABS = [
  { id: "metronome",   emoji: "🥁", label: "Metronom"    },
  { id: "flow",        emoji: "🎤", label: "Flow"         },
  { id: "lyrics",      emoji: "✍️", label: "Söz Editörü" },
  { id: "ghostwriter", emoji: "👻", label: "Ghost Writer" },
  { id: "beatmatch",   emoji: "🎵", label: "Beat Match"   },
  { id: "cypher",      emoji: "🔄", label: "Cypher"       },
  { id: "battle",      emoji: "⚔️", label: "Battle"       },
  { id: "breath",      emoji: "💨", label: "Nefes"        },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("metronome");
  const { currentBPM, currentStyle } = useMusicContext();
  const [isPlaying] = useState(false); // metronome playing state for BPM badge animation
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Update sliding indicator position
  useEffect(() => {
    if (!tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
    if (!activeBtn) return;
    setIndicatorStyle({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
    });
  }, [activeTab]);

  return (
    <div
      className="min-h-screen flex flex-col relative animate-fadeIn"
      style={{ background: "#0a0a0a", color: "#f4f4f5" }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-2 sm:h-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0">
          {/* Logo */}
          <div className="flex items-center gap-1">
            <span className="text-gradient text-xl font-black tracking-tighter select-none">Rap</span>
            <span className="text-white text-xl font-black tracking-tighter select-none">Flow</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <span className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono border transition-all",
              "bg-white/5 border-white/10 text-violet-300",
              isPlaying ? "animate-glowPulse" : "",
            ].join(" ")}>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {currentBPM} BPM
            </span>
            <span className="flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-medium text-zinc-300 max-w-[160px] truncate">
              {currentStyle}
            </span>
            <ThemeCustomizer />
          </div>
        </div>

        {/* Gradient line under header */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgb(var(--t500)), transparent)" }} />

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div ref={tabBarRef} className="flex min-w-max sm:min-w-0 px-4 relative">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex-1 sm:flex-1 flex-shrink-0 py-2.5 px-3 sm:px-0 text-xs font-semibold tracking-wide transition-all duration-200 border-b-2 relative",
                    isActive
                      ? "border-transparent text-violet-300"
                      : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
                  ].join(" ")}
                >
                  <span className="sm:hidden">{tab.emoji}</span>
                  <span className="hidden sm:inline">{tab.emoji} {tab.label}</span>
                </button>
              );
            })}
            {/* Sliding indicator */}
            <div
              className="absolute bottom-0 h-0.5 rounded-full transition-all duration-300 ease-out tab-indicator"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                background: "linear-gradient(90deg, rgb(var(--t500)), rgb(var(--t600)))",
                boxShadow: "0 0 8px rgba(124,58,237,0.4)",
              }}
            />
          </div>
        </div>
      </header>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 relative z-10">
        <div className="animate-fadeIn" key={activeTab}>
          {activeTab === "metronome"   && <Metronome />}
          {activeTab === "flow"        && <FlowPanel />}
          {activeTab === "lyrics"      && <LyricsEditor />}
          {activeTab === "ghostwriter" && <GhostWriter />}
          {activeTab === "beatmatch"   && <BeatMatcher />}
          {activeTab === "cypher"      && <CypherMode />}
          {activeTab === "battle"      && <BattleMode />}
          {activeTab === "breath"      && <BreathTrainer />}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-3 text-center text-xs text-zinc-700 relative z-10">
        RapFlow — AI-powered rap flow trainer
      </footer>
    </div>
  );
}
