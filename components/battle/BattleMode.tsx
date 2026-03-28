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
  status: string;
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

// Solo mode local line
interface SoloLine {
  player: string;
  content: string;
  syllable_count: number;
  round_number: number;
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
  const [username, setUsername]   = useState("");
  const [nameInput, setNameInput] = useState("");
  const [nameReady, setNameReady] = useState(false);

  // View: "rooms" | "waiting" | "battle" | "results" | "solo" | "solo_results"
  type View = "rooms" | "waiting" | "battle" | "results" | "solo" | "solo_results";
  const [view, setView]           = useState<View>("rooms");

  // Multiplayer state
  const [room, setRoom]           = useState<BattleRoom | null>(null);
  const [lines, setLines]         = useState<BattleLine[]>([]);
  const [scores, setScores]       = useState<BattleScore[]>([]);
  const [rooms, setRooms]         = useState<BattleRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newBPM, setNewBPM]         = useState(currentBPM);
  const [newStyle, setNewStyle]     = useState(currentStyle);
  const [newTopic, setNewTopic]     = useState("");
  const [creating, setCreating]     = useState(false);

  // Battle input
  const [inputLine, setInputLine] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [judging, setJudging]       = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Solo Test Mode state
  const [soloP1, setSoloP1]         = useState("MC-1");
  const [soloP2, setSoloP2]         = useState("MC-2");
  const [soloBPM, setSoloBPM]       = useState(currentBPM);
  const [soloStyle, setSoloStyle]   = useState(currentStyle);
  const [soloTopic, setSoloTopic]   = useState("");
  const [soloLines, setSoloLines]   = useState<SoloLine[]>([]);
  const [soloInput, setSoloInput]   = useState("");
  const [soloJudging, setSoloJudging] = useState(false);
  const [soloJudgeError, setSoloJudgeError] = useState<string | null>(null);
  const [soloResult, setSoloResult] = useState<JudgeResult | null>(null);
  const [showSoloSetup, setShowSoloSetup] = useState(false);
  const soloFeedRef = useRef<HTMLDivElement>(null);

  // Derived solo state
  const soloRound   = Math.floor(soloLines.length / 2) + 1;
  const soloTurn    = soloLines.length % 2 === 0 ? soloP1 : soloP2; // P1 goes first each round
  const soloDone    = soloLines.length >= MAX_ROUNDS * 2;

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

  // ── Derived multiplayer state
  const isPlayer1 = room?.player1_name === username;
  const opponent  = isPlayer1 ? room?.player2_name : room?.player1_name;

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

  // ── Auto-scroll
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [lines]);
  useEffect(() => {
    if (soloFeedRef.current) soloFeedRef.current.scrollTop = soloFeedRef.current.scrollHeight;
  }, [soloLines]);

  // ── Realtime subscriptions
  useEffect(() => {
    if ((view !== "battle" && view !== "waiting" && view !== "results") || !room) return;

    const roomChannel = supabase
      .channel(`battle_room:${room.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battle_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as BattleRoom;
          setRoom(updated);
          if (updated.status === "active"   && view === "waiting") setView("battle");
          if (updated.status === "finished" && view === "battle")  setView("results");
        }
      ).subscribe();

    const linesChannel = supabase
      .channel(`battle_lines:${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_lines", filter: `room_id=eq.${room.id}` },
        (payload) => setLines(prev => prev.some(l => l.id === payload.new.id) ? prev : [...prev, payload.new as BattleLine])
      ).subscribe();

    const scoresChannel = supabase
      .channel(`battle_scores:${room.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_scores", filter: `room_id=eq.${room.id}` },
        (payload) => setScores(prev => prev.some(s => s.id === payload.new.id) ? prev : [...prev, payload.new as BattleScore])
      ).subscribe();

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
    } else if (error) {
      setSubmitError(`Oda oluşturulamadı: ${error.message}`);
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
      const { data: existingLines } = await supabase.from("battle_lines").select("*").eq("room_id", r.id).order("created_at");
      if (existingLines) setLines(existingLines as BattleLine[]);
      const { data: existingScores } = await supabase.from("battle_scores").select("*").eq("room_id", r.id);
      if (existingScores) setScores(existingScores as BattleScore[]);
      setView("battle");
    }
  }, [username, setCurrentBPM, setCurrentStyle]);

  // ── Submit line (FIXED: update local state immediately, show errors)
  const submitLine = useCallback(async () => {
    const content = inputLine.trim();
    if (!content || !room || hasSubmittedThisRound || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const syllable_count = countSyl(content);
    const round_number = currentRound;

    // Optimistically add to local state immediately
    const optimisticLine: BattleLine = {
      id: `optimistic-${Date.now()}`,
      room_id: room.id,
      player: username,
      content,
      syllable_count,
      round_number,
      created_at: new Date().toISOString(),
    };
    setLines(prev => [...prev, optimisticLine]);
    setInputLine("");

    const { error: insertError } = await supabase
      .from("battle_lines")
      .insert({ room_id: room.id, player: username, content, syllable_count, round_number });

    if (insertError) {
      // Roll back optimistic update
      setLines(prev => prev.filter(l => l.id !== optimisticLine.id));
      setInputLine(content);
      setSubmitError(`Satır gönderilemedi: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    // Check if opponent also submitted this round (re-fetch)
    const { data: roundLines } = await supabase
      .from("battle_lines")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_number", round_number);

    const bothSubmitted = roundLines && room.player1_name && room.player2_name &&
      roundLines.some(l => l.player === room.player1_name) &&
      roundLines.some(l => l.player === room.player2_name);

    if (bothSubmitted && roundLines) {
      const { data: existingScores } = await supabase.from("battle_scores").select("id").eq("room_id", room.id);
      const roundScoreCount = existingScores?.length ?? 0;
      const expectedScoresBeforeThisRound = (round_number - 1) * 2;

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
              bpm: room.bpm, style: room.style, topic: room.topic, round: round_number,
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
        if (round_number >= MAX_ROUNDS) {
          await supabase.from("battle_rooms").update({ status: "finished" }).eq("id", room.id);
          setView("results");
        }
      }
    }
    setSubmitting(false);
  }, [inputLine, room, username, hasSubmittedThisRound, submitting, currentRound]);

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

  // ── Solo: submit a line
  const submitSoloLine = useCallback(() => {
    const content = soloInput.trim();
    if (!content || soloDone) return;
    const newLine: SoloLine = {
      player: soloTurn,
      content,
      syllable_count: countSyl(content),
      round_number: soloRound,
    };
    setSoloLines(prev => [...prev, newLine]);
    setSoloInput("");
  }, [soloInput, soloDone, soloTurn, soloRound]);

  // ── Solo: judge all lines after round 3
  const judgeSolo = useCallback(async (allLines: SoloLine[]) => {
    setSoloJudging(true);
    setSoloJudgeError(null);
    try {
      const p1Lines = allLines.filter(l => l.player === soloP1).map(l => l.content);
      const p2Lines = allLines.filter(l => l.player === soloP2).map(l => l.content);
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mc1: { name: soloP1, lines: p1Lines, line: p1Lines.join(" / ") },
          mc2: { name: soloP2, lines: p2Lines, line: p2Lines.join(" / ") },
          bpm: soloBPM, style: soloStyle, topic: soloTopic || "Serbest", round: MAX_ROUNDS,
        }),
      });
      if (res.ok) {
        const result: JudgeResult = await res.json();
        setSoloResult(result);
        setView("solo_results");
      } else {
        setSoloJudgeError("Hakem API hatası");
      }
    } catch (e) {
      setSoloJudgeError(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setSoloJudging(false);
    }
  }, [soloP1, soloP2, soloBPM, soloStyle, soloTopic]);

  // Auto-trigger judge when all lines submitted
  useEffect(() => {
    if (soloLines.length === MAX_ROUNDS * 2 && !soloJudging && !soloResult && view === "solo") {
      judgeSolo(soloLines);
    }
  }, [soloLines, soloJudging, soloResult, view, judgeSolo]);

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
            <ScoreBar label="Kafiye"    value={latest.rhyme_score ?? 0} />
            <ScoreBar label="Flow"      value={latest.syllable_score ?? 0} />
            <ScoreBar label="Özgünlük" value={latest.originality_score ?? 0} />
            <p className="text-[10px] text-zinc-500 italic mt-1">{latest.ai_comment}</p>
          </div>
        )}
      </div>
    );
  }

  function SoloScoreCard({ name, data }: { name: string; data: JudgeResult["mc1"] }) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{name}</span>
          <span className="text-lg font-black text-violet-400 font-mono">{data.total}pt</span>
        </div>
        <div className="flex flex-col gap-1">
          <ScoreBar label="Kafiye"    value={data.rhyme} />
          <ScoreBar label="Flow"      value={data.flow} />
          <ScoreBar label="Özgünlük" value={data.originality} />
          <p className="text-[10px] text-zinc-500 italic mt-1">{data.feedback}</p>
        </div>
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

  // Multiplayer results
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

  // Solo results
  if (view === "solo_results" && soloResult) {
    const p1Total = soloResult.mc1.total;
    const p2Total = soloResult.mc2.total;
    const winner  = soloResult.winner === "mc1" ? soloP1 : soloResult.winner === "mc2" ? soloP2 : "Berabere";
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center py-4">
          <p className="text-3xl font-black text-white">
            {winner === "Berabere" ? "🤝 Berabere!" : `🏆 ${winner} kazandı!`}
          </p>
          <p className="text-zinc-500 text-sm mt-1">{p1Total} – {p2Total} puan</p>
          {soloResult.judgeComment && (
            <p className="text-xs text-zinc-400 italic mt-2 max-w-sm mx-auto">"{soloResult.judgeComment}"</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SoloScoreCard name={soloP1} data={soloResult.mc1} />
          <SoloScoreCard name={soloP2} data={soloResult.mc2} />
        </div>
        <div className="flex flex-col gap-2">
          {soloLines.map((l, i) => (
            <div key={i} className="flex items-baseline gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
              <span className="text-[10px] font-semibold text-violet-400 flex-shrink-0">R{l.round_number} · {l.player}</span>
              <p className="text-sm text-zinc-200 flex-1 font-mono">{l.content}</p>
              <span className="text-[10px] font-mono text-zinc-500">{l.syllable_count}h</span>
            </div>
          ))}
        </div>
        <button onClick={() => {
          setSoloLines([]); setSoloResult(null); setSoloInput("");
          setSoloJudgeError(null); setView("rooms");
        }}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-colors">
          🔄 Yeni Battle
        </button>
      </div>
    );
  }

  // Solo battle
  if (view === "solo") {
    const waitingForJudge = soloDone && soloJudging;
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setSoloLines([]); setSoloResult(null); setSoloInput(""); setView("rooms"); }}
            className="text-zinc-500 hover:text-white transition-colors text-sm">←</button>
          <div className="text-center">
            <p className="text-sm font-bold text-white">🎯 Solo Test · {soloP1} vs {soloP2}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{soloBPM} BPM · {soloStyle} · {soloTopic || "Serbest"}</p>
          </div>
          <div className="w-8" />
        </div>

        {/* Round bars */}
        <div className="flex gap-1.5 justify-center">
          {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
            const r = i + 1;
            const linesInRound = soloLines.filter(l => l.round_number === r).length;
            const done   = linesInRound === 2;
            const active = !done && soloRound === r;
            return (
              <div key={r} className={["w-8 h-1.5 rounded-full transition-colors",
                done ? "bg-violet-500" : active ? "bg-violet-500/50 animate-pulse" : "bg-zinc-700"
              ].join(" ")} />
            );
          })}
        </div>
        {!soloDone && (
          <p className="text-center text-xs">
            <span className="text-zinc-500">Round {soloRound}/{MAX_ROUNDS} · </span>
            <span className="text-violet-300 font-semibold">{soloTurn} yazıyor</span>
          </p>
        )}

        {/* Lines feed */}
        <div ref={soloFeedRef} className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {soloLines.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">{soloP1} ilk satırı yazar, ardından {soloP2}</p>
          ) : (
            soloLines.map((l, i) => {
              const isP1 = l.player === soloP1;
              return (
                <div key={i} className={["flex gap-2 items-start", isP1 ? "flex-row-reverse" : "flex-row"].join(" ")}>
                  <span className={["text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5",
                    isP1 ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-zinc-700/40 border-zinc-600 text-zinc-400"
                  ].join(" ")}>{l.player}</span>
                  <div className={["flex flex-col", isP1 ? "items-end" : "items-start"].join(" ")}>
                    <p className={["text-sm font-mono leading-snug px-3 py-2 rounded-xl border",
                      isP1 ? "bg-violet-950/30 border-violet-500/20 text-zinc-100" : "bg-zinc-900 border-zinc-700 text-zinc-300"
                    ].join(" ")}>{l.content}</p>
                    <span className="text-[9px] text-zinc-600 font-mono mt-0.5">{l.syllable_count}h · R{l.round_number}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Judging */}
        {waitingForJudge && (
          <div className="flex items-center gap-2 justify-center py-3">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-violet-400 animate-pulse">AI hakem değerlendiriyor…</span>
          </div>
        )}
        {soloJudgeError && (
          <div className="flex items-center justify-between px-3 py-2 bg-red-950/30 border border-red-500/30 rounded-xl">
            <p className="text-xs text-red-400">{soloJudgeError}</p>
            <button onClick={() => judgeSolo(soloLines)} className="text-xs text-red-300 hover:text-white ml-2">Tekrar dene</button>
          </div>
        )}

        {/* Input */}
        {!soloDone && (
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-zinc-500">
                <span className="text-violet-300 font-medium">{soloTurn}</span>'ın satırı
              </span>
              {soloInput && <span className="text-[10px] font-mono text-zinc-500">{countSyl(soloInput)}h</span>}
            </div>
            <textarea value={soloInput} onChange={e => setSoloInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitSoloLine(); } }}
              placeholder={`${soloTurn} satırını yaz…`} rows={2}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 resize-none transition-colors"
            />
            <button onClick={submitSoloLine} disabled={!soloInput.trim()}
              className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
              ⚔️ Yaz ({soloTurn})
            </button>
          </div>
        )}
      </div>
    );
  }

  // Active multiplayer battle
  if (view === "battle" && room) {
    const myScores   = scores.filter(s => s.player === username);
    const myTotal    = myScores.reduce((s, sc) => s + (sc.total_score ?? 0), 0);
    const oppTotal   = scores.filter(s => s.player === opponent).reduce((s, sc) => s + (sc.total_score ?? 0), 0);
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
            const done   = r < currentRound;
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

        {/* Error */}
        {submitError && (
          <p className="text-xs text-red-400 text-center bg-red-950/20 border border-red-500/20 rounded-xl px-3 py-2">{submitError}</p>
        )}

        {/* Judging */}
        {judging && (
          <div className="flex items-center gap-2 justify-center py-2">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-violet-400 animate-pulse">Hakem değerlendiriyor…</span>
          </div>
        )}
        {judgeError && <p className="text-xs text-red-400 text-center">{judgeError}</p>}

        {/* Scores */}
        {scores.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <ScoreCard player={username} playerScores={scores.filter(s => s.player === username)} />
            {opponent && <ScoreCard player={opponent} playerScores={scores.filter(s => s.player === opponent)} />}
          </div>
        )}

        {/* Input */}
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

  // ── Room list
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">⚔️ Battle Modu</h2>
          <p className="text-xs text-zinc-500 mt-0.5">MC: <span className="text-violet-300 font-medium">{username}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSoloSetup(v => !v)}
            className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold hover:border-violet-500 hover:text-white transition-colors">
            🎯 Solo Test
          </button>
          <button onClick={() => setShowCreate(v => !v)}
            className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors">
            + Çok Oyunculu
          </button>
        </div>
      </div>

      {/* Solo setup form */}
      {showSoloSetup && (
        <div className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-2xl border border-zinc-700">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest">Solo Test Modu</p>
            <span className="text-[10px] text-zinc-600">3 round · sen iki tarafı da oynarsın</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest">MC 1 Adı</label>
              <input value={soloP1} onChange={e => setSoloP1(e.target.value)} maxLength={20}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest">MC 2 Adı</label>
              <input value={soloP2} onChange={e => setSoloP2(e.target.value)} maxLength={20}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>
          <input value={soloTopic} onChange={e => setSoloTopic(e.target.value)}
            placeholder="Konu (isteğe bağlı)…" maxLength={60}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
          />
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest">BPM</label>
              <input type="number" min={60} max={200} value={soloBPM}
                onChange={e => setSoloBPM(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest">Stil</label>
              <select value={soloStyle} onChange={e => setSoloStyle(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors">
                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setSoloLines([]); setSoloResult(null); setSoloInput(""); setSoloJudgeError(null); setShowSoloSetup(false); setView("solo"); }}
              disabled={!soloP1.trim() || !soloP2.trim()}
              className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors">
              🎯 Solo Battle Başlat
            </button>
            <button onClick={() => setShowSoloSetup(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:text-white transition-colors">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Multiplayer create form */}
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
          {submitError && <p className="text-xs text-red-400">{submitError}</p>}
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
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-3xl">⚔️</span>
          <p className="text-sm text-zinc-400">Aktif çok oyunculu oda yok</p>
          <p className="text-xs text-zinc-600">Solo test ile hemen başlayabilirsin!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map(r => {
            const isFull   = r.player1_name && r.player2_name;
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
