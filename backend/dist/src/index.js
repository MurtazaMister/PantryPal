"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
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
app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "pantrypal-backend" });
});
app.post("/auth/guest", (_request, response) => {
    response.json({
        userId: `guest_${Math.random().toString(36).slice(2, 10)}`,
        pantry: seed_1.demoPantry,
        message: "Guest account created.",
    });
});
app.post("/auth/merge-guest", (request, response) => {
    response.json({
        mergedFromGuestId: request.body?.guestUserId ?? "guest_demo",
        authenticatedUserId: request.body?.authenticatedUserId ?? "google_user",
        status: "merged",
    });
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
