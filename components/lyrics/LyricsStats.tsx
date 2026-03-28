"use client";

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LyricsStatsProps {
  lines: string[];
  bpm: number;
  syllablesPerBeat: number;
}

// ---------------------------------------------------------------------------
// Shared helpers (duplicated to keep this component self-contained)
// ---------------------------------------------------------------------------
const TURKISH_VOWELS = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü"]);

function countLineSyllables(line: string): number {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce(
      (sum, w) =>
        sum + [...w.toLowerCase()].filter((c) => TURKISH_VOWELS.has(c)).length,
      0
    );
}

function lastWord(line: string): string {
  const words = line.trim().split(/\s+/);
  return (
    words[words.length - 1]?.replace(/[.,!?;:'"…-]+$/, "").toLowerCase() ?? ""
  );
}

function rhymeSuffix(word: string, chars = 3): string {
  return word.length < chars ? word : word.slice(-chars);
}

function buildRhymeMap(lines: string[]): Map<number, number> {
  const suffixLines = new Map<string, number[]>();
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const s = rhymeSuffix(lastWord(line));
    if (!suffixLines.has(s)) suffixLines.set(s, []);
    suffixLines.get(s)!.push(i);
  });

  const lineGroup = new Map<number, number>();
  let nextGroup = 0;
  suffixLines.forEach((indices) => {
    if (indices.length < 2) return;
    const gIdx = nextGroup % RHYME_PALETTE.length;
    nextGroup++;
    indices.forEach((i) => lineGroup.set(i, gIdx));
  });
  return lineGroup;
}

// ---------------------------------------------------------------------------
// Rhyme palette (mirrors LyricsEditor)
// ---------------------------------------------------------------------------
const RHYME_PALETTE = [
  { pill: "bg-violet-500 text-white",  label: "A" },
  { pill: "bg-emerald-500 text-white", label: "B" },
  { pill: "bg-amber-500 text-white",   label: "C" },
  { pill: "bg-rose-500 text-white",    label: "D" },
  { pill: "bg-cyan-500 text-white",    label: "E" },
  { pill: "bg-orange-500 text-white",  label: "F" },
] as const;

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-none">
        {label}
      </p>
      <p className={["text-xl font-bold leading-tight", accent ?? "text-white"].join(" ")}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-zinc-500 leading-tight truncate">{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LyricsStats({
  lines,
  bpm,
  syllablesPerBeat,
}: LyricsStatsProps) {
  const nonEmptyLines = useMemo(() => lines.filter((l) => l.trim()), [lines]);
  const rhymeMap      = useMemo(() => buildRhymeMap(lines), [lines]);

  const sylCounts = useMemo(
    () => nonEmptyLines.map((l) => ({ line: l, count: countLineSyllables(l) })),
    [nonEmptyLines]
  );

  const totalLines     = nonEmptyLines.length;
  const totalSyllables = useMemo(
    () => sylCounts.reduce((s, x) => s + x.count, 0),
    [sylCounts]
  );
  const avgSyllables = totalLines > 0 ? (totalSyllables / totalLines).toFixed(1) : "0";

  const rhymedLineCount = useMemo(
    () =>
      lines.filter((l, i) => l.trim() && (rhymeMap.get(i) ?? -1) >= 0).length,
    [lines, rhymeMap]
  );
  const rhymeDensity =
    totalLines > 0 ? Math.round((rhymedLineCount / totalLines) * 100) : 0;

  const longestEntry = useMemo(
    () => sylCounts.reduce<{ line: string; count: number } | null>((best, x) =>
      x.count > (best?.count ?? -1) ? x : best, null),
    [sylCounts]
  );
  const shortestEntry = useMemo(
    () =>
      sylCounts
        .filter((x) => x.count > 0)
        .reduce<{ line: string; count: number } | null>(
          (best, x) => (best === null || x.count < best.count ? x : best),
          null
        ),
    [sylCounts]
  );

  // Performance time: totalSyllables / (bpm * syllablesPerBeat) minutes → seconds
  const effectiveSyllablesPerSec = (bpm * syllablesPerBeat) / 60;
  const perfSecs =
    effectiveSyllablesPerSec > 0
      ? Math.round(totalSyllables / effectiveSyllablesPerSec)
      : 0;
  const perfLabel =
    perfSecs >= 60
      ? `${Math.floor(perfSecs / 60)}:${String(perfSecs % 60).padStart(2, "0")}`
      : `${perfSecs}s`;

  // Rhyme scheme: one entry per line (null for empty lines)
  const rhymeScheme = useMemo(() => {
    return lines.map((line, i) => {
      if (!line.trim()) return null;
      const g = rhymeMap.get(i) ?? -1;
      return g >= 0 ? { letter: RHYME_PALETTE[g].label, groupIdx: g } : null;
    });
  }, [lines, rhymeMap]);

  // Scheme pattern string for non-empty lines only, e.g. "AABB" or "ABAB"
  const schemeStr = rhymeScheme
    .filter((x) => x !== null)
    .map((x) => x!.letter)
    .join("");

  if (totalLines === 0) return null;

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-2xl border border-zinc-700">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
        Sözlük İstatistikleri
      </p>

      {/* ── Main stat grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label="Toplam Satır"
          value={String(totalLines)}
          accent="text-violet-300"
        />
        <StatCard
          label="Toplam Hece"
          value={String(totalSyllables)}
          accent="text-violet-300"
        />
        <StatCard
          label="Ort. Hece / Satır"
          value={avgSyllables}
          accent="text-zinc-100"
        />
        <StatCard
          label="Kafiye Yoğunluğu"
          value={`${rhymeDensity}%`}
          sub={`${rhymedLineCount} / ${totalLines} satır`}
          accent={
            rhymeDensity >= 60
              ? "text-emerald-400"
              : rhymeDensity >= 30
              ? "text-amber-400"
              : "text-zinc-400"
          }
        />
      </div>

      {/* ── Secondary stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatCard
          label="En Uzun Satır"
          value={`${longestEntry?.count ?? 0} hece`}
          sub={longestEntry?.line ?? "—"}
          accent="text-red-300"
        />
        <StatCard
          label="En Kısa Satır"
          value={`${shortestEntry?.count ?? 0} hece`}
          sub={shortestEntry?.line ?? "—"}
          accent="text-blue-300"
        />
        <StatCard
          label="Tahmini Süre"
          value={perfLabel}
          sub={`${bpm} BPM × ${syllablesPerBeat} hece/beat`}
          accent="text-emerald-300"
        />
      </div>

      {/* ── Rhyme scheme pills ── */}
      {schemeStr.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            Kafiye Şeması
            {schemeStr && (
              <span className="ml-2 text-zinc-600 normal-case tracking-normal font-mono">
                {schemeStr}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1 overflow-x-auto pb-0.5">
            {rhymeScheme.map((item, i) =>
              item ? (
                <span
                  key={i}
                  className={[
                    "px-2 py-0.5 rounded-full text-xs font-bold",
                    RHYME_PALETTE[item.groupIdx].pill,
                  ].join(" ")}
                >
                  {item.letter}
                </span>
              ) : (
                <span key={i} className="px-2 py-0.5 text-xs text-zinc-700">
                  ·
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
