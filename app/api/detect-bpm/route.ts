import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title } = body;
  if (!title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  try {
    const message = await getAnthropicClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16,
      messages: [{
        role: "user",
        content: `Bu müzik parçasının BPM'ini tahmin et: "${title}". Sadece sayı döndür, başka hiçbir şey yazma. Örnek: 90`,
      }],
    });

    const raw = message.content.find((b) => b.type === "text")?.text ?? "";
    const bpm = parseInt(raw.trim().replace(/[^0-9]/g, ""));
    if (isNaN(bpm) || bpm < 60 || bpm > 220) {
      return NextResponse.json({ bpm: 95 });
    }
    return NextResponse.json({ bpm: Math.max(60, Math.min(200, bpm)) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg, bpm: 95 }, { status: 500 });
  }
}
