// ---------------------------------------------------------------------------
// StyleProfile — user's personal rap style fingerprint
// ---------------------------------------------------------------------------

export type Tone = "agresif" | "melankolik" | "motivasyon" | "sokak" | "edebi";

export interface StyleProfile {
  vocabulary: string[];
  themes: string[];
  rhymePattern: string;      // e.g. "AABB", "ABAB", "karma"
  avgSyllables: number;
  favoriteWords: string[];
  tone: Tone;
  flowStyle: string;         // Turkish description
  uniqueTraits: string[];
  analyzedAt: string;        // ISO date string
  lyricsCount: number;       // number of lines analyzed
  commonStructures?: string[];   // common sentence construction patterns
  metaphorTypes?: string[];      // image/metaphor types used
  sentenceLength?: "kısa" | "orta" | "uzun"; // dominant sentence length
}

const LS_KEY = "rapflow_style_profile";

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function saveStyleProfile(profile: StyleProfile): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(profile));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadStyleProfile(): StyleProfile | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StyleProfile;
  } catch {
    return null;
  }
}

export function hasStyleProfile(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearStyleProfile(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------

const TONE_LABEL: Record<Tone, string> = {
  agresif:    "Agresif tarz",
  melankolik: "Melankolik tarz",
  motivasyon: "Motivasyon tarzı",
  sokak:      "Sokak tarzı",
  edebi:      "Edebi tarz",
};

const RHYME_LABEL: Record<string, string> = {
  AABB:  "çift kafiye (AABB)",
  ABAB:  "çapraz kafiye (ABAB)",
  AAAA:  "zincirleme kafiye (AAAA)",
  ABBA:  "sarmal kafiye (ABBA)",
  karma: "karma kafiye",
};

export function getStyleSummary(profile: StyleProfile): string {
  const tone   = TONE_LABEL[profile.tone] ?? `${profile.tone} tarzı`;
  const rhyme  = RHYME_LABEL[profile.rhymePattern] ?? `${profile.rhymePattern} kafiye`;
  const theme  = profile.themes.length > 0 ? profile.themes[0] : null;
  const sylStr = `ortalama ${Math.round(profile.avgSyllables)} hece/satır`;

  const parts = [tone];
  if (theme) parts.push(`${theme} teması`);
  parts.push(rhyme + " seven");
  parts.push(sylStr);

  return parts.join(", ");
}
