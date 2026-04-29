"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const supabase_js_1 = require("@supabase/supabase-js");
const seed_1 = require("./seed");
const memory_1 = require("./memory");
const schemas_1 = require("./schemas");
const recommend_1 = require("./recommend");
const openai_1 = require("./openai");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
(0, memory_1.initRedis)(process.env.REDIS_URL);
(0, memory_1.saveUserMemory)("guest_demo", seed_1.demoMemorySummary).catch(() => undefined);
const deviceToGuestUser = new Map();
const userHistory = new Map();
const userCustomUnits = new Map();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey)
    : null;
function randomGuestId() {
    return `guest_${Math.random().toString(36).slice(2, 10)}`;
}
function normalize(value) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function rankSuggestion(query, candidate) {
    if (candidate === query) {
        return 100;
    }
    if (candidate.startsWith(query)) {
        return 80;
    }
    if (candidate.includes(query)) {
        return 40;
    }
    return 0;
}
async function persistGuestMapping(deviceInstallId, guestUserId) {
    if (!supabaseAdmin) {
        return;
    }
    await supabaseAdmin.from("guest_users").upsert({
        device_install_id: deviceInstallId,
        guest_user_id: guestUserId,
        updated_at: new Date().toISOString(),
    }, { onConflict: "device_install_id" });
}
async function lookupGuestMapping(deviceInstallId) {
    if (!supabaseAdmin) {
        return null;
    }
    const { data, error } = await supabaseAdmin
        .from("guest_users")
        .select("guest_user_id")
        .eq("device_install_id", deviceInstallId)
        .maybeSingle();
    if (error || !data?.guest_user_id) {
        return null;
    }
    return data.guest_user_id;
}
async function persistCustomUnit(userId, unitName) {
    if (!supabaseAdmin) {
        return;
    }
    await supabaseAdmin.from("custom_units").upsert({
        user_id: userId,
        unit_name: unitName,
        normalized_unit: normalize(unitName),
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,normalized_unit" });
}
async function loadCustomUnitsFromDb(userId) {
    if (!supabaseAdmin) {
        return [];
    }
    const { data, error } = await supabaseAdmin
        .from("custom_units")
        .select("unit_name")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);
    if (error || !data) {
        return [];
    }
    return data.map((row) => row.unit_name);
}
app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "pantrypal-backend" });
});
app.post("/auth/guest", async (request, response) => {
    const parsed = schemas_1.authGuestSchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { deviceInstallId } = parsed.data;
    let userId = deviceToGuestUser.get(deviceInstallId) ??
        (await lookupGuestMapping(deviceInstallId)) ??
        randomGuestId();
    const isNew = !deviceToGuestUser.has(deviceInstallId);
    deviceToGuestUser.set(deviceInstallId, userId);
    await persistGuestMapping(deviceInstallId, userId).catch(() => undefined);
    if (!userHistory.has(userId)) {
        userHistory.set(userId, seed_1.demoPantry.map((item) => ({
            name: item.name,
            normalizedName: item.normalizedName,
            unit: item.unit,
            category: item.category,
            score: 10,
        })));
    }
    response.json({
        userId,
        isNew,
        pantry: seed_1.demoPantry,
        message: "Guest account resolved.",
    });
});
app.post("/auth/merge-guest", async (request, response) => {
    const parsed = schemas_1.mergeGuestSchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { guestUserId, authenticatedUserId, mode } = parsed.data;
    if (mode === "merge") {
        const guestHistory = userHistory.get(guestUserId) ?? [];
        const authHistory = userHistory.get(authenticatedUserId) ?? [];
        userHistory.set(authenticatedUserId, [...guestHistory, ...authHistory]);
        const guestUnits = userCustomUnits.get(guestUserId) ?? new Set();
        const authUnits = userCustomUnits.get(authenticatedUserId) ?? new Set();
        guestUnits.forEach((unit) => authUnits.add(unit));
        userCustomUnits.set(authenticatedUserId, authUnits);
    }
    response.json({
        mergedFromGuestId: guestUserId,
        authenticatedUserId,
        status: mode === "merge" ? "merged" : "fresh",
    });
});
app.get("/items/suggestions", async (request, response) => {
    const parsed = schemas_1.itemSuggestionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { userId, q, limit } = parsed.data;
    const normalizedQuery = normalize(q);
    const fromHistory = userHistory.get(userId) ?? [];
    const fromDemoPantry = seed_1.demoPantry.map((item) => ({
        name: item.name,
        normalizedName: item.normalizedName,
        unit: item.unit,
        category: item.category,
        score: 5,
    }));
    const candidates = [...fromHistory, ...fromDemoPantry]
        .map((entry) => ({
        ...entry,
        score: entry.score + rankSuggestion(normalizedQuery, entry.normalizedName),
    }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);
    const deduped = [];
    const seen = new Set();
    candidates.forEach((entry) => {
        if (seen.has(entry.normalizedName) || deduped.length >= limit) {
            return;
        }
        seen.add(entry.normalizedName);
        deduped.push(entry);
    });
    response.json({
        suggestions: deduped.map((entry) => ({
            name: entry.name,
            normalizedName: entry.normalizedName,
            unit: entry.unit,
            category: entry.category,
        })),
    });
});
app.post("/units/custom", async (request, response) => {
    const parsed = schemas_1.customUnitSchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const { userId, unitName } = parsed.data;
    const normalizedUnit = normalize(unitName);
    const units = userCustomUnits.get(userId) ?? new Set();
    units.add(normalizedUnit);
    userCustomUnits.set(userId, units);
    await persistCustomUnit(userId, unitName).catch(() => undefined);
    response.json({
        unitName: normalizedUnit,
        allUnits: [...units],
    });
});
app.get("/units/custom", async (request, response) => {
    const userId = typeof request.query.userId === "string" ? request.query.userId : "";
    if (!userId) {
        response.status(400).json({ error: "userId is required" });
        return;
    }
    const inMemory = [...(userCustomUnits.get(userId) ?? new Set())];
    const fromDb = await loadCustomUnitsFromDb(userId);
    const unique = Array.from(new Set([...inMemory, ...fromDb.map((entry) => normalize(entry))]));
    response.json({ units: unique });
});
app.post("/ai/recipe-query", async (request, response) => {
    const parsed = schemas_1.recipeQuerySchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const memory = (await (0, memory_1.loadUserMemory)(parsed.data.userId)) ?? seed_1.demoMemorySummary;
    const aiSummary = await (0, openai_1.enrichPromptWithOpenAI)({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        memory,
        prompt: parsed.data.prompt,
    });
    parsed.data.pantry.forEach((item) => {
        const entries = userHistory.get(parsed.data.userId) ?? [];
        entries.push({
            name: item.name,
            normalizedName: item.normalizedName,
            unit: item.unit,
            category: item.category,
            score: 8,
        });
        userHistory.set(parsed.data.userId, entries);
    });
    const recipes = (0, recommend_1.recommendRecipes)({
        pantry: parsed.data.pantry,
        filters: parsed.data.filters,
        prompt: parsed.data.prompt,
        memory,
    });
    response.json({
        recipes,
        memorySummary: memory,
        aiSummary,
    });
});
app.post("/ai/deduction-estimate", (request, response) => {
    const parsed = schemas_1.deductionEstimateSchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    response.json((0, recommend_1.buildDeductionEstimate)({
        pantry: parsed.data.pantry,
        servings: parsed.data.servings,
        mealType: parsed.data.mealType,
        recipeId: parsed.data.recipeId,
        description: parsed.data.description,
    }));
});
app.post("/memory/refresh", async (request, response) => {
    const parsed = schemas_1.memoryRefreshSchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    await (0, memory_1.saveUserMemory)(parsed.data.userId, parsed.data.payload);
    response.json({ ok: true });
});
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    console.log(`PantryPal backend listening on http://localhost:${port}`);
});
