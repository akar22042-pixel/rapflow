import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Reads a key from .env.local directly, bypassing process.env.
 * Needed because a system-level empty ANTHROPIC_API_KEY="" takes precedence
 * over .env.local in all standard env-loading mechanisms.
 */
function readFromEnvFile(key: string): string {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    if (!existsSync(envPath)) return "";
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (k === key) return v;
    }
  } catch {
    // silently fail — caller handles empty string
  }
  return "";
}

/**
 * Returns the env var value, falling back to .env.local if the system
 * environment has it set to an empty string.
 */
export function getEnv(key: string): string {
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;
  return readFromEnvFile(key);
}
