import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getEnv } from "@/lib/env";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM = `Sen tarafsız bir Türkçe rap battle hakemisin. Her iki MC'nin satırlarını kafiye, flow ve orijinallik açısından değerlendirirsin. Yalnızca geçerli JSON döndür, başka hiçbir şey ekleme.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Debug: confirm API key is present
  const apiKey = getEnv("ANTHROPIC_API_KEY");
  console.log("[battle] ANTHROPIC_API_KEY present:", !!apiKey, "length:", apiKey.length);

  let body: {
    mc1: { name: string; line?: string; lines?: string[] };
    mc2: { name: string; line?: string; lines?: string[] };
    bpm: number;
    style?: string;
    topic?: string;
    round?: number;
  };

  try { body = await req.json(); }
  catch (e) {
    console.error("[battle] JSON parse error:", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mc1, mc2, bpm, style = "Freestyle", topic = "Serbest", round = 1 } = body;

  // Accept either a single `line` string or a `lines` array (solo mode sends both)
  const mc1Text = mc1?.line?.trim() || mc1?.lines?.join(" / ") || "";
  const mc2Text = mc2?.line?.trim() || mc2?.lines?.join(" / ") || "";

  console.log("[battle] mc1:", mc1?.name, "| mc2:", mc2?.name, "| bpm:", bpm, "| round:", round);
  console.log("[battle] mc1 text:", mc1Text.slice(0, 80));
  console.log("[battle] mc2 text:", mc2Text.slice(0, 80));

  if (!mc1Text || !mc2Text) {
    console.warn("[battle] Missing lines — mc1Text:", !!mc1Text, "mc2Text:", !!mc2Text);
    return NextResponse.json({ error: "Both lines required" }, { status: 400 });
  }

  const prompt = `Round ${round} Battle Değerlendirmesi
BPM: ${bpm} | Stil: ${style} | Konu: ${topic}

${mc1.name} yazdı: "${mc1Text}"
${mc2.name} yazdı: "${mc2Text}"

Her MC için 0-10 arası puan ver:
- rhyme: kafiye kalitesi, ses uyumu, kafiye çeşitliliği
- flow: ritim uyumu, hece düzeni, BPM'e uygunluk
- originality: klişe kullanımı, özgün imge, yaratıcılık

KURAL: Klişe ("sokaklar ağlıyor", "kalbim yandı" gibi) kullanan MC ceza alır.
Her MC için 1-2 cümle Türkçe geri bildirim yaz. Kazananı belirle.

Şu JSON formatında yanıt ver (başka hiçbir şey yazma):
{
  "mc1": { "rhyme": 7, "flow": 8, "originality": 6, "total": 21, "feedback": "Türkçe yorum" },
  "mc2": { "rhyme": 6, "flow": 7, "originality": 8, "total": 21, "feedback": "Türkçe yorum" },
  "winner": "mc1",
  "judgeComment": "Kısa Türkçe açıklama"
}
winner değeri yalnızca "mc1", "mc2" veya "tie" olabilir.`;

  try {
    console.log("[battle] Calling Anthropic API...");
    const msg = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = msg.content.find(b => b.type === "text")?.text ?? "";
    console.log("[battle] Raw response (first 300):", raw.slice(0, 300));

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Strip markdown fences and retry
      const stripped = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      console.log("[battle] Retrying parse after strip, first 200:", stripped.slice(0, 200));
      parsed = JSON.parse(stripped);
    }

    console.log("[battle] Parsed OK, winner:", (parsed as Record<string, unknown>)?.winner);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[battle] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
