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
import {
  CharacterDNA,
  loadCharacterDNA,
  saveCharacterDNA,
} from "@/lib/characterDNA";
import CharacterCreator from "./CharacterCreator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TR_VOWELS = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü"]);
function countSyllablesTR(line: string): number {
  return [...line.toLowerCase()].filter((c) => TR_VOWELS.has(c)).length;
}

const LS_LIKED = "rapflow_liked_lines";
interface LikedLine { line: string; score: number; date: string; style: string; }
function loadLiked(): LikedLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_LIKED) ?? "[]");
    // backward-compat: handle plain string arrays from older saves
    return raw.map((x: unknown) => typeof x === "string"
      ? { line: x, score: 0, date: new Date().toISOString(), style: "" }
      : x as LikedLine
    );
  } catch { return []; }
}
function saveLiked(lines: LikedLine[]): void {
  try { localStorage.setItem(LS_LIKED, JSON.stringify(lines.slice(0, 100))); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Quality score (0–10, computed client-side)
// ---------------------------------------------------------------------------
const CLICHES = [
  "sokaklar ağlıyor", "kalbim yandı", "hayat zor", "gözlerim yaşlı",
  "yolum uzun", "geceleri ağlıyorum", "gözlerim dolu", "içim yanarken",
  "kaderim bu", "yazgım bu",
];

function lineQuality(line: string, sylCount: number, targetSyl: number, allLines: string[]): number {
  // Syllable match: 0–4 pts
  const diff = Math.abs(sylCount - targetSyl);
  const sylScore = Math.max(0, 4 - diff * 0.7);

  // Rhyme quality: 0–3 pts (last 3 chars vs other lines)
  const suffix = line.trim().toLowerCase().slice(-3);
  const rhymeHits = allLines.filter((l) => l !== line && l.trim().toLowerCase().slice(-3) === suffix).length;
  const rhymeScore = Math.min(3, rhymeHits * 1.5);

  // Originality: 0–3 pts
  const hasCliche = CLICHES.some((c) => line.toLowerCase().includes(c));
  const hasConcreteImage = /\d|metre|yıl|sabah|akşam|sokak adı|[0-9]/.test(line) ||
    line.split(" ").length >= 5; // rough proxy for specificity
  const origScore = hasCliche ? 0.5 : hasConcreteImage ? 3 : 2;

  return Math.min(10, Math.round(sylScore + rhymeScore + origScore));
}

function qualityColor(score: number): string {
  if (score >= 8) return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (score >= 5) return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  return "text-zinc-400 border-zinc-600 bg-zinc-800";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TONE_META: Record<Tone, { emoji: string; label: string; color: string }> = {
  agresif:    { emoji: "🔥", label: "Agresif",    color: "bg-red-500/20 border-red-400 text-red-300"          },
  melankolik: { emoji: "🌙", label: "Melankolik", color: "bg-blue-500/20 border-blue-400 text-blue-300"       },
  motivasyon: { emoji: "💪", label: "Motivasyon", color: "bg-emerald-500/20 border-emerald-400 text-emerald-300" },
  sokak:      { emoji: "🏙️", label: "Sokak",      color: "bg-amber-500/20 border-amber-400 text-amber-300"    },
  edebi:      { emoji: "📖", label: "Edebi",      color: "bg-violet-500/20 border-violet-400 text-violet-300" },
};

const TONE_ARTISTS: Record<Tone, string[]> = {
  agresif:    ["Ceza", "Kendrick Lamar"],
  melankolik: ["Juice WRLD", "Drake"],
  sokak:      ["Baby Gang", "Ezhel"],
  motivasyon: ["Kanye West", "J. Cole"],
  edebi:      ["Gazapizm", "Kendrick Lamar"],
};

function closestArtist(profile: StyleProfile): string {
  const candidates = TONE_ARTISTS[profile.tone] ?? ["Kanye West"];
  return profile.avgSyllables > 10 ? candidates[1] ?? candidates[0] : candidates[0];
}

function sylColor(count: number, target: number): string {
  const r = count / target;
  if (r >= 0.85 && r <= 1.15) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (r >= 0.65 && r <= 1.35) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-red-500/20 text-red-300 border-red-500/40";
}

const SECTIONS = [
  { value: "kita",    label: "Yeni kıta"    },
  { value: "nakarat", label: "Nakarat"       },
  { value: "kopru",   label: "Köprü"         },
  { value: "devam",   label: "Satır devamı" },
] as const;
type SectionValue = (typeof SECTIONS)[number]["value"];

const FLOW_STYLES = [
  { id: "aynı",    label: "🎵 Orijinal"   },
  { id: "hızlı",   label: "⚡ Hızlı Flow" },
  { id: "yavaş",   label: "🐢 Yavaş"      },
  { id: "triplet", label: "🔺 Triplet"    },
  { id: "serbest", label: "🌊 Serbest"    },
] as const;
type FlowStyleId = (typeof FLOW_STYLES)[number]["id"];

const RAPPER_STYLES = ["Ezhel", "Ceza", "Baby Gang", "Gazapizm", "J. Cole", "Kendrick Lamar"] as const;

const RHYTHM_PATTERNS = [
  { value: "[3-2-3]", desc: "8 hece"  },
  { value: "[2-3-2]", desc: "7 hece"  },
  { value: "[4-4]",   desc: "8 hece"  },
  { value: "[3-3-2]", desc: "8 hece"  },
  { value: "[4-2-4]", desc: "10 hece" },
] as const;

function Skeleton({ className }: { className?: string }) {
  return <div className={["animate-pulse rounded-lg bg-zinc-700/50", className ?? ""].join(" ")} />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GhostWriter() {
  const { currentBPM, currentLyrics, targetSyllables, setPendingLines, setStyleProfile: setContextProfile } =
    useMusicContext();

  // Character DNA
  const [characterDNA, setCharacterDNA] = useState<CharacterDNA | null>(null);
  const [showCharCreator, setShowCharCreator] = useState(false);

  // Style profile
  const [profile, setProfile]           = useState<StyleProfile | null>(null);
  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash]     = useState(false);

  // Generator
  const [prompt, setPrompt]             = useState("");
  const [section, setSection]           = useState<SectionValue>("kita");
  const [selectedFlowStyle, setSelectedFlowStyle] = useState<FlowStyleId>("aynı");
  const [selectedRapper, setSelectedRapper]       = useState<string | null>(null);
  const [rhythmPattern, setRhythmPattern]         = useState<string>("[3-2-3]");
  const [generating, setGenerating]     = useState(false);
  const [continuing, setContinuing]     = useState(false);
  const [genError, setGenError]         = useState<string | null>(null);

  const [result, setResult] = useState<{
    lines: string[];
    syllableCounts: number[];
    rhymesWith: string;
    styleNotes: string;
    flowUsed?: string;
    narrativeNote?: string;
    qualityScores: number[];
  } | null>(null);

  const [lastGenParams, setLastGenParams] = useState<{
    prompt: string; section: SectionValue; flowStyle: FlowStyleId; rapper: string | null;
  } | null>(null);
  const [addedFlash, setAddedFlash]   = useState(false);
  const [likedLines, setLikedLines]   = useState<LikedLine[]>([]);

  useEffect(() => {
    setProfile(loadStyleProfile());
    setLikedLines(loadLiked());
    setCharacterDNA(loadCharacterDNA());
  }, []);

  const lyricLines = currentLyrics.trim().split("\n").filter(Boolean);
  const canWrite   = profile !== null || lyricLines.length >= 3;
  const targetSyl  = targetSyllables * 4; // bars × beats

  // ── Analyze
  const analyze = useCallback(async () => {
    if (!currentLyrics.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res  = await fetch("/api/ghostwriter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "analyze", lyrics: currentLyrics, bpm: currentBPM, characterDNA: characterDNA ?? undefined }),
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
  }, [currentLyrics, currentBPM, lyricLines.length, setContextProfile]);

  // ── Generate
  const generate = useCallback(async (
    overridePrompt?: string,
    overrideSection?: SectionValue,
    overrideFlow?: FlowStyleId,
    overrideRapper?: string | null,
  ) => {
    const p  = overridePrompt  ?? prompt;
    const s  = overrideSection ?? section;
    const fl = overrideFlow    ?? selectedFlowStyle;
    const rp = overrideRapper  !== undefined ? overrideRapper : selectedRapper;
    if (!p.trim()) return;

    const sectionHint = s === "nakarat" ? `Nakarat (hook) yaz: ${p}`
      : s === "kopru"  ? `Köprü (bridge) yaz: ${p}`
      : s === "devam"  ? `Satır devamını yaz: ${p}`
      : p;

    setGenerating(true);
    setGenError(null);
    setResult(null);
    setLastGenParams({ prompt: p, section: s, flowStyle: fl, rapper: rp });

    try {
      const res  = await fetch("/api/ghostwriter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:          "generate",
          userStyle:     profile ?? buildFallbackProfile(),
          prompt:        sectionHint,
          bpm:           currentBPM,
          rhymeScheme:   profile?.rhymePattern ?? "AABB",
          flowStyle:     fl !== "aynı" ? fl : undefined,
          rapperStyle:   rp ?? undefined,
          rhythmPattern: rhythmPattern !== "[3-2-3]" ? rhythmPattern : undefined,
          characterDNA:  characterDNA ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const lines: string[]          = data.lines ?? [];
      const syllableCounts: number[] = data.syllableCounts?.length === lines.length
        ? data.syllableCounts
        : lines.map(countSyllablesTR);

      const qualityScores = lines.map((l, i) =>
        lineQuality(l, syllableCounts[i] ?? countSyllablesTR(l), targetSyl, lines)
      );

      setResult({ ...data, lines, syllableCounts, qualityScores });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setGenerating(false);
    }
  }, [prompt, section, selectedFlowStyle, selectedRapper, rhythmPattern, profile, currentBPM, targetSyl]);

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
          mode:        "continue",
          lyrics:      currentLyrics,
          userStyle:   profile ?? buildFallbackProfile(),
          bpm:         currentBPM,
          characterDNA: characterDNA ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const lines: string[] = data.lines ?? [];
      const syllableCounts  = lines.map(countSyllablesTR);
      const qualityScores   = lines.map((l, i) =>
        lineQuality(l, syllableCounts[i], targetSyl, lines)
      );

      setResult({
        lines,
        syllableCounts,
        rhymesWith: "",
        styleNotes: `Bölüm: ${data.section ?? "verse"}`,
        narrativeNote: data.narrativeNote,
        qualityScores,
      });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setContinuing(false);
    }
  }, [currentLyrics, profile, currentBPM, targetSyl]);

  // ── Add to editor
  const addToEditor = useCallback(() => {
    if (!result) return;
    setPendingLines(result.lines);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2000);
  }, [result, setPendingLines]);

  // ── Like line
  const toggleLike = useCallback((line: string, score: number) => {
    setLikedLines((prev) => {
      const exists = prev.some((l) => l.line === line);
      const next = exists
        ? prev.filter((l) => l.line !== line)
        : [{ line, score, date: new Date().toISOString(), style: profile?.tone ?? "" }, ...prev];
      saveLiked(next);
      return next;
    });
  }, [profile]);

  // ── Analyze liked lines
  const analyzeFromLiked = useCallback(async () => {
    if (likedLines.length < 3) return;
    const lyrics = likedLines.map((l) => l.line).join("\n");
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res  = await fetch("/api/ghostwriter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "analyze", lyrics, bpm: currentBPM, characterDNA: characterDNA ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const full: StyleProfile = { ...data, analyzedAt: new Date().toISOString(), lyricsCount: likedLines.length };
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
  }, [likedLines, currentBPM, setContextProfile]);

  // Highest quality line index
  const bestIdx = result
    ? result.qualityScores.indexOf(Math.max(...result.qualityScores))
    : -1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const TONE_LABELS: Record<string, string> = {
    agresif: "🔥 Agresif", melankolik: "🌙 Melankolik", mağrur: "👑 Mağrur",
    umursamaz: "😶 Umursamaz", öfkeli: "⚡ Öfkeli", yorgun: "😮‍💨 Yorgun", umutlu: "🌅 Umutlu",
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">

      {/* ── 0. Character DNA ──────────────────────────────────────────────── */}
      {showCharCreator && (
        <CharacterCreator
          existing={characterDNA}
          onSave={(dna) => {
            saveCharacterDNA(dna);
            setCharacterDNA(dna);
            setShowCharCreator(false);
          }}
          onClose={() => setShowCharCreator(false)}
        />
      )}

      <div className="flex flex-col gap-3 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Karakter DNA</p>
            <h3 className="text-sm font-bold text-white">🎭 Kim Olduğunu Belirle</h3>
          </div>
          {characterDNA && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCharCreator(true)}
                className="text-[10px] text-zinc-500 hover:text-violet-400 transition-colors font-mono"
              >Düzenle</button>
              <button
                onClick={() => { setCharacterDNA(null); if (typeof window !== "undefined") localStorage.removeItem("rapflow_character_dna"); }}
                className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors font-mono"
              >Sıfırla</button>
            </div>
          )}
        </div>

        {characterDNA ? (
          <div className="flex flex-col gap-3">
            {/* Active banner */}
            <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3">
              <span className="text-2xl">🎭</span>
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{characterDNA.name}</p>
                <p className="text-[10px] text-violet-300">{characterDNA.age} yaş · {characterDNA.origin}</p>
              </div>
              <span className="ml-auto text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Aktif</span>
            </div>
            <p className="text-xs text-zinc-500 italic leading-relaxed line-clamp-2">{characterDNA.backstory}</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-violet-500/15 border-violet-500/30 text-violet-300">
                {TONE_LABELS[characterDNA.tone] ?? characterDNA.tone}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full border bg-zinc-800 border-zinc-700 text-zinc-400">
                {characterDNA.lyricalStyle}
              </span>
              {characterDNA.struggles.slice(0, 4).map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500">{s}</span>
              ))}
            </div>
            {characterDNA.signatureWords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {characterDNA.signatureWords.slice(0, 5).map(w => (
                  <span key={w} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">{w}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Karakterini oluştur — kim olduğunu, ne yaşadığını ve nasıl konuştuğunu tanımla. Ghost Writer bu karakterin sesiyle yazar.
            </p>
            <button
              onClick={() => setShowCharCreator(true)}
              className="w-full py-3 rounded-xl bg-violet-600 border border-violet-500 text-white text-sm font-semibold hover:bg-violet-500 transition-colors"
            >
              🎭 Karakterini Oluştur
            </button>
          </div>
        )}
      </div>

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
            <p className="text-xs text-zinc-400 leading-relaxed">{getStyleSummary(profile)}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <span className={["px-2.5 py-1 rounded-full text-xs font-semibold border", TONE_META[profile.tone]?.color ?? "bg-zinc-700 text-zinc-300 border-zinc-600"].join(" ")}>
                {TONE_META[profile.tone]?.emoji} {TONE_META[profile.tone]?.label}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">
                ⌀ {Math.round(profile.avgSyllables)} hece/satır
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">
                {profile.rhymePattern}
              </span>
              {profile.sentenceLength && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">
                  {profile.sentenceLength} cümle
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.themes.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-500">{t}</span>
              ))}
            </div>
            <ul className="flex flex-col gap-0.5">
              {profile.uniqueTraits.slice(0, 3).map((trait) => (
                <li key={trait} className="text-[11px] text-zinc-500 flex gap-1.5">
                  <span className="text-violet-500">›</span>{trait}
                </li>
              ))}
            </ul>
            {profile.metaphorTypes?.length ? (
              <div className="flex flex-wrap gap-1">
                {profile.metaphorTypes.slice(0, 3).map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400">{m}</span>
                ))}
              </div>
            ) : null}
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

        {savedFlash && <p className="text-xs text-emerald-400 font-semibold">✓ Stilin kaydedildi</p>}
        {analyzeError && <p className="text-xs text-red-400">{analyzeError}</p>}

        <button
          onClick={analyze}
          disabled={analyzing || !currentLyrics.trim()}
          className={["w-full py-2.5 rounded-xl text-sm font-semibold transition-colors border",
            analyzing || !currentLyrics.trim()
              ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
              : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500",
          ].join(" ")}
        >
          {analyzing ? "Analiz ediliyor…" : profile ? "🔄 Tekrar Analiz Et" : "🔍 Stilimi Analiz Et"}
        </button>
      </div>

      {/* ── 2. Ghost Writer ───────────────────────────────────────────────── */}
      <div className={["flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border transition-opacity",
        canWrite ? "border-zinc-700 opacity-100" : "border-zinc-800 opacity-50 pointer-events-none",
      ].join(" ")}>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Ghost Writer</p>
          <h3 className="text-sm font-bold text-white">Senin Adına Yaz</h3>
          {!canWrite && <p className="text-[10px] text-zinc-600 mt-0.5">Etkinleştirmek için stilini analiz et veya 3+ satır yaz</p>}
        </div>

        {/* Prompt */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ne hakkında yazmak istiyorsun? örn: sokakta büyümek, kayıp, başarı..."
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none focus:border-violet-500 transition-colors"
        />

        {/* Section + Rhythm pattern row */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Bölüm</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as SectionValue)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500 transition-colors"
            >
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Ritim Kalıbı</label>
            <select
              value={rhythmPattern}
              onChange={(e) => setRhythmPattern(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-violet-500 transition-colors"
            >
              {RHYTHM_PATTERNS.map((r) => (
                <option key={r.value} value={r.value}>{r.value} · {r.desc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rapper style pills */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Rapper Akışı</label>
          <div className="flex flex-wrap gap-1.5">
            {RAPPER_STYLES.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRapper((prev) => prev === r ? null : r)}
                className={["px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                  selectedRapper === r
                    ? "bg-violet-600 border-violet-500 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white",
                ].join(" ")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => generate()}
            disabled={generating || !prompt.trim()}
            className={["flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
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
            className={["flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
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

            {/* Lines */}
            <div className="flex flex-col gap-2">
              {result.lines.map((line, i) => {
                const syl    = result.syllableCounts[i] ?? countSyllablesTR(line);
                const score  = result.qualityScores[i] ?? 0;
                const isBest = i === bestIdx;
                const isLiked = likedLines.some((l) => l.line === line);
                return (
                  <div
                    key={i}
                    className={["flex items-start gap-2 border rounded-xl px-3 py-2.5 transition-all",
                      isBest
                        ? "bg-violet-950/30 border-violet-500/40 ring-1 ring-violet-500/30"
                        : "bg-zinc-800/60 border-zinc-700/60",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 font-mono leading-snug break-words">{line}</p>
                      {isBest && (
                        <span className="text-[9px] text-violet-400 font-semibold uppercase tracking-widest mt-0.5 block">
                          ✦ en güçlü satır
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={["text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono", qualityColor(score)].join(" ")}>
                        {score}/10
                      </span>
                      <span className={["text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono", sylColor(syl, targetSyl)].join(" ")}>
                        {syl}h
                      </span>
                      {/* Per-line add button */}
                      <button
                        onClick={() => setPendingLines([line])}
                        className="text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors font-mono"
                        title="Bu satırı editöre ekle"
                      >
                        ➕
                      </button>
                      {/* Like button */}
                      <button
                        onClick={() => toggleLike(line, score)}
                        className={["text-sm transition-colors", isLiked ? "text-red-400" : "text-zinc-600 hover:text-red-400"].join(" ")}
                        title={isLiked ? "Beğenildi" : "Bu satırı beğen"}
                      >
                        {isLiked ? "❤️" : "🤍"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Narrative note — continue mode */}
            {result.narrativeNote && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-blue-400 uppercase tracking-widest mb-0.5">Hikaye akışı</p>
                <p className="text-xs text-blue-300 italic leading-relaxed">{result.narrativeNote}</p>
              </div>
            )}
            {result.styleNotes && !result.narrativeNote && (
              <p className="text-[11px] text-zinc-500 italic px-1">{result.styleNotes}</p>
            )}
            {result.rhymesWith && (
              <p className="text-[11px] text-violet-400 px-1">↩ "{result.rhymesWith}" ile kafiyeli</p>
            )}
            {result.flowUsed && (
              <p className="text-[11px] text-zinc-500 px-1 font-mono">flow: {result.flowUsed}</p>
            )}

            {/* Flow değiştir? */}
            <div className="flex flex-col gap-2 pt-1 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Flow değiştir?</p>
              <div className="flex flex-wrap gap-1.5">
                {FLOW_STYLES.map((fs) => (
                  <button
                    key={fs.id}
                    onClick={() => {
                      setSelectedFlowStyle(fs.id);
                      if (lastGenParams) generate(lastGenParams.prompt, lastGenParams.section, fs.id, lastGenParams.rapper);
                    }}
                    className={["px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                      selectedFlowStyle === fs.id
                        ? "bg-violet-600 border-violet-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white",
                    ].join(" ")}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={addToEditor}
                className={["flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
                  addedFlash
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : "bg-zinc-800 border-zinc-600 text-zinc-200 hover:border-emerald-500 hover:text-white",
                ].join(" ")}
              >
                {addedFlash ? "✓ Eklendi" : "➕ Tümünü Ekle"}
              </button>
              {lastGenParams && (
                <button
                  onClick={() => generate(lastGenParams.prompt, lastGenParams.section, lastGenParams.flowStyle, lastGenParams.rapper)}
                  disabled={generating}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white transition-colors"
                >
                  🔄 Tekrar Üret
                </button>
              )}
            </div>
          </div>
        )}

        {genError && <p className="text-xs text-red-400 px-1">{genError}</p>}
      </div>

      {/* ── 3. Liked Lines ────────────────────────────────────────────────── */}
      {likedLines.length > 0 && (
        <div className="flex flex-col gap-3 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Beğenilen Satırlar ❤️</p>
            <button
              onClick={() => { setLikedLines([]); saveLiked([]); }}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
            >
              Temizle
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {likedLines.slice(0, 8).map((item) => (
              <div key={item.line} className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2">
                <p className="flex-1 text-xs text-zinc-300 font-mono leading-snug">{item.line}</p>
                <span className={["text-[9px] font-mono px-1 py-0.5 rounded border flex-shrink-0", qualityColor(item.score)].join(" ")}>
                  {item.score}/10
                </span>
                <button onClick={() => toggleLike(item.line, item.score)} className="text-red-400 text-xs flex-shrink-0">❤️</button>
              </div>
            ))}
          </div>
          {likedLines.length >= 3 && (
            <button
              onClick={analyzeFromLiked}
              disabled={analyzing}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white transition-colors disabled:opacity-40"
            >
              {analyzing ? "Analiz ediliyor…" : "🧠 Beğenilen sözlerden stil öğren"}
            </button>
          )}
        </div>
      )}

      {/* ── 4. Style Insights ─────────────────────────────────────────────── */}
      {profile && (
        <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Stil İçgörüleri</p>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-400">Favori Kelimeler</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.favoriteWords.slice(0, 5).map((w) => (
                <span key={w} className="px-2.5 py-1 rounded-full text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300">{w}</span>
              ))}
            </div>
          </div>

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

          <div className="flex items-center gap-3 bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="text-xl">🎤</span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">Stilin en çok benziyor</p>
              <p className="text-sm font-bold text-white">{closestArtist(profile)}</p>
            </div>
          </div>

          <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Flow Tarzın</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{profile.flowStyle}</p>
          </div>

          {profile.commonStructures?.length ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Cümle Yapıları</span>
              <div className="flex flex-col gap-0.5">
                {profile.commonStructures.slice(0, 3).map((s) => (
                  <span key={s} className="text-[11px] text-zinc-500 flex gap-1.5">
                    <span className="text-zinc-600">›</span>{s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback profile
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
