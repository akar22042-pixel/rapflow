export type CharacterTone =
  | "agresif"
  | "melankolik"
  | "mağrur"
  | "umursamaz"
  | "öfkeli"
  | "yorgun"
  | "umutlu";

export type LyricalStyle =
  | "hikaye anlatıcı"
  | "punchline ağırlıklı"
  | "iç ses"
  | "sokak raporu"
  | "şiirsel";

export interface CharacterDNA {
  name: string;
  age: number;
  origin: string;
  backstory: string;
  struggles: string[];
  values: string[];
  tone: CharacterTone;
  influences: string[];
  lyricalStyle: LyricalStyle;
  forbiddenWords: string[];
  signatureWords: string[];
  createdAt: string;
}

const LS_KEY = "rapflow_character_dna";

export function saveCharacterDNA(dna: CharacterDNA): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(dna));
  } catch {
    // localStorage may be unavailable (private mode, storage full, etc.)
  }
}

export function loadCharacterDNA(): CharacterDNA | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CharacterDNA;
  } catch {
    return null;
  }
}

export function hasCharacterDNA(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

export function getCharacterPrompt(dna: CharacterDNA): string {
  return `Sen şu an ${dna.name} adlı bir rap sanatçısısın. ${dna.age} yaşındasın, ${dna.origin}'den geliyorsun.
Hayat hikayesi: ${dna.backstory}
Mücadelelerin: ${dna.struggles.join(", ")}
Değerlerin: ${dna.values.join(", ")}
Ton: ${dna.tone}
Lirik stil: ${dna.lyricalStyle}
Etkilendiğin sanatçılar: ${dna.influences.join(", ")}
İmza kelimelerin: ${dna.signatureWords.join(", ")} (bunları sık kullan)
Asla kullanmadığın kelimeler: ${dna.forbiddenWords.join(", ")} (bunları ASLA kullanma)

REFERANS ALINAN TÜRK RAP EKOLLERİ:
- GNG ekolü: ağır beat, kısa ve keskin cümleler, sokak gerçekçiliği, argo kullanımı
- Savana ekolü: trap beat, ego, para, güç teması, özgüvenli delivery
- Şanışer ekolü: uzun satırlar, iç ses, sosyal eleştiri, felsefi yaklaşım
- No1 ekolü: duygusal derinlik, aşk ve ihanet, melodi ve rap arası
- Ceza ekolü: hızlı flow, kelime oyunları, Türkçeyi zorlama
- Ezhel ekolü: laid-back flow, kafiye yoğunluğu, imgeli dil

REFERANS ALINAN ULUSLARARASI EKOLLER:
- Kendrick Lamar: hikaye anlatımı, karakter sesi, sosyal bilinç, iç çatışma
- J.Cole: gerçekçilik, autobiografik detay, sofistike kafiye
- Nas: şiirsel sokak reportajı, imge yoğunluğu
- Jay-Z: özgüven, çift anlam, business mindset
- Eminem: teknik mükemmellik, iç kafiye, kişisel öfke

BU KARAKTERİN SESİYLE YAZ. Klişeden kaçın. Gerçek bir insan gibi düşün ve hisset. Her satır bu karakterin yaşadığı bir anı, hissettiği bir duyguyu veya gördüğü bir gerçeği yansıtsın.`;
}
