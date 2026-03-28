import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

// SDK auto-reads ANTHROPIC_API_KEY from process.env, but we override here
// because the system environment may have an empty ANTHROPIC_API_KEY="" that
// takes precedence over .env.local in all standard loading mechanisms.
export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getEnv("ANTHROPIC_API_KEY") });
}
