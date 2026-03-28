// ---------------------------------------------------------------------------
// Flow Pattern Database
// Real rapper flow patterns with rhythmic breakdown for RapFlow trainer
// ---------------------------------------------------------------------------

export type StressType = "hit" | "skip" | "ghost" | "synco";
export type SubdivisionType = "eighth" | "triplet" | "sixteenth";

// A single syllable slot within a beat
export interface Syllable {
  text: string;       // phonetic label: "dıt", "dı", "da", "ta", "—", "DIT"
  stress: StressType; // hit=strong accent, ghost=soft, synco=off-beat accent, skip=silence
}

// One quarter-note beat with its syllable subdivisions
export interface Beat {
  beatNumber: number;           // 1–4 within the bar
  subdivision: SubdivisionType; // how this beat is subdivided
  syllables: Syllable[];        // 2 (eighth), 3 (triplet), or 4 (sixteenth) slots
}

// Full flow pattern entry
export interface FlowPattern {
  id: string;
  artist: string;
  song: string;
  bpmRange: [number, number];
  pattern: Beat[];            // one bar (4 beats) characteristic pattern
  rhythmDescription: string;  // Turkish description of feel/technique
  onomatopoeia: string;       // e.g. "dıt-dı-dı dı—dıt dı-dıt-dı dı-dıt"
  exampleLines: string[];     // Turkish rap lines written in this flow
  tags: string[];
}

// ---------------------------------------------------------------------------
// Pattern database
// ---------------------------------------------------------------------------

export const FLOW_PATTERNS: FlowPattern[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Baby Gang — "Guerra" flow
  // Syncopated triplet drill feel; accent falls BETWEEN the beat
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "baby-gang-guerra",
    artist: "Baby Gang",
    song: "Guerra",
    bpmRange: [135, 150],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "triplet",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "dı",  stress: "ghost" },
          { text: "dı",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "triplet",
        syllables: [
          { text: "dı",  stress: "synco" },
          { text: "—",   stress: "skip"  },
          { text: "dıt", stress: "hit"   },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "triplet",
        syllables: [
          { text: "dı",  stress: "ghost" },
          { text: "dıt", stress: "hit"   },
          { text: "dı",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "triplet",
        syllables: [
          { text: "dı",  stress: "synco" },
          { text: "dıt", stress: "hit"   },
          { text: "—",   stress: "skip"  },
        ],
      },
    ],
    rhythmDescription:
      "Senkoplu üçlü hiss. Vurgu, vuruşun tam üzerine değil arasına düşer. " +
      "Drill müziğin karakteristik 'neredeyse geç kalıyorum' hissi. " +
      "Her iki vuruşta bir büyük senkop kırılması var.",
    onomatopoeia: "dıt-dı-dı  dı—dıt  dı-dıt-dı  dı-dıt",
    exampleLines: [
      "Sokak soğuk kalbim kor yol uzun bu gece",
      "Gece geç ben yorgun düşman var her yerde",
      "Kimse yok yanımda tek yürürüm bu yolda",
    ],
    tags: ["drill", "triplet", "syncopated", "trap", "off-beat"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Gazapizm — "Heycanı Yok" flow
  // Bouncy kangaroo downbeat feel; lands hard on 1 and 3, floats on 2
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "gazapizm-heycaniyok",
    artist: "Gazapizm",
    song: "Heycanı Yok",
    bpmRange: [88, 100],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"  },
          { text: "—",   stress: "skip" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "eighth",
        syllables: [
          { text: "dı",  stress: "ghost" },
          { text: "dı",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"  },
          { text: "—",   stress: "skip" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"  },
          { text: "—",   stress: "skip" },
        ],
      },
    ],
    rhythmDescription:
      "Zıplayan kanguru hissi. 1. vuruş sert iner, 2. vuruşta hızlı iki hece " +
      "köprü kurar, 3 ve 4 tekrar sert iner. Arada nefes boşluğu karakteristik. " +
      "Boom-bap alt yapısına en uygun akış biçimi.",
    onomatopoeia: "dıt—  dı-dı  dıt—  dıt—",
    exampleLines: [
      "Bak hayat sıfırdan kurdum ben kendimi",
      "Her adım yeni bir kapı açar bana",
      "Sen sustun ben sustum şimdi kim konuşur",
    ],
    tags: ["boom-bap", "bouncy", "downbeat", "turkish-rap", "simple"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Ezhel — "Geceler" flow
  // Smooth rolling triplets; laid-back, accent on the 2nd triplet subdivision
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "ezhel-geceler",
    artist: "Ezhel",
    song: "Geceler",
    bpmRange: [85, 98],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "triplet",
        syllables: [
          { text: "DIT", stress: "hit"   },
          { text: "da",  stress: "ghost" },
          { text: "da",  stress: "ghost" },
        ],
      },
    ],
    rhythmDescription:
      "Yuvarlanan üçlü hissi. Her vuruşun ortasına yaslanır, geriden gelir. " +
      "Ağır çekimde yürüyen biri gibi, ama müzikal olarak mükemmel hizalı. " +
      "Son vuruşta öne çıkarak cümleyi kapatır. Türkçe akış için ideal.",
    onomatopoeia: "da-DIT-da  da-DIT-da  da-DIT-da  DIT-da-da",
    exampleLines: [
      "Geceleri yürürüm sessiz sokaklarda yalnız",
      "Müziğimde saklarım söyleyemediğim her şeyi",
      "Kimler geldi kimler geçti ben hep buradaydım",
    ],
    tags: ["triplet", "laid-back", "smooth", "turkish-rap", "melodic"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Ceza — "Holocaust" flow
  // Rapid-fire 16th notes; machine gun, no rest, every slot filled
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "ceza-holocaust",
    artist: "Ceza",
    song: "Holocaust",
    bpmRange: [90, 110],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
          { text: "ta",  stress: "ghost" },
        ],
      },
    ],
    rhythmDescription:
      "Makineli tüfek teslimatı. Her vuruşa 4 hece, hiç boşluk yok. " +
      "16'lık notaların tamamı dolu, hız ve netlik öncelik. " +
      "Türkçe'nin uzun heceli yapısı bu akışa meydan okur, kazanmak istersin.",
    onomatopoeia: "dıt-ta-ta-ta  dıt-ta-ta-ta  dıt-ta-ta-ta  dıt-ta-ta-ta",
    exampleLines: [
      "İstanbul'da doğdum büyüdüm yaşadım öğrendim bildim duydum",
      "Durdurun durdurun durdurmak mümkün mü beni durdurun",
      "Kelimeler akar durur dolar taşar bitmez bu satırlar",
    ],
    tags: ["16th-notes", "rapid-fire", "technical", "machine-gun", "turkish-rap"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Kanye West — "Gorgeous" flow
  // Melodic syncopation with dramatic pauses; breathe, then punch
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "kanye-gorgeous",
    artist: "Kanye West",
    song: "Gorgeous",
    bpmRange: [80, 93],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "eighth",
        syllables: [
          { text: "DIT", stress: "hit"  },
          { text: "—",   stress: "skip" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "eighth",
        syllables: [
          { text: "dı",  stress: "synco" },
          { text: "DIT", stress: "hit"   },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "eighth",
        syllables: [
          { text: "—",   stress: "skip" },
          { text: "—",   stress: "skip" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "eighth",
        syllables: [
          { text: "dı",  stress: "synco" },
          { text: "DIT", stress: "hit"   },
        ],
      },
    ],
    rhythmDescription:
      "Dramatik duraklı melodik senkop. 1. vuruşta sert vuruş, 2'de sürpriz " +
      "senkop, 3. vuruş tamamen boş (nefes al), 4'te tekrar senkoplu vuruş. " +
      "Sessizliği bir silah gibi kullanır. Cümle bitmeden şarkı söyler gibi söylersin.",
    onomatopoeia: "DIT—  dı-DIT  ——  dı-DIT",
    exampleLines: [
      "Ben biliyorum... sen biliyorsun... ama kimse söylemez",
      "Şehir uyumuş... yıldızlar gülmüş... ben hâlâ buradayım",
      "Fark ettim... çok geç oldu... ne yapayım şimdi",
    ],
    tags: ["melodic", "syncopated", "pause-heavy", "emotional", "introspective"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Drake — "HYFR" flow
  // Conversational on-beat; simple 8th note grid, natural speech rhythm
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "drake-hyfr",
    artist: "Drake",
    song: "HYFR",
    bpmRange: [100, 118],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "eighth",
        syllables: [
          { text: "dıt", stress: "hit"  },
          { text: "—",   stress: "skip" },
        ],
      },
    ],
    rhythmDescription:
      "Sohbet tarzı, düz sekizlik notalar. Sanki birine bir şey anlatıyorsun. " +
      "Her vuruşta bir ana hece, sonu boş. Akılda kalır çünkü tahmin edilebilir, " +
      "ama kelime seçimi ve konuşma tonu onu özel yapar.",
    onomatopoeia: "dıt-da  dıt-da  dıt-da  dıt—",
    exampleLines: [
      "Sana her şeyi söyledim inandın mı bilmiyorum",
      "Bu şehirde yalnız değilim inan bana dostum",
      "Nereden geldim nereye gidiyorum düşünüyorum",
    ],
    tags: ["conversational", "on-beat", "simple", "sticky", "8th-note"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Kendrick Lamar — "ADHD" flow
  // Chaotic polyrhythmic switching; changes subdivision mid-bar
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "kendrick-adhd",
    artist: "Kendrick Lamar",
    song: "ADHD",
    bpmRange: [94, 108],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "sixteenth",
        syllables: [
          { text: "DIT", stress: "hit"  },
          { text: "—",   stress: "skip" },
          { text: "DIT", stress: "hit"  },
          { text: "—",   stress: "skip" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "eighth",
        syllables: [
          { text: "dı",  stress: "synco" },
          { text: "DIT", stress: "hit"   },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
        ],
      },
    ],
    rhythmDescription:
      "Kaotik poliritim. Her vuruşta farklı bir ritim anlayışı: üçlü, 16'lık, " +
      "sekizlik, yine üçlü. Sanki kafanın içindeki sesler yarışıyor. " +
      "Dinleyiciyi ritimsel olarak şaşırtır, ama her seferinde geri döner. " +
      "Ustalar için akış.",
    onomatopoeia: "da-DIT-da  DIT·DIT  dı-DIT  da-da-DIT",
    exampleLines: [
      "Dur dur dur bir dur ne yapıyorum ben şimdi",
      "Kafam kafam kafam dolu boş değil bir tane yok",
      "Ritim değişir akış değişir ama ben değişmem",
    ],
    tags: ["polyrhythmic", "switching", "complex", "chaotic", "advanced"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Juice WRLD — "Lucid Dreams" flow
  // Singing-rapping hybrid; triplet melisma, notes held across beat lines
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "juice-wrld-lucid-dreams",
    artist: "Juice WRLD",
    song: "Lucid Dreams",
    bpmRange: [75, 90],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "triplet",
        syllables: [
          { text: "DII", stress: "hit"   },
          { text: "da",  stress: "ghost" },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "triplet",
        syllables: [
          { text: "dı",  stress: "synco" },
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "triplet",
        syllables: [
          { text: "da",  stress: "ghost" },
          { text: "da",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
        ],
      },
    ],
    rhythmDescription:
      "Şarkı-rap melezi. Üçlü hissiyle sürüklenir, hecelere melizmatik uzamalar " +
      "eklenir. Vurgu giderek öne kaymaz, aksine geciktirilir, sanki vuruşu " +
      "kaçıracaksın ama en son anda yakalarsın. Duygusal aktarım teknik önce gelir.",
    onomatopoeia: "DII-da-da  da-DIT-da  dı-da-DIT  da-da-DIT",
    exampleLines: [
      "Seeeni düşünüyooorum gözlerim kapaaanıyor",
      "Gitmeeee git gitmeeee kal yanımda biraz",
      "Rüyalaaard içindee kayboluyooorum tekrar",
    ],
    tags: ["melodic", "singing-rap", "triplet", "melismatic", "emotional"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Lil Uzi Vert — "XO Tour Llif3" flow
  // Mumble stutter, heavy off-beat emphasis, trap hi-hat locked
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "uzi-xo-tour",
    artist: "Lil Uzi Vert",
    song: "XO Tour Llif3",
    bpmRange: [128, 148],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "eighth",
        syllables: [
          { text: "—",  stress: "skip"  },
          { text: "dı", stress: "synco" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "eighth",
        syllables: [
          { text: "dı",  stress: "ghost" },
          { text: "DIT", stress: "hit"   },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "eighth",
        syllables: [
          { text: "—",  stress: "skip"  },
          { text: "dı", stress: "synco" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "sixteenth",
        syllables: [
          { text: "dı",  stress: "ghost" },
          { text: "dı",  stress: "ghost" },
          { text: "dı",  stress: "synco" },
          { text: "DIT", stress: "hit"   },
        ],
      },
    ],
    rhythmDescription:
      "Mırıltı kekeleme. Vuruş 'açık' yerine 'arasında' hissettirilen senkoplar. " +
      "1 ve 3 neredeyse boş, 2 ve 4 zayıf vurgu, son 16'lıkta patlama. " +
      "Hi-hat'e kilitli, trap gridi kaybetme ama üstüne kayarak söyle.",
    onomatopoeia: "—dı  dı-DIT  —dı  dı-dı-dı-DIT",
    exampleLines: [
      "Yok artık gel gel ne fark eder ki bu",
      "Para var sorun yok git yine de gidecek",
      "Dur dur dur bak bak her şey geçip gidecek",
    ],
    tags: ["mumble", "trap", "off-beat", "stutter", "hi-hat"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // J. Cole — "No Role Modelz" flow
  // Steady syllable-perfect 16th grid; academic, every slot intentional
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "jcole-no-role-modelz",
    artist: "J. Cole",
    song: "No Role Modelz",
    bpmRange: [96, 108],
    pattern: [
      {
        beatNumber: 1,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 2,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 3,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
        ],
      },
      {
        beatNumber: 4,
        subdivision: "sixteenth",
        syllables: [
          { text: "dıt", stress: "hit"   },
          { text: "da",  stress: "ghost" },
          { text: "dıt", stress: "hit"   },
          { text: "—",   stress: "skip"  },
        ],
      },
    ],
    rhythmDescription:
      "Akademik mükemmeliyetçi akış. Her 16'lık slot bilinçli dolu ya da bilinçli boş. " +
      "İki vuruş ikişer hece, birbirini dengeler, son vuruşta küçük nefes. " +
      "Kafiye ve ritim mükemmel hizalı. Türkçe'nin doğal hece yapısıyla örtüşür.",
    onomatopoeia: "dıt-da-dıt-da  dıt-da-dıt-da  dıt-da-dıt-da  dıt-da-dıt—",
    exampleLines: [
      "Her kelime doğru yerde durur bu satırlarda",
      "Kim ne derse desin biliyorum ben kendi yolumu",
      "Söz vermedim kimseye söz vermem de hiç kimseye",
    ],
    tags: ["16th-notes", "technical", "academic", "syllable-perfect", "steady"],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export const FLOW_PATTERNS_BY_ID: Record<string, FlowPattern> = Object.fromEntries(
  FLOW_PATTERNS.map((p) => [p.id, p])
);

export const FLOW_PATTERNS_BY_ARTIST: Record<string, FlowPattern[]> = FLOW_PATTERNS.reduce(
  (acc, p) => {
    if (!acc[p.artist]) acc[p.artist] = [];
    acc[p.artist].push(p);
    return acc;
  },
  {} as Record<string, FlowPattern[]>
);

// Returns patterns whose BPM range overlaps with the given BPM
export function getPatternsByBPM(bpm: number): FlowPattern[] {
  return FLOW_PATTERNS.filter(
    (p) => bpm >= p.bpmRange[0] && bpm <= p.bpmRange[1]
  );
}

// Returns patterns matching any of the given tags
export function getPatternsByTags(tags: string[]): FlowPattern[] {
  const set = new Set(tags);
  return FLOW_PATTERNS.filter((p) => p.tags.some((t) => set.has(t)));
}

// Compute the total syllable count for one bar of a pattern
export function countBarSyllables(pattern: FlowPattern): number {
  return pattern.pattern.reduce(
    (sum, beat) =>
      sum + beat.syllables.filter((s) => s.stress !== "skip").length,
    0
  );
}

// Build a flat onomatopoeia string from the pattern data
export function buildOnomatopoeia(pattern: FlowPattern): string {
  return pattern.pattern
    .map((beat) =>
      beat.syllables.map((s) => (s.stress === "skip" ? "—" : s.text)).join("-")
    )
    .join("  ");
}
