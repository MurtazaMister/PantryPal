"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRedis = initRedis;
exports.saveUserMemory = saveUserMemory;
exports.loadUserMemory = loadUserMemory;
const ioredis_1 = __importDefault(require("ioredis"));
class MemoryFallbackStore {
    hashes = new Map();
    async hset(key, values) {
        this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...values });
    }
    async hgetall(key) {
        return this.hashes.get(key) ?? {};
    }
}
const fallback = new MemoryFallbackStore();
let redis;
function initRedis(url) {
    if (!url) {
        return;
    }
    redis = new ioredis_1.default(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
    });
    redis.connect().catch(() => {
        redis = undefined;
    });
}
function memoryKey(userId) {
    return `user:${userId}:memory:profile`;
}
async function saveUserMemory(userId, summary) {
    const serialized = {
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
async function loadUserMemory(userId) {
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
