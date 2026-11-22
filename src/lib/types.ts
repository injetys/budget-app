export type AccountType = "checking" | "savings" | "credit";

export interface Account {
  id: string;
  name: string; // "Chase Sapphire"
  institution: string;
  mask: string; // last 4 digits
  type: AccountType;
}

/**
 * Sign convention (same as Plaid): positive amount = money LEAVING the account
 * (a purchase, or a payment out of checking). Negative = money coming IN
 * (paycheck, refund, a payment received by a credit card).
 */
export interface Transaction {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number;
  pending: boolean;
  pendingTransactionId?: string | null; // set on a posted txn that replaced a pending one
  plaidCategory?: string; // Plaid personal_finance_category.primary, e.g. FOOD_AND_DRINK
  plaidDetailed?: string; // e.g. LOAN_PAYMENTS_CREDIT_CARD_PAYMENT
  categoryId: string; // our category
  categorySource: "plaid" | "rule" | "user";
  reviewed: boolean;
  kind: "spend" | "income" | "transfer";
  transferPairId?: string | null;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: TagColor;
}

export type TagColor =
  | "gray" | "brown" | "orange" | "yellow" | "green"
  | "blue" | "purple" | "pink" | "red";

/** Learned from swipes: "merchant contains X" -> category */
export interface Rule {
  id: string;
  match: string; // normalized merchant key
  categoryId: string;
}
