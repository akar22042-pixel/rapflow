"use client";

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// BPM detection — from BeatMatcher.tsx
// ---------------------------------------------------------------------------
function detectBPM(buffer: AudioBuffer): { bpm: number; confidence: number } {
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(buffer.length, sampleRate * 60);
  const raw        = buffer.getChannelData(0).slice(0, maxSamples);
  const WINDOW     = 512;

  const energies: number[] = [];
  for (let i = 0; i < raw.length; i += WINDOW) {
    const end = Math.min(i + WINDOW, raw.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += raw[j] * raw[j];
    energies.push(Math.sqrt(sum / (end - i)));
  }

  const HALF_WIN = Math.ceil(0.5 * sampleRate / WINDOW);
  const peaks: number[] = [];
  for (let i = 0; i < energies.length; i++) {
    const lo = Math.max(0, i - HALF_WIN);
    const hi = Math.min(energies.length, i + HALF_WIN);
    let localSum = 0;
    for (let j = lo; j < hi; j++) localSum += energies[j];
    if (energies[i] > (localSum / (hi - lo)) * 1.3) peaks.push(i);
  }

  const MIN_GAP = Math.ceil(0.3 * sampleRate / WINDOW);
  const filtered: number[] = [];
  let last = -Infinity;
  for (const p of peaks) {
    if (p - last > MIN_GAP) { filtered.push(p); last = p; }
  }

  if (filtered.length < 2) return { bpm: 120, confidence: 0 };

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
// Types
// ---------------------------------------------------------------------------
export interface MatchingSong {
  artist: string;
  title: string;
  bpm: number;
  flowDescription: string;
  whyItFits: string;
  flowPattern: string;
  syllablePattern: number[];
  keyTechniques: string[];
}

export interface SelectedFlow {
  artist: string;
  title: string;
  flowDescription: string;
  flowPattern: string;
  syllablePattern: number[];
  keyTechniques: string[];
}

interface BeatAnalysis {
  mood: {
    type: string;
    energy: "low" | "mid" | "high";
    subgenre: string;
    moodDescription: string;
  };
  matchingSongs: MatchingSong[];
  recommendedFlow: string;
}

const MOOD_META: Record<string, { emoji: string; color: string }> = {
  melankolik: { emoji: "🌙", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
  agresif:    { emoji: "🔥", color: "bg-red-500/20 border-red-500/40 text-red-300" },
  trap:       { emoji: "💎", color: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
  drill:      { emoji: "🔫", color: "bg-zinc-500/20 border-zinc-400/40 text-zinc-300" },
  "boom-bap": { emoji: "🥁", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
  afrobeat:   { emoji: "🌍", color: "bg-green-500/20 border-green-500/40 text-green-300" },
  dark:       { emoji: "🖤", color: "bg-zinc-600/20 border-zinc-500/40 text-zinc-300" },
  uplifting:  { emoji: "☀️", color: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" },
  romantic:   { emoji: "💜", color: "bg-pink-500/20 border-pink-500/40 text-pink-300" },
  street:     { emoji: "🏙️", color: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
};

const ENERGY_LABEL: Record<string, string> = { low: "Düşük", mid: "Orta", high: "Yüksek" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface BeatStudioProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  onFlowSelect: (flow: SelectedFlow | null) => void;
  selectedFlow: SelectedFlow | null;
}

export default function BeatStudio({ bpm, onBpmChange, onFlowSelect, selectedFlow }: BeatStudioProps) {
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

  // Beat analysis
  const [analysis, setAnalysis]     = useState<BeatAnalysis | null>(null);
  const [analyzing, setAnalyzing]   = useState(false);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const fileRef   = useRef<HTMLInputElement | null>(null);
  const metroRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Beat analysis API call
  async function runBeatAnalysis(detectedBpm: number, title?: string) {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/beat-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bpm: detectedBpm,
          youtubeTitle: title || audioName || undefined,
          youtubeUrl: ytUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.mood && data.matchingSongs) {
        setAnalysis(data);
      }
    } catch { /* silent */ }
    finally { setAnalyzing(false); }
  }

  // ── File upload with BPM detection + auto-analysis
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "");
    setAudioUrl(url);
    setAudioName(name);
    setYtId(null);
    setYtTitle("");
    setIsPlaying(false);
    setAnalysis(null);
    onFlowSelect(null);

    setDetecting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      await ctx.close();
      const result = detectBPM(audioBuffer);
      onBpmChange(result.bpm);
      showToast(`BPM otomatik algılandı: ${result.bpm}`);
      // Auto-run beat analysis
      runBeatAnalysis(result.bpm, name);
    } catch {
      showToast("BPM algılanamadı — manuel ayarla");
    } finally {
      setDetecting(false);
    }
  }

  // ── YouTube load + title fetch
  async function handleYtLoad() {
    const id = extractYouTubeId(ytInput);
    if (!id) return;
    setYtId(id);
    setYtUrl(ytInput);
    setAudioUrl(null);
    setIsPlaying(false);
    setAnalysis(null);
    onFlowSelect(null);

    let title = "";
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        title = data.title ?? "";
        setYtTitle(title);
      }
    } catch { /* title unavailable */ }
  }

  // ── YouTube BPM estimation + auto-analysis
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
        showToast(`BPM tahmini: ~${data.bpm}`);
        // Auto-run beat analysis with detected BPM and title
        runBeatAnalysis(data.bpm, ytTitle);
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
    setAnalysis(null);
    onFlowSelect(null);
    if (audioRef.current) audioRef.current.pause();
  }

  function selectSongFlow(song: MatchingSong) {
    onFlowSelect({
      artist: song.artist,
      title: song.title,
      flowDescription: song.flowDescription,
      flowPattern: song.flowPattern,
      syllablePattern: song.syllablePattern,
      keyTechniques: song.keyTechniques,
    });
    showToast(`🎵 ${song.artist} - ${song.title} flowu aktif`);
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

      {/* Active flow banner */}
      {selectedFlow && (
        <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-xl px-3 py-2">
          <span className="text-sm">🎵</span>
          <p className="flex-1 text-xs text-violet-300 font-semibold">
            {selectedFlow.artist} - {selectedFlow.title} flowu aktif
          </p>
          <button onClick={() => onFlowSelect(null)} className="text-zinc-500 hover:text-red-400 text-[10px] transition-colors">✕</button>
        </div>
      )}

      {/* Mini player */}
      {hasBeat && (
        <div className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5">
          <span className="text-lg">🎵</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {audioName || ytTitle || (ytId ? "YouTube Beat" : "Beat")}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">{ytUrl || audioName}</p>
          </div>
          {audioUrl && (
            <button onClick={togglePlay}
              className="px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors">
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
          {ytId && !analysis && (
            <button onClick={estimateYtBPM} disabled={estimating}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:border-violet-500 hover:text-white transition-colors disabled:opacity-40">
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
          <input type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-violet-500 h-1" />
          <span className="text-[10px] text-zinc-500 font-mono w-8">{Math.round(volume * 100)}%</span>
        </div>
      )}

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} loop
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)} />
      )}

      {/* Upload / YouTube input */}
      {!hasBeat && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">MP3 / WAV Yükle</p>
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 text-xs hover:border-violet-500 hover:text-violet-400 transition-colors">
              🎵 Beat dosyası seç (BPM + flow otomatik algılanır)
            </button>
            <input ref={fileRef} type="file" accept=".mp3,.wav,audio/*"
              onChange={handleFileUpload} className="hidden" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">YouTube Beat</p>
            <div className="flex gap-2">
              <input type="text" value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder="YouTube URL yapıştır..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-violet-500 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") handleYtLoad(); }} />
              <button onClick={handleYtLoad} disabled={!ytInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:border-violet-500 hover:text-white transition-colors disabled:opacity-40">
                Yükle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube embed */}
      {ytId && (
        <div className="rounded-xl overflow-hidden border border-zinc-700">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=0&controls=1`}
            width="100%" height="160"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen className="w-full" style={{ border: "none" }} />
        </div>
      )}

      {/* ── Beat Analysis ──────────────────────────────────────────── */}
      {analyzing && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
          <p className="text-xs text-zinc-400 animate-pulse">Beat analiz ediliyor — mood ve eşleşen flowlar bulunuyor...</p>
        </div>
      )}

      {analysis && (
        <div className="flex flex-col gap-3">
          {/* Mood card */}
          <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Beat Analizi</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={["text-xs font-semibold px-2.5 py-1 rounded-full border",
                MOOD_META[analysis.mood.type]?.color ?? "bg-zinc-700 border-zinc-600 text-zinc-300"
              ].join(" ")}>
                {MOOD_META[analysis.mood.type]?.emoji ?? "🎵"} {analysis.mood.type}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700 border border-zinc-600 text-zinc-400">
                Enerji: {ENERGY_LABEL[analysis.mood.energy] ?? analysis.mood.energy}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700 border border-zinc-600 text-zinc-400">
                {analysis.mood.subgenre}
              </span>
            </div>
            <p className="text-xs text-zinc-400 italic mt-2">{analysis.mood.moodDescription}</p>
          </div>

          {/* Matching songs */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Bu Beate Uyan Flowlar</p>
            {analysis.matchingSongs.map((song, i) => {
              const isSelected = selectedFlow?.artist === song.artist && selectedFlow?.title === song.title;
              return (
                <div key={i} className={["flex flex-col gap-2 border rounded-xl p-3 transition-all",
                  isSelected
                    ? "bg-violet-950/30 border-violet-500/40 ring-1 ring-violet-500/20"
                    : "bg-zinc-800/40 border-zinc-700/60",
                ].join(" ")}>
                  {/* Song header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{song.artist} — {song.title}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">{song.bpm} BPM</p>
                    </div>
                    <button
                      onClick={() => isSelected ? onFlowSelect(null) : selectSongFlow(song)}
                      className={["px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0",
                        isSelected
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white",
                      ].join(" ")}
                    >
                      {isSelected ? "✓ Aktif" : "Bu Flowu Kullan"}
                    </button>
                  </div>

                  {/* Flow pattern */}
                  <div className="bg-zinc-900/60 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Ritim Kalıbı</p>
                    <p className="text-sm font-mono text-violet-300">{song.flowPattern}</p>
                    {song.syllablePattern.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {song.syllablePattern.map((s, j) => (
                          <div key={j} className="flex items-center gap-0.5">
                            {Array.from({ length: s }).map((_, k) => (
                              <div key={k} className="w-1.5 h-1.5 rounded-full bg-violet-500/60" />
                            ))}
                            {j < song.syllablePattern.length - 1 && (
                              <div className="w-1 h-1 rounded-full bg-zinc-700 mx-0.5" />
                            )}
                          </div>
                        ))}
                        <span className="text-[9px] text-zinc-600 ml-1 font-mono">
                          [{song.syllablePattern.join("-")}]
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Techniques */}
                  <div className="flex flex-wrap gap-1">
                    {song.keyTechniques.map((t) => (
                      <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-700/60 border border-zinc-600/60 text-zinc-400">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{song.whyItFits}</p>
                </div>
              );
            })}

            {/* Recommendation */}
            {analysis.recommendedFlow && (
              <p className="text-[11px] text-violet-400 italic px-1">{analysis.recommendedFlow}</p>
            )}
          </div>
        </div>
      )}

      {/* BPM slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tempo</p>
          <span className="text-[10px] font-mono text-violet-300">{bpm} BPM</span>
        </div>
        <input type="range" min={60} max={200} value={bpm}
          onChange={(e) => onBpmChange(parseInt(e.target.value))}
          className="w-full accent-violet-500 h-1" />
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-zinc-600">60</span>
          <span className="text-[9px] text-zinc-600">130</span>
          <span className="text-[9px] text-zinc-600">200</span>
        </div>
      </div>

      {/* Re-analyze button when beat is loaded but no analysis yet */}
      {hasBeat && !analysis && !analyzing && !detecting && !estimating && (
        <button
          onClick={() => runBeatAnalysis(bpm, ytTitle || audioName)}
          className="w-full py-2 rounded-xl text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-white transition-colors"
        >
          🔍 Beat Analiz Et — Mood & Eşleşen Flowlar
        </button>
      )}
    </div>
  );
}
