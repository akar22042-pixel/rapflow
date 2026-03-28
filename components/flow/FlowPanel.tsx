"use client";

import { useState, useCallback, useRef } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import { FLOW_PATTERNS } from "@/lib/flowPatterns";
import FlowPlayer from "./FlowPlayer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FlowBeat {
  beat: number;
  syllables: number;
  stress: "downbeat" | "upbeat" | "triplet" | "sixteenth" | "rest";
  exampleLine: string;
}

interface FlowPatternResponse {
  pattern: FlowBeat[];
  description: string;
  tipsTurkish: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RAPPERS = [
  "Baby Gangsta",
  "Kanye West",
  "Drake",
  "Kendrick Lamar",
  "Ezhel",
  "Ceza",
  "J. Cole",
  "Travis Scott",
  "Juice WRLD",
  "Uzi",
] as const;

const STRESS_COLORS: Record<FlowBeat["stress"], string> = {
  downbeat:  "bg-violet-500 border-violet-400",
  upbeat:    "bg-blue-500   border-blue-400",
  triplet:   "bg-amber-500  border-amber-400",
  sixteenth: "bg-emerald-500 border-emerald-400",
  rest:      "bg-zinc-700   border-zinc-600",
};

const STRESS_LABEL: Record<FlowBeat["stress"], string> = {
  downbeat:  "D",
  upbeat:    "U",
  triplet:   "T",
  sixteenth: "16",
  rest:      "—",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-lg bg-zinc-700/60",
        className ?? "",
      ].join(" ")}
    />
  );
}

function BeatGridSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 flex-1" />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BeatBlock — single beat column
// ---------------------------------------------------------------------------
function BeatBlock({
  beat,
  onSpeak,
  isSpeaking,
  bpm,
}: {
  beat: FlowBeat;
  onSpeak: (line: string, bpm: number) => void;
  isSpeaking: boolean;
  bpm: number;
}) {
  const colorClass = STRESS_COLORS[beat.stress];
  const syllableBoxes = Math.max(1, beat.syllables);

  return (
    <div
      className={[
        "flex flex-col items-center gap-1.5 flex-1 min-w-0 rounded-xl p-1.5 border-2 transition-all duration-150",
        isSpeaking
          ? "border-violet-400 bg-violet-500/10 shadow-[0_0_14px_3px_rgba(167,139,250,0.35)]"
          : "border-transparent",
      ].join(" ")}
    >
      {/* Beat number + pulsing dot when speaking */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-zinc-500">{beat.beat}</span>
        {isSpeaking && (
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        )}
      </div>

      {/* Syllable blocks stacked */}
      <div className="flex flex-col-reverse gap-0.5 w-full">
        {Array.from({ length: syllableBoxes }, (_, i) => (
          <div
            key={i}
            className={[
              "w-full rounded border text-center text-xs font-bold leading-5 h-5 transition-opacity",
              colorClass,
              i === syllableBoxes - 1 ? "opacity-100" : "opacity-60",
            ].join(" ")}
          >
            {i === syllableBoxes - 1 ? STRESS_LABEL[beat.stress] : ""}
          </div>
        ))}
        {beat.stress === "rest" && (
          <div className={["w-full rounded border h-5 flex items-center justify-center text-xs text-zinc-500", colorClass].join(" ")}>
            rest
          </div>
        )}
      </div>

      {/* Syllable count badge */}
      <span className="text-xs font-mono text-zinc-400">
        {beat.syllables} syl
      </span>

      {/* Example line text */}
      <p
        className="w-full text-center leading-tight truncate px-0.5 text-zinc-500 text-[10px]"
        title={beat.exampleLine}
      >
        {beat.exampleLine}
      </p>

      {/* Speak button */}
      <button
        onClick={() => onSpeak(beat.exampleLine, bpm)}
        title={beat.exampleLine}
        className={[
          "w-full truncate text-xs rounded px-1 py-0.5 transition-colors border",
          isSpeaking
            ? "bg-violet-600 border-violet-500 text-white"
            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-600 hover:text-white",
        ].join(" ")}
      >
        {isSpeaking ? "▶ …" : "🔊"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pattern Library sub-component
// ---------------------------------------------------------------------------
function PatternLibrary({ bpm }: { bpm: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = FLOW_PATTERNS.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-400 uppercase tracking-widest">
        Pattern Kütüphanesi
      </p>

      {/* Picker pills */}
      <div className="flex flex-wrap gap-1.5">
        {FLOW_PATTERNS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId((cur) => (cur === p.id ? null : p.id))}
            className={[
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors border",
              selectedId === p.id
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
            ].join(" ")}
          >
            {p.artist}
          </button>
        ))}
      </div>

      {/* Player */}
      {selected && (
        <FlowPlayer pattern={selected} bpm={bpm} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function FlowPanel() {
  const { currentBPM, currentStyle, setCurrentStyle } = useMusicContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FlowPatternResponse | null>(null);
  const [speakingBeat, setSpeakingBeat] = useState<number | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const syncTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ------------------------------------------------------------------
  // Generate flow pattern
  // ------------------------------------------------------------------
  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "",
          bpm: currentBPM,
          style: currentStyle,
          mode: "flow_pattern",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data as FlowPatternResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [currentBPM, currentStyle]);

  // ------------------------------------------------------------------
  // Web Speech API — speak example line paced to BPM
  // ------------------------------------------------------------------
  const speak = useCallback(
    (line: string, bpm: number) => {
      if (!("speechSynthesis" in window)) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      if (utteranceRef.current) {
        setSpeakingBeat(null);
      }

      const beatIndex = result?.pattern.findIndex((b) => b.exampleLine === line) ?? -1;
      setSpeakingBeat(beatIndex);

      const utterance = new SpeechSynthesisUtterance(line);
      // Map BPM to speech rate: 80 bpm ≈ 0.8, 120 bpm ≈ 1.0, 160 bpm ≈ 1.3
      utterance.rate = Math.max(0.6, Math.min(1.8, bpm / 120));
      utterance.pitch = 1;
      utterance.lang = "tr-TR";

      utterance.onend = () => setSpeakingBeat(null);
      utterance.onerror = () => setSpeakingBeat(null);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [result]
  );

  const speakAll = useCallback(() => {
    if (!result || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const lines = result.pattern
      .filter((b) => b.stress !== "rest")
      .map((b) => b.exampleLine)
      .join(" / ");

    const utterance = new SpeechSynthesisUtterance(lines);
    utterance.rate = Math.max(0.6, Math.min(1.8, currentBPM / 120));
    utterance.lang = "tr-TR";
    utterance.onend = () => setSpeakingBeat(null);
    window.speechSynthesis.speak(utterance);
  }, [result, currentBPM]);

  // ------------------------------------------------------------------
  // Senkronize Dinlet — schedule each beat at BPM-timed offsets
  // ------------------------------------------------------------------
  const speakSync = useCallback(() => {
    if (!result || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    syncTimeoutsRef.current.forEach(clearTimeout);
    syncTimeoutsRef.current = [];
    setSpeakingBeat(null);

    const beatMs = 60000 / currentBPM;

    result.pattern.forEach((beat, i) => {
      if (beat.stress === "rest") return;
      const tid = setTimeout(() => {
        setSpeakingBeat(i);
        const utterance = new SpeechSynthesisUtterance(beat.exampleLine);
        utterance.rate = Math.max(0.6, Math.min(1.8, currentBPM / 120));
        utterance.lang = "tr-TR";
        utterance.onend = () =>
          setSpeakingBeat((prev) => (prev === i ? null : prev));
        utterance.onerror = () =>
          setSpeakingBeat((prev) => (prev === i ? null : prev));
        window.speechSynthesis.speak(utterance);
      }, beatMs * i);
      syncTimeoutsRef.current.push(tid);
    });

    // Auto-clear after all beats finish
    const clearTid = setTimeout(
      () => setSpeakingBeat(null),
      beatMs * result.pattern.length + 1500
    );
    syncTimeoutsRef.current.push(clearTid);
  }, [result, currentBPM]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    syncTimeoutsRef.current.forEach(clearTimeout);
    syncTimeoutsRef.current = [];
    setSpeakingBeat(null);
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-5 p-6 bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white tracking-wide">Flow Pattern</h2>
        <span className="text-xs text-zinc-500 font-mono">{currentBPM} BPM</span>
      </div>

      {/* Rapper selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-zinc-400">Rapper Style</span>
        <div className="flex flex-wrap gap-1.5">
          {RAPPERS.map((rapper) => (
            <button
              key={rapper}
              onClick={() => setCurrentStyle(rapper)}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                currentStyle === rapper
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
              ].join(" ")}
            >
              {rapper}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={loading}
        className={[
          "w-full py-3 rounded-xl font-semibold text-sm tracking-widest uppercase transition-colors",
          loading
            ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            : "bg-violet-600 hover:bg-violet-500 text-white",
        ].join(" ")}
      >
        {loading ? "Generating…" : `Generate ${currentStyle} Flow`}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <BeatGridSkeleton />}

      {/* ── Pattern Library ── */}
      <div className="flex flex-col gap-3 pt-1 border-t border-zinc-800">
        <PatternLibrary bpm={currentBPM} />
      </div>

      {/* Results */}
      {result && !loading && (
        <div className="flex flex-col gap-5">

          {/* Beat grid */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-widest">Beat Grid</span>
              <div className="flex gap-2">
                <button
                  onClick={speakSync}
                  disabled={speakingBeat !== null}
                  className={[
                    "px-2 py-1 rounded-lg text-xs border transition-colors",
                    speakingBeat !== null
                      ? "bg-violet-700 border-violet-500 text-violet-200 cursor-not-allowed"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white",
                  ].join(" ")}
                >
                  🎵 Senkronize Dinlet
                </button>
                <button
                  onClick={stopSpeech}
                  className="px-2 py-1 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-red-600 hover:text-white transition-colors"
                >
                  ■ Durdur
                </button>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
            <div className="flex gap-2 min-w-max sm:min-w-0">
              {result.pattern.map((beat) => (
                <BeatBlock
                  key={beat.beat}
                  beat={beat}
                  onSpeak={speak}
                  isSpeaking={speakingBeat === result.pattern.indexOf(beat)}
                  bpm={currentBPM}
                />
              ))}
            </div>
            </div>

            {/* Stress legend */}
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.entries(STRESS_COLORS) as [FlowBeat["stress"], string][]).map(
                ([stress, cls]) => (
                  <div key={stress} className="flex items-center gap-1">
                    <div className={["w-3 h-3 rounded border", cls].join(" ")} />
                    <span className="text-xs text-zinc-500 capitalize">{stress}</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex flex-col gap-3">
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">
                Pattern Description
              </span>
              <p className="text-sm text-zinc-200 leading-relaxed">{result.description}</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">
                İpuçları
              </span>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">
                {result.tipsTurkish}
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
