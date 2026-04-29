import "dotenv/config";
import cors from "cors";
import express from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoMemorySummary, demoPantry } from "./seed";
import { initRedis, loadUserMemory, saveUserMemory } from "./memory";
import {
  authGuestSchema,
  customUnitSchema,
  deleteSuggestionSchema,
  deductionEstimateSchema,
  estimateExpirySchema,
  itemSuggestionsQuerySchema,
  memoryRefreshSchema,
  mergeGuestSchema,
  recipeQuerySchema,
} from "./schemas";
import { buildDeductionEstimate, recommendRecipes } from "./recommend";
import { enrichPromptWithOpenAI, estimateExpiryWithOpenAI } from "./openai";

type SuggestionEntry = {
  name: string;
  normalizedName: string;
  unit?: string;
  score: number;
};

const app = express();
app.use(cors());
app.use(express.json());

let devReqCounter = 0;
app.use((request, response, next) => {
  const startedAt = Date.now();
  const requestId = `req_${++devReqCounter}`;
  const userId =
    (typeof request.body?.userId === "string" && request.body.userId) ||
    (typeof request.query?.userId === "string" && request.query.userId) ||
    "unknown";
  (request as express.Request & { requestId?: string }).requestId = requestId;
  console.log(`dev:req id=${requestId} method=${request.method} path=${request.path} userId=${userId}`);
  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`dev:res id=${requestId} status=${response.statusCode} durationMs=${durationMs}`);
  });
  next();
});

initRedis(process.env.REDIS_URL);
saveUserMemory("guest_demo", demoMemorySummary).catch(() => undefined);

const deviceToGuestUser = new Map<string, string>();
const userHistory = new Map<string, SuggestionEntry[]>();
const userCustomUnits = new Map<string, Set<string>>();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

function randomGuestId() {
  return `guest_${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function heuristicShelfLifeDays(itemName: string) {
  const name = normalize(itemName);
  if (name.includes("spinach") || name.includes("leafy")) return 3;
  if (name.includes("tomato")) return 6;
  if (name.includes("onion")) return 14;
  if (name.includes("egg")) return 21;
  if (name.includes("lentil") || name.includes("rice") || name.includes("flour")) return 180;
  if (name.includes("milk") || name.includes("yogurt")) return 7;
  return 10;
}

function rankSuggestion(query: string, candidate: string) {
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

async function persistGuestMapping(deviceInstallId: string, guestUserId: string) {
  if (!supabaseAdmin) {
    return;
  }
  await supabaseAdmin.from("guest_users").upsert(
    {
      device_install_id: deviceInstallId,
      guest_user_id: guestUserId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_install_id" },
  );
}

async function lookupGuestMapping(deviceInstallId: string) {
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
  return data.guest_user_id as string;
}

async function persistCustomUnit(userId: string, unitName: string) {
  if (!supabaseAdmin) {
    return;
  }
  await supabaseAdmin.from("custom_units").upsert(
    {
      user_id: userId,
      unit_name: unitName,
      normalized_unit: normalize(unitName),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,normalized_unit" },
  );
}

async function loadCustomUnitsFromDb(userId: string) {
  if (!supabaseAdmin) {
    return [] as string[];
  }
  const { data, error } = await supabaseAdmin
    .from("custom_units")
    .select("unit_name")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error || !data) {
    return [] as string[];
  }
  return data.map((row) => row.unit_name as string);
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "pantrypal-backend" });
});
console.log("dev:server-ready");

app.post("/auth/guest", async (request, response) => {
  const parsed = authGuestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { deviceInstallId } = parsed.data;
  let userId =
    deviceToGuestUser.get(deviceInstallId) ??
    (await lookupGuestMapping(deviceInstallId)) ??
    randomGuestId();
  const isNew = !deviceToGuestUser.has(deviceInstallId);
  deviceToGuestUser.set(deviceInstallId, userId);
  await persistGuestMapping(deviceInstallId, userId).catch(() => undefined);

  if (!userHistory.has(userId)) {
      userHistory.set(
      userId,
      demoPantry.map((item) => ({
        name: item.name,
        normalizedName: item.normalizedName,
        unit: item.unit,
        score: 10,
      })),
    );
  }

  response.json({
    userId,
    isNew,
    pantry: demoPantry,
    message: "Guest account resolved.",
  });
});

app.post("/auth/merge-guest", async (request, response) => {
  const parsed = mergeGuestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { guestUserId, authenticatedUserId, mode } = parsed.data;
  if (mode === "merge") {
    const guestHistory = userHistory.get(guestUserId) ?? [];
    const authHistory = userHistory.get(authenticatedUserId) ?? [];
    userHistory.set(authenticatedUserId, [...guestHistory, ...authHistory]);

    const guestUnits = userCustomUnits.get(guestUserId) ?? new Set<string>();
    const authUnits = userCustomUnits.get(authenticatedUserId) ?? new Set<string>();
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
  const parsed = itemSuggestionsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, q, limit } = parsed.data;
  const normalizedQuery = normalize(q);
  const fromHistory = userHistory.get(userId) ?? [];
  const fromDemoPantry = demoPantry.map((item) => ({
    name: item.name,
    normalizedName: item.normalizedName,
    unit: item.unit,
    score: 5,
  }));
  const candidates = [...fromHistory, ...fromDemoPantry]
    .map((entry) => ({
      ...entry,
      score: entry.score + rankSuggestion(normalizedQuery, entry.normalizedName),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const deduped: SuggestionEntry[] = [];
  const seen = new Set<string>();
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
    })),
  });
});

app.delete("/items/suggestions", async (request, response) => {
  const parsed = deleteSuggestionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, normalizedName } = parsed.data;
  const existing = userHistory.get(userId) ?? [];
  const next = existing.filter((entry) => entry.normalizedName !== normalizedName);
  userHistory.set(userId, next);
  console.log(`dev:suggestions deleted userId=${userId} normalizedName=${normalizedName} removed=${existing.length - next.length}`);
  response.json({ ok: true, removed: existing.length - next.length });
});

app.post("/units/custom", async (request, response) => {
  const parsed = customUnitSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { userId, unitName } = parsed.data;
  const normalizedUnit = normalize(unitName);
  const units = userCustomUnits.get(userId) ?? new Set<string>();
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

  const inMemory = [...(userCustomUnits.get(userId) ?? new Set<string>())];
  const fromDb = await loadCustomUnitsFromDb(userId);
  const unique = Array.from(new Set([...inMemory, ...fromDb.map((entry) => normalize(entry))]));
  response.json({ units: unique });
});

app.post("/ai/recipe-query", async (request, response) => {
  const parsed = recipeQuerySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const memory = (await loadUserMemory(parsed.data.userId)) ?? demoMemorySummary;
  console.log(
    `dev:ai recipe-query userId=${parsed.data.userId} pantryCount=${parsed.data.pantry.length} promptLen=${parsed.data.prompt.length}`,
  );
  const aiSummary = await enrichPromptWithOpenAI({
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
      score: 8,
    });
    userHistory.set(parsed.data.userId, entries);
  });

  const recipes = recommendRecipes({
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
  const parsed = deductionEstimateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  console.log(
    `dev:ai deduction-estimate userId=${parsed.data.userId} servings=${parsed.data.servings} recipeId=${parsed.data.recipeId ?? "none"} hasDescription=${Boolean(parsed.data.description)}`,
  );
  response.json(
    buildDeductionEstimate({
      pantry: parsed.data.pantry,
      servings: parsed.data.servings,
      mealType: parsed.data.mealType,
      recipeId: parsed.data.recipeId,
      description: parsed.data.description,
    }),
  );
});

app.post("/ai/estimate-expiry", async (request, response) => {
  const parsed = estimateExpirySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { itemName, unit, purchasedDate } = parsed.data;
  console.log(
    `dev:ai estimate-expiry userId=${parsed.data.userId} item=${itemName} unit=${unit} purchasedDate=${purchasedDate}`,
  );
  const modelEstimate = await estimateExpiryWithOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    itemName,
    unit,
    purchasedDate,
  });

  const shelfLifeDays = modelEstimate?.shelfLifeDays ?? heuristicShelfLifeDays(itemName);
  if (modelEstimate) {
    console.log(
      `dev:ai estimate-expiry model-success item=${itemName} shelfLifeDays=${modelEstimate.shelfLifeDays} confidence=${modelEstimate.confidence}`,
    );
  } else {
    console.log(
      `dev:ai estimate-expiry fallback-heuristic item=${itemName} shelfLifeDays=${shelfLifeDays}`,
    );
  }
  const confidence = modelEstimate?.confidence ?? 0.55;
  const reason = modelEstimate?.reason ?? "Estimated from common pantry shelf-life defaults.";
  const purchased = new Date(purchasedDate);
  const approxExpiryDate = new Date(
    purchased.getFullYear(),
    purchased.getMonth(),
    purchased.getDate() + shelfLifeDays,
  ).toISOString();

  response.json({
    approxExpiryDate,
    confidence,
    reason,
  });
});

app.post("/memory/refresh", async (request, response) => {
  const parsed = memoryRefreshSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await saveUserMemory(parsed.data.userId, parsed.data.payload);
  response.json({ ok: true });
});

app.use(
  (
    error: unknown,
    request: express.Request & { requestId?: string },
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    const userId =
      (typeof request.body?.userId === "string" && request.body.userId) ||
      (typeof request.query?.userId === "string" && request.query.userId) ||
      "unknown";
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.log(
      `dev:error id=${request.requestId ?? "unknown"} path=${request.path} userId=${userId} message=${message}`,
    );
    if (stack) {
      console.log(`dev:error-stack ${stack}`);
    }
    response.status(500).json({ error: "Internal server error" });
  },
);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`PantryPal backend listening on http://localhost:${port}`);
});
