import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 10) ?? "none",
  });
}
