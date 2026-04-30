"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendRecipes = recommendRecipes;
exports.buildDeductionEstimate = buildDeductionEstimate;
const data_1 = require("./data");
function isExpiringSoon(item) {
    if (!item?.expiryDate)
        return false;
    return new Date(item.expiryDate).getTime() - Date.now() <= 3 * 86400000;
}
function parsePrompt(prompt) {
    const lower = prompt.toLowerCase();
    return {
        highProtein: lower.includes("high protein"),
        noOven: lower.includes("no oven"),
        cuisine: ["indian", "chinese", "french", "american", "mexican", "italian", "japanese"].find((entry) => lower.includes(entry)),
    };
}
function title(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
function findAltForMissing(pantry, missing) {
    return pantry.find((item) => item.quantity > 0 && item.normalizedName !== missing.normalizedName);
}
function scoreRecipe(recipe, pantry, filters, promptSignals, memory, mode) {
    let score = 0;
    const pantryCoveredIngredients = [];
    const missingIngredients = [];
    recipe.ingredients.forEach((ingredient) => {
        const pantryMatch = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
        if (pantryMatch && pantryMatch.quantity >= ingredient.quantity) {
            pantryCoveredIngredients.push(ingredient);
            score += 18;
            if (isExpiringSoon(pantryMatch))
                score += 8;
        }
        else {
            missingIngredients.push(ingredient);
            score -= 6;
        }
    });
    if (filters.maxMinutes && recipe.cookingTimeMinutes <= filters.maxMinutes)
        score += 10;
    if (filters.cuisine && recipe.cuisine === filters.cuisine)
        score += 12;
    if (filters.equipment && recipe.equipment.includes(filters.equipment))
        score += 8;
    if (filters.availability === "cookable-now" && missingIngredients.length === 0)
        score += 16;
    if (filters.availability === "missing-a-few" && missingIngredients.length <= 2)
        score += 10;
    if (mode === "default") {
        if (memory.topCuisines.includes(recipe.cuisine))
            score += 9;
        if (memory.preferredEquipment.some((equipment) => recipe.equipment.includes(equipment)))
            score += 7;
    }
    if (promptSignals.cuisine) {
        if (recipe.cuisine.toLowerCase() === promptSignals.cuisine)
            score += 40;
        else
            score -= 40;
    }
    if (promptSignals.noOven && !recipe.equipment.includes("oven"))
        score += 9;
    if (promptSignals.highProtein && recipe.tags.includes("high protein"))
        score += 11;
    const ingredientAlternatives = [];
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
    const rationaleBadges = new Set();
    if (missingIngredients.length === 0)
        rationaleBadges.add("Cookable now");
    if (missingIngredients.length === 1)
        rationaleBadges.add("Missing 1 ingredient");
    if (ingredientAlternatives.length > 0)
        rationaleBadges.add("Alternatives available");
    if (pantryCoveredIngredients.some((ingredient) => {
        const pantryItem = pantry.find((item) => item.normalizedName === ingredient.normalizedName);
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
function uniqueCuisineFallbackRecipes(pantry, cuisine) {
    const rice = pantry.find((item) => item.normalizedName.includes("rice"));
    const eggs = pantry.find((item) => item.normalizedName.includes("egg"));
    const tomato = pantry.find((item) => item.normalizedName.includes("tomato"));
    const onion = pantry.find((item) => item.normalizedName.includes("onion"));
    const spinach = pantry.find((item) => item.normalizedName.includes("spinach"));
    const cuisineTitle = title(cuisine);
    const commonPantry = pantry.slice(0, 4).map((item) => ({
        name: item.name,
        normalizedName: item.normalizedName,
        quantity: Math.min(1, item.quantity),
        unit: item.unit,
    }));
    const baseIngredients = commonPantry.length ? commonPantry : [{ name: "Rice", normalizedName: "rice", quantity: 1, unit: "cup" }];
    const variants = [
        {
            id: `generated-${cuisine}-1`,
            title: `${cuisineTitle} Pantry Bowl`,
            cuisine: cuisineTitle,
            cookingTimeMinutes: 25,
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
            cookingTimeMinutes: 20,
            equipment: ["stove"],
            servings: 2,
            tags: ["quick", "ai-fallback"],
            ingredients: [
                ...(rice ? [{ name: rice.name, normalizedName: rice.normalizedName, quantity: 1, unit: rice.unit }] : []),
                ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 2, unit: eggs.unit }] : []),
                ...(tomato ? [{ name: tomato.name, normalizedName: tomato.normalizedName, quantity: 1, unit: tomato.unit }] : []),
                ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 1, unit: onion.unit }] : []),
            ],
            steps: ["Heat pan and cook aromatics.", "Add proteins/vegetables and cook through.", "Finish with cooked base and seasonings."],
        },
        {
            id: `generated-${cuisine}-3`,
            title: `${cuisineTitle} Pantry Stir`,
            cuisine: cuisineTitle,
            cookingTimeMinutes: 18,
            equipment: ["stove"],
            servings: 2,
            tags: ["quick", "ai-fallback"],
            ingredients: [
                ...(spinach ? [{ name: spinach.name, normalizedName: spinach.normalizedName, quantity: 0.5, unit: spinach.unit }] : []),
                ...(onion ? [{ name: onion.name, normalizedName: onion.normalizedName, quantity: 1, unit: onion.unit }] : []),
                ...(eggs ? [{ name: eggs.name, normalizedName: eggs.normalizedName, quantity: 2, unit: eggs.unit }] : []),
            ],
            steps: ["Stir-fry vegetables quickly.", "Add protein and cook until done.", "Adjust texture with pantry staples and serve."],
        },
    ];
    return variants.map((recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.length ? recipe.ingredients : baseIngredients,
    }));
}
function recommendRecipes(input) {
    const promptSignals = parsePrompt(input.prompt);
    const mode = input.mode ?? (input.prompt.trim() ? "prompt" : "default");
    const recipes = input.recipes ?? data_1.demoRecipes;
    let candidateRecipes = recipes;
    if (mode === "prompt" && promptSignals.cuisine) {
        const strictMatches = recipes.filter((recipe) => recipe.cuisine.toLowerCase() === promptSignals.cuisine);
        candidateRecipes = strictMatches.length ? strictMatches : uniqueCuisineFallbackRecipes(input.pantry, promptSignals.cuisine);
    }
    return candidateRecipes
        .map((recipe) => scoreRecipe(recipe, input.pantry, input.filters, promptSignals, input.memory, mode))
        .filter((recipe) => {
        if (mode === "prompt" && promptSignals.cuisine) {
            return recipe.cuisine.toLowerCase() === promptSignals.cuisine;
        }
        return true;
    })
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 3);
}
function buildDeductionEstimate(input) {
    const recipe = (input.recipeId ? data_1.demoRecipes.find((entry) => entry.id === input.recipeId) : undefined) ??
        data_1.demoRecipes.find((entry) => input.description?.toLowerCase().includes(entry.title.toLowerCase()));
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
