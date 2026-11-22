"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { SwipeCard } from "@/components/SwipeCard";
import { CategoryPicker } from "@/components/CategoryPicker";
import { PageTitle } from "@/components/Tag";

export default function ReviewPage() {
  const { txns, accounts, accept, recategorize, undo, reset } = useStore();
  const [picking, setPicking] = useState<string | null>(null);
  const queue = txns
    .filter((t) => !t.reviewed)
    .sort((a, b) => b.date.localeCompare(a.date));
  const top = queue[0];
  const pickTxn = txns.find((t) => t.id === picking);

  return (
    <>
      <PageTitle icon="📥" title="Review">
        {queue.length ? `${queue.length} to review · swipe right if it looks right, left to change` : "You're all caught up."}
      </PageTitle>

      <div className="relative mx-auto h-[420px] max-w-[400px]">
        {queue.slice(0, 3).reverse().map((t) => {
          const depth = queue.indexOf(t);
          return (
            <SwipeCard key={t.id} txn={t} depth={depth}
              account={accounts.find((a) => a.id === t.accountId)}
              onAccept={() => accept(t.id)}
              onReject={() => setPicking(t.id)} />
          );
        })}
        {!top && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-line text-ink-3">
            <div className="text-[40px]">🎉</div>
            <div className="mt-2 text-[15px]">Inbox zero</div>
          </div>
        )}
      </div>

      {top && (
        <div className="mx-auto mt-6 flex max-w-[400px] gap-3">
          <button onClick={() => setPicking(top.id)}
            className="flex-1 rounded-md border border-line py-2.5 text-[15px] active:bg-hover">← Change</button>
          <button onClick={() => accept(top.id)}
            className="flex-1 rounded-md bg-accent py-2.5 text-[15px] font-medium text-white active:opacity-80">Looks right →</button>
        </div>
      )}

      <div className="mx-auto mt-8 flex max-w-[400px] justify-between text-[13px] text-ink-3">
        <button onClick={undo} className="rounded px-2 py-1 active:bg-hover">↶ Undo</button>
        <button onClick={reset} className="rounded px-2 py-1 active:bg-hover">Reset demo data</button>
      </div>

      {pickTxn && (
        <CategoryPicker current={pickTxn.categoryId}
          onClose={() => setPicking(null)}
          onPick={(c) => { recategorize(pickTxn.id, c); setPicking(null); }} />
      )}
    </>
  );
}
