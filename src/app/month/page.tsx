"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { byCategory, incomeOf, money, money2, spendOf } from "@/lib/engine";
import { categoryById } from "@/lib/categories";
import { CategoryTag, PageTitle } from "@/components/Tag";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Section, Stat } from "@/components/ui";

const label = (ym: string) =>
  new Date(ym + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function MonthPage() {
  const { txns, accounts, recategorize } = useStore();
  const months = useMemo(() => [...new Set(txns.map((t) => t.date.slice(0, 7)))].sort(), [txns]);
  const [idx, setIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [showTransfers, setShowTransfers] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const i = idx ?? months.length - 1;
  const ym = months[i];
  if (!ym) return null;

  const inMonth = txns.filter((t) => t.date.startsWith(ym));
  const spent = spendOf(inMonth);
  const income = incomeOf(inMonth);
  const cats = byCategory(inMonth);
  const rows = inMonth
    .filter((t) => (showTransfers ? true : t.kind !== "transfer"))
    .filter((t) => !filter || t.categoryId === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const pickTxn = txns.find((t) => t.id === picking);

  return (
    <>
      <div className="mb-4 flex items-center gap-1 text-[14px] text-ink-2">
        <button disabled={i === 0} onClick={() => setIdx(i - 1)} className="rounded px-2 py-1 active:bg-hover disabled:opacity-30">‹</button>
        <button disabled={i === months.length - 1} onClick={() => setIdx(i + 1)} className="rounded px-2 py-1 active:bg-hover disabled:opacity-30">›</button>
      </div>
      <PageTitle icon="🗓️" title={label(ym)} />

      <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-[var(--line)]">
        <Stat label="Spent" value={money(spent)} />
        <Stat label="Income" value={money(income)} />
        <Stat label="Net" value={money(income - spent)} tone={income - spent >= 0 ? "pos" : "neg"} />
      </div>

      <Section title="By category">
        <div className="space-y-1">
          {cats.map((c) => {
            const cat = categoryById(c.categoryId);
            const active = filter === c.categoryId;
            return (
              <button key={c.categoryId} onClick={() => setFilter(active ? null : c.categoryId)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[14px] ${active ? "bg-hover" : "active:bg-hover"}`}>
                <span className="w-36 shrink-0"><CategoryTag id={c.categoryId} /></span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f1ef]">
                  <span className={`block h-full rounded-full bar-${cat.color}`} style={{ width: `${(c.total / cats[0].total) * 100}%` }} />
                </span>
                <span className="w-20 text-right tabular">{money(c.total)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={filter ? `${categoryById(filter).name} transactions` : "Transactions"}
        right={
          <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <input type="checkbox" checked={showTransfers} onChange={(e) => setShowTransfers(e.target.checked)} />
            Show transfers
          </label>
        }>
        <div className="border-t border-line">
          {rows.map((t) => {
            const a = accounts.find((x) => x.id === t.accountId);
            return (
              <div key={t.id} className={`flex items-center gap-3 border-b border-line py-2 text-[14px] ${t.kind === "transfer" ? "opacity-50" : ""}`}>
                <span className="w-12 shrink-0 text-[12px] text-ink-3 tabular">{t.date.slice(5).replace("-", "/")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.merchant}</span>
                  <span className="block truncate text-[12px] text-ink-3">{a?.institution} ··{a?.mask}{!t.reviewed && " · unreviewed"}</span>
                </span>
                <button onClick={() => setPicking(t.id)} className="hidden shrink-0 sm:block"><CategoryTag id={t.categoryId} /></button>
                <button onClick={() => setPicking(t.id)} className="shrink-0 text-[16px] sm:hidden">{categoryById(t.categoryId).emoji}</button>
                <span className={`w-20 shrink-0 text-right tabular ${t.amount < 0 ? "text-[#448361]" : ""}`}>
                  {t.amount < 0 ? "+" : ""}{money2(Math.abs(t.amount))}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {pickTxn && (
        <CategoryPicker current={pickTxn.categoryId} onClose={() => setPicking(null)}
          onPick={(c) => { recategorize(pickTxn.id, c); setPicking(null); }} />
      )}
    </>
  );
}
