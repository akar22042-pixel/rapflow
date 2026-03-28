import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { FLOW_PATTERNS_BY_ARTIST } from "@/lib/flowPatterns";
import { CharacterDNA, getCharacterPrompt } from "@/lib/characterDNA";

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
  commonStructures?: string[];
  metaphorTypes?: string[];
  sentenceLength?: "kısa" | "orta" | "uzun";
}

interface GhostwriterRequest {
  mode: "analyze" | "generate" | "continue";
  lyrics?: string;
  userStyle?: StyleProfile;
  prompt?: string;
  bpm: number;
  style?: string;
  rhymeScheme?: string;
  flowStyle?: string;     // "hızlı" | "yavaş" | "triplet" | "serbest" | "aynı"
  rapperStyle?: string;   // rapper name for rhythm injection
  rhythmPattern?: string; // e.g. "[3-2-3]"
  characterDNA?: CharacterDNA;
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
  commonStructures: string[];
  metaphorTypes: string[];
  sentenceLength: "kısa" | "orta" | "uzun";
}

interface GenerateResponse {
  lines: string[];
  syllableCounts: number[];
  rhymesWith: string;
  styleNotes: string;
  flowUsed?: string;
}

interface ContinueResponse {
  lines: string[];
  section: "verse" | "hook" | "bridge";
  narrativeNote: string;
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
// ---------------------------------------------------------------------------
function targetSyllables(bpm: number): { min: number; max: number; ideal: number } {
  const syl = Math.round((bpm / 60) * 4 * 1 * 0.9);
  return { min: syl - 2, max: syl + 3, ideal: syl };
}

// ---------------------------------------------------------------------------
// Flow style instructions injected into generate prompt
// ---------------------------------------------------------------------------
function flowStyleInstruction(flowStyle: string | undefined, ts: ReturnType<typeof targetSyllables>): string {
  switch (flowStyle) {
    case "hızlı":
      return `FLOW STİLİ: Hızlı akış. Her satırda ${ts.ideal + 2}–${ts.max + 3} hece hedefle. ` +
        `Kısa keskin kelimeler, üst üste binen kelime grupları, nefes almadan akan satırlar.`;
    case "yavaş":
      return `FLOW STİLİ: Yavaş dramatik akış. Her satırda ${Math.max(4, ts.min - 2)}–${ts.ideal} hece hedefle. ` +
        `Kelimeler arası dramatik duraklar, güçlü vurgulu sonlar, her hece ağırlıklı söylenir.`;
    case "triplet":
      return `FLOW STİLİ: Triplet (üçlü) akış. Satırları 3'lü hece gruplarına böl: [3-3-3] veya [3-2-3] gibi. ` +
        `Her üçlükte bir vurgulu hece. Senkoplu, sallanan bir ritim hissi yarat. ` +
        `Heceleme: bir-iki-ÜÇ / bir-iki-ÜÇ kalıbı.`;
    case "serbest":
      return `FLOW STİLİ: Serbest akış. Hece sayısı kısıtı yok — iç ritim ve doğal konuşma temposunu takip et. ` +
        `Kafiye ve anlam öncelikli, metrik kısıtlama ikincil.`;
    default:
      return `FLOW STİLİ: Dengeli akış. ${ts.min}–${ts.max} hece/satır, sanatçının doğal temposu.`;
  }
}

// ---------------------------------------------------------------------------
// Rapper rhythm injection from flowPatterns
// ---------------------------------------------------------------------------
function rapperRhythmInstruction(rapperStyle: string | undefined): string {
  if (!rapperStyle) return "";
  const patterns = FLOW_PATTERNS_BY_ARTIST[rapperStyle];
  if (!patterns?.length) return "";
  const p = patterns[0];
  return `\nRAPPER AKIŞ TARZI — ${rapperStyle} (${p.song}):\n` +
    `Ritim hissi: "${p.rhythmDescription}"\n` +
    `Onomatope: ${p.onomatopoeia}\n` +
    `Bu sanatçının ritim kalıbını taklit et. Aynı vurgu ve senkop yerleşimini hedefle.\n`;
}

// ---------------------------------------------------------------------------
// Rhythm pattern instruction
// ---------------------------------------------------------------------------
function rhythmPatternInstruction(rhythmPattern: string | undefined): string {
  if (!rhythmPattern) return "";
  return `\nRİTİM KALIBI: Satırları ${rhythmPattern} hece grubuna böl. ` +
    `Her grup kendi içinde bir ritim birimi oluşturmalı.\n`;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function analyzePrompt(lyrics: string, bpm: number): string {
  const ts = targetSyllables(bpm);
  return `Aşağıdaki Türkçe rap sözlerini analiz et ve bu sanatçının kapsamlı stil profilini çıkar.
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
- commonStructures: en sık tekrarlanan cümle yapı kalıpları (en az 3 örnek, örn: "X var Y yok", "Ben X sen Y", "özne+eylem+nesne", "soru-cevap yapısı")
- metaphorTypes: kullanılan metafor ve somut imge türleri (en az 3, örn: "şehir=savaş alanı", "doğa metaforları", "şehir imgeleri")
- sentenceLength: baskın cümle uzunluğu — "kısa" (1-6 hece), "orta" (7-10 hece), "uzun" (11+ hece)

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "vocabulary": ["kelime1", "kelime2", ...],
  "themes": ["tema1", "tema2", ...],
  "rhymePattern": "<kafiye düzeni>",
  "avgSyllables": <sayı>,
  "favoriteWords": ["kelime1", ...],
  "tone": "<agresif|melankolik|motivasyon|sokak|edebi>",
  "flowStyle": "<Türkçe açıklama>",
  "uniqueTraits": ["özellik1", "özellik2", ...],
  "commonStructures": ["yapı1", "yapı2", ...],
  "metaphorTypes": ["metafor1", "metafor2", ...],
  "sentenceLength": "<kısa|orta|uzun>"
}`;
}

function generatePrompt(
  userStyle: StyleProfile,
  prompt: string,
  bpm: number,
  rhymeScheme: string,
  flowStyle: string | undefined,
  rapperStyle: string | undefined,
  rhythmPattern: string | undefined,
): string {
  const ts = targetSyllables(bpm);
  const isSokak = userStyle.tone === "sokak";
  const flowInstr = flowStyleInstruction(flowStyle, ts);
  const rapperInstr = rapperRhythmInstruction(rapperStyle);
  const rhythmInstr = rhythmPatternInstruction(rhythmPattern);

  return `Sen bu sanatçının ghostwriter'ısın. Sanatçının tarzını mükemmel şekilde taklit etmelisin.

SANATÇI STİL PROFİLİ:
- Ton: ${userStyle.tone}
- Kelime Dağarcığı: ${userStyle.vocabulary.join(", ")}
- Sevdiği Kelimeler: ${userStyle.favoriteWords.join(", ")}
- Temalar: ${userStyle.themes.join(", ")}
- Kafiye Düzeni: ${userStyle.rhymePattern}
- Flow Stili: ${userStyle.flowStyle}
- Eşsiz Özellikler: ${userStyle.uniqueTraits.join("; ")}
${userStyle.commonStructures?.length ? `- Cümle Yapıları: ${userStyle.commonStructures.join("; ")}` : ""}
${userStyle.metaphorTypes?.length ? `- Metafor Türleri: ${userStyle.metaphorTypes.join("; ")}` : ""}
${userStyle.sentenceLength ? `- Cümle Uzunluğu: ${userStyle.sentenceLength}` : ""}

GÖREV PARAMETRELERİ:
- BPM: ${bpm}
- Kafiye şeması: ${rhymeScheme || userStyle.rhymePattern}
- Konu/Prompt: "${prompt}"
${isSokak ? "- DİKKAT: Sokak tonu — gündelik Türkçe argosunu, sokak dilini kullan\n" : ""}
${flowInstr}
${rapperInstr}${rhythmInstr}

YAZIM KURALLARI — BUNLARA KESİNLİKLE UY:
1. Tam olarak 2-4 satır yaz
2. Her satır kendi başına anlamlı ve tamamlanmış bir düşünce olmalı
3. Kelimeler arasında mantıksal ve duygusal bağ kurulmalı — anlamsız dizme yasak
4. KLİŞELERDEN KAÇIN: "sokaklar ağlıyor", "kalbim yandı", "hayat zor", "gözlerim yaşlı", "yolum uzun" gibi ifadeler kullanma
5. Türkçe günlük konuşma diline yakın, doğal ses — yapay veya edebi değil
6. Her satırda güçlü bir somut imge veya spesifik bir detay olsun (soyut genel laflardan kaçın)
7. Kafiye şemasına uy: ${rhymeScheme || userStyle.rhymePattern}
8. Sanatçının sesini ve tonunu koru
9. Türkçe yaz, hiçbir İngilizce kelime kullanma

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "lines": ["satır1", "satır2", ...],
  "syllableCounts": [<satır1 hece sayısı>, <satır2 hece sayısı>, ...],
  "rhymesWith": "<yeni satırların kafiye kurduğu kelime/ek>",
  "styleNotes": "<bu satırların sanatçı stiline nasıl uyduğuna dair kısa Türkçe not>",
  "flowUsed": "<kullanılan flow stilinin kısa adı>"
}`;
}

function continuePrompt(
  lyrics: string,
  userStyle: StyleProfile,
  bpm: number,
): string {
  const ts = targetSyllables(bpm);
  const isSokak = userStyle.tone === "sokak";
  const allLines = lyrics.trim().split("\n").filter(Boolean);
  // Use last 6 lines for context, track total count for section detection
  const contextLines = allLines.slice(-6).join("\n");
  const lineCount = allLines.length;
  const nextSection =
    lineCount < 4 ? "verse" : lineCount < 8 ? "hook" : lineCount < 12 ? "verse" : "bridge";

  return `Sen bu sanatçının ghostwriter'ısın. Mevcut sözleri doğal bir şekilde devam ettir.

SANATÇI STİL PROFİLİ:
- Ton: ${userStyle.tone}
- Kelime Dağarcığı: ${userStyle.vocabulary.join(", ")}
- Sevdiği Kelimeler: ${userStyle.favoriteWords.join(", ")}
- Flow Stili: ${userStyle.flowStyle}
- Eşsiz Özellikler: ${userStyle.uniqueTraits.join("; ")}
${userStyle.commonStructures?.length ? `- Cümle Yapıları: ${userStyle.commonStructures.join("; ")}` : ""}
${userStyle.metaphorTypes?.length ? `- Metafor Türleri: ${userStyle.metaphorTypes.join("; ")}` : ""}
${isSokak ? "- Sokak tonu: argo ve gündelik dil kullan" : ""}

SON 6 SATIR (BAĞLAM):
"""
${contextLines}
"""
(Toplam ${lineCount} satır yazıldı)

GÖREV PARAMETRELERİ:
- BPM: ${bpm} → satır başına hedef hece: ${ts.ideal} (aralık: ${ts.min}–${ts.max})
- Yazılacak bölüm: ${nextSection}
- ${nextSection === "hook" ? "Hook için 2-4 tekrarlanabilir, akılda kalıcı satır yaz" :
    nextSection === "bridge" ? "Bridge için 2-4 yön değiştiren, duygusal kırılma yaratan satır yaz" :
    "Verse için 4-6 satır yaz, hikayeyi ilerlet"}

YAZIM KURALLARI:
1. Anlatının duygusal ve tematik akışını koru, hikayeyi ilerlet — mevcut temayı ve son satırın duygusunu organik olarak sürdür, kopukluk yok
2. Her satır ${ts.min}–${ts.max} hece arasında olmalı
3. Son satırın kafiye şemasını devam ettir
4. Sanatçının sesini koru — sanki aynı kişi yazmış gibi hissettir
5. KLİŞEDEN KAÇIN: "sokaklar ağlıyor", "kalbim yandı" gibi ifadeler kullanma
6. Her satırda somut bir imge veya spesifik detay olsun
7. Türkçe yaz, hiçbir İngilizce kelime kullanma

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "lines": ["satır1", "satır2", ...],
  "section": "${nextSection}",
  "narrativeNote": "<devam ettirilen hikaye ipliğini 1 cümleyle açıkla>"
}`;
}

// ---------------------------------------------------------------------------
// JSON parse helper
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

  const { mode, lyrics, userStyle, prompt, bpm, rhymeScheme, flowStyle, rapperStyle, rhythmPattern, characterDNA } = body;

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
    return NextResponse.json({ error: "lyrics is required for analyze mode" }, { status: 400 });
  }
  if (mode === "generate" && (!userStyle || !prompt?.trim())) {
    return NextResponse.json({ error: "userStyle and prompt are required for generate mode" }, { status: 400 });
  }
  if (mode === "continue" && (!lyrics?.trim() || !userStyle)) {
    return NextResponse.json({ error: "lyrics and userStyle are required for continue mode" }, { status: 400 });
  }

  // Build character prefix (injected at the START of every user prompt)
  const characterPrefix = characterDNA ? getCharacterPrompt(characterDNA) + "\n\n---\n\n" : "";

  const userPrompt = characterPrefix + (
    mode === "analyze"
      ? analyzePrompt(lyrics!, bpm)
      : mode === "generate"
      ? generatePrompt(userStyle!, prompt!, bpm, rhymeScheme ?? "AABB", flowStyle, rapperStyle, rhythmPattern)
      : continuePrompt(lyrics!, userStyle!, bpm)
  );

  const maxTokens = mode === "analyze" ? 900 : mode === "generate" ? 700 : 800;

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
      return NextResponse.json({ error: "Model returned non-JSON response", raw }, { status: 502 });
    }

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
