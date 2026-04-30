import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId, normalizeName, todayIso, toIsoDateOnly } from "../lib";
import {
  defaultProfile,
  defaultReminderPreferences,
  demoLogs,
  demoMemorySummary,
  demoPantry,
  demoRecipes,
  demoSession,
  freshPantry,
  freshShopping,
  recalcLowStock,
  starterShopping,
} from "../data/demo";
import {
  buildMemorySummary,
  buildQueryHistoryEntry,
  createRecipeDraft as createRecipeDraftFromRecommendation,
  estimateManualDraft,
  mergeAcceptedRecipeInHistory,
  rankRecipes,
} from "../services/recommendations";
import {
  BACKEND_URL,
  checkBackendHealth,
  deleteSuggestionHistoryItem as deleteSuggestionHistoryItemApi,
  estimateExpiry,
  fetchCustomUnits,
  fetchItemSuggestions,
  fetchRecipeQuery,
  finalizeRecipeChat,
  mergeGuestUser,
  refreshMemory,
  resolveGuestUser,
  saveCustomUnit,
  sendRecipeChat,
} from "../services/backend";
import { signInWithGoogle } from "../services/supabase";
import type {
  CookingLog,
  DeductionDraft,
  ItemSuggestion,
  MealType,
  PantryItem,
  QueryHistoryEntry,
  RecipeChatSession,
  RecipeInteraction,
  RecipeRecommendation,
  RecommendationFilters,
  ReminderPreferences,
  ShoppingItem,
  Unit,
  UndoEvent,
  UpgradeMergeMode,
  UserMemorySummary,
  UserSession,
} from "../types";

const DEVICE_INSTALL_ID_KEY = "device_install_id";
const DEVICE_GUEST_USER_ID_KEY = "device_guest_user_id";
const BUILT_IN_UNITS = ["piece", "cup", "tbsp", "tsp", "gram", "kilogram", "ml", "liter", "bunch"] as const;

type AppState = {
  session: UserSession;
  guestUserId?: string;
  deviceInstallId?: string;
  identityReady: boolean;
  profile: typeof defaultProfile;
  pantryItems: PantryItem[];
  shoppingItems: ShoppingItem[];
  recipes: typeof demoRecipes;
  cookingLogs: CookingLog[];
  recipeInteractions: RecipeInteraction[];
  queryHistory: QueryHistoryEntry[];
  reminderPreferences: ReminderPreferences;
  memorySummary: UserMemorySummary;
  selectedMealType: MealType;
  latestRecommendations: RecipeRecommendation[];
  lastPrompt: string;
  lastGeneratedAt?: string;
  generatingRecipes: boolean;
  deductionDrafts: DeductionDraft[];
  recipeChatSession?: RecipeChatSession;
  undoEvent?: UndoEvent;
  customUnits: string[];
  purchaseHistory: ItemSuggestion[];
  suggestionResults: ItemSuggestion[];
  backendHealth: { ok: boolean; checkedAt: string; service?: string };
  lastEstimateDebug: { source: "ai" | "heuristic" | "manual"; requestId?: string; error?: string } | null;
  completeOnboarding: (mode: "demo" | "fresh") => void;
  initializeIdentity: () => Promise<void>;
  setSelectedMealType: (mealType: MealType) => void;
  addShoppingItem: (input: {
    name: string;
    quantity: number;
    unit: Unit;
    source?: ShoppingItem["source"];
  }) => void;
  updateShoppingItem: (
    id: string,
    patch: Partial<Pick<ShoppingItem, "name" | "quantity" | "unit">>,
  ) => void;
  deleteShoppingItem: (id: string) => void;
  markShoppingBought: (id: string, options?: { purchasedDate?: string; expiryDate?: string }) => Promise<void>;
  addPantryItem: (input: {
    name: string;
    quantity: number;
    unit: Unit;
    purchasedDate?: string;
    expiryDate?: string;
  }) => Promise<void>;
  updatePantryItem: (id: string, patch: Partial<PantryItem>) => Promise<void>;
  deletePantryItem: (id: string) => void;
  addMissingIngredientsToShopping: (recipeId: string) => void;
  generateRecommendations: (filters: RecommendationFilters, prompt: string) => RecipeRecommendation[];
  generateRecipesFromPrompt: (filters: RecommendationFilters, prompt: string) => Promise<RecipeRecommendation[]>;
  createRecipeDraft: (recipeId: string, servings: number, mealType: MealType) => string | undefined;
  createDraftFromRecipeSnapshot: (input: {
    mealName: string;
    mealType: MealType;
    servings: number;
    deductions: DeductionDraft["deductions"];
    unmatchedIngredients: DeductionDraft["unmatchedIngredients"];
  }) => string;
  createManualDraft: (description: string, servings: number, mealType: MealType) => string;
  updateDeductionDraft: (draftId: string, next: DeductionDraft) => void;
  applyDeductionDraft: (draftId: string) => Promise<void>;
  undoLastPantryUpdate: () => void;
  updateReminderPreferences: (patch: Partial<ReminderPreferences>) => void;
  saveCustomUnit: (unitName: string) => Promise<void>;
  fetchSuggestions: (query: string) => Promise<ItemSuggestion[]>;
  deleteSuggestionHistoryItem: (normalizedName: string) => Promise<{ ok: boolean; blocked?: boolean; reason?: string }>;
  clearSuggestions: () => void;
  upgradeWithGoogle: (mode: UpgradeMergeMode) => Promise<{ ok: boolean; message: string }>;
  startRecipeChat: (recipeId: string) => void;
  sendRecipeChatMessage: (message: string) => Promise<void>;
  finalizeRecipeFromChat: () => Promise<string | undefined>;
  endRecipeChat: () => void;
};

const defaultFilters: RecommendationFilters = {
  availability: "prioritize-expiring",
  mealType: "dinner",
};

function localFallbackExpiry(itemName: string, purchasedDate: string) {
  const name = normalizeName(itemName);
  let days = 10;
  if (name.includes("spinach") || name.includes("leafy")) {
    days = 3;
  } else if (name.includes("tomato")) {
    days = 6;
  } else if (name.includes("onion")) {
    days = 14;
  } else if (name.includes("egg")) {
    days = 21;
  } else if (
    name.includes("lentil") ||
    name.includes("rice") ||
    name.includes("flour") ||
    name.includes("grain")
  ) {
    days = 180;
  } else if (name.includes("milk") || name.includes("yogurt")) {
    days = 7;
  }
  const purchased = new Date(purchasedDate);
  return new Date(
    purchased.getFullYear(),
    purchased.getMonth(),
    purchased.getDate() + days,
  ).toISOString();
}

function ensureCanonicalItemName(name: string, matches: ItemSuggestion[]) {
  const normalized = normalizeName(name);
  const candidate = matches.find((entry) => entry.normalizedName === normalized);
  return candidate?.name ?? name.trim();
}

function buildMemoryFromState(
  state: Pick<AppState, "recipes" | "cookingLogs" | "recipeInteractions" | "pantryItems" | "queryHistory">,
) {
  return buildMemorySummary({
    recipes: state.recipes,
    logs: state.cookingLogs.map((log) => ({
      mealDescription: log.mealDescription,
      mealType: log.mealType,
      servings: log.servings,
    })),
    interactions: state.recipeInteractions,
    pantry: state.pantryItems,
    queryHistory: state.queryHistory,
  });
}

async function getOrCreateDeviceInstallId() {
  const existing = await AsyncStorage.getItem(DEVICE_INSTALL_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = createId("install");
  await AsyncStorage.setItem(DEVICE_INSTALL_ID_KEY, generated);
  return generated;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      session: demoSession,
      guestUserId: undefined,
      deviceInstallId: undefined,
      identityReady: false,
      profile: defaultProfile,
      pantryItems: demoPantry,
      shoppingItems: starterShopping,
      recipes: demoRecipes,
      cookingLogs: demoLogs,
      recipeInteractions: [],
      queryHistory: [],
      reminderPreferences: defaultReminderPreferences,
      memorySummary: demoMemorySummary,
      selectedMealType: "dinner",
      latestRecommendations: [],
      lastPrompt: "",
      lastGeneratedAt: undefined,
      generatingRecipes: false,
      deductionDrafts: [],
      recipeChatSession: undefined,
      undoEvent: undefined,
      customUnits: [],
      purchaseHistory: demoPantry.map((item) => ({
        name: item.name,
        normalizedName: item.normalizedName,
        unit: item.unit,
      })),
      suggestionResults: [],
      backendHealth: { ok: false, checkedAt: "", service: undefined },
      lastEstimateDebug: null,
      completeOnboarding: (mode) =>
        set((state) => {
          const pantryItems = mode === "demo" ? demoPantry : freshPantry;
          const shoppingItems = mode === "demo" ? starterShopping : freshShopping;
          const cookingLogs = mode === "demo" ? demoLogs : [];

          const nextState = {
            ...state,
            pantryItems,
            shoppingItems,
            cookingLogs,
            profile: { ...state.profile, onboardingComplete: true },
          };

          return {
            ...nextState,
            memorySummary: buildMemoryFromState(nextState),
          };
        }),
      initializeIdentity: async () => {
        if (get().identityReady) {
          return;
        }

        const deviceInstallId = await getOrCreateDeviceInstallId();
        let guestUserId = await AsyncStorage.getItem(DEVICE_GUEST_USER_ID_KEY);

        if (!guestUserId) {
          try {
            const resolved = await resolveGuestUser(deviceInstallId);
            guestUserId = resolved.userId;
          } catch {
            guestUserId = createId("guest");
          }
          await AsyncStorage.setItem(DEVICE_GUEST_USER_ID_KEY, guestUserId);
        }

        const custom = await fetchCustomUnits(guestUserId).catch(() => ({ units: [] as string[] }));
        const health = await checkBackendHealth().catch(() => null);
        if (health?.ok) {
          console.log(`dev:client health-ok requestId=${health.requestId ?? "none"} base=${BACKEND_URL}`);
        } else {
          console.log(`dev:client health-fail base=${BACKEND_URL}`);
        }
        set((state) => ({
          deviceInstallId,
          guestUserId,
          session:
            state.session.mode === "guest"
              ? { ...state.session, id: guestUserId!, name: "Guest User" }
              : state.session,
          customUnits: custom.units,
          backendHealth: {
            ok: Boolean(health?.ok),
            checkedAt: todayIso(),
            service: health?.service,
          },
          identityReady: true,
        }));
      },
      setSelectedMealType: (mealType) => set({ selectedMealType: mealType }),
      addShoppingItem: (input) =>
        set((state) => {
          const canonicalName = ensureCanonicalItemName(input.name, state.purchaseHistory);
          const normalizedName = normalizeName(canonicalName);
          const matchingHistory = state.purchaseHistory.find((entry) => entry.normalizedName === normalizedName);
          const unit = input.unit || matchingHistory?.unit || "piece";

          return {
            shoppingItems: [
              {
                id: createId("shop"),
                name: canonicalName,
                normalizedName,
                quantity: input.quantity,
                unit,
                source: input.source ?? "manual",
                createdAt: todayIso(),
              },
              ...state.shoppingItems,
            ],
            purchaseHistory: [
              {
                name: canonicalName,
                normalizedName,
                unit,
              },
              ...state.purchaseHistory.filter((entry) => entry.normalizedName !== normalizedName),
            ],
          };
        }),
      deleteShoppingItem: (id) =>
        set((state) => ({
          shoppingItems: state.shoppingItems.filter((item) => item.id !== id),
        })),
      updateShoppingItem: (id, patch) =>
        set((state) => {
          const normalizedName = patch.name ? normalizeName(patch.name) : undefined;
          const nextItems = state.shoppingItems.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                  name: patch.name ? patch.name.trim() : item.name,
                  normalizedName: normalizedName ?? item.normalizedName,
                }
              : item,
          );
          const updated = nextItems.find((item) => item.id === id);
          const nextHistory =
            updated
              ? [
                  {
                    name: updated.name,
                    normalizedName: updated.normalizedName,
                    unit: updated.unit,
                  },
                  ...state.purchaseHistory.filter((entry) => entry.normalizedName !== updated.normalizedName),
                ]
              : state.purchaseHistory;

          return {
            shoppingItems: nextItems,
            purchaseHistory: nextHistory,
          };
        }),
      markShoppingBought: async (id, options) => {
        const state = get();
        const item = state.shoppingItems.find((entry) => entry.id === id);
        if (!item) {
          return;
        }
        console.log(`dev:bought-flow-start item=${item.name} id=${id}`);

        const purchasedDate = options?.purchasedDate ?? todayIso();
        const userId = state.session.id || state.guestUserId || "guest_demo";
        const approxExpiryDate = options?.expiryDate ?? localFallbackExpiry(item.name, purchasedDate);
        const shouldEstimateAsync = !options?.expiryDate;
        let targetPantryId: string | undefined;

        set((prev) => {
          const purchasedDateKey = toIsoDateOnly(purchasedDate);
          const existingIndex = prev.pantryItems.findIndex(
            (entry) =>
              entry.normalizedName === item.normalizedName &&
              entry.unit === item.unit &&
              toIsoDateOnly(entry.purchasedDate) === purchasedDateKey,
          );

          const pantryItems =
            existingIndex >= 0
              ? recalcLowStock(
                  prev.pantryItems.map((entry, index) =>
                    index === existingIndex
                      ? {
                          ...entry,
                          quantity: entry.quantity + item.quantity,
                          expiryDate: entry.expiryDate ?? approxExpiryDate,
                          approxExpiryDate: entry.approxExpiryDate ?? approxExpiryDate,
                          expiryEstimatePending: shouldEstimateAsync,
                          expiryEstimateSource: options?.expiryDate ? "manual" : "heuristic",
                          estimateRequestId: undefined,
                        }
                      : entry,
                  ),
                )
              : recalcLowStock([
                  {
                    id: createId("pantry"),
                    name: item.name,
                    normalizedName: item.normalizedName,
                    quantity: item.quantity,
                    unit: item.unit,
                    purchasedDate,
                    expiryDate: approxExpiryDate,
                    approxExpiryDate,
                    lowStockThreshold: 1,
                    isLowStock: false,
                    expiryEstimatePending: shouldEstimateAsync,
                    expiryEstimateSource: options?.expiryDate ? "manual" : "heuristic",
                  },
                  ...prev.pantryItems,
                ]);

          if (existingIndex >= 0) {
            targetPantryId = prev.pantryItems[existingIndex]?.id;
          } else {
            targetPantryId = pantryItems[0]?.id;
          }
          console.log(
            `dev:bought-${existingIndex >= 0 ? "merge" : "create"} item=${item.name} purchasedDate=${purchasedDateKey}`,
          );
          console.log(`dev:bought-local-commit item=${item.name} mode=${existingIndex >= 0 ? "merge" : "create"}`);

          const next = {
            ...prev,
            pantryItems,
            shoppingItems: prev.shoppingItems.filter((entry) => entry.id !== id),
            purchaseHistory: [
              {
                name: item.name,
                normalizedName: item.normalizedName,
                unit: item.unit,
              },
              ...prev.purchaseHistory.filter((entry) => entry.normalizedName !== item.normalizedName),
            ],
          };

          return {
            ...next,
            memorySummary: buildMemoryFromState(next),
          };
        });

        if (!shouldEstimateAsync || !targetPantryId) {
          console.log(`dev:bought-flow-end item=${item.name} mode=local-only`);
          set({ lastEstimateDebug: { source: options?.expiryDate ? "manual" : "heuristic" } });
          return;
        }

        console.log(`dev:bought-estimate-request item=${item.name} pantryId=${targetPantryId}`);
        void estimateExpiry({
          userId,
          itemName: item.name,
          unit: item.unit,
          purchasedDate,
        })
          .then((estimate) => {
            if (!estimate?.approxExpiryDate) {
              throw new Error("empty estimate result");
            }
            set((prev) => {
              const exists = prev.pantryItems.some((entry) => entry.id === targetPantryId);
              if (!exists) {
                console.log(`dev:bought-estimate-stale item=${item.name} pantryId=${targetPantryId}`);
                return prev;
              }
              return {
                pantryItems: recalcLowStock(
                  prev.pantryItems.map((entry) =>
                    entry.id === targetPantryId
                      ? {
                          ...entry,
                          expiryDate: estimate.approxExpiryDate,
                          approxExpiryDate: estimate.approxExpiryDate,
                          expiryEstimatePending: false,
                          expiryEstimateSource: "ai",
                          estimateRequestId: estimate.requestId,
                        }
                      : entry,
                  ),
                ),
              } as Partial<AppState>;
            });
            console.log(
              `dev:bought-estimate-reconciled item=${item.name} requestId=${estimate.requestId ?? "none"}`,
            );
            set({ lastEstimateDebug: { source: "ai", requestId: estimate.requestId } });
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : "estimate failed";
            set((prev) => {
              const exists = prev.pantryItems.some((entry) => entry.id === targetPantryId);
              if (!exists) {
                return prev;
              }
              return {
                pantryItems: recalcLowStock(
                  prev.pantryItems.map((entry) =>
                    entry.id === targetPantryId
                      ? {
                          ...entry,
                          expiryEstimatePending: false,
                          expiryEstimateSource: "heuristic",
                        }
                      : entry,
                  ),
                ),
              } as Partial<AppState>;
            });
            console.log(`dev:bought-estimate-fallback item=${item.name} reason=${message}`);
            set({ lastEstimateDebug: { source: "heuristic", error: message } });
          })
          .finally(() => {
            console.log(`dev:bought-flow-end item=${item.name} mode=async`);
          });
      },
      addPantryItem: async (input) => {
        const state = get();
        const purchasedDate = input.purchasedDate ?? todayIso();
        const userId = state.session.id || state.guestUserId || "guest_demo";
        const pantryId = createId("pantry");
        const shouldEstimateAsync = !input.expiryDate;
        const approxExpiryDate = input.expiryDate ?? localFallbackExpiry(input.name, purchasedDate);
        console.log(`dev:pantry-add-flow-start item=${input.name} pantryId=${pantryId}`);
        set((prev) => {
          const next = {
            ...prev,
            pantryItems: recalcLowStock([
              {
                id: pantryId,
                name: input.name,
                normalizedName: normalizeName(input.name),
                quantity: input.quantity,
                unit: input.unit,
                expiryDate: approxExpiryDate,
                approxExpiryDate,
                purchasedDate,
                lowStockThreshold: 1,
                isLowStock: false,
                expiryEstimatePending: shouldEstimateAsync,
                expiryEstimateSource: input.expiryDate ? "manual" : "heuristic",
              },
              ...prev.pantryItems,
            ]),
          };
          return {
            ...next,
            memorySummary: buildMemoryFromState(next),
          };
        });

        console.log(`dev:pantry-add-local-commit item=${input.name} pantryId=${pantryId}`);

        if (!shouldEstimateAsync) {
          console.log(`dev:pantry-add-flow-end item=${input.name} mode=local-only`);
          set({ lastEstimateDebug: { source: "manual" } });
          return;
        }

        console.log(`dev:pantry-add-estimate-request item=${input.name} pantryId=${pantryId}`);
        void estimateExpiry({
          userId,
          itemName: input.name,
          unit: input.unit,
          purchasedDate,
        })
          .then((estimate) => {
            if (!estimate?.approxExpiryDate) {
              throw new Error("empty estimate result");
            }
            set((prev) => {
              const exists = prev.pantryItems.some((entry) => entry.id === pantryId);
              if (!exists) {
                console.log(`dev:pantry-add-estimate-stale item=${input.name} pantryId=${pantryId}`);
                return prev;
              }
              return {
                pantryItems: recalcLowStock(
                  prev.pantryItems.map((entry) =>
                    entry.id === pantryId
                      ? {
                          ...entry,
                          expiryDate: estimate.approxExpiryDate,
                          approxExpiryDate: estimate.approxExpiryDate,
                          expiryEstimatePending: false,
                          expiryEstimateSource: "ai",
                          estimateRequestId: estimate.requestId,
                        }
                      : entry,
                  ),
                ),
              } as Partial<AppState>;
            });
            console.log(
              `dev:pantry-add-estimate-reconciled item=${input.name} requestId=${estimate.requestId ?? "none"}`,
            );
            set({ lastEstimateDebug: { source: "ai", requestId: estimate.requestId } });
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : "estimate failed";
            set((prev) => {
              const exists = prev.pantryItems.some((entry) => entry.id === pantryId);
              if (!exists) {
                return prev;
              }
              return {
                pantryItems: recalcLowStock(
                  prev.pantryItems.map((entry) =>
                    entry.id === pantryId
                      ? {
                          ...entry,
                          expiryEstimatePending: false,
                          expiryEstimateSource: "heuristic",
                        }
                      : entry,
                  ),
                ),
              } as Partial<AppState>;
            });
            console.log(`dev:pantry-add-estimate-fallback item=${input.name} reason=${message}`);
            set({ lastEstimateDebug: { source: "heuristic", error: message } });
          })
          .finally(() => {
            console.log(`dev:pantry-add-flow-end item=${input.name} mode=async`);
          });
      },
      updatePantryItem: async (id, patch) => {
        const state = get();
        const existing = state.pantryItems.find((item) => item.id === id);
        if (!existing) {
          return;
        }

        const nextName = patch.name ?? existing.name;
        const nextUnit = patch.unit ?? existing.unit;
        const nextPurchasedDate = patch.purchasedDate ?? existing.purchasedDate;
        const shouldRefreshEstimate =
          normalizeName(nextName) !== existing.normalizedName || nextPurchasedDate !== existing.purchasedDate;

        let estimateDate: string | undefined;
        if (shouldRefreshEstimate) {
          const userId = state.session.id || state.guestUserId || "guest_demo";
          const estimate = await estimateExpiry({
            userId,
            itemName: nextName,
            unit: nextUnit,
            purchasedDate: nextPurchasedDate,
          }).catch(() => null);
          estimateDate = estimate?.approxExpiryDate ?? localFallbackExpiry(nextName, nextPurchasedDate);
          console.log(
            `dev:client update-pantry estimate ${estimate?.approxExpiryDate ? "success" : "fallback"} item=${nextName} userId=${userId} requestId=${estimate?.requestId ?? "none"}`,
          );
          set({
            lastEstimateDebug: estimate?.approxExpiryDate
              ? { source: "ai", requestId: estimate.requestId }
              : { source: "heuristic", error: "estimate-expiry unavailable" },
          });
        }

        set((prev) => {
          const next = {
            ...prev,
            pantryItems: recalcLowStock(
              prev.pantryItems.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      ...patch,
                      normalizedName: normalizeName(nextName),
                      approxExpiryDate: shouldRefreshEstimate ? estimateDate : item.approxExpiryDate,
                      expiryDate: patch.expiryDate ?? (shouldRefreshEstimate ? estimateDate : item.expiryDate),
                    }
                  : item,
              ),
            ),
          };
          return {
            ...next,
            memorySummary: buildMemoryFromState(next),
          };
        });
      },
      deletePantryItem: (id) =>
        set((state) => {
          const next = {
            ...state,
            pantryItems: state.pantryItems.filter((item) => item.id !== id),
          };
          return {
            ...next,
            memorySummary: buildMemoryFromState(next),
          };
        }),
      addMissingIngredientsToShopping: (recipeId) =>
        set((state) => {
          const recommendation = state.latestRecommendations.find((recipe) => recipe.id === recipeId);
          if (!recommendation) {
            return state;
          }

          const additions = recommendation.missingIngredients.map((ingredient) => ({
            id: createId("shop"),
            name: ingredient.name,
            normalizedName: ingredient.normalizedName,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            source: "recipe-gap" as const,
            createdAt: todayIso(),
          }));

          return {
            shoppingItems: [...additions, ...state.shoppingItems],
          } as Partial<AppState>;
        }),
      generateRecommendations: (filters, prompt) => {
        const state = get();
        const recommendations = rankRecipes({
          pantry: state.pantryItems,
          recipes: state.recipes,
          filters,
          prompt,
          memory: state.memorySummary,
        }).slice(0, 3);

        const queryHistoryEntry = buildQueryHistoryEntry(prompt, filters);
        set({
          latestRecommendations: recommendations,
          lastPrompt: prompt,
          lastGeneratedAt: todayIso(),
          queryHistory: prompt ? [...state.queryHistory, queryHistoryEntry] : state.queryHistory,
        });
        return recommendations;
      },
      generateRecipesFromPrompt: async (filters, prompt) => {
        const state = get();
        const userId = state.session.id || state.guestUserId || "guest_demo";
        set({ generatingRecipes: true, latestRecommendations: [] });
        try {
          const result = await fetchRecipeQuery({
            userId,
            mode: prompt.trim() ? "prompt" : "default",
            pantry: state.pantryItems.map((item) => ({
              id: item.id,
              name: item.name,
              normalizedName: item.normalizedName,
              quantity: item.quantity,
              unit: item.unit,
              purchasedDate: item.purchasedDate,
              expiryDate: item.expiryDate,
            })),
            filters,
            prompt,
          });
          const mapped = (Array.isArray(result.recipes) ? (result.recipes as RecipeRecommendation[]) : []).slice(0, 3);
          if (mapped.length) {
            set({
              latestRecommendations: mapped,
              lastPrompt: prompt,
              lastGeneratedAt: todayIso(),
              generatingRecipes: false,
            });
            return mapped;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          console.log(`dev:client recipe-query fallback reason=${message}`);
        }
        const fallback = get().generateRecommendations(filters, prompt);
        set({ generatingRecipes: false });
        return fallback;
      },
      createRecipeDraft: (recipeId, servings, mealType) => {
        const state = get();
        const recipe =
          state.latestRecommendations.find((entry) => entry.id === recipeId) ??
          rankRecipes({
            pantry: state.pantryItems,
            recipes: state.recipes,
            filters: { ...defaultFilters, mealType },
            prompt: "",
            memory: state.memorySummary,
          }).find((entry) => entry.id === recipeId);

        if (!recipe) {
          return undefined;
        }

        const draft = createRecipeDraftFromRecommendation({
          recommendation: recipe,
          mealType,
          servings,
        });

        set({
          deductionDrafts: [draft, ...state.deductionDrafts],
          recipeInteractions: [
            {
              id: createId("interaction"),
              recipeId,
              action: "viewed",
              mealType,
              createdAt: todayIso(),
            },
            ...state.recipeInteractions,
          ],
        });
        return draft.id;
      },
      createDraftFromRecipeSnapshot: (input) => {
        const draft: DeductionDraft = {
          id: createId("draft"),
          sourceType: "recipe",
          mealName: input.mealName,
          mealType: input.mealType,
          servings: input.servings,
          deductions: input.deductions,
          unmatchedIngredients: input.unmatchedIngredients,
          createdAt: todayIso(),
        };
        set((prev) => ({
          deductionDrafts: [draft, ...prev.deductionDrafts],
        }));
        return draft.id;
      },
      createManualDraft: (description, servings, mealType) => {
        const state = get();
        const draft = estimateManualDraft({
          description,
          servings,
          mealType,
          pantry: state.pantryItems,
          recipes: state.recipes,
        });

        set({
          deductionDrafts: [draft, ...state.deductionDrafts],
          queryHistory: [
            ...state.queryHistory,
            {
              id: createId("query"),
              promptText: description,
              parsedFilters: { mealType },
              createdAt: todayIso(),
            },
          ],
        });

        return draft.id;
      },
      updateDeductionDraft: (draftId, next) =>
        set((state) => ({
          deductionDrafts: state.deductionDrafts.map((draft) => (draft.id === draftId ? next : draft)),
        })),
      applyDeductionDraft: async (draftId) => {
        const state = get();
        const draft = state.deductionDrafts.find((entry) => entry.id === draftId);
        if (!draft) {
          return;
        }

        const snapshot = state.pantryItems.map((item) => ({ ...item }));
        const nextPantry = recalcLowStock(
          state.pantryItems.map((item) => {
            const deduction = draft.deductions.find((entry) => entry.pantryItemId === item.id);
            if (!deduction) {
              return item;
            }

            return {
              ...item,
              quantity: Math.max(0, Number((item.quantity - deduction.quantity).toFixed(1))),
              lastUsedAt: todayIso(),
            };
          }),
        );

        const cookingLog: CookingLog = {
          id: createId("log"),
          recipeId: draft.recipeId,
          mealDescription: draft.mealName,
          mealType: draft.mealType,
          servings: draft.servings,
          deductions: draft.deductions,
          sourceType: draft.sourceType,
          confirmed: true,
          createdAt: todayIso(),
        };

        const recipeInteractions =
          draft.recipeId
            ? [
                {
                  id: createId("interaction"),
                  recipeId: draft.recipeId,
                  action: "cooked" as const,
                  mealType: draft.mealType,
                  createdAt: todayIso(),
                },
                ...state.recipeInteractions,
              ]
            : state.recipeInteractions;

        const nextState = {
          ...state,
          pantryItems: nextPantry,
          cookingLogs: [cookingLog, ...state.cookingLogs],
          deductionDrafts: state.deductionDrafts.filter((entry) => entry.id !== draftId),
          undoEvent: {
            id: createId("undo"),
            snapshot,
            createdAt: todayIso(),
            label: `Undo ${draft.mealName}`,
          },
          recipeInteractions,
          queryHistory:
            draft.recipeId && state.lastPrompt
              ? mergeAcceptedRecipeInHistory(state.queryHistory, state.lastPrompt, draft.recipeId)
              : state.queryHistory,
        };

        set({
          ...nextState,
          memorySummary: buildMemoryFromState(nextState),
        });

        if (nextState.session.id) {
          await refreshMemory({
            userId: nextState.session.id,
            payload: nextState.memorySummary,
          }).catch(() => undefined);
        }
      },
      undoLastPantryUpdate: () =>
        set((state) => {
          if (!state.undoEvent) {
            return state;
          }
          const next = {
            ...state,
            pantryItems: state.undoEvent.snapshot,
            undoEvent: undefined,
          };
          return {
            ...next,
            memorySummary: buildMemoryFromState(next),
          };
        }),
      updateReminderPreferences: (patch) =>
        set((state) => ({
          reminderPreferences: { ...state.reminderPreferences, ...patch },
        })),
      saveCustomUnit: async (unitName) => {
        const normalized = normalizeName(unitName);
        if (!normalized || BUILT_IN_UNITS.includes(normalized as (typeof BUILT_IN_UNITS)[number])) {
          return;
        }

        const state = get();
        const nextUnits = Array.from(new Set([normalized, ...state.customUnits]));
        set({ customUnits: nextUnits });
        const userId = state.session.id || state.guestUserId;
        if (!userId) {
          return;
        }
        await saveCustomUnit(userId, normalized).catch(() => undefined);
      },
      fetchSuggestions: async (query) => {
        const state = get();
        const normalized = normalizeName(query);
        if (!normalized) {
          set({ suggestionResults: [] });
          return [];
        }

        const fromShopping = state.shoppingItems.map((item) => ({
          name: item.name,
          normalizedName: item.normalizedName,
          unit: item.unit,
        }));
        const fromPantry = state.pantryItems.map((item) => ({
          name: item.name,
          normalizedName: item.normalizedName,
          unit: item.unit,
        }));
        const local = [...state.purchaseHistory, ...fromShopping, ...fromPantry]
          .map((entry) => ({
            ...entry,
            score: entry.normalizedName === normalized ? 3 : entry.normalizedName.startsWith(normalized) ? 2 : entry.normalizedName.includes(normalized) ? 1 : 0,
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((entry) => ({
            name: entry.name,
            normalizedName: entry.normalizedName,
            unit: entry.unit,
          }));

        const userId = state.session.id || state.guestUserId;
        if (!userId) {
          set({ suggestionResults: local });
          return local;
        }

        const remote = await fetchItemSuggestions({
          userId,
          q: query,
          limit: 3,
        }).catch(() => ({ suggestions: [] as ItemSuggestion[] }));

        const merged = [...local, ...remote.suggestions].filter(
          (entry, index, entries) =>
            entries.findIndex((candidate) => candidate.normalizedName === entry.normalizedName) === index,
        );
        set({ suggestionResults: merged.slice(0, 3) });
        return merged.slice(0, 3);
      },
      clearSuggestions: () => set({ suggestionResults: [] }),
      deleteSuggestionHistoryItem: async (normalizedName) => {
        const state = get();
        const hasInPantry = state.pantryItems.some(
          (item) => item.normalizedName === normalizedName && item.quantity > 0,
        );
        if (hasInPantry) {
          return { ok: false, blocked: true, reason: "Item is present in pantry and cannot be deleted." };
        }

        const userId = state.session.id || state.guestUserId;
        if (!userId) {
          return { ok: false, reason: "User not ready." };
        }

        await deleteSuggestionHistoryItemApi({ userId, normalizedName }).catch(() => undefined);
        set((prev) => ({
          purchaseHistory: prev.purchaseHistory.filter((entry) => entry.normalizedName !== normalizedName),
          suggestionResults: prev.suggestionResults.filter((entry) => entry.normalizedName !== normalizedName),
        }));
        return { ok: true };
      },
      startRecipeChat: (recipeId) => {
        const state = get();
        const recipe =
          state.latestRecommendations.find((entry) => entry.id === recipeId) ??
          state.recipes.find((entry) => entry.id === recipeId);
        if (!recipe) {
          return;
        }
        set({
          recipeChatSession: {
            id: createId("chat"),
            recipeId: recipe.id,
            recipeSnapshot: {
              title: recipe.title,
              cuisine: recipe.cuisine,
              cookingTimeMinutes: recipe.cookingTimeMinutes,
              equipment: recipe.equipment,
              servings: recipe.servings,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
            },
            messages: [],
            loading: false,
          },
        });
      },
      sendRecipeChatMessage: async (message) => {
        const state = get();
        const session = state.recipeChatSession;
        if (!session || !message.trim()) {
          return;
        }
        const userId = state.session.id || state.guestUserId || "guest_demo";
        const userMessage = { role: "user" as const, text: message.trim(), createdAt: todayIso() };
        set({
          recipeChatSession: {
            ...session,
            messages: [...session.messages, userMessage],
            loading: true,
          },
        });
        try {
          const result = await sendRecipeChat({
            userId,
            pantry: state.pantryItems.map((item) => ({
              id: item.id,
              name: item.name,
              normalizedName: item.normalizedName,
              quantity: item.quantity,
              unit: item.unit,
            })),
            recipeSnapshot: session.recipeSnapshot,
            chatHistory: [...session.messages, userMessage].map((entry) => ({ role: entry.role, text: entry.text })),
            message: userMessage.text,
          });
          set((prev) => {
            const current = prev.recipeChatSession;
            if (!current || current.id !== session.id) {
              return prev;
            }
            return {
              recipeChatSession: {
                ...current,
                recipeSnapshot: result.recipeSnapshot,
                messages: [...current.messages, { role: "assistant", text: result.assistantMessage, createdAt: todayIso() }],
                loading: false,
              },
            } as Partial<AppState>;
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Recipe chat failed";
          set((prev) => {
            const current = prev.recipeChatSession;
            if (!current || current.id !== session.id) {
              return prev;
            }
            return {
              recipeChatSession: {
                ...current,
                messages: [...current.messages, { role: "assistant", text: `Error: ${msg}`, createdAt: todayIso() }],
                loading: false,
              },
            } as Partial<AppState>;
          });
        }
      },
      finalizeRecipeFromChat: async () => {
        const state = get();
        const session = state.recipeChatSession;
        if (!session) {
          return undefined;
        }
        const userId = state.session.id || state.guestUserId || "guest_demo";
        try {
          const result = await finalizeRecipeChat({
            userId,
            pantry: state.pantryItems.map((item) => ({
              id: item.id,
              name: item.name,
              normalizedName: item.normalizedName,
              quantity: item.quantity,
              unit: item.unit,
            })),
            recipeSnapshot: session.recipeSnapshot,
            chatHistory: session.messages.map((entry) => ({ role: entry.role, text: entry.text })),
          });
          return get().createDraftFromRecipeSnapshot({
            mealName: result.finalRecipeSnapshot.title,
            mealType: state.selectedMealType,
            servings: result.finalRecipeSnapshot.servings,
            deductions: result.deductions.map((entry) => ({
              pantryItemId: entry.pantryItemId,
              pantryItemName: entry.itemName,
              quantity: entry.quantity,
              unit: entry.unit,
              confidence: entry.confidence,
              reason: entry.reason,
            })),
            unmatchedIngredients: result.unmatched_ingredients,
          });
        } catch {
          return get().createDraftFromRecipeSnapshot({
            mealName: session.recipeSnapshot.title,
            mealType: state.selectedMealType,
            servings: session.recipeSnapshot.servings,
            deductions: session.recipeSnapshot.ingredients.map((ingredient) => {
              const pantryItem = state.pantryItems.find((item) => item.normalizedName === ingredient.normalizedName);
              return {
                pantryItemId: pantryItem?.id,
                pantryItemName: ingredient.name,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                confidence: pantryItem ? 0.7 : 0.45,
                reason: "Estimated from recipe chat snapshot.",
              };
            }),
            unmatchedIngredients: session.recipeSnapshot.ingredients
              .filter((ingredient) => !state.pantryItems.some((item) => item.normalizedName === ingredient.normalizedName))
              .map((ingredient) => ({ name: ingredient.name, reason: "Not found in pantry." })),
          });
        }
      },
      endRecipeChat: () => set({ recipeChatSession: undefined }),
      upgradeWithGoogle: async (mode) => {
        const state = get();
        if (state.session.mode === "authenticated") {
          return { ok: true, message: "Already authenticated." };
        }

        try {
          const session = await signInWithGoogle();
          const authenticatedUserId = session.user.id;
          const guestUserId = state.guestUserId ?? state.session.id;

          if (guestUserId) {
            await mergeGuestUser({
              guestUserId,
              authenticatedUserId,
              mode,
            }).catch(() => undefined);
          }

          const shouldReset = mode === "fresh";
          set((prev) => ({
            session: {
              id: authenticatedUserId,
              name: session.user.user_metadata.full_name ?? session.user.email ?? "Google User",
              email: session.user.email ?? undefined,
              mode: "authenticated",
            },
            pantryItems: shouldReset ? [] : prev.pantryItems,
            shoppingItems: shouldReset ? [] : prev.shoppingItems,
            cookingLogs: shouldReset ? [] : prev.cookingLogs,
            recipeInteractions: shouldReset ? [] : prev.recipeInteractions,
            queryHistory: shouldReset ? [] : prev.queryHistory,
            deductionDrafts: shouldReset ? [] : prev.deductionDrafts,
            undoEvent: undefined,
          }));

          return { ok: true, message: mode === "merge" ? "Account upgraded and guest data merged." : "Account upgraded with fresh data." };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Google sign-in failed.";
          return { ok: false, message };
        }
      },
    }),
    {
      name: "pantrypal-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        session: state.session,
        guestUserId: state.guestUserId,
        deviceInstallId: state.deviceInstallId,
        profile: state.profile,
        pantryItems: state.pantryItems,
        shoppingItems: state.shoppingItems,
        cookingLogs: state.cookingLogs,
        recipeInteractions: state.recipeInteractions,
        queryHistory: state.queryHistory,
        reminderPreferences: state.reminderPreferences,
        memorySummary: state.memorySummary,
        selectedMealType: state.selectedMealType,
        latestRecommendations: state.latestRecommendations,
        lastPrompt: state.lastPrompt,
        deductionDrafts: state.deductionDrafts,
        undoEvent: state.undoEvent,
        customUnits: state.customUnits,
        purchaseHistory: state.purchaseHistory,
        backendHealth: state.backendHealth,
        lastEstimateDebug: state.lastEstimateDebug,
      }),
    },
  ),
);
