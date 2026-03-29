import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

const MODEL = "claude-sonnet-4-20250514";

interface BeatAnalyzeRequest {
  bpm: number;
  youtubeTitle?: string;
  youtubeUrl?: string;
  mood?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: BeatAnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bpm, youtubeTitle, youtubeUrl, mood: forcedMood } = body;
  if (!bpm || bpm < 60 || bpm > 220) {
    return NextResponse.json({ error: "bpm must be 60-220" }, { status: 400 });
  }

  const titleHint = youtubeTitle || youtubeUrl || "Bilinmeyen beat";

  try {
    const message = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: `Sen bir müzik prodüksiyonu ve rap flow analisti sin. BPM, beat mood ve flow yapıları konusunda uzmansın. Türkçe ve uluslararası rap sahnesini derinlemesine biliyorsun. Her zaman yalnızca geçerli JSON döndür — markdown bloğu veya yorum yazma.`,
      messages: [{
        role: "user",
        content: `Beat bilgisi:
- BPM: ${bpm}
- Beat başlığı/kaynak: "${titleHint}"
${forcedMood ? `- Kullanıcının belirttiği mood: ${forcedMood}` : ""}

GÖREV 1 — Beat mood analizi:
Bu beatin BPM'i ve başlığından yola çıkarak mood/ton'unu belirle.

GÖREV 2 — Eşleşen şarkılar:
Bu BPM ve mood'a en iyi uyan 3 gerçek şarkı öner (100k+ stream, bilinen şarkılar).
Her şarkı için o şarkının flow yapısını detaylıca açıkla.

REFERANS HAVUZU (bunlardan ve benzerlerinden seç):
TÜRKÇE: Era7-Bodrum Block, Ziak-C'est la vie, Uzi-Umrumda Değil, Samra-24 Stunden, Baby Gang-Guerra, No1-Hesabım Var, Şanışer-Suç, Ceza-Holocaust, Ezhel-Geceler, Murda-Pa Ti, Patron-Aklım Yok, Ben Fero-Bi Şişe Daha, Norm Ender-Yüzleşme
ULUSLARARASI: Drake-God's Plan, Kendrick-HUMBLE, J.Cole-No Role Modelz, Travis Scott-Sicko Mode, Future-Mask Off, Lil Baby-Emotionally Scarred, Nas-N.Y. State of Mind, Jay-Z-99 Problems, Eminem-Lose Yourself, Pop Smoke-Dior, Central Cee-Loading, Skepta-Shutdown

BPM eşleştirme kuralları:
- ${bpm} BPM ±15 aralığındaki şarkıları tercih et
- Half-time (${bpm * 2} BPM) veya double-time (${Math.round(bpm / 2)} BPM) şarkılar da uygundur
- Mood uyumu BPM uyumundan daha önemli

Yalnızca şu JSON'u döndür:
{
  "mood": {
    "type": "melankolik" | "agresif" | "trap" | "drill" | "boom-bap" | "afrobeat" | "dark" | "uplifting" | "romantic" | "street",
    "energy": "low" | "mid" | "high",
    "subgenre": "<alt tür adı>",
    "moodDescription": "<Türkçe 1 cümle — bu beat nasıl hissettiriyor>"
  },
  "matchingSongs": [
    {
      "artist": "<sanatçı>",
      "title": "<şarkı adı>",
      "bpm": <şarkının BPM'i>,
      "flowDescription": "<Türkçe — bu şarkının flow yapısını detaylı açıkla>",
      "whyItFits": "<Türkçe — neden bu beat üstüne uyar>",
      "flowPattern": "<onomatope ritim kalıbı, ör: dıt-dı-dı-dıt / dıt-dıt>",
      "syllablePattern": [3, 2, 3, 2],
      "keyTechniques": ["iç kafiye", "senkop", "çift zaman"]
    }
  ],
  "recommendedFlow": "<Türkçe — 3 şarkıdan hangisini neden öneriyorsun, 1-2 cümle>"
}`,
      }],
    });

    const raw = message.content.find((b) => b.type === "text")?.text ?? "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(stripped);
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
