import { Platform } from "react-native";
import type { ItemSuggestion, UserMemorySummary } from "../types";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000");

async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
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
