import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM = `Sen tarafsız bir Türkçe rap battle hakemisin. Her iki MC'nin satırlarını kafiye, flow ve orijinallik açısından değerlendirirsin. Yalnızca geçerli JSON döndür.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    mc1: { name: string; line: string };
    mc2: { name: string; line: string };
    bpm: number;
    style?: string;
    topic?: string;
    round?: number;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { mc1, mc2, bpm, style = "Freestyle", topic = "Serbest", round = 1 } = body;

  if (!mc1?.line?.trim() || !mc2?.line?.trim()) {
    return NextResponse.json({ error: "Both lines required" }, { status: 400 });
  }

  const prompt = `Round ${round} Battle Değerlendirmesi
BPM: ${bpm} | Stil: ${style} | Konu: ${topic}

${mc1.name} yazdı: "${mc1.line}"
${mc2.name} yazdı: "${mc2.line}"

Her MC için 0-10 arası puan ver:
- rhyme: kafiye kalitesi, ses uyumu, kafiye çeşitliliği
- flow: ritim uyumu, hece düzeni, BPM'e uygunluk
- originality: klişe kullanımı, özgün imge, yaratıcılık

KURAL: Klişe ("sokaklar ağlıyor", "kalbim yandı" gibi) kullanan MC ceza alır.
Her MC için 1-2 cümle Türkçe geri bildirim yaz. Kazananı belirle.

Yalnızca JSON döndür:
{
  "mc1": { "rhyme": <0-10>, "flow": <0-10>, "originality": <0-10>, "total": <0-30>, "feedback": "<Türkçe>" },
  "mc2": { "rhyme": <0-10>, "flow": <0-10>, "originality": <0-10>, "total": <0-30>, "feedback": "<Türkçe>" },
  "winner": "mc1" | "mc2" | "tie",
  "judgeComment": "<1 cümle Türkçe açıklama>"
}`;

  try {
    const msg = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.find(b => b.type === "text")?.text ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch {
      const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(stripped);
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg2 }, { status: 500 });
  }
}
