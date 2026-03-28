"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import { useMusicContext } from "@/lib/MusicContext";

// ---------------------------------------------------------------------------
// Types matching Supabase tables
// ---------------------------------------------------------------------------
interface CypherRoom {
  id: string;
  name: string;
  bpm: number;
  style: string;
  is_active: boolean;
  created_at: string;
  line_count?: number;
}

interface CypherLine {
  id: string;
  room_id: string;
  username: string;
  content: string;
  syllable_count: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const LS_USERNAME = "rapflow_username";

function loadUsername(): string {
  try { return localStorage.getItem(LS_USERNAME) ?? ""; } catch { return ""; }
}
function saveUsername(u: string): void {
  try { localStorage.setItem(LS_USERNAME, u); } catch { /* ignore */ }
}

function countSyllables(text: string): number {
  const vowels = new Set(["a","e","ı","i","o","ö","u","ü"]);
  return [...text.toLowerCase()].filter((c) => vowels.has(c)).length || 0;
}

const STYLE_OPTIONS = [
  "Kanye West", "Drake", "Kendrick Lamar", "J. Cole",
  "Ezhel", "Ceza", "Gazapizm", "Baby Gang", "Juice WRLD",
];

// Deterministic color from username string
const PILL_COLORS = [
  "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
];
function userColor(username: string): string {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SyllableBadge({ count, target }: { count: number; target: number }) {
  const diff = count - target;
  const cls =
    Math.abs(diff) <= 2
      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
      : diff > 0
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : "text-zinc-400 border-zinc-600 bg-zinc-800";
  return (
    <span className={["text-[10px] font-mono px-1.5 py-0.5 rounded border", cls].join(" ")}>
      {count}h
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CypherMode() {
  const { currentBPM, currentStyle, setCurrentBPM, setCurrentStyle } = useMusicContext();

  // ── Username gate
  const [username, setUsername]       = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameReady, setUsernameReady] = useState(false);

  useEffect(() => {
    const saved = loadUsername();
    if (saved) { setUsername(saved); setUsernameReady(true); }
  }, []);

  const confirmUsername = useCallback(() => {
    const u = usernameInput.trim();
    if (!u) return;
    setUsername(u);
    saveUsername(u);
    setUsernameReady(true);
  }, [usernameInput]);

  // ── View state
  type View = "rooms" | "room";
  const [view, setView]             = useState<View>("rooms");
  const [activeRoom, setActiveRoom] = useState<CypherRoom | null>(null);

  // ── Room list
  const [rooms, setRooms]           = useState<CypherRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [showNewRoom, setShowNewRoom]   = useState(false);
  const [newRoomName, setNewRoomName]   = useState("");
  const [newRoomBPM, setNewRoomBPM]     = useState(currentBPM);
  const [newRoomStyle, setNewRoomStyle] = useState(currentStyle);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // ── Cypher room
  const [lines, setLines]           = useState<CypherLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [inputLine, setInputLine]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const feedRef                     = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Load rooms
  // ---------------------------------------------------------------------------
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    const { data, error } = await supabase
      .from("cypher_rooms")
      .select("*, cypher_lines(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRooms(
        data.map((r: any) => ({
          ...r,
          line_count: r.cypher_lines?.[0]?.count ?? 0,
        }))
      );
    }
    setRoomsLoading(false);
  }, []);

  useEffect(() => {
    if (usernameReady && view === "rooms") loadRooms();
  }, [usernameReady, view, loadRooms]);

  // ---------------------------------------------------------------------------
  // Create room
  // ---------------------------------------------------------------------------
  const createRoom = useCallback(async () => {
    const name = newRoomName.trim();
    if (!name) return;
    setCreatingRoom(true);
    const { data, error } = await supabase
      .from("cypher_rooms")
      .insert({ name, bpm: newRoomBPM, style: newRoomStyle, is_active: true })
      .select()
      .single();

    if (!error && data) {
      setShowNewRoom(false);
      setNewRoomName("");
      enterRoom(data as CypherRoom);
    }
    setCreatingRoom(false);
  }, [newRoomName, newRoomBPM, newRoomStyle]);

  // ---------------------------------------------------------------------------
  // Enter room
  // ---------------------------------------------------------------------------
  const enterRoom = useCallback((room: CypherRoom) => {
    setActiveRoom(room);
    setCurrentBPM(room.bpm);
    setCurrentStyle(room.style);
    setLines([]);
    setInputLine("");
    setView("room");
  }, [setCurrentBPM, setCurrentStyle]);

  // Load lines + realtime subscription
  useEffect(() => {
    if (view !== "room" || !activeRoom) return;

    setLinesLoading(true);
    supabase
      .from("cypher_lines")
      .select("*")
      .eq("room_id", activeRoom.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setLines(data as CypherLine[]);
        setLinesLoading(false);
      });

    const channel = supabase
      .channel(`cypher_lines:${activeRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cypher_lines",
          filter: `room_id=eq.${activeRoom.id}`,
        },
        (payload) => {
          setLines((prev) => {
            // Avoid duplicates (own inserts come back via realtime too)
            if (prev.some((l) => l.id === payload.new.id)) return prev;
            return [...prev, payload.new as CypherLine];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [view, activeRoom]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [lines]);

  // ---------------------------------------------------------------------------
  // Submit line
  // ---------------------------------------------------------------------------
  const submitLine = useCallback(async () => {
    const content = inputLine.trim();
    if (!content || !activeRoom) return;
    setSubmitting(true);
    const syllable_count = countSyllables(content);
    await supabase.from("cypher_lines").insert({
      room_id: activeRoom.id,
      username,
      content,
      syllable_count,
    });
    setInputLine("");
    setSubmitting(false);
  }, [inputLine, activeRoom, username]);

  // ---------------------------------------------------------------------------
  // AI assist
  // ---------------------------------------------------------------------------
  const aiAssist = useCallback(async () => {
    if (!activeRoom) return;
    setAiLoading(true);
    const context = lines.slice(-4).map((l) => l.content).join("\n");
    try {
      const res = await fetch("/api/ghostwriter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "continue",
          lyrics: context,
          bpm: activeRoom.bpm,
          style: activeRoom.style,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const suggestion: string = json.lines?.[0] ?? json.text ?? "";
        if (suggestion) setInputLine(suggestion);
      }
    } catch { /* ignore */ }
    setAiLoading(false);
  }, [activeRoom, lines]);

  // ---------------------------------------------------------------------------
  // Render: Username gate
  // ---------------------------------------------------------------------------
  if (!usernameReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
        <div className="text-center">
          <p className="text-2xl font-black text-white mb-1">Cypher'a Hoş Geldin</p>
          <p className="text-sm text-zinc-500">Devam etmek için bir kullanıcı adı seç</p>
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <input
            autoFocus
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmUsername()}
            placeholder="kullanıcı adın…"
            maxLength={20}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={confirmUsername}
            disabled={!usernameInput.trim()}
            className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Devam Et →
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Room list
  // ---------------------------------------------------------------------------
  if (view === "rooms") {
    const targetSyl = Math.round((activeRoom?.bpm ?? currentBPM) / 30);
    return (
      <div className="flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Cypher Odaları</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Hoş geldin, <span className="text-violet-300 font-medium">{username}</span>
            </p>
          </div>
          <button
            onClick={() => setShowNewRoom((v) => !v)}
            className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors"
          >
            + Yeni Oda
          </button>
        </div>

        {/* New room form */}
        {showNewRoom && (
          <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-2xl border border-violet-500/30">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest">Yeni Oda Oluştur</p>
            <input
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
              placeholder="Oda adı…"
              maxLength={40}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
            />
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest">BPM</label>
                <input
                  type="number"
                  min={60}
                  max={200}
                  value={newRoomBPM}
                  onChange={(e) => setNewRoomBPM(Number(e.target.value))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Stil</label>
                <select
                  value={newRoomStyle}
                  onChange={(e) => setNewRoomStyle(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors"
                >
                  {STYLE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createRoom}
                disabled={!newRoomName.trim() || creatingRoom}
                className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
              >
                {creatingRoom ? "Oluşturuluyor…" : "Oluştur"}
              </button>
              <button
                onClick={() => setShowNewRoom(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:text-white transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Room list */}
        {roomsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <span className="text-sm text-zinc-500">Odalar yükleniyor…</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-3xl">🎤</span>
            <p className="text-sm text-zinc-400">Henüz aktif oda yok</p>
            <p className="text-xs text-zinc-600">İlk cypher'ı sen başlat!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{room.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                      {room.bpm} BPM
                    </span>
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full truncate max-w-[100px]">
                      {room.style}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {room.line_count ?? 0} satır
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => enterRoom(room)}
                  className="ml-3 flex-shrink-0 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:border-violet-500 hover:text-white transition-colors"
                >
                  Odaya Gir →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Refresh */}
        {!roomsLoading && (
          <button
            onClick={loadRooms}
            className="self-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            ↻ Yenile
          </button>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Cypher room
  // ---------------------------------------------------------------------------
  const room = activeRoom!;
  const targetSyl = Math.round(room.bpm / 30);
  const inputSyl  = countSyllables(inputLine);
  const sylDiff   = inputSyl - targetSyl;
  const sylColor  =
    Math.abs(sylDiff) <= 2 ? "text-emerald-400"
    : sylDiff > 0          ? "text-amber-400"
    : "text-zinc-500";

  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-140px)] min-h-[500px]">

      {/* Room header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setView("rooms")}
            className="text-zinc-500 hover:text-white transition-colors text-sm flex-shrink-0"
          >
            ←
          </button>
          <p className="text-sm font-bold text-white truncate">{room.name}</p>
          <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
            {room.bpm} BPM
          </span>
          <span className="text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full truncate max-w-[80px] hidden sm:block">
            {room.style}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">
          hedef: {targetSyl}h
        </span>
      </div>

      {/* Lines feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0"
      >
        {linesLoading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <span className="text-xs text-zinc-500">Yükleniyor…</span>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-2xl">🎤</span>
            <p className="text-xs text-zinc-500">Henüz satır yok — ilk sen yaz!</p>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex items-start gap-2 group">
              <span className={[
                "text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5",
                userColor(line.username),
              ].join(" ")}>
                {line.username}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 leading-snug break-words">{line.content}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <SyllableBadge count={line.syllable_count} target={targetSyl} />
                <span className="text-[10px] text-zinc-700 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {fmtTime(line.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pt-3 border-t border-zinc-800 mt-3 flex flex-col gap-2">
        {/* Syllable live counter */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-600">Satırını yaz</span>
          {inputLine && (
            <span className={["text-[10px] font-mono transition-colors", sylColor].join(" ")}>
              {inputSyl}h {sylDiff > 0 ? `+${sylDiff}` : sylDiff < 0 ? sylDiff : "✓"}
            </span>
          )}
        </div>

        <textarea
          value={inputLine}
          onChange={(e) => setInputLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitLine();
            }
          }}
          placeholder="Satırını buraya yaz…"
          rows={2}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 resize-none transition-colors"
        />

        <div className="flex gap-2">
          <button
            onClick={submitLine}
            disabled={!inputLine.trim() || submitting}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Yazılıyor…" : "🎤 Yaz"}
          </button>
          <button
            onClick={aiAssist}
            disabled={aiLoading}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-semibold text-zinc-300 hover:border-violet-500 hover:text-white disabled:opacity-40 transition-colors"
          >
            {aiLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin" />
                <span className="text-xs">AI…</span>
              </span>
            ) : "👻 Devam Et"}
          </button>
        </div>
      </div>
    </div>
  );
}
