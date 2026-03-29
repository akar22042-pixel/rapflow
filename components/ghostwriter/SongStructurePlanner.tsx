"use client";

import { useState, useCallback } from "react";

export type SectionType = "verse" | "hook" | "bridge" | "intro" | "outro";

export interface SongSection {
  id: string;
  type: SectionType;
  label: string;
  plannedBars: number;
  verses: string[][]; // collected verse groups (each is string[])
}

interface SongStructurePlannerProps {
  onSectionFocus: (type: SectionType, sectionId: string) => void;
  activeSectionId: string | null;
  onAddVerse?: (sectionId: string, lines: string[]) => void;
  sections: SongSection[];
  onSectionsChange: (sections: SongSection[]) => void;
}

const SECTION_META: Record<SectionType, { emoji: string; color: string; activeBg: string; defaultBars: number }> = {
  intro:  { emoji: "🎬", color: "text-zinc-300",   activeBg: "bg-zinc-500/20 border-zinc-400/50",          defaultBars: 4  },
  hook:   { emoji: "🎣", color: "text-amber-300",  activeBg: "bg-amber-500/20 border-amber-400/50",        defaultBars: 8  },
  verse:  { emoji: "📝", color: "text-violet-300", activeBg: "bg-violet-500/20 border-violet-400/50",      defaultBars: 16 },
  bridge: { emoji: "🌉", color: "text-blue-300",   activeBg: "bg-blue-500/20 border-blue-400/50",          defaultBars: 8  },
  outro:  { emoji: "🎬", color: "text-zinc-300",   activeBg: "bg-zinc-500/20 border-zinc-400/50",          defaultBars: 4  },
};

export const DEFAULT_SECTIONS: SongSection[] = [
  { id: "intro",   type: "intro",  label: "Intro",    plannedBars: 4,  verses: [] },
  { id: "hook-1",  type: "hook",   label: "Nakarat",  plannedBars: 8,  verses: [] },
  { id: "verse-1", type: "verse",  label: "Kıta 1",   plannedBars: 16, verses: [] },
  { id: "hook-2",  type: "hook",   label: "Nakarat",  plannedBars: 8,  verses: [] },
  { id: "verse-2", type: "verse",  label: "Kıta 2",   plannedBars: 16, verses: [] },
  { id: "bridge",  type: "bridge", label: "Köprü",    plannedBars: 8,  verses: [] },
  { id: "hook-3",  type: "hook",   label: "Nakarat",  plannedBars: 8,  verses: [] },
  { id: "outro",   type: "outro",  label: "Outro",    plannedBars: 4,  verses: [] },
];

const LINES_PER_BAR = 2;

export default function SongStructurePlanner({
  onSectionFocus,
  activeSectionId,
  sections,
  onSectionsChange,
}: SongStructurePlannerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const totalPlannedBars = sections.reduce((s, sec) => s + sec.plannedBars, 0);
  const totalWrittenBars = sections.reduce((s, sec) => {
    const lineCount = sec.verses.reduce((a, v) => a + v.length, 0);
    return s + Math.floor(lineCount / LINES_PER_BAR);
  }, 0);
  const progressPct = totalPlannedBars > 0 ? Math.min(100, Math.round((totalWrittenBars / totalPlannedBars) * 100)) : 0;

  function moveUp(idx: number) {
    if (idx === 0) return;
    onSectionsChange(sections.map((s, i, arr) =>
      i === idx - 1 ? arr[idx] : i === idx ? arr[idx - 1] : s
    ));
  }

  function moveDown(idx: number) {
    if (idx >= sections.length - 1) return;
    onSectionsChange(sections.map((s, i, arr) =>
      i === idx ? arr[idx + 1] : i === idx + 1 ? arr[idx] : s
    ));
  }

  function removeSection(id: string) {
    onSectionsChange(sections.filter((s) => s.id !== id));
  }

  function addSection(type: SectionType) {
    const meta = SECTION_META[type];
    const count = sections.filter((s) => s.type === type).length + 1;
    const labels: Record<SectionType, string> = {
      verse: `Kıta ${count}`, hook: "Nakarat", bridge: "Köprü", intro: "Intro", outro: "Outro"
    };
    onSectionsChange([...sections, {
      id: `${type}-${Date.now()}`,
      type,
      label: labels[type],
      plannedBars: meta.defaultBars,
      verses: [],
    }]);
  }

  const toggleExpand = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Full song preview
  const fullSongLines: { section: string; lines: string[] }[] = sections
    .filter((s) => s.verses.length > 0)
    .map((s) => ({
      section: `${SECTION_META[s.type].emoji} ${s.label}`,
      lines: s.verses.flat(),
    }));

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl border bg-white/5 backdrop-blur-sm border-white/10">
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Şarkı Yapısı</p>
        <h3 className="text-sm font-bold text-white">📐 Bölümleri Planla</h3>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-zinc-500">Şarkı tamamlanma</span>
          <span className="text-[10px] font-mono text-violet-300">{progressPct}% · {totalWrittenBars}/{totalPlannedBars} bar</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
          />
        </div>
      </div>

      {/* Sections list */}
      <div className="flex flex-col gap-1.5">
        {sections.map((sec, idx) => {
          const meta = SECTION_META[sec.type];
          const isActive = activeSectionId === sec.id;
          const lineCount = sec.verses.reduce((a, v) => a + v.length, 0);
          const writtenBars = Math.floor(lineCount / LINES_PER_BAR);
          const barsPct = sec.plannedBars > 0 ? Math.min(100, Math.round((writtenBars / sec.plannedBars) * 100)) : 0;
          const isExpanded = expandedSections.has(sec.id);

          return (
            <div key={sec.id} className="flex flex-col">
              <div
                className={[
                  "flex items-center gap-2 border rounded-xl px-3 py-2 transition-all",
                  isActive
                    ? `${meta.activeBg} ring-1 ring-violet-500/30`
                    : "bg-white/5 border-white/10 hover:border-white/20",
                ].join(" ")}
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0}
                    className="text-[8px] text-zinc-600 hover:text-zinc-300 disabled:opacity-20 leading-none">▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === sections.length - 1}
                    className="text-[8px] text-zinc-600 hover:text-zinc-300 disabled:opacity-20 leading-none">▼</button>
                </div>

                {/* Section badge */}
                <span className={["text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                  isActive ? "bg-violet-600 border-violet-500 text-white" : `bg-white/5 border-white/10 ${meta.color}`
                ].join(" ")}>
                  {meta.emoji} {sec.label}
                </span>

                {/* Bar progress */}
                <div className="flex-1 min-w-0">
                  <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500/60 rounded-full transition-all" style={{ width: `${barsPct}%` }} />
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-0.5">
                    {writtenBars}/{sec.plannedBars} bar yazıldı
                    {sec.verses.length > 0 && (
                      <button onClick={() => toggleExpand(sec.id)} className="ml-1.5 text-violet-400 hover:text-violet-300">
                        {isExpanded ? "▾ gizle" : `▸ ${sec.verses.length} dörtlük`}
                      </button>
                    )}
                  </p>
                </div>

                {/* Focus button */}
                <button
                  onClick={() => onSectionFocus(sec.type, sec.id)}
                  className={["text-[9px] px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 font-semibold",
                    isActive
                      ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:border-violet-500 hover:text-white",
                  ].join(" ")}
                >
                  {isActive ? "✦ Aktif" : "Buraya Yaz"}
                </button>

                {/* Remove */}
                <button onClick={() => removeSection(sec.id)}
                  className="text-zinc-700 hover:text-red-400 text-[10px] transition-colors flex-shrink-0">✕</button>
              </div>

              {/* Expanded verses */}
              {isExpanded && sec.verses.length > 0 && (
                <div className="ml-8 mt-1 flex flex-col gap-1 mb-1">
                  {sec.verses.map((verse, vi) => (
                    <div key={vi} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-zinc-500 mb-0.5">Dörtlük {vi + 1}</p>
                      <p className="text-[11px] text-zinc-300 font-mono leading-relaxed line-clamp-1">
                        {verse[0] ?? ""}
                      </p>
                      {verse.length > 1 && (
                        <p className="text-[9px] text-zinc-600 mt-0.5">+{verse.length - 1} satır daha</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/10">
        <p className="w-full text-[10px] text-zinc-600 mb-0.5">Bölüm ekle:</p>
        {(["verse", "hook", "bridge", "intro", "outro"] as SectionType[]).map((type) => (
          <button
            key={type}
            onClick={() => addSection(type)}
            className="px-2.5 py-1 rounded-full text-[10px] border bg-white/5 border-white/10 text-zinc-400 hover:border-violet-500 hover:text-white transition-colors"
          >
            {SECTION_META[type].emoji} {type}
          </button>
        ))}
      </div>

      {/* Full song preview button */}
      {fullSongLines.length > 0 && (
        <>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-all bg-gradient-to-r from-violet-600 to-purple-700 border-violet-500 text-white hover:scale-[1.01] active:scale-[0.99]"
          >
            {showPreview ? "✕ Kapat" : "📜 Tüm Şarkıyı Gör"}
          </button>

          {showPreview && (
            <div className="flex flex-col gap-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 animate-fadeIn">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">Şarkı Önizleme</h4>
              {fullSongLines.map((group, gi) => (
                <div key={gi} className="flex flex-col gap-1">
                  <p className="text-[10px] text-violet-400 font-semibold">{group.section}</p>
                  {group.lines.map((line, li) => (
                    <p key={li} className="text-xs text-zinc-300 font-mono leading-relaxed pl-3 border-l border-violet-500/30">
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
