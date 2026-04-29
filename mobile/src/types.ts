export type UserMode = "guest" | "authenticated";
export type UpgradeMergeMode = "merge" | "fresh";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Equipment = "stove" | "oven" | "microwave" | "grill" | "none";

export type BuiltInUnit =
  | "piece"
  | "cup"
  | "tbsp"
  | "tsp"
  | "gram"
  | "kilogram"
  | "ml"
  | "liter"
  | "bunch";

export type Unit = BuiltInUnit | string;

export interface UserSession {
  id: string;
  name: string;
  mode: UserMode;
  email?: string;
}

export interface Profile {
  displayName: string;
  timezone: string;
  onboardingComplete: boolean;
  householdSize: number;
}

export interface PantryItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  expiryDate?: string;
  purchasedDate: string;
  lowStockThreshold: number;
  isLowStock: boolean;
  lastUsedAt?: string;
  approxExpiryDate?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  source: "manual" | "recipe-gap" | "low-stock";
  linkedPantryItemId?: string;
  createdAt: string;
}

export interface ItemSuggestion {
  name: string;
  normalizedName: string;
  unit?: Unit;
}

export interface RecipeIngredient {
  name: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  availableInPantry?: boolean;
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
  source: "catalog" | "ai-fallback";
}

export interface RecipeRecommendation extends Recipe {
  matchScore: number;
  missingIngredients: RecipeIngredient[];
  pantryCoveredIngredients: RecipeIngredient[];
  rationaleBadges: string[];
  estimatedDeductions: DeductionSuggestion[];
  usesExpiringItems: boolean;
}

export interface DeductionSuggestion {
  pantryItemId?: string;
  pantryItemName: string;
  quantity: number;
  unit: Unit;
  confidence: number;
  reason: string;
}

export interface DeductionDraft {
  id: string;
  sourceType: "recipe" | "manual";
  recipeId?: string;
  mealName: string;
  mealType: MealType;
  servings: number;
  deductions: DeductionSuggestion[];
  unmatchedIngredients: { name: string; reason: string }[];
  createdAt: string;
}

export interface CookingLog {
  id: string;
  recipeId?: string;
  mealDescription: string;
  mealType: MealType;
  servings: number;
  deductions: DeductionSuggestion[];
  sourceType: "recipe" | "manual";
  reminderOrigin?: "meal_reminder" | "follow_up";
  confirmed: boolean;
  createdAt: string;
}

export interface RecipeInteraction {
  id: string;
  recipeId: string;
  action: "viewed" | "saved" | "dismissed" | "cooked";
  mealType?: MealType;
  createdAt: string;
}

export interface QueryHistoryEntry {
  id: string;
  promptText: string;
  parsedFilters: Partial<RecommendationFilters>;
  acceptedRecipeId?: string;
  createdAt: string;
}

export interface ReminderPreferences {
  breakfastEnabled: boolean;
  breakfastWindow: [number, number];
  lunchEnabled: boolean;
  lunchWindow: [number, number];
  dinnerEnabled: boolean;
  dinnerWindow: [number, number];
  followUpDelayMinutes: number;
  timezone: string;
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

export interface UndoEvent {
  id: string;
  snapshot: PantryItem[];
  createdAt: string;
  label: string;
}

export interface RecommendationFilters {
  maxMinutes?: 15 | 30 | 60;
  cuisine?: string;
  equipment?: Equipment;
  availability: "cookable-now" | "missing-a-few" | "prioritize-expiring";
  mealType: MealType;
}
