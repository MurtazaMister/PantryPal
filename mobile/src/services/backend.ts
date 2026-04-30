import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import type { ItemSuggestion, RecipeChatMessage, RecipeSnapshot, UserMemorySummary } from "../types";

type RequestMeta = {
  requestId?: string;
};

function inferPhysicalDevice() {
  const deviceName = Constants.deviceName ?? "";
  const isDevice = Constants.isDevice;
  return Boolean(isDevice && deviceName);
}

function isLocalhostUrl(url: string) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function resolveBackendUrl() {
  const local =
    process.env.EXPO_PUBLIC_BACKEND_URL ??
    (Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000");
  const tunnel = process.env.EXPO_PUBLIC_BACKEND_URL_TUNNEL;
  const isPhysicalDevice = inferPhysicalDevice();
  const base = tunnel && tunnel.trim().length > 0 ? tunnel : local;

  if (__DEV__ && isPhysicalDevice && isLocalhostUrl(base)) {
    console.log(`dev:client-backend-misconfig baseUrl=${base}`);
    Alert.alert(
      "Backend URL mismatch",
      "Physical device is using localhost backend URL. Set EXPO_PUBLIC_BACKEND_URL_TUNNEL and restart Expo.",
    );
  }

  return base.replace(/\/$/, "");
}

export const BACKEND_URL = resolveBackendUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T & RequestMeta> {
  const startedAt = Date.now();
  console.log(`dev:client fetch-start method=${options?.method ?? "GET"} path=${path} base=${BACKEND_URL}`);
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      ...options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown fetch error";
    console.log(`dev:client fetch-fail path=${path} error=${message}`);
    throw error;
  }

  const requestId = response.headers.get("x-request-id") ?? undefined;
  console.log(
    `dev:client fetch-${response.ok ? "ok" : "fail"} method=${options?.method ?? "GET"} path=${path} status=${response.status} requestId=${requestId ?? "none"} durationMs=${Date.now() - startedAt}`,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  const payload = (await response.json()) as T;
  return { ...payload, requestId } as T & RequestMeta;
}

export async function checkBackendHealth() {
  return request<{ ok: boolean; service: string }>("/health");
}

export async function resolveGuestUser(deviceInstallId: string) {
  return request<{ userId: string; isNew: boolean }>("/auth/guest", {
    method: "POST",
    body: JSON.stringify({ deviceInstallId }),
  });
}

export async function mergeGuestUser(params: {
  guestUserId: string;
  authenticatedUserId: string;
  mode: "merge" | "fresh";
}) {
  return request<{ status: "merged" | "fresh" }>("/auth/merge-guest", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchItemSuggestions(params: { userId: string; q: string; limit?: number }) {
  const search = new URLSearchParams({
    userId: params.userId,
    q: params.q,
    limit: String(params.limit ?? 3),
  });
  return request<{ suggestions: ItemSuggestion[] }>(`/items/suggestions?${search.toString()}`);
}

export async function deleteSuggestionHistoryItem(params: { userId: string; normalizedName: string }) {
  return request<{ ok: boolean; removed: number }>("/items/suggestions", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

export async function saveCustomUnit(userId: string, unitName: string) {
  return request<{ allUnits: string[] }>("/units/custom", {
    method: "POST",
    body: JSON.stringify({ userId, unitName }),
  });
}

export async function fetchCustomUnits(userId: string) {
  const search = new URLSearchParams({ userId });
  return request<{ units: string[] }>(`/units/custom?${search.toString()}`);
}

export async function refreshMemory(params: { userId: string; payload: UserMemorySummary }) {
  return request<{ ok: boolean }>("/memory/refresh", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function estimateExpiry(params: {
  userId: string;
  itemName: string;
  unit: string;
  purchasedDate: string;
}) {
  return request<{ approxExpiryDate: string; confidence: number; reason?: string }>("/ai/estimate-expiry", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchRecipeQuery(params: {
  userId: string;
  mode?: "default" | "prompt";
  pantry: Array<{ id: string; name: string; normalizedName: string; quantity: number; unit: string; purchasedDate?: string; expiryDate?: string }>;
  filters: {
    maxMinutes?: 15 | 30 | 60;
    cuisine?: string;
    equipment?: "stove" | "oven" | "microwave" | "grill" | "none";
    availability: "cookable-now" | "missing-a-few" | "prioritize-expiring";
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
  };
  prompt: string;
}) {
  return request<{ recipes: unknown[]; aiSummary?: string | null }>("/ai/recipe-query", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function sendRecipeChat(params: {
  userId: string;
  pantry: Array<{ id: string; name: string; normalizedName: string; quantity: number; unit: string }>;
  recipeSnapshot: RecipeSnapshot;
  chatHistory: Array<{ role: "user" | "assistant"; text: string }>;
  message: string;
}) {
  return request<{ assistantMessage: string; recipeSnapshot: RecipeSnapshot }>("/ai/recipe-chat", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function finalizeRecipeChat(params: {
  userId: string;
  pantry: Array<{ id: string; name: string; normalizedName: string; quantity: number; unit: string }>;
  recipeSnapshot: RecipeSnapshot;
  chatHistory: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  return request<{
    finalRecipeSnapshot: RecipeSnapshot;
    deductions: Array<{
      pantryItemId?: string;
      itemName: string;
      quantity: number;
      unit: string;
      confidence: number;
      reason: string;
    }>;
    unmatched_ingredients: Array<{ name: string; reason: string }>;
  }>("/ai/recipe-finalize", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
