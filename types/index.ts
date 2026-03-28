// Core domain types for RapFlow

export interface Beat {
  bpm: number;
  timeSignature: [number, number]; // e.g. [4, 4]
  swing: number; // 0–1
}

export interface LyricLine {
  text: string;
  syllables: number;
  bars: number;
  startBeat: number;
}

export interface FlowAnalysis {
  score: number; // 0–100
  feedback: string;
  suggestions: string[];
  syllablesPerBar: number;
  rhythmAccuracy: number;
}

export interface BreathPattern {
  inhaleBeats: number;
  holdBeats: number;
  exhaleBeats: number;
}

export type AppSection = "metronome" | "flow" | "lyrics" | "breath";
