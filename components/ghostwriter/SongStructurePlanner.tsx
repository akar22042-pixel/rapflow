"use client";

import { useState } from "react";

export type SectionType = "verse" | "hook" | "bridge" | "intro" | "outro";

export interface SongSection {
  id: string;
  type: SectionType;
  label: string;
  plannedBars: number;
  writtenBars: number;
}

interface SongStructurePlannerProps {
  onSectionFocus: (type: SectionType) => void;
  writtenLineCount: number;
}

const SECTION_META: Record<SectionType, { emoji: string; color: string; defaultBars: number }> = {
  intro:  { emoji: "🎬", color: "bg-zinc-700 border-zinc-600 text-zinc-300",            defaultBars: 4  },
  hook:   { emoji: "🎣", color: "bg-amber-500/20 border-amber-500/40 text-amber-300",   defaultBars: 8  },
  verse:  { emoji: "📝", color: "bg-violet-500/20 border-violet-500/40 text-violet-300", defaultBars: 16 },
  bridge: { emoji: "🌉", color: "bg-blue-500/20 border-blue-500/40 text-blue-300",      defaultBars: 8  },
  outro:  { emoji: "🎬", color: "bg-zinc-700 border-zinc-600 text-zinc-300",            defaultBars: 4  },
};

const DEFAULT_STRUCTURE: SongSection[] = [
  { id: "intro",   type: "intro",  label: "Intro",    plannedBars: 4,  writtenBars: 0 },
  { id: "hook-1",  type: "hook",   label: "Nakarat",  plannedBars: 8,  writtenBars: 0 },
  { id: "verse-1", type: "verse",  label: "Kıta 1",   plannedBars: 16, writtenBars: 0 },
  { id: "hook-2",  type: "hook",   label: "Nakarat",  plannedBars: 8,  writtenBars: 0 },
  { id: "verse-2", type: "verse",  label: "Kıta 2",   plannedBars: 16, writtenBars: 0 },
  { id: "bridge",  type: "bridge", label: "Köprü",    plannedBars: 8,  writtenBars: 0 },
  { id: "hook-3",  type: "hook",   label: "Nakarat",  plannedBars: 8,  writtenBars: 0 },
  { id: "outro",   type: "outro",  label: "Outro",    plannedBars: 4,  writtenBars: 0 },
];

const LINES_PER_BAR = 2; // 2 lines = 1 bar

export default function SongStructurePlanner({ onSectionFocus, writtenLineCount }: SongStructurePlannerProps) {
  const [sections, setSections] = useState<SongSection[]>(DEFAULT_STRUCTURE);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const totalPlannedBars = sections.reduce((s, sec) => s + sec.plannedBars, 0);
  const writtenBarsTotal = Math.floor(writtenLineCount / LINES_PER_BAR);
  const progressPct = Math.min(100, Math.round((writtenBarsTotal / totalPlannedBars) * 100));

  function moveUp(idx: number) {
    if (idx === 0) return;
    setSections((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    setSections((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function addSection(type: SectionType) {
    const meta = SECTION_META[type];
    const count = sections.filter((s) => s.type === type).length + 1;
    const labels: Record<SectionType, string> = {
      verse: `Kıta ${count}`, hook: "Nakarat", bridge: "Köprü", intro: "Intro", outro: "Outro"
    };
    setSections((prev) => [...prev, {
      id: `${type}-${Date.now()}`,
      type,
      label: labels[type],
      plannedBars: meta.defaultBars,
      writtenBars: 0,
    }]);
  }

  return (
    <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Şarkı Yapısı</p>
        <h3 className="text-sm font-bold text-white">📐 Bölümleri Planla</h3>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-zinc-500">Şarkı tamamlanma</span>
          <span className="text-[10px] font-mono text-violet-300">{progressPct}% · {writtenBarsTotal}/{totalPlannedBars} bar</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Sections list */}
      <div className="flex flex-col gap-1.5">
        {sections.map((sec, idx) => {
          const meta = SECTION_META[sec.type];
          const isActive = activeSectionId === sec.id;
          const barsPct = Math.min(100, Math.round((sec.writtenBars / sec.plannedBars) * 100));
          return (
            <div
              key={sec.id}
              className={["flex items-center gap-2 border rounded-xl px-3 py-2 transition-all",
                isActive ? "bg-violet-950/30 border-violet-500/50 ring-1 ring-violet-500/20" : "bg-zinc-800/40 border-zinc-700/60",
              ].join(" ")}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-[8px] text-zinc-600 hover:text-zinc-300 disabled:opacity-20 leading-none"
                >▲</button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === sections.length - 1}
                  className="text-[8px] text-zinc-600 hover:text-zinc-300 disabled:opacity-20 leading-none"
                >▼</button>
              </div>

              {/* Section badge */}
              <span className={["text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", meta.color].join(" ")}>
                {meta.emoji} {sec.label}
              </span>

              {/* Bar progress mini */}
              <div className="flex-1 min-w-0">
                <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500/60 rounded-full transition-all" style={{ width: `${barsPct}%` }} />
                </div>
                <p className="text-[9px] text-zinc-600 mt-0.5">{sec.plannedBars} bar</p>
              </div>

              {/* Focus button */}
              <button
                onClick={() => {
                  setActiveSectionId(sec.id);
                  onSectionFocus(sec.type);
                }}
                className={["text-[9px] px-2 py-1 rounded-lg border transition-colors flex-shrink-0",
                  isActive
                    ? "bg-violet-600 border-violet-500 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white",
                ].join(" ")}
              >
                {isActive ? "✦ Aktif" : "Buraya Yaz"}
              </button>

              {/* Remove */}
              <button
                onClick={() => removeSection(sec.id)}
                className="text-zinc-700 hover:text-red-400 text-[10px] transition-colors flex-shrink-0"
              >✕</button>
            </div>
          );
        })}
      </div>

      {/* Add section buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-800">
        <p className="w-full text-[10px] text-zinc-600 mb-0.5">Bölüm ekle:</p>
        {(["verse", "hook", "bridge", "intro", "outro"] as SectionType[]).map((type) => (
          <button
            key={type}
            onClick={() => addSection(type)}
            className="px-2.5 py-1 rounded-full text-[10px] border bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white transition-colors"
          >
            {SECTION_META[type].emoji} {type}
          </button>
        ))}
      </div>
    </div>
  );
}
