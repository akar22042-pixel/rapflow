"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMusicContext } from "@/lib/MusicContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TimeSignature = "4/4" | "3/4" | "6/8";
type SoundType = "davul" | "click" | "beep" | "rim";

const TIME_SIGNATURES: TimeSignature[] = ["4/4", "3/4", "6/8"];

const SOUND_OPTIONS: { id: SoundType; label: string }[] = [
  { id: "davul", label: "🥁 Davul" },
  { id: "click", label: "👆 Click" },
  { id: "beep",  label: "🔔 Beep"  },
  { id: "rim",   label: "🎹 Rim"   },
];

function beatsPerBar(sig: TimeSignature): number {
  if (sig === "3/4") return 3;
  if (sig === "6/8") return 6;
  return 4;
}

function strongBeats(sig: TimeSignature): number[] {
  if (sig === "3/4") return [0];
  if (sig === "6/8") return [0, 3];
  return [0];
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const LS_PREFS_KEY = "rapflow_metronome_prefs";

interface MetronomePrefs {
  soundType: SoundType;
  volume: number;    // 0–100
  accent: boolean;
}

function loadPrefs(): MetronomePrefs {
  try {
    const raw = localStorage.getItem(LS_PREFS_KEY);
    if (raw) return JSON.parse(raw) as MetronomePrefs;
  } catch { /* ignore */ }
  return { soundType: "click", volume: 80, accent: true };
}

function savePrefs(prefs: MetronomePrefs): void {
  try {
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Web Audio scheduler
// ---------------------------------------------------------------------------
const SCHEDULE_AHEAD = 0.1;
const TICK_INTERVAL  = 25;

function createClick(
  ctx: AudioContext,
  when: number,
  isStrong: boolean,
  soundType: SoundType,
  volume: number,   // 0–100
  accent: boolean,
): void {
  const vol     = volume / 100;
  const pitchMul = (accent && isStrong) ? 1.5 : 1.0;
  const gainMul  = (accent && isStrong) ? 1.3 : 1.0;

  if (soundType === "click") {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = (isStrong ? 1000 : 800) * pitchMul;
    const g = (isStrong ? 0.6 : 0.35) * gainMul * vol;
    gain.gain.setValueAtTime(g, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    osc.start(when);
    osc.stop(when + 0.05);

  } else if (soundType === "beep") {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = (isStrong ? 660 : 520) * pitchMul;
    const g = (isStrong ? 0.5 : 0.3) * gainMul * vol;
    gain.gain.setValueAtTime(g, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
    osc.start(when);
    osc.stop(when + 0.18);

  } else if (soundType === "davul") {
    // Low thud: oscillator sweep + white noise burst
    const osc  = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.frequency.value = (isStrong ? 80 : 60) * pitchMul;
    osc.frequency.exponentialRampToValueAtTime(20, when + 0.06);
    const og = (isStrong ? 0.8 : 0.5) * gainMul * vol;
    oscGain.gain.setValueAtTime(og, when);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.start(when);
    osc.stop(when + 0.07);

    // Noise burst
    const bufSize = ctx.sampleRate * 0.06;
    const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise     = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    const ng = (isStrong ? 0.25 : 0.15) * gainMul * vol;
    noiseGain.gain.setValueAtTime(ng, when);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    noise.start(when);
    noise.stop(when + 0.07);

  } else if (soundType === "rim") {
    // Rimshot: two layered oscillators at 300hz + 800hz
    for (const [freq, baseGain] of [[300, 0.5], [800, 0.4]] as const) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq * pitchMul;
      const g = (isStrong ? baseGain : baseGain * 0.6) * gainMul * vol;
      gain.gain.setValueAtTime(g, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
      osc.start(when);
      osc.stop(when + 0.04);
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Metronome() {
  const { currentBPM, setCurrentBPM, breathInterval } = useMusicContext();

  const [isPlaying, setIsPlaying]         = useState(false);
  const [timeSig, setTimeSig]             = useState<TimeSignature>("4/4");
  const [syllablesPerBeat, setSyllablesPerBeat] = useState(2);
  const [activeBeat, setActiveBeat]       = useState<number>(-1);

  // Sound prefs — loaded from localStorage
  const [soundType, setSoundType] = useState<SoundType>("click");
  const [volume, setVolume]       = useState(80);
  const [accent, setAccent]       = useState(true);

  // Load prefs on mount
  useEffect(() => {
    const prefs = loadPrefs();
    setSoundType(prefs.soundType);
    setVolume(prefs.volume);
    setAccent(prefs.accent);
  }, []);

  // Persist prefs whenever they change
  useEffect(() => {
    savePrefs({ soundType, volume, accent });
  }, [soundType, volume, accent]);

  // Web Audio refs
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatTimeRef   = useRef<number>(0);
  const beatCountRef      = useRef<number>(0);

  // Stable refs for scheduler closure
  const bpmRef       = useRef(currentBPM);
  const timeSigRef   = useRef(timeSig);
  const soundTypeRef = useRef(soundType);
  const volumeRef    = useRef(volume);
  const accentRef    = useRef(accent);
  const isPlayingRef = useRef(false);

  useEffect(() => { bpmRef.current = currentBPM; }, [currentBPM]);
  useEffect(() => { timeSigRef.current = timeSig; }, [timeSig]);
  useEffect(() => { soundTypeRef.current = soundType; }, [soundType]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { accentRef.current = accent; }, [accent]);

  // Derived stats
  const beatDurationMs = Math.round(60000 / currentBPM);
  const syllablesPerMin = syllablesPerBeat * currentBPM;
  const totalBeats = beatsPerBar(timeSig);
  const strong     = strongBeats(timeSig);

  // ------------------------------------------------------------------
  // Scheduler
  // ------------------------------------------------------------------
  const schedule = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const secondsPerBeat = 60 / bpmRef.current;
    const beats  = beatsPerBar(timeSigRef.current);
    const strong = strongBeats(timeSigRef.current);

    while (nextBeatTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const beatInBar = beatCountRef.current % beats;
      const isStrong  = strong.includes(beatInBar);

      createClick(
        ctx,
        nextBeatTimeRef.current,
        isStrong,
        soundTypeRef.current,
        volumeRef.current,
        accentRef.current,
      );

      const delay = (nextBeatTimeRef.current - ctx.currentTime) * 1000;
      const capturedBeat = beatInBar;
      setTimeout(() => setActiveBeat(capturedBeat), Math.max(0, delay));

      nextBeatTimeRef.current += secondsPerBeat;
      beatCountRef.current    += 1;
    }
  }, []);

  // ------------------------------------------------------------------
  // Play / Stop
  // ------------------------------------------------------------------
  const start = useCallback(() => {
    const ctx = new AudioContext();
    ctx.resume();
    audioCtxRef.current       = ctx;
    nextBeatTimeRef.current   = ctx.currentTime + 0.05;
    beatCountRef.current      = 0;
    schedulerTimerRef.current = setInterval(schedule, TICK_INTERVAL);
    isPlayingRef.current      = true;
    setIsPlaying(true);
  }, [schedule]);

  const stop = useCallback(() => {
    if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
    schedulerTimerRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current  = null;
    isPlayingRef.current = false;
    setActiveBeat(-1);
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    isPlayingRef.current ? stop() : start();
  }, [start, stop]);

  // Restart on BPM / time signature change
  useEffect(() => {
    if (!isPlayingRef.current) return;
    stop();
    const t = setTimeout(start, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBPM, timeSig]);

  useEffect(() => () => stop(), [stop]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6 p-6 bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-xl mx-auto select-none">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white tracking-wide">Metronome</h2>
        <span className="text-xs text-zinc-500 font-mono">{currentBPM} BPM</span>
      </div>

      {/* Beat grid */}
      <div className="flex items-center justify-center gap-3 py-2">
        {Array.from({ length: totalBeats }, (_, i) => {
          const isActive = activeBeat === i;
          const isStrong = strong.includes(i);
          return (
            <div
              key={i}
              className={[
                "rounded-full transition-all duration-75",
                isStrong ? "w-8 h-8 sm:w-10 sm:h-10" : "w-6 h-6 sm:w-7 sm:h-7",
                isActive
                  ? isStrong
                    ? "bg-violet-400 shadow-[0_0_18px_4px_rgba(167,139,250,0.7)] scale-110"
                    : "bg-violet-600 shadow-[0_0_10px_2px_rgba(124,58,237,0.5)] scale-105"
                  : isStrong
                  ? "bg-zinc-600"
                  : "bg-zinc-700",
              ].join(" ")}
            />
          );
        })}
      </div>

      {/* Play / Stop */}
      <button
        onClick={toggle}
        className={[
          "w-full py-3 rounded-xl font-semibold text-sm tracking-widest uppercase transition-colors",
          isPlaying
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-violet-600 hover:bg-violet-500 text-white",
        ].join(" ")}
      >
        {isPlaying ? "■ Stop" : "▶ Start"}
      </button>

      {/* BPM Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>BPM</span>
          <span className="font-mono text-white">{currentBPM}</span>
        </div>
        <input
          type="range"
          min={60}
          max={200}
          value={currentBPM}
          onChange={(e) => setCurrentBPM(Number(e.target.value))}
          className="w-full accent-violet-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>60</span>
          <span>200</span>
        </div>
      </div>

      {/* Time Signature + Syllables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Time Signature</span>
          <div className="flex gap-1">
            {TIME_SIGNATURES.map((sig) => (
              <button
                key={sig}
                onClick={() => setTimeSig(sig)}
                className={[
                  "flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors",
                  timeSig === sig
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                ].join(" ")}
              >
                {sig}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Syllables / Beat</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setSyllablesPerBeat(n)}
                className={[
                  "flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors",
                  syllablesPerBeat === n
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                ].join(" ")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sound Customization ── */}
      <div className="flex flex-col gap-4 pt-1 border-t border-zinc-800">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Ses Ayarları</span>

        {/* Sound type pills */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-400">Ses Tipi</span>
          <div className="flex flex-wrap gap-1.5">
            {SOUND_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSoundType(opt.id)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  soundType === opt.id
                    ? "bg-violet-600 border-violet-500 text-white"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Volume slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Ses Seviyesi</span>
            <span className="font-mono text-white">{volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-violet-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-zinc-600">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Accent toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-300 font-medium">1. Vuruş Aksanı</span>
            <span className="text-[10px] text-zinc-600">Beat 1: 1.5× frekans, 1.3× ses</span>
          </div>
          <button
            onClick={() => setAccent((a) => !a)}
            className={[
              "relative w-11 h-6 rounded-full border transition-colors flex-shrink-0",
              accent
                ? "bg-violet-600 border-violet-500"
                : "bg-zinc-700 border-zinc-600",
            ].join(" ")}
            role="switch"
            aria-checked={accent}
          >
            <span
              className={[
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                accent ? "translate-x-5" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      {/* Stats panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Beat Duration" value={`${beatDurationMs} ms`} />
        <StatCard label="Syllables / Min" value={syllablesPerMin.toLocaleString()} />
        <StatCard label="Breath Every" value={`${breathInterval} beats`} />
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
