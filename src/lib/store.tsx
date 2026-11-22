"use client";
// Demo-mode store (browser only). Swapped for Supabase once accounts are set up.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Account, Rule, Transaction } from "./types";
import { buildSample, SAMPLE_ACCOUNTS } from "./sample";
import { merchantKey } from "./engine";

interface Store {
  accounts: Account[];
  txns: Transaction[];
  rules: Rule[];
  accept: (id: string) => void;
  recategorize: (id: string, categoryId: string) => void;
  undo: () => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);
const KEY = "budget-demo-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [history, setHistory] = useState<{ txns: Transaction[]; rules: Rule[] }[]>([]);

  // Load once on mount (localStorage only exists in the browser).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const s = JSON.parse(saved);
        setTxns(s.txns); setRules(s.rules); return;
      }
    } catch {}
    setTxns(buildSample());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!txns.length) return;
    try { localStorage.setItem(KEY, JSON.stringify({ txns, rules })); } catch {}
  }, [txns, rules]);

  const snapshot = () => setHistory((h) => [...h.slice(-20), { txns, rules }]);

  const store = useMemo<Store>(() => ({
    accounts: SAMPLE_ACCOUNTS,
    txns,
    rules,
    accept: (id) => {
      snapshot();
      setTxns((ts) => ts.map((t) => (t.id === id ? { ...t, reviewed: true } : t)));
    },
    recategorize: (id, categoryId) => {
      snapshot();
      const target = txns.find((t) => t.id === id);
      if (!target) return;
      const key = merchantKey(target.merchant);
      // Learn: same merchant -> same category, for past & future charges not hand-set.
      setRules((rs) => [...rs.filter((r) => r.match !== key), { id: crypto.randomUUID(), match: key, categoryId }]);
      setTxns((ts) =>
        ts.map((t) => {
          const kind: Transaction["kind"] = categoryId === "income" ? "income" : categoryId === "transfer" ? "transfer" : "spend";
          if (t.id === id) return { ...t, categoryId, categorySource: "user", reviewed: true, kind };
          if (merchantKey(t.merchant) === key && t.categorySource !== "user" && t.kind !== "transfer")
            return { ...t, categoryId, categorySource: "rule", kind };
          return t;
        }),
      );
    },
    undo: () => {
      const last = history[history.length - 1];
      if (!last) return;
      setTxns(last.txns); setRules(last.rules); setHistory((h) => h.slice(0, -1));
    },
    reset: () => {
      try { localStorage.removeItem(KEY); } catch {}
      setRules([]); setHistory([]); setTxns(buildSample());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [txns, rules, history]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
