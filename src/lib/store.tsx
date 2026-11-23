"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Account, Rule, Transaction } from "./types";
import { buildSample, SAMPLE_ACCOUNTS } from "./sample";
import { merchantKey } from "./engine";
import { supabase, supabaseConfigured } from "./supabase/client";
import { editableTxnFields, fromAccountRow, fromRuleRow, fromTxnRow, kindFor, type AccountRow, type RuleRow, type TxnRow } from "./rows";

type Mode = "loading" | "signed-out" | "demo" | "live";

interface Store {
  mode: Mode;
  user: User | null;
  accounts: Account[];
  txns: Transaction[];
  rules: Rule[];
  accept: (id: string) => void;
  recategorize: (id: string, categoryId: string) => void;
  undo: () => void;
  reset: () => void;
  reload: () => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const DEMO_KEY = "budget-demo-v1";
const DEMO_FLAG = "budget-demo-mode";

async function fetchAll<T>(table: string, select: string, order?: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase().from(table).select(select);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const history = useRef<{ txns: Transaction[]; rules: Rule[] }[]>([]);
  const live = mode === "live";

  const loadLive = useCallback(async () => {
    const [t, a, r] = await Promise.all([
      fetchAll<TxnRow>("transactions", "*", "date"),
      fetchAll<AccountRow>("accounts", "id, name, institution, mask, type"),
      fetchAll<RuleRow>("rules", "id, match, category_id"),
    ]);
    setTxns(t.map(fromTxnRow)); setAccounts(a.map(fromAccountRow)); setRules(r.map(fromRuleRow));
  }, []);

  const loadDemo = useCallback(() => {
    setAccounts(SAMPLE_ACCOUNTS);
    try {
      const saved = localStorage.getItem(DEMO_KEY);
      if (saved) { const s = JSON.parse(saved); setTxns(s.txns); setRules(s.rules); return; }
    } catch {}
    setTxns(buildSample()); setRules([]);
  }, []);

  // Decide mode on startup (browser-only state) and whenever sign-in changes.
  useEffect(() => {
    let demo = false;
    try { demo = localStorage.getItem(DEMO_FLAG) === "1"; } catch {}
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!supabaseConfigured) { loadDemo(); setMode("demo"); return; }
    /* eslint-enable react-hooks/set-state-in-effect */
    const sb = supabase();
    const apply = async (u: User | null) => {
      setUser(u);
      if (u) { setMode("live"); await loadLive().catch(console.error); }
      else if (demo) { loadDemo(); setMode("demo"); }
      else setMode("signed-out");
    };
    sb.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((evt, session) => {
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT") apply(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadDemo, loadLive]);

  useEffect(() => {
    if (mode !== "demo" || !txns.length) return;
    try { localStorage.setItem(DEMO_KEY, JSON.stringify({ txns, rules })); } catch {}
  }, [mode, txns, rules]);

  // Write changed transactions back to the database (live mode only).
  const persist = useCallback((changed: Transaction[]) => {
    if (!live) return;
    changed.forEach((t) =>
      supabase().from("transactions").update(editableTxnFields(t)).eq("id", t.id).then(({ error }) => error && console.error(error)),
    );
  }, [live]);

  const store = useMemo<Store>(() => {
    const snapshot = () => { history.current = [...history.current.slice(-20), { txns, rules }]; };
    const saveRule = (match: string, categoryId: string) =>
      supabase().from("rules").upsert({ match, category_id: categoryId }, { onConflict: "user_id,match" }).then(({ error }) => error && console.error(error));
    return {
      mode, user, accounts, txns, rules,
      accept: (id) => {
        snapshot();
        const next = txns.map((t) => (t.id === id ? { ...t, reviewed: true } : t));
        setTxns(next);
        persist(next.filter((t) => t.id === id));
      },
      recategorize: (id, categoryId) => {
        const target = txns.find((t) => t.id === id);
        if (!target) return;
        snapshot();
        const key = merchantKey(target.merchant);
        const kind = kindFor(categoryId);
        const changed: Transaction[] = [];
        const next = txns.map((t) => {
          let n = t;
          if (t.id === id) n = { ...t, categoryId, categorySource: "user", reviewed: true, kind };
          else if (merchantKey(t.merchant) === key && t.categorySource !== "user" && t.kind !== "transfer")
            n = { ...t, categoryId, categorySource: "rule", kind };
          if (n !== t) changed.push(n);
          return n;
        });
        setTxns(next);
        setRules((rs) => [...rs.filter((r) => r.match !== key), { id: crypto.randomUUID(), match: key, categoryId }]);
        if (live) { saveRule(key, categoryId); persist(changed); }
      },
      undo: () => {
        const last = history.current.pop();
        if (!last) return;
        const now = new Map(txns.map((t) => [t.id, t]));
        const reverted = last.txns.filter((t) => now.get(t.id) !== t);
        setTxns(last.txns); setRules(last.rules);
        if (live) {
          persist(reverted);
          const keep = new Set(last.rules.map((r) => r.match));
          rules.filter((r) => !keep.has(r.match)).forEach((r) => supabase().from("rules").delete().eq("match", r.match).then());
          last.rules.forEach((r) => saveRule(r.match, r.categoryId));
        }
      },
      reset: () => {
        if (mode !== "demo") return;
        try { localStorage.removeItem(DEMO_KEY); } catch {}
        history.current = []; setRules([]); setTxns(buildSample());
      },
      reload: async () => { if (live) await loadLive(); },
      startDemo: () => { try { localStorage.setItem(DEMO_FLAG, "1"); } catch {} loadDemo(); setMode("demo"); },
      signOut: async () => {
        try { localStorage.removeItem(DEMO_FLAG); } catch {}
        if (supabaseConfigured) await supabase().auth.signOut();
        history.current = [];
        setTxns([]); setAccounts([]); setRules([]); setUser(null);
        setMode(supabaseConfigured ? "signed-out" : "demo");
        if (!supabaseConfigured) loadDemo();
      },
    };
  }, [mode, user, accounts, txns, rules, live, persist, loadDemo, loadLive]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
