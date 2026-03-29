// ---------------------------------------------------------------------------
// Lyric Intelligence — curated database of REAL Turkish rap lyric techniques
// This is the brain of the Ghost Writer
// ---------------------------------------------------------------------------

export interface TechniqueExample {
  artist?: string;
  song?: string;
  line?: string;
  technique: string;
  lesson: string;
  examples?: string[];
}

export interface SchoolRules {
  description: string;
  rules: string[];
}

// ---------------------------------------------------------------------------
// LYRIC MASTERCLASS — real analyzed examples
// ---------------------------------------------------------------------------
export const LYRIC_MASTERCLASS: Record<string, TechniqueExample[]> = {
  paradox: [
    {
      artist: "Aksan",
      song: "Düşman",
      line: "Hayalinde milyonersin ama para görmedin hiç, ona taptığın için",
      technique: "Paradoks + beklenmedik benzetme (para = tanrı)",
      lesson: "Somut bir gerçeği (fakirlik) soyut bir kavramla (ibadet) birleştir",
    },
    {
      artist: "Şanışer",
      song: "Suç",
      line: "En tehlikeli insan doğruyu söyleyen",
      technique: "Kısa paradoks — en güçlü satırlar bazen en kısadır",
      lesson: "Gerçeği tersine çevir, dinleyiciyi duraksат",
    },
  ],
  double_meaning: [
    {
      artist: "Ceza",
      technique: "Çift anlamlı kelime kullanımı",
      lesson: "Her anahtar kelime iki anlam taşısın — yüzeysel ve derin",
    },
  ],
  concrete_image: [
    {
      technique: "Soyut duyguyu somut nesneyle göster",
      examples: [
        "Üzgündüm → 'Sabah kahvem soğudu, içemedim'",
        "Yoksulluk → 'Elektrik saydacı dönerdi ama biz döndürmezdik'",
        "Yalnızlık → 'Telefonum şarjda değil, zaten aramıyorlar'",
      ],
      lesson: "Hiçbir zaman duyguyu direkt söyleme — göster",
    },
  ],
  unexpected_comparison: [
    {
      technique: "Beklenmedik benzetme",
      examples: [
        "Para = Tanrı (Aksan)",
        "Başarı = Hapis (özgürlüğü kısıtlar)",
        "Sevgi = Borç (ödemek zorundasın)",
      ],
      lesson: "İki alakasız kavramı birleştir — ama doğru olsun",
    },
  ],
  social_mirror: [
    {
      technique: "Dinleyiciyi aynaya tut",
      examples: [
        "Kanye West: 'We all self conscious, I'm just the first to admit it'",
        "Kendrick: 'I got loyalty, got royalty inside my DNA'",
        "J.Cole: 'Love yourz' — sahip olduğunu değerli gör",
      ],
      lesson: "Dinleyicinin içinde zaten olan ama söyleyemediği şeyi söyle",
    },
  ],
};

// ---------------------------------------------------------------------------
// GENIUS-INSPIRED TECHNIQUES — school-based approach
// ---------------------------------------------------------------------------
export const GENIUS_INSPIRED_TECHNIQUES: Record<string, SchoolRules> = {
  turkish_street_poetry: {
    description: "GNG/No1/Aksan ekolü — sokak gerçeğini şiirle anlat",
    rules: [
      "Her satırda en az bir somut detay (yer, nesne, eylem)",
      "Mahalle jargonu ama şiirsel yapı",
      "Kısa cümleler — her kelime taşımalı",
      "Son satır punch — beklenmedik ama kaçınılmaz",
    ],
  },
  introspective_rap: {
    description: "Şanışer/Uzi ekolü — iç ses, bilinç akışı",
    rules: [
      "Dinleyiciyle konuş, seyirciye değil",
      "Zayıflığı güce dönüştür",
      "Soru sor ama cevaplama",
      "Zaman atla — geçmiş ve şimdiye aynı anda değin",
    ],
  },
  global_trap_poetry: {
    description: "Drake/Future/Travis ekolü — duygusal trap",
    rules: [
      "Spesifik detaylar genel ifadelerden güçlüdür",
      "Başarı ve acıyı aynı satırda tut",
      "Hook dinleyiciyi kancaya takmalı — tekrarlanabilir",
      "Melodic phrasing — satırlar söylenebilir olmalı",
    ],
  },
};

// ---------------------------------------------------------------------------
// Tone → technique mapping for prompt injection
// ---------------------------------------------------------------------------
const TONE_TECHNIQUE_MAP: Record<string, string[]> = {
  agresif: ["turkish_street_poetry", "paradox", "concrete_image"],
  melankolik: ["introspective_rap", "concrete_image", "social_mirror"],
  motivasyon: ["social_mirror", "unexpected_comparison", "paradox"],
  sokak: ["turkish_street_poetry", "double_meaning", "concrete_image"],
  edebi: ["introspective_rap", "paradox", "unexpected_comparison"],
  // Character tones
  mağrur: ["turkish_street_poetry", "double_meaning", "paradox"],
  umursamaz: ["global_trap_poetry", "concrete_image", "social_mirror"],
  öfkeli: ["turkish_street_poetry", "paradox", "concrete_image"],
  yorgun: ["introspective_rap", "concrete_image", "social_mirror"],
  umutlu: ["social_mirror", "unexpected_comparison", "concrete_image"],
};

/**
 * Get relevant lyric techniques as a prompt injection string
 * based on the character's tone and style.
 */
export function getLyricTechniquesPrompt(tone: string, lyricalStyle?: string): string {
  const keys = TONE_TECHNIQUE_MAP[tone] ?? TONE_TECHNIQUE_MAP["sokak"];
  const parts: string[] = [];

  parts.push("\n🎓 LİRİK MASTERCLASS — Bu dörtlükte aşağıdaki tekniklerden EN AZ BİRİNİ kullan:\n");

  for (const key of keys) {
    // Check masterclass techniques
    const masterExamples = LYRIC_MASTERCLASS[key];
    if (masterExamples) {
      for (const ex of masterExamples) {
        parts.push(`TEKNİK: ${ex.technique}`);
        if (ex.line) parts.push(`  Örnek: "${ex.line}"${ex.artist ? ` — ${ex.artist}` : ""}`);
        if (ex.examples) {
          for (const e of ex.examples.slice(0, 2)) {
            parts.push(`  • ${e}`);
          }
        }
        parts.push(`  Ders: ${ex.lesson}`);
        parts.push("");
      }
    }

    // Check school techniques
    const school = GENIUS_INSPIRED_TECHNIQUES[key];
    if (school) {
      parts.push(`EKOL: ${school.description}`);
      for (const rule of school.rules) {
        parts.push(`  • ${rule}`);
      }
      parts.push("");
    }
  }

  // Add style-specific note
  if (lyricalStyle) {
    const styleNotes: Record<string, string> = {
      "hikaye anlatıcı": "Hikaye anlatıcısısın — her dörtlük bir sahne, bir an. Kronolojik akış kur.",
      "punchline": "Punchline odaklısın — son satır her zaman sürpriz ve vurgun olsun.",
      "iç ses": "İç ses modundasın — bilinç akışı, düşünce zıplamaları, çelişkili duygular.",
      "sokak raporu": "Sokak raportörsün — gördüğünü yaz, yorum yapma, sahneyi kur.",
      "şiirsel": "Şiirsel yaklaşım — metafor yoğunluğu yüksek, her satır çok katmanlı.",
    };
    const note = styleNotes[lyricalStyle];
    if (note) {
      parts.push(`STİL NOTU: ${note}\n`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Workshop mode — analyze lines and suggest improvements
// ---------------------------------------------------------------------------
export function buildWorkshopPrompt(lines: string[]): string {
  const numbered = lines.map((l, i) => `${i + 1}. "${l}"`).join("\n");

  return `Sen bir Türkçe rap söz koçusun. Aşağıdaki satırları analiz et ve HER BİRİ için TEK bir spesifik iyileştirme öner.

SATIRLAR:
${numbered}

Her satır için şunları yap:
1. Satırın güçlü ve zayıf yönlerini tespit et
2. Spesifik bir teknik kullanarak iyileştirilmiş versiyonunu yaz
3. Hangi tekniği kullandığını ve neden daha iyi olduğunu açıkla

Kullanabileceğin teknikler:
- Somutlaştırma: soyut duyguyu somut nesneyle değiştir
- Paradoks: çelişkili ama doğru ifade
- Çift anlam: kelimeyi iki anlamda kullan
- Beklenmedik benzetme: iki alakasız kavramı birleştir
- Ayna tutma: dinleyicinin hissettiği ama söyleyemediği şeyi söyle
- Sahne kurma: nerede, ne zaman, kim — spesifik detay ekle

Yalnızca şu JSON yapısını döndür (başka hiçbir şey yazma):
{
  "improvements": [
    {
      "original": "orijinal satır",
      "improved": "iyileştirilmiş satır",
      "technique": "kullanılan teknik adı",
      "explanation": "neden daha iyi olduğunun kısa açıklaması"
    }
  ]
}`;
}
