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
  deleteSuggestionHistoryItem as deleteSuggestionHistoryItemApi,
  estimateExpiry,
  fetchCustomUnits,
  fetchItemSuggestions,
  mergeGuestUser,
  refreshMemory,
  resolveGuestUser,
  saveCustomUnit,
} from "../services/backend";
import { signInWithGoogle } from "../services/supabase";
import type {
  CookingLog,
  DeductionDraft,
  ItemSuggestion,
  MealType,
  PantryItem,
  QueryHistoryEntry,
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
  deductionDrafts: DeductionDraft[];
  undoEvent?: UndoEvent;
  customUnits: string[];
  purchaseHistory: ItemSuggestion[];
  suggestionResults: ItemSuggestion[];
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
  createRecipeDraft: (recipeId: string, servings: number, mealType: MealType) => string | undefined;
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
};

const defaultFilters: RecommendationFilters = {
  availability: "prioritize-expiring",
  mealType: "dinner",
};

function localFallbackExpiry(purchasedDate: string) {
  const purchased = new Date(purchasedDate);
  return new Date(
    purchased.getFullYear(),
    purchased.getMonth(),
    purchased.getDate() + 10,
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
      deductionDrafts: [],
      undoEvent: undefined,
      customUnits: [],
      purchaseHistory: demoPantry.map((item) => ({
        name: item.name,
        normalizedName: item.normalizedName,
        unit: item.unit,
      })),
      suggestionResults: [],
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
        set((state) => ({
          deviceInstallId,
          guestUserId,
          session:
            state.session.mode === "guest"
              ? { ...state.session, id: guestUserId!, name: "Guest User" }
              : state.session,
          customUnits: custom.units,
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
        console.log(`dev:bought-start item=${item.name} id=${id}`);

        const purchasedDate = options?.purchasedDate ?? todayIso();
        const userId = state.session.id || state.guestUserId || "guest_demo";
        let approxExpiryDate = options?.expiryDate;

        if (!approxExpiryDate) {
          const estimate = await estimateExpiry({
            userId,
            itemName: item.name,
            unit: item.unit,
            purchasedDate,
          }).catch(() => null);
          if (estimate?.approxExpiryDate) {
            approxExpiryDate = estimate.approxExpiryDate;
            console.log(`dev:bought-estimate-success item=${item.name} userId=${userId}`);
          } else {
            approxExpiryDate = localFallbackExpiry(purchasedDate);
            console.log(`dev:bought-estimate-fallback item=${item.name} userId=${userId}`);
          }
        }

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
                          expiryDate: approxExpiryDate ?? entry.expiryDate,
                          approxExpiryDate: approxExpiryDate ?? entry.approxExpiryDate,
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
                  },
                  ...prev.pantryItems,
                ]);
          console.log(
            `dev:bought-${existingIndex >= 0 ? "merge" : "create"} item=${item.name} purchasedDate=${purchasedDateKey}`,
          );

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
      },
      addPantryItem: async (input) => {
        const state = get();
        const purchasedDate = input.purchasedDate ?? todayIso();
        const userId = state.session.id || state.guestUserId || "guest_demo";
        const estimate = await estimateExpiry({
          userId,
          itemName: input.name,
          unit: input.unit,
          purchasedDate,
        }).catch(() => null);

        const approxExpiryDate = input.expiryDate ?? estimate?.approxExpiryDate ?? localFallbackExpiry(purchasedDate);
        set((prev) => {
          const next = {
            ...prev,
            pantryItems: recalcLowStock([
              {
                id: createId("pantry"),
                name: input.name,
                normalizedName: normalizeName(input.name),
                quantity: input.quantity,
                unit: input.unit,
                expiryDate: approxExpiryDate,
                approxExpiryDate,
                purchasedDate,
                lowStockThreshold: 1,
                isLowStock: false,
              },
              ...prev.pantryItems,
            ]),
          };
          return {
            ...next,
            memorySummary: buildMemoryFromState(next),
          };
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
          estimateDate = estimate?.approxExpiryDate ?? localFallbackExpiry(nextPurchasedDate);
          console.log(
            `dev:client update-pantry estimate ${estimate?.approxExpiryDate ? "success" : "fallback"} item=${nextName} userId=${userId}`,
          );
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
          queryHistory: prompt ? [...state.queryHistory, queryHistoryEntry] : state.queryHistory,
        });
        return recommendations;
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
      }),
    },
  ),
);
