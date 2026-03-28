"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useMusicContext } from "@/lib/MusicContext";
import LyricsStats from "./LyricsStats";

// ---------------------------------------------------------------------------
// Turkish syllable counting — count vowels
// ---------------------------------------------------------------------------
const TURKISH_VOWELS = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü"]);

function countSyllablesTR(word: string): number {
  return [...word.toLowerCase()].filter((c) => TURKISH_VOWELS.has(c)).length;
}

function countLineSyllables(line: string): number {
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, w) => sum + countSyllablesTR(w), 0);
}

// ---------------------------------------------------------------------------
// Rhyme scheme detection
// ---------------------------------------------------------------------------
function lastWord(line: string): string {
  const words = line.trim().split(/\s+/);
  return words[words.length - 1]?.replace(/[.,!?;:'"…-]+$/, "").toLowerCase() ?? "";
}

function rhymeSuffix(word: string, chars = 3): string {
  if (word.length < chars) return word;
  return word.slice(-chars);
}

const RHYME_GROUPS = [
  { rowBg: "bg-violet-500/15 border-l-2 border-violet-500",  pill: "bg-violet-500 text-white"  },
  { rowBg: "bg-emerald-500/15 border-l-2 border-emerald-500", pill: "bg-emerald-500 text-white" },
  { rowBg: "bg-amber-500/15 border-l-2 border-amber-500",    pill: "bg-amber-500 text-white"   },
  { rowBg: "bg-rose-500/15 border-l-2 border-rose-500",      pill: "bg-rose-500 text-white"    },
  { rowBg: "bg-cyan-500/15 border-l-2 border-cyan-500",      pill: "bg-cyan-500 text-white"    },
  { rowBg: "bg-orange-500/15 border-l-2 border-orange-500",  pill: "bg-orange-500 text-white"  },
] as const;

const RHYME_LETTER = ["A", "B", "C", "D", "E", "F"] as const;

function buildRhymeMap(lines: string[]): Map<number, number> {
  const suffixGroup = new Map<string, number>();
  const lineGroup   = new Map<number, number>();
  let nextGroup = 0;

  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const w = lastWord(line);
    if (!w) return;
    const s = rhymeSuffix(w);
    if (!suffixGroup.has(s)) suffixGroup.set(s, -1);
    lineGroup.set(i, -1);
  });

  const suffixLines = new Map<string, number[]>();
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const s = rhymeSuffix(lastWord(line));
    if (!suffixLines.has(s)) suffixLines.set(s, []);
    suffixLines.get(s)!.push(i);
  });

  suffixLines.forEach((indices) => {
    if (indices.length < 2) return;
    const gIdx = nextGroup % RHYME_GROUPS.length;
    nextGroup++;
    indices.forEach((i) => lineGroup.set(i, gIdx));
  });

  return lineGroup;
}

// ---------------------------------------------------------------------------
// Syllable count badge color
// ---------------------------------------------------------------------------
function syllableColor(count: number, target: number): string {
  if (count === 0) return "text-zinc-600";
  const ratio = count / target;
  if (ratio >= 0.85 && ratio <= 1.15) return "text-emerald-400";
  if (ratio >= 0.65 && ratio <= 1.35) return "text-amber-400";
  return "text-red-400";
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
const LS_PROJECTS  = "rapflow_projects";
const LS_AUTOSAVE  = "rapflow_autosave";
const AUTOSAVE_INTERVAL_MS = 30_000;
const AUTOSAVE_STALE_MS    = 5 * 60 * 1000; // 5 minutes

interface SavedProject {
  id: string;
  title: string;
  lyrics: string;
  bpm: number;
  style: string;
  date: string; // ISO string
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Popover — rhyme / complete suggestions
// ---------------------------------------------------------------------------
interface RhymeSuggestion {
  word: string;
  matchingSyllables: number;
}

interface Popover {
  type: "rhyme" | "complete";
  suggestions?: RhymeSuggestion[];
  sourceWord?: string;
  line?: string;
  syllableCount?: number;
  rhymesWith?: string;
}

function SuggestionPopover({
  popover,
  onInsert,
  onClose,
}: {
  popover: Popover;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 right-0 top-full mt-2 w-72 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl p-3 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 uppercase tracking-widest">
          {popover.type === "rhyme"
            ? `Kafiyeler → "${popover.sourceWord}"`
            : "Satır Tamamlama"}
        </span>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs">✕</button>
      </div>

      {popover.type === "rhyme" && popover.suggestions && (
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
          {popover.suggestions.length === 0 ? (
            <span className="text-xs text-zinc-500 py-2 text-center">Kafiye bulunamadı</span>
          ) : (
            popover.suggestions.map((s) => (
              <button
                key={s.word}
                onClick={() => onInsert(s.word)}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-violet-700 text-left transition-colors group"
              >
                <span className="text-sm text-white font-medium">{s.word}</span>
                <span className="text-xs text-zinc-400 group-hover:text-violet-200">{s.matchingSyllables} hece</span>
              </button>
            ))
          )}
        </div>
      )}

      {popover.type === "complete" && popover.line && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onInsert(popover.line!)}
            className="w-full text-left px-3 py-2 rounded-lg bg-zinc-700 hover:bg-violet-700 transition-colors"
          >
            <p className="text-sm text-white leading-snug">{popover.line}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-zinc-400">{popover.syllableCount} hece</span>
              {popover.rhymesWith && (
                <span className="text-xs text-violet-300">↩ "{popover.rhymesWith}" ile kafiyeli</span>
              )}
            </div>
          </button>
          <p className="text-xs text-zinc-500 text-center">Eklemek için tıkla</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save title input inline
// ---------------------------------------------------------------------------
function SaveDialog({
  onSave,
  onCancel,
}: {
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="flex items-center gap-2 p-3 bg-zinc-800 border border-zinc-600 rounded-xl">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) onSave(title.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Proje adı…"
        className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
      />
      <button
        onClick={() => title.trim() && onSave(title.trim())}
        disabled={!title.trim()}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Kaydet
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
      >
        İptal
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Load modal
// ---------------------------------------------------------------------------
function LoadModal({
  projects,
  onLoad,
  onDelete,
  onClose,
}: {
  projects: SavedProject[];
  onLoad: (p: SavedProject) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        ref={ref}
        className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-bold text-white">Kayıtlı Projeler</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm">✕</button>
        </div>

        {/* List */}
        <div className="flex flex-col gap-1 overflow-y-auto p-3">
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">Henüz kayıt yok</p>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors group"
              >
                <button
                  onClick={() => { onLoad(p); onClose(); }}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-medium text-white truncate">{p.title}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500 font-mono">{p.bpm} BPM</span>
                    <span className="text-[10px] text-zinc-600">{p.style}</span>
                    <span className="text-[10px] text-zinc-600">
                      {new Date(p.date).toLocaleDateString("tr-TR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => onDelete(p.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs"
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Autosave toast
// ---------------------------------------------------------------------------
function AutosaveToast({
  onLoad,
  onDismiss,
}: {
  onLoad: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-zinc-800 border border-violet-500/40 rounded-xl text-sm">
      <span className="text-zinc-300">💾 Otomatik kayıt bulundu — yükle?</span>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onLoad}
          className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          Evet
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
        >
          Hayır
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LyricsEditor() {
  const { currentBPM, targetSyllables, currentStyle, setCurrentLyrics, pendingLines, setPendingLines } =
    useMusicContext();

  const [text, setText]               = useState("");
  const [loadingRhyme, setLoadingRhyme]       = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [popover, setPopover]         = useState<Popover | null>(null);
  const [error, setError]             = useState<string | null>(null);

  // Save/load UI state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadModal, setShowLoadModal]   = useState(false);
  const [projects, setProjects]             = useState<SavedProject[]>([]);
  const [showAutosaveToast, setShowAutosaveToast] = useState(false);
  const [savedFlash, setSavedFlash]         = useState(false);
  const [showGhostToast, setShowGhostToast] = useState(false);

  const textareaRef       = useRef<HTMLTextAreaElement>(null);
  const popoverAnchorRef  = useRef<HTMLDivElement>(null);
  const autosaveTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for autosave closure
  const textRef       = useRef(text);
  const bpmRef        = useRef(currentBPM);
  const styleRef      = useRef(currentStyle);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => { bpmRef.current = currentBPM; }, [currentBPM]);
  useEffect(() => { styleRef.current = currentStyle; }, [currentStyle]);

  const lines    = useMemo(() => text.split("\n"), [text]);
  const rhymeMap = useMemo(() => buildRhymeMap(lines), [lines]);

  const rhymeScheme = useMemo(() =>
    lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => line.trim())
      .map(({ i }) => {
        const g = rhymeMap.get(i) ?? -1;
        return g >= 0 ? { letter: RHYME_LETTER[g], groupIdx: g } : null;
      }),
    [lines, rhymeMap]
  );

  // ── Sync lyrics to context
  useEffect(() => { setCurrentLyrics(text); }, [text, setCurrentLyrics]);

  // ── Consume pendingLines from GhostWriter — append, clear, show toast
  useEffect(() => {
    if (pendingLines.length === 0) return;
    setText((prev) => {
      const trimmed = prev.endsWith("\n") || prev === "" ? prev : prev + "\n";
      return trimmed + pendingLines.join("\n");
    });
    setPendingLines([]);
    setShowGhostToast(true);
    setTimeout(() => setShowGhostToast(false), 2000);
  }, [pendingLines, setPendingLines]);

  // ── Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [text]);

  // ── On mount: load projects + check autosave
  useEffect(() => {
    setProjects(lsGet<SavedProject[]>(LS_PROJECTS) ?? []);

    const autosave = lsGet<{ lyrics: string; bpm: number; style: string; date: string }>(LS_AUTOSAVE);
    if (autosave && autosave.lyrics.trim()) {
      const age = Date.now() - new Date(autosave.date).getTime();
      if (age < AUTOSAVE_STALE_MS) setShowAutosaveToast(true);
    }
  }, []);

  // ── Autosave every 30 seconds
  useEffect(() => {
    autosaveTimerRef.current = setInterval(() => {
      if (!textRef.current.trim()) return;
      lsSet(LS_AUTOSAVE, {
        lyrics: textRef.current,
        bpm: bpmRef.current,
        style: styleRef.current,
        date: new Date().toISOString(),
      });
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, []);

  // ── Save project
  const saveProject = useCallback((title: string) => {
    const newProject: SavedProject = {
      id: `${Date.now()}`,
      title,
      lyrics: textRef.current,
      bpm: bpmRef.current,
      style: styleRef.current,
      date: new Date().toISOString(),
    };
    const updated = [newProject, ...lsGet<SavedProject[]>(LS_PROJECTS) ?? []];
    lsSet(LS_PROJECTS, updated);
    setProjects(updated);
    setShowSaveDialog(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }, []);

  // ── Delete project
  const deleteProject = useCallback((id: string) => {
    const updated = (lsGet<SavedProject[]>(LS_PROJECTS) ?? []).filter((p) => p.id !== id);
    lsSet(LS_PROJECTS, updated);
    setProjects(updated);
  }, []);

  // ── Load project
  const loadProject = useCallback((p: SavedProject) => {
    setText(p.lyrics);
  }, []);

  // ── Load autosave
  const loadAutosave = useCallback(() => {
    const autosave = lsGet<{ lyrics: string }>(LS_AUTOSAVE);
    if (autosave?.lyrics) setText(autosave.lyrics);
    lsRemove(LS_AUTOSAVE);
    setShowAutosaveToast(false);
  }, []);

  // ── Open load modal (refresh list)
  const openLoadModal = useCallback(() => {
    setProjects(lsGet<SavedProject[]>(LS_PROJECTS) ?? []);
    setShowLoadModal(true);
  }, []);

  // ------------------------------------------------------------------
  // Last non-empty line
  // ------------------------------------------------------------------
  const lastNonEmptyLine = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim()) return lines[i];
    }
    return "";
  }, [lines]);

  // ------------------------------------------------------------------
  // API calls
  // ------------------------------------------------------------------
  async function callApi(mode: "rhyme" | "complete") {
    if (!lastNonEmptyLine) return;
    setError(null);

    if (mode === "rhyme") setLoadingRhyme(true);
    else setLoadingComplete(true);

    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, bpm: currentBPM, style: currentStyle, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (mode === "rhyme") {
        const word  = lastWord(lastNonEmptyLine);
        const match = data.suggestions?.find((s: { word: string }) => s.word === word)
          ?? data.suggestions?.[0];
        setPopover({ type: "rhyme", suggestions: match?.rhymes ?? [], sourceWord: word });
      } else {
        setPopover({
          type: "complete",
          line: data.line,
          syllableCount: data.syllableCount,
          rhymesWith: data.rhymesWith,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setLoadingRhyme(false);
      setLoadingComplete(false);
    }
  }

  // ------------------------------------------------------------------
  // Insert suggestion
  // ------------------------------------------------------------------
  const insertSuggestion = useCallback(
    (suggestion: string) => {
      setPopover(null);
      const ta = textareaRef.current;
      if (!ta) return;

      if (popover?.type === "rhyme") {
        const newLines = [...lines];
        for (let i = newLines.length - 1; i >= 0; i--) {
          if (newLines[i].trim()) {
            newLines[i] = newLines[i].trimEnd() + " " + suggestion;
            break;
          }
        }
        setText(newLines.join("\n"));
      } else {
        setText((prev) => {
          const trimmed = prev.endsWith("\n") ? prev : prev + "\n";
          return trimmed + suggestion;
        });
      }

      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }, 0);
    },
    [lines, popover]
  );

  // ------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------
  const totalSyllables = useMemo(
    () => lines.reduce((s, l) => s + countLineSyllables(l), 0),
    [lines]
  );
  const totalLines    = lines.filter((l) => l.trim()).length;
  const avgSyllables  = totalLines > 0 ? Math.round(totalSyllables / totalLines) : 0;

  // ------------------------------------------------------------------
  // PDF export
  // ------------------------------------------------------------------
  const exportPDF = useCallback(() => {
    const title = "RapFlow — Şarkı Sözleri";
    const content = lines
      .map((line, i) => {
        const syl = countLineSyllables(line);
        const num = String(i + 1).padStart(2, "0");
        return `<tr><td class="num">${num}</td><td class="line">${line || "&nbsp;"}</td><td class="syl">${line.trim() ? syl : ""}</td></tr>`;
      })
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Courier New', monospace; background: #fff; color: #111; margin: 40px; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  .meta { font-size: 0.8rem; color: #666; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; }
  tr { border-bottom: 1px solid #eee; }
  td { padding: 4px 8px; vertical-align: top; }
  .num { color: #aaa; font-size: 0.75rem; width: 32px; text-align: right; padding-right: 12px; }
  .line { font-size: 1rem; }
  .syl { color: #888; font-size: 0.75rem; width: 32px; text-align: right; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Hedef: ${targetSyllables} hece/satır &nbsp;|&nbsp; Toplam satır: ${totalLines} &nbsp;|&nbsp; Ort. hece: ${avgSyllables}</div>
<table>${content}</table>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }, [lines, targetSyllables, totalLines, avgSyllables]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4 p-6 bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-2xl mx-auto">

      {/* Autosave toast */}
      {showAutosaveToast && (
        <AutosaveToast
          onLoad={loadAutosave}
          onDismiss={() => { lsRemove(LS_AUTOSAVE); setShowAutosaveToast(false); }}
        />
      )}

      {/* Load modal */}
      {showLoadModal && (
        <LoadModal
          projects={projects}
          onLoad={loadProject}
          onDelete={deleteProject}
          onClose={() => setShowLoadModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-white tracking-wide">Söz Editörü</h2>
        <div className="flex items-center gap-2">
          {/* Stats mini */}
          <div className="hidden sm:flex gap-3 text-xs text-zinc-500 font-mono">
            <span>hedef: <span className="text-violet-400">{targetSyllables}</span> hece/beat</span>
            <span>ort: <span className="text-zinc-300">{avgSyllables}</span></span>
            <span>satır: <span className="text-zinc-300">{totalLines}</span></span>
          </div>
          {/* Save/load buttons */}
          <button
            onClick={() => setShowSaveDialog((v) => !v)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
              savedFlash
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white",
            ].join(" ")}
          >
            {savedFlash ? "✓ Kaydedildi" : "💾 Kaydet"}
          </button>
          <button
            onClick={openLoadModal}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white transition-colors"
          >
            📂 Yükle
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-white transition-colors"
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <SaveDialog
          onSave={saveProject}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}

      {/* Editor area */}
      <div className="relative flex rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden">

        {/* Left sidebar — hidden on mobile */}
        <div className="hidden sm:flex flex-col min-w-0 flex-shrink-0 border-r border-zinc-800 select-none">
          {lines.map((line, i) => {
            const count      = countLineSyllables(line);
            const rhymeGroup = rhymeMap.get(i) ?? -1;
            return (
              <div
                key={i}
                className={[
                  "flex items-center justify-end px-2 h-7 min-h-7",
                  rhymeGroup >= 0 ? RHYME_GROUPS[rhymeGroup].rowBg : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-xs font-mono w-5 text-right",
                    line.trim() ? syllableColor(count, targetSyllables) : "text-zinc-700",
                  ].join(" ")}
                >
                  {line.trim() ? count : "·"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Sözlerini buraya yaz…\nHer satır bir çizgidir."}
          spellCheck={false}
          className={[
            "flex-1 bg-transparent text-zinc-100 text-sm font-mono",
            "px-3 py-1 resize-none outline-none leading-7",
            "placeholder:text-zinc-700 min-h-[168px]",
          ].join(" ")}
          style={{ lineHeight: "1.75rem" }}
        />

        {/* Right sidebar */}
        <div className="flex flex-col flex-shrink-0 border-l border-zinc-800 select-none">
          {lines.map((line, i) => {
            const count      = countLineSyllables(line);
            const rhymeGroup = rhymeMap.get(i) ?? -1;
            return (
              <div
                key={i}
                className={[
                  "flex items-center justify-center px-1.5 h-7 min-h-7",
                  rhymeGroup >= 0 ? RHYME_GROUPS[rhymeGroup].rowBg : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "sm:hidden text-xs font-mono w-5 text-right",
                    line.trim() ? syllableColor(count, targetSyllables) : "text-zinc-700",
                  ].join(" ")}
                >
                  {line.trim() ? count : "·"}
                </span>
                {rhymeGroup >= 0 && line.trim() && (
                  <span
                    className={[
                      "hidden sm:inline text-[10px] font-black px-1 py-0 rounded leading-4",
                      RHYME_GROUPS[rhymeGroup].pill,
                    ].join(" ")}
                  >
                    {RHYME_LETTER[rhymeGroup]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rhyme scheme summary bar */}
      {rhymeScheme.some(Boolean) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Kafiye Şeması</span>
          <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1">
            {rhymeScheme.map((item, i) =>
              item ? (
                <span
                  key={i}
                  className={["px-2 py-0.5 rounded-full text-xs font-bold", RHYME_GROUPS[item.groupIdx].pill].join(" ")}
                >
                  {item.letter}
                </span>
              ) : (
                <span key={i} className="px-2 py-0.5 text-xs text-zinc-600">·</span>
              )
            )}
          </div>
        </div>
      )}

      {/* Color legend */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ±15%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> ±35%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Fazla/Az</span>
      </div>

      {/* Action buttons + popover anchor */}
      <div ref={popoverAnchorRef} className="relative flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => callApi("rhyme")}
          disabled={loadingRhyme || !lastNonEmptyLine}
          className={[
            "flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
            loadingRhyme || !lastNonEmptyLine
              ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
              : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-violet-500 hover:text-white",
          ].join(" ")}
        >
          {loadingRhyme ? "Yükleniyor…" : "🎵 Kafiye Öner"}
        </button>

        <button
          onClick={() => callApi("complete")}
          disabled={loadingComplete || !lastNonEmptyLine}
          className={[
            "flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border",
            loadingComplete || !lastNonEmptyLine
              ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed"
              : "bg-violet-600 border-violet-500 text-white hover:bg-violet-500",
          ].join(" ")}
        >
          {loadingComplete ? "Yükleniyor…" : "✍️ Satır Tamamla"}
        </button>

        {popover && (
          <SuggestionPopover
            popover={popover}
            onInsert={insertSuggestion}
            onClose={() => setPopover(null)}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Ghost Writer toast */}
      {showGhostToast && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950 border border-emerald-700 rounded-xl text-sm text-emerald-300 animate-pulse">
          👻 Ghost Writer&apos;dan eklendi ✓
        </div>
      )}

      {/* Stats */}
      <LyricsStats
        lines={lines}
        bpm={currentBPM}
        syllablesPerBeat={targetSyllables}
      />
    </div>
  );
}
