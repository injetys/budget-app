import type { Account, Rule, Transaction } from "./types";
import { mapPlaidCategory } from "./categories";

/* ---------------- Categorization ---------------- */

/** "SQ *BLUE BOTTLE #123 OAKLAND" -> "blue bottle" */
export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/^(sq \*|tst\*|sp \*|paypal \*|pp\*)/, "")
    .replace(/#?\d{2,}/g, "")
    .replace(/[^a-z& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

/** Layer 1: your learned rules. Layer 2: Plaid's category. */
export function categorize(
  txn: Pick<Transaction, "merchant" | "plaidCategory" | "plaidDetailed">,
  rules: Rule[],
): { categoryId: string; source: Transaction["categorySource"] } {
  const key = merchantKey(txn.merchant);
  const rule = rules.find((r) => key.includes(r.match) || r.match.includes(key));
  if (rule) return { categoryId: rule.categoryId, source: "rule" };
  return { categoryId: mapPlaidCategory(txn.plaidCategory, txn.plaidDetailed), source: "plaid" };
}

/* ---------------- No double counting ---------------- */

/** Drop pending txns that have since posted (posted one carries pendingTransactionId). */
export function dropSupersededPending(txns: Transaction[]): Transaction[] {
  const replaced = new Set(txns.map((t) => t.pendingTransactionId).filter(Boolean));
  return txns.filter((t) => !(t.pending && replaced.has(t.id)));
}

const daysApart = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

/**
 * Find money moving between YOUR OWN accounts (e.g. checking -> credit card payment)
 * and mark both sides as `transfer` so they never count as spending or income.
 * The actual card purchases stay as spending — that's the real spend.
 */
export function detectTransfers(txns: Transaction[], accounts: Account[]): Transaction[] {
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const out = txns.map((t) => ({ ...t }));
  const used = new Set<string>();

  for (const outflow of out) {
    if (outflow.amount <= 0 || used.has(outflow.id)) continue;
    const match = out.find(
      (inflow) =>
        !used.has(inflow.id) &&
        inflow.id !== outflow.id &&
        inflow.accountId !== outflow.accountId &&
        Math.abs(inflow.amount + outflow.amount) < 0.01 &&
        daysApart(inflow.date, outflow.date) <= 5,
    );
    if (match) {
      for (const t of [outflow, match]) {
        t.kind = "transfer";
        t.categoryId = "transfer";
        t.transferPairId = outflow.id + ":" + match.id;
        used.add(t.id);
      }
    }
  }

  // Unmatched, but Plaid says it's a card payment / transfer, or it's a payment
  // received by a credit card -> still a transfer.
  for (const t of out) {
    if (t.kind === "transfer") continue;
    const isCardPayment = t.plaidDetailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT";
    const isTransfer = t.plaidCategory === "TRANSFER_IN" || t.plaidCategory === "TRANSFER_OUT";
    const cardCredit = acct.get(t.accountId)?.type === "credit" && t.amount < 0 && /payment|autopay|thank you/i.test(t.merchant);
    if (isCardPayment || isTransfer || cardCredit) {
      t.kind = "transfer";
      t.categoryId = "transfer";
    }
  }
  return out;
}

/* ---------------- Totals ---------------- */

/** Spending: purchases minus refunds, excluding transfers and income. */
export function spendOf(txns: Transaction[]): number {
  return txns
    .filter((t) => t.kind === "spend")
    .reduce((s, t) => s + t.amount, 0);
}

export function incomeOf(txns: Transaction[]): number {
  return txns.filter((t) => t.kind === "income").reduce((s, t) => s - t.amount, 0);
}

export function byCategory(txns: Transaction[]): { categoryId: string; total: number }[] {
  const m = new Map<string, number>();
  for (const t of txns) if (t.kind === "spend") m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
  return [...m.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .filter((c) => c.total > 0.005)
    .sort((a, b) => b.total - a.total);
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const money2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
