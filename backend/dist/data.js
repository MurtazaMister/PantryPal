"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoPantry = exports.demoRecipes = void 0;
function normalizeName(value) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}
exports.demoRecipes = [
    {
        id: "dal-rice",
        title: "Dal Rice",
        cuisine: "Indian",
        cookingTimeMinutes: 28,
        equipment: ["stove"],
        servings: 3,
        tags: ["high protein", "dinner"],
        ingredients: [
            { name: "Rice", normalizedName: normalizeName("Rice"), quantity: 1.5, unit: "cup" },
            { name: "Lentils", normalizedName: normalizeName("Lentils"), quantity: 1, unit: "cup" },
            { name: "Onion", normalizedName: normalizeName("Onion"), quantity: 1, unit: "piece" },
            { name: "Tomato", normalizedName: normalizeName("Tomato"), quantity: 2, unit: "piece" },
            { name: "Turmeric", normalizedName: normalizeName("Turmeric"), quantity: 1, unit: "tsp" }
        ],
        steps: [
            "Cook lentils with turmeric until tender.",
            "Saute onion and tomato.",
            "Fold the masala into the dal and serve with rice."
        ]
    },
    {
        id: "spinach-omelette",
        title: "Spinach Omelette",
        cuisine: "French",
        cookingTimeMinutes: 12,
        equipment: ["stove"],
        servings: 2,
        tags: ["breakfast", "quick"],
        ingredients: [
            { name: "Eggs", normalizedName: normalizeName("Eggs"), quantity: 4, unit: "piece" },
            { name: "Spinach", normalizedName: normalizeName("Spinach"), quantity: 0.5, unit: "bunch" },
            { name: "Onion", normalizedName: normalizeName("Onion"), quantity: 0.5, unit: "piece" }
        ],
        steps: [
            "Whisk eggs.",
            "Saute onion and spinach.",
            "Cook the omelette until just set."
        ]
    },
    {
        id: "tomato-egg-fried-rice",
        title: "Tomato Egg Fried Rice",
        cuisine: "Chinese",
        cookingTimeMinutes: 18,
        equipment: ["stove"],
        servings: 2,
        tags: ["quick", "lunch"],
        ingredients: [
            { name: "Rice", normalizedName: normalizeName("Rice"), quantity: 1, unit: "cup" },
            { name: "Eggs", normalizedName: normalizeName("Eggs"), quantity: 2, unit: "piece" },
            { name: "Tomato", normalizedName: normalizeName("Tomato"), quantity: 2, unit: "piece" }
        ],
        steps: [
            "Scramble the eggs.",
            "Cook tomato into a sauce.",
            "Stir in rice and combine."
        ]
    }
];
exports.demoPantry = [
    { id: "rice", name: "Rice", normalizedName: normalizeName("Rice"), quantity: 4, unit: "cup", purchasedDate: new Date().toISOString() },
    { id: "lentils", name: "Lentils", normalizedName: normalizeName("Lentils"), quantity: 2, unit: "cup", purchasedDate: new Date().toISOString() },
    { id: "onion", name: "Onion", normalizedName: normalizeName("Onion"), quantity: 3, unit: "piece", purchasedDate: new Date().toISOString() },
    { id: "tomato", name: "Tomato", normalizedName: normalizeName("Tomato"), quantity: 4, unit: "piece", purchasedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 2 * 86400000).toISOString() },
    { id: "spinach", name: "Spinach", normalizedName: normalizeName("Spinach"), quantity: 1, unit: "bunch", purchasedDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000).toISOString() },
    { id: "eggs", name: "Eggs", normalizedName: normalizeName("Eggs"), quantity: 6, unit: "piece", purchasedDate: new Date().toISOString() }
];
