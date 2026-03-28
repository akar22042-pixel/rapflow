"use client";

import { useState, useRef, useEffect } from "react";

interface BeatStudioProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
}

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

export default function BeatStudio({ bpm, onBpmChange }: BeatStudioProps) {
  const [audioUrl, setAudioUrl]       = useState<string | null>(null);
  const [audioName, setAudioName]     = useState<string>("");
  const [ytUrl, setYtUrl]             = useState("");
  const [ytId, setYtId]               = useState<string | null>(null);
  const [ytInput, setYtInput]         = useState("");
  const [isPlaying, setIsPlaying]     = useState(false);
  const [volume, setVolume]           = useState(0.6);
  const [beat, setBeat]               = useState(false); // metronome pulse
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const fileRef   = useRef<HTMLInputElement | null>(null);
  const metroRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync audio volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Metronome
  useEffect(() => {
    if (metroRef.current) clearInterval(metroRef.current);
    const intervalMs = (60 / bpm) * 1000;
    metroRef.current = setInterval(() => {
      setBeat((b) => !b);
    }, intervalMs / 2); // half-beat for on/off pulse
    return () => { if (metroRef.current) clearInterval(metroRef.current); };
  }, [bpm]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name.replace(/\.[^.]+$/, ""));
    setYtId(null);
    setIsPlaying(false);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }

  function handleYtLoad() {
    const id = extractYouTubeId(ytInput);
    if (id) {
      setYtId(id);
      setYtUrl(ytInput);
      setAudioUrl(null);
      setIsPlaying(false);
    }
  }

  function clearBeat() {
    setAudioUrl(null);
    setAudioName("");
    setYtId(null);
    setYtUrl("");
    setYtInput("");
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
  }

  const hasBeat = audioUrl !== null || ytId !== null;

  return (
    <div className="flex flex-col gap-4 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Beat Stüdyosu</p>
          <h3 className="text-sm font-bold text-white">🎧 Beatin Altında Yaz</h3>
        </div>
        {/* Metronome pulse */}
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full transition-all duration-75"
            style={{ backgroundColor: beat ? "#a78bfa" : "#3f3f46", boxShadow: beat ? "0 0 8px #a78bfa" : "none" }}
          />
          <span className="text-[10px] text-zinc-500 font-mono">{bpm} BPM</span>
        </div>
      </div>

      {/* Mini player - shown when beat is loaded */}
      {hasBeat && (
        <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-2.5">
          <span className="text-lg">🎵</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {audioName || (ytId ? "YouTube Beat" : "Beat")}
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
          <button onClick={clearBeat} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">✕</button>
        </div>
      )}

      {/* Volume control */}
      {audioUrl && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
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

      {/* Upload section */}
      {!hasBeat && (
        <div className="flex flex-col gap-3">
          {/* File upload */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">MP3 / WAV Yükle</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 text-xs hover:border-violet-500 hover:text-violet-400 transition-colors"
            >
              🎵 Beat dosyası seç
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.wav,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* YouTube URL */}
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

      {/* BPM control */}
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
