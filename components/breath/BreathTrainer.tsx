"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useMusicContext } from "@/lib/MusicContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Insert breath markers (↓) into lyrics every breathInterval beats.
// We approximate 1 line ≈ 1 bar ≈ (timeSignature) beats.
function insertBreathMarkers(
  lyrics: string,
  breathInterval: number
): { segments: { text: string; isBreath: boolean }[] } {
  const lines = lyrics.split("\n");
  const beatsPerBar = 4; // assumed 4/4
  const barsPerBreath = Math.max(1, Math.round(breathInterval / beatsPerBar));

  const segments: { text: string; isBreath: boolean }[] = [];
  lines.forEach((line, i) => {
    if (line.trim()) {
      segments.push({ text: line, isBreath: false });
      // insert breath after every barsPerBreath lines
      if ((i + 1) % barsPerBreath === 0) {
        segments.push({ text: "↓ NEFES", isBreath: true });
      }
    } else {
      segments.push({ text: "", isBreath: false });
    }
  });
  return { segments };
}

// Phrase length in seconds = breathInterval beats at current BPM
function phraseLengthSeconds(bpm: number, breathInterval: number): number {
  return (60 / bpm) * breathInterval;
}

// Breaths per minute = 60 / phraseLength
function breathsPerMinute(bpm: number, breathInterval: number): number {
  const phrase = phraseLengthSeconds(bpm, breathInterval);
  return phrase > 0 ? Math.round((60 / phrase) * 10) / 10 : 0;
}

// ---------------------------------------------------------------------------
// SVG breath circle animation
// ---------------------------------------------------------------------------
// Phase durations as fractions of a full breath cycle:
//   inhale: 40%, hold: 10%, exhale: 40%, rest: 10%
const PHASE_FRACTIONS = [0.4, 0.1, 0.4, 0.1];
type BreathPhase = "inhale" | "hold" | "exhale" | "rest";
const PHASE_NAMES: BreathPhase[] = ["inhale", "hold", "exhale", "rest"];

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: "Nefes Al",
  hold:   "Tut",
  exhale: "Ver",
  rest:   "Dinlen",
};
const PHASE_COLOR: Record<BreathPhase, string> = {
  inhale: "#a78bfa", // violet-400
  hold:   "#60a5fa", // blue-400
  exhale: "#34d399", // emerald-400
  rest:   "#6b7280", // zinc-500
};

interface BreathState {
  phase: BreathPhase;
  progress: number; // 0-1 within current phase
  cycleProgress: number; // 0-1 across full cycle
}

const MIN_R = 48;
const MAX_R = 90;

function circleRadius(state: BreathState): number {
  if (state.phase === "inhale") return MIN_R + (MAX_R - MIN_R) * state.progress;
  if (state.phase === "hold")   return MAX_R;
  if (state.phase === "exhale") return MAX_R - (MAX_R - MIN_R) * state.progress;
  return MIN_R; // rest
}

// ---------------------------------------------------------------------------
// BreathCircle component
// ---------------------------------------------------------------------------
function BreathCircle({
  state,
  isActive,
}: {
  state: BreathState;
  isActive: boolean;
}) {
  const r = circleRadius(state);
  const color = PHASE_COLOR[state.phase];
  const cx = 110;
  const cy = 110;
  const circumference = 2 * Math.PI * MAX_R;
  const dashOffset = circumference * (1 - state.cycleProgress);

  return (
    <svg
      viewBox="0 0 220 220"
      className="w-40 h-40 sm:w-[220px] sm:h-[220px] select-none"
      aria-hidden
    >
      {/* Track ring */}
      <circle
        cx={cx}
        cy={cy}
        r={MAX_R}
        fill="none"
        stroke="#27272a"
        strokeWidth="3"
      />

      {/* Progress arc */}
      <circle
        cx={cx}
        cy={cy}
        r={MAX_R}
        fill="none"
        stroke={isActive ? color : "#3f3f46"}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={isActive ? dashOffset : circumference}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease" }}
      />

      {/* Glow ring behind main circle */}
      {isActive && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 6}
          fill="none"
          stroke={color}
          strokeWidth="8"
          opacity="0.15"
          style={{ transition: "r 0.1s linear" }}
        />
      )}

      {/* Main breath circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={isActive ? color : "#3f3f46"}
        opacity={isActive ? 0.9 : 0.4}
        style={{ transition: "r 0.1s linear, fill 0.3s ease, opacity 0.3s ease" }}
      />

      {/* Phase label */}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="14"
        fontWeight="600"
        fontFamily="sans-serif"
        opacity={isActive ? 1 : 0.4}
      >
        {isActive ? PHASE_LABEL[state.phase] : "Bekliyor"}
      </text>

      {/* Beat counter inside circle */}
      {isActive && (
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="11"
          fontFamily="monospace"
          opacity={0.7}
        >
          {state.phase}
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Annotated lyrics panel
// ---------------------------------------------------------------------------
function AnnotatedLyrics({
  segments,
  activeLineIndex,
}: {
  segments: { text: string; isBreath: boolean }[];
  activeLineIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLineIndex]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin"
    >
      {segments.map((seg, i) => {
        const isActive = i === activeLineIndex;
        if (seg.text === "" && !seg.isBreath) {
          return <div key={i} className="h-2" />;
        }
        if (seg.isBreath) {
          return (
            <div
              key={i}
              ref={isActive ? activeRef : null}
              className={[
                "flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold tracking-widest transition-all duration-200",
                isActive
                  ? "bg-emerald-500/30 text-emerald-300 scale-100 opacity-100"
                  : "text-emerald-700 opacity-50",
              ].join(" ")}
            >
              <span className="text-base">↓</span>
              <span>NEFES AL</span>
            </div>
          );
        }
        return (
          <div
            key={i}
            ref={isActive ? activeRef : null}
            className={[
              "px-3 py-1 rounded-lg text-sm font-mono transition-all duration-200",
              isActive
                ? "bg-violet-500/20 text-white border-l-2 border-violet-400"
                : "text-zinc-500",
            ].join(" ")}
          >
            {seg.text}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function BreathTrainer() {
  const { currentBPM, currentLyrics, breathInterval } = useMusicContext();

  const [isActive, setIsActive] = useState(false);
  const [beatCount, setBeatCount] = useState(0);
  const [flashBreath, setFlashBreath] = useState(false);
  const [breathState, setBreathState] = useState<BreathState>({
    phase: "inhale",
    progress: 0,
    cycleProgress: 0,
  });

  // Refs for scheduler
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastBeatRef = useRef<number>(-1);

  // Derived
  const cycleDuration = useMemo(
    () => phraseLengthSeconds(currentBPM, breathInterval) * 1000,
    [currentBPM, breathInterval]
  );
  const beatDuration = useMemo(() => (60 / currentBPM) * 1000, [currentBPM]);
  const bpm = breathsPerMinute(currentBPM, breathInterval);
  const phraseLen = phraseLengthSeconds(currentBPM, breathInterval);

  const { segments } = useMemo(
    () => insertBreathMarkers(currentLyrics, breathInterval),
    [currentLyrics, breathInterval]
  );

  const hasLyrics = currentLyrics.trim().length > 0;

  // Active line: every bar of 4 beats advances the lyric line
  const beatsPerBar = 4;
  const activeLineIndex = useMemo(() => {
    if (!isActive) return -1;
    const bar = Math.floor(beatCount / beatsPerBar);
    // map bar index to segment index (skip empty lines, count breath markers)
    let segIdx = 0;
    let barIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].isBreath) { segIdx = i; continue; }
      if (!segments[i].text) continue;
      if (barIdx === bar) return i;
      barIdx++;
      segIdx = i;
    }
    return segIdx;
  }, [beatCount, segments, isActive]);

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------
  const tick = useCallback(
    (now: number) => {
      const elapsed = now - startTimeRef.current;

      // Beat counter
      const beat = Math.floor(elapsed / beatDuration);
      if (beat !== lastBeatRef.current) {
        lastBeatRef.current = beat;
        setBeatCount(beat);

        // Flash "NEFES AL" at every breathInterval beats
        if (beat > 0 && beat % breathInterval === 0) {
          setFlashBreath(true);
          setTimeout(() => setFlashBreath(false), 600);
        }
      }

      // Breath cycle animation
      const cyclePos = (elapsed % cycleDuration) / cycleDuration; // 0-1

      // Find which phase we're in
      let accumulated = 0;
      let phase: BreathPhase = "inhale";
      let phaseProgress = 0;

      for (let i = 0; i < PHASE_FRACTIONS.length; i++) {
        const frac = PHASE_FRACTIONS[i];
        if (cyclePos < accumulated + frac) {
          phase = PHASE_NAMES[i];
          phaseProgress = (cyclePos - accumulated) / frac;
          break;
        }
        accumulated += frac;
      }

      setBreathState({ phase, progress: phaseProgress, cycleProgress: cyclePos });
      rafRef.current = requestAnimationFrame(tick);
    },
    [beatDuration, breathInterval, cycleDuration]
  );

  // ---------------------------------------------------------------------------
  // Start / Stop
  // ---------------------------------------------------------------------------
  const start = useCallback(() => {
    startTimeRef.current = performance.now();
    lastBeatRef.current = -1;
    setBeatCount(0);
    setIsActive(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsActive(false);
    setBeatCount(0);
    setFlashBreath(false);
    setBreathState({ phase: "inhale", progress: 0, cycleProgress: 0 });
  }, []);

  // Restart on BPM / breathInterval change while active
  useEffect(() => {
    if (!isActive) return;
    stop();
    const t = setTimeout(start, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBPM, breathInterval]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const beatInPhrase = isActive ? beatCount % breathInterval : 0;

  return (
    <div className="flex flex-col gap-5 p-6 bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white tracking-wide">Nefes Antrenörü</h2>
        <span className="text-xs text-zinc-500 font-mono">{currentBPM} BPM</span>
      </div>

      {/* Main content row — stacks on mobile */}
      <div className="flex flex-col sm:flex-row gap-6 sm:items-center">

        {/* SVG breath circle */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <BreathCircle state={breathState} isActive={isActive} />

          {/* Beat progress bar within phrase */}
          <div className="w-full sm:w-[220px] flex flex-col gap-1">
            <div className="flex justify-between text-xs text-zinc-500 font-mono">
              <span>beat {isActive ? beatInPhrase + 1 : 0}</span>
              <span>/ {breathInterval}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-100"
                style={{
                  width: isActive
                    ? `${((beatInPhrase + 1) / breathInterval) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Right side — lyrics or placeholder */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {hasLyrics ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">
                  Söz Akışı
                </span>
                {isActive && (
                  <span className="text-xs font-mono text-violet-400">
                    bar {Math.floor(beatCount / 4) + 1}
                  </span>
                )}
              </div>
              <AnnotatedLyrics
                segments={segments}
                activeLineIndex={activeLineIndex}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
              <span className="text-2xl">✍️</span>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Söz editöründe sözlerini yaz,<br />
                burada nefes noktaları görünür.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* NEFES AL flash banner */}
      <div
        className={[
          "rounded-xl py-3 text-center font-bold text-lg tracking-widest transition-all duration-150",
          flashBreath
            ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500 scale-100 opacity-100"
            : "bg-zinc-800/50 text-zinc-700 border border-zinc-800 scale-95 opacity-0",
        ].join(" ")}
        aria-live="polite"
      >
        ↓ NEFES AL
      </div>

      {/* Start / Stop */}
      <button
        onClick={isActive ? stop : start}
        className={[
          "w-full py-3 rounded-xl font-semibold text-sm tracking-widest uppercase transition-colors",
          isActive
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-violet-600 hover:bg-violet-500 text-white",
        ].join(" ")}
      >
        {isActive ? "■ Durdur" : "▶ Pratik Başlat"}
      </button>

      {/* Stats panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Nefes / Dk"
          value={`${bpm}`}
        />
        <StatCard
          label="Cümle Süresi"
          value={`${phraseLen.toFixed(1)} s`}
        />
        <StatCard
          label="Nefes Her"
          value={`${breathInterval} beat`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-zinc-800 rounded-xl p-3">
      <span className="text-xs text-zinc-500 text-center leading-tight">{label}</span>
      <span className="text-sm font-mono font-semibold text-violet-300">{value}</span>
    </div>
  );
}
