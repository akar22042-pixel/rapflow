// ElevenLabs TTS helper
const BASE_URL = "https://api.elevenlabs.io/v1";

export async function textToSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs error: ${res.status} ${res.statusText}`);
  }

  return res.arrayBuffer();
}
