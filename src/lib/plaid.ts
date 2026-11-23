import "server-only";

const HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

/** Minimal Plaid REST client (keys never leave the server). */
export async function plaid<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  const host = HOSTS[process.env.PLAID_ENV ?? "sandbox"] ?? HOSTS.sandbox;
  const res = await fetch(host + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Plaid ${path}: ${json.error_code ?? res.status} ${json.error_message ?? ""}`.trim());
  }
  return json as T;
}

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string; // depository | credit | loan | investment
  subtype?: string | null;
}

export interface PlaidTxn {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name?: string | null;
  amount: number;
  pending: boolean;
  pending_transaction_id?: string | null;
  personal_finance_category?: { primary: string; detailed: string } | null;
}

export interface SyncResponse {
  added: PlaidTxn[];
  modified: PlaidTxn[];
  removed: { transaction_id: string }[];
  accounts: PlaidAccount[];
  next_cursor: string;
  has_more: boolean;
}
