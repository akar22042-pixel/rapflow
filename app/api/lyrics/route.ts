import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

const MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------
interface LyricsRequest {
  text: string;
  bpm: number;
  style: string;
  mode: "rhyme" | "complete" | "flow_pattern";
}

interface RhymeSuggestion {
  word: string;
  rhymes: { word: string; matchingSyllables: number }[];
}
interface RhymeResponse {
  suggestions: RhymeSuggestion[];
}

interface CompleteResponse {
  line: string;
  syllableCount: number;
  rhymesWith: string;
}

interface FlowBeat {
  beat: number;
  syllables: number;
  stress: string;
  exampleLine: string;
}
interface FlowPatternResponse {
  pattern: FlowBeat[];
  description: string;
  tipsTurkish: string;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const SYSTEM_BASE = `You are an expert Turkish rap lyricist and flow analyst.
You understand Turkish phonetics, vowel harmony, consonant clusters, and rap meter deeply.
Always respond with valid JSON only — no markdown fences, no commentary outside the JSON object.`;

function rhymePrompt(text: string, bpm: number, style: string): string {
  return `Analyze the last word of each line in the following Turkish rap lyrics.
For each unique end-word, find at least 3 Turkish rhymes, prioritising:
1. Double rhymes (çift kafiye) — last two syllables match
2. Multisyllabic rhymes (çok heceli kafiye) — 3+ matching syllables
3. Near rhymes and assonance as fallback

Context: BPM is ${bpm}, rapper style is "${style}".

Lyrics:
"""
${text}
"""

Return ONLY this JSON structure (no other text):
{
  "suggestions": [
    {
      "word": "<end-word from lyrics>",
      "rhymes": [
        { "word": "<rhyming word>", "matchingSyllables": <integer 1-5> }
      ]
    }
  ]
}`;
}

function completePrompt(text: string, bpm: number, style: string): string {
  const targetSyllables = Math.round(bpm / 30) * 4; // syllables per bar
  return `You are completing a Turkish rap verse.
Rapper style: "${style}", BPM: ${bpm}, target syllables per line: ~${targetSyllables}.

Here are the existing lines:
"""
${text}
"""

Write exactly ONE next line that:
- Continues the theme and narrative naturally
- Rhymes with the last line's end-word (use double or multisyllabic rhyme)
- Matches the syllable count of the previous line (within ±2)
- Fits the "${style}" delivery style and energy

Return ONLY this JSON structure (no other text):
{
  "line": "<the completed Turkish rap line>",
  "syllableCount": <integer>,
  "rhymesWith": "<the word from the previous line it rhymes with>"
}`;
}

function flowPatternPrompt(text: string, bpm: number, style: string): string {
  return `Generate a detailed flow pattern for a Turkish rap verse in the style of "${style}" at ${bpm} BPM.

Reference text (for thematic context):
"""
${text || "(no reference text — generate a generic pattern for this style)"}
"""

The flow pattern should cover one full bar (4 beats for 4/4, adjust for the style).
For each beat position, specify:
- beat: beat number (1-indexed)
- syllables: syllables landing on or between this beat
- stress: one of "downbeat", "upbeat", "triplet", "sixteenth", "rest"
- exampleLine: a short Turkish example phrase (3-8 syllables) demonstrating this beat's placement

Also provide:
- description: 2-3 sentences (in English) describing this flow pattern's characteristics
- tipsTurkish: 2-3 practical tips in Turkish for a rapper learning this flow

Return ONLY this JSON structure (no other text):
{
  "pattern": [
    {
      "beat": <integer>,
      "syllables": <integer>,
      "stress": "<downbeat|upbeat|triplet|sixteenth|rest>",
      "exampleLine": "<Turkish example phrase>"
    }
  ],
  "description": "<English description>",
  "tipsTurkish": "<Turkish tips>"
}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: LyricsRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, bpm, style, mode } = body;

  if (!mode || !["rhyme", "complete", "flow_pattern"].includes(mode)) {
    return NextResponse.json(
      { error: 'mode must be "rhyme", "complete", or "flow_pattern"' },
      { status: 400 }
    );
  }
  if (typeof bpm !== "number" || bpm < 60 || bpm > 200) {
    return NextResponse.json(
      { error: "bpm must be a number between 60 and 200" },
      { status: 400 }
    );
  }
  if (!style || typeof style !== "string") {
    return NextResponse.json({ error: "style is required" }, { status: 400 });
  }

  const userPrompt =
    mode === "rhyme"
      ? rhymePrompt(text ?? "", bpm, style)
      : mode === "complete"
      ? completePrompt(text ?? "", bpm, style)
      : flowPatternPrompt(text ?? "", bpm, style);

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_BASE,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: RhymeResponse | CompleteResponse | FlowPatternResponse;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Claude occasionally wraps JSON in backticks — strip and retry
      const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      try {
        parsed = JSON.parse(stripped);
      } catch {
        return NextResponse.json(
          { error: "Model returned non-JSON response", raw },
          { status: 502 }
        );
      }
    }

    // Validate required top-level keys per mode
    if (mode === "rhyme" && !("suggestions" in parsed)) {
      return NextResponse.json(
        { error: "Unexpected response shape from model", raw },
        { status: 502 }
      );
    }
    if (mode === "complete" && !("line" in parsed)) {
      return NextResponse.json(
        { error: "Unexpected response shape from model", raw },
        { status: 502 }
      );
    }
    if (mode === "flow_pattern" && !("pattern" in parsed)) {
      return NextResponse.json(
        { error: "Unexpected response shape from model", raw },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message.includes("authentication") ? 401
      : message.includes("rate") ? 429
      : message.includes("overload") ? 503
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
