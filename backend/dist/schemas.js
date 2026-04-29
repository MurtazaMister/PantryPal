"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customUnitSchema = exports.itemSuggestionsQuerySchema = exports.mergeGuestSchema = exports.authGuestSchema = exports.memoryRefreshSchema = exports.deductionEstimateSchema = exports.recipeQuerySchema = exports.pantryItemSchema = void 0;
const zod_1 = require("zod");
exports.pantryItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    normalizedName: zod_1.z.string(),
    quantity: zod_1.z.number(),
    unit: zod_1.z.string(),
    category: zod_1.z.string(),
    storageLocation: zod_1.z.string(),
    expiryDate: zod_1.z.string().optional(),
});
exports.recipeQuerySchema = zod_1.z.object({
    userId: zod_1.z.string().default("guest_demo"),
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
exports.customUnitSchema = zod_1.z.object({
    userId: zod_1.z.string().min(3),
    unitName: zod_1.z.string().min(1).max(32),
});
