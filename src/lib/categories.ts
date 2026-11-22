import type { Category } from "./types";

export const CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", emoji: "🥦", color: "green" },
  { id: "dining", name: "Dining", emoji: "🍜", color: "orange" },
  { id: "coffee", name: "Coffee", emoji: "☕", color: "brown" },
  { id: "transport", name: "Transport", emoji: "🚗", color: "blue" },
  { id: "shopping", name: "Shopping", emoji: "🛍️", color: "pink" },
  { id: "bills", name: "Bills & Utilities", emoji: "💡", color: "yellow" },
  { id: "rent", name: "Rent", emoji: "🏠", color: "purple" },
  { id: "entertainment", name: "Entertainment", emoji: "🎬", color: "red" },
  { id: "travel", name: "Travel", emoji: "✈️", color: "blue" },
  { id: "health", name: "Health", emoji: "🩺", color: "green" },
  { id: "subscriptions", name: "Subscriptions", emoji: "🔁", color: "purple" },
  { id: "income", name: "Income", emoji: "💰", color: "green" },
  { id: "transfer", name: "Transfer", emoji: "↔️", color: "gray" },
  { id: "other", name: "Other", emoji: "📦", color: "gray" },
];

export const categoryById = (id: string): Category =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** Plaid personal_finance_category (primary / detailed) -> our category */
const PLAID_DETAILED: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: "groceries",
  FOOD_AND_DRINK_COFFEE: "coffee",
  FOOD_AND_DRINK_RESTAURANT: "dining",
  FOOD_AND_DRINK_FAST_FOOD: "dining",
  RENT_AND_UTILITIES_RENT: "rent",
  GENERAL_SERVICES_INSURANCE: "bills",
  ENTERTAINMENT_TV_AND_MOVIES: "subscriptions",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "subscriptions",
};

const PLAID_PRIMARY: Record<string, string> = {
  FOOD_AND_DRINK: "dining",
  TRANSPORTATION: "transport",
  GENERAL_MERCHANDISE: "shopping",
  RENT_AND_UTILITIES: "bills",
  ENTERTAINMENT: "entertainment",
  TRAVEL: "travel",
  MEDICAL: "health",
  PERSONAL_CARE: "health",
  INCOME: "income",
  TRANSFER_IN: "transfer",
  TRANSFER_OUT: "transfer",
  LOAN_PAYMENTS: "bills",
};

export function mapPlaidCategory(primary?: string, detailed?: string): string {
  if (detailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return "transfer";
  if (detailed && PLAID_DETAILED[detailed]) return PLAID_DETAILED[detailed];
  if (primary && PLAID_PRIMARY[primary]) return PLAID_PRIMARY[primary];
  return "other";
}
