import { createId, normalizeName, todayIso, isLowStock } from "../lib";
import type {
  CookingLog,
  PantryItem,
  Recipe,
  ReminderPreferences,
  ShoppingItem,
  UserMemorySummary,
  UserSession,
  Profile,
} from "../types";

const now = todayIso();
const nextDay = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export const demoSession: UserSession = {
  id: "guest_demo",
  name: "Demo Cook",
  mode: "guest",
};

export const defaultProfile: Profile = {
  displayName: "Demo Cook",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  onboardingComplete: false,
  householdSize: 3,
};

export const demoPantry: PantryItem[] = [
  {
    id: createId("pantry"),
    name: "Rice",
    normalizedName: normalizeName("Rice"),
    quantity: 4,
    unit: "cup",
    purchasedDate: now,
    lowStockThreshold: 1.5,
    isLowStock: false,
  },
  {
    id: createId("pantry"),
    name: "Lentils",
    normalizedName: normalizeName("Lentils"),
    quantity: 2,
    unit: "cup",
    purchasedDate: now,
    lowStockThreshold: 1,
    isLowStock: false,
  },
  {
    id: createId("pantry"),
    name: "Onion",
    normalizedName: normalizeName("Onion"),
    quantity: 3,
    unit: "piece",
    purchasedDate: now,
    lowStockThreshold: 1,
    isLowStock: false,
  },
  {
    id: createId("pantry"),
    name: "Tomato",
    normalizedName: normalizeName("Tomato"),
    quantity: 4,
    unit: "piece",
    expiryDate: nextDay(2),
    purchasedDate: now,
    lowStockThreshold: 2,
    isLowStock: false,
  },
  {
    id: createId("pantry"),
    name: "Spinach",
    normalizedName: normalizeName("Spinach"),
    quantity: 1,
    unit: "bunch",
    expiryDate: nextDay(1),
    purchasedDate: now,
    lowStockThreshold: 1,
    isLowStock: true,
  },
  {
    id: createId("pantry"),
    name: "Eggs",
    normalizedName: normalizeName("Eggs"),
    quantity: 6,
    unit: "piece",
    purchasedDate: now,
    lowStockThreshold: 2,
    isLowStock: false,
  },
  {
    id: createId("pantry"),
    name: "Cumin",
    normalizedName: normalizeName("Cumin"),
    quantity: 5,
    unit: "tbsp",
    purchasedDate: now,
    lowStockThreshold: 1,
    isLowStock: false,
  },
  {
    id: createId("pantry"),
    name: "Turmeric",
    normalizedName: normalizeName("Turmeric"),
    quantity: 3,
    unit: "tbsp",
    purchasedDate: now,
    lowStockThreshold: 1,
    isLowStock: false,
  },
];

export const starterShopping: ShoppingItem[] = [
  {
    id: createId("shop"),
    name: "Greek Yogurt",
    normalizedName: normalizeName("Greek Yogurt"),
    quantity: 1,
    unit: "cup",
    source: "manual",
    createdAt: now,
  },
  {
    id: createId("shop"),
    name: "Green Chili",
    normalizedName: normalizeName("Green Chili"),
    quantity: 4,
    unit: "piece",
    source: "recipe-gap",
    createdAt: now,
  },
];

export const demoRecipes: Recipe[] = [
  {
    id: "dal-rice",
    title: "Dal Rice",
    cuisine: "Indian",
    cookingTimeMinutes: 28,
    equipment: ["stove"],
    servings: 3,
    source: "catalog",
    tags: ["high protein", "comfort", "dinner"],
    ingredients: [
      { name: "Rice", normalizedName: normalizeName("Rice"), quantity: 1.5, unit: "cup" },
      { name: "Lentils", normalizedName: normalizeName("Lentils"), quantity: 1, unit: "cup" },
      { name: "Onion", normalizedName: normalizeName("Onion"), quantity: 1, unit: "piece" },
      { name: "Tomato", normalizedName: normalizeName("Tomato"), quantity: 2, unit: "piece" },
      { name: "Turmeric", normalizedName: normalizeName("Turmeric"), quantity: 1, unit: "tsp" },
      { name: "Cumin", normalizedName: normalizeName("Cumin"), quantity: 1, unit: "tsp" },
    ],
    steps: [
      "Rinse the rice and lentils separately.",
      "Cook the lentils with turmeric until tender.",
      "Saute onion, tomato, and cumin, then fold into the lentils.",
      "Cook the rice and serve hot with the dal.",
    ],
  },
  {
    id: "spinach-omelette",
    title: "Spinach Omelette",
    cuisine: "French",
    cookingTimeMinutes: 12,
    equipment: ["stove"],
    servings: 2,
    source: "catalog",
    tags: ["breakfast", "quick", "use soon"],
    ingredients: [
      { name: "Eggs", normalizedName: normalizeName("Eggs"), quantity: 4, unit: "piece" },
      { name: "Spinach", normalizedName: normalizeName("Spinach"), quantity: 0.5, unit: "bunch" },
      { name: "Onion", normalizedName: normalizeName("Onion"), quantity: 0.5, unit: "piece" },
    ],
    steps: [
      "Whisk the eggs until frothy.",
      "Saute onion and spinach briefly.",
      "Pour in eggs, fold gently, and cook until just set.",
    ],
  },
  {
    id: "tomato-egg-fried-rice",
    title: "Tomato Egg Fried Rice",
    cuisine: "Chinese",
    cookingTimeMinutes: 18,
    equipment: ["stove"],
    servings: 2,
    source: "catalog",
    tags: ["quick", "lunch", "stove only"],
    ingredients: [
      { name: "Rice", normalizedName: normalizeName("Rice"), quantity: 1, unit: "cup" },
      { name: "Eggs", normalizedName: normalizeName("Eggs"), quantity: 2, unit: "piece" },
      { name: "Tomato", normalizedName: normalizeName("Tomato"), quantity: 2, unit: "piece" },
      { name: "Onion", normalizedName: normalizeName("Onion"), quantity: 0.5, unit: "piece" },
    ],
    steps: [
      "Scramble the eggs and set aside.",
      "Cook onion and tomato until saucy.",
      "Stir in rice, return the eggs, and season.",
    ],
  },
  {
    id: "masala-spinach-rice",
    title: "Masala Spinach Rice",
    cuisine: "Indian",
    cookingTimeMinutes: 22,
    equipment: ["stove"],
    servings: 2,
    source: "catalog",
    tags: ["use soon", "weeknight"],
    ingredients: [
      { name: "Rice", normalizedName: normalizeName("Rice"), quantity: 1, unit: "cup" },
      { name: "Spinach", normalizedName: normalizeName("Spinach"), quantity: 1, unit: "bunch" },
      { name: "Onion", normalizedName: normalizeName("Onion"), quantity: 1, unit: "piece" },
      { name: "Cumin", normalizedName: normalizeName("Cumin"), quantity: 1, unit: "tsp" },
    ],
    steps: [
      "Cook the rice until fluffy.",
      "Saute onion, cumin, and spinach until soft.",
      "Fold the rice through the masala spinach and serve.",
    ],
  },
  {
    id: "protein-lentil-bowl",
    title: "Protein Lentil Bowl",
    cuisine: "American",
    cookingTimeMinutes: 15,
    equipment: ["microwave", "stove"],
    servings: 1,
    source: "catalog",
    tags: ["healthy", "high protein", "lunch"],
    ingredients: [
      { name: "Lentils", normalizedName: normalizeName("Lentils"), quantity: 1, unit: "cup" },
      { name: "Spinach", normalizedName: normalizeName("Spinach"), quantity: 0.5, unit: "bunch" },
      { name: "Tomato", normalizedName: normalizeName("Tomato"), quantity: 1, unit: "piece" },
    ],
    steps: [
      "Warm the lentils until steaming.",
      "Toss in spinach and tomato.",
      "Season and serve as a quick bowl.",
    ],
  },
];

export const demoLogs: CookingLog[] = [
  {
    id: createId("log"),
    mealDescription: "Tomato egg fried rice",
    mealType: "dinner",
    servings: 2,
    deductions: [],
    sourceType: "recipe",
    confirmed: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const defaultReminderPreferences: ReminderPreferences = {
  breakfastEnabled: true,
  breakfastWindow: [7, 9],
  lunchEnabled: true,
  lunchWindow: [12, 14],
  dinnerEnabled: true,
  dinnerWindow: [18, 20],
  followUpDelayMinutes: 60,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const demoMemorySummary: UserMemorySummary = {
  topCuisines: ["Indian", "Chinese"],
  preferredIngredients: ["Rice", "Lentils", "Spinach", "Eggs"],
  avoidedOrMissingIngredients: ["Green Chili"],
  recentCookedRecipes: ["Tomato Egg Fried Rice", "Dal Rice"],
  preferredTimeRange: "under 30 min",
  preferredEquipment: ["stove"],
  mealTypePatterns: ["dinner", "lunch"],
  usualServings: 3,
};

export const freshPantry: PantryItem[] = [];
export const freshShopping: ShoppingItem[] = [];

export function recalcLowStock(items: PantryItem[]) {
  return items.map((item) => ({
    ...item,
    isLowStock: isLowStock(item.quantity, item.lowStockThreshold),
  }));
}
