import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

// SDK auto-reads ANTHROPIC_API_KEY from process.env, but we override here
// because the system environment may have an empty ANTHROPIC_API_KEY="" that
// takes precedence over .env.local in all standard loading mechanisms.
export function getAnthropicClient(): Anthropic {
  const key = getEnv("ANTHROPIC_API_KEY");
  // Pass undefined when empty so the SDK reads process.env.ANTHROPIC_API_KEY itself.
  // Passing "" causes an "authentication method" error in the SDK.
  return new Anthropic({ apiKey: key || undefined });
}
