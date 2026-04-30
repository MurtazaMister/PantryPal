import { z } from "zod";

export const expiryEstimateOutputSchema = z.object({
  shelfLifeDays: z.number().int().positive().max(3650),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export type ExpiryEstimateOutput = z.infer<typeof expiryEstimateOutputSchema>;

export const recipeSummaryOutputSchema = z.object({
  summary: z.string().min(1).max(240),
});

export type RecipeSummaryOutput = z.infer<typeof recipeSummaryOutputSchema>;

const deductionSchema = z.object({
  pantryItemId: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export const deductionEstimateOutputSchema = z.object({
  meal_name: z.string().min(1),
  servings: z.number().positive(),
  deductions: z.array(deductionSchema),
  unmatched_ingredients: z.array(
    z.object({
      name: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

export type DeductionEstimateOutput = z.infer<typeof deductionEstimateOutputSchema>;

export const expiryEstimateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    shelfLifeDays: { type: "integer", minimum: 1, maximum: 3650 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string", minLength: 1 },
  },
  required: ["shelfLifeDays", "confidence", "reason"],
} as const;

export const recipeSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 240 },
  },
  required: ["summary"],
} as const;

export const deductionEstimateJsonSchema = {
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
} as const;

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
} as const;

export const recipeChatOutputSchema = z.object({
  assistantMessage: z.string().min(1),
  recipeSnapshot: z.object({
    title: z.string().min(1),
    cuisine: z.string().min(1),
    cookingTimeMinutes: z.number().int().positive(),
    equipment: z.array(z.enum(["stove", "oven", "microwave", "grill", "none"])).min(1),
    servings: z.number().positive(),
    ingredients: z.array(
      z.object({
        name: z.string().min(1),
        normalizedName: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().min(1),
      }),
    ),
    steps: z.array(z.string().min(1)),
  }),
});

export type RecipeChatOutput = z.infer<typeof recipeChatOutputSchema>;

export const recipeChatJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistantMessage: { type: "string", minLength: 1 },
    recipeSnapshot: recipeSnapshotSchema,
  },
  required: ["assistantMessage", "recipeSnapshot"],
} as const;

export const recipeFinalizeOutputSchema = z.object({
  finalRecipeSnapshot: recipeChatOutputSchema.shape.recipeSnapshot,
  deductions: z.array(
    z.object({
      pantryItemId: z.string().optional(),
      itemName: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      confidence: z.number().min(0).max(1),
      reason: z.string().min(1),
    }),
  ),
  unmatched_ingredients: z.array(
    z.object({
      name: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

export type RecipeFinalizeOutput = z.infer<typeof recipeFinalizeOutputSchema>;

export const recipeFinalizeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    finalRecipeSnapshot: recipeSnapshotSchema,
    deductions: deductionEstimateJsonSchema.properties.deductions,
    unmatched_ingredients: deductionEstimateJsonSchema.properties.unmatched_ingredients,
  },
  required: ["finalRecipeSnapshot", "deductions", "unmatched_ingredients"],
} as const;
