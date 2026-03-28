"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useMusicContext } from "@/lib/MusicContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BPMHistoryItem {
  name: string;
  bpm: number;
}

interface DetectionResult {
  bpm: number;
  confidence: number;        // 0–1
  beatPositions: number[];   // sample indices
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const LS_HISTORY = "rapflow_bpm_history";

function loadHistory(): BPMHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) ?? "[]");
  } catch { return []; }
}

function saveHistory(items: BPMHistoryItem[]): void {
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(items)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// BPM detection
// ---------------------------------------------------------------------------
function detectBPM(buffer: AudioBuffer): DetectionResult {
  // Use only first 60 s to keep analysis fast
  const sampleRate  = buffer.sampleRate;
  const maxSamples  = Math.min(buffer.length, sampleRate * 60);
  const raw         = buffer.getChannelData(0).slice(0, maxSamples);
  const WINDOW      = 512;

  // 1. RMS energy per window
  const energies: number[] = [];
  for (let i = 0; i < raw.length; i += WINDOW) {
    const end = Math.min(i + WINDOW, raw.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += raw[j] * raw[j];
    energies.push(Math.sqrt(sum / (end - i)));
  }

  // 2. Peak picking: energy > 1.3× local average
  const HALF_WIN = Math.ceil(0.5 * sampleRate / WINDOW); // ~0.5 s context
  const peaks: number[] = [];
  for (let i = 0; i < energies.length; i++) {
    const lo = Math.max(0, i - HALF_WIN);
    const hi = Math.min(energies.length, i + HALF_WIN);
    let localSum = 0;
    for (let j = lo; j < hi; j++) localSum += energies[j];
    if (energies[i] > (localSum / (hi - lo)) * 1.3) peaks.push(i);
  }

  // 3. Deduplicate: keep only one peak per 0.3 s
  const MIN_GAP = Math.ceil(0.3 * sampleRate / WINDOW);
  const filtered: number[] = [];
  let last = -Infinity;
  for (const p of peaks) {
    if (p - last > MIN_GAP) { filtered.push(p); last = p; }
  }

  if (filtered.length < 2) {
    return { bpm: 120, confidence: 0, beatPositions: [] };
  }

  // 4. Interval histogram
  const intervals = filtered.slice(1).map((p, i) => p - filtered[i]);
  const hist = new Map<number, number>();
  for (const iv of intervals) {
    const k = Math.round(iv);
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }

  let bestIv = intervals[0], bestCount = 0;
  for (const [k, c] of hist) {
    if (c > bestCount) { bestCount = c; bestIv = k; }
  }

  // 5. BPM from most common interval
  const ivSec = (bestIv * WINDOW) / sampleRate;
  let bpm = Math.round(60 / ivSec);

  // Handle double/half tempo confusion
  if (bpm > 200) bpm = Math.round(bpm / 2);
  if (bpm < 60)  bpm = Math.round(bpm * 2);
  bpm = Math.max(60, Math.min(200, bpm));

  const confidence = Math.min(1, bestCount / intervals.length);
  const beatPositions = filtered.map((p) => p * WINDOW);

  return { bpm, confidence, beatPositions };
}

// ---------------------------------------------------------------------------
// Waveform renderer
// ---------------------------------------------------------------------------
function drawWaveform(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  beatPositions: number[],
  playhead: number, // 0–1
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const data = buffer.getChannelData(0);
  const spp  = Math.max(1, Math.floor(data.length / width));

  // Background
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, width, height);

  // Waveform
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const start = x * spp;
    let lo = 0, hi = 0;
    for (let s = start; s < start + spp && s < data.length; s++) {
      if (data[s] < lo) lo = data[s];
      if (data[s] > hi) hi = data[s];
    }
    const yLo = ((1 + lo) / 2) * height;
    const yHi = ((1 - hi) / 2) * height;
    if (x === 0) ctx.moveTo(x, yLo);
    ctx.lineTo(x, yHi);
    ctx.lineTo(x, yLo);
  }
  ctx.stroke();

  // Beat markers
  ctx.lineWidth = 1;
  for (const bp of beatPositions) {
    const x = Math.round((bp / data.length) * width);
    ctx.strokeStyle = "rgba(251,191,36,0.5)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Playhead
  if (playhead > 0) {
    const x = Math.round(playhead * width);
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------
function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
    : pct >= 40 ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
    : "text-red-300 border-red-500/40 bg-red-500/10";
  return (
    <span className={["text-[10px] font-mono px-2 py-0.5 rounded-full border", color].join(" ")}>
      {pct}% güven
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BeatMatcher() {
  const { setCurrentBPM } = useMusicContext();

  const [fileName, setFileName]     = useState<string | null>(null);
  const [duration, setDuration]     = useState<number>(0);
  const [analyzing, setAnalyzing]   = useState(false);
  const [result, setResult]         = useState<DetectionResult | null>(null);
  const [manualBPM, setManualBPM]   = useState("");
  const [isPlaying, setIsPlaying]   = useState(false);
  const [playhead, setPlayhead]     = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory]       = useState<BPMHistoryItem[]>([]);
  const [appliedFlash, setAppliedFlash] = useState(false);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef    = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);  // audioCtx.currentTime when playback started
  const rafRef       = useRef<number>(0);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Redraw canvas when result or playhead changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    if (!canvas || !buffer) return;
    drawWaveform(canvas, buffer, result?.beatPositions ?? [], playhead);
  }, [result, playhead]);

  // Cleanup on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.stop();
    audioCtxRef.current?.close();
  }, []);

  // ── Process uploaded file
  const processFile = useCallback(async (file: File) => {
    if (!file.type.match(/audio\/(mpeg|wav|ogg|mp3|x-wav)/i) &&
        !file.name.match(/\.(mp3|wav|ogg)$/i)) return;

    setFileName(file.name);
    setAnalyzing(true);
    setResult(null);
    setPlayhead(0);
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.stop();
    sourceRef.current = null;

    try {
      const arrayBuf = await file.arrayBuffer();
      const ctx      = new AudioContext();
      const buffer   = await ctx.decodeAudioData(arrayBuf);
      await ctx.close();

      bufferRef.current = buffer;
      setDuration(buffer.duration);

      // Detect BPM in next tick to allow UI to update
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const detection = detectBPM(buffer);
      setResult(detection);
      setManualBPM(String(detection.bpm));

      // Draw initial waveform
      if (canvasRef.current) {
        drawWaveform(canvasRef.current, buffer, detection.beatPositions, 0);
      }

      // Save to history
      const item: BPMHistoryItem = { name: file.name.replace(/\.[^.]+$/, ""), bpm: detection.bpm };
      const updated = [item, ...loadHistory().filter((h) => h.name !== item.name)].slice(0, 3);
      saveHistory(updated);
      setHistory(updated);
    } catch (e) {
      console.error("Audio processing error:", e);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // ── Drag & drop handlers
  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Play / stop
  const startPlayback = useCallback(() => {
    const buffer = bufferRef.current;
    if (!buffer) return;

    const ctx    = new AudioContext();
    ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.onended = () => {
      setIsPlaying(false);
      setPlayhead(0);
      cancelAnimationFrame(rafRef.current);
      ctx.close();
    };

    audioCtxRef.current = ctx;
    sourceRef.current   = source;
    startTimeRef.current = ctx.currentTime;
    setIsPlaying(true);

    const tick = () => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      setPlayhead(Math.min(1, elapsed / buffer.duration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.stop();
    sourceRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
    setPlayhead(0);
  }, []);

  const togglePlayback = useCallback(() => {
    isPlaying ? stopPlayback() : startPlayback();
  }, [isPlaying, startPlayback, stopPlayback]);

  // ── Apply BPM
  const applyBPM = useCallback((bpm: number) => {
    const clamped = Math.max(60, Math.min(200, bpm));
    setCurrentBPM(clamped);
    setAppliedFlash(true);
    setTimeout(() => setAppliedFlash(false), 2000);
  }, [setCurrentBPM]);

  const effectiveBPM = Number(manualBPM) || result?.bpm || 120;

  const fmtDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">

      {/* ── Upload zone ───────────────────────────────────────────────── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors",
          isDragging
            ? "border-violet-400 bg-violet-500/10"
            : "border-zinc-700 bg-zinc-900 hover:border-violet-600 hover:bg-violet-500/5",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.ogg,audio/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
        />
        <span className="text-3xl select-none">🎵</span>
        {fileName ? (
          <div className="text-center">
            <p className="text-sm font-medium text-white truncate max-w-xs">{fileName}</p>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{fmtDuration(duration)}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-zinc-300">MP3, WAV veya OGG dosyası sürükle</p>
            <p className="text-xs text-zinc-600 mt-0.5">veya tıklayarak seç</p>
          </div>
        )}
      </div>

      {/* ── Waveform canvas ───────────────────────────────────────────── */}
      {bufferRef.current && (
        <div className="rounded-xl overflow-hidden border border-zinc-700">
          <canvas
            ref={canvasRef}
            width={600}
            height={80}
            className="w-full h-auto block"
          />
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-t border-zinc-800">
            <div className="flex gap-3 text-[10px] font-mono text-zinc-600">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-amber-400/70" /> Vuruşlar
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-rose-500" /> Çalma kafası
              </span>
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">
              {fmtDuration(playhead * duration)} / {fmtDuration(duration)}
            </span>
          </div>
        </div>
      )}

      {/* ── BPM Detection result ──────────────────────────────────────── */}
      {analyzing && (
        <div className="flex flex-col gap-3 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin flex-shrink-0" />
            <p className="text-sm text-zinc-400 animate-pulse">BPM tespit ediliyor…</p>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-violet-600 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {result && !analyzing && (
        <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tespit Edilen BPM</p>
            <ConfidenceBadge value={result.confidence} />
          </div>

          {/* BPM display */}
          <div className="flex items-end gap-4">
            <span className="text-5xl font-black text-white tabular-nums leading-none">
              {result.bpm}
            </span>
            <span className="text-lg text-zinc-500 mb-1">BPM</span>
            <span className="text-xs text-zinc-600 mb-1 font-mono">
              {result.beatPositions.length} vuruş
            </span>
          </div>

          {/* Manual override */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500">Manuel Düzeltme</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={60}
                max={200}
                value={manualBPM}
                onChange={(e) => setManualBPM(e.target.value)}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white outline-none focus:border-violet-500 transition-colors"
              />
              <input
                type="range"
                min={60}
                max={200}
                value={Number(manualBPM) || result.bpm}
                onChange={(e) => setManualBPM(e.target.value)}
                className="flex-1 accent-violet-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => applyBPM(effectiveBPM)}
              className={[
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border",
                appliedFlash
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500",
              ].join(" ")}
            >
              {appliedFlash ? "✓ Uygulandı" : `BPM'i Uygula (${effectiveBPM})`}
            </button>

            <button
              onClick={togglePlayback}
              disabled={!bufferRef.current}
              className={[
                "px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors border",
                isPlaying
                  ? "bg-red-600 border-red-500 text-white hover:bg-red-500"
                  : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-violet-500 hover:text-white",
              ].join(" ")}
            >
              {isPlaying ? "■ Durdur" : "▶ Beat ile Çal"}
            </button>
          </div>
        </div>
      )}

      {/* ── BPM History ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-2xl border border-zinc-700">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Son Beatler</p>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setManualBPM(String(item.bpm));
                  applyBPM(item.bpm);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 hover:border-violet-500 hover:bg-violet-500/10 transition-colors group"
              >
                <span className="text-xs text-zinc-300 group-hover:text-white max-w-[120px] truncate">
                  {item.name}
                </span>
                <span className="text-xs font-mono font-bold text-violet-400">{item.bpm}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
