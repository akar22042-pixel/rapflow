import fs from "fs";
import path from "path";

// Cache parsed .env.local values after first read
let envLocalCache: Record<string, string> | null = null;

function readEnvLocal(): Record<string, string> {
  if (envLocalCache) return envLocalCache;
  envLocalCache = {};
  try {
    const filePath = path.join(process.cwd(), ".env.local");
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      envLocalCache[k] = v;
    }
  } catch {
    // File doesn't exist (production) — leave cache empty
  }
  return envLocalCache;
}

export function getEnv(key: string): string {
  const fromEnv = process.env[key];
  // If the system env has a non-empty value, use it
  if (fromEnv) return fromEnv;
  // Fall back to .env.local (handles system env override with empty string)
  return readEnvLocal()[key] ?? "";
}
