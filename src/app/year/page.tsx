"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { byCategory, incomeOf, money, spendOf } from "@/lib/engine";
import { categoryById } from "@/lib/categories";
import { CategoryTag, PageTitle } from "@/components/Tag";
import { Section, Stat } from "@/components/ui";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function YearPage() {
  const { txns } = useStore();
  const years = useMemo(() => [...new Set(txns.map((t) => t.date.slice(0, 4)))].sort(), [txns]);
  const [sel, setSel] = useState<string | null>(null);
  const year = sel ?? years[years.length - 1];
  if (!year) return null;

  const inYear = txns.filter((t) => t.date.startsWith(year));
  const perMonth = MONTHS.map((_, m) => {
    const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
    const ts = inYear.filter((t) => t.date.startsWith(ym));
    return { ym, spent: spendOf(ts), income: incomeOf(ts), has: ts.length > 0 };
  });
  const active = perMonth.filter((m) => m.has);
  const spent = spendOf(inYear);
  const income = incomeOf(inYear);
  const max = Math.max(...perMonth.map((m) => m.spent), 1);
  const cats = byCategory(inYear);

  return (
    <>
      {years.length > 1 && (
        <div className="mb-4 flex gap-1">
          {years.map((y) => (
            <button key={y} onClick={() => setSel(y)} className={`rounded px-2 py-1 text-[14px] ${y === year ? "bg-hover" : "text-ink-3"}`}>{y}</button>
          ))}
        </div>
      )}
      <PageTitle icon="📊" title={year} />

      <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-[var(--line)]">
        <Stat label="Spent" value={money(spent)} />
        <Stat label="Avg / month" value={money(active.length ? spent / active.length : 0)} />
        <Stat label="Saved" value={money(income - spent)} tone={income - spent >= 0 ? "pos" : "neg"} />
      </div>

      <Section title="Spending by month">
        <div className="flex h-44 items-end gap-1.5 border-b border-line pb-1">
          {perMonth.map((m, i) => (
            <Link key={m.ym} href="/month" className="group flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] text-ink-3 opacity-0 tabular group-hover:opacity-100">{m.has ? `$${Math.round(m.spent / 100) / 10}k` : ""}</span>
              <span className="w-full rounded-t-[3px] bg-[#c7d9e8]" style={{ height: `${(m.spent / max) * 85}%` }} />
              <span className="sr-only">{MONTHS[i]}</span>
            </Link>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          {MONTHS.map((l, i) => <span key={i} className="flex-1 text-center text-[11px] text-ink-3">{l}</span>)}
        </div>
      </Section>

      <Section title="By category">
        <div className="border-t border-line">
          <div className="flex border-b border-line py-1.5 text-[12px] text-ink-3">
            <span className="flex-1">Category</span>
            <span className="w-24 text-right">Avg / mo</span>
            <span className="w-24 text-right">Total</span>
          </div>
          {cats.map((c) => (
            <div key={c.categoryId} className="flex items-center border-b border-line py-2 text-[14px]">
              <span className="flex-1"><CategoryTag id={c.categoryId} /></span>
              <span className="w-24 text-right text-ink-2 tabular">{money(c.total / Math.max(active.length, 1))}</span>
              <span className="w-24 text-right tabular">{money(c.total)}</span>
            </div>
          ))}
          <div className="flex py-2 text-[14px] font-semibold">
            <span className="flex-1">Total</span>
            <span className="w-24 text-right tabular">{money(spent / Math.max(active.length, 1))}</span>
            <span className="w-24 text-right tabular">{money(spent)}</span>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">
          {categoryById("transfer").emoji} Credit card payments and transfers between your accounts are excluded, so nothing is counted twice.
        </p>
      </Section>
    </>
  );
}
