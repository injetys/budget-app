import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plaid, type PlaidAccount, type PlaidTxn, type SyncResponse } from "./plaid";
import { categorize, detectTransfers } from "./engine";
import { fromAccountRow, fromRuleRow, fromTxnRow, kindFor, type TxnRow } from "./rows";
import type { Account } from "./types";

const accountType = (a: PlaidAccount): Account["type"] =>
  a.type === "credit" ? "credit" : a.subtype === "savings" ? "savings" : "checking";

/** Pull everything new for one bank login and store it. */
export async function syncItem(db: SupabaseClient, userId: string, itemId: string) {
  const { data: item } = await db.from("plaid_items").select("*").eq("id", itemId).eq("user_id", userId).single();
  const { data: secret } = await db.from("plaid_secrets").select("access_token").eq("item_id", itemId).single();
  if (!item || !secret) throw new Error("Bank connection not found");

  // 1. Page through Plaid's changes since our last cursor.
  let cursor: string | undefined = item.sync_cursor ?? undefined;
  const added: PlaidTxn[] = [], modified: PlaidTxn[] = [], removed: string[] = [];
  let accounts: PlaidAccount[] = [];
  for (let page = 0; page < 50; page++) {
    const r: SyncResponse = await plaid<SyncResponse>("/transactions/sync", {
      access_token: secret.access_token,
      cursor,
      count: 500,
      options: { include_personal_finance_category: true, days_requested: 730 },
    });
    added.push(...r.added); modified.push(...r.modified); removed.push(...r.removed.map((x) => x.transaction_id));
    accounts = r.accounts.length ? r.accounts : accounts;
    cursor = r.next_cursor;
    if (!r.has_more) break;
  }

  // 2. Accounts (only bank + credit; skip loans/investments for now).
  const wanted = accounts.filter((a) => a.type === "depository" || a.type === "credit");
  if (wanted.length) {
    await db.from("accounts").upsert(
      wanted.map((a) => ({
        user_id: userId, item_id: itemId, plaid_account_id: a.account_id,
        name: a.name, institution: item.institution, mask: a.mask ?? null, type: accountType(a),
      })),
      { onConflict: "plaid_account_id" },
    );
  }
  const { data: acctRows } = await db.from("accounts").select("id, plaid_account_id").eq("user_id", userId);
  const acctId = new Map((acctRows ?? []).map((a) => [a.plaid_account_id, a.id]));

  // 3. Existing rows we might need to preserve your choices from.
  const touchIds = [...added, ...modified].flatMap((t) => [t.transaction_id, t.pending_transaction_id].filter(Boolean) as string[]);
  const existing = new Map<string, TxnRow>();
  for (let i = 0; i < touchIds.length; i += 300) {
    const { data } = await db.from("transactions").select("*").eq("user_id", userId).in("plaid_transaction_id", touchIds.slice(i, i + 300));
    (data as TxnRow[] | null)?.forEach((r) => existing.set(r.plaid_transaction_id!, r));
  }
  const { data: ruleRows } = await db.from("rules").select("id, match, category_id").eq("user_id", userId);
  const rules = (ruleRows ?? []).map(fromRuleRow);

  const rows = [...added, ...modified]
    .filter((t) => acctId.has(t.account_id))
    .map((t) => {
      const merchant = t.merchant_name || t.name;
      const pfc = t.personal_finance_category;
      const auto = categorize({ merchant, plaidCategory: pfc?.primary, plaidDetailed: pfc?.detailed }, rules);
      // Keep what you already decided (same txn, or the pending version it replaced).
      const prev = existing.get(t.transaction_id) ?? (t.pending_transaction_id ? existing.get(t.pending_transaction_id) : undefined);
      const keepUser = prev?.category_source === "user";
      const categoryId = keepUser ? prev!.category_id : auto.categoryId;
      return {
        user_id: userId,
        account_id: acctId.get(t.account_id)!,
        plaid_transaction_id: t.transaction_id,
        pending_transaction_id: t.pending_transaction_id ?? null,
        date: t.date,
        merchant,
        amount: t.amount,
        pending: t.pending,
        plaid_category: pfc?.primary ?? null,
        plaid_detailed: pfc?.detailed ?? null,
        category_id: categoryId,
        category_source: keepUser ? "user" : auto.source,
        kind: kindFor(categoryId),
        reviewed: prev?.reviewed ?? false,
      };
    });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("transactions").upsert(rows.slice(i, i + 500), { onConflict: "plaid_transaction_id" });
    if (error) throw error;
  }
  if (removed.length) {
    await db.from("transactions").delete().eq("user_id", userId).in("plaid_transaction_id", removed);
  }

  await db.from("plaid_items").update({ sync_cursor: cursor }).eq("id", itemId);
  await relinkTransfers(db, userId);
  return { added: added.length, modified: modified.length, removed: removed.length };
}

/** Re-run card-payment / transfer matching over the last ~4 months. */
export async function relinkTransfers(db: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: t }, { data: a }] = await Promise.all([
    db.from("transactions").select("*").eq("user_id", userId).gte("date", since),
    db.from("accounts").select("id, name, institution, mask, type").eq("user_id", userId),
  ]);
  const txns = ((t ?? []) as TxnRow[]).map(fromTxnRow);
  const linked = detectTransfers(txns, (a ?? []).map(fromAccountRow));
  const changed = linked.filter((n, i) => {
    const o = txns[i];
    return o.categorySource !== "user" && (n.kind !== o.kind || n.transferPairId !== o.transferPairId);
  });
  for (const c of changed) {
    await db.from("transactions")
      .update({ kind: c.kind, category_id: c.categoryId, transfer_pair_id: c.transferPairId ?? null, reviewed: c.kind === "transfer" ? true : c.reviewed })
      .eq("id", c.id).eq("user_id", userId);
  }
}
