import Redis from "ioredis";
import type { UserMemorySummary } from "./types";

type HashData = Record<string, string>;

class MemoryFallbackStore {
  private hashes = new Map<string, HashData>();

  async hset(key: string, values: HashData) {
    this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...values });
  }

  async hgetall(key: string) {
    return this.hashes.get(key) ?? {};
  }
}

const fallback = new MemoryFallbackStore();
let redis: Redis | undefined;

export function initRedis(url?: string) {
  if (!url) {
    return;
  }

  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  redis.connect().catch(() => {
    redis = undefined;
  });
}

function memoryKey(userId: string) {
  return `user:${userId}:memory:profile`;
}

export async function saveUserMemory(userId: string, summary: UserMemorySummary) {
  const serialized: HashData = {
    topCuisines: JSON.stringify(summary.topCuisines),
    preferredIngredients: JSON.stringify(summary.preferredIngredients),
    avoidedOrMissingIngredients: JSON.stringify(summary.avoidedOrMissingIngredients),
    recentCookedRecipes: JSON.stringify(summary.recentCookedRecipes),
    preferredTimeRange: summary.preferredTimeRange,
    preferredEquipment: JSON.stringify(summary.preferredEquipment),
    mealTypePatterns: JSON.stringify(summary.mealTypePatterns),
    usualServings: String(summary.usualServings),
  };

  if (redis) {
    await redis.hset(memoryKey(userId), serialized);
    await redis.expire(memoryKey(userId), 60 * 60 * 24 * 14);
    return;
  }

  await fallback.hset(memoryKey(userId), serialized);
}

export async function loadUserMemory(userId: string): Promise<UserMemorySummary | null> {
  const source = redis ? await redis.hgetall(memoryKey(userId)) : await fallback.hgetall(memoryKey(userId));
  if (!Object.keys(source).length) {
    return null;
  }

  return {
    topCuisines: JSON.parse(source.topCuisines ?? "[]"),
    preferredIngredients: JSON.parse(source.preferredIngredients ?? "[]"),
    avoidedOrMissingIngredients: JSON.parse(source.avoidedOrMissingIngredients ?? "[]"),
    recentCookedRecipes: JSON.parse(source.recentCookedRecipes ?? "[]"),
    preferredTimeRange: source.preferredTimeRange ?? "under 30 min",
    preferredEquipment: JSON.parse(source.preferredEquipment ?? "[\"stove\"]"),
    mealTypePatterns: JSON.parse(source.mealTypePatterns ?? "[\"dinner\"]"),
    usualServings: Number(source.usualServings ?? "2"),
  };
}
