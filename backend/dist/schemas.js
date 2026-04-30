"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customUnitSchema = exports.deleteSuggestionSchema = exports.itemSuggestionsQuerySchema = exports.mergeGuestSchema = exports.authGuestSchema = exports.memoryRefreshSchema = exports.recipeFinalizeSchema = exports.recipeChatSchema = exports.deductionEstimateSchema = exports.recipeQuerySchema = exports.estimateExpirySchema = exports.pantryItemSchema = void 0;
const zod_1 = require("zod");
exports.pantryItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    normalizedName: zod_1.z.string(),
    quantity: zod_1.z.number(),
    unit: zod_1.z.string(),
    purchasedDate: zod_1.z.string().optional(),
    expiryDate: zod_1.z.string().optional(),
});
exports.estimateExpirySchema = zod_1.z.object({
    userId: zod_1.z.string().default("guest_demo"),
    itemName: zod_1.z.string().min(1),
    unit: zod_1.z.string().min(1),
    purchasedDate: zod_1.z.string(),
});
exports.recipeQuerySchema = zod_1.z.object({
    userId: zod_1.z.string().default("guest_demo"),
    mode: zod_1.z.enum(["default", "prompt"]).optional(),
    pantry: zod_1.z.array(exports.pantryItemSchema),
    filters: zod_1.z.object({
        maxMinutes: zod_1.z.union([zod_1.z.literal(15), zod_1.z.literal(30), zod_1.z.literal(60)]).optional(),
        cuisine: zod_1.z.string().optional(),
        equipment: zod_1.z.enum(["stove", "oven", "microwave", "grill", "none"]).optional(),
        availability: zod_1.z.enum(["cookable-now", "missing-a-few", "prioritize-expiring"]),
        mealType: zod_1.z.enum(["breakfast", "lunch", "dinner", "snack"]),
    }),
    prompt: zod_1.z.string().default(""),
});
exports.deductionEstimateSchema = zod_1.z.object({
    userId: zod_1.z.string().default("guest_demo"),
    pantry: zod_1.z.array(exports.pantryItemSchema),
    recipeId: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    servings: zod_1.z.number().min(1),
    mealType: zod_1.z.enum(["breakfast", "lunch", "dinner", "snack"]),
});
const chatMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(["user", "assistant"]),
    text: zod_1.z.string().min(1),
});
const recipeSnapshotSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    cuisine: zod_1.z.string().min(1),
    cookingTimeMinutes: zod_1.z.number().int().positive(),
    equipment: zod_1.z.array(zod_1.z.enum(["stove", "oven", "microwave", "grill", "none"])).min(1),
    servings: zod_1.z.number().min(1),
    ingredients: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        normalizedName: zod_1.z.string().min(1),
        quantity: zod_1.z.number().positive(),
        unit: zod_1.z.string().min(1),
    })),
    steps: zod_1.z.array(zod_1.z.string().min(1)),
});
exports.recipeChatSchema = zod_1.z.object({
    userId: zod_1.z.string().default("guest_demo"),
    pantry: zod_1.z.array(exports.pantryItemSchema),
    recipeSnapshot: recipeSnapshotSchema,
    chatHistory: zod_1.z.array(chatMessageSchema).max(24).default([]),
    message: zod_1.z.string().min(1),
});
exports.recipeFinalizeSchema = zod_1.z.object({
    userId: zod_1.z.string().default("guest_demo"),
    pantry: zod_1.z.array(exports.pantryItemSchema),
    recipeSnapshot: recipeSnapshotSchema,
    chatHistory: zod_1.z.array(chatMessageSchema).max(40).default([]),
});
exports.memoryRefreshSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    payload: zod_1.z.object({
        topCuisines: zod_1.z.array(zod_1.z.string()),
        preferredIngredients: zod_1.z.array(zod_1.z.string()),
        avoidedOrMissingIngredients: zod_1.z.array(zod_1.z.string()),
        recentCookedRecipes: zod_1.z.array(zod_1.z.string()),
        preferredTimeRange: zod_1.z.string(),
        preferredEquipment: zod_1.z.array(zod_1.z.enum(["stove", "oven", "microwave", "grill", "none"])),
        mealTypePatterns: zod_1.z.array(zod_1.z.enum(["breakfast", "lunch", "dinner", "snack"])),
        usualServings: zod_1.z.number(),
    }),
});
exports.authGuestSchema = zod_1.z.object({
    deviceInstallId: zod_1.z.string().min(8),
});
exports.mergeGuestSchema = zod_1.z.object({
    guestUserId: zod_1.z.string().min(3),
    authenticatedUserId: zod_1.z.string().min(3),
    mode: zod_1.z.enum(["merge", "fresh"]),
});
exports.itemSuggestionsQuerySchema = zod_1.z.object({
    userId: zod_1.z.string().min(3),
    q: zod_1.z.string().min(1),
    limit: zod_1.z.coerce.number().int().min(1).max(10).default(3),
});
exports.deleteSuggestionSchema = zod_1.z.object({
    userId: zod_1.z.string().min(3),
    normalizedName: zod_1.z.string().min(1),
});
exports.customUnitSchema = zod_1.z.object({
    userId: zod_1.z.string().min(3),
    unitName: zod_1.z.string().min(1).max(32),
});
