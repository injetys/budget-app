// Map between database rows (snake_case) and app types (camelCase).
import type { Account, Rule, Transaction } from "./types";

export interface TxnRow {
  id: string;
  user_id?: string;
  account_id: string;
  plaid_transaction_id?: string | null;
  pending_transaction_id?: string | null;
  date: string;
  merchant: string;
  amount: number | string;
  pending: boolean;
  plaid_category?: string | null;
  plaid_detailed?: string | null;
  category_id: string;
  category_source: Transaction["categorySource"];
  kind: Transaction["kind"];
  transfer_pair_id?: string | null;
  reviewed: boolean;
}

export const fromTxnRow = (r: TxnRow): Transaction => ({
  id: r.id,
  accountId: r.account_id,
  date: r.date,
  merchant: r.merchant,
  amount: Number(r.amount),
  pending: r.pending,
  pendingTransactionId: r.pending_transaction_id,
  plaidCategory: r.plaid_category ?? undefined,
  plaidDetailed: r.plaid_detailed ?? undefined,
  categoryId: r.category_id,
  categorySource: r.category_source,
  kind: r.kind,
  transferPairId: r.transfer_pair_id,
  reviewed: r.reviewed,
});

/** Only the fields the app is allowed to change from the browser. */
export const editableTxnFields = (t: Transaction) => ({
  category_id: t.categoryId,
  category_source: t.categorySource,
  kind: t.kind,
  reviewed: t.reviewed,
  transfer_pair_id: t.transferPairId ?? null,
});

export interface AccountRow { id: string; name: string; institution: string | null; mask: string | null; type: Account["type"] }
export const fromAccountRow = (r: AccountRow): Account => ({
  id: r.id, name: r.name, institution: r.institution ?? "", mask: r.mask ?? "", type: r.type,
});

export interface RuleRow { id: string; match: string; category_id: string }
export const fromRuleRow = (r: RuleRow): Rule => ({ id: r.id, match: r.match, categoryId: r.category_id });

export const kindFor = (categoryId: string): Transaction["kind"] =>
  categoryId === "income" ? "income" : categoryId === "transfer" ? "transfer" : "spend";
