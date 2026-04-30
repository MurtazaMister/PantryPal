import type { PantryItem, Unit } from "./types";

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function todayIso() {
  return new Date().toISOString();
}

export function daysUntil(date?: string) {
  if (!date) {
    return null;
  }

  const now = new Date();
  const expiry = new Date(date);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function toIsoDateOnly(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnlyToIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  // Use noon UTC to avoid date-shift artifacts when converting back to local date-only text.
  const next = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0));
  return next.toISOString();
}

export function dateOnlyToLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

export function isExpiringSoon(item: PantryItem) {
  const remaining = daysUntil(item.expiryDate);
  return remaining !== null && remaining <= 3;
}

export function isLowStock(quantity: number, threshold: number) {
  return quantity <= threshold;
}

export function formatUnit(unit: Unit, quantity: number) {
  if (quantity === 1) {
    return unit;
  }

  if (unit === "piece") {
    return "pieces";
  }

  return unit;
}

export function quantityLabel(quantity: number, unit: Unit) {
  return `${trimNumber(quantity)} ${formatUnit(unit, quantity)}`;
}

export function trimNumber(value: number) {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(1).replace(/\.0$/, "");
}
