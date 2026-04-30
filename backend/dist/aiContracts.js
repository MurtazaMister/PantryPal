"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeFinalizeJsonSchema = exports.recipeFinalizeOutputSchema = exports.recipeChatJsonSchema = exports.recipeChatOutputSchema = exports.deductionEstimateJsonSchema = exports.recipeSummaryJsonSchema = exports.expiryEstimateJsonSchema = exports.deductionEstimateOutputSchema = exports.recipeSummaryOutputSchema = exports.expiryEstimateOutputSchema = void 0;
const zod_1 = require("zod");
exports.expiryEstimateOutputSchema = zod_1.z.object({
    shelfLifeDays: zod_1.z.number().int().positive().max(3650),
    confidence: zod_1.z.number().min(0).max(1),
    reason: zod_1.z.string().min(1),
});
exports.recipeSummaryOutputSchema = zod_1.z.object({
    summary: zod_1.z.string().min(1).max(240),
});
const deductionSchema = zod_1.z.object({
    pantryItemId: zod_1.z.string().optional(),
    itemName: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unit: zod_1.z.string().min(1),
    confidence: zod_1.z.number().min(0).max(1),
    reason: zod_1.z.string().min(1),
});
exports.deductionEstimateOutputSchema = zod_1.z.object({
    meal_name: zod_1.z.string().min(1),
    servings: zod_1.z.number().positive(),
    deductions: zod_1.z.array(deductionSchema),
    unmatched_ingredients: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        reason: zod_1.z.string().min(1),
    })),
});
exports.expiryEstimateJsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        shelfLifeDays: { type: "integer", minimum: 1, maximum: 3650 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string", minLength: 1 },
    },
    required: ["shelfLifeDays", "confidence", "reason"],
};
exports.recipeSummaryJsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        summary: { type: "string", minLength: 1, maxLength: 240 },
    },
    required: ["summary"],
};
exports.deductionEstimateJsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        meal_name: { type: "string", minLength: 1 },
        servings: { type: "number", exclusiveMinimum: 0 },
        deductions: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    pantryItemId: { type: "string" },
                    itemName: { type: "string", minLength: 1 },
                    quantity: { type: "number", exclusiveMinimum: 0 },
                    unit: { type: "string", minLength: 1 },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    reason: { type: "string", minLength: 1 },
                },
                required: ["itemName", "quantity", "unit", "confidence", "reason"],
            },
        },
        unmatched_ingredients: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    name: { type: "string", minLength: 1 },
                    reason: { type: "string", minLength: 1 },
                },
                required: ["name", "reason"],
            },
        },
    },
    required: ["meal_name", "servings", "deductions", "unmatched_ingredients"],
};
const recipeSnapshotSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        title: { type: "string", minLength: 1 },
        cuisine: { type: "string", minLength: 1 },
        cookingTimeMinutes: { type: "integer", minimum: 1 },
        equipment: {
            type: "array",
            items: { type: "string", enum: ["stove", "oven", "microwave", "grill", "none"] },
            minItems: 1,
        },
        servings: { type: "number", exclusiveMinimum: 0 },
        ingredients: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    name: { type: "string", minLength: 1 },
                    normalizedName: { type: "string", minLength: 1 },
                    quantity: { type: "number", exclusiveMinimum: 0 },
                    unit: { type: "string", minLength: 1 },
                },
                required: ["name", "normalizedName", "quantity", "unit"],
            },
        },
        steps: { type: "array", items: { type: "string", minLength: 1 } },
    },
    required: ["title", "cuisine", "cookingTimeMinutes", "equipment", "servings", "ingredients", "steps"],
};
exports.recipeChatOutputSchema = zod_1.z.object({
    assistantMessage: zod_1.z.string().min(1),
    recipeSnapshot: zod_1.z.object({
        title: zod_1.z.string().min(1),
        cuisine: zod_1.z.string().min(1),
        cookingTimeMinutes: zod_1.z.number().int().positive(),
        equipment: zod_1.z.array(zod_1.z.enum(["stove", "oven", "microwave", "grill", "none"])).min(1),
        servings: zod_1.z.number().positive(),
        ingredients: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string().min(1),
            normalizedName: zod_1.z.string().min(1),
            quantity: zod_1.z.number().positive(),
            unit: zod_1.z.string().min(1),
        })),
        steps: zod_1.z.array(zod_1.z.string().min(1)),
    }),
});
exports.recipeChatJsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        assistantMessage: { type: "string", minLength: 1 },
        recipeSnapshot: recipeSnapshotSchema,
    },
    required: ["assistantMessage", "recipeSnapshot"],
};
exports.recipeFinalizeOutputSchema = zod_1.z.object({
    finalRecipeSnapshot: exports.recipeChatOutputSchema.shape.recipeSnapshot,
    deductions: zod_1.z.array(zod_1.z.object({
        pantryItemId: zod_1.z.string().optional(),
        itemName: zod_1.z.string().min(1),
        quantity: zod_1.z.number().positive(),
        unit: zod_1.z.string().min(1),
        confidence: zod_1.z.number().min(0).max(1),
        reason: zod_1.z.string().min(1),
    })),
    unmatched_ingredients: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        reason: zod_1.z.string().min(1),
    })),
});
exports.recipeFinalizeJsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        finalRecipeSnapshot: recipeSnapshotSchema,
        deductions: exports.deductionEstimateJsonSchema.properties.deductions,
        unmatched_ingredients: exports.deductionEstimateJsonSchema.properties.unmatched_ingredients,
    },
    required: ["finalRecipeSnapshot", "deductions", "unmatched_ingredients"],
};
