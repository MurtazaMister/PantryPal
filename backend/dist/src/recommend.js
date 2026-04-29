"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendRecipes = recommendRecipes;
exports.buildDeductionEstimate = buildDeductionEstimate;
const data_1 = require("./data");
function isExpiringSoon(item) {
    if (!item?.expiryDate) {
        return false;
    }
    return new Date(item.expiryDate).getTime() - Date.now() <= 3 * 86400000;
}
function parsePrompt(prompt) {
    const lower = prompt.toLowerCase();
    return {
        highProtein: lower.includes("high protein"),
        noOven: lower.includes("no oven"),
        cuisine: ["indian", "chinese", "french", "american"].find((entry) => lower.includes(entry)),
    };
}
function recommendRecipes(input) {
    const promptSignals = parsePrompt(input.prompt);
    const recipes = input.recipes ?? data_1.demoRecipes;
    return recipes
        .map((recipe) => {
        let score = 0;
        const pantryCoveredIngredients = [];
        const missingIngredients = [];
        recipe.ingredients.forEach((ingredient) => {
            const pantryMatch = input.pantry.find((item) => item.normalizedName === ingredient.normalizedName);
            if (pantryMatch && pantryMatch.quantity >= ingredient.quantity) {
                pantryCoveredIngredients.push(ingredient);
                score += 18;
                if (isExpiringSoon(pantryMatch)) {
                    score += 8;
                }
            }
            else {
                missingIngredients.push(ingredient);
                score -= 5;
            }
        });
        if (input.filters.maxMinutes && recipe.cookingTimeMinutes <= input.filters.maxMinutes) {
            score += 10;
        }
        if (input.filters.cuisine && recipe.cuisine === input.filters.cuisine) {
            score += 12;
        }
        if (input.filters.equipment && recipe.equipment.includes(input.filters.equipment)) {
            score += 8;
        }
        if (input.memory.topCuisines.includes(recipe.cuisine)) {
            score += 9;
        }
        if (input.memory.preferredEquipment.some((equipment) => recipe.equipment.includes(equipment))) {
            score += 7;
        }
        if (promptSignals.cuisine && recipe.cuisine.toLowerCase() === promptSignals.cuisine) {
            score += 12;
        }
        if (promptSignals.noOven && !recipe.equipment.includes("oven")) {
            score += 9;
        }
        if (promptSignals.highProtein && recipe.tags.includes("high protein")) {
            score += 11;
        }
        const rationaleBadges = new Set();
        if (missingIngredients.length === 0) {
            rationaleBadges.add("Cookable now");
        }
        if (missingIngredients.length === 1) {
            rationaleBadges.add("Missing 1 ingredient");
        }
        if (pantryCoveredIngredients.some((ingredient) => {
            const pantryItem = input.pantry.find((item) => item.normalizedName === ingredient.normalizedName);
            return isExpiringSoon(pantryItem);
        })) {
            rationaleBadges.add("Uses expiring items");
        }
        rationaleBadges.add(recipe.cuisine);
        rationaleBadges.add(`Ready in ${recipe.cookingTimeMinutes} min`);
        return {
            ...recipe,
            matchScore: Math.max(0.4, Math.min(0.99, score / 100)),
            missingIngredients,
            pantryCoveredIngredients,
            rationaleBadges: [...rationaleBadges],
            usesExpiringItems: [...rationaleBadges].includes("Uses expiring items"),
            estimatedDeductions: pantryCoveredIngredients.map((ingredient) => {
                const pantryItem = input.pantry.find((item) => item.normalizedName === ingredient.normalizedName);
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
    })
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 3);
}
function buildDeductionEstimate(input) {
    const recipe = (input.recipeId ? data_1.demoRecipes.find((entry) => entry.id === input.recipeId) : undefined) ??
        data_1.demoRecipes.find((entry) => input.description?.toLowerCase().includes(entry.title.toLowerCase()));
    const deductions = (recipe?.ingredients ?? input.pantry.slice(0, 3).map((item) => ({
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
