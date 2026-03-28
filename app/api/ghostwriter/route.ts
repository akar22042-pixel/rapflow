import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

const MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

type Tone = "agresif" | "melankolik" | "motivasyon" | "sokak" | "edebi";

interface StyleProfile {
  vocabulary: string[];
  themes: string[];
  rhymePattern: string;
  avgSyllables: number;
  favoriteWords: string[];
  tone: Tone;
  flowStyle: string;
  uniqueTraits: string[];
}

interface GhostwriterRequest {
  mode: "analyze" | "generate" | "continue";
  lyrics?: string;
  userStyle?: StyleProfile;
  prompt?: string;
  bpm: number;
  rhymeScheme?: string; // e.g. "AABB", "ABAB"
}

interface AnalyzeResponse {
  vocabulary: string[];
  themes: string[];
  rhymePattern: string;
  avgSyllables: number;
  favoriteWords: string[];
  tone: Tone;
  flowStyle: string;
  uniqueTraits: string[];
}

interface GenerateResponse {
  lines: string[];
  syllableCounts: number[];
  rhymesWith: string;
  styleNotes: string;
}

interface ContinueResponse {
  lines: string[];
  section: "verse" | "hook" | "bridge";
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `Sen uzman bir Türkçe rap söz yazarı ve flow analistsin.
Türkçe fonetiği, ünlü uyumu, ünsüz kümeleri ve rap metriğini derinlemesine anlıyorsun.
Türkçe sokak argosunu, argo kelimeleri ve kültürel referansları bağlama göre kullanabiliyorsun.
Her zaman yalnızca geçerli JSON döndür — markdown bloğu, yorum veya JSON dışında hiçbir şey yazma.`;

// ---------------------------------------------------------------------------
// Target syllables per line derived from BPM
// 1 bar at given BPM ≈ (BPM / 60) beats/sec; typical rap line = 1–2 bars
// A comfortable syllables-per-line target at 100 BPM ~ 8–12
// ---------------------------------------------------------------------------
function targetSyllables(bpm: number): { min: number; max: number; ideal: number } {
  const beatsPerBar  = 4;
  const barsPerLine  = 1;
  const syl          = Math.round((bpm / 60) * beatsPerBar * barsPerLine * 0.9);
  return { min: syl - 2, max: syl + 3, ideal: syl };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function analyzePrompt(lyrics: string, bpm: number): string {
  const ts = targetSyllables(bpm);
  return `Aşağıdaki Türkçe rap sözlerini analiz et ve bu sanatçının stil profilini çıkar.
BPM: ${bpm} (ideal hece sayısı/satır: ~${ts.ideal}, aralık: ${ts.min}–${ts.max})

Sözler:
"""
${lyrics}
"""

Analiz kriterleri:
- vocabulary: sanatçının sık kullandığı ve karakteristik kelime türleri (en az 8 örnek kelime)
- themes: tekrar eden temalar ve konular (en az 3)
- rhymePattern: kafiye yapısı (örn: "AABB", "ABAB", "AAAA", "karma")
- avgSyllables: satır başına ortalama hece sayısı (gerçek ölçüm yap)
- favoriteWords: metinde 2+ kez geçen veya çok karakteristik olan kelimeler (en az 5)
- tone: baskın ton — "agresif", "melankolik", "motivasyon", "sokak", veya "edebi"
- flowStyle: flow stilinin kısa açıklaması (Türkçe, 1-2 cümle)
- uniqueTraits: bu sanatçıya özgü eşsiz özellikler (en az 3 madde)

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "vocabulary": ["kelime1", "kelime2", ...],
  "themes": ["tema1", "tema2", ...],
  "rhymePattern": "<kafiye düzeni>",
  "avgSyllables": <sayı>,
  "favoriteWords": ["kelime1", ...],
  "tone": "<agresif|melankolik|motivasyon|sokak|edebi>",
  "flowStyle": "<Türkçe açıklama>",
  "uniqueTraits": ["özellik1", "özellik2", ...]
}`;
}

function generatePrompt(
  userStyle: StyleProfile,
  prompt: string,
  bpm: number,
  rhymeScheme: string,
): string {
  const ts = targetSyllables(bpm);
  const isSokak = userStyle.tone === "sokak";
  return `Sen bu sanatçının ghostwriter'ısın. Sanatçının tarzını mükemmel şekilde taklit etmelisin.

SANATÇI STİL PROFİLİ:
- Ton: ${userStyle.tone}
- Kelime Dağarcığı: ${userStyle.vocabulary.join(", ")}
- Sevdiği Kelimeler: ${userStyle.favoriteWords.join(", ")}
- Temalar: ${userStyle.themes.join(", ")}
- Kafiye Düzeni: ${userStyle.rhymePattern}
- Flow Stili: ${userStyle.flowStyle}
- Eşsiz Özellikler: ${userStyle.uniqueTraits.join("; ")}

GÖREV PARAMETRELERİ:
- BPM: ${bpm} → satır başına hedef hece: ${ts.ideal} (aralık: ${ts.min}–${ts.max})
- Devam ettirilen kafiye şeması: ${rhymeScheme || userStyle.rhymePattern}
- Konu/Prompt: "${prompt}"
${isSokak ? "- DİKKAT: Sokak tonu — gündelik Türkçe argosunu, sokak dilini ve argo kelimeleri kullan" : ""}

YAZIM KURALLARI:
1. Tam olarak 2-4 satır yaz
2. Her satır ${ts.min}–${ts.max} hece arasında olmalı (ideal: ${ts.ideal})
3. Kafiye şemasına uy: ${rhymeScheme || userStyle.rhymePattern}
4. Sanatçının sevdiği kelimeleri doğal olarak entegre et
5. Sanatçının sesini ve tonunu koru — SESSİZ TAKLİT ET, özgün hisset
6. Türkçe yaz, hiçbir İngilizce kelime kullanma

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "lines": ["satır1", "satır2", ...],
  "syllableCounts": [<satır1 hece sayısı>, <satır2 hece sayısı>, ...],
  "rhymesWith": "<yeni satırların kafiye kurduğu kelime/ek>",
  "styleNotes": "<bu satırların sanatçı stiline nasıl uyduğuna dair kısa Türkçe not>"
}`;
}

function continuePrompt(
  lyrics: string,
  userStyle: StyleProfile,
  bpm: number,
): string {
  const ts = targetSyllables(bpm);
  const isSokak = userStyle.tone === "sokak";
  const lineCount = lyrics.trim().split("\n").filter(Boolean).length;
  // Guess which section comes next based on verse length
  const nextSection =
    lineCount < 4 ? "verse" : lineCount < 8 ? "hook" : lineCount < 12 ? "verse" : "bridge";

  return `Sen bu sanatçının ghostwriter'ısın. Mevcut sözleri doğal bir şekilde devam ettir.

SANATÇI STİL PROFİLİ:
- Ton: ${userStyle.tone}
- Kelime Dağarcığı: ${userStyle.vocabulary.join(", ")}
- Sevdiği Kelimeler: ${userStyle.favoriteWords.join(", ")}
- Flow Stili: ${userStyle.flowStyle}
- Eşsiz Özellikler: ${userStyle.uniqueTraits.join("; ")}
${isSokak ? "- Sokak tonu: argo ve gündelik dil kullan" : ""}

MEVCUT SÖZLER:
"""
${lyrics}
"""

GÖREV PARAMETRELERİ:
- BPM: ${bpm} → satır başına hedef hece: ${ts.ideal} (aralık: ${ts.min}–${ts.max})
- Yazılacak bölüm: ${nextSection}
- ${nextSection === "hook" ? "Hook için 2-4 tekrarlanabilir, akılda kalıcı satır yaz" :
    nextSection === "bridge" ? "Bridge için 2-4 yön değiştiren, duygusal kırılma yaratan satır yaz" :
    "Verse için 4-6 satır yaz, hikayeyi ilerlet"}

YAZIM KURALLARI:
1. Mevcut temayı ve anlatıyı organik olarak sürdür
2. Her satır ${ts.min}–${ts.max} hece arasında olmalı
3. Son satırın kafiye şemasını devam ettir
4. Sanatçının sesini koru — sanki aynı kişi yazmış gibi hissettir
5. Türkçe yaz, hiçbir İngilizce kelime kullanma

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "lines": ["satır1", "satır2", ...],
  "section": "${nextSection}"
}`;
}

// ---------------------------------------------------------------------------
// JSON parse helper (strips accidental markdown fences)
// ---------------------------------------------------------------------------
function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    return JSON.parse(stripped) as T;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: GhostwriterRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mode, lyrics, userStyle, prompt, bpm, rhymeScheme } = body;

  // Validation
  if (!mode || !["analyze", "generate", "continue"].includes(mode)) {
    return NextResponse.json(
      { error: 'mode must be "analyze", "generate", or "continue"' },
      { status: 400 }
    );
  }
  if (typeof bpm !== "number" || bpm < 60 || bpm > 220) {
    return NextResponse.json(
      { error: "bpm must be a number between 60 and 220" },
      { status: 400 }
    );
  }
  if (mode === "analyze" && !lyrics?.trim()) {
    return NextResponse.json(
      { error: "lyrics is required for analyze mode" },
      { status: 400 }
    );
  }
  if (mode === "generate" && (!userStyle || !prompt?.trim())) {
    return NextResponse.json(
      { error: "userStyle and prompt are required for generate mode" },
      { status: 400 }
    );
  }
  if (mode === "continue" && (!lyrics?.trim() || !userStyle)) {
    return NextResponse.json(
      { error: "lyrics and userStyle are required for continue mode" },
      { status: 400 }
    );
  }

  // Build prompt
  const userPrompt =
    mode === "analyze"
      ? analyzePrompt(lyrics!, bpm)
      : mode === "generate"
      ? generatePrompt(userStyle!, prompt!, bpm, rhymeScheme ?? "AABB")
      : continuePrompt(lyrics!, userStyle!, bpm);

  const maxTokens = mode === "analyze" ? 800 : mode === "generate" ? 512 : 640;

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: AnalyzeResponse | GenerateResponse | ContinueResponse;
    try {
      parsed = parseJSON(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON response", raw },
        { status: 502 }
      );
    }

    // Shape validation
    if (mode === "analyze" && !("vocabulary" in parsed)) {
      return NextResponse.json({ error: "Unexpected response shape", raw }, { status: 502 });
    }
    if (mode === "generate" && !("lines" in parsed && "syllableCounts" in parsed)) {
      return NextResponse.json({ error: "Unexpected response shape", raw }, { status: 502 });
    }
    if (mode === "continue" && !("lines" in parsed && "section" in parsed)) {
      return NextResponse.json({ error: "Unexpected response shape", raw }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status =
      msg.includes("authentication") ? 401
      : msg.includes("rate")         ? 429
      : msg.includes("overload")     ? 503
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
