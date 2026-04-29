export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Equipment = "stove" | "oven" | "microwave" | "grill" | "none";

export interface PantryItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  purchasedDate?: string;
  expiryDate?: string;
}

export interface RecipeIngredient {
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  cuisine: string;
  cookingTimeMinutes: number;
  equipment: Equipment[];
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
}

export interface UserMemorySummary {
  topCuisines: string[];
  preferredIngredients: string[];
  avoidedOrMissingIngredients: string[];
  recentCookedRecipes: string[];
  preferredTimeRange: string;
  preferredEquipment: Equipment[];
  mealTypePatterns: MealType[];
  usualServings: number;
}

export interface RecipeRecommendation extends Recipe {
  matchScore: number;
  missingIngredients: RecipeIngredient[];
  pantryCoveredIngredients: RecipeIngredient[];
  rationaleBadges: string[];
  usesExpiringItems: boolean;
  estimatedDeductions: Array<{
    pantryItemId?: string;
    pantryItemName: string;
    quantity: number;
    unit: string;
    confidence: number;
    reason: string;
  }>;
}
