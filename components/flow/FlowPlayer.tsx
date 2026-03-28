"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import {
  FlowPattern,
  StressType,
  buildOnomatopoeia,
} from "@/lib/flowPatterns";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRESS_STYLE: Record<
  StressType,
  { bg: string; border: string; text: string; ring: string }
> = {
  hit:   { bg: "bg-red-500/20",    border: "border-red-400",    text: "text-red-300",    ring: "ring-red-400"    },
  ghost: { bg: "bg-zinc-700/20",   border: "border-zinc-600",   text: "text-zinc-400",   ring: "ring-zinc-500"   },
  synco: { bg: "bg-orange-500/20", border: "border-orange-400", text: "text-orange-300", ring: "ring-orange-400" },
  skip:  { bg: "bg-transparent",   border: "border-zinc-800",   text: "text-zinc-700",   ring: ""                },
};

type Speed = 0.5 | 0.75 | 1;
const SPEEDS: Speed[] = [0.5, 0.75, 1];
const SPEED_LABEL: Record<Speed, string> = { 0.5: "50%", 0.75: "75%", 1: "100%" };

// ---------------------------------------------------------------------------
// Audio helper
// ---------------------------------------------------------------------------

function playSyllable(ctx: AudioContext, when: number, stress: StressType): void {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (stress === "hit") {
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.8, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    osc.start(when);
    osc.stop(when + 0.05);
  } else if (stress === "ghost") {
    osc.frequency.value = 400;
    gain.gain.setValueAtTime(0.2, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    osc.start(when);
    osc.stop(when + 0.04);
  } else if (stress === "synco") {
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0.5, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    osc.start(when);
    osc.stop(when + 0.045);
  }
}

// ---------------------------------------------------------------------------
// Helper — primary stress of a beat (first non-skip syllable)
// ---------------------------------------------------------------------------

function beatPrimaryStress(
  syllables: FlowPattern["pattern"][0]["syllables"]
): StressType {
  return syllables.find((s) => s.stress !== "skip")?.stress ?? "ghost";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlowPlayerProps {
  pattern: FlowPattern;
  bpm: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlowPlayer({ pattern, bpm }: FlowPlayerProps) {
  const { setCurrentStyle } = useMusicContext();

  const [isPlaying, setIsPlaying]       = useState(false);
  const [isLooping, setIsLooping]       = useState(true);
  const [speed, setSpeed]               = useState<Speed>(1);
  const [activeSylKey, setActiveSylKey] = useState<string | null>(null);

  // Refs so scheduler callbacks always read current values
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const timeoutsRef  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isPlayingRef = useRef(false);
  const isLoopingRef = useRef(isLooping);
  const speedRef     = useRef(speed);
  const patternRef   = useRef(pattern);
  const bpmRef       = useRef(bpm);

  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // ─── Schedule one bar ────────────────────────────────────────────────────

  const scheduleBar = useCallback((ctx: AudioContext, barStartAudio: number) => {
    const pat          = patternRef.current;
    const effectiveBPM = bpmRef.current * speedRef.current;
    const beatDuration = 60 / effectiveBPM;
    const barDuration  = pat.pattern.length * beatDuration;

    for (const beat of pat.pattern) {
      const beatStart    = (beat.beatNumber - 1) * beatDuration;
      const slotDuration = beatDuration / beat.syllables.length;

      beat.syllables.forEach((syl, sylIdx) => {
        let timeOffset = beatStart + sylIdx * slotDuration;
        // Synco syllables scheduled slightly early for off-beat feel
        if (syl.stress === "synco") timeOffset = Math.max(0, timeOffset - 0.05);

        const audioTime = barStartAudio + timeOffset;
        const nowAudio  = ctx.currentTime;
        const visualMs  = Math.max(0, (audioTime - nowAudio) * 1000);
        const key       = `b${beat.beatNumber}-s${sylIdx}`;

        // Audio
        if (syl.stress !== "skip" && audioTime >= nowAudio) {
          playSyllable(ctx, audioTime, syl.stress);
        }

        // Visual highlight
        const tid = setTimeout(() => {
          if (!isPlayingRef.current) return;
          setActiveSylKey(syl.stress === "skip" ? null : key);
        }, visualMs);
        timeoutsRef.current.push(tid);
      });
    }

    // Clear active key at bar end
    const nowAudio = ctx.currentTime;
    const endMs    = Math.max(0, (barStartAudio + barDuration - nowAudio) * 1000);
    const clearTid = setTimeout(() => setActiveSylKey(null), endMs);
    timeoutsRef.current.push(clearTid);

    // Loop: re-invoke 80 ms before bar ends so next bar audio is ready
    if (isLoopingRef.current) {
      const loopTid = setTimeout(() => {
        if (!isPlayingRef.current || !audioCtxRef.current) return;
        scheduleBar(audioCtxRef.current, barStartAudio + barDuration);
      }, Math.max(0, endMs - 80));
      timeoutsRef.current.push(loopTid);
    }
  }, []); // stable — reads all state via refs

  // ─── Start / Stop ─────────────────────────────────────────────────────────

  const start = useCallback(() => {
    const ctx = new AudioContext();
    ctx.resume();
    audioCtxRef.current  = ctx;
    isPlayingRef.current = true;
    setIsPlaying(true);
    scheduleBar(ctx, ctx.currentTime + 0.05);
  }, [scheduleBar]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setActiveSylKey(null);
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    isPlayingRef.current ? stop() : start();
  }, [start, stop]);

  // Restart when pattern / bpm / speed changes while playing
  useEffect(() => {
    if (!isPlayingRef.current) return;
    stop();
    const t = setTimeout(start, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern.id, bpm, speed]);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const onomatopoeiaStr = buildOnomatopoeia(pattern);

  // Color each word of an example line by mapping its position to a beat's primary stress
  function colorWords(line: string) {
    const words = line.trim().split(/\s+/);
    return words.map((word, wi) => {
      const beatIdx = Math.min(
        Math.floor((wi / words.length) * pattern.pattern.length),
        pattern.pattern.length - 1
      );
      const stress = beatPrimaryStress(pattern.pattern[beatIdx].syllables);
      return { word, style: STRESS_STYLE[stress] };
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Flow Pattern</p>
          <h3 className="text-sm font-bold text-white leading-snug">
            {pattern.artist}
            <span className="text-zinc-500 font-normal"> — {pattern.song}</span>
          </h3>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
            {pattern.bpmRange[0]}–{pattern.bpmRange[1]} BPM
          </p>
        </div>

        <button
          onClick={() => setCurrentStyle(pattern.artist)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors border border-violet-500"
        >
          Bu Flowu Kullan
        </button>
      </div>

      {/* ── Syllable pill grid ── */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-3 sm:gap-4 min-w-max">
          {pattern.pattern.map((beat) => (
            <div key={beat.beatNumber} className="flex flex-col items-center gap-1.5">
              {/* Beat number */}
              <span className="text-[10px] font-mono text-zinc-600 leading-none">
                {beat.beatNumber}
              </span>

              {/* Syllable pills */}
              <div className="flex gap-1">
                {beat.syllables.map((syl, sylIdx) => {
                  const key      = `b${beat.beatNumber}-s${sylIdx}`;
                  const isActive = activeSylKey === key;
                  const s        = STRESS_STYLE[syl.stress];
                  return (
                    <div
                      key={key}
                      className={[
                        "px-2 py-1.5 rounded border text-xs font-mono font-bold",
                        "text-center min-w-[36px] select-none",
                        "transition-all duration-75",
                        s.bg, s.border, s.text,
                        isActive
                          ? `ring-2 ${s.ring} scale-110 brightness-150 shadow-lg`
                          : "opacity-80",
                      ].join(" ")}
                    >
                      {syl.stress === "skip" ? "—" : syl.text}
                    </div>
                  );
                })}
              </div>

              {/* Subdivision hint */}
              <span className="text-[9px] text-zinc-700 font-mono leading-none">
                {beat.subdivision === "triplet"   ? "×3"  :
                 beat.subdivision === "sixteenth" ? "×16" : "×8"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stress legend ── */}
      <div className="flex flex-wrap gap-2">
        {(["hit", "synco", "ghost", "skip"] as StressType[]).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className={["w-2.5 h-2.5 rounded border", STRESS_STYLE[s].bg, STRESS_STYLE[s].border].join(" ")} />
            <span className={["text-[10px] font-mono", STRESS_STYLE[s].text].join(" ")}>{s}</span>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={toggle}
          className={[
            "px-4 py-2 rounded-xl text-sm font-semibold tracking-wide transition-colors border",
            isPlaying
              ? "bg-red-600 border-red-500 text-white hover:bg-red-500"
              : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500",
          ].join(" ")}
        >
          {isPlaying ? "■ Durdur" : "▶ Oynat"}
        </button>

        <button
          onClick={() => setIsLooping((l) => !l)}
          className={[
            "px-3 py-2 rounded-xl text-sm font-semibold transition-colors border",
            isLooping
              ? "bg-violet-500/20 border-violet-500 text-violet-300"
              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
          ].join(" ")}
        >
          🔁 Döngü
        </button>

        {/* Speed buttons */}
        <div className="flex gap-1 ml-auto">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={[
                "px-2.5 py-2 rounded-lg text-xs font-mono font-semibold transition-colors border",
                speed === s
                  ? "bg-zinc-600 border-zinc-400 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
              ].join(" ")}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rhythm description ── */}
      <div className="flex flex-col gap-2">
        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/60 px-4 py-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
            Ritim Tarifi
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {pattern.rhythmDescription}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-2.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
            Onomatope
          </p>
          <p className="text-sm font-mono text-violet-300 tracking-widest">
            {onomatopoeiaStr}
          </p>
        </div>
      </div>

      {/* ── Example lines ── */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
          Örnek Satırlar
        </p>
        {pattern.exampleLines.map((line, li) => (
          <div key={li} className="flex flex-wrap gap-1 px-0.5">
            {colorWords(line).map(({ word, style }, wi) => (
              <span
                key={wi}
                className={[
                  "text-sm font-mono px-1.5 py-0.5 rounded border",
                  style.bg,
                  style.border,
                  style.text,
                ].join(" ")}
              >
                {word}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* ── Tags ── */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-800">
        {pattern.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-500"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}
