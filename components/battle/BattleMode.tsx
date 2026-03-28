"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useMusicContext } from "@/lib/MusicContext";

// ── Types ────────────────────────────────────────────────────────────────────
interface BattleRoom {
  id: string;
  name: string;
  bpm: number;
  style: string;
  status: string; // "waiting" | "active" | "finished"
  player1_name: string | null;
  player2_name: string | null;
  topic: string | null;
  created_at: string;
}

interface BattleLine {
  id: string;
  room_id: string;
  player: string;
  content: string;
  syllable_count: number;
  round_number: number;
  created_at: string;
}

interface BattleScore {
  id: string;
  room_id: string;
  player: string;
  rhyme_score: number;
  syllable_score: number;
  originality_score: number;
  total_score: number;
  ai_comment: string;
  created_at: string;
}

interface JudgeResult {
  mc1: { rhyme: number; flow: number; originality: number; total: number; feedback: string };
  mc2: { rhyme: number; flow: number; originality: number; total: number; feedback: string };
  winner: "mc1" | "mc2" | "tie";
  judgeComment: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const LS_USERNAME = "rapflow_username";
const MAX_ROUNDS  = 3;
const STYLES = ["Freestyle", "Trap", "Boom-Bap", "Drill", "Melankolik"];
const TR_VOWELS = new Set(["a","e","ı","i","o","ö","u","ü"]);
function countSyl(t: string) { return [...t.toLowerCase()].filter(c => TR_VOWELS.has(c)).length; }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="text-[10px] font-mono text-violet-300 w-6 text-right">{value}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BattleMode() {
  const { currentBPM, setCurrentBPM, currentStyle, setCurrentStyle } = useMusicContext();

  // Username
  const [username, setUsername]     = useState("");
  const [nameInput, setNameInput]   = useState("");
  const [nameReady, setNameReady]   = useState(false);

  // View: "rooms" | "waiting" | "battle" | "results"
  type View = "rooms" | "waiting" | "battle" | "results";
  const [view, setView]             = useState<View>("rooms");
  const [room, setRoom]             = useState<BattleRoom | null>(null);
  const [lines, setLines]           = useState<BattleLine[]>([]);
  const [scores, setScores]         = useState<BattleScore[]>([]);
  const [rooms, setRooms]           = useState<BattleRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newBPM, setNewBPM]         = useState(currentBPM);
  const [newStyle, setNewStyle]     = useState(currentStyle);
  const [newTopic, setNewTopic]     = useState("");
  const [creating, setCreating]     = useState(false);

  // Battle input
  const [inputLine, setInputLine]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [judging, setJudging]       = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Username
  useEffect(() => {
    const saved = localStorage.getItem(LS_USERNAME);
    if (saved) { setUsername(saved); setNameReady(true); }
  }, []);

  const confirmName = useCallback(() => {
    const u = nameInput.trim();
    if (!u) return;
    localStorage.setItem(LS_USERNAME, u);
    setUsername(u);
    setNameReady(true);
  }, [nameInput]);

  // ── Load rooms
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    const { data } = await supabase
      .from("battle_rooms")
      .select("*")
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setRooms(data as BattleRoom[]);
    setRoomsLoading(false);
  }, []);

  useEffect(() => { if (nameReady && view === "rooms") loadRooms(); }, [nameReady, view, loadRooms]);

  // ── Derived state
  const isPlayer1 = room?.player1_name === username;
  const isPlayer2 = room?.player2_name === username;
  const opponent  = isPlayer1 ? room?.player2_name : room?.player1_name;

  // Current round = number of rounds where BOTH players have submitted + 1
  const currentRound = (() => {
    if (!room) return 1;
    const p1 = room.player1_name ?? "";
    const p2 = room.player2_name ?? "";
    let completed = 0;
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      const p1done = lines.some(l => l.player === p1 && l.round_number === r);
      const p2done = lines.some(l => l.player === p2 && l.round_number === r);
      if (p1done && p2done) completed = r;
    }
    return Math.min(completed + 1, MAX_ROUNDS + 1);
  })();

  const hasSubmittedThisRound = lines.some(l => l.player === username && l.round_number === currentRound);

  // ── Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [lines]);

  // ── Realtime for battle room view
  useEffect(() => {
    if ((view !== "battle" && view !== "waiting" && view !== "results") || !room) return;

    // Subscribe to room changes (status, player2 joins)
    const roomChannel = supabase
      .channel(`battle_room:${room.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battle_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as BattleRoom;
          setRoom(updated);
          if (updated.status === "active"   && view === "waiting") setView("battle");
          if (updated.status === "finished" && view === "battle")  setView("results");
        }
      )
      .subscribe();

    // Subscribe to new lines
    const linesChannel = supabase
      .channel(`battle_lines:${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_lines", filter: `room_id=eq.${room.id}` },
        (payload) => setLines(prev => prev.some(l => l.id === payload.new.id) ? prev : [...prev, payload.new as BattleLine])
      )
      .subscribe();

    // Subscribe to scores
    const scoresChannel = supabase
      .channel(`battle_scores:${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_scores", filter: `room_id=eq.${room.id}` },
        (payload) => setScores(prev => prev.some(s => s.id === payload.new.id) ? prev : [...prev, payload.new as BattleScore])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(linesChannel);
      supabase.removeChannel(scoresChannel);
    };
  }, [view, room?.id]);

  // ── Create room
  const createRoom = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("battle_rooms")
      .insert({ name: newName.trim(), bpm: newBPM, style: newStyle, topic: newTopic.trim() || "Serbest", player1_name: username, status: "waiting" })
      .select().single();
    if (!error && data) {
      setRoom(data as BattleRoom);
      setLines([]);
      setScores([]);
      setCurrentBPM(newBPM);
      setCurrentStyle(newStyle);
      setShowCreate(false);
      setView("waiting");
    }
    setCreating(false);
  }, [newName, newBPM, newStyle, newTopic, username, setCurrentBPM, setCurrentStyle]);

  // ── Join room
  const joinRoom = useCallback(async (r: BattleRoom) => {
    const { data, error } = await supabase
      .from("battle_rooms")
      .update({ player2_name: username, status: "active" })
      .eq("id", r.id)
      .select().single();
    if (!error && data) {
      const updated = data as BattleRoom;
      setRoom(updated);
      setCurrentBPM(updated.bpm);
      setCurrentStyle(updated.style);
      // Load existing lines
      const { data: existingLines } = await supabase.from("battle_lines").select("*").eq("room_id", r.id).order("created_at");
      if (existingLines) setLines(existingLines as BattleLine[]);
      const { data: existingScores } = await supabase.from("battle_scores").select("*").eq("room_id", r.id);
      if (existingScores) setScores(existingScores as BattleScore[]);
      setView("battle");
    }
  }, [username, setCurrentBPM, setCurrentStyle]);

  // ── Submit line + trigger judging
  const submitLine = useCallback(async () => {
    const content = inputLine.trim();
    if (!content || !room || hasSubmittedThisRound) return;
    setSubmitting(true);
    const syllable_count = countSyl(content);

    await supabase.from("battle_lines").insert({ room_id: room.id, player: username, content, syllable_count, round_number: currentRound });
    setInputLine("");

    // Check if opponent also submitted this round
    const { data: roundLines } = await supabase
      .from("battle_lines")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_number", currentRound);

    const bothSubmitted = roundLines && room.player1_name && room.player2_name &&
      roundLines.some(l => l.player === room.player1_name) &&
      roundLines.some(l => l.player === room.player2_name);

    if (bothSubmitted && roundLines) {
      // Check no score exists for this round yet (avoid double-judging)
      const { data: existingScores } = await supabase.from("battle_scores").select("id").eq("room_id", room.id);
      const roundScoreCount = existingScores?.length ?? 0;
      const expectedScoresBeforeThisRound = (currentRound - 1) * 2;
      if (roundScoreCount <= expectedScoresBeforeThisRound) {
        setJudging(true);
        setJudgeError(null);
        try {
          const mc1Line = roundLines.find(l => l.player === room.player1_name);
          const mc2Line = roundLines.find(l => l.player === room.player2_name);
          const res = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mc1: { name: room.player1_name, line: mc1Line?.content ?? "" },
              mc2: { name: room.player2_name, line: mc2Line?.content ?? "" },
              bpm: room.bpm, style: room.style, topic: room.topic, round: currentRound,
            }),
          });
          if (res.ok) {
            const result: JudgeResult = await res.json();
            await supabase.from("battle_scores").insert([
              { room_id: room.id, player: room.player1_name!, rhyme_score: result.mc1.rhyme, syllable_score: result.mc1.flow, originality_score: result.mc1.originality, total_score: result.mc1.total, ai_comment: result.mc1.feedback },
              { room_id: room.id, player: room.player2_name!, rhyme_score: result.mc2.rhyme, syllable_score: result.mc2.flow, originality_score: result.mc2.originality, total_score: result.mc2.total, ai_comment: result.mc2.feedback },
            ]);
          }
        } catch (e) {
          setJudgeError(e instanceof Error ? e.message : "Hakem hatası");
        } finally {
          setJudging(false);
        }
        // If last round, finish the battle
        if (currentRound >= MAX_ROUNDS) {
          await supabase.from("battle_rooms").update({ status: "finished" }).eq("id", room.id);
          setView("results");
        }
      }
    }
    setSubmitting(false);
  }, [inputLine, room, username, hasSubmittedThisRound, currentRound]);

  // ── Exit room
  const exitRoom = useCallback(async () => {
    if (room && isPlayer1 && room.status === "waiting") {
      await supabase.from("battle_rooms").update({ status: "finished" }).eq("id", room.id);
    }
    setRoom(null);
    setLines([]);
    setScores([]);
    setView("rooms");
  }, [room, isPlayer1]);

  // ── Render score card
  function ScoreCard({ player, playerScores }: { player: string; playerScores: BattleScore[] }) {
    const totalPoints = playerScores.reduce((s, sc) => s + (sc.total_score ?? 0), 0);
    const latest = playerScores[playerScores.length - 1];
    return (
      <div className="flex flex-col gap-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{player}</span>
          <span className="text-lg font-black text-violet-400 font-mono">{totalPoints}pt</span>
        </div>
        {latest && (
          <div className="flex flex-col gap-1">
            <ScoreBar label="Kafiye" value={latest.rhyme_score ?? 0} />
            <ScoreBar label="Flow"   value={latest.syllable_score ?? 0} />
            <ScoreBar label="Özgünlük" value={latest.originality_score ?? 0} />
            <p className="text-[10px] text-zinc-500 italic mt-1">{latest.ai_comment}</p>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Views
  // ──────────────────────────────────────────────────────────────────────────

  // Username gate
  if (!nameReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
        <div className="text-center">
          <p className="text-2xl font-black text-white mb-1">⚔️ Battle Modu</p>
          <p className="text-sm text-zinc-500">Devam etmek için kullanıcı adı seç</p>
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmName()}
            placeholder="MC adın…" maxLength={20}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
          />
          <button onClick={confirmName} disabled={!nameInput.trim()}
            className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
            Ringde Yerini Al ⚔️
          </button>
        </div>
      </div>
    );
  }

  // Waiting for opponent
  if (view === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        <div>
          <p className="text-white font-bold text-lg">{room?.name}</p>
          <p className="text-zinc-500 text-sm mt-1">Rakip bekleniyor…</p>
          <p className="text-zinc-700 text-xs mt-3 font-mono">Sen: {username} · {room?.bpm} BPM · {room?.topic}</p>
        </div>
        <button onClick={exitRoom}
          className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm hover:text-white transition-colors">
          ← Odadan Çık
        </button>
      </div>
    );
  }

  // Results
  if (view === "results" && room) {
    const p1Scores = scores.filter(s => s.player === room.player1_name);
    const p2Scores = scores.filter(s => s.player === room.player2_name);
    const p1Total  = p1Scores.reduce((s, sc) => s + (sc.total_score ?? 0), 0);
    const p2Total  = p2Scores.reduce((s, sc) => s + (sc.total_score ?? 0), 0);
    const winner   = p1Total > p2Total ? room.player1_name : p2Total > p1Total ? room.player2_name : "Berabere";
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center py-4">
          <p className="text-3xl font-black text-white">{winner === "Berabere" ? "🤝 Berabere!" : `🏆 ${winner} kazandı!`}</p>
          <p className="text-zinc-500 text-sm mt-1">{p1Total} – {p2Total} puan</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard player={room.player1_name!} playerScores={p1Scores} />
          <ScoreCard player={room.player2_name!} playerScores={p2Scores} />
        </div>
        <div className="flex flex-col gap-2">
          {lines.map(l => (
            <div key={l.id} className="flex items-baseline gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
              <span className="text-[10px] font-semibold text-violet-400 flex-shrink-0">R{l.round_number} · {l.player}</span>
              <p className="text-sm text-zinc-200 flex-1 font-mono">{l.content}</p>
              <span className="text-[10px] font-mono text-zinc-500">{l.syllable_count}h</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setView("rooms"); setRoom(null); setLines([]); setScores([]); }}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-colors">
          🔄 Yeni Battle
        </button>
      </div>
    );
  }

  // Active battle
  if (view === "battle" && room) {
    const myLines  = lines.filter(l => l.player === username);
    const oppLines = lines.filter(l => l.player === opponent);
    const myScores = scores.filter(s => s.player === username);
    const myTotal  = myScores.reduce((s, sc) => s + (sc.total_score ?? 0), 0);
    const oppTotal = scores.filter(s => s.player === opponent).reduce((s, sc) => s + (sc.total_score ?? 0), 0);
    const battleDone = currentRound > MAX_ROUNDS;

    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={exitRoom} className="text-zinc-500 hover:text-white transition-colors text-sm">←</button>
          <div className="text-center">
            <p className="text-sm font-bold text-white">{room.name}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{room.bpm} BPM · {room.topic}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-violet-300">{myTotal}pt</span>
            <span className="text-zinc-600">vs</span>
            <span className="text-zinc-400">{oppTotal}pt</span>
          </div>
        </div>

        {/* Round indicator */}
        <div className="flex gap-1.5 justify-center">
          {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
            const r = i + 1;
            const done = r < currentRound;
            const active = r === currentRound;
            return (
              <div key={r} className={["w-8 h-1.5 rounded-full transition-colors",
                done ? "bg-violet-500" : active ? "bg-violet-500/50 animate-pulse" : "bg-zinc-700"
              ].join(" ")} />
            );
          })}
        </div>
        {!battleDone && <p className="text-center text-xs text-zinc-500">Round {currentRound}/{MAX_ROUNDS}</p>}

        {/* Lines feed */}
        <div ref={feedRef} className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {lines.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">Henüz satır yok — ilk sen yaz!</p>
          ) : (
            lines.map(l => {
              const isMe = l.player === username;
              return (
                <div key={l.id} className={["flex gap-2 items-start", isMe ? "flex-row-reverse" : "flex-row"].join(" ")}>
                  <span className={["text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5",
                    isMe ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-zinc-700/40 border-zinc-600 text-zinc-400"
                  ].join(" ")}>{l.player}</span>
                  <div className={["flex flex-col", isMe ? "items-end" : "items-start"].join(" ")}>
                    <p className={["text-sm font-mono leading-snug px-3 py-2 rounded-xl border",
                      isMe ? "bg-violet-950/30 border-violet-500/20 text-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-300"
                    ].join(" ")}>{l.content}</p>
                    <span className="text-[9px] text-zinc-600 font-mono mt-0.5">{l.syllable_count}h · R{l.round_number} · {fmtTime(l.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Judging indicator */}
        {judging && (
          <div className="flex items-center gap-2 justify-center py-2">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-violet-400 animate-pulse">Hakem değerlendiriyor…</span>
          </div>
        )}
        {judgeError && <p className="text-xs text-red-400 text-center">{judgeError}</p>}

        {/* Score display for completed rounds */}
        {scores.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <ScoreCard player={username} playerScores={scores.filter(s => s.player === username)} />
            {opponent && <ScoreCard player={opponent} playerScores={scores.filter(s => s.player === opponent)} />}
          </div>
        )}

        {/* Input area */}
        {!battleDone && (
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
            {hasSubmittedThisRound ? (
              <p className="text-center text-xs text-zinc-500 py-2 animate-pulse">
                {opponent ? `${opponent} yazıyor…` : "Rakip bekleniyor…"}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] text-zinc-600">Round {currentRound} satırın</span>
                  {inputLine && <span className="text-[10px] font-mono text-zinc-500">{countSyl(inputLine)}h</span>}
                </div>
                <textarea value={inputLine} onChange={e => setInputLine(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitLine(); } }}
                  placeholder="Satırını buraya yaz…" rows={2}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 resize-none transition-colors"
                />
                <button onClick={submitLine} disabled={!inputLine.trim() || submitting}
                  className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
                  {submitting ? "Yazılıyor…" : "⚔️ Yaz"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Room list
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">⚔️ Battle Odaları</h2>
          <p className="text-xs text-zinc-500 mt-0.5">MC: <span className="text-violet-300 font-medium">{username}</span></p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors">
          + Yeni Battle
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-2xl border border-violet-500/30">
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest">Yeni Battle Odası</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createRoom()}
            placeholder="Oda adı…" maxLength={40}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
          />
          <input value={newTopic} onChange={e => setNewTopic(e.target.value)}
            placeholder="Konu (isteğe bağlı)…" maxLength={60}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
          />
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest">BPM</label>
              <input type="number" min={60} max={200} value={newBPM}
                onChange={e => setNewBPM(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Stil</label>
              <select value={newStyle} onChange={e => setNewStyle(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors">
                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createRoom} disabled={!newName.trim() || creating}
              className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
              {creating ? "Oluşturuluyor…" : "⚔️ Battle Başlat"}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:text-white transition-colors">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Room list */}
      {roomsLoading ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <span className="text-sm text-zinc-500">Odalar yükleniyor…</span>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-3xl">⚔️</span>
          <p className="text-sm text-zinc-400">Aktif battle odası yok</p>
          <p className="text-xs text-zinc-600">İlk battle'ı sen başlat!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map(r => {
            const isFull = r.player1_name && r.player2_name;
            const isMyRoom = r.player1_name === username || r.player2_name === username;
            return (
              <div key={r.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">{r.bpm} BPM</span>
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{r.style}</span>
                    {r.topic && <span className="text-[10px] text-zinc-500 italic truncate max-w-[100px]">{r.topic}</span>}
                    <span className={["text-[10px] px-2 py-0.5 rounded-full font-semibold",
                      r.status === "waiting" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                    ].join(" ")}>{r.status === "waiting" ? "Bekleniyor" : "Aktif"}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600">{r.player1_name ?? "?"} vs {r.player2_name ?? "?"}</p>
                </div>
                {!isFull && !isMyRoom && r.status === "waiting" && (
                  <button onClick={() => joinRoom(r)}
                    className="ml-3 flex-shrink-0 px-3 py-2 rounded-xl bg-violet-600 border border-violet-500 text-xs font-semibold text-white hover:bg-violet-500 transition-colors">
                    Katıl ⚔️
                  </button>
                )}
                {isMyRoom && r.status === "active" && (
                  <button onClick={() => { setRoom(r); setView("battle"); }}
                    className="ml-3 flex-shrink-0 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:border-violet-500 transition-colors">
                    Odaya Dön
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={loadRooms}
        className="self-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1">
        ↻ Yenile
      </button>
    </div>
  );
}
