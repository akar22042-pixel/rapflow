"use client";

import { useState, useEffect, useCallback } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import {
  StyleProfile,
  Tone,
  saveStyleProfile,
  loadStyleProfile,
  clearStyleProfile,
  getStyleSummary,
} from "@/lib/styleProfile";

// ---------------------------------------------------------------------------
// Turkish syllable count helper
// ---------------------------------------------------------------------------
const TR_VOWELS = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü"]);
function countSyllablesTR(line: string): number {
  return [...line.toLowerCase()].filter((c) => TR_VOWELS.has(c)).length;
}

// ---------------------------------------------------------------------------
// Tone meta
// ---------------------------------------------------------------------------
const TONE_META: Record<Tone, { emoji: string; label: string; color: string }> = {
  agresif:    { emoji: "🔥", label: "Agresif",    color: "bg-red-500/20 border-red-400 text-red-300"          },
  melankolik: { emoji: "🌙", label: "Melankolik", color: "bg-blue-500/20 border-blue-400 text-blue-300"       },
  motivasyon: { emoji: "💪", label: "Motivasyon", color: "bg-emerald-500/20 border-emerald-400 text-emerald-300" },
  sokak:      { emoji: "🏙️", label: "Sokak",      color: "bg-amber-500/20 border-amber-400 text-amber-300"    },
  edebi:      { emoji: "📖", label: "Edebi",      color: "bg-violet-500/20 border-violet-400 text-violet-300" },
};

// ---------------------------------------------------------------------------
// Closest artist by tone / rhyme pattern
// ---------------------------------------------------------------------------
const TONE_ARTISTS: Record<Tone, string[]> = {
  agresif:    ["Ceza", "Kendrick Lamar"],
  melankolik: ["Juice WRLD", "Drake"],
  sokak:      ["Baby Gang", "Ezhel"],
  motivasyon: ["Kanye West", "J. Cole"],
  edebi:      ["Gazapizm", "Kendrick Lamar"],
};

function closestArtist(profile: StyleProfile): string {
  const candidates = TONE_ARTISTS[profile.tone] ?? ["Kanye West"];
  // Pick second candidate for high syllable counts (more technical flows)
  return profile.avgSyllables > 10 ? candidates[1] ?? candidates[0] : candidates[0];
}

// ---------------------------------------------------------------------------
// Syllable badge color vs target
// ---------------------------------------------------------------------------
function sylColor(count: number, target: number): string {
  const r = count / target;
  if (r >= 0.85 && r <= 1.15) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (r >= 0.65 && r <= 1.35) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-red-500/20 text-red-300 border-red-500/40";
}

// ---------------------------------------------------------------------------
// Section options for dropdown
// ---------------------------------------------------------------------------
const SECTIONS = [
  { value: "kita",   label: "Yeni kıta"     },
  { value: "nakarat",label: "Nakarat"        },
  { value: "kopru",  label: "Köprü"         },
  { value: "devam",  label: "Satır devamı"  },
] as const;
type SectionValue = (typeof SECTIONS)[number]["value"];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skeleton({ className }: { className?: string }) {
  return <div className={["animate-pulse rounded-lg bg-zinc-700/50", className ?? ""].join(" ")} />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GhostWriter() {
  const { currentBPM, currentLyrics, targetSyllables, setPendingLines, setStyleProfile: setContextProfile } = useMusicContext();

  // Style profile state
  const [profile, setProfile]           = useState<StyleProfile | null>(null);
  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash]     = useState(false);

  // Generator state
  const [prompt, setPrompt]             = useState("");
  const [section, setSection]           = useState<SectionValue>("kita");
  const [generating, setGenerating]     = useState(false);
  const [continuing, setContinuing]     = useState(false);
  const [genError, setGenError]         = useState<string | null>(null);
  const [result, setResult]             = useState<{
    lines: string[];
    syllableCounts: number[];
    rhymesWith: string;
    styleNotes: string;
  } | null>(null);
  const [lastPrompt, setLastPrompt]     = useState<{ prompt: string; section: SectionValue } | null>(null);
  const [addedFlash, setAddedFlash]     = useState(false);

  // Load profile on mount
  useEffect(() => {
    setProfile(loadStyleProfile());
  }, []);

  // Derived
  const lyricLines = currentLyrics.trim().split("\n").filter(Boolean);
  const canWrite   = profile !== null || lyricLines.length >= 3;

  // ── Analyze
  const analyze = useCallback(async () => {
    if (!currentLyrics.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res  = await fetch("/api/ghostwriter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "analyze", lyrics: currentLyrics, bpm: currentBPM }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const full: StyleProfile = {
        ...data,
        analyzedAt:  new Date().toISOString(),
        lyricsCount: lyricLines.length,
      };
      saveStyleProfile(full);
      setProfile(full);
      setContextProfile(full);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setAnalyzing(false);
    }
  }, [currentLyrics, currentBPM, lyricLines.length]);

  // ── Generate
  const generate = useCallback(async (overridePrompt?: string, overrideSection?: SectionValue) => {
    const p = overridePrompt ?? prompt;
    const s = overrideSection ?? section;
    if (!p.trim()) return;

    const sectionHint = s === "nakarat"
      ? `Nakarat (hook) yaz: ${p}`
      : s === "kopru"
      ? `Köprü (bridge) yaz: ${p}`
      : s === "devam"
      ? `Satır devamını yaz: ${p}`
      : p;

    setGenerating(true);
    setGenError(null);
    setResult(null);
    setLastPrompt({ prompt: p, section: s });

    try {
      const res  = await fetch("/api/ghostwriter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:        "generate",
          userStyle:   profile ?? buildFallbackProfile(),
          prompt:      sectionHint,
          bpm:         currentBPM,
          rhymeScheme: profile?.rhymePattern ?? "AABB",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      // Recompute syllable counts client-side as a fallback if API didn't return them
      const lines: string[]          = data.lines ?? [];
      const syllableCounts: number[] = data.syllableCounts?.length === lines.length
        ? data.syllableCounts
        : lines.map(countSyllablesTR);

      setResult({ ...data, lines, syllableCounts });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setGenerating(false);
    }
  }, [prompt, section, profile, currentBPM]);

  // ── Continue
  const continueWriting = useCallback(async () => {
    if (!currentLyrics.trim()) return;
    setContinuing(true);
    setGenError(null);
    setResult(null);

    try {
      const res  = await fetch("/api/ghostwriter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:      "continue",
          lyrics:    currentLyrics,
          userStyle: profile ?? buildFallbackProfile(),
          bpm:       currentBPM,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const lines: string[] = data.lines ?? [];
      setResult({
        lines,
        syllableCounts: lines.map(countSyllablesTR),
        rhymesWith: "",
        styleNotes: `Bölüm: ${data.section ?? "verse"}`,
      });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setContinuing(false);
    }
  }, [currentLyrics, profile, currentBPM]);

  // ── Add to editor
  const addToEditor = useCallback(() => {
    if (!result) return;
    setPendingLines(result.lines);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2000);
  }, [result, setPendingLines]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">

      {/* ── 1. Style Analysis ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Stil Analizi</p>
            <h3 className="text-sm font-bold text-white">Senin Tarzın</h3>
          </div>
          {profile && (
            <button
              onClick={() => { clearStyleProfile(); setProfile(null); setContextProfile(null); }}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors font-mono"
            >
              Stili Sıfırla
            </button>
          )}
        </div>

        {/* Profile display */}
        {analyzing ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <p className="text-xs text-zinc-500 animate-pulse">Stilin öğreniliyor...</p>
          </div>
        ) : profile ? (
          <div className="flex flex-col gap-3">
            {/* Summary */}
            <p className="text-xs text-zinc-400 leading-relaxed">{getStyleSummary(profile)}</p>

            {/* Tone badge */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className={[
                "px-2.5 py-1 rounded-full text-xs font-semibold border",
                TONE_META[profile.tone]?.color ?? "bg-zinc-700 text-zinc-300 border-zinc-600",
              ].join(" ")}>
                {TONE_META[profile.tone]?.emoji} {TONE_META[profile.tone]?.label}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">
                ⌀ {Math.round(profile.avgSyllables)} hece/satır
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">
                {profile.rhymePattern}
              </span>
            </div>

            {/* Themes */}
            <div className="flex flex-wrap gap-1">
              {profile.themes.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-500">
                  {t}
                </span>
              ))}
            </div>

            {/* Unique traits */}
            <ul className="flex flex-col gap-0.5">
              {profile.uniqueTraits.slice(0, 3).map((trait) => (
                <li key={trait} className="text-[11px] text-zinc-500 flex gap-1.5">
                  <span className="text-violet-500">›</span>{trait}
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-zinc-700 font-mono">
              {profile.lyricsCount} satır analiz edildi • {new Date(profile.analyzedAt).toLocaleDateString("tr-TR")}
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            {lyricLines.length === 0
              ? "Önce Söz Editörü'ne birkaç satır yaz, sonra stilini analiz et."
              : `${lyricLines.length} satır hazır — analiz edebilirsin.`}
          </p>
        )}

        {/* Saved flash */}
        {savedFlash && (
          <p className="text-xs text-emerald-400 font-semibold">✓ Stilin kaydedildi</p>
        )}
        {analyzeError && (
          <p className="text-xs text-red-400">{analyzeError}</p>
        )}

        <button
          onClick={analyze}
          disabled={analyzing || !currentLyrics.trim()}
          className={[
            "w-full py-2.5 rounded-xl text-sm font-semibold transition-colors border",
            analyzing || !currentLyrics.trim()
              ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
              : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500",
          ].join(" ")}
        >
          {analyzing ? "Analiz ediliyor…" : profile ? "🔄 Tekrar Analiz Et" : "🔍 Stilimi Analiz Et"}
        </button>
      </div>

      {/* ── 2. Ghost Writer ───────────────────────────────────────────────── */}
      <div className={[
        "flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border transition-opacity",
        canWrite ? "border-zinc-700 opacity-100" : "border-zinc-800 opacity-50 pointer-events-none",
      ].join(" ")}>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Ghost Writer</p>
          <h3 className="text-sm font-bold text-white">Senin Adına Yaz</h3>
          {!canWrite && (
            <p className="text-[10px] text-zinc-600 mt-0.5">Etkinleştirmek için stilini analiz et veya 3+ satır yaz</p>
          )}
        </div>

        {/* Prompt input */}
        <div className="flex flex-col gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ne hakkında yazmak istiyorsun? örn: sokakta büyümek, kayıp, başarı..."
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none focus:border-violet-500 transition-colors"
          />

          {/* Section dropdown */}
          <div className="flex gap-2 items-center">
            <label className="text-xs text-zinc-500 flex-shrink-0">Nereye ekleyelim?</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as SectionValue)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500 transition-colors"
            >
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => generate()}
            disabled={generating || !prompt.trim()}
            className={[
              "flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
              generating || !prompt.trim()
                ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500",
            ].join(" ")}
          >
            {generating ? "Yazıyor…" : "✍️ Yaz"}
          </button>

          <button
            onClick={continueWriting}
            disabled={continuing || !currentLyrics.trim()}
            className={[
              "flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
              continuing || !currentLyrics.trim()
                ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
                : "bg-zinc-800 border-zinc-600 text-zinc-200 hover:border-violet-500 hover:text-white",
            ].join(" ")}
          >
            {continuing ? "Devam yazıyor…" : "📝 Devam Et"}
          </button>
        </div>

        {/* Loading skeleton */}
        {(generating || continuing) && (
          <div className="flex flex-col gap-2 pt-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
            <Skeleton className="h-8 w-4/5" />
          </div>
        )}

        {/* Results */}
        {result && !generating && !continuing && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {result.lines.map((line, i) => {
                const syl = result.syllableCounts[i] ?? countSyllablesTR(line);
                return (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5">
                    <p className="flex-1 text-sm text-zinc-100 font-mono leading-snug">{line}</p>
                    <span className={[
                      "flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono",
                      sylColor(syl, targetSyllables * 4),
                    ].join(" ")}>
                      {syl}h
                    </span>
                  </div>
                );
              })}
            </div>

            {result.styleNotes && (
              <p className="text-[11px] text-zinc-500 italic px-1">{result.styleNotes}</p>
            )}

            {result.rhymesWith && (
              <p className="text-[11px] text-violet-400 px-1">↩ "{result.rhymesWith}" ile kafiyeli</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={addToEditor}
                className={[
                  "flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
                  addedFlash
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : "bg-zinc-800 border-zinc-600 text-zinc-200 hover:border-emerald-500 hover:text-white",
                ].join(" ")}
              >
                {addedFlash ? "✓ Eklendi" : "➕ Editöre Ekle"}
              </button>

              {lastPrompt && (
                <button
                  onClick={() => generate(lastPrompt.prompt, lastPrompt.section)}
                  disabled={generating}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white transition-colors"
                >
                  🔄 Tekrar Üret
                </button>
              )}
            </div>
          </div>
        )}

        {genError && (
          <p className="text-xs text-red-400 px-1">{genError}</p>
        )}
      </div>

      {/* ── 3. Style Insights ─────────────────────────────────────────────── */}
      {profile && (
        <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Stil İçgörüleri</p>

          {/* Favorite words */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-400">Favori Kelimeler</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.favoriteWords.slice(0, 5).map((w) => (
                <span key={w} className="px-2.5 py-1 rounded-full text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300">
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-0.5 bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3">
              <span className="text-lg">{TONE_META[profile.tone]?.emoji}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{TONE_META[profile.tone]?.label}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3">
              <span className="text-sm font-bold text-violet-300 font-mono">{profile.rhymePattern}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Kafiye</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3">
              <span className="text-sm font-bold text-violet-300 font-mono">{Math.round(profile.avgSyllables)}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Hece/satır</span>
            </div>
          </div>

          {/* Artist match */}
          <div className="flex items-center gap-3 bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-xl">🎤</span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">Stilin en çok benziyor</p>
              <p className="text-sm font-bold text-white">{closestArtist(profile)}</p>
            </div>
          </div>

          {/* Flow style description */}
          <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Flow Tarzın</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{profile.flowStyle}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback profile when no analysis exists yet (uses context lyrics heuristics)
// ---------------------------------------------------------------------------
function buildFallbackProfile(): StyleProfile {
  return {
    vocabulary:   ["sokak", "yol", "gece", "şehir", "kalp"],
    themes:       ["hayat", "mücadele"],
    rhymePattern: "AABB",
    avgSyllables: 9,
    favoriteWords:["yok", "var", "gel", "git", "bak"],
    tone:         "sokak",
    flowStyle:    "Düzenli 8'lik grid, orta tempo, güçlü kafiye vurgusu",
    uniqueTraits: ["Kısa keskin satırlar", "Güçlü kafiye vurgusu"],
    analyzedAt:   new Date().toISOString(),
    lyricsCount:  0,
  };
}
