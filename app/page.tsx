"use client";

import { useState } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import Metronome from "@/components/metronome/Metronome";
import FlowPanel from "@/components/flow/FlowPanel";
import LyricsEditor from "@/components/lyrics/LyricsEditor";
import BreathTrainer from "@/components/breath/BreathTrainer";
import GhostWriter from "@/components/ghostwriter/GhostWriter";
import BeatMatcher from "@/components/beatmatch/BeatMatcher";
import CypherMode from "@/components/cypher/CypherMode";

const TABS = [
  { id: "metronome",   emoji: "🥁", label: "Metronom"    },
  { id: "flow",        emoji: "🎤", label: "Flow"         },
  { id: "lyrics",      emoji: "✍️", label: "Söz Editörü" },
  { id: "ghostwriter", emoji: "👻", label: "Ghost Writer" },
  { id: "beatmatch",   emoji: "🎵", label: "Beat Match"   },
  { id: "cypher",      emoji: "🔄", label: "Cypher"       },
  { id: "breath",      emoji: "💨", label: "Nefes"        },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("metronome");
  const { currentBPM, currentStyle } = useMusicContext();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0a0a", color: "#f4f4f5" }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-2 sm:h-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-violet-400 text-xl font-black tracking-tighter select-none">Rap</span>
            <span className="text-white text-xl font-black tracking-tighter select-none">Flow</span>
          </div>

          {/* Badges — stacked below logo on mobile, inline on sm+ */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs font-mono text-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {currentBPM} BPM
            </span>
            <span className="flex items-center rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 max-w-[160px] truncate">
              {currentStyle}
            </span>
          </div>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div className="flex min-w-max sm:min-w-0 px-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex-1 sm:flex-1 flex-shrink-0 py-2.5 px-3 sm:px-0 text-xs font-semibold tracking-wide transition-colors border-b-2",
                    isActive
                      ? "border-violet-500 text-violet-300"
                      : "border-transparent text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                >
                  <span className="sm:hidden">{tab.emoji}</span>
                  <span className="hidden sm:inline">{tab.emoji} {tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        {activeTab === "metronome"   && <Metronome />}
        {activeTab === "flow"        && <FlowPanel />}
        {activeTab === "lyrics"      && <LyricsEditor />}
        {activeTab === "ghostwriter" && <GhostWriter />}
        {activeTab === "beatmatch"   && <BeatMatcher />}
        {activeTab === "cypher"      && <CypherMode />}
        {activeTab === "breath"      && <BreathTrainer />}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-3 text-center text-xs text-zinc-700">
        RapFlow — AI-powered rap flow trainer
      </footer>
    </div>
  );
}
