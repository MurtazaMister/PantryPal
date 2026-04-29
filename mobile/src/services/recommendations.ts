import { createId, isExpiringSoon, normalizeName } from "../lib";
import type {
  DeductionDraft,
  DeductionSuggestion,
  MealType,
  PantryItem,
  QueryHistoryEntry,
  Recipe,
  RecipeIngredient,
  RecipeRecommendation,
  RecommendationFilters,
  UserMemorySummary,
} from "../types";

function findPantryMatch(pantry: PantryItem[], ingredient: RecipeIngredient) {
  return pantry.find((item) => item.normalizedName === ingredient.normalizedName);
}

function parsePrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  return {
    wantsHighProtein: lower.includes("high protein"),
    wantsHealthy: lower.includes("healthy"),
    noOven: lower.includes("no oven"),
    cuisine: ["indian", "chinese", "italian", "mexican", "american", "french"].find((value) =>
      lower.includes(value),
    ),
    servings: (() => {
      const match = lower.match(/for (\d+)/);
      return match ? Number(match[1]) : undefined;
    })(),
  };
}

export function rankRecipes(params: {
  pantry: PantryItem[];
  recipes: Recipe[];
  filters: RecommendationFilters;
  prompt: string;
  memory: UserMemorySummary;
}) {
  const { pantry, recipes, filters, prompt, memory } = params;
  const promptSignals = parsePrompt(prompt);

  return recipes
    .map((recipe) => {
      let score = 0;
      const pantryCoveredIngredients: RecipeIngredient[] = [];
      const missingIngredients: RecipeIngredient[] = [];

      recipe.ingredients.forEach((ingredient) => {
        const match = findPantryMatch(pantry, ingredient);
        if (match && match.quantity >= ingredient.quantity) {
          pantryCoveredIngredients.push({ ...ingredient, availableInPantry: true });
          score += 16;
          if (isExpiringSoon(match)) {
            score += 7;
          }
        } else {
          missingIngredients.push(ingredient);
          score -= 4;
        }
      });

      if (filters.maxMinutes && recipe.cookingTimeMinutes <= filters.maxMinutes) {
        score += 10;
      }

      if (filters.cuisine && recipe.cuisine === filters.cuisine) {
        score += 12;
      }

      if (filters.equipment && recipe.equipment.includes(filters.equipment)) {
        score += 8;
      }

      if (filters.availability === "cookable-now" && missingIngredients.length === 0) {
        score += 20;
      }

      if (filters.availability === "missing-a-few" && missingIngredients.length <= 2) {
        score += 12;
      }

      if (filters.availability === "prioritize-expiring") {
        score += pantryCoveredIngredients.filter((ingredient) => {
          const pantryItem = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
          return pantryItem && isExpiringSoon(pantryItem);
        }).length * 8;
      }

      if (memory.topCuisines.includes(recipe.cuisine)) {
        score += 10;
      }

      if (memory.preferredEquipment.some((equipment) => recipe.equipment.includes(equipment))) {
        score += 6;
      }

      const ingredientHits = recipe.ingredients.filter((ingredient) =>
        memory.preferredIngredients.includes(ingredient.name),
      ).length;
      score += ingredientHits * 4;

      if (promptSignals.cuisine && recipe.cuisine.toLowerCase() === promptSignals.cuisine) {
        score += 12;
      }

      if (promptSignals.noOven && !recipe.equipment.includes("oven")) {
        score += 10;
      }

      if (promptSignals.wantsHighProtein && recipe.tags.includes("high protein")) {
        score += 12;
      }

      if (promptSignals.wantsHealthy && recipe.tags.includes("healthy")) {
        score += 10;
      }

      if (promptSignals.servings && recipe.servings === promptSignals.servings) {
        score += 5;
      }

      if (memory.mealTypePatterns.includes(filters.mealType)) {
        score += 4;
      }

      const badges = new Set<string>();
      if (missingIngredients.length === 0) {
        badges.add("Cookable now");
      }
      if (missingIngredients.length === 1) {
        badges.add("Missing 1 ingredient");
      }
      if (recipe.cookingTimeMinutes <= 20) {
        badges.add(`Ready in ${recipe.cookingTimeMinutes} min`);
      }
      if (recipe.equipment.length === 1 && recipe.equipment[0] === "stove") {
        badges.add("Stove only");
      }
      if (pantryCoveredIngredients.some((ingredient) => {
        const pantryItem = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
        return pantryItem && isExpiringSoon(pantryItem);
      })) {
        badges.add("Uses expiring items");
      }
      badges.add(recipe.cuisine);

      const recommendation: RecipeRecommendation = {
        ...recipe,
        matchScore: Math.max(0.4, Math.min(0.99, score / 100)),
        missingIngredients,
        pantryCoveredIngredients,
        rationaleBadges: Array.from(badges),
        usesExpiringItems: Array.from(badges).includes("Uses expiring items"),
        estimatedDeductions: recipe.ingredients
          .filter((ingredient) => pantry.some((item) => item.normalizedName === ingredient.normalizedName))
          .map((ingredient) => {
            const pantryItem = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
            return {
              pantryItemId: pantryItem?.id,
              pantryItemName: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              confidence: 0.94,
              reason: "Estimated from the selected recipe and serving count.",
            };
          }),
      };

      return recommendation;
    })
    .sort((left, right) => right.matchScore - left.matchScore);
}

export function createRecipeDraft(params: {
  recommendation: RecipeRecommendation;
  mealType: MealType;
  servings: number;
}): DeductionDraft {
  const multiplier = params.servings / params.recommendation.servings;
  return {
    id: createId("draft"),
    sourceType: "recipe",
    recipeId: params.recommendation.id,
    mealName: params.recommendation.title,
    mealType: params.mealType,
    servings: params.servings,
    createdAt: new Date().toISOString(),
    unmatchedIngredients: params.recommendation.missingIngredients.map((ingredient) => ({
      name: ingredient.name,
      reason: "Recipe ingredient is missing from pantry.",
    })),
    deductions: params.recommendation.estimatedDeductions.map((deduction) => ({
      ...deduction,
      quantity: Number((deduction.quantity * multiplier).toFixed(1)),
    })),
  };
}

export function estimateManualDraft(params: {
  description: string;
  servings: number;
  mealType: MealType;
  pantry: PantryItem[];
  recipes: Recipe[];
}): DeductionDraft {
  const lower = params.description.toLowerCase();
  const matchedRecipe =
    params.recipes.find((recipe) => lower.includes(recipe.title.toLowerCase())) ||
    params.recipes.find((recipe) =>
      recipe.ingredients.some((ingredient) => lower.includes(ingredient.name.toLowerCase())),
    );

  const baseDeductions: DeductionSuggestion[] = matchedRecipe
    ? matchedRecipe.ingredients.map((ingredient) => {
        const pantryItem = params.pantry.find((item) => item.normalizedName === ingredient.normalizedName);
        return {
          pantryItemId: pantryItem?.id,
          pantryItemName: ingredient.name,
          quantity: Number(((ingredient.quantity * params.servings) / matchedRecipe.servings).toFixed(1)),
          unit: ingredient.unit,
          confidence: pantryItem ? 0.86 : 0.58,
          reason: matchedRecipe
            ? `Estimated from the ${matchedRecipe.title} pattern for ${params.servings} servings.`
            : "Estimated from pantry and meal description.",
        };
      })
    : params.pantry
        .filter((item) => lower.includes(item.name.toLowerCase()))
        .slice(0, 4)
        .map((item) => ({
          pantryItemId: item.id,
          pantryItemName: item.name,
          quantity: Math.max(0.5, Number((item.quantity * 0.25).toFixed(1))),
          unit: item.unit,
          confidence: 0.63,
          reason: "Mentioned directly in the meal description.",
        }));

  const unmatchedIngredients = matchedRecipe
    ? matchedRecipe.ingredients
        .filter((ingredient) => !params.pantry.some((item) => item.normalizedName === ingredient.normalizedName))
        .map((ingredient) => ({
          name: ingredient.name,
          reason: "Common ingredient for this dish but not found in pantry.",
        }))
    : [];

  return {
    id: createId("draft"),
    sourceType: "manual",
    mealName: matchedRecipe?.title ?? "Custom meal",
    mealType: params.mealType,
    servings: params.servings,
    deductions: baseDeductions,
    unmatchedIngredients,
    createdAt: new Date().toISOString(),
  };
}

export function buildQueryHistoryEntry(promptText: string, filters: RecommendationFilters): QueryHistoryEntry {
  return {
    id: createId("query"),
    promptText,
    parsedFilters: filters,
    createdAt: new Date().toISOString(),
  };
}

export function buildMemorySummary(params: {
  recipes: Recipe[];
  logs: { mealDescription: string; mealType: MealType; servings: number }[];
  interactions: { recipeId: string; action: "viewed" | "saved" | "dismissed" | "cooked" }[];
  pantry: PantryItem[];
  queryHistory: QueryHistoryEntry[];
}): UserMemorySummary {
  const cuisineCounts = new Map<string, number>();
  const ingredientCounts = new Map<string, number>();
  const equipmentCounts = new Map<string, number>();
  const mealTypeCounts = new Map<MealType, number>();

  params.interactions.forEach((interaction) => {
    const recipe = params.recipes.find((entry) => entry.id === interaction.recipeId);
    if (!recipe) {
      return;
    }

    cuisineCounts.set(recipe.cuisine, (cuisineCounts.get(recipe.cuisine) ?? 0) + (interaction.action === "cooked" ? 3 : 1));
    recipe.ingredients.forEach((ingredient) => {
      ingredientCounts.set(ingredient.name, (ingredientCounts.get(ingredient.name) ?? 0) + 1);
    });
    recipe.equipment.forEach((equipment) => {
      equipmentCounts.set(equipment, (equipmentCounts.get(equipment) ?? 0) + 1);
    });
  });

  params.logs.forEach((log) => {
    mealTypeCounts.set(log.mealType, (mealTypeCounts.get(log.mealType) ?? 0) + 1);
  });

  const topCuisines = Array.from(cuisineCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const preferredIngredients = Array.from(ingredientCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  const preferredEquipment = Array.from(equipmentCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name as UserMemorySummary["preferredEquipment"][number]);

  const mealTypePatterns = Array.from(mealTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  const recentCookedRecipes = params.logs.slice(-3).map((log) => log.mealDescription);
  const avoidedOrMissingIngredients = params.queryHistory
    .flatMap((entry) => entry.promptText.split(/[, ]+/))
    .filter((token) => ["no", "without", "missing"].includes(token.toLowerCase()))
    .slice(0, 2);

  const usualServings = Math.round(
    params.logs.reduce((sum, log) => sum + log.servings, 0) / Math.max(1, params.logs.length),
  );

  const pantryBias = params.pantry
    .slice()
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 2)
    .map((item) => item.name);

  return {
    topCuisines: topCuisines.length ? topCuisines : ["Indian"],
    preferredIngredients: preferredIngredients.length ? preferredIngredients : pantryBias,
    avoidedOrMissingIngredients,
    recentCookedRecipes,
    preferredTimeRange: "under 30 min",
    preferredEquipment: preferredEquipment.length ? preferredEquipment : ["stove"],
    mealTypePatterns: mealTypePatterns.length ? mealTypePatterns : ["dinner"],
    usualServings: usualServings || 2,
  };
}

export function mergeAcceptedRecipeInHistory(queryHistory: QueryHistoryEntry[], prompt: string, recipeId: string) {
  const history = queryHistory.slice();
  const lastIndex = history.findLastIndex((entry) => entry.promptText === prompt);
  if (lastIndex === -1) {
    return history;
  }

  history[lastIndex] = {
    ...history[lastIndex],
    acceptedRecipeId: recipeId,
  };

  return history;
}
