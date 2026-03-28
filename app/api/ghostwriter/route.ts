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

interface DoubleRhyme {
  lines: [number, number];
  rhymingSyllables: string;
  type: "double" | "single";
}

interface InternalRhyme {
  lineIndex: number;
  words: string[];
}

export interface VerseData {
  lines: string[];
  syllableCounts: number[];
  rhymeScheme: "AABB" | "ABAB" | "ABBA" | "AAAA";
  doubleRhymes: DoubleRhyme[];
  internalRhymes: InternalRhyme[];
  flowPattern: "senkoplu" | "düz" | "triplet";
  verseType: "verse" | "hook" | "bridge";
  meaningNote: string;
}

interface GenerateResponse {
  verse: VerseData;
  styleNotes: string;
  qualityScore: number;
}

interface ContinueResponse {
  lines: string[];
  section: "verse" | "hook" | "bridge";
  narrativeNote: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `Sen güçlü, özgün Türkçe rap sözleri üreten ve analiz eden bir yapay zekasın.
Türkçe fonetiği, ünlü uyumu, ünsüz kümeleri ve rap metriğini derinlemesine anlıyorsun.
Türkçe sokak argosunu ve kültürel referansları bağlama göre yerinde kullanabiliyorsun.
Sana bir karakter verildiğinde, O KARAKTERSİN — dışarıdan anlatmaz, içeriden yaşarsın.
Klişeyi reddedersin. Her satırın somut, özgün ve gerçek bir insan sesinden gelmesini sağlarsın.
Her zaman yalnızca geçerli JSON döndür — markdown bloğu, yorum veya JSON dışında hiçbir şey yazma.`;

// ---------------------------------------------------------------------------
// Strong vs. weak line examples — injected into every generate/continue prompt
// ---------------------------------------------------------------------------
const STRONG_WEAK_EXAMPLES = `
GÜÇLÜ vs. ZAYIF SATIR ÖRNEKLERİ (bunları referans al):
❌ ZAYIF: "Sokaklar ağlıyor, kalbim yandı bu gece"           → klişe, soyut, görsel yok
✓ GÜÇLÜ: "Bodrum katı, tek ampul, fatura kapalı üç ay"       → somut sahne, spesifik detay

❌ ZAYIF: "Hayat zor ama ben güçlüyüm, vazgeçmem"            → motivasyon posteri
✓ GÜÇLÜ: "Annem saat beşte kalkar, ellerim onun elleri"      → duygusal, kişisel, görsel

❌ ZAYIF: "Düşmanlarım çok ama ben kazanacağım"               → belirsiz, sloganlaşmış
✓ GÜÇLÜ: "Yüzüme gülen adama bile borçluyum kira"           → özgül, gerçekçi, karmaşık

❌ ZAYIF: "Paranın olmadığı yerde aşk da olmaz"              → aforizm, sığ
✓ GÜÇLÜ: "Son yüz lirayı böldük, o sigara ben ekmek"        → sahne, detay, iki karakter

❌ ZAYIF: "Gözlerim yaşlı, içim boş, yolum uzun"             → duygusal liste, anlamsız
✓ GÜÇLÜ: "Babam hâlâ aynı koltuğa oturuyor, on yıldır"     → zaman + mekân + karakter
`;

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
  characterDNA?: CharacterDNA,
): string {
  const ts = targetSyllables(bpm);
  const isSokak = userStyle.tone === "sokak" || characterDNA?.tone === "agresif" || characterDNA?.tone === "öfkeli";
  const flowInstr = flowStyleInstruction(flowStyle, ts);
  const rapperInstr = rapperRhythmInstruction(rapperStyle);
  const rhythmInstr = rhythmPatternInstruction(rhythmPattern);

  // BPM-based syllable guidance
  const sylGuide = bpm < 100
    ? "8-11 hece/satır (yavaş tempo)"
    : bpm < 130
    ? "10-14 hece/satır (orta tempo)"
    : "12-16 hece/satır (hızlı tempo)";

  const identityBlock = characterDNA
    ? `SEN ${characterDNA.name.toUpperCase()}'SIN.
Birinci şahıs olarak düşün, hisset, yaz. Dışarıdan anlatma — içeriden yaşa.
"O" diye değil, "ben" diye konuş. Bu karakterin deri altından bak dünyaya.
İmza kelimelerin: ${characterDNA.signatureWords.join(", ")} — bunları organik olarak kullan.`
    : `SANATÇI STİL PROFİLİ:
- Ton: ${userStyle.tone}
- Kelime Dağarcığı: ${userStyle.vocabulary.join(", ")}
- Sevdiği Kelimeler: ${userStyle.favoriteWords.join(", ")}
- Temalar: ${userStyle.themes.join(", ")}
- Kafiye Düzeni: ${userStyle.rhymePattern}
- Flow Stili: ${userStyle.flowStyle}
- Eşsiz Özellikler: ${userStyle.uniqueTraits.join("; ")}
${userStyle.commonStructures?.length ? `- Cümle Yapıları: ${userStyle.commonStructures.join("; ")}` : ""}
${userStyle.metaphorTypes?.length ? `- Metafor Türleri: ${userStyle.metaphorTypes.join("; ")}` : ""}
${userStyle.sentenceLength ? `- Cümle Uzunluğu: ${userStyle.sentenceLength}` : ""}`;

  const forbiddenExtra = characterDNA?.forbiddenWords.length
    ? `\n- Karakterin yasaklı kelimeleri: ${characterDNA.forbiddenWords.join(", ")} (ASLA kullanma)`
    : "";

  return `${identityBlock}

GÖREV:
Konu/Prompt: "${prompt}"
BPM: ${bpm} → ${sylGuide}
Kafiye şeması: ${rhymeScheme || userStyle.rhymePattern}
${isSokak ? "Ton: sokak/agresif — gündelik Türkçe argosunu, sokak dilini kullan\n" : ""}${flowInstr}
${rapperInstr}${rhythmInstr}
${STRONG_WEAK_EXAMPLES}

DÖRTLÜK KURALLARI (BUNLARA KESİNLİKLE UY):
1. TAM OLARAK 4 SATIR YAZ — ne eksik ne fazla
2. DOUBLE RHYME zorunlu: son 2 hece kafiyeli olmalı (ör: "karanlık-ta" / "yalnız-lık-ta")
3. Kafiye şeması: satır 1-2 birbiriyle (AA), satır 3-4 birbiriyle (BB) — veya çapraz kafiye (ABAB)
4. İÇ KAFIYE bonus: satır içinde de kafiye kurabilirsen ekle
5. 4 satır birlikte TAM BİR DÜŞÜNCE anlatmalı — yarım bırakma
6. VOLTA: 3. veya 4. satırda beklenmedik bir dönüş/sürpriz olsun
7. PUNCH LINE: Son satır en güçlü, en keskin satır olsun
8. İLK SATIR KANCA: İlk 3 kelimede dinleyiciyi yakala — in medias res başla

GENIUS.COM REFERANS ÇERÇEVESİ:
TÜRKÇE EKOL:
- Baby Gang/GNG: Kısa, keskin, ağır. Her kelime sert iner.
- Şanışer: Uzun soluklu satırlar, iç monolog, felsefi soru işaretleri
- Ceza: Teknik kafiye, iç kafiye ustası, Türkçeyi zorlayan kelime seçimi
- Ezhel: Görsel imgeler, laid-back ama derin, şehir şiiri

ULUSLARARASI EKOL:
- Kendrick Lamar: Her dörtlük bir hikayenin bölümü. İç çatışma.
- J.Cole: Autobiografik detay, 'show don't tell'
- Nas: Sokak gazetecisi. Somut gözlem. Zaman ve mekan.
- Jay-Z: Çift anlam, ekonomik kelime, her satır punch

BÜYÜK PRENSİPLER:
- 'Show don't tell': 'üzgündüm' değil, üzüntüyü bir eylemle göster
- Spesifik detay: 'ayakkabım eskidi' > 'yokluk içindeydim'
- Punch line: Son satır en güçlü satır

YASAK:
- "sokaklar ağlıyor", "kalbim yandı", "hayat zor", "gözlerim yaşlı", "yolum uzun", "vazgeçmem", "güçlüyüm" gibi klişeler
- Motivasyon posteri ve aforizm tarzı sloganlar
- Soyut duygusal listeler${forbiddenExtra}

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "verse": {
    "lines": ["satır1", "satır2", "satır3", "satır4"],
    "syllableCounts": [10, 11, 10, 11],
    "rhymeScheme": "AABB",
    "doubleRhymes": [{"lines": [0, 1], "rhymingSyllables": "kafiyeli-ek", "type": "double"}, {"lines": [2, 3], "rhymingSyllables": "kafiyeli-ek2", "type": "double"}],
    "internalRhymes": [],
    "flowPattern": "senkoplu",
    "verseType": "verse",
    "meaningNote": "Bu dörtlüğün anlam özeti 1 cümle"
  },
  "styleNotes": "${characterDNA ? "Karakterin sesine" : "Sanatçı stiline"} nasıl uyduğuna dair kısa not",
  "qualityScore": 8
}`;
}

function continuePrompt(
  lyrics: string,
  userStyle: StyleProfile,
  bpm: number,
  characterDNA?: CharacterDNA,
): string {
  const ts = targetSyllables(bpm);
  const isSokak = userStyle.tone === "sokak" || characterDNA?.tone === "agresif" || characterDNA?.tone === "öfkeli";
  const allLines = lyrics.trim().split("\n").filter(Boolean);
  // Use last 6 lines for context, track total count for section detection
  const contextLines = allLines.slice(-6).join("\n");
  const lineCount = allLines.length;
  const nextSection =
    lineCount < 4 ? "verse" : lineCount < 8 ? "hook" : lineCount < 12 ? "verse" : "bridge";

  const identityBlock = characterDNA
    ? `SEN ${characterDNA.name.toUpperCase()}'SIN.
Yazdığın sözleri devam ettiriyorsun — birinci şahıs, içeriden, kendi sesinle.
Dışarıdan bakma. O anı, o duyguyu, o sahneyi sen yaşıyorsun.
İmza kelimelerin: ${characterDNA.signatureWords.join(", ")}`
    : `SANATÇI STİL PROFİLİ:
- Ton: ${userStyle.tone}
- Kelime Dağarcığı: ${userStyle.vocabulary.join(", ")}
- Sevdiği Kelimeler: ${userStyle.favoriteWords.join(", ")}
- Flow Stili: ${userStyle.flowStyle}
- Eşsiz Özellikler: ${userStyle.uniqueTraits.join("; ")}
${userStyle.commonStructures?.length ? `- Cümle Yapıları: ${userStyle.commonStructures.join("; ")}` : ""}
${userStyle.metaphorTypes?.length ? `- Metafor Türleri: ${userStyle.metaphorTypes.join("; ")}` : ""}
${isSokak ? "- Sokak tonu: argo ve gündelik dil kullan" : ""}`;

  const forbiddenExtra = characterDNA?.forbiddenWords.length
    ? `\n- Karakterin yasaklı kelimeleri: ${characterDNA.forbiddenWords.join(", ")} (ASLA kullanma)`
    : "";

  const sectionGoal = nextSection === "hook"
    ? "Hook için 2-4 satır yaz — tekrarlanabilir, akılda kalıcı, duygusal doruk"
    : nextSection === "bridge"
    ? "Bridge için 2-4 satır yaz — yön değişikliği, beklenmedik bir bakış açısı, duygusal kırılma"
    : "Verse için 4-6 satır yaz — hikayeyi ilerlet, yeni bir detay veya sahne ekle";

  return `${identityBlock}

MEVCUT SÖZLER (son ${Math.min(6, lineCount)} satır):
"""
${contextLines}
"""
(Toplam yazılan: ${lineCount} satır)

GÖREV: ${sectionGoal}
BPM: ${bpm} → hedef hece/satır: ${ts.ideal} (aralık: ${ts.min}–${ts.max})
${isSokak ? "Ton: sokak/agresif — gündelik Türkçe argosunu kullan\n" : ""}
${STRONG_WEAK_EXAMPLES}

ZORUNLU KURALLAR:
1. Anlatının duygusal ve tematik akışını koru — son satırın enerjisinden organik olarak çık, kopukluk yok
2. Her satır ${ts.min}–${ts.max} hece arasında olmalı
3. Son satırların kafiye şemasını devam ettir
4. ${characterDNA ? "Karakterin sesi tutarlı kalsın — sanki aynı insan, aynı nefeste devam ediyor" : "Sanatçının sesini koru — sanki aynı kişi yazmış gibi"}
5. Her yeni satırda somut bir imge, sahne veya spesifik detay olsun
6. Türkçe yaz, hiçbir İngilizce kelime kullanma

YASAK:
- "sokaklar ağlıyor", "kalbim yandı", "hayat zor", "gözlerim yaşlı", "yolum uzun" gibi klişeler
- Motivasyon posteri sloganları
- Soyut duygusal liste satırları ("içim boş, ruhum dolu, kalbim kırık")${forbiddenExtra}

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
      ? generatePrompt(userStyle!, prompt!, bpm, rhymeScheme ?? "AABB", flowStyle, rapperStyle, rhythmPattern, characterDNA)
      : continuePrompt(lyrics!, userStyle!, bpm, characterDNA)
  );

  const maxTokens = mode === "analyze" ? 900 : mode === "generate" ? 800 : 800;

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
    if (mode === "generate" && !("verse" in parsed)) {
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
