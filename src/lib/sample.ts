// Demo data so the UI works before Plaid is hooked up. Replaced by real sync later.
import type { Account, Rule, Transaction } from "./types";
import { categorize, detectTransfers, dropSupersededPending } from "./engine";

export const SAMPLE_ACCOUNTS: Account[] = [
  { id: "chk", name: "Everyday Checking", institution: "Chase", mask: "4021", type: "checking" },
  { id: "cc1", name: "Sapphire Preferred", institution: "Chase", mask: "8812", type: "credit" },
  { id: "cc2", name: "Gold Card", institution: "Amex", mask: "1005", type: "credit" },
];

type Raw = [merchant: string, amount: number, plaidPrimary: string, plaidDetailed: string, acct: string];

const MERCHANTS: Raw[] = [
  ["Trader Joe's #552", 64.2, "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES", "cc2"],
  ["Whole Foods Market", 88.4, "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES", "cc2"],
  ["SQ *BLUE BOTTLE COFFEE", 6.75, "FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE", "cc1"],
  ["Tartine Bakery", 23.5, "FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT", "cc1"],
  ["DoorDash *Burma Love", 41.18, "FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT", "cc1"],
  ["Uber Trip", 18.9, "TRANSPORTATION", "TRANSPORTATION_TAXIS_AND_RIDE_SHARES", "cc1"],
  ["Shell Oil 5741", 52.0, "TRANSPORTATION", "TRANSPORTATION_GAS", "cc1"],
  ["Amazon.com", 37.99, "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", "cc1"],
  ["Target T-1234", 46.3, "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_SUPERSTORES", "cc2"],
  ["AMC Theatres", 32.0, "ENTERTAINMENT", "ENTERTAINMENT_TV_AND_MOVIES", "cc1"],
  ["Walgreens #3302", 14.6, "MEDICAL", "MEDICAL_PHARMACIES_AND_SUPPLEMENTS", "cc2"],
  ["Equinox", 45.0, "PERSONAL_CARE", "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS", "cc1"],
];

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
const pad = (n: number) => String(n).padStart(2, "0");

export function buildSample(year = 2026, throughMonth = 10): Transaction[] {
  const r = rng(42);
  const raw: Omit<Transaction, "categoryId" | "categorySource" | "kind">[] = [];
  let n = 0;
  const add = (date: string, merchant: string, amount: number, accountId: string, p?: string, d?: string, pending = false) =>
    raw.push({ id: `t${n++}`, accountId, date, merchant, amount, pending, plaidCategory: p, plaidDetailed: d, reviewed: false });

  for (let m = 0; m <= throughMonth; m++) {
    const ym = `${year}-${pad(m + 1)}`;
    add(`${ym}-01`, "Rent - Bayview Apts", 2400, "chk", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT");
    add(`${ym}-01`, "ACME CORP PAYROLL", -3850, "chk", "INCOME", "INCOME_WAGES");
    add(`${ym}-15`, "ACME CORP PAYROLL", -3850, "chk", "INCOME", "INCOME_WAGES");
    add(`${ym}-05`, "PG&E", 96 + Math.round(r() * 60), "chk", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY");
    add(`${ym}-08`, "Netflix.com", 15.49, "cc1", "ENTERTAINMENT", "ENTERTAINMENT_TV_AND_MOVIES");
    add(`${ym}-11`, "Spotify USA", 11.99, "cc2", "ENTERTAINMENT", "ENTERTAINMENT_MUSIC_AND_AUDIO");

    let cc1 = 15.49, cc2 = 11.99;
    const maxDay = m === throughMonth ? 20 : 27; // don't invent future charges
    const count = Math.round((22 + Math.floor(r() * 10)) * maxDay / 27);
    for (let i = 0; i < count; i++) {
      const [mer, base, p, d, acct] = MERCHANTS[Math.floor(r() * MERCHANTS.length)];
      const amt = Math.round(base * (0.6 + r() * 0.9) * 100) / 100;
      add(`${ym}-${pad(1 + Math.floor(r() * maxDay))}`, mer, amt, acct, p, d);
      if (acct === "cc1") cc1 += amt; else cc2 += amt;
    }
    if (m === 6) { add(`${ym}-14`, "Delta Air Lines", 486.4, "cc1", "TRAVEL", "TRAVEL_FLIGHTS"); cc1 += 486.4; }
    if (m === 3) { add(`${ym}-20`, "Amazon.com refund", -37.99, "cc1", "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES"); cc1 -= 37.99; }

    // Pay off the cards from checking next month — both halves of each payment appear.
    if (m < throughMonth) {
      const next = `${year}-${pad(m + 2)}`;
      cc1 = Math.round(cc1 * 100) / 100; cc2 = Math.round(cc2 * 100) / 100;
      add(`${next}-03`, "CHASE CREDIT CRD AUTOPAY", cc1, "chk", "LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT");
      add(`${next}-04`, "AUTOMATIC PAYMENT - THANK YOU", -cc1, "cc1", "TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER");
      add(`${next}-06`, "AMEX EPAYMENT", cc2, "chk", "LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT");
      add(`${next}-06`, "ONLINE PAYMENT - THANK YOU", -cc2, "cc2", "TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER");
    }
  }
  // A pending charge that later posted — must only show once.
  add(`${year}-${pad(throughMonth + 1)}-18`, "SQ *BLUE BOTTLE COFFEE", 7.25, "cc1", "FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE", true);
  const pendingId = raw[raw.length - 1].id;
  add(`${year}-${pad(throughMonth + 1)}-19`, "SQ *BLUE BOTTLE COFFEE", 7.25, "cc1", "FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE");
  raw[raw.length - 1].pendingTransactionId = pendingId;

  return process(raw, [], SAMPLE_ACCOUNTS).map((t) => ({
    // older months already reviewed; this month is the swipe inbox
    ...t,
    reviewed: !t.date.startsWith(`${year}-${pad(throughMonth + 1)}`) || t.kind === "transfer",
  }));
}

/** The ingestion pipeline every synced batch goes through (Plaid sync will reuse this). */
export function process(
  raw: Omit<Transaction, "categoryId" | "categorySource" | "kind">[],
  rules: Rule[],
  accounts: Account[],
): Transaction[] {
  const typed: Transaction[] = raw.map((t) => {
    const { categoryId, source } = categorize(t, rules);
    const kind: Transaction["kind"] =
      categoryId === "income" ? "income" : categoryId === "transfer" ? "transfer" : "spend";
    return { ...t, categoryId, categorySource: source, kind };
  });
  return detectTransfers(dropSupersededPending(typed), accounts);
}
