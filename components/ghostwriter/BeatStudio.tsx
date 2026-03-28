"use client";

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// BPM detection — copied from components/beatmatch/BeatMatcher.tsx
// ---------------------------------------------------------------------------
interface DetectionResult {
  bpm: number;
  confidence: number;
}

function detectBPM(buffer: AudioBuffer): DetectionResult {
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(buffer.length, sampleRate * 60);
  const raw        = buffer.getChannelData(0).slice(0, maxSamples);
  const WINDOW     = 512;

  // 1. RMS energy per window
  const energies: number[] = [];
  for (let i = 0; i < raw.length; i += WINDOW) {
    const end = Math.min(i + WINDOW, raw.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += raw[j] * raw[j];
    energies.push(Math.sqrt(sum / (end - i)));
  }

  // 2. Peak picking: energy > 1.3× local average
  const HALF_WIN = Math.ceil(0.5 * sampleRate / WINDOW);
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

  if (filtered.length < 2) return { bpm: 120, confidence: 0 };

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
  if (bpm > 200) bpm = Math.round(bpm / 2);
  if (bpm < 60)  bpm = Math.round(bpm * 2);
  bpm = Math.max(60, Math.min(200, bpm));

  return { bpm, confidence: Math.min(1, bestCount / intervals.length) };
}

// ---------------------------------------------------------------------------
// YouTube helpers
// ---------------------------------------------------------------------------
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface BeatStudioProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
}

export default function BeatStudio({ bpm, onBpmChange }: BeatStudioProps) {
  const [audioUrl, setAudioUrl]     = useState<string | null>(null);
  const [audioName, setAudioName]   = useState<string>("");
  const [ytUrl, setYtUrl]           = useState("");
  const [ytId, setYtId]             = useState<string | null>(null);
  const [ytTitle, setYtTitle]       = useState<string>("");
  const [ytInput, setYtInput]       = useState("");
  const [isPlaying, setIsPlaying]   = useState(false);
  const [volume, setVolume]         = useState(0.6);
  const [beat, setBeat]             = useState(false);
  const [detecting, setDetecting]   = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const fileRef   = useRef<HTMLInputElement | null>(null);
  const metroRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync audio volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Metronome pulse
  useEffect(() => {
    if (metroRef.current) clearInterval(metroRef.current);
    const intervalMs = (60 / bpm) * 1000;
    metroRef.current = setInterval(() => setBeat((b) => !b), intervalMs / 2);
    return () => { if (metroRef.current) clearInterval(metroRef.current); };
  }, [bpm]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 5000);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name.replace(/\.[^.]+$/, ""));
    setYtId(null);
    setYtTitle("");
    setIsPlaying(false);

    // Auto BPM detection via Web Audio API
    setDetecting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      await ctx.close();
      const result = detectBPM(audioBuffer);
      onBpmChange(result.bpm);
      showToast(`BPM otomatik algılandı: ${result.bpm}`);
    } catch {
      showToast("BPM algılanamadı — manuel ayarla");
    } finally {
      setDetecting(false);
    }
  }

  async function handleYtLoad() {
    const id = extractYouTubeId(ytInput);
    if (!id) return;
    setYtId(id);
    setYtUrl(ytInput);
    setAudioUrl(null);
    setIsPlaying(false);

    // Fetch video title via YouTube oEmbed (CORS-safe, no auth needed)
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        setYtTitle(data.title ?? "");
      }
    } catch { /* title unavailable */ }
  }

  async function estimateYtBPM() {
    const titleToUse = ytTitle || ytUrl;
    if (!titleToUse) return;
    setEstimating(true);
    try {
      const res = await fetch("/api/detect-bpm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleToUse }),
      });
      const data = await res.json();
      if (data.bpm) {
        onBpmChange(data.bpm);
        showToast(`BPM tahmini: ~${data.bpm} (YouTube'dan kesin algılama yapılamaz)`);
      }
    } catch {
      showToast("BPM tahmini başarısız");
    } finally {
      setEstimating(false);
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  }

  function clearBeat() {
    setAudioUrl(null);
    setAudioName("");
    setYtId(null);
    setYtUrl("");
    setYtInput("");
    setYtTitle("");
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
  }

  const hasBeat = audioUrl !== null || ytId !== null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
      {/* Header + metronome */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Beat Stüdyosu</p>
          <h3 className="text-sm font-bold text-white">🎧 Beatin Altında Yaz</h3>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full transition-all duration-75"
            style={{ backgroundColor: beat ? "#a78bfa" : "#3f3f46", boxShadow: beat ? "0 0 8px #a78bfa" : "none" }}
          />
          <span className="text-[10px] text-zinc-500 font-mono">{bpm} BPM</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
          <p className="text-xs text-emerald-400">{toast}</p>
        </div>
      )}

      {/* BPM detecting spinner */}
      {detecting && (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
          <p className="text-xs text-zinc-400 animate-pulse">BPM algılanıyor...</p>
        </div>
      )}

      {/* Mini player */}
      {hasBeat && (
        <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2.5">
          <span className="text-lg">🎵</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {audioName || ytTitle || (ytId ? "YouTube Beat" : "Beat")}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">{ytUrl || audioName}</p>
          </div>
          {audioUrl && (
            <button
              onClick={togglePlay}
              className="px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
          {ytId && (
            <button
              onClick={estimateYtBPM}
              disabled={estimating}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:border-violet-500 hover:text-white transition-colors disabled:opacity-40"
            >
              {estimating ? "..." : "🎵 BPM Algıla"}
            </button>
          )}
          <button onClick={clearBeat} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">✕</button>
        </div>
      )}

      {/* Volume */}
      {audioUrl && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">🔈</span>
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-violet-500 h-1"
          />
          <span className="text-[10px] text-zinc-500 font-mono w-8">{Math.round(volume * 100)}%</span>
        </div>
      )}

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          loop
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      )}

      {/* Upload / YouTube input (only when no beat loaded) */}
      {!hasBeat && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">MP3 / WAV Yükle</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 text-xs hover:border-violet-500 hover:text-violet-400 transition-colors"
            >
              🎵 Beat dosyası seç (BPM otomatik algılanır)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.wav,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">YouTube Beat</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder="YouTube URL yapıştır..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-violet-500 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") handleYtLoad(); }}
              />
              <button
                onClick={handleYtLoad}
                disabled={!ytInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:border-violet-500 hover:text-white transition-colors disabled:opacity-40"
              >
                Yükle
              </button>
            </div>
            <p className="text-[9px] text-zinc-600 mt-1">Yükledikten sonra "BPM Algıla" ile tahmini BPM hesaplanır (~)</p>
          </div>
        </div>
      )}

      {/* YouTube embed */}
      {ytId && (
        <div className="rounded-xl overflow-hidden border border-zinc-700">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=0&controls=1`}
            width="100%"
            height="160"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full"
            style={{ border: "none" }}
          />
        </div>
      )}

      {/* BPM slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tempo</p>
          <span className="text-[10px] font-mono text-violet-300">{bpm} BPM</span>
        </div>
        <input
          type="range"
          min={60}
          max={200}
          value={bpm}
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
          className="w-full accent-violet-500 h-1"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-zinc-600">60</span>
          <span className="text-[9px] text-zinc-600">130</span>
          <span className="text-[9px] text-zinc-600">200</span>
        </div>
      </div>
    </div>
  );
}
