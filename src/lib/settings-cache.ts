import { db } from "./db";

const CACHE_TTL_MS = 30_000;
let cache: Record<string, string> | null = null;
let cacheAt = 0;

export async function getSettingsMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  const settings = await db.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  cache = map;
  cacheAt = now;
  return map;
}

export function invalidateSettingsCache() {
  cache = null;
  cacheAt = 0;
}
