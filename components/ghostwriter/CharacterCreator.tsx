"use client";

import { useState, useCallback } from "react";
import {
  CharacterDNA,
  CharacterTone,
  LyricalStyle,
  saveCharacterDNA,
} from "@/lib/characterDNA";

interface Props {
  existing: CharacterDNA | null;
  onSave: (dna: CharacterDNA) => void;
  onClose: () => void;
}

const ORIGIN_OPTIONS = [
  "İstanbul - Bağcılar",
  "İstanbul - Sultangazi",
  "İstanbul - Pendik",
  "Ankara - Mamak",
  "Ankara - Keçiören",
  "İzmir",
  "Bursa",
  "Adana",
  "Mersin",
  "Diğer (özel)",
];

const STRUGGLE_CARDS = [
  { id: "yoksulluk", emoji: "🏚️", title: "Yoksulluk", desc: "Çocukluktan beri yokluğu tattım" },
  { id: "kayıp", emoji: "💔", title: "Kayıp", desc: "Sevdiğimi kaybettim, içim boş" },
  { id: "adalet", emoji: "⚖️", title: "Adalet", desc: "Sistem beni yedi, sokağa tükürdü" },
  { id: "sokak", emoji: "🔫", title: "Sokak", desc: "Sokak yetiştirdi, sokak öğretti" },
  { id: "bağımlılık", emoji: "💊", title: "Bağımlılık", desc: "Kaçmak için her şeyi denedim" },
  { id: "aile", emoji: "👨‍👩‍👧", title: "Aile", desc: "Babam yoktu, annem yoruldu" },
  { id: "hapis", emoji: "🏛️", title: "Hapis", desc: "Demir parmaklık ardında büyüdüm" },
  { id: "para", emoji: "💰", title: "Para", desc: "Paranın olmayınca insan değilsin" },
  { id: "aşk", emoji: "❤️", title: "Aşk", desc: "Sevdim, yandım, küldüm" },
  { id: "ihanet", emoji: "🗡️", title: "İhanet", desc: "En yakınım sırtıma bıçak sapladı" },
];

const VALUES_OPTIONS = [
  "sadakat",
  "para",
  "özgürlük",
  "intikam",
  "sevgi",
  "güç",
  "aile",
  "sokak",
];

const TONE_OPTIONS: { value: CharacterTone; emoji: string; label: string; desc: string }[] = [
  { value: "agresif", emoji: "🔥", label: "Agresif", desc: "Sert, keskin, patlayıcı" },
  { value: "melankolik", emoji: "🌙", label: "Melankolik", desc: "Derin, hüzünlü, içe dönük" },
  { value: "mağrur", emoji: "👑", label: "Mağrur", desc: "Kendinden emin, yukarıdan bakan" },
  { value: "umursamaz", emoji: "😶", label: "Umursamaz", desc: "Cool, soğuk, detached" },
  { value: "öfkeli", emoji: "⚡", label: "Öfkeli", desc: "Kızgın, hesap soran, yakıcı" },
  { value: "yorgun", emoji: "😮‍💨", label: "Yorgun", desc: "Bıkmış, ağır, her şeyi görmüş" },
  { value: "umutlu", emoji: "🌅", label: "Umutlu", desc: "Işık arayan, ilerlemeye çalışan" },
];

const LYRICAL_STYLE_OPTIONS: { value: LyricalStyle; emoji: string; label: string; desc: string }[] = [
  { value: "hikaye anlatıcı", emoji: "📖", label: "Hikaye Anlatıcı", desc: "Başı sonu olan hikayeler" },
  { value: "punchline ağırlıklı", emoji: "🥊", label: "Punchline Ağırlıklı", desc: "Tek satırda patlayan kafiyeler" },
  { value: "iç ses", emoji: "💭", label: "İç Ses", desc: "İç dünya, bilinç akışı" },
  { value: "sokak raporu", emoji: "📍", label: "Sokak Raporu", desc: "Gördüğünü olduğu gibi anlat" },
  { value: "şiirsel", emoji: "🌹", label: "Şiirsel", desc: "Mecaz ve imge yoğun" },
];

const TR_INFLUENCES = [
  "GNG",
  "Canbay & Wolker",
  "Baby Gang",
  "Patron",
  "Ben Fero",
  "No1",
  "Maestro",
  "Şanışer",
  "Norm Ender",
  "Ceza",
  "Ezhel",
  "Şamı",
  "Orçin",
  "Murda",
];

const INTL_INFLUENCES = [
  "Kendrick Lamar",
  "J.Cole",
  "Drake",
  "Nas",
  "Jay-Z",
  "Eminem",
  "Travis Scott",
  "Future",
  "Lil Baby",
];

const STEP_TITLES = ["Temel Kimlik", "Hayat Mücadelesi", "Ses & Stil", "Önizleme"];

interface FormState {
  name: string;
  originSelect: string;
  originCustom: string;
  age: number;
  backstory: string;
  struggles: string[];
  values: string[];
  tone: CharacterTone | "";
  lyricalStyle: LyricalStyle | "";
  influences: string[];
  signatureWordsRaw: string;
  forbiddenWordsRaw: string;
}

function buildDNA(form: FormState): CharacterDNA {
  const origin =
    form.originSelect === "Diğer (özel)" ? form.originCustom : form.originSelect;
  return {
    name: form.name.trim(),
    age: form.age,
    origin,
    backstory: form.backstory.trim(),
    struggles: form.struggles,
    values: form.values,
    tone: form.tone as CharacterTone,
    lyricalStyle: form.lyricalStyle as LyricalStyle,
    influences: form.influences,
    signatureWords: form.signatureWordsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    forbiddenWords: form.forbiddenWordsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    createdAt: new Date().toISOString(),
  };
}

function initForm(existing: CharacterDNA | null): FormState {
  if (!existing) {
    return {
      name: "",
      originSelect: ORIGIN_OPTIONS[0],
      originCustom: "",
      age: 22,
      backstory: "",
      struggles: [],
      values: [],
      tone: "",
      lyricalStyle: "",
      influences: [],
      signatureWordsRaw: "",
      forbiddenWordsRaw: "",
    };
  }
  const isCustomOrigin = !ORIGIN_OPTIONS.includes(existing.origin);
  return {
    name: existing.name,
    originSelect: isCustomOrigin ? "Diğer (özel)" : existing.origin,
    originCustom: isCustomOrigin ? existing.origin : "",
    age: existing.age,
    backstory: existing.backstory,
    struggles: existing.struggles,
    values: existing.values,
    tone: existing.tone,
    lyricalStyle: existing.lyricalStyle,
    influences: existing.influences,
    signatureWordsRaw: existing.signatureWords.join(", "),
    forbiddenWordsRaw: existing.forbiddenWords.join(", "),
  };
}

export default function CharacterCreator({ existing, onSave, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initForm(existing));
  const [previewLines, setPreviewLines] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  function canProceedStep0(): boolean {
    const originOk =
      form.originSelect !== "Diğer (özel)" || form.originCustom.trim().length > 0;
    return form.name.trim().length > 0 && originOk && form.backstory.trim().length > 0;
  }

  function canProceedStep1(): boolean {
    return form.struggles.length > 0;
  }

  function canProceedStep2(): boolean {
    return form.tone !== "" && form.lyricalStyle !== "";
  }

  function canProceed(): boolean {
    if (step === 0) return canProceedStep0();
    if (step === 1) return canProceedStep1();
    if (step === 2) return canProceedStep2();
    return true;
  }

  async function handleGeneratePreview() {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewLines(null);
    try {
      const dna = buildDNA(form);
      const res = await fetch("/api/ghostwriter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          characterDNA: dna,
          userStyle: {
            vocabulary: [],
            themes: ["kimlik"],
            rhymePattern: "AABB",
            avgSyllables: 9,
            favoriteWords: [],
            tone: "sokak",
            flowStyle: "serbest",
            uniqueTraits: [],
          },
          prompt: "Kendini tanıt, kim olduğunu anlat",
          bpm: 90,
        }),
      });
      if (!res.ok) {
        throw new Error(`Sunucu hatası: ${res.status}`);
      }
      const data = await res.json();
      const lines: string =
        data?.lines ??
        data?.result ??
        data?.text ??
        data?.content ??
        JSON.stringify(data);
      setPreviewLines(lines);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSave() {
    const dna = buildDNA(form);
    saveCharacterDNA(dna);
    onSave(dna);
  }

  const dnaPreview = buildDNA(form);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
              Karakter Oluştur
            </p>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {STEP_TITLES[step]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-lg font-bold"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 px-6 py-3 shrink-0 bg-zinc-900 border-b border-zinc-800">
          {STEP_TITLES.map((title, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-violet-500" : "bg-zinc-700"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between px-6 pb-1 shrink-0">
          {STEP_TITLES.map((title, i) => (
            <span
              key={i}
              className={`text-xs ${i === step ? "text-violet-400 font-semibold" : "text-zinc-600"}`}
            >
              {title}
            </span>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* STEP 0: Temel Kimlik */}
          {step === 0 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                  Karakterinin adı / sahne adı
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Sahne adı veya karakter ismi..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                  Nereden geliyorsun?
                </label>
                <select
                  value={form.originSelect}
                  onChange={(e) => update("originSelect", e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                >
                  {ORIGIN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {form.originSelect === "Diğer (özel)" && (
                  <input
                    type="text"
                    value={form.originCustom}
                    onChange={(e) => update("originCustom", e.target.value)}
                    placeholder="Şehir / semt adı..."
                    className="mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                  Yaş: <span className="text-violet-400 font-bold">{form.age}</span>
                </label>
                <input
                  type="range"
                  min={18}
                  max={35}
                  value={form.age}
                  onChange={(e) => update("age", Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>18</span>
                  <span>35</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                  Hayat hikayesi
                </label>
                <textarea
                  rows={3}
                  value={form.backstory}
                  onChange={(e) => update("backstory", e.target.value)}
                  placeholder="Hayat hikayeni anlat — nereden geldin, ne yaşadın, seni bu noktaya ne getirdi?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>
            </>
          )}

          {/* STEP 1: Hayat Mücadelesi */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  Mücadeleler{" "}
                  <span className="text-zinc-500 font-normal">(en az 1 seç)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STRUGGLE_CARDS.map((card) => {
                    const selected = form.struggles.includes(card.id);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() =>
                          update("struggles", toggleArrayItem(form.struggles, card.id))
                        }
                        className={`text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                          selected
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{card.emoji}</span>
                          <span className="font-semibold text-white text-sm">
                            {card.title}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-tight">{card.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Değerlerin
                </label>
                <div className="flex flex-wrap gap-2">
                  {VALUES_OPTIONS.map((val) => {
                    const selected = form.values.includes(val);
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          update("values", toggleArrayItem(form.values, val))
                        }
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          selected
                            ? "border-violet-500 bg-violet-500/20 text-violet-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* STEP 2: Ses & Stil */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  Ton
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((opt) => {
                    const selected = form.tone === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update("tone", opt.value)}
                        className={`text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                          selected
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-lg">{opt.emoji}</span>
                          <span className="font-semibold text-white text-sm">
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  Lirik Stil
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LYRICAL_STYLE_OPTIONS.map((opt) => {
                    const selected = form.lyricalStyle === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update("lyricalStyle", opt.value)}
                        className={`text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                          selected
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-lg">{opt.emoji}</span>
                          <span className="font-semibold text-white text-sm">
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Türk Rap Etkileri
                </label>
                <div className="flex flex-wrap gap-2">
                  {TR_INFLUENCES.map((inf) => {
                    const selected = form.influences.includes(inf);
                    return (
                      <button
                        key={inf}
                        type="button"
                        onClick={() =>
                          update("influences", toggleArrayItem(form.influences, inf))
                        }
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          selected
                            ? "border-violet-500 bg-violet-500/20 text-violet-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {inf}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Uluslararası Etkiler
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTL_INFLUENCES.map((inf) => {
                    const selected = form.influences.includes(inf);
                    return (
                      <button
                        key={inf}
                        type="button"
                        onClick={() =>
                          update("influences", toggleArrayItem(form.influences, inf))
                        }
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          selected
                            ? "border-violet-500 bg-violet-500/20 text-violet-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {inf}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                  İmza kelimeler
                  <span className="text-zinc-500 font-normal ml-1">(virgülle ayır)</span>
                </label>
                <input
                  type="text"
                  value={form.signatureWordsRaw}
                  onChange={(e) => update("signatureWordsRaw", e.target.value)}
                  placeholder="bırak, keskin, gecenin köründe, be..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                  Yasaklı kelimeler
                  <span className="text-zinc-500 font-normal ml-1">(virgülle ayır)</span>
                </label>
                <input
                  type="text"
                  value={form.forbiddenWordsRaw}
                  onChange={(e) => update("forbiddenWordsRaw", e.target.value)}
                  placeholder="bro, swag, lit..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </>
          )}

          {/* STEP 3: Önizleme */}
          {step === 3 && (
            <>
              {/* Character card */}
              <div className="rounded-2xl bg-zinc-800 border border-zinc-700 p-5 space-y-4">
                {/* Name / age / origin */}
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight">
                    {dnaPreview.name || "—"}
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {dnaPreview.age} yaşında &bull; {dnaPreview.origin}
                  </p>
                </div>

                {/* Backstory */}
                {dnaPreview.backstory && (
                  <p className="italic text-zinc-300 text-sm leading-relaxed border-l-2 border-violet-500 pl-3">
                    {dnaPreview.backstory}
                  </p>
                )}

                {/* Tone + style badges */}
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-violet-600/30 border border-violet-500/50 text-violet-300 text-xs font-semibold">
                    {dnaPreview.tone}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 text-xs font-semibold">
                    {dnaPreview.lyricalStyle}
                  </span>
                </div>

                {/* Struggles */}
                {dnaPreview.struggles.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                      Mücadeleler
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dnaPreview.struggles.map((s) => {
                        const card = STRUGGLE_CARDS.find((c) => c.id === s);
                        return (
                          <span
                            key={s}
                            className="px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
                          >
                            {card?.emoji} {card?.title ?? s}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Values */}
                {dnaPreview.values.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                      Değerler
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dnaPreview.values.map((v) => (
                        <span
                          key={v}
                          className="px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-300 text-xs"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Influences */}
                {dnaPreview.influences.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                      Etkiler
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dnaPreview.influences.map((inf) => {
                        const isTr = TR_INFLUENCES.includes(inf);
                        return (
                          <span
                            key={inf}
                            className={`px-2.5 py-1 rounded-full text-xs ${
                              isTr
                                ? "bg-orange-900/40 border border-orange-700/50 text-orange-300"
                                : "bg-blue-900/40 border border-blue-700/50 text-blue-300"
                            }`}
                          >
                            {inf}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Signature words */}
                {dnaPreview.signatureWords.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                      İmza Kelimeler
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dnaPreview.signatureWords.map((w) => (
                        <span
                          key={w}
                          className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-600/50 text-emerald-300 text-xs"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forbidden words */}
                {dnaPreview.forbiddenWords.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
                      Yasaklı Kelimeler
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dnaPreview.forbiddenWords.map((w) => (
                        <span
                          key={w}
                          className="px-2.5 py-1 rounded-full bg-red-900/40 border border-red-600/50 text-red-300 text-xs line-through"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview generation */}
              <div>
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={previewLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-semibold hover:bg-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {previewLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      Üretiliyor...
                    </>
                  ) : (
                    <>🎭 Önizleme Satırı Üret</>
                  )}
                </button>

                {previewError && (
                  <p className="mt-2 text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-2">
                    {previewError}
                  </p>
                )}

                {previewLines && (
                  <div className="mt-3 bg-zinc-800 border border-violet-700/50 rounded-xl px-4 py-4">
                    <p className="text-xs text-violet-400 uppercase tracking-wider font-semibold mb-2">
                      Karakter Sesi
                    </p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap font-mono">
                      {previewLines}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 shrink-0 bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              if (step === 0) {
                onClose();
              } else {
                setStep((s) => s - 1);
              }
            }}
            className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-semibold hover:bg-zinc-800 hover:text-white transition-all text-sm"
          >
            {step === 0 ? "İptal" : "Geri"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
            >
              Devam →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-all text-sm"
            >
              Karakteri Kaydet ve Başla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
