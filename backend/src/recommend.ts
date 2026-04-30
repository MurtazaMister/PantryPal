import { demoRecipes } from "./data";
import type { PantryItem, Recipe, RecipeIngredient, RecipeRecommendation, UserMemorySummary } from "./types";

function isExpiringSoon(item?: PantryItem) {
  if (!item?.expiryDate) return false;
  return new Date(item.expiryDate).getTime() - Date.now() <= 3 * 86400000;
}

function parsePrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  const mealType = (["breakfast", "lunch", "dinner", "snack"] as const).find((entry) => lower.includes(entry));
  const explicitUnder15 = lower.includes("under 15") || lower.includes("15 min");
  const explicitUnder30 = lower.includes("under 30") || lower.includes("30 min");
  const quick = lower.includes("quick") || lower.includes("easy") || lower.includes("fast");
  const promptMaxMinutes: 15 | 30 | undefined = explicitUnder15 ? 15 : explicitUnder30 ? 30 : quick ? 15 : undefined;
  return {
    highProtein: lower.includes("high protein"),
    noOven: lower.includes("no oven"),
    cuisine: ["indian", "chinese", "french", "american", "mexican", "italian", "japanese"].find((entry) =>
      lower.includes(entry),
    ),
    mealType,
    promptMaxMinutes,
  };
}

function title(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function findAltForMissing(pantry: PantryItem[], missing: RecipeIngredient) {
  return pantry.find((item) => item.quantity > 0 && item.normalizedName !== missing.normalizedName);
}

function scoreRecipe(
  recipe: Recipe,
  pantry: PantryItem[],
  filters: {
    maxMinutes?: 15 | 30 | 60;
    cuisine?: string;
    equipment?: "stove" | "oven" | "microwave" | "grill" | "none";
    availability: "cookable-now" | "missing-a-few" | "prioritize-expiring";
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
  },
  promptSignals: ReturnType<typeof parsePrompt>,
  memory: UserMemorySummary,
  mode: "default" | "prompt",
): RecipeRecommendation {
  let score = 0;
  const pantryCoveredIngredients: RecipeIngredient[] = [];
  const missingIngredients: RecipeIngredient[] = [];

  recipe.ingredients.forEach((ingredient) => {
    const pantryMatch = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
    if (pantryMatch && pantryMatch.quantity >= ingredient.quantity) {
      pantryCoveredIngredients.push(ingredient);
      score += 18;
      if (isExpiringSoon(pantryMatch)) score += 8;
    } else {
      missingIngredients.push(ingredient);
      score -= 6;
    }
  });

  if (filters.maxMinutes && recipe.cookingTimeMinutes <= filters.maxMinutes) score += 10;
  if (filters.cuisine && recipe.cuisine === filters.cuisine) score += 12;
  if (filters.equipment && recipe.equipment.includes(filters.equipment)) score += 8;
  if (filters.availability === "cookable-now" && missingIngredients.length === 0) score += 16;
  if (filters.availability === "missing-a-few" && missingIngredients.length <= 2) score += 10;

  if (mode === "default") {
    if (memory.topCuisines.includes(recipe.cuisine)) score += 9;
    if (memory.preferredEquipment.some((equipment) => recipe.equipment.includes(equipment))) score += 7;
  }

  if (promptSignals.mealType && recipe.tags.includes(promptSignals.mealType)) score += 12;

  if (promptSignals.cuisine) {
    if (recipe.cuisine.toLowerCase() === promptSignals.cuisine) score += 40;
    else score -= 40;
  }
  if (promptSignals.noOven && !recipe.equipment.includes("oven")) score += 9;
  if (promptSignals.highProtein && recipe.tags.includes("high protein")) score += 11;

  const ingredientAlternatives: Array<{ missingIngredient: string; alternativeIngredient: string }> = [];
  if (missingIngredients.length > 0 && missingIngredients.length <= 2) {
    missingIngredients.forEach((missing) => {
      const alternative = findAltForMissing(pantry, missing);
      if (alternative) {
        ingredientAlternatives.push({
          missingIngredient: missing.name,
          alternativeIngredient: alternative.name,
        });
        score += 5;
      }
    });
  }

  const rationaleBadges = new Set<string>();
  if (missingIngredients.length === 0) rationaleBadges.add("Cookable now");
  if (missingIngredients.length === 1) rationaleBadges.add("Missing 1 ingredient");
  if (ingredientAlternatives.length > 0) rationaleBadges.add("Alternatives available");
  if (
    pantryCoveredIngredients.some((ingredient) => {
      const pantryItem = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
      return isExpiringSoon(pantryItem);
    })
  ) {
    rationaleBadges.add("Uses expiring items");
  }
  rationaleBadges.add(recipe.cuisine);
  rationaleBadges.add(`Ready in ${recipe.cookingTimeMinutes} min`);

  return {
    ...recipe,
    matchScore: Math.max(0.4, Math.min(0.99, score / 100)),
    missingIngredients,
    ingredientAlternatives,
    pantryCoveredIngredients,
    rationaleBadges: [...rationaleBadges],
    usesExpiringItems: [...rationaleBadges].includes("Uses expiring items"),
    estimatedDeductions: pantryCoveredIngredients.map((ingredient) => {
      const pantryItem = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
      return {
        pantryItemId: pantryItem?.id,
        pantryItemName: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        confidence: 0.94,
        reason: "Estimated from recipe structure and serving count.",
      };
    }),
  };
}

function uniqueCuisineFallbackRecipes(
  pantry: PantryItem[],
  cuisine: string,
  mealType?: "breakfast" | "lunch" | "dinner" | "snack",
  maxMinutes?: 15 | 30 | 60,
): Recipe[] {
  const rice = pantry.find((item) => item.normalizedName.includes("rice"));
  const eggs = pantry.find((item) => item.normalizedName.includes("egg"));
  const tomato = pantry.find((item) => item.normalizedName.includes("tomato"));
  const onion = pantry.find((item) => item.normalizedName.includes("onion"));
  const spinach = pantry.find((item) => item.normalizedName.includes("spinach"));
  const cuisineTitle = title(cuisine);
  const flour = pantry.find((item) => item.normalizedName.includes("flour"));
  const milk = pantry.find((item) => item.normalizedName.includes("milk"));
  const defaultTime = maxMinutes ?? 20;

  const commonPantry = pantry.slice(0, 4).map((item) => ({
    name: item.name,
    normalizedName: item.normalizedName,
    quantity: Math.min(1, item.quantity),
    unit: item.unit,
  }));
  const baseIngredients = commonPantry.length ? commonPantry : [{ name: "Rice", normalizedName: "rice", quantity: 1, unit: "cup" }];

  if (cuisine === "american" && mealType === "breakfast") {
    const pancakeIngredients: RecipeIngredient[] = [
      ...(flour ? [{ name: flour.name, normalizedName: flour.normalizedName, quantity: 1, unit: flour.unit }] : []),
      ...(milk ? [{ name: milk.name, normalizedName: milk.normalizedName, quantity: 1, unit: milk.unit }] : []),
      ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 2, unit: eggs.unit }] : []),
      ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 1, unit: tomato.unit }] : []),
    ];
    const safePancakeIngredients = pancakeIngredients.length
      ? pancakeIngredients
      : [{ name: "Eggs", normalizedName: "eggs", quantity: 2, unit: "piece" }];
    return [
      {
        id: "generated-american-breakfast-1",
        title: "Pantry Pancakes",
        cuisine: "American",
        cookingTimeMinutes: Math.min(12, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["breakfast", "quick", "ai-fallback"],
        ingredients: safePancakeIngredients,
        steps: ["Mix batter from pantry ingredients.", "Cook small pancakes on a hot pan.", "Serve warm."],
      },
      {
        id: "generated-american-breakfast-2",
        title: "Quick American Scramble",
        cuisine: "American",
        cookingTimeMinutes: Math.min(10, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["breakfast", "quick", "ai-fallback"],
        ingredients: [
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 3, unit: eggs.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
          ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 1, unit: tomato.unit }] : []),
        ],
        steps: ["Saute aromatics.", "Add eggs and scramble until softly set.", "Serve immediately."],
      },
      {
        id: "generated-american-breakfast-3",
        title: "Savory Breakfast Omelette",
        cuisine: "American",
        cookingTimeMinutes: Math.min(14, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["breakfast", "quick", "ai-fallback"],
        ingredients: [
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 3, unit: eggs.unit }] : []),
          ...(spinach ? [{ name: spinach.name, normalizedName: spinach.normalizedName, quantity: 0.5, unit: spinach.unit }] : []),
        ],
        steps: ["Whisk eggs.", "Cook filling briefly.", "Fold omelette and serve."],
      },
    ];
  }

  const pantryNameIncludes = (term: string) => pantry.find((item) => item.normalizedName.includes(term));
  const oliveOil = pantryNameIncludes("olive oil");
  const chili = pantryNameIncludes("chili");
  const garlic = pantryNameIncludes("garlic");
  const soy = pantryNameIncludes("soy");

  const variantsByCuisine: Record<string, Recipe[]> = {
    italian: [
      {
        id: "generated-italian-1",
        title: "Quick Tomato Egg Bruschetta-Style Skillet",
        cuisine: "Italian",
        cookingTimeMinutes: Math.min(14, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 2, unit: tomato.unit }] : []),
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 2, unit: eggs.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
          ...(oliveOil ? [{ name: oliveOil.name, normalizedName: oliveOil.normalizedName, quantity: 1, unit: oliveOil.unit }] : []),
        ],
        steps: ["Saute onion in oil.", "Cook tomato into a quick sauce.", "Add eggs and finish softly scrambled."],
      },
      {
        id: "generated-italian-2",
        title: "Pantry Pomodoro Rice",
        cuisine: "Italian",
        cookingTimeMinutes: Math.min(15, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(rice ? [{ name: rice.name, normalizedName: rice.normalizedName, quantity: 1, unit: rice.unit }] : []),
          ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 2, unit: tomato.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
          ...(garlic ? [{ name: garlic.name, normalizedName: garlic.normalizedName, quantity: 1, unit: garlic.unit }] : []),
        ],
        steps: ["Saute aromatics.", "Simmer tomatoes into a sauce.", "Fold in warm rice and finish."],
      },
      {
        id: "generated-italian-3",
        title: "Spinach Frittata Cup",
        cuisine: "Italian",
        cookingTimeMinutes: Math.min(12, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 3, unit: eggs.unit }] : []),
          ...(spinach ? [{ name: spinach.name, normalizedName: spinach.normalizedName, quantity: 0.5, unit: spinach.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
        ],
        steps: ["Whisk eggs.", "Cook spinach and onion briefly.", "Set eggs over low heat and fold."],
      },
    ],
    mexican: [
      {
        id: "generated-mexican-1",
        title: "Quick Ranchero Eggs",
        cuisine: "Mexican",
        cookingTimeMinutes: Math.min(12, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 3, unit: eggs.unit }] : []),
          ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 2, unit: tomato.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
          ...(chili ? [{ name: chili.name, normalizedName: chili.normalizedName, quantity: 1, unit: chili.unit }] : []),
        ],
        steps: ["Cook tomato-onion salsa.", "Crack in eggs and cover until just set.", "Serve hot."],
      },
      {
        id: "generated-mexican-2",
        title: "Mexican Tomato Rice Skillet",
        cuisine: "Mexican",
        cookingTimeMinutes: Math.min(15, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(rice ? [{ name: rice.name, normalizedName: rice.normalizedName, quantity: 1, unit: rice.unit }] : []),
          ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 2, unit: tomato.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 1, unit: onion.unit }] : []),
          ...(chili ? [{ name: chili.name, normalizedName: chili.normalizedName, quantity: 1, unit: chili.unit }] : []),
        ],
        steps: ["Saute onion and chili.", "Cook tomatoes into a base.", "Fold in rice and finish."],
      },
      {
        id: "generated-mexican-3",
        title: "Spinach Huevos Revuelto",
        cuisine: "Mexican",
        cookingTimeMinutes: Math.min(10, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 3, unit: eggs.unit }] : []),
          ...(spinach ? [{ name: spinach.name, normalizedName: spinach.normalizedName, quantity: 0.5, unit: spinach.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
        ],
        steps: ["Saute onion and spinach.", "Add eggs and scramble softly.", "Serve immediately."],
      },
    ],
    japanese: [
      {
        id: "generated-japanese-1",
        title: "Tamago Rice Bowl",
        cuisine: "Japanese",
        cookingTimeMinutes: Math.min(12, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(rice ? [{ name: rice.name, normalizedName: rice.normalizedName, quantity: 1, unit: rice.unit }] : []),
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 2, unit: eggs.unit }] : []),
          ...(soy ? [{ name: soy.name, normalizedName: soy.normalizedName, quantity: 1, unit: soy.unit }] : []),
        ],
        steps: ["Warm rice.", "Soft-scramble eggs.", "Top rice with eggs and a light seasoning."],
      },
      {
        id: "generated-japanese-2",
        title: "Quick Tomato Tamago Stir",
        cuisine: "Japanese",
        cookingTimeMinutes: Math.min(14, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 3, unit: eggs.unit }] : []),
          ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 2, unit: tomato.unit }] : []),
          ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 0.5, unit: onion.unit }] : []),
        ],
        steps: ["Cook tomatoes and onion briefly.", "Fold in beaten eggs.", "Serve while soft."],
      },
      {
        id: "generated-japanese-3",
        title: "Spinach Egg Donburi",
        cuisine: "Japanese",
        cookingTimeMinutes: Math.min(15, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["dinner", "quick", "ai-fallback"],
        ingredients: [
          ...(rice ? [{ name: rice.name, normalizedName: rice.normalizedName, quantity: 1, unit: rice.unit }] : []),
          ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 2, unit: eggs.unit }] : []),
          ...(spinach ? [{ name: spinach.name, normalizedName: spinach.normalizedName, quantity: 0.5, unit: spinach.unit }] : []),
        ],
        steps: ["Steam or warm rice.", "Cook spinach quickly.", "Add egg and spoon over rice."],
      },
    ],
  };

  const variants: Recipe[] =
    variantsByCuisine[cuisine] ??
    [
      {
        id: `generated-${cuisine}-1`,
        title: `${cuisineTitle} Pantry Bowl`,
        cuisine: cuisineTitle,
        cookingTimeMinutes: Math.min(25, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["quick", "ai-fallback"],
        ingredients: baseIngredients,
        steps: ["Prep the available pantry ingredients.", "Cook aromatics, add main ingredients, and season.", "Serve hot."],
      },
      {
        id: `generated-${cuisine}-2`,
        title: `${cuisineTitle} Weeknight Skillet`,
        cuisine: cuisineTitle,
        cookingTimeMinutes: Math.min(20, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["quick", "ai-fallback"],
        ingredients: baseIngredients,
        steps: ["Heat pan and cook aromatics.", "Add proteins/vegetables and cook through.", "Finish and serve."],
      },
      {
        id: `generated-${cuisine}-3`,
        title: `${cuisineTitle} Quick Stir`,
        cuisine: cuisineTitle,
        cookingTimeMinutes: Math.min(18, defaultTime),
        equipment: ["stove"],
        servings: 2,
        tags: ["quick", "ai-fallback"],
        ingredients: baseIngredients,
        steps: ["Stir-fry quickly.", "Adjust texture with pantry staples.", "Serve warm."],
      },
    ];

  return variants.map((recipe) => ({
    ...recipe,
    tags: Array.from(new Set([mealType ?? "dinner", ...recipe.tags])),
    ingredients: recipe.ingredients.length ? recipe.ingredients : baseIngredients,
  }));
}

export function recommendRecipes(input: {
  pantry: PantryItem[];
  filters: {
    maxMinutes?: 15 | 30 | 60;
    cuisine?: string;
    equipment?: "stove" | "oven" | "microwave" | "grill" | "none";
    availability: "cookable-now" | "missing-a-few" | "prioritize-expiring";
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
  };
  prompt: string;
  memory: UserMemorySummary;
  mode?: "default" | "prompt";
  recipes?: Recipe[];
}): RecipeRecommendation[] {
  const promptSignals = parsePrompt(input.prompt);
  const mode: "default" | "prompt" = input.mode ?? (input.prompt.trim() ? "prompt" : "default");
  const recipes = input.recipes ?? demoRecipes;

  let candidateRecipes = recipes;
  const effectiveMealType = promptSignals.mealType ?? input.filters.mealType;
  const effectiveMaxMinutes = promptSignals.promptMaxMinutes ?? input.filters.maxMinutes;

  candidateRecipes = candidateRecipes.filter((recipe) => recipe.tags.includes(effectiveMealType));
  if (effectiveMaxMinutes) {
    candidateRecipes = candidateRecipes.filter((recipe) => recipe.cookingTimeMinutes <= effectiveMaxMinutes);
  }
  if (input.filters.equipment) {
    candidateRecipes = candidateRecipes.filter((recipe) => recipe.equipment.includes(input.filters.equipment!));
  }

  if (mode === "prompt" && promptSignals.cuisine) {
    const strictMatches = candidateRecipes.filter((recipe) => recipe.cuisine.toLowerCase() === promptSignals.cuisine);
    candidateRecipes = strictMatches.length
      ? strictMatches
      : uniqueCuisineFallbackRecipes(input.pantry, promptSignals.cuisine, effectiveMealType, effectiveMaxMinutes);
  }

  const scored = candidateRecipes
    .map((recipe) =>
      scoreRecipe(
        recipe,
        input.pantry,
        { ...input.filters, mealType: effectiveMealType, maxMinutes: effectiveMaxMinutes },
        promptSignals,
        input.memory,
        mode,
      ),
    )
    .filter((recipe) => {
      if (mode === "prompt" && promptSignals.cuisine) {
        return recipe.cuisine.toLowerCase() === promptSignals.cuisine;
      }
      return true;
    })
    .filter((recipe) => {
      if (effectiveMaxMinutes && recipe.cookingTimeMinutes > effectiveMaxMinutes) return false;
      if (!recipe.tags.includes(effectiveMealType)) return false;
      if (mode === "prompt" && promptSignals.cuisine && recipe.cuisine.toLowerCase() !== promptSignals.cuisine)
        return false;
      if (input.filters.availability === "cookable-now" && recipe.missingIngredients.length > 0) return false;
      if (input.filters.availability === "missing-a-few" && recipe.missingIngredients.length > 2) return false;
      return true;
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, 3);
}

export function buildDeductionEstimate(input: {
  pantry: PantryItem[];
  servings: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId?: string;
  description?: string;
}) {
  const recipe =
    (input.recipeId ? demoRecipes.find((entry) => entry.id === input.recipeId) : undefined) ??
    demoRecipes.find((entry) => input.description?.toLowerCase().includes(entry.title.toLowerCase()));

  const deductions = (recipe?.ingredients ??
    input.pantry.slice(0, 3).map((item) => ({
      name: item.name,
      normalizedName: item.normalizedName,
      quantity: Math.max(0.5, Number((item.quantity * 0.2).toFixed(1))),
      unit: item.unit,
    }))).map((ingredient) => {
    const pantryItem = input.pantry.find((item) => item.normalizedName === ingredient.normalizedName);
    return {
      pantryItemId: pantryItem?.id,
      itemName: ingredient.name,
      quantity: recipe ? Number(((ingredient.quantity * input.servings) / recipe.servings).toFixed(1)) : ingredient.quantity,
      unit: ingredient.unit,
      confidence: pantryItem ? 0.85 : 0.55,
      reason: recipe
        ? `Estimated from ${recipe.title} for ${input.servings} servings.`
        : "Estimated from the meal description and pantry overlap.",
    };
  });

  const unmatchedIngredients = recipe
    ? recipe.ingredients
        .filter((ingredient) => !input.pantry.some((item) => item.normalizedName === ingredient.normalizedName))
        .map((ingredient) => ({
          name: ingredient.name,
          reason: "Common ingredient for this dish but not found in pantry.",
        }))
    : [];

  return {
    meal_name: recipe?.title ?? "Custom meal",
    servings: input.servings,
    deductions,
    unmatched_ingredients: unmatchedIngredients,
  };
}
