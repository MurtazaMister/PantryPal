import { z } from "zod";

export const pantryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  purchasedDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const estimateExpirySchema = z.object({
  userId: z.string().default("guest_demo"),
  itemName: z.string().min(1),
  unit: z.string().min(1),
  purchasedDate: z.string(),
});

export const recipeQuerySchema = z.object({
  userId: z.string().default("guest_demo"),
  mode: z.enum(["default", "prompt"]).optional(),
  pantry: z.array(pantryItemSchema),
  filters: z.object({
    maxMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
    cuisine: z.string().optional(),
    equipment: z.enum(["stove", "oven", "microwave", "grill", "none"]).optional(),
    availability: z.enum(["cookable-now", "missing-a-few", "prioritize-expiring"]),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  }),
  prompt: z.string().default(""),
});

export const deductionEstimateSchema = z.object({
  userId: z.string().default("guest_demo"),
  pantry: z.array(pantryItemSchema),
  recipeId: z.string().optional(),
  description: z.string().optional(),
  servings: z.number().min(1),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1),
});

const recipeSnapshotSchema = z.object({
  title: z.string().min(1),
  cuisine: z.string().min(1),
  cookingTimeMinutes: z.number().int().positive(),
  equipment: z.array(z.enum(["stove", "oven", "microwave", "grill", "none"])).min(1),
  servings: z.number().min(1),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      normalizedName: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ),
  steps: z.array(z.string().min(1)),
});

export const recipeChatSchema = z.object({
  userId: z.string().default("guest_demo"),
  pantry: z.array(pantryItemSchema),
  recipeSnapshot: recipeSnapshotSchema,
  chatHistory: z.array(chatMessageSchema).max(24).default([]),
  message: z.string().min(1),
});

export const recipeFinalizeSchema = z.object({
  userId: z.string().default("guest_demo"),
  pantry: z.array(pantryItemSchema),
  recipeSnapshot: recipeSnapshotSchema,
  chatHistory: z.array(chatMessageSchema).max(40).default([]),
});

export const memoryRefreshSchema = z.object({
  userId: z.string(),
  payload: z.object({
    topCuisines: z.array(z.string()),
    preferredIngredients: z.array(z.string()),
    avoidedOrMissingIngredients: z.array(z.string()),
    recentCookedRecipes: z.array(z.string()),
    preferredTimeRange: z.string(),
    preferredEquipment: z.array(z.enum(["stove", "oven", "microwave", "grill", "none"])),
    mealTypePatterns: z.array(z.enum(["breakfast", "lunch", "dinner", "snack"])),
    usualServings: z.number(),
  }),
});

export const authGuestSchema = z.object({
  deviceInstallId: z.string().min(8),
});

export const mergeGuestSchema = z.object({
  guestUserId: z.string().min(3),
  authenticatedUserId: z.string().min(3),
  mode: z.enum(["merge", "fresh"]),
});

export const itemSuggestionsQuerySchema = z.object({
  userId: z.string().min(3),
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

export const deleteSuggestionSchema = z.object({
  userId: z.string().min(3),
  normalizedName: z.string().min(1),
});

export const customUnitSchema = z.object({
  userId: z.string().min(3),
  unitName: z.string().min(1).max(32),
});
